"use client";

// The log in / sign up pop-up (email and password, handled by Supabase Auth)

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose(); // logged in: EncoreApp hears about it through onAuthStateChange
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          onClose(); // email confirmation is off, so the new account is logged in right away
        } else {
          // Once email confirmation is turned on, Supabase emails a link first
          setMessage("Check your email for a link to confirm your account, then log in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
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
        {message && <p className="notice">{message}</p>}
      </div>
    </div>
  );
}
