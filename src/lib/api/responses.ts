export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(error: string, status: number, details?: unknown): Response {
  return jsonResponse(details === undefined ? { error } : { error, details }, status);
}
