"use client";

// Custom ranking lists: make a named list, fill it with songs from Spotify, rank it in tiers.

import { useState } from "react";
import type { RankItem } from "@/lib/types";
import { removeFromTiers, type Tiers } from "@/lib/tiers";
import type { EncoreDataApi } from "@/lib/useEncoreData";
import TierBoard from "./TierBoard";
import SpotifyAdder from "./SpotifyAdder";
import TierPlaylistButton from "./TierPlaylistButton";
import { useConfirm } from "./ConfirmDialog";

type Props = {
  data: EncoreDataApi; // the lists and the functions to change them (saved to the browser or the account)
  spotifyConnected: boolean | null;
};

export default function CustomLists({ data, spotifyConnected }: Props) {
  const lists = data.customLists;
  const [selectedId, setSelectedId] = useState<string>(lists[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const confirm = useConfirm();
  // If the selected list was deleted (or none is picked yet), fall back to the first list
  const selected = lists.find((l) => l.id === selectedId) ?? lists[0];

  function createList(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSelectedId(data.createList(name));
    setNewName("");
  }

  async function deleteList(id: string) {
    const list = lists.find((l) => l.id === id);
    const ok = await confirm({
      title: `Delete "${list?.name ?? "this list"}"?`,
      message: "Its songs and tier rankings will be deleted. This can't be undone.",
      confirmLabel: "Delete list",
      danger: true,
    });
    if (!ok) return;
    data.deleteList(id);
    setSelectedId(lists.find((l) => l.id !== id)?.id ?? "");
  }

  function addItems(items: RankItem[]) {
    if (!selected) return;
    data.updateList(selected.id, (list) => {
      const existing = new Set(list.items.map((i) => i.key));
      const fresh = items.filter((i) => !existing.has(i.key)); // skip songs already in the list
      return { ...list, items: [...list.items, ...fresh] };
    });
  }

  function removeItem(key: string) {
    if (!selected) return;
    data.updateList(selected.id, (list) => ({
      ...list,
      items: list.items.filter((i) => i.key !== key),
      tiers: removeFromTiers(list.tiers, key),
    }));
  }

  return (
    <div>
      <div className="form-row">
        {lists.length > 0 && (
          <select className="select" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
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

          {spotifyConnected === null && <p className="notice">Checking Spotify connection...</p>}
          {spotifyConnected === false && (
            <p className="notice">Connect Spotify (top right) to add songs from any artist or album.</p>
          )}
          {spotifyConnected && (
            <SpotifyAdder onAdd={addItems} existingKeys={new Set(selected.items.map((i) => i.key))} />
          )}

          {selected.items.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <TierPlaylistButton
                items={selected.items}
                tiers={selected.tiers}
                listName={selected.name}
                spotifyConnected={spotifyConnected}
                onCreated={data.addPlaylist}
              />
            </div>
          )}

          {selected.items.length > 0 ? (
            <TierBoard
              items={selected.items}
              tiers={selected.tiers}
              onChange={(tiers: Tiers) => data.updateList(selected.id, (list) => ({ ...list, tiers }))}
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
