// The allowed email providers live in two places: lib/emailDomains.ts (checked in the browser) and the
// "Before User Created" hook in the database (checked by Supabase Auth, so it can't be skipped).
// This test fails if the two lists ever drift apart, so a provider can't be allowed in one but not the other.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ALLOWED_EMAIL_DOMAINS } from "./emailDomains";

describe("the server-side email rule", () => {
  it("allows exactly the same providers as the sign-up form", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20261006000100_signup_email_rule.sql", import.meta.url), "utf8");
    const list = sql.slice(sql.indexOf("array["), sql.indexOf("];"));
    const inDatabase = new Set([...list.matchAll(/'([^']+)'/g)].map((m) => m[1]));
    expect([...inDatabase].sort()).toEqual([...ALLOWED_EMAIL_DOMAINS].sort());
  });
});
