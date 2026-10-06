"use client";

// One place that owns all of a user's data (concerts, live tiers, custom lists) and knows where to save it:
//  - guest (logged out): this browser's localStorage
//  - logged in: Supabase
// Components just call addConcert, setLiveTiers, updateList, etc. and don't need to know which.
//
// When the user logs in or out, the component using this hook is re-created with a new `key`
// (see EncoreApp), so all of this state starts fresh for the new mode.

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Concert, CustomList, SavedList, SavedPlaylist } from "./types";
import { emptyTiers, type Tiers } from "./tiers";
import { createClient } from "./supabase/client";
import {
  GUEST_KEYS,
  clearGuestData,
  hasGuestData,
  readGuestData,
  readLocal,
  writeLocal,
} from "./guestData";
import {
  deleteConcert,
  updateConcertSongs,
  deleteCustomList,
  loadAccountData,
  mergeGuestData,
  saveConcerts,
  saveCustomList,
  saveLiveTiers,
  savePlaylists,
  deletePlaylist,
  saveSavedList,
  deleteSavedList,
  updatePlaylistRecord,
} from "./accountData";
import { deleteAdditions, diffAddedSongs, saveAdditions, syncAllAdditions } from "./concertAdditions";
import { removeConcertFromLists } from "./savedLists";

export type DataStatus = "loading" | "ready" | "error";

