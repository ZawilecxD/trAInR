import { describe, expect, it } from "vitest";
import { roleHomePath, signedInPathRedirect } from "@/lib/auth/role-home";

describe("roleHomePath", () => {
  it("sends trainers to their dashboard", () => {
    expect(roleHomePath("trainer")).toBe("/trainer/dashboard");
  });

  it("sends clients to their dashboard", () => {
    expect(roleHomePath("client")).toBe("/client/dashboard");
  });

  it("returns null when the role is unknown", () => {
    expect(roleHomePath(null)).toBeNull();
  });
});

describe("signedInPathRedirect", () => {
  it("leaves the marketing home alone for guests", () => {
    expect(signedInPathRedirect("/", { isSignedIn: false, role: null })).toBeNull();
  });

  it("sends a signed-in trainer away from /", () => {
    expect(signedInPathRedirect("/", { isSignedIn: true, role: "trainer" })).toBe("/trainer/dashboard");
  });

  it("sends a signed-in client away from /", () => {
    expect(signedInPathRedirect("/", { isSignedIn: true, role: "client" })).toBe("/client/dashboard");
  });

  it("sends a signed-in user with no role to /dashboard", () => {
    expect(signedInPathRedirect("/", { isSignedIn: true, role: null })).toBe("/dashboard");
  });

  it("sends a trainer from /trainer to their dashboard", () => {
    expect(signedInPathRedirect("/trainer", { isSignedIn: true, role: "trainer" })).toBe("/trainer/dashboard");
    expect(signedInPathRedirect("/trainer/", { isSignedIn: true, role: "trainer" })).toBe("/trainer/dashboard");
  });

  it("sends a client from /client to their dashboard", () => {
    expect(signedInPathRedirect("/client", { isSignedIn: true, role: "client" })).toBe("/client/dashboard");
    expect(signedInPathRedirect("/client/", { isSignedIn: true, role: "client" })).toBe("/client/dashboard");
  });

  it("does not rewrite nested role routes", () => {
    expect(signedInPathRedirect("/trainer/dashboard", { isSignedIn: true, role: "trainer" })).toBeNull();
    expect(signedInPathRedirect("/trainer/clients", { isSignedIn: true, role: "trainer" })).toBeNull();
    expect(signedInPathRedirect("/client/plan", { isSignedIn: true, role: "client" })).toBeNull();
  });

  it("leaves the other role's area root to the role guard", () => {
    expect(signedInPathRedirect("/client", { isSignedIn: true, role: "trainer" })).toBeNull();
    expect(signedInPathRedirect("/trainer", { isSignedIn: true, role: "client" })).toBeNull();
  });

  it("does not rewrite role area roots for guests", () => {
    expect(signedInPathRedirect("/trainer", { isSignedIn: false, role: null })).toBeNull();
    expect(signedInPathRedirect("/client", { isSignedIn: false, role: null })).toBeNull();
  });
});
