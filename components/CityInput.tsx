"use client";

// The City box in the concert search, with a dropdown of matching cities as you type.
// setlist.fm only matches complete city names ("Toronto", not "tor"), so picking a suggestion
// fills in the full name. The search only uses a city once it's chosen (picked, Enter, or leaving the box).

import { useEffect, useRef, useState } from "react";
import type { CitySuggestion } from "@/lib/setlistfm";

type Props = {
  value: string; // the city the search is using
  country: string; // 2-letter code, or "" for any country
  onChoose: (city: string, countryCode?: string) => void;
};

export default function CityInput({ value, country, onChoose }: Props) {
  const [text, setText] = useState(value); // what's typed (may be unfinished, like "tor")
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1); // which suggestion the arrow keys are on
  const wrapper = useRef<HTMLDivElement>(null);

  // Look up suggestions after a short pause in typing, cancelling outdated lookups (like the artist search)
  useEffect(() => {
    const name = text.trim();
    if (name.length < 2 || name === value) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ name, country });
        const res = await fetch(`/api/cities?${params}`, { signal: controller.signal });
        const data = await res.json();
        setSuggestions(res.ok ? data.cities : []);
        setOpen(true);
        setHighlight(-1);
      } catch {
        // cancelled because you kept typing, or the lookup failed: no suggestions this time
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, country, value]);

  // Close when clicking anywhere outside
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function pick(city: CitySuggestion) {
    setText(city.name);
    setOpen(false);
    setSuggestions([]);
    onChoose(city.name, city.countryCode);
  }

  function commitTyped() {
    if (text.trim() !== value) onChoose(text.trim());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlight >= 0) pick(suggestions[highlight]);
      else {
        setOpen(false);
        commitTyped();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="city-input" ref={wrapper}>
      <input
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "") onChoose(""); // clearing the box clears the filter
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => !wrapper.current?.contains(document.activeElement) && commitTyped(), 150)}
        placeholder="City"
        // These tell screen readers this box has a list of suggestions
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        aria-controls="city-suggestions"
      />
      {open && suggestions.length > 0 && (
        <ul className="city-suggestions" id="city-suggestions" role="listbox">
          {suggestions.map((c, i) => (
            <li
              key={`${c.name}|${c.region}|${c.countryCode}`}
              role="option"
              aria-selected={i === highlight}
              className={i === highlight ? "highlighted" : ""}
              // onMouseDown (not onClick) runs before the box loses focus
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
            >
              <span className="city-name">{c.name}</span>
              <span className="city-place">{[c.region, c.countryName].filter(Boolean).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
