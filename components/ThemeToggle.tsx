"use client";

// The sun/moon button that switches between light and dark mode.
// The current theme lives on <html data-theme="...">, which the CSS variables in globals.css react to.
//
// The header has two layouts (wide and narrow), each with its own copy of this button. So instead of
// each copy keeping its own state, both read the theme straight from <html> and watch it for changes
// (useSyncExternalStore + MutationObserver). Switching in one copy updates the other too.

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./Icons";

type Theme = "light" | "dark";

const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

// Calls `onChange` whenever <html>'s data-theme attribute changes; returns a function to stop watching
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next; // every CSS variable switches to the other set
  try {
    localStorage.setItem("encore:theme", next); // remembered for next time
  } catch {}
}

export default function ThemeToggle() {
  // The third argument is what the server would see; the app only renders in the browser, but React asks for it
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Best option: the View Transitions API. The browser takes a "screenshot" of the page,
    // applies the change, then cross-fades from the old picture to the new one.
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(() => applyTheme(next));
      return;
    }

    // Fallback for browsers without it: turn on color transitions (the "theme-fading" class
    // in globals.css) just long enough for the colors to fade, then turn them off again
    const root = document.documentElement;
    root.classList.add("theme-fading");
    applyTheme(next);
    window.setTimeout(() => root.classList.remove("theme-fading"), 400);
  }

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
