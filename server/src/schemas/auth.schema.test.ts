import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "./auth.schema";

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    const r = registerSchema.safeParse({
      email: "andy@example.com",
      password: "Str0ngPass",
      fullName: "Andy",
    });
    expect(r.success).toBe(true);
  });

  it("rejects weak passwords (no uppercase / number / too short)", () => {
    for (const password of ["short1A", "alllowercase1", "ALLUPPER1", "NoNumbersHere"]) {
      const r = registerSchema.safeParse({ email: "a@b.com", password, fullName: "A" });
      expect(r.success).toBe(false);
    }
  });

  it("rejects an invalid email", () => {
    const r = registerSchema.safeParse({ email: "nope", password: "Str0ngPass", fullName: "A" });
    expect(r.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
