#!/usr/bin/env node
/**
 * Manual plan verification for S-13 data edit window.
 * 1. Complete session (done/partial) → locked_at ≈ completion + 24h
 * 2. Seal session → edit-list read-only + API 423 on writes
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
const trainerCredentials = {
  email: process.env.E2E_TRAINER_EMAIL ?? "trainer-A@gmail.com",
  password: process.env.E2E_TRAINER_PASSWORD ?? "Rooster2",
};
const clientCredentials = {
  email: process.env.E2E_CLIENT_EMAIL ?? "client-A@gmail.com",
  password: process.env.E2E_CLIENT_PASSWORD ?? "Rooster2",
};

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";
const SUPABASE_URL = process.env.INTEGRATION_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pass(label, detail) {
  console.log(`✅ PASS — ${label}`);
  if (detail) console.log(`   ${detail}`);
}

function fail(label, detail) {
  console.error(`❌ FAIL — ${label}`);
  if (detail) console.error(`   ${detail}`);
  process.exitCode = 1;
}

async function signInRequestContext(browser, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByTestId("signin-email").fill(email);
  await page.getByTestId("signin-password").fill(password);
  await page.getByTestId("signin-submit").click();
  await page.waitForURL(/\/(client|trainer)\/dashboard/);
  const request = context.request;
  return { context, page, request };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let trainerContext;
  let clientContext;
  let sessionId = null;
  let sessionExerciseId = null;

  try {
    trainerContext = await signInRequestContext(
      browser,
      trainerCredentials.email,
      trainerCredentials.password,
    );
    clientContext = await signInRequestContext(browser, clientCredentials.email, clientCredentials.password);

    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const scheduledDate = new Date().toISOString().slice(0, 10);

    const createResponse = await trainerContext.request.post(`${BASE_URL}/api/workout-sessions`, {
      data: {
        client_id: CLIENT_A_ID,
        scheduled_date: scheduledDate,
        name: `S-13 verify ${uniqueSuffix}`,
        source_template_id: null,
        exercises: [
          {
            exercise_id: BENCH_PRESS_ID,
            phase: "main",
            sort_order: 0,
            notes: null,
            sets: [
              {
                prescribed_reps: 8,
                prescribed_duration_seconds: null,
                prescribed_load_kg: 40,
                rest_after_seconds: 60,
                is_warmup: false,
              },
            ],
          },
        ],
      },
    });

    if (createResponse.status() !== 201) {
      fail("create session", `status ${createResponse.status()}: ${await createResponse.text()}`);
      return;
    }

    const createBody = await createResponse.json();
    sessionId = createBody.session?.id;
    sessionExerciseId = createBody.session?.exercises?.[0]?.id;

    if (!sessionId || !sessionExerciseId) {
      fail("create session", "missing session or exercise id in response");
      return;
    }

    const startResponse = await clientContext.request.post(`${BASE_URL}/api/client/sessions/${sessionId}/start`, {
      headers: { origin: BASE_URL },
    });
    if (startResponse.status() !== 200) {
      fail("start session", `status ${startResponse.status()}: ${await startResponse.text()}`);
      return;
    }

    const upsertResponse = await clientContext.request.put(`${BASE_URL}/api/client/set-logs`, {
      headers: { origin: BASE_URL, "content-type": "application/json" },
      data: {
        session_exercise_id: sessionExerciseId,
        set_number: 1,
        reps: 10,
        duration_seconds: null,
        load_kg: 50,
        is_complete: true,
        is_warmup: false,
      },
    });

    if (upsertResponse.status() !== 200) {
      fail("log first set", `status ${upsertResponse.status()}: ${await upsertResponse.text()}`);
      return;
    }

    const upsertBody = await upsertResponse.json();
    const loggedAt = upsertBody.set_log?.logged_at;
    if (!loggedAt) {
      fail("log first set", "response missing set_log.logged_at");
      return;
    }

    pass("log first set", `logged_at=${loggedAt}`);

    const beforeComplete = new Date();
    const completeResponse = await clientContext.request.post(
      `${BASE_URL}/api/client/sessions/${sessionId}/complete`,
      {
        headers: { origin: BASE_URL, "content-type": "application/json" },
        data: { status: "finished" },
      },
    );

    if (completeResponse.status() !== 200) {
      fail("complete session", `status ${completeResponse.status()}: ${await completeResponse.text()}`);
      return;
    }

    const completeBody = await completeResponse.json();
    const completedAt = completeBody.session?.completed_at;
    if (!completedAt) {
      fail("complete session", "response missing session.completed_at");
      return;
    }

    const { data: sessionRow, error: sessionError } = await admin
      .from("workout_sessions")
      .select("locked_at, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionRow?.locked_at) {
      fail("locked_at set on completion", sessionError?.message ?? "locked_at is null");
      return;
    }

    if (sessionRow.status !== "finished") {
      fail("session status finished", `status=${sessionRow.status}`);
      return;
    }

    const expectedDeadline = new Date(new Date(completedAt).getTime() + EDIT_WINDOW_MS);
    const actualDeadline = new Date(sessionRow.locked_at);
    const deltaMs = Math.abs(actualDeadline.getTime() - expectedDeadline.getTime());

    if (deltaMs > 2000) {
      fail(
        "locked_at ≈ completion + 24h",
        `completed_at=${completedAt}, locked_at=${sessionRow.locked_at}, expected≈${expectedDeadline.toISOString()}, deltaMs=${deltaMs}`,
      );
    } else {
      pass(
        "locked_at ≈ completion + 24h",
        `completed_at=${completedAt}, locked_at=${sessionRow.locked_at}, deltaMs=${deltaMs}`,
      );
    }

    if (beforeComplete.getTime() > actualDeadline.getTime()) {
      fail("locked_at in future", `locked_at=${sessionRow.locked_at}`);
    }

    const { error: sealError } = await admin
      .from("workout_sessions")
      .update({ locked_at: "2020-01-01T00:00:00.000Z" })
      .eq("id", sessionId);

    if (sealError) {
      fail("seal session in DB", sealError.message);
      return;
    }

    const sealedUpsert = await clientContext.request.put(`${BASE_URL}/api/client/set-logs`, {
      headers: { origin: BASE_URL, "content-type": "application/json" },
      data: {
        session_exercise_id: sessionExerciseId,
        set_number: 1,
        reps: 12,
        duration_seconds: null,
        load_kg: 55,
        is_complete: true,
        is_warmup: false,
      },
    });

    if (sealedUpsert.status() === 423) {
      pass("API returns 423 on write when sealed", await sealedUpsert.text());
    } else {
      fail("API returns 423 on write when sealed", `status ${sealedUpsert.status()}: ${await sealedUpsert.text()}`);
    }

    const sealedDelete = await clientContext.request.delete(
      `${BASE_URL}/api/client/set-logs?session_exercise_id=${sessionExerciseId}&set_number=1`,
      { headers: { origin: BASE_URL } },
    );

    if (sealedDelete.status() === 423) {
      pass("API returns 423 on delete when sealed");
    } else {
      fail("API returns 423 on delete when sealed", `status ${sealedDelete.status()}: ${await sealedDelete.text()}`);
    }

    const page = clientContext.page;
    await page.goto(`${BASE_URL}/client/sessions/${sessionId}`);
    await page.getByText("Session sealed — logged data can no longer be edited").waitFor({ timeout: 15_000 });

    const repsInput = page.getByLabel("Set 1 reps");
    await repsInput.waitFor({ timeout: 10_000 });

    const isDisabled = await repsInput.isDisabled();
    const isReadOnly = (await repsInput.getAttribute("readonly")) !== null;
    const restartDisabled = await page.getByRole("button", { name: "Restart" }).isDisabled();
    const addRoundVisible = await page.getByRole("button", { name: "Add round" }).count();

    if (isDisabled && isReadOnly && restartDisabled && addRoundVisible === 0) {
      pass("edit-list UI is read-only when sealed", "inputs disabled, Restart disabled, Add round hidden");
    } else {
      fail(
        "edit-list UI is read-only when sealed",
        `disabled=${isDisabled}, readonly=${isReadOnly}, restartDisabled=${restartDisabled}, addRoundCount=${addRoundVisible}`,
      );
    }
  } finally {
    if (sessionId && trainerContext) {
      await trainerContext.request.delete(`${BASE_URL}/api/workout-sessions/${sessionId}`);
    }
    await trainerContext?.context.close();
    await clientContext?.context.close();
    await browser.close();
  }

  if (process.exitCode === 1) {
    process.exit(1);
  }
  console.log("\nAll S-13 manual verifications passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
