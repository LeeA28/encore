"use client";
import { useState } from "react";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearched(query.trim());
  }

  return (
    <div>    
      <h1>encore</h1>
      <p>see all the songs you've heard live</p>
      <form onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}

          placeholder="search for a song"
        />
        <button type="submit">search</button>
      </form>
      {searched && <p>You searched for: {searched}</p>}
    </div>
  );
}