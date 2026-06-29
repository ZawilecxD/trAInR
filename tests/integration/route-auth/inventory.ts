import type { APIRoute } from "astro";

export type ProtectedRole = "trainer" | "client";
export type GuardPattern = "A" | "B";

export interface ProtectedRouteHandler {
  id: string;
  method: string;
  path: string;
  role: ProtectedRole;
  pattern: GuardPattern;
  params?: Record<string, string>;
  invalidBody?: string;
  loadHandler: () => Promise<APIRoute>;
}

export const DUMMY_UUID = "00000000-0000-4000-8000-000000000001";

const BASE_URL = "http://localhost";

export const PROTECTED_ROUTE_HANDLERS: ProtectedRouteHandler[] = [
  {
    id: "exercises-index-get",
    method: "GET",
    path: `${BASE_URL}/api/exercises`,
    role: "trainer",
    pattern: "A",
    loadHandler: async () => (await import("@/pages/api/exercises/index")).GET,
  },
  {
    id: "exercises-index-post",
    method: "POST",
    path: `${BASE_URL}/api/exercises`,
    role: "trainer",
    pattern: "A",
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/exercises/index")).POST,
  },
  {
    id: "exercises-id-get",
    method: "GET",
    path: `${BASE_URL}/api/exercises/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/exercises/[id]")).GET,
  },
  {
    id: "exercises-id-patch",
    method: "PATCH",
    path: `${BASE_URL}/api/exercises/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/exercises/[id]")).PATCH,
  },
  {
    id: "session-templates-index-get",
    method: "GET",
    path: `${BASE_URL}/api/session-templates`,
    role: "trainer",
    pattern: "A",
    loadHandler: async () => (await import("@/pages/api/session-templates/index")).GET,
  },
  {
    id: "session-templates-index-post",
    method: "POST",
    path: `${BASE_URL}/api/session-templates`,
    role: "trainer",
    pattern: "A",
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/session-templates/index")).POST,
  },
  {
    id: "session-templates-id-get",
    method: "GET",
    path: `${BASE_URL}/api/session-templates/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/session-templates/[id]")).GET,
  },
  {
    id: "session-templates-id-patch",
    method: "PATCH",
    path: `${BASE_URL}/api/session-templates/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/session-templates/[id]")).PATCH,
  },
  {
    id: "session-templates-id-delete",
    method: "DELETE",
    path: `${BASE_URL}/api/session-templates/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/session-templates/[id]")).DELETE,
  },
  {
    id: "workout-sessions-index-get",
    method: "GET",
    path: `${BASE_URL}/api/workout-sessions`,
    role: "trainer",
    pattern: "A",
    loadHandler: async () => (await import("@/pages/api/workout-sessions/index")).GET,
  },
  {
    id: "workout-sessions-index-post",
    method: "POST",
    path: `${BASE_URL}/api/workout-sessions`,
    role: "trainer",
    pattern: "A",
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/workout-sessions/index")).POST,
  },
  {
    id: "workout-sessions-id-get",
    method: "GET",
    path: `${BASE_URL}/api/workout-sessions/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/workout-sessions/[id]")).GET,
  },
  {
    id: "workout-sessions-id-patch",
    method: "PATCH",
    path: `${BASE_URL}/api/workout-sessions/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/workout-sessions/[id]")).PATCH,
  },
  {
    id: "workout-sessions-id-delete",
    method: "DELETE",
    path: `${BASE_URL}/api/workout-sessions/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/workout-sessions/[id]")).DELETE,
  },
  {
    id: "client-sessions-get",
    method: "GET",
    path: `${BASE_URL}/api/client/sessions`,
    role: "client",
    pattern: "A",
    loadHandler: async () => (await import("@/pages/api/client/sessions")).GET,
  },
  {
    id: "client-sessions-id-get",
    method: "GET",
    path: `${BASE_URL}/api/client/sessions/${DUMMY_UUID}`,
    role: "client",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/client/sessions/[id]")).GET,
  },
  {
    id: "client-sessions-id-start-post",
    method: "POST",
    path: `${BASE_URL}/api/client/sessions/${DUMMY_UUID}/start`,
    role: "client",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/client/sessions/[id]/start")).POST,
  },
  {
    id: "client-sessions-id-restart-post",
    method: "POST",
    path: `${BASE_URL}/api/client/sessions/${DUMMY_UUID}/restart`,
    role: "client",
    pattern: "A",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/client/sessions/[id]/restart")).POST,
  },
  {
    id: "client-set-logs-put",
    method: "PUT",
    path: `${BASE_URL}/api/client/set-logs`,
    role: "client",
    pattern: "A",
    invalidBody: "{not-json",
    loadHandler: async () => (await import("@/pages/api/client/set-logs")).PUT,
  },
  {
    id: "client-set-logs-delete",
    method: "DELETE",
    path: `${BASE_URL}/api/client/set-logs`,
    role: "client",
    pattern: "A",
    loadHandler: async () => (await import("@/pages/api/client/set-logs")).DELETE,
  },
  {
    id: "invites-post",
    method: "POST",
    path: `${BASE_URL}/api/invites`,
    role: "trainer",
    pattern: "B",
    loadHandler: async () => (await import("@/pages/api/invites/index")).POST,
  },
  {
    id: "trainer-clients-id-delete",
    method: "DELETE",
    path: `${BASE_URL}/api/trainer-clients/${DUMMY_UUID}`,
    role: "trainer",
    pattern: "B",
    params: { id: DUMMY_UUID },
    loadHandler: async () => (await import("@/pages/api/trainer-clients/[id]")).DELETE,
  },
];

export const PATTERN_A_HANDLERS = PROTECTED_ROUTE_HANDLERS.filter((entry) => entry.pattern === "A");
export const PATTERN_B_HANDLERS = PROTECTED_ROUTE_HANDLERS.filter((entry) => entry.pattern === "B");
