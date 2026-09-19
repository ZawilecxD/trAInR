import type { UserRole } from "@/types";

export function roleHomePath(role: UserRole | null | undefined): string | null {
  if (role === "trainer") {
    return "/trainer/dashboard";
  }

  if (role === "client") {
    return "/client/dashboard";
  }

  return null;
}

function withoutTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function signedInPathRedirect(
  pathname: string,
  options: { isSignedIn: boolean; role: UserRole | null },
): string | null {
  if (!options.isSignedIn) {
    return null;
  }

  const path = withoutTrailingSlash(pathname);

  if (path === "/") {
    return roleHomePath(options.role) ?? "/dashboard";
  }

  if (path === "/trainer" && options.role === "trainer") {
    return "/trainer/dashboard";
  }

  if (path === "/client" && options.role === "client") {
    return "/client/dashboard";
  }

  return null;
}
