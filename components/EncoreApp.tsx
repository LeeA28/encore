"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import Workspace, { type Tab } from "./Workspace";
import AuthModal from "./AuthModal";
import ThemeToggle from "./ThemeToggle";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";
import { LogoIcon } from "./Icons";

const TABS: Tab[] = ["concerts", "songs", "rank"];

// The top-level component. ConfirmProvider wraps everything, so any component can open
// Encore's confirmation pop-up with useConfirm().
export default function EncoreApp() {
  return (
    <ConfirmProvider>
      <EncoreAppContent />
    </ConfirmProvider>
  );
}

// The header (tabs, Spotify, log in) and who is logged in.
// The data itself lives in Workspace, which is re-created whenever the logged-in user changes.
function EncoreAppContent() {
  const confirm = useConfirm();

  // Start on the tab named in the URL (e.g. "/?tab=rank" after returning from Spotify login)
  const [tab, setTab] = useState<Tab>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    return TABS.includes(fromUrl as Tab) ? (fromUrl as Tab) : "concerts";
  });

  // ---- Encore account (Supabase) ----
  // undefined = still checking, null = logged out (guest), User = logged in
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [showAuth, setShowAuth] = useState(false);
  const flushRef = useRef<(() => void) | null>(null); // Workspace's "save now" function

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      // Supabase isn't set up yet (no keys in .env.local): run as a guest
      Promise.resolve().then(() => setUser(null));
      return;
    }

    // Who's logged in right now? (getUser double-checks the session with Supabase's servers)
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));

    // Then listen for changes: logging in, logging out, or a session expiring
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      // Only update if it's actually a different user, so token refreshes don't reload everything
      setUser((prev) => (prev?.id === next?.id && prev !== undefined ? prev : next));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function logOut() {
    flushRef.current?.(); // save any changes still waiting (like a tier drag from a moment ago)
    await createClient().auth.signOut();
  }

  // ---- Spotify connection ----
  // Lives here (not in CustomLists) because both the header and custom lists need it: "lifting state up".
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);

  // Messages sent back in the URL after a redirect:
  //  ?spotifyError=...  Spotify login failed
  //  ?authError=...     an email confirmation link didn't work
  //  ?authNotice=...    information after confirming (e.g. "log in to continue")
  //  ?confirmed=1       email confirmed (and now logged in)
  const [banner, setBanner] = useState<{ type: "error" | "notice"; text: string } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("spotifyError") ?? params.get("authError");
    if (error) return { type: "error", text: error };
    if (params.get("confirmed")) return { type: "notice", text: "Your email is confirmed, and you're logged in." };
    const notice = params.get("authNotice");
    if (notice) return { type: "notice", text: notice };
    return null;
  });

  useEffect(() => {
    // Remove "?tab=...&spotifyError=..." from the address bar, so a refresh doesn't show the message again
    window.history.replaceState(null, "", window.location.pathname);

    // The Spotify token is in an httpOnly cookie that browser code can't read, so ask the server
    fetch("/api/spotify/status")
      .then((res) => res.json())
      .then((data) => setSpotifyConnected(data.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  async function disconnectSpotify() {
    const ok = await confirm({
      title: "Disconnect Spotify?",
      message: "You'll need to connect again to add songs from Spotify or make playlists.",
      confirmLabel: "Disconnect",
    });
    if (!ok) return;
    await fetch("/api/spotify/logout", { method: "POST" });
    setSpotifyConnected(false);
  }

  return (
    <div className="container">
      <header className="site-header">
        {/* A plain <a> (not Next.js's <Link>) on purpose: clicking the logo should fully reload the page.
            <Link> would switch pages without reloading, which does nothing here since there's only one page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">
          <LogoIcon />
          Encore
        </a>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t} className={`nav-link ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <ThemeToggle />
          {spotifyConnected === true && (
            <button className="btn btn-spotify" onClick={disconnectSpotify} title="Click to disconnect">
              Spotify connected
            </button>
          )}
          {spotifyConnected === false && (
            // A normal link (not fetch), because Spotify login needs a full page visit to Spotify's site
            <a className="btn btn-outline" href={`/api/spotify/login?returnTo=${tab}`}>
              Connect Spotify
            </a>
          )}

          {user && (
            <>
              <span className="user-email" title={user.email}>
                {user.email}
              </span>
              <button className="btn btn-dark" onClick={logOut}>
                Log out
              </button>
            </>
          )}
          {user === null && (
            <button className="btn btn-dark" onClick={() => setShowAuth(true)}>
              Log in
            </button>
          )}
        </div>
      </header>

      {banner && (
        <p className={banner.type === "error" ? "top-error" : "top-notice"}>
          {banner.text}{" "}
          <button className="btn btn-small btn-ghost" style={{ color: "inherit" }} onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </p>
      )}

      <p className="tagline">Every song you&apos;ve heard live, counted and ranked</p>

      {/* key: a new user (or logging out) means a brand new Workspace, with that person's data */}
      {user !== undefined && (
        <Workspace
          key={user?.id ?? "guest"}
          user={user}
          tab={tab}
          spotifyConnected={spotifyConnected}
          flushRef={flushRef}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <footer className="footer">
        Setlist data from{" "}
        <a href="https://www.setlist.fm" target="_blank" rel="noreferrer">
          setlist.fm
        </a>
      </footer>
    </div>
  );
}
