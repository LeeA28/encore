"use client";

// Creating or editing a saved list: a name, plus the concerts in it (picked from Your concerts)

import { useState } from "react";
import type { Concert, SavedList } from "@/lib/types";
import { formatCity, formatDate } from "@/lib/concerts";

type Props = {
  concerts: Concert[]; // all of Your concerts
  list?: SavedList; // given when editing an existing list
  onSave: (name: string, concertIds: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export default function SavedListEditor({ concerts, list, onSave, onCancel, onDelete }: Props) {
  const [name, setName] = useState(list?.name ?? "");
  // A Set of picked concert ids: quick to check, and easy to add to or remove from
  const [picked, setPicked] = useState<Set<string>>(() => new Set(list?.concertIds ?? []));
  const [error, setError] = useState("");

  const newestFirst = [...concerts].sort((a, b) => b.date.localeCompare(a.date));

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev); // a new Set, never changing the old one (React needs a new value)
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (!name.trim()) return setError("Give your list a name.");
    if (picked.size === 0) return setError("Pick at least one concert.");
    onSave(name.trim(), [...picked]);
  }

  return (
    <div className="panel">
      <strong>{list ? "Edit list" : "New saved list"}</strong>
      <div className="form-row" style={{ margin: "10px 0" }}>
        <input
          className="input grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='List name (like "2026")'
          autoFocus
        />
      </div>

      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        Concerts in this list ({picked.size} picked)
      </div>
      <ul className="result-list" style={{ marginTop: 0, maxHeight: 320, overflowY: "auto" }}>
        {newestFirst.map((c) => (
          <li key={c.id} className="result-row">
            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", flex: 1 }}>
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="song-info">
                <span className="song-name">
                  {c.artist} · {formatDate(c.date)}
                </span>
                <br />
                <span className="song-artist">{formatCity(c)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}
      <div className="form-row" style={{ marginTop: 12 }}>
        <button className="btn btn-light btn-small" onClick={save}>
          {list ? "Save changes" : "Create list"}
        </button>
        <button className="btn btn-ghost btn-small" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button className="btn btn-danger btn-small" style={{ marginLeft: "auto" }} onClick={onDelete}>
            Delete list
          </button>
        )}
      </div>
    </div>
  );
}
