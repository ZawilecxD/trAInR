import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function signupRedirectUrl(params: Record<string, string>) {
  return `/auth/signup?${new URLSearchParams(params).toString()}`;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;
  const tokenRaw = form.get("token");
  const token = typeof tokenRaw === "string" && tokenRaw.length > 0 ? tokenRaw : null;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    const params: Record<string, string> = {
      error: "Supabase is not configured",
    };
    if (token) {
      params.token = token;
    }
    return context.redirect(signupRedirectUrl(params));
  }

  if (token) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "client" },
      },
    });

    if (error) {
      return context.redirect(
        signupRedirectUrl({
          token,
          error: error.message,
        }),
      );
    }

    const userId = data.user?.id;
    if (!userId) {
      return context.redirect(
        signupRedirectUrl({
          token,
          error: "Account could not be created. Please try again.",
        }),
      );
    }

    const { error: inviteError } = await supabase.rpc("complete_client_invite", {
      p_token: token,
      p_client_id: userId,
    });

    if (inviteError) {
      return context.redirect(
        signupRedirectUrl({
          token,
          error: inviteError.message,
        }),
      );
    }

    return context.redirect("/auth/confirm-email");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: "trainer" },
    },
  });

  if (error) {
    return context.redirect(signupRedirectUrl({ error: error.message }));
  }

  return context.redirect("/auth/confirm-email");
};
