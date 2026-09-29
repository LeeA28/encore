"use client";

import { useEffect, useState } from "react";

// A custom hook: works like useState, but the value is also saved in the browser's localStorage,
// so it survives page refreshes. Custom hooks are just functions whose names start with "use".
// <T> is a "generic": a placeholder type, so this hook works for any kind of data (a list, a number...).
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Passing a function to useState means it only runs once, on the first render.
  // Here it loads the saved value, if there is one.
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key); // localStorage only stores text...
      return saved ? (JSON.parse(saved) as T) : initialValue; // ...so we convert it back from JSON
    } catch {
      return initialValue; // if the saved text is broken or storage is blocked, start fresh
    }
  });

  // useEffect runs after React updates the page. The list at the end says when:
  // here, whenever `value` changes, save the new value.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value)); // convert to JSON text to store it
    } catch {
      // storage can be full or blocked (e.g. some private browsing modes), so fail quietly
    }
  }, [key, value]);

  return [value, setValue] as const;
}
