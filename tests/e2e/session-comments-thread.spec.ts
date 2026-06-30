/**
 * Risk: bidirectional session comments must cross every real boundary — auth →
 *   routing → API → RLS → rendered UI — for BOTH roles, and the cross-role
 *   attribution ("You" vs "Trainer"/"Client") only exists once the thread is
 *   rendered for a specific viewer. This fails if a comment one role posts is
 *   not visible to the other, or if author attribution is computed wrong.
 *
 * Seed: tests/e2e/seed.spec.ts
 * Auth: trainer + client storage states are loaded into separate browser
 *   contexts; neither logs in through the UI. The trainer API context also
 *   creates and tears down the shared session.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE } from "./auth";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";

// The comments island lives alongside other islands (SessionForm / overview),
// so scope every interaction to the section that owns the "Comments" heading.
function commentsSection(page: Page): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "Comments" }) });
}

async function postComment(section: Locator, page: Page, sessionId: string, body: string) {
  await section.getByLabel("Comment text").fill(body);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/api/sessions/${sessionId}/comments`) && res.request().method() === "POST",
    ),
    section.getByRole("button", { name: "Send" }).click(),
  ]);
  expect(response.status()).toBe(201);
}

test.describe("Session comments — bidirectional cross-role thread", () => {
  test("trainer and client see each other's comments with correct attribution", async ({ browser }) => {
    const trainerContext = await browser.newContext({ storageState: TRAINER_STORAGE_STATE });
    const clientContext = await browser.newContext({ storageState: CLIENT_STORAGE_STATE });
    let createdSessionId: string | null = null;

    try {
      const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const trainerComment = `Trainer pre-workout note ${uniqueSuffix}`;
      const clientComment = `Client reply ${uniqueSuffix}`;
      const scheduledDate = new Date().toISOString().slice(0, 10);

      // Setup: trainer creates a fresh (not_started, therefore editable) session
      // for Client A through the authenticated API.
      const createResponse = await trainerContext.request.post("/api/workout-sessions", {
        data: {
          client_id: CLIENT_A_ID,
          scheduled_date: scheduledDate,
          name: `E2E Comments Thread ${uniqueSuffix}`,
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
      expect(createResponse.status()).toBe(201);
      const createBody = (await createResponse.json()) as { session?: { id?: string } };
      const sessionId = createBody.session?.id;
      expect(sessionId).toBeTruthy();
      if (!sessionId) throw new Error("Create session response did not include an id");
      createdSessionId = sessionId;

      // Action (trainer): open the client's session and post a comment.
      const trainerPage = await trainerContext.newPage();
      await trainerPage.goto(`/trainer/clients/${CLIENT_A_ID}/sessions/${sessionId}`);
      const trainerSection = commentsSection(trainerPage);
      // Wait for the empty-state, which only renders after the island hydrates and
      // its mount fetch resolves — a hydration signal that touches no input.
      await expect(trainerSection.getByText("No comments yet")).toBeVisible();

      await postComment(trainerSection, trainerPage, sessionId, trainerComment);

      // Assertion (trainer): own comment renders with the "You" attribution.
      await expect(trainerSection.getByText(trainerComment)).toBeVisible();
      await expect(trainerSection.getByText("You", { exact: true })).toBeVisible();

      // Action (client): open the SAME session — overview mode renders the thread.
      const clientPage = await clientContext.newPage();
      await clientPage.goto(`/client/sessions/${sessionId}`);
      const clientSection = commentsSection(clientPage);

      // Assertion (client): the trainer's comment is visible, badged "Trainer".
      await expect(clientSection.getByText(trainerComment)).toBeVisible();
      await expect(clientSection.getByText("Trainer", { exact: true })).toBeVisible();

      // Action (client): reply, and confirm the reply is "You" for the client.
      await postComment(clientSection, clientPage, sessionId, clientComment);
      await expect(clientSection.getByText(clientComment)).toBeVisible();
      await expect(clientSection.getByText("You", { exact: true })).toBeVisible();

      // Assertion (trainer): after a real SSR reload the trainer reads the
      // client's reply back from the DB, badged "Client".
      await trainerPage.reload();
      const trainerSectionAfter = commentsSection(trainerPage);
      await expect(trainerSectionAfter.getByText(clientComment)).toBeVisible();
      await expect(trainerSectionAfter.getByText("Client", { exact: true })).toBeVisible();
      // The trainer's own earlier comment is still present and still "You".
      await expect(trainerSectionAfter.getByText(trainerComment)).toBeVisible();
    } finally {
      if (createdSessionId) {
        await trainerContext.request.delete(`/api/workout-sessions/${createdSessionId}`);
      }
      await trainerContext.close();
      await clientContext.close();
    }
  });
});
