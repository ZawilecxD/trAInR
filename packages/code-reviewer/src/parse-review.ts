import { reviewSchema, type Review } from "./schema.ts";

export class ReviewParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ReviewParseError";
  }
}

function stripOptionalFence(text: string): string {
  const trimmed = text.trim();
  const wrapped = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (wrapped?.[1] !== undefined) {
    return wrapped[1].trim();
  }

  const embedded = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (embedded?.[1] !== undefined) {
    return embedded[1].trim();
  }

  return trimmed;
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) {
    throw new ReviewParseError("No JSON object found in assistant output");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === undefined) {
      break;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new ReviewParseError("Truncated JSON object in assistant output");
}

export function parseReview(text: string): Review {
  const candidate = extractFirstJsonObject(stripOptionalFence(text));

  let value: unknown;
  try {
    value = JSON.parse(candidate) as unknown;
  } catch (cause) {
    throw new ReviewParseError("Assistant output is not valid JSON", { cause });
  }

  const parsed = reviewSchema.safeParse(value);
  if (!parsed.success) {
    throw new ReviewParseError(`Review JSON failed schema validation: ${parsed.error.message}`, {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
