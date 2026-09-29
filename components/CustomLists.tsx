"use client";

// Custom ranking lists: make a named list, fill it with songs from Spotify, rank it in tiers.

import { useEffect, useState } from "react";
import type { CustomList, RankItem } from "@/lib/types";
import { emptyTiers, removeFromTiers, type Tiers } from "@/lib/tiers";
import { useLocalStorage } from "@/lib/useLocalStorage";
import TierBoard from "./TierBoard";
import SpotifyAdder from "./SpotifyAdder";

export default function CustomLists() {
  const [lists, setLists] = useLocalStorage<CustomList[]>("encore:customLists", []);
  const [selectedId, setSelectedId] = useState<string>(lists[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null); // null = still checking

  // If Spotify sent back an error after login, it arrives in the URL (?spotifyError=...)
  const [spotifyError] = useState(() => new URLSearchParams(window.location.search).get("spotifyError") ?? "");

  // Ask the server whether this browser is connected to Spotify (the token is in an httpOnly cookie,
  // which browser code can't read directly, so we have to ask)
  useEffect(() => {
    fetch("/api/spotify/status")
      .then((res) => res.json())
      .then((data) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  const selected = lists.find((l) => l.id === selectedId);

  // Replace one list with an updated copy (never mutate the old one)
  function updateList(id: string, change: (list: CustomList) => CustomList) {
    setLists(lists.map((l) => (l.id === id ? change(l) : l)));
  }

  function createList(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const list: CustomList = { id: crypto.randomUUID(), name, items: [], tiers: emptyTiers() };
    setLists([...lists, list]);
    setSelectedId(list.id);
    setNewName("");
  }

  function deleteList(id: string) {
    if (!confirm("Delete this list and its rankings?")) return;
    const remaining = lists.filter((l) => l.id !== id);
    setLists(remaining);
    setSelectedId(remaining[0]?.id ?? "");
  }

  function addItems(items: RankItem[]) {
    if (!selected) return;
    updateList(selected.id, (list) => {
      const existing = new Set(list.items.map((i) => i.key));
      const fresh = items.filter((i) => !existing.has(i.key)); // skip songs already in the list
      return { ...list, items: [...list.items, ...fresh] };
    });
  }

  function removeItem(key: string) {
    if (!selected) return;
    updateList(selected.id, (list) => ({
      ...list,
      items: list.items.filter((i) => i.key !== key),
      tiers: removeFromTiers(list.tiers, key),
    }));
  }

  async function disconnect() {
    await fetch("/api/spotify/logout", { method: "POST" });
    setConnected(false);
  }

  return (
    <div>
      {spotifyError && <p className="error">{spotifyError}</p>}

      <div className="form-row">
        {lists.length > 0 && (
          <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.items.length} songs)
              </option>
            ))}
          </select>
        )}
        <form className="form-row" onSubmit={createList}>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list name" />
          <button className="btn btn-light" type="submit">
            Create list
          </button>
        </form>
      </div>

      {!selected && <p className="notice">Create a list to start ranking any songs you like.</p>}

      {selected && (
        <>
          <div className="card-header" style={{ marginTop: 28 }}>
            <h2 className="card-subtitle" style={{ margin: 0 }}>
              {selected.name}
            </h2>
            <span className="pill">{selected.items.length} songs</span>
            <button className="btn btn-ghost btn-small" style={{ marginLeft: "auto" }} onClick={() => deleteList(selected.id)}>
              Delete list
            </button>
          </div>

          {connected === null && <p className="notice">Checking Spotify connection...</p>}
          {connected === false && (
            <div className="panel">
              <p style={{ marginBottom: 12 }}>Connect Spotify to add songs from any artist or album.</p>
              <a className="btn btn-light" href="/api/spotify/login">
                Connect Spotify
              </a>
            </div>
          )}
          {connected && (
            <SpotifyAdder
              onAdd={addItems}
              existingKeys={new Set(selected.items.map((i) => i.key))}
              onDisconnect={disconnect}
            />
          )}

          {selected.items.length > 0 ? (
            <TierBoard
              items={selected.items}
              tiers={selected.tiers}
              onChange={(tiers: Tiers) => updateList(selected.id, (list) => ({ ...list, tiers }))}
              onRemoveItem={removeItem}
            />
          ) : (
            <p className="notice">This list is empty. Add songs from Spotify above.</p>
          )}
        </>
      )}
    </div>
  );
}
