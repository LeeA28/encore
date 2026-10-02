"use client";

// "Set a new password": type it twice, then save. Used in two places:
//  - the Account tab ("Change password"), which also asks for your current password
//  - the pop-up that opens after clicking a "reset your password" email link (no current password:
//    clicking the emailed link already proves it's you, and you may not remember the old one)

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/authErrors";
import { MIN_PASSWORD_LENGTH, checkNewPassword } from "@/lib/passwordRules";

type Props = {
  submitLabel?: string;
  requireCurrent?: boolean; // ask for the current password too (Account tab)
  onDone: () => void; // called once the password is saved
};

// Supabase's answer when the current password is wrong
function isWrongCurrentPassword(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  const message = (err as { message?: string })?.message ?? "";
  return code === "invalid_credentials" || /current password/i.test(message);
}

export default function PasswordForm({ submitLabel = "Save new password", requireCurrent = false, onDone }: Props) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Check in the browser first, for instant feedback (Supabase checks again on its side)
    const problem =
      requireCurrent && !current
        ? "Enter your current password."
        : requireCurrent && current === password
          ? "Your new password needs to be different from your current one."
          : checkNewPassword(password, repeat);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError("");
    try {
      // Changes the password of whoever is logged in (including the temporary login from a reset link).
      // With "Require current password when updating" turned on in Supabase, Supabase's server checks
      // current_password itself, so this can't be skipped by sending requests to Supabase directly.
      const { error } = await createClient().auth.updateUser(
        requireCurrent ? { password, current_password: current } : { password }
      );
      if (error) throw error;
      setCurrent("");
      setPassword("");
      setRepeat("");
      onDone();
    } catch (err) {
      setError(
        requireCurrent && isWrongCurrentPassword(err) ? "Your current password is incorrect." : friendlyAuthError(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
      {requireCurrent && (
        <input
          className="input"
          type="password"
          autoComplete="current-password" // lets password managers fill in the saved password
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          required
        />
      )}
      <input
        className="input"
        type="password"
        autoComplete="new-password" // tells password managers this is a new password, so they can offer to save it
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
        required
      />
      <input
        className="input"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        placeholder="Type it again"
        required
      />
      <button className="btn btn-light" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
        {busy ? "Saving..." : submitLabel}
      </button>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </form>
  );
}
