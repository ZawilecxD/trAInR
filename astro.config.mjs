// @ts-check
import process from "node:process";

import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

// `data-testid` attributes give E2E specs readable selectors (getByTestId) in
// development, where Playwright runs against `astro dev`. Strip them from the
// production bundle so they never ship to users. `astro build` is the only
// command that produces the deployed output, so key off the CLI verb.
const isProductionBuild = process.argv.includes("build");

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    react({
      babel: {
        plugins: isProductionBuild ? [["babel-plugin-react-remove-properties", { properties: ["data-testid"] }]] : [],
      },
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
