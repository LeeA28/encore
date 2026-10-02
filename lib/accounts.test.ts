// Tests for sign-up rules: allowed email providers and passwords (lib/emailDomains.ts, lib/passwordRules.ts)

import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./emailDomains";
import { MIN_PASSWORD_LENGTH, checkNewPassword } from "./passwordRules";

describe("isAllowedEmail", () => {
  it("allows common email providers, ignoring capitals and spaces", () => {
    expect(isAllowedEmail("andy@gmail.com")).toBe(true);
    expect(isAllowedEmail("  Andy@GMAIL.com ")).toBe(true);
    expect(isAllowedEmail("someone@yahoo.co.uk")).toBe(true);
  });

  // Regression test: these typos were accepted during testing
  it("rejects typos of common providers", () => {
    expect(isAllowedEmail("lordsentinal02@mgail.com")).toBe(false);
    expect(isAllowedEmail("someone@ggail.com")).toBe(false);
  });

  it("rejects things that aren't email addresses", () => {
    expect(isAllowedEmail("no-at-sign")).toBe(false);
  });
});

describe("checkNewPassword", () => {
  it("accepts a long enough password typed the same twice", () => {
    expect(checkNewPassword("secret123", "secret123")).toBeNull();
  });

  it("rejects passwords that are too short", () => {
    const short = "x".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(checkNewPassword(short, short)).toMatch(/at least/);
  });

  it("rejects passwords that don't match", () => {
    expect(checkNewPassword("secret123", "secret124")).toMatch(/don't match/);
  });
});
