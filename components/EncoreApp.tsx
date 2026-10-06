"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import Workspace, { type Tab } from "./Workspace";
import AuthModal from "./AuthModal";
import ThemeToggle from "./ThemeToggle";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";
import PasswordForm from "./PasswordForm";
import HeaderMenu from "./HeaderMenu";
import { LogoIcon } from "./Icons";

// The tabs in the nav bar. "account" is opened from the Account button on the right instead.
const TABS: Tab[] = ["concerts", "songs", "rank", "discover"];

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
    return TABS.includes(fromUrl as Tab) || fromUrl === "account" ? (fromUrl as Tab) : "concerts";
  });

  // Opened by a "reset your password" email link (?reset=1): asks for the new password
  const [showReset, setShowReset] = useState(() => new URLSearchParams(window.location.search).get("reset") === "1");

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

  const spotifyLoginHref = `/api/spotify/login?returnTo=${tab === "account" ? "concerts" : tab}`;

  // The same tab buttons are used in both header layouts (only one is visible at a time)
  const tabButtons = TABS.map((t) => (
    <button key={t} className={`nav-link ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
      {t}
    </button>
  ));

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
        {/* Wide screens: tabs and buttons all in one row */}
        <nav className="nav nav-wide">{tabButtons}</nav>
        <div className="header-right header-wide">
          <ThemeToggle />
          {spotifyConnected === true && (
            <button className="btn btn-spotify" onClick={disconnectSpotify} title="Click to disconnect">
              Spotify connected
            </button>
          )}
          {spotifyConnected === false && (
            // A normal link (not fetch), because Spotify login needs a full page visit to Spotify's site
            <a className="btn btn-outline" href={spotifyLoginHref}>
              Connect Spotify
            </a>
          )}
          {user && (
            <>
              {/* Opens the Account tab (your details and changing your password) */}
              <button
                className={`btn btn-outline ${tab === "account" ? "active-pill" : ""}`}
                onClick={() => setTab("account")}
                title={user.email}
              >
                Account
              </button>
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

        {/* Narrow screens (below 900px): dark mode and a ☰ menu in the top right */}
        <div className="header-right header-compact">
          <ThemeToggle />
          <HeaderMenu
            spotifyConnected={spotifyConnected}
            spotifyLoginHref={spotifyLoginHref}
            onDisconnectSpotify={disconnectSpotify}
            loggedIn={user === undefined ? null : user !== null}
            email={user?.email}
            onAccount={() => setTab("account")}
            onLogIn={() => setShowAuth(true)}
            onLogOut={logOut}
          />
        </div>
      </header>

      {/* Narrow screens: the tabs get their own full-width row under the logo */}
      <nav className="nav-compact">{tabButtons}</nav>

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
          // The Account tab only exists when logged in (after logging out, show concerts instead)
          tab={tab === "account" && !user ? "concerts" : tab}
          spotifyConnected={spotifyConnected}
          flushRef={flushRef}
          onChangeTab={setTab}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* After clicking a "reset your password" email link, you're logged in temporarily: set the new password */}
      {showReset && user && (
        <div className="modal-backdrop">
          <div className="card modal" role="dialog" aria-modal="true">
            <h2 className="card-title" style={{ fontSize: 26, marginBottom: 8 }}>
              set a new password
            </h2>
            <p className="card-desc">Choose a new password for {user.email}.</p>
            <PasswordForm
              onDone={() => {
                setShowReset(false);
                setBanner({ type: "notice", text: "Your password has been updated." });
              }}
            />
            <button className="link-button" onClick={() => setShowReset(false)}>
              Not now
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        Setlist data from{" "}
        <a href="https://www.setlist.fm" target="_blank" rel="noreferrer">
          setlist.fm
        </a>
      </footer>
    </div>
  );
}
