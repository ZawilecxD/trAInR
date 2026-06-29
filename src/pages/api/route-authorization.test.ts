import type { APIContext, APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase";
import { DELETE as deleteClientSetLog, PUT as putClientSetLog } from "@/pages/api/client/set-logs";
import { GET as getClientSessions } from "@/pages/api/client/sessions";
import { GET as getClientSessionById } from "@/pages/api/client/sessions/[id]";
import { POST as restartClientSession } from "@/pages/api/client/sessions/[id]/restart";
import { POST as startClientSession } from "@/pages/api/client/sessions/[id]/start";
import { GET as getExerciseById, PATCH as patchExerciseById } from "@/pages/api/exercises/[id]";
import { GET as listExercises, POST as createExercise } from "@/pages/api/exercises/index";
import { POST as createInvite } from "@/pages/api/invites/index";
import {
  GET as getSessionTemplateById,
  PATCH as patchSessionTemplateById,
  DELETE as deleteSessionTemplateById,
} from "@/pages/api/session-templates/[id]";
import { GET as listSessionTemplates, POST as createSessionTemplate } from "@/pages/api/session-templates/index";
import { DELETE as deleteTrainerClient } from "@/pages/api/trainer-clients/[id]";
import {
  GET as getWorkoutSessionById,
  PATCH as patchWorkoutSessionById,
  DELETE as deleteWorkoutSessionById,
} from "@/pages/api/workout-sessions/[id]";
import { GET as listWorkoutSessions, POST as createWorkoutSession } from "@/pages/api/workout-sessions/index";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const TRAINER_CLIENT_ID = "00000000-0000-4000-8000-000000000002";

type RouteHandler = APIRoute;

interface GuardHelperRouteEntry {
  label: string;
  handler: RouteHandler;
  wrongRole: "client" | "trainer";
  options?: {
    method?: string;
    url?: string;
    params?: Record<string, string>;
    body?: unknown;
  };
}

function makeContext(overrides: {
  user?: APIContext["locals"]["user"];
  role?: APIContext["locals"]["role"];
  method?: string;
  url?: string;
  params?: Record<string, string>;
  body?: unknown;
}): APIContext {
  const method = overrides.method ?? "GET";
  const url = overrides.url ?? "http://localhost/api";
  const init: RequestInit = { method };

  if (overrides.body !== undefined) {
    init.body = JSON.stringify(overrides.body);
    init.headers = { "Content-Type": "application/json" };
  }

  return {
    request: new Request(url, init),
    url: new URL(url),
    params: overrides.params ?? {},
    locals: {
      user: overrides.user ?? null,
      role: overrides.role ?? null,
    },
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      merge: vi.fn(),
      headers: vi.fn(),
    },
  } as unknown as APIContext;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

const TRAINER_GUARD_HELPER_ROUTES: GuardHelperRouteEntry[] = [
  { label: "GET /api/exercises", handler: listExercises, wrongRole: "client" },
  {
    label: "POST /api/exercises",
    handler: createExercise,
    wrongRole: "client",
    options: { method: "POST", url: "http://localhost/api/exercises", body: {} },
  },
  {
    label: "GET /api/exercises/:id",
    handler: getExerciseById,
    wrongRole: "client",
    options: {
      url: `http://localhost/api/exercises/${SESSION_ID}`,
      params: { id: SESSION_ID },
    },
  },
  {
    label: "PATCH /api/exercises/:id",
    handler: patchExerciseById,
    wrongRole: "client",
    options: {
      method: "PATCH",
      url: `http://localhost/api/exercises/${SESSION_ID}`,
      params: { id: SESSION_ID },
      body: {},
    },
  },
  { label: "GET /api/session-templates", handler: listSessionTemplates, wrongRole: "client" },
  {
    label: "POST /api/session-templates",
    handler: createSessionTemplate,
    wrongRole: "client",
    options: { method: "POST", url: "http://localhost/api/session-templates", body: {} },
  },
  {
    label: "GET /api/session-templates/:id",
    handler: getSessionTemplateById,
    wrongRole: "client",
    options: {
      url: `http://localhost/api/session-templates/${SESSION_ID}`,
      params: { id: SESSION_ID },
    },
  },
  {
    label: "PATCH /api/session-templates/:id",
    handler: patchSessionTemplateById,
    wrongRole: "client",
    options: {
      method: "PATCH",
      url: `http://localhost/api/session-templates/${SESSION_ID}`,
      params: { id: SESSION_ID },
      body: {},
    },
  },
  {
    label: "DELETE /api/session-templates/:id",
    handler: deleteSessionTemplateById,
    wrongRole: "client",
    options: {
      method: "DELETE",
      url: `http://localhost/api/session-templates/${SESSION_ID}`,
      params: { id: SESSION_ID },
    },
  },
  { label: "GET /api/workout-sessions", handler: listWorkoutSessions, wrongRole: "client" },
  {
    label: "POST /api/workout-sessions",
    handler: createWorkoutSession,
    wrongRole: "client",
    options: { method: "POST", url: "http://localhost/api/workout-sessions", body: {} },
  },
  {
    label: "GET /api/workout-sessions/:id",
    handler: getWorkoutSessionById,
    wrongRole: "client",
    options: {
      url: `http://localhost/api/workout-sessions/${SESSION_ID}`,
      params: { id: SESSION_ID },
    },
  },
  {
    label: "PATCH /api/workout-sessions/:id",
    handler: patchWorkoutSessionById,
    wrongRole: "client",
    options: {
      method: "PATCH",
      url: `http://localhost/api/workout-sessions/${SESSION_ID}`,
      params: { id: SESSION_ID },
      body: {},
    },
  },
  {
    label: "DELETE /api/workout-sessions/:id",
    handler: deleteWorkoutSessionById,
    wrongRole: "client",
    options: {
      method: "DELETE",
      url: `http://localhost/api/workout-sessions/${SESSION_ID}`,
      params: { id: SESSION_ID },
    },
  },
];

const CLIENT_GUARD_HELPER_ROUTES: GuardHelperRouteEntry[] = [
  {
    label: "GET /api/client/sessions",
    handler: getClientSessions,
    wrongRole: "trainer",
    options: { url: "http://localhost/api/client/sessions" },
  },
  {
    label: "GET /api/client/sessions/:id",
    handler: getClientSessionById,
    wrongRole: "trainer",
    options: {
      url: `http://localhost/api/client/sessions/${SESSION_ID}`,
      params: { id: SESSION_ID },
    },
  },
  {
    label: "POST /api/client/sessions/:id/start",
    handler: startClientSession,
    wrongRole: "trainer",
    options: {
      method: "POST",
      url: `http://localhost/api/client/sessions/${SESSION_ID}/start`,
      params: { id: SESSION_ID },
    },
  },
  {
    label: "POST /api/client/sessions/:id/restart",
    handler: restartClientSession,
    wrongRole: "trainer",
    options: {
      method: "POST",
      url: `http://localhost/api/client/sessions/${SESSION_ID}/restart`,
      params: { id: SESSION_ID },
    },
  },
  {
    label: "PUT /api/client/set-logs",
    handler: putClientSetLog,
    wrongRole: "trainer",
    options: { method: "PUT", url: "http://localhost/api/client/set-logs", body: {} },
  },
  {
    label: "DELETE /api/client/set-logs",
    handler: deleteClientSetLog,
    wrongRole: "trainer",
    options: {
      method: "DELETE",
      url: "http://localhost/api/client/set-logs?session_exercise_id=00000000-0000-4000-8000-000000000003&set_number=1",
    },
  },
];

const GUARD_HELPER_ROUTES = [...TRAINER_GUARD_HELPER_ROUTES, ...CLIENT_GUARD_HELPER_ROUTES];

function buildInlineSupabaseMock(options: {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  profileRole?: string | null;
  profileError?: { message: string } | null;
}) {
  const inviteInsertSingle = vi.fn();
  const removeTrainerClientRpc = vi.fn();

  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.profileRole === undefined ? null : { role: options.profileRole },
    error: options.profileError ?? null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { select };
    }

    if (table === "invite_links") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: inviteInsertSingle,
          }),
        }),
      };
    }

    return {};
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
    },
    from,
    rpc: removeTrainerClientRpc,
  };

  return { client, inviteInsertSingle, removeTrainerClientRpc };
}

