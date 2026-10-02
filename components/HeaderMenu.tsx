"use client";

// The ☰ menu used on narrower screens (phones and upright tablets), holding the Spotify,
// Account, and log in/out buttons that sit in the header on wider screens.
// Closes when you pick something, click or tap outside it, or press Escape.

import { useEffect, useRef, useState } from "react";
import { MenuIcon } from "./Icons";

type Props = {
  spotifyConnected: boolean | null;
  spotifyLoginHref: string;
  onDisconnectSpotify: () => void;
  loggedIn: boolean | null; // null = still checking
  email?: string;
  onAccount: () => void;
  onLogIn: () => void;
  onLogOut: () => void;
};

export default function HeaderMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // While open: close on Escape, or on a click/tap anywhere outside the menu
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      // .contains() checks whether the click landed inside the menu (or its button)
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Runs a menu action, then closes the menu
  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="menu-wrap" ref={wrapper}>
      <button
        className="icon-btn"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
        aria-expanded={open} // tells screen readers whether the menu is open
        aria-haspopup="menu"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="menu-panel" role="menu">
          {props.email && <div className="menu-label">{props.email}</div>}

          {props.spotifyConnected === true && (
            <button className="menu-item" role="menuitem" onClick={pick(props.onDisconnectSpotify)}>
              <span className="dot-green" aria-hidden="true" /> Spotify connected
              <span className="menu-hint">Disconnect</span>
            </button>
          )}
          {props.spotifyConnected === false && (
            <a className="menu-item" role="menuitem" href={props.spotifyLoginHref}>
              Connect Spotify
            </a>
          )}

          {props.loggedIn === true && (
            <>
              <button className="menu-item" role="menuitem" onClick={pick(props.onAccount)}>
                Account
              </button>
              <button className="menu-item" role="menuitem" onClick={pick(props.onLogOut)}>
                Log out
              </button>
            </>
          )}
          {props.loggedIn === false && (
            <button className="menu-item" role="menuitem" onClick={pick(props.onLogIn)}>
              Log in
            </button>
          )}
        </div>
      )}
    </div>
  );
}
