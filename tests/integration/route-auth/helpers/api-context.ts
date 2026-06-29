import type { APIContext, APIRoute } from "astro";

import { wireAppSupabaseEnv } from "./app-env.js";

wireAppSupabaseEnv();

const DEFAULT_LOCALS: APIContext["locals"] = {
  user: null,
  role: null,
};

function makeCookieStore(): APIContext["cookies"] {
  const jar = new Map<string, string>();

  return {
    get: (name) => jar.get(name),
    set: (name, value) => {
      jar.set(name, value);
    },
    delete: (name) => {
      jar.delete(name);
    },
    has: (name) => jar.has(name),
    headers: () => new Headers(),
    merge: () => undefined,
  } as APIContext["cookies"];
}

export interface MakeApiContextOptions {
  method: string;
  url: string;
  locals?: Partial<APIContext["locals"]>;
  params?: Record<string, string>;
  body?: string;
  request?: Request;
  cookies?: APIContext["cookies"];
}

export function makeApiContext(options: MakeApiContextOptions): APIContext {
  const url = new URL(options.url);
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const request =
    options.request ??
    new Request(url, {
      method: options.method,
      headers,
      body: options.body,
    });

  return {
    request,
    params: options.params ?? {},
    locals: {
      ...DEFAULT_LOCALS,
      ...options.locals,
    },
    cookies: options.cookies ?? makeCookieStore(),
    url,
    site: url,
    generator: "vitest",
    clientAddress: "127.0.0.1",
    redirect: (path: string) =>
      new Response(null, {
        status: 302,
        headers: { Location: path },
      }),
  } as APIContext;
}

export async function invokeHandler(handler: APIRoute, context: APIContext): Promise<Response> {
  return handler(context);
}