describe("guard-helper route authorization", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("createClient should not be called on auth-failure paths");
    });
  });

  it("enumerates all protected guard-helper handlers", () => {
    expect(GUARD_HELPER_ROUTES).toHaveLength(20);
    expect(TRAINER_GUARD_HELPER_ROUTES).toHaveLength(14);
    expect(CLIENT_GUARD_HELPER_ROUTES).toHaveLength(6);
  });

  describe.each(GUARD_HELPER_ROUTES)("$label", ({ handler, wrongRole, options }) => {
    it("returns 401 for unauthenticated callers", async () => {
      const context = makeContext({
        user: null,
        role: null,
        method: options?.method,
        url: options?.url,
        params: options?.params,
        body: options?.body,
      });

      const response = await handler(context);

      expect(response.status).toBe(401);
      await expect(parseJson(response)).resolves.toEqual({ error: "unauthorized" });
      expect(createClient).not.toHaveBeenCalled();
    });

    it("returns 403 for wrong-role callers", async () => {
      const context = makeContext({
        user: { id: "user-1" } as APIContext["locals"]["user"],
        role: wrongRole,
        method: options?.method,
        url: options?.url,
        params: options?.params,
        body: options?.body,
      });

      const response = await handler(context);

      expect(response.status).toBe(403);
      await expect(parseJson(response)).resolves.toEqual({ error: "forbidden" });
      expect(createClient).not.toHaveBeenCalled();
    });
  });
});

