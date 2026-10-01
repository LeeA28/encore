"use client";

// The sun/moon button that switches between light and dark mode.
// The current theme lives on <html data-theme="...">, which the CSS variables in globals.css react to.

import { useState } from "react";
import { MoonIcon, SunIcon } from "./Icons";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  // The script in layout.tsx already set the theme before the page appeared, so just read it
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );

  function applyTheme(next: Theme) {
    document.documentElement.dataset.theme = next; // every CSS variable switches to the other set
    try {
      localStorage.setItem("encore:theme", next); // remembered for next time
    } catch {}
    setTheme(next);
  }

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
