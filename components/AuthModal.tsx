"use client";

// The log in / sign up / forgot password pop-up (email and password, handled by Supabase Auth)

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailDomain, isAllowedEmail } from "@/lib/emailDomains";
import { friendlyAuthError as friendlyError } from "@/lib/authErrors";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordRules";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false); // tried to log in before confirming their email

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setNeedsConfirm(false);

    // New accounts must use a well-known email provider, which catches typos like "mgail.com"
    if (mode === "signup" && !isAllowedEmail(email)) {
      setError(
        `"${emailDomain(email) || "(no domain)"}" isn't a supported email provider. Check for typos, or use an address from a common provider like Gmail, Outlook, Hotmail, Yahoo, iCloud, or Proton.`
      );
      setBusy(false);
      return;
    }

    try {
      const supabase = createClient();
      if (mode === "forgot") {
        // Emails a one-time link. It goes through Supabase, then back to /auth/callback,
        // which logs you in temporarily and opens the "set a new password" pop-up.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=reset`,
        });
        if (error) throw error;
        // Same message whether or not the account exists, so this can't be used to find out
        // which emails have Encore accounts (called "account enumeration")
        setMessage(`If an account exists for ${email}, we've sent a link to reset your password. Check your inbox (and spam).`);
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error?.code === "email_not_confirmed") {
          setNeedsConfirm(true);
          throw new Error("Please confirm your email first. Check your inbox (and spam folder) for the link.");
        }
        if (error) throw error;
        onClose(); // logged in: EncoreApp hears about it through onAuthStateChange
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Where the "confirm your email" link sends people afterward (logs them in automatically)
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          onClose(); // email confirmation is off, so the new account is logged in right away
        } else {
          // Email confirmation is on: Supabase emails a link, and the account works once it's clicked.
          // This is how we know the email is real: only its owner can click the link.
          setMessage(`We sent a confirmation link to ${email}. Click it to finish creating your account.`);
        }
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  // Switching between log in, sign up, and forgot password clears old messages
  function switchMode(next: "login" | "signup" | "forgot") {
    setMode(next);
    setError("");
    setMessage("");
    setNeedsConfirm(false);
  }

  async function resendConfirmation() {
    setError("");
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(friendlyError(error));
    else setMessage(`Sent a new confirmation link to ${email}.`);
  }

  return (
    // Clicking the dimmed background closes the pop-up...
    <div className="modal-backdrop" onClick={onClose}>
      {/* ...but clicks inside the pop-up are stopped here, so they don't reach the background */}
      <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {mode === "forgot" ? (
          <button className="btn btn-ghost btn-small" style={{ marginBottom: 16 }} onClick={() => switchMode("login")}>
            ← Back to log in
          </button>
        ) : (
          <div className="segmented">
            <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
              Log in
            </button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>
              Sign up
            </button>
          </div>
        )}

        <h2 className="card-title" style={{ fontSize: 26, marginBottom: 8 }}>
          {mode === "login" ? "welcome back" : mode === "signup" ? "create an account" : "reset your password"}
        </h2>
        <p className="card-desc">
          {mode === "login"
            ? "Log in to see your concerts, tiers, and lists on any device."
            : mode === "signup"
              ? "Anything saved in this browser will be moved into your new account."
              : "Enter your account's email, and we'll send you a link to set a new password."}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          {mode !== "forgot" && (
            <input
              className="input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? `Password (at least ${MIN_PASSWORD_LENGTH} characters)` : "Password"}
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
              required
            />
          )}
          <button className="btn btn-light" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
            {busy
              ? "One moment..."
              : mode === "login"
                ? "Log in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>

        {mode === "login" && (
          <button className="link-button" onClick={() => switchMode("forgot")}>
            Forgot password?
          </button>
        )}

        {error && <p className="error">{error}</p>}
        {needsConfirm && (
          <button className="btn btn-ghost btn-small" onClick={resendConfirmation}>
            Resend confirmation email
          </button>
        )}
        {message && <p className="notice">{message}</p>}
      </div>
    </div>
  );
}