describe("inline trainer-auth route authorization", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  describe("POST /api/invites", () => {
    it("returns 401 when auth.getUser has no user", async () => {
      const { client, inviteInsertSingle } = buildInlineSupabaseMock({
        user: null,
        authError: { message: "not authenticated" },
      });
      vi.mocked(createClient).mockReturnValue(client as never);

      const response = await createInvite(makeContext({ method: "POST", url: "http://localhost/api/invites" }));

      expect(response.status).toBe(401);
      await expect(parseJson(response)).resolves.toEqual({ error: "Unauthorized" });
      expect(inviteInsertSingle).not.toHaveBeenCalled();
    });

    it("returns 403 for non-trainer profiles before invite insert", async () => {
      const { client, inviteInsertSingle } = buildInlineSupabaseMock({
        user: { id: "client-1" },
        profileRole: "client",
      });
      vi.mocked(createClient).mockReturnValue(client as never);

      const response = await createInvite(makeContext({ method: "POST", url: "http://localhost/api/invites" }));

      expect(response.status).toBe(403);
      await expect(parseJson(response)).resolves.toEqual({ error: "Forbidden" });
      expect(inviteInsertSingle).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/trainer-clients/:id", () => {
    it("returns 401 when auth.getUser has no user", async () => {
      const { client, removeTrainerClientRpc } = buildInlineSupabaseMock({
        user: null,
        authError: { message: "not authenticated" },
      });
      vi.mocked(createClient).mockReturnValue(client as never);

      const response = await deleteTrainerClient(
        makeContext({
          method: "DELETE",
          url: `http://localhost/api/trainer-clients/${TRAINER_CLIENT_ID}`,
          params: { id: TRAINER_CLIENT_ID },
        }),
      );

      expect(response.status).toBe(401);
      await expect(parseJson(response)).resolves.toEqual({ error: "Unauthorized" });
      expect(removeTrainerClientRpc).not.toHaveBeenCalled();
    });

    it("returns 403 for non-trainer profiles before remove_trainer_client RPC", async () => {
      const { client, removeTrainerClientRpc } = buildInlineSupabaseMock({
        user: { id: "client-1" },
        profileRole: "client",
      });
      vi.mocked(createClient).mockReturnValue(client as never);

      const response = await deleteTrainerClient(
        makeContext({
          method: "DELETE",
          url: `http://localhost/api/trainer-clients/${TRAINER_CLIENT_ID}`,
          params: { id: TRAINER_CLIENT_ID },
        }),
      );

      expect(response.status).toBe(403);
      await expect(parseJson(response)).resolves.toEqual({ error: "Forbidden" });
      expect(removeTrainerClientRpc).not.toHaveBeenCalled();
    });
  });
});
