export function mapWorkoutSessionRpcError(message: string): { status: number; code: string } {
  const normalized = message.toLowerCase();

  if (normalized.includes("not authenticated")) {
    return { status: 401, code: "unauthorized" };
  }

  if (
    normalized.includes("not assigned") ||
    normalized.includes("access denied") ||
    normalized.includes("not owned by trainer") ||
    normalized.includes("another trainer")
  ) {
    return { status: 403, code: "forbidden" };
  }

  if (normalized.includes("not found")) {
    return { status: 404, code: "not_found" };
  }

  if (
    normalized.includes("required") ||
    normalized.includes("cannot be empty") ||
    normalized.includes("cannot be edited") ||
    normalized.includes("cannot be deleted") ||
    normalized.includes("must be") ||
    normalized.includes("needs") ||
    normalized.includes("too many")
  ) {
    return { status: 400, code: "validation_error" };
  }

  return { status: 500, code: "rpc_failed" };
}
