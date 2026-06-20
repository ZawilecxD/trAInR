#!/usr/bin/env node

/**
 * lint-staged helper: run only unit/integration tests related to staged files.
 * Vitest 4 does not expose a reliable `related` subcommand here, so we:
 * - run staged *.test.ts files directly
 * - run co-located <name>.test.ts for staged source files
 * - scan unit test files under src/ for imports of staged src modules
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const UNIT_TEST_GLOB_DIR = path.join(ROOT, "src");
const TIMEOUT_MS = 120_000;

function normalizePosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function isUnitTest(file) {
  return file.startsWith("src/") && file.endsWith(".test.ts");
}

function isIntegrationTest(file) {
  return file.startsWith("tests/integration/") && file.endsWith(".test.ts");
}

function isSourceFile(file) {
  return file.startsWith("src/") && /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts");
}

function coLocatedTest(file) {
  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name}.test.ts`);
}

function listUnitTestFiles() {
  const results = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        results.push(normalizePosix(path.relative(ROOT, fullPath)));
      }
    }
  }

  walk(UNIT_TEST_GLOB_DIR);
  return results;
}

function moduleMarkersForSource(file) {
  const withoutExt = file.replace(/\.tsx?$/, "");
  const fromSrc = withoutExt.startsWith("src/") ? withoutExt.slice("src/".length) : withoutExt;
  const alias = `@/${fromSrc}`;
  const basename = path.basename(withoutExt);
  return { alias, basename, fromSrc };
}

function testImportsSource(testContent, markers) {
  if (testContent.includes(markers.alias)) return true;

  const patterns = [
    `"${markers.fromSrc}"`,
    `'${markers.fromSrc}'`,
    `"./${markers.basename}"`,
    `'./${markers.basename}'`,
    `"../${markers.basename}"`,
    `'../${markers.basename}'`,
    `/${markers.basename}'`,
    `/${markers.basename}"`,
  ];

  return patterns.some((pattern) => testContent.includes(pattern));
}

function collectTestsForStagedFiles(stagedFiles) {
  const unitTests = new Set();
  const integrationTests = new Set();
  const unitTestFiles = listUnitTestFiles();
  const unitTestContents = new Map(
    unitTestFiles.map((testFile) => [testFile, fs.readFileSync(path.join(ROOT, testFile), "utf8")]),
  );

  for (const rawFile of stagedFiles) {
    const file = normalizePosix(rawFile);

    if (isIntegrationTest(file)) {
      integrationTests.add(file);
      continue;
    }

    if (isUnitTest(file)) {
      unitTests.add(file);
      continue;
    }

    if (!isSourceFile(file)) continue;

    const sibling = normalizePosix(coLocatedTest(file));
    if (fs.existsSync(path.join(ROOT, sibling))) {
      unitTests.add(sibling);
    }

    const markers = moduleMarkersForSource(file);
    for (const [testFile, content] of unitTestContents) {
      if (testImportsSource(content, markers)) {
        unitTests.add(testFile);
      }
    }
  }

  return {
    unitTests: [...unitTests].sort(),
    integrationTests: [...integrationTests].sort(),
  };
}

function runVitest(testFiles, configFile) {
  const args = ["run", ...testFiles];
  if (configFile) {
    args.splice(1, 0, "--config", configFile);
  }

  execFileSync(process.execPath, [VITEST, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: TIMEOUT_MS,
  });
}

function main() {
  const stagedFiles = process.argv.slice(2).map(normalizePosix).filter(Boolean);
  if (stagedFiles.length === 0) return;

  const { unitTests, integrationTests } = collectTestsForStagedFiles(stagedFiles);
  if (unitTests.length === 0 && integrationTests.length === 0) return;

  if (unitTests.length > 0) {
    console.log(`vitest-staged: running ${unitTests.length} unit test file(s)`);
    runVitest(unitTests);
  }

  if (integrationTests.length > 0) {
    console.log(`vitest-staged: running ${integrationTests.length} integration test file(s)`);
    runVitest(integrationTests, "vitest.integration.config.ts");
  }
}

try {
  main();
} catch (error) {
  process.exit(typeof error.status === "number" ? error.status : 1);
}
