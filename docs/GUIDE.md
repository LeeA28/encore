# Encore: Build Guide (Phase 1)

A complete walkthrough of how Encore works, step by step, so you can read through it at your own pace and explain any part of it later.

---

## Installing these files

- Copy these into your `encore` project, keeping the same folder structure:
  - `app/page.tsx`, `app/layout.tsx`, `app/api/search/route.ts`
  - Everything in `components/` and `lib/`
  - `docs/GUIDE.md` (this file)
  - `.env.local.example` (a template showing what goes in `.env.local`)
- Replace any files that already exist
- Your `.env.local` stays as it is, with your real key
- Restart the dev server (`Ctrl+C`, then `npm run dev`), then open `http://localhost:3000`
- Commit when it works:
  - `git add .`
  - `git commit -m "Complete Phase 1: search, saving, song counts, ranking"`
  - `git push`

---

## The big picture

### What the user does

- **Concerts tab**: search for an artist (optionally with a year and city), click "I was there" on the shows they attended
- **Songs tab**: see every song they've heard live, from most heard to least, with counts
- **Rank tab**: rank all those songs, Beli-style, by answering "which do you like more?"
- Everything is saved in the browser, so it survives refreshes

### How data flows through the app

- The browser never talks to setlist.fm directly. It goes through your own server:
  - `ConcertSearch` (browser) → `/api/search` (your server) → setlist.fm → back the same way
  - Why: the API key has to stay secret, and only server code is private
- Raw setlist.fm data is converted into Encore's simpler `Concert` shape on the server, by `toConcert`
- Selected concerts are saved in `localStorage`
- Song counts are never saved. They're recalculated from the saved concerts whenever needed
  - Why: if you stored both the concerts and the counts, they could get out of sync (for example, removing a concert but forgetting to update the counts). Calculating from one source of truth avoids that entirely
- Rankings are saved separately in `localStorage`, as ordered lists of song keys

### File map

```
app/
  layout.tsx            Wraps every page (html, body, fonts, tab title)
  page.tsx              The homepage: loads EncoreApp in the browser only
  api/search/route.ts   Server: GET /api/search → calls setlist.fm → returns Concerts
components/
  EncoreApp.tsx         Top-level: owns saved data, switches between tabs
  ConcertSearch.tsx     Concerts tab: search, results, your concert list
  SongList.tsx          Songs tab: most-heard list with counts
  RankSongs.tsx         Rank tab: tiers + "which do you like more?"
lib/
  types.ts              Shared types: Song, Concert, SongCount
  setlistfm.ts          Server-only: talks to setlist.fm
  concerts.ts           Pure functions: raw setlist.fm data → Concert, date formatting
  songs.ts              Pure functions: counting songs across concerts
  ranking.ts            Pure functions: the binary insertion ranking logic
  useLocalStorage.ts    Custom hook: useState that also saves to localStorage
```

- A pattern to notice: `lib/` holds logic (no UI), `components/` holds UI (little logic), `app/` holds pages and routes
  - Why: logic without UI is easy to test and reuse. UI without heavy logic is easy to read and restyle later

---

## Step 0: Project setup

### What you built

- A Next.js project with TypeScript, connected to Git and GitHub

### Concepts

- **File-based routing**: folders inside `app/` become URLs
  - `app/page.tsx` → `/`
  - `app/songs/page.tsx` → `/songs`
  - `app/api/search/route.ts` → `/api/search`
  - `page.tsx` files return a web page; `route.ts` files return data (like JSON)
- **`layout.tsx`** wraps every page
  - `{children}` inside it is whichever page is currently showing
  - So anything outside `{children}` (a nav bar, a footer) appears on every page
- **Components** are functions that return JSX (HTML-like syntax)
  - A page must be the file's `export default`, which is how Next.js finds it
  - A component can only return one element, so wrap siblings in a `<div>` or a fragment `<>...</>`
- **The dev server** (`npm run dev`) rebuilds and reloads the page every time you save (hot reload)
- **Git basics**:
  - Working folder → `git add` (staging area) → `git commit` (permanent snapshot) → `git push` (upload to GitHub)
  - `.gitignore` keeps `node_modules` and `.env.local` out of Git, so your secrets never reach GitHub

### Errors you hit (and what they taught you)