export function useEncoreData(user: User | null) {
  const isGuest = user === null;

  // Guests load instantly from localStorage; logged-in users start empty and load from Supabase below
  const [status, setStatus] = useState<DataStatus>(isGuest ? "ready" : "loading");
  const [concerts, setConcerts] = useState<Concert[]>(() => (isGuest ? readLocal(GUEST_KEYS.concerts, []) : []));
  const [liveTiers, setLiveTiersState] = useState<Tiers>(() =>
    isGuest ? readLocal(GUEST_KEYS.liveTiers, emptyTiers()) : emptyTiers()
  );
  const [customLists, setCustomLists] = useState<CustomList[]>(() =>
    isGuest ? readLocal(GUEST_KEYS.customLists, []) : []
  );
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(() => (isGuest ? readLocal(GUEST_KEYS.playlists, []) : []));
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => (isGuest ? readLocal(GUEST_KEYS.savedLists, []) : []));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(""); // e.g. "Moved your guest data into your account"

  // ---- Guest mode: save every change to localStorage ----
  useEffect(() => {
    if (isGuest) writeLocal(GUEST_KEYS.concerts, concerts);
  }, [isGuest, concerts]);
  useEffect(() => {
    if (isGuest) writeLocal(GUEST_KEYS.liveTiers, liveTiers);
  }, [isGuest, liveTiers]);
  useEffect(() => {
    if (isGuest) writeLocal(GUEST_KEYS.customLists, customLists);
  }, [isGuest, customLists]);
  useEffect(() => {
    if (isGuest) writeLocal(GUEST_KEYS.playlists, playlists);
  }, [isGuest, playlists]);
  useEffect(() => {
    if (isGuest) writeLocal(GUEST_KEYS.savedLists, savedLists);
  }, [isGuest, savedLists]);

  // ---- Logged in: move any guest data into the account, then load everything ----
  useEffect(() => {
    if (!user) return;
    let cancelled = false; // if the user logs out mid-load, ignore the late results

    async function load() {
      try {
        const supabase = createClient();
        let account = await loadAccountData(supabase);

        const guest = readGuestData();
        if (hasGuestData(guest)) {
          await mergeGuestData(supabase, user!.id, guest, account);
          clearGuestData();
          account = await loadAccountData(supabase); // reload, now including the merged data
          if (!cancelled) setNotice("Moved the data saved in this browser into your account.");
        }

        if (cancelled) return;
        setConcerts(account.concerts);
        setLiveTiersState(account.liveTiers);
        setCustomLists(account.customLists);
        setPlaylists(account.playlists);
        setSavedLists(account.savedLists);
        setStatus("ready");

        // In the background: make sure songs you added are shared with others at the same shows
        // (including ones added before sharing existed). Failing here doesn't affect anything else.
        syncAllAdditions(supabase, user!.id, account.concerts).catch((err) =>
          console.warn("Couldn't sync added songs.", err)
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load your data.");
        setStatus("error");
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---- Saving to Supabase ----

  // Runs a save in the background, and shows an error if it fails
  const save = useCallback((action: () => Promise<void>) => {
    action().catch((err) => setError(err instanceof Error ? err.message : "Couldn't save your changes."));
  }, []);

  // Debouncing: dragging songs can change tiers many times in a few seconds. Instead of saving
  // every change, wait until changes stop for 800ms, then save once. Each key (like "live" or
  // "list:<id>") has its own timer, and a new change restarts that key's timer.
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());

  const saveSoon = useCallback(
    (key: string, action: () => Promise<void>) => {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing.timer);
      const run = () => {
        timers.current.delete(key);
        save(action);
      };
      timers.current.set(key, { timer: setTimeout(run, 800), run });
    },
    [save]
  );

  // Save anything still waiting right now (called before logging out, so nothing is lost)
  const flush = useCallback(() => {
    const pending = [...timers.current.values()];
    pending.forEach(({ timer, run }) => {
      clearTimeout(timer);
      run();
    });
  }, []);

  // ---- Actions the components call ----

  function addConcert(concert: Concert) {
    setConcerts((prev) => [...prev, concert]);
    if (user) save(() => saveConcerts(createClient(), user.id, [concert]));
  }

  // Saves a changed concert (like after adding a song setlist.fm was missing)
  function updateConcert(concert: Concert) {
    const before = concerts.find((c) => c.id === concert.id);
    setConcerts((prev) => prev.map((c) => (c.id === concert.id ? concert : c)));
    if (user) {
      save(() => updateConcertSongs(createClient(), user.id, concert));
      // Keep the shared additions in step: share songs you added, unshare ones you removed
      const { added, removed } = diffAddedSongs(before, concert);
      save(async () => {
        await saveAdditions(createClient(), user.id, concert.id, added);
        if (removed.length > 0) await deleteAdditions(createClient(), user.id, concert.id, removed);
      });
    }
  }

  function removeConcert(id: string) {
    setConcerts((prev) => prev.filter((c) => c.id !== id));
    // The concert also leaves every saved list it was in
    const changedLists = removeConcertFromLists(savedLists, id);
    if (changedLists.length > 0) {
      const byId = new Map(changedLists.map((l) => [l.id, l]));
      setSavedLists((prev) => prev.map((l) => byId.get(l.id) ?? l));
      if (user) changedLists.forEach((l) => save(() => saveSavedList(createClient(), user.id, l)));
    }
    if (user) {
      save(() => deleteConcert(createClient(), user.id, id));
      save(() => deleteAdditions(createClient(), user.id, id)); // you weren't at this show after all
    }
  }

  function setLiveTiers(tiers: Tiers) {
    setLiveTiersState(tiers);
    if (user) saveSoon("live", () => saveLiveTiers(createClient(), user.id, tiers));
  }

  function createList(name: string): string {
    const list: CustomList = { id: crypto.randomUUID(), name, items: [], tiers: emptyTiers() };
    setCustomLists((prev) => [...prev, list]);
    if (user) save(() => saveCustomList(createClient(), user.id, list));
    return list.id;
  }

  function deleteList(id: string) {
    setCustomLists((prev) => prev.filter((l) => l.id !== id));
    if (user) save(() => deleteCustomList(createClient(), id));
  }

  function updateList(id: string, change: (list: CustomList) => CustomList) {
    const current = customLists.find((l) => l.id === id);
    if (!current) return;
    const updated = change(current);
    setCustomLists((prev) => prev.map((l) => (l.id === id ? updated : l)));
    if (user) saveSoon(`list:${id}`, () => saveCustomList(createClient(), user.id, updated));
  }

  function addPlaylist(playlist: SavedPlaylist) {
    setPlaylists((prev) => [playlist, ...prev]); // newest first
    if (user) save(() => savePlaylists(createClient(), user.id, [playlist]));
  }

  // After "Update" replaced a playlist's songs: refresh its record (song count, date)
  function updatePlaylist(playlist: SavedPlaylist) {
    setPlaylists((prev) => prev.map((p) => (p.spotifyId === playlist.spotifyId ? playlist : p)));
    if (user) save(() => updatePlaylistRecord(createClient(), user.id, playlist));
  }

  // ---- Saved lists ----

  function createSavedList(name: string, concertIds: string[]): string {
    const list: SavedList = { id: crypto.randomUUID(), name, concertIds, tiers: emptyTiers() };
    setSavedLists((prev) => [...prev, list]);
    if (user) save(() => saveSavedList(createClient(), user.id, list));
    return list.id;
  }

  // Tier drags can come quickly, so saves wait until changes stop (like custom lists)
  function updateSavedList(id: string, change: (list: SavedList) => SavedList) {
    const current = savedLists.find((l) => l.id === id);
    if (!current) return;
    const updated = change(current);
    setSavedLists((prev) => prev.map((l) => (l.id === id ? updated : l)));
    if (user) saveSoon(`saved:${id}`, () => saveSavedList(createClient(), user.id, updated));
  }

  function deleteSavedListAction(id: string) {
    setSavedLists((prev) => prev.filter((l) => l.id !== id));
    if (user) save(() => deleteSavedList(createClient(), id));
  }

  // Takes a playlist off Encore's list (it stays in Spotify, if it's there)
  function removePlaylist(spotifyId: string) {
    setPlaylists((prev) => prev.filter((p) => p.spotifyId !== spotifyId));
    if (user) save(() => deletePlaylist(createClient(), user.id, spotifyId));
  }

  return {
    status,
    error,
    clearError: () => setError(""),
    notice,
    clearNotice: () => setNotice(""),
    flush,
    concerts,
    addConcert,
    updateConcert,
    removeConcert,
    liveTiers,
    setLiveTiers,
    customLists,
    createList,
    deleteList,
    updateList,
    playlists,
    addPlaylist,
    removePlaylist,
    updatePlaylist,
    savedLists,
    createSavedList,
    updateSavedList,
    deleteSavedList: deleteSavedListAction,
  };
}

export type EncoreDataApi = ReturnType<typeof useEncoreData>;
