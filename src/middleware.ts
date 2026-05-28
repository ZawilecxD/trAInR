import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import type { UserRole } from "@/types";

const PROTECTED_ROUTES = ["/dashboard"];
const ROLE_PROTECTED_PREFIXES: { prefix: string; role: UserRole }[] = [
  { prefix: "/trainer", role: "trainer" },
  { prefix: "/client", role: "client" },
];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
    context.locals.role = null;

    if (user) {
      const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

      if (!error) {
        context.locals.role = (data?.role as UserRole | null) ?? null;
      }
    }
  } else {
    context.locals.user = null;
    context.locals.role = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  const matchedRoleRoute = ROLE_PROTECTED_PREFIXES.find(({ prefix }) => context.url.pathname.startsWith(prefix));

  if (matchedRoleRoute) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }

    if (context.locals.role !== matchedRoleRoute.role) {
      return context.redirect("/dashboard");
    }
  }

  return next();
});
