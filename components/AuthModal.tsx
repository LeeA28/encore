"use client";

// The log in / sign up pop-up (email and password, handled by Supabase Auth)

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailDomain, isAllowedEmail } from "@/lib/emailDomains";

// Supabase's error messages are written for developers; these are the ones users are likely to see
function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : "";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(message)) {
    return "Too many sign-up emails have been sent recently. Please try again in a little while.";
  }
  if (code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return "Too many attempts in a short time. Please wait a minute and try again.";
  }
  if (code === "invalid_credentials") return "That email and password don't match. Check them and try again.";
  if (code === "user_already_exists") return "There's already an account with this email. Try logging in instead.";
  if (code === "weak_password") return "Please choose a stronger password (at least 6 characters).";
  return message || "Something went wrong. Please try again.";
}

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
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
      if (mode === "login") {
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
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Log in
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Sign up
          </button>
        </div>

        <h2 className="card-title" style={{ fontSize: 26, marginBottom: 8 }}>
          {mode === "login" ? "welcome back" : "create an account"}
        </h2>
        <p className="card-desc">
          {mode === "login"
            ? "Log in to see your concerts, tiers, and lists on any device."
            : "Anything saved in this browser will be moved into your new account."}
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
          <input
            className="input"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Password (at least 6 characters)" : "Password"}
            minLength={6}
            required
          />
          <button className="btn btn-light" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
            {busy ? "One moment..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

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
