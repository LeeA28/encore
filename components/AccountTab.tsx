"use client";

// The Account tab: details about your Encore account, and changing your password.
// (More account info can be added here later.)

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import PasswordForm from "./PasswordForm";
import { PersonIcon } from "./Icons";

export default function AccountTab({ user }: { user: User }) {
  const [saved, setSaved] = useState(false);

  const memberSince = new Date(user.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="card">
      <div className="card-header">
        <div className="icon-badge" style={{ background: "var(--indigo)" }}>
          <PersonIcon />
        </div>
        <h1 className="card-title">account</h1>
      </div>

      <div className="stats" style={{ marginTop: 12 }}>
        <span className="pill">{user.email}</span>
        <span className="pill">Member since {memberSince}</span>
      </div>

      <h2 className="card-subtitle">change password</h2>
      {saved ? (
        <div className="form-row">
          <p className="notice" style={{ color: "var(--green)", margin: 0 }}>
            Your password has been updated.
          </p>
          <button className="btn btn-ghost btn-small" onClick={() => setSaved(false)}>
            Change it again
          </button>
        </div>
      ) : (
        <PasswordForm requireCurrent onDone={() => setSaved(true)} />
      )}
    </section>
  );
}