- **"running scripts is disabled on this system"**: PowerShell blocks script files by default. Fixed with `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **"Blocked cross-origin request ... /_next/hmr"**: you opened the Network address instead of `localhost`. Hot reload only works from `localhost` by default
- **"The default export is not a React Component"**: JSX has to be returned from an exported function
- **"not a git repository"**: the terminal was in `Projects` instead of `encore`. Git commands only work inside a project folder
- **"Password authentication is not supported"**: GitHub needs a browser sign-in or a personal access token, not your account password

---

## Step 1: Search box with state

### What you built

- A text box and a button that remembers what you typed

### Concepts

- **Server vs. client components**
  - By default, components run once on the server and send finished HTML. No interactivity
  - `"use client"` at the top of a file makes it interactive: its JavaScript runs in the browser
- **State (`useState`)**: data that can change while the page is open, where the page updates automatically when it does
  - `const [value, setValue] = useState(initial)`
  - Calling `setValue(...)` stores the new value and re-renders (re-runs your component function)
  - Why not a normal `let` variable: changing it doesn't tell React to re-render, and every re-render would reset it anyway
- **Controlled inputs**: the text box's value lives in state
  - `value={query}` shows the state; `onChange={(e) => setQuery(e.target.value)}` updates it on every keystroke
- **Event handlers**: pass the function, don't call it
  - `onClick={handleSearch}` → runs when clicked
  - `onClick={handleSearch()}` → runs immediately during render. If it sets state, that causes an infinite loop ("Too many re-renders")
- **Forms**: wrapping inputs in a `<form>` makes both the button and Enter key trigger `onSubmit`
  - `e.preventDefault()` stops the browser's default behavior of reloading the page
- **Imports**: `import { useState } from "react"` needs braces because `useState` is a *named* export. Without braces you get the file's *default* export instead (in React's case, the whole library), which caused the "default is not a function" error

---

## Step 2: Your first API route

### What you built

- `/api/search`, a server route, first returning fake data

### Concepts

- **Why a middleman route exists**: anything running in the browser can be inspected with DevTools, including API keys. The route runs on the server, where users can't see the code or the key
- **Query parameters**: the `?artist=Radiohead` part of a URL, read with `request.nextUrl.searchParams.get("artist")`
- **HTTP status codes**: `200` OK, `400` bad request (you sent something wrong), `404` not found, `429` too many requests, `500` server error
- **`fetch` and `async`/`await`**
  - `fetch(url)` sends a request and returns a *promise* (a value that arrives later)
  - `await` pauses the function until it arrives. Only allowed inside `async` functions
  - `res.json()` turns the JSON text response into a JavaScript object
- **`try` / `catch` / `finally`**: try the risky code; if anything fails, jump to `catch`; `finally` runs either way (used to turn off loading)
- **Shared types** (`lib/types.ts`): the route and the page import the same `Concert` type, so if the data's shape changes, TypeScript flags every place on both sides that needs updating
- **Why `useState<Concert[]>([])` needs a type**: TypeScript infers types from the starting value. `""` is clearly a string, but `[]` could be a list of anything, so you say what goes in it

---

## Step 3: Real setlist.fm data

### What you built

- `lib/setlistfm.ts`, which calls the real setlist.fm API with your key

### Concepts

- **Environment variables**: secrets live in `.env.local` and are read with `process.env.SETLISTFM_API_KEY`
  - Only available on the server (for route code, not browser code)
  - Only read when the dev server starts, so restart after changing them
- **Request headers**: extra information sent with a request
  - `x-api-key` proves who's asking
  - `Accept: application/json` asks for JSON (setlist.fm sends XML by default)
- **Handling API quirks**: setlist.fm returns `404` for "no results," so the code turns that into an empty list rather than an error
- **Rate limits**: max 2 requests/second and 1,440/day (24 × 60 = 1,440, so one per minute on average)
  - Why it matters: Encore saves each concert's songs when you add it, instead of re-fetching them later
- **Custom error classes**: `SetlistFmError` carries a status code, so the route can pass the right status to the browser
- **`??` (nullish coalescing)**: `a ?? b` means "use `a`, but if it's missing (`undefined` or `null`), use `b`"
  - `set.song ?? []` treats a set with no songs listed as an empty list, instead of crashing
- **Why the page didn't change when the data source did**: the page only depends on the route's output shape, not where the data comes from

---

## Step 4: Cleaning up the data

### What you built

- `lib/concerts.ts`: turns raw setlist.fm data into clean `Concert` objects

### Concepts

- **Pure functions**: data in, data out, no side effects (no API calls, no state changes)
  - Same input always gives the same output, so they're predictable and easy to test with made-up data
  - Keeping fetching (`setlistfm.ts`) separate from transforming (`concerts.ts`) keeps each file focused
- **`toIsoDate`**: `14-03-2025` → `2025-03-14`
  - Text sorts character by character. With the year first, newer dates always sort after older ones
- **`formatDate`**: `2025-03-14` → `Mar 14, 2025`
  - `new Date("2025-03-14")` means midnight UTC, which in Toronto is still March 13, so it would show the wrong day. Building the date from its parts uses local time
  - JavaScript months start at 0 (January = 0), hence `month - 1`
- **`toConcert`**:
  - `flatMap` joins the main set and encores into one song list
  - `filter` removes tape songs (intros played over speakers) and blank entries, keeping only songs performed live
  - `?.` (optional chaining): `s.venue.city?.name` stops safely if `city` is missing instead of crashing
- **Attribution**: setlist.fm requires a link back to them wherever their data appears. Every concert links to its setlist.fm page
  - When styling, this can become subtler (a small icon, a footer credit, or making the date itself the link), but some link has to stay

---

## Step 5: Selecting and saving concerts

### What you built

- "I was there" / "Remove" buttons, and a "Your concerts" list saved in the browser

### Concepts

- **Never mutate state**: always create a new array or object
  - React only re-renders if the state is a *new* value. `myConcerts.push(c)` changes the existing array, so React thinks nothing changed
  - Add: `[...myConcerts, c]` (spread copies the old items into a new array)
  - Remove: `myConcerts.filter((c) => c.id !== id)`
  - Sort: `[...myConcerts].sort(...)` (copy first, since `.sort()` changes the original)
- **`localStorage`**: a small per-website storage space in the browser that survives refreshes
  - Only stores text, so data is converted with `JSON.stringify` (save) and `JSON.parse` (load)
  - You can see it in DevTools → Application → Local Storage
- **Custom hooks** (`useLocalStorage`): your own reusable function built from React hooks, named starting with `use`
  - `useState(() => ...)`: a function inside `useState` only runs on the first render (used to load saved data)
  - `useEffect(() => ..., [value])`: runs after the page updates, whenever `value` changes (used to save)
  - `<T>` is a *generic*: a placeholder type, so the hook works for concerts, rankings, or anything else
- **`ssr: false`** in `app/page.tsx`: Next.js renders pages on the server first, but the server has no `localStorage`. Rendering `EncoreApp` only in the browser means saved data loads immediately, with no mismatch errors
- **`Set`**: a collection of unique values with fast lookups. `myIds.has(c.id)` checks whether a concert is already added

---

## Step 6: Counting songs

### What you built

- `lib/songs.ts` and the Songs tab: every song you've heard live, most heard first

### Concepts

- **`Map` for counting**: a key → value lookup table
  - For each song at each concert: look up its entry, create one if it's new, increase its count
  - `counts.get(key) ?? { ...new entry }` means "get the existing entry, or start a fresh one"
- **Normalizing text**: `normalize` lowercases, removes apostrophes, and collapses spaces
  - So "Don't Stop" and "dont  stop" merge into one song
  - This uses *regular expressions* (`/[’']/g`, `/\s+/g`): patterns for matching text. `\s+` means "one or more whitespace characters," and `g` means "everywhere, not just the first match"
- **Song keys include the artist**: `"band a|home"` and `"band b|home"` stay separate songs
- **Counting concerts, not performances**: a song played twice in one show (a reprise) counts once, using `concertIds` to avoid double-counting
  - To count every performance instead, remove the `includes` check and always increment
- **Sorting with a tiebreaker**: `b.timesHeard - a.timesHeard || a.name.localeCompare(b.name)`
  - A sort function returns negative (a first), positive (b first), or 0 (tie)
  - If the counts are equal, the first part is 0, which counts as false, so `||` moves on to comparing names alphabetically
- **`reduce`**: combines a list into one value. `songs.reduce((sum, s) => sum + s.timesHeard, 0)` adds up every count, starting from 0
- **`useMemo`** (in `EncoreApp`): remembers a calculated value and only recalculates when its inputs change
  - Switching tabs re-renders the app, but song counts only get recalculated when your concerts change

---

## Step 7: Tabs and ranking

### What you built

- Split the app into components with tabs, and built the Beli-style ranking

### Concepts: components and props

- **Splitting into components**: each tab is its own file, and `EncoreApp` decides which one to show
- **Props**: data and functions passed from a parent to a child, like function arguments
  - `EncoreApp` *owns* the saved data (concerts and rankings) and passes it down
  - Children ask the parent to make changes through functions like `onAdd` and `onRemove`
  - Why the parent owns the data: multiple tabs need the same concerts. Keeping one copy at the top means every tab always sees the same thing ("lifting state up")
- **Function types**: `onAdd: (concert: Concert) => void` means "a function that takes a Concert and returns nothing"
- **Conditional rendering for tabs**: `{tab === "songs" && <SongList ... />}` only shows the Songs tab when it's selected
- **Union types**: `type Tab = "concerts" | "songs" | "rank"` means only those three exact strings are allowed. A typo like `"song"` becomes a TypeScript error

### Concepts: the ranking algorithm (binary insertion)

- **How it feels to use**
  - Pick a tier for the song: loved it, it was fine, or didn't like it
  - Then answer "which do you like more?" until its exact position is found
- **How it works**
  - Each tier is a list of song keys, best first
  - `lo` and `hi` mark the range of positions where the new song could still go. At the start: `lo = 0`, `hi = length of the tier`
  - Compare the new song to the one in the middle of the range:
    - Like the new one more → it goes above the middle, so set `hi = mid` (bottom half ruled out)
    - Like it less → it goes below the middle, so set `lo = mid + 1` (top half ruled out)
  - When `lo == hi`, only one position is left, and the song is inserted there
- **Why it takes so few questions**
  - Each answer halves the remaining range, so placing a song in a tier of *k* songs takes at most ⌈log₂(*k* + 1)⌉ questions
  - Example: 100 songs in one tier. Adding each song one by one, where *m* is the tier size after adding it:
    - *m* = 1: 0 questions × 1 song = 0
    - *m* = 2: 1 × 1 = 1
    - *m* = 3–4: 2 × 2 = 4
    - *m* = 5–8: 3 × 4 = 12
    - *m* = 9–16: 4 × 8 = 32
    - *m* = 17–32: 5 × 16 = 80
    - *m* = 33–64: 6 × 32 = 192
    - *m* = 65–100: 7 × 36 = 252
    - Total: 0 + 1 + 4 + 12 + 32 + 80 + 192 + 252 = **573 questions at most**
  - Comparing every pair instead: 100 × 99 ÷ 2 = **4,950 questions**
  - Tiers cut this down further, since songs are only compared within their own tier
- **Why an empty tier needs no questions**: `lo = 0` and `hi = 0` from the start, so `isDone` is immediately true
- **Why the in-progress comparison isn't saved**: it's temporary. Only finished rankings are saved, so a half-finished comparison can't leave broken data behind
- **Re-rank**: removes the song from its tier, so it becomes unranked and comes back up for ranking
- **`Record<Tier, string[]>`**: an object type with exactly the keys `loved`, `fine`, and `disliked`, each holding a list of strings

---

## Things to test and play with

- **Search**
  - A band you've seen, then the same band with a year, then with a city
  - An artist with many shows, then click "Load more"
  - A made-up name like `asdfqwer` (should say no concerts found, not error)
  - Searching quickly many times in a row (you might hit the rate limit and see the 429 message)
- **Saving**
  - Add concerts, refresh the page, and check they're still there
  - Check DevTools → Application → Local Storage → `encore:concerts`
- **Songs tab**
  - Add two shows from the same tour and check that shared songs show 2x
  - Look for songs that should have merged but didn't (spelling differences setlist.fm users typed differently). Note them for feedback
- **Rank tab**
  - Rank 5–10 songs and check the order matches your real preferences
  - Remove a concert and check that its songs disappear from the ranking
  - Use Re-rank on a song

---

## Known limitations (on purpose, for now)

- Data lives in one browser only. Clearing browser data or switching devices loses it (Phase 2 fixes this with accounts)
- Search needs an artist name. You can't search by venue or date alone
- "Make a playlist" is a placeholder (Phase 3)
- Search results are 20 per page, newest first, so older shows may need "Load more" or a year filter
- Normalizing catches small differences (capitalization, apostrophes, spaces) but not bigger ones like "Pt. 2" vs "Part 2"
- No styling yet

---

## What comes next

- **Phase 2: Supabase accounts**
  - Sign up and log in, save concerts and rankings to a Postgres database, and copy guest data into a new account
- **Phase 3: Spotify**
  - Connect Spotify, match songs to tracks (handling covers, missing songs, and versions), create playlists, and a shared table of confirmed matches
  - Remember Spotify's current limits: the app owner needs Premium, and dev mode allows 5 users
- **Phase 4: the AI agent**
  - Finds songs that normal matching missed, with the user confirming every suggestion
  - Python/Strands vs. TypeScript decision still to be made

---

## Interview talking points

- **The client/server split**: why the setlist.fm key lives only in an API route
- **Deriving vs. storing data**: song counts are calculated from concerts rather than saved, so they can never go out of sync
- **Binary insertion ranking**: each song placed in O(log n) comparisons instead of comparing every pair (573 vs. 4,950 for 100 songs)
- **Working within API limits**: 1,440 requests/day shaped the decision to store setlist snapshots
- **Text normalization for matching**: merging near-duplicate song names, and its limitations
