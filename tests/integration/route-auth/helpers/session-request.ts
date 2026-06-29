import { createServerClient } from "@supabase/ssr";
import type { AstroCookies } from "astro";

import { getSupabaseAnonKey, getSupabaseUrl } from "../../helpers/env.js";

function makeCookieJar(): { jar: Map<string, string>; cookies: AstroCookies } {
  const jar = new Map<string, string>();

  const cookies = {
    get: (name: string) => jar.get(name),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
    has: (name: string) => jar.has(name),
    headers: () => new Headers(),
    merge: () => undefined,
  } as AstroCookies;

  return { jar, cookies };
}

export async function buildAuthenticatedRequest(
  session: { access_token: string; refresh_token: string },
  options: { method: string; url: string },
): Promise<{ request: Request; cookies: AstroCookies }> {
  const { jar, cookies } = makeCookieJar();

  const client = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          jar.set(name, value);
        }
      },
    },
  });

  const { error } = await client.auth.setSession(session);
  if (error) {
    throw new Error(`Failed to set session: ${error.message}`);
  }

  const cookieHeader = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

  const request = new Request(options.url, {
    method: options.method,
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  return { request, cookies };
}
