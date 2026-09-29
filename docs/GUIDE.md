# Encore: Build Guide

A complete walkthrough of how Encore works, step by step, so you can read through it at your own pace and explain any part of it later.

---

## Installing these files

- Copy everything from the zip into your `encore` project, keeping the same folder structure, and replace files when asked
- Delete these old files, which were replaced:
  - `components/RankSongs.tsx` (replaced by `RankTab.tsx`, `TierBoard.tsx`, and friends)
  - `lib/ranking.ts` (replaced by `lib/tiers.ts`)
- Install the drag-and-drop library: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- Add the Spotify settings to `.env.local` (see "Setting up Spotify" below). `.env.local.example` shows every line you need
- Restart the dev server (`Ctrl+C`, then `npm run dev`), then open **`http://127.0.0.1:3000`** (not `localhost`, see below)
- Commit when it works: `git add .`, `git commit -m "Add tier lists, custom lists, Spotify, and country filter"`, `git push`

## Setting up Spotify

- Requirements: your Spotify account needs Premium (Spotify requires it for all Web API apps now)
- Create the app:
  - Go to developer.spotify.com, log in, open the Dashboard, and click "Create app"
  - Name: Encore. Description: anything reasonable
  - Redirect URI: `http://127.0.0.1:3000/api/spotify/callback` (exactly this, then click Add)
  - Under "Which API/SDKs are you planning to use?", tick Web API
  - Accept the terms and save
- Copy the keys into `.env.local`:
  - In the app's settings, copy the Client ID, then click "View client secret" and copy that too
  - Add these lines to `.env.local`:
    - `SPOTIFY_CLIENT_ID=...`
    - `SPOTIFY_CLIENT_SECRET=...`
    - `SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback`
  - The client secret is like a password: never commit it, paste it in chat, or put it in browser code
- Allowlist users: in development mode, only accounts listed under the app's "User Management" can use it (up to 5). Add your own Spotify email there if it's not already allowed, plus any friends who test it
- Why `127.0.0.1` instead of `localhost`:
  - Spotify no longer accepts `localhost` redirect URIs, only the loopback IP `127.0.0.1`
  - Cookies belong to one exact address, so if you log in through `127.0.0.1`, you have to use the site at `127.0.0.1` too
  - `next.config.ts` now allows hot reload from `127.0.0.1` (that's the `allowedDevOrigins` setting)
  - Your saved concerts are stored per address too, so data saved at `localhost:3000` won't appear at `127.0.0.1:3000`. Re-add a few concerts after switching

---

## The big picture

### What the user does

- **Concerts tab**: search for an artist (optionally with a year and city), click "I was there" on the shows they attended
- **Songs tab**: see every song they've heard live, from most heard to least, with counts
- **Rank tab**, with two modes:
  - **Songs I've heard live**: an S/A/B/C/D tier list of every song from your concerts
  - **Custom lists**: named lists filled with any songs from Spotify (a full discography, chosen albums, or single songs), each with its own tier list
  - Songs can be dragged within and between tiers, and each tier has an optional "Sort this tier" mode that asks "which do you like more?"
- Concert search can be filtered by year, city, and country
- Everything is saved in the browser, so it survives refreshes (Spotify login is saved in secure cookies)

### How data flows through the app

- The browser never talks to setlist.fm directly. It goes through your own server:
  - `ConcertSearch` (browser) → `/api/search` (your server) → setlist.fm → back the same way
  - Why: the API key has to stay secret, and only server code is private
- Raw setlist.fm data is converted into Encore's simpler `Concert` shape on the server, by `toConcert`
- Selected concerts are saved in `localStorage`
- Song counts are never saved. They're recalculated from the saved concerts whenever needed
  - Why: if you stored both the concerts and the counts, they could get out of sync (for example, removing a concert but forgetting to update the counts). Calculating from one source of truth avoids that entirely
- Tier lists are saved separately in `localStorage`, as ordered lists of song keys per tier
  - Songs heard live: `encore:liveTiers`
  - Custom lists (their songs and tiers): `encore:customLists`
- Spotify requests follow the same middleman pattern as setlist.fm: browser → your `/api/spotify/...` routes → Spotify

### File map

```
app/
  layout.tsx                 Wraps every page (html, body, fonts, tab title)
  globals.css                All the styling: design tokens (colors, radii, shadows) and component classes
  page.tsx                   The homepage: loads EncoreApp in the browser only
  api/search/route.ts        Server: concert search → setlist.fm
  api/spotify/login          Server: sends the user to Spotify's login page
  api/spotify/callback       Server: Spotify sends the user back here; trades the code for tokens
  api/spotify/status         Server: "is this browser connected to Spotify?"
  api/spotify/logout         Server: forgets the Spotify tokens
  api/spotify/search         Server: search Spotify for artists, albums, or songs
  api/spotify/albums         Server: an artist's albums and singles
  api/spotify/tracks         Server: one album's songs
  api/spotify/discography    Server: every song an artist has released, duplicates removed
components/
  EncoreApp.tsx              Top-level: owns saved concerts, switches between tabs
  ConcertSearch.tsx          Concerts tab: search (with country dropdown), results, your concerts
  SongList.tsx               Songs tab: most-heard list with counts
  RankTab.tsx                Rank tab: switches between live songs and custom lists
  TierBoard.tsx              The drag-and-drop S/A/B/C/D tier list (used by both modes)
  CustomLists.tsx            Create, pick, and delete custom lists; connect Spotify
  SpotifyAdder.tsx           Search Spotify and add songs to a custom list
  Icons.tsx                  Small hand-drawn SVG icons (logo, ticket, note, tier stack)
lib/
  types.ts                   Shared types: Song, Concert, SongCount, RankItem, CustomList
  setlistfm.ts               Server-only: talks to setlist.fm
  concerts.ts                Pure: raw setlist.fm data → Concert, date and place formatting
  countries.ts               The country list for the dropdown
  songs.ts                   Pure: counting songs across concerts, normalizing names
  tiers.ts                   Pure: tier list logic and "Sort this tier" (binary insertion)
  music.ts                   Pure: Spotify tracks → rankable items, cleaning titles, removing duplicates
  spotifyAuth.ts             Server-only: Spotify login, token cookies, refreshing tokens
  spotify.ts                 Server-only: calls to Spotify's Web API
  spotifyRoute.ts            Server-only: shared error handling for the Spotify routes
  useLocalStorage.ts         Custom hook: useState that also saves to localStorage
next.config.ts               Allows hot reload from 127.0.0.1 (needed for Spotify login)
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

## Step 7: Tabs and components

### What you built

- Split the app into components, with tabs for Concerts, Songs, and Rank

### Concepts

- **Splitting into components**: each tab is its own file, and `EncoreApp` decides which one to show
- **Props**: data and functions passed from a parent to a child, like function arguments
  - `EncoreApp` *owns* the saved concerts and passes them down
  - Children ask the parent to make changes through functions like `onAdd` and `onRemove`
  - Why the parent owns the data: multiple tabs need the same concerts. Keeping one copy at the top means every tab always sees the same thing ("lifting state up")
- **Function types**: `onAdd: (concert: Concert) => void` means "a function that takes a Concert and returns nothing"
- **Conditional rendering for tabs**: `{tab === "songs" && <SongList ... />}` only shows the Songs tab when it's selected
- **Union types**: `type Tab = "concerts" | "songs" | "rank"` means only those three exact strings are allowed. A typo like `"song"` becomes a TypeScript error
- **Starting on a tab from the URL**: `/?tab=rank` opens the Rank tab. This is how you land back on the Rank tab after logging in to Spotify

---

## Step 8: The tier list with drag and drop

### What you built

- An S/A/B/C/D tier list (`TierBoard.tsx`), with drag and drop, quick tier buttons, and "Sort this tier"
- It replaced the first "which do you like more?" ranking, because comparing two favorites head to head is hard, and fully ranking everything takes many questions

### Why tiers: the math

- Any "which do you like more?" method needs a minimum number of questions to fully rank songs
  - 100 songs have 100! possible orders, and each yes/no answer can at best rule out half of the remaining orders
  - So you need at least log₂(100!) questions:
    - ln(100!) ≈ 363.74
    - log₂(100!) = 363.74 ÷ 0.6931 ≈ 524.8
  - So about 525 questions minimum, for any pairwise method, in the worst case
- A tier list needs just 100 decisions (one per song), and each is easier: judging one song on its own ("is this an S?") instead of comparing two
- "Sort this tier" stays optional, for people who want a precise order within a tier

### How the tier list is stored

- `Tiers` is an object with five lists of song keys: `{ S: [...], A: [...], B: [...], C: [...], D: [...] }`
- "Unranked" is never saved. `buildBoard` calculates it: any song that isn't in a tier is unranked
  - Why: if you add a new concert, its songs automatically appear as unranked, with nothing to update
  - It also drops keys for songs that no longer exist (like from a removed concert)
- `as const` and `(typeof TIER_NAMES)[number]`: this builds the type `"S" | "A" | "B" | "C" | "D"` directly from the list, so the list and the type can never disagree

### How drag and drop works (dnd-kit)

- **`DndContext`**: watches the whole drag, from pick-up to drop
- **`SortableContext`**: one per tier. It makes that tier's songs a reorderable list
- **`useSortable`**: used by each song card. It provides the drag listeners and the sliding animation (`transform` and `transition`)
- **`useDroppable`**: used by each tier row, so you can drop into a tier even when it's empty
- **`DragOverlay`**: the floating copy of the card that follows your pointer
- **Sensors** decide what counts as starting a drag:
  - Mouse: moving 5px, so clicking a button inside a card still works as a click
  - Touch: pressing and holding for 200ms, so phones can still scroll normally
  - Keyboard: focus a card, press Space, move with the arrow keys, press Space to drop (this makes it accessible without a mouse)
- **The temporary drag board**:
  - When a drag starts, a copy of the board is made (`dragBoard`)
  - `onDragOver` fires as you move over other tiers, and moves the song into the new tier in the copy, so you can see where it will land
  - `onDragEnd` finishes any reordering within a tier (`arrayMove`) and only then saves
  - If you cancel a drag (Escape), the copy is thrown away, and nothing changes
- **Staying aligned while tiers change size** (a bug found in testing):
  - Moving a song into a tier makes that tier taller, which pushes every row below it down the page
  - By default, dnd-kit measures where each tier is only once, when the drag starts, so after the first move its idea of where the tiers are no longer matched the screen, and only one tier could be hit
  - `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` re-measures throughout the drag, so drop targets stay where you see them
- **Stopping the "bouncing" loop** (a second bug found in testing, when dragging fast):
  - Moving a song into a tier shifts the layout, and with constant re-measuring, a *different* tier could end up under the pointer without the mouse moving
  - The song would move again, shift the layout again, and bounce between two tiers forever, until React stopped it with "Maximum update depth exceeded"
  - Fix: right after a song changes tiers, `justMoved` freezes the drop target (dnd-kit keeps using `lastOverId`) until the browser has drawn the new layout. A `useEffect` with `requestAnimationFrame` lifts the freeze one frame later (about 16ms)
  - `useRef` is used instead of state for these, because changing a ref doesn't cause a re-render, which is exactly what you want for bookkeeping that shouldn't redraw anything
- **Deciding what you're dragging over** (`collisionDetection`):
  - First, whatever is directly under the pointer (`pointerWithin`), which matches where you're actually aiming
  - If nothing is (for example, keyboard dragging, which has no pointer), it falls back to the nearest corners (`closestCorners`)
  - Over a gap between tiers, it keeps the last target, so the song doesn't jump around
  - The whole tier row, including its label, is a drop target, and it's highlighted while you're over it
- **`noDrag`** on buttons inside a card stops their events from reaching the card, so pressing S/A/B/C/D or × doesn't start a drag

### "Sort this tier" (binary insertion)

- Songs are placed one at a time into a growing sorted list
  - The first song starts the list
  - Each next song is compared to the song in the middle of its possible range (`lo` to `hi`)
    - Like the new song more → it goes above the middle, so `hi = mid` (bottom half ruled out)
    - Like it less → it goes below the middle, so `lo = mid + 1` (top half ruled out)
    - "Too close to call" → it goes right below the song it was compared to, and questions for that song end early
  - When `lo == hi`, only one position is left, and it's inserted there
- Placing a song among *k* already-sorted songs takes at most ⌈log₂(*k* + 1)⌉ questions
  - Example, a tier of 20 songs, where *m* is the number of sorted songs after adding each one:
    - *m* = 1: 0 × 1 = 0
    - *m* = 2: 1 × 1 = 1
    - *m* = 3–4: 2 × 2 = 4
    - *m* = 5–8: 3 × 4 = 12
    - *m* = 9–16: 4 × 8 = 32
    - *m* = 17–20: 5 × 4 = 20
    - Total: 0 + 1 + 4 + 12 + 32 + 20 = **69 questions at most**
- Tested with 10 songs in scrambled order: it rebuilt the correct order in 20 questions
- **Union return types**: `answerSort` returns either a session (more questions to ask) or an array (the finished order). `Array.isArray(result)` tells them apart
- Dragging is turned off while sorting, because the sort keeps track of positions, and moving songs would make those positions wrong
- Cancel keeps the old order, since the new order is only saved at the very end

---

## Step 9: Countries

### What you built

- Concerts show the country, and search can be filtered by country

### Concepts

- setlist.fm includes the country inside each venue's city: `venue.city.country.name`
- The search filter needs a 2-letter code (`CA`, `US`, `GB`), so the dropdown shows names but sends codes
  - `<option value="CA">Canada</option>`: the text is what users see, and `value` is what gets saved in state and sent
- **`Intl.DisplayNames`** (built into JavaScript) turns `"CA"` into `"Canada"`, so no country-name file is needed
- `COUNTRIES` is built once, outside the component, so it isn't rebuilt on every render
- `formatPlace` joins venue, city, and country, skipping any that are missing (`.filter(Boolean)` removes empty values)
- Concerts saved before this update have no country. Remove and re-add them to fill it in

---

## Step 10: Spotify login and custom lists

### What you built

- Spotify login, and custom ranking lists filled with songs from Spotify

### How Spotify login works (OAuth Authorization Code flow)

- The user clicks "Connect Spotify," which goes to `/api/spotify/login`
- The server sends them to Spotify's login page, along with Encore's client ID, the permissions requested (scopes), and a random `state` value
- The user approves, and Spotify sends them back to `/api/spotify/callback` with a one-time `code`
- The server checks that `state` matches the one it saved
  - Why: it proves the login started from Encore, which blocks an attack where someone tricks your browser into finishing *their* login (CSRF)
- The server trades the `code` plus the client secret for an **access token** (valid for about an hour) and a **refresh token** (used to get new access tokens)
  - This has to happen on the server, because it uses the client secret
- Tokens are saved in **httpOnly cookies**: the browser stores and sends them automatically, but JavaScript on the page can't read them
  - Why: if a malicious script ever ran on the page, it still couldn't steal the tokens
  - That's also why the page asks `/api/spotify/status` whether it's connected, instead of checking the cookie itself
- `getAccessToken()` checks the expiry time, and if the access token is expired (or within a minute of it), quietly uses the refresh token to get a new one

### How the Spotify API is used

- The same middleman pattern as setlist.fm: browser → your API routes → Spotify
- Each request sends `Authorization: Bearer <access token>`
- **Pagination**: long lists (like an artist's albums) come in pages, each with a `next` link. `getAllPages` follows those links until there are no more
- **Current Spotify limits** (from its February 2026 API changes):
  - Search returns at most 10 results
  - Batch lookups (many albums in one request) were removed, so a discography is fetched one album at a time, with a short pause between albums
  - Development mode apps need a Premium owner and allow up to 5 users
- **Errors**: 401 means the login expired, 403 usually means the account isn't allowlisted in User Management, and 429 means too many requests

### Removing duplicates from discographies

- Artists release the same song many times: the original, deluxe editions, remasters, live albums
- Three layers of protection:
  - `include_groups=album,single` skips compilations and songs the artist only appears on
  - `cleanTitle` removes version labels, like "- 2011 Remaster," "(Live at...)," and "(feat. ...)," but keeps "Remix" and "Acoustic," since those can feel like different songs
    - `\b` in the regular expression is a "word boundary," so "live" matches "Live" but not the "live" inside "Alive"
  - `dedupeItems` keeps only the first song with each key, and albums are sorted oldest first, so the original release wins
- The song key reuses `songKey(artist, title)` from the song counts, so the same normalizing rules apply

### Custom lists

- A `CustomList` holds a name, its songs (`items`), and its own tiers
- All custom lists are saved together in `localStorage` under `encore:customLists`
- `updateList` replaces one list with an updated copy (never mutating), and `crypto.randomUUID()` gives each new list a unique ID
- Adding songs skips any that are already in the list, and removing a song also removes it from its tier

---

## Step 11: Styling (rough version, inspired by dialed.gg)

### The look

- A light page with dark cards that have big rounded corners and large, soft shadows
- Solid-colored rounded-square icon badges: red for concerts, teal for songs, yellow for rank
- White pill-shaped buttons on dark cards, and a gentle "pressed in" shrink when clicked
- Tiers as solid colors: S red, A orange, B yellow, C green, D indigo
- Song cards that tilt slightly and cast a bigger shadow while being dragged, like picking up a physical card
- The setlist.fm attribution is now a small "setlist.fm ↗" link on each concert plus a footer credit

### How the CSS is organized (`app/globals.css`)

- **Design tokens**: every color, corner radius, and shadow is a CSS variable in `:root`
  - Example: `--radius-lg: 24px`, then `border-radius: var(--radius-lg)` everywhere a big card appears
  - Why: change one value, and the whole site updates consistently. It also keeps the look coherent, since everything draws from the same small set of values
- **Component classes**: reusable classes like `.card`, `.btn`, `.btn-light`, `.input`, `.pill`, and `.tier-row`, applied with `className` in the JSX
  - `className` is React's name for HTML's `class` attribute (`class` is a reserved word in JavaScript)
  - Combining classes: `` className={`nav-link ${active ? "active" : ""}`} `` adds `active` only when the condition is true
- **Shadows**: `--shadow-lg` stacks two shadows: a wide, very blurry one for the soft glow, and a tighter one for depth right under the card
  - The negative "spread" value (like `-30px`) pulls the shadow in from the sides, so it mostly shows below the card, as if lit from above
- **The card background** is a subtle gradient (`linear-gradient(165deg, #1e1e20, #0f0f10)`), which reads as "solid dark" but has a bit of depth
- **Responsive**: `@media (max-width: 640px)` shrinks padding, titles, and tier letters on phones. The concert grid uses `repeat(auto-fill, minmax(290px, 1fr))`, which fits as many 290px+ columns as the screen allows
- **Icons** (`components/Icons.tsx`) are small hand-drawn SVGs that use `currentColor`, so they automatically take the text color of whatever they sit inside

### Why plain CSS (for now)

- No new tools to learn, and it keeps styles readable in one place
- Tailwind is an option later (it's popular in job postings); switching would mean replacing these classes with Tailwind utility classes in the JSX

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
- **Countries**
  - Filter a big touring artist by country, and check that concerts show "Venue, City, Country"
- **Tier list (songs heard live)**
  - Put songs into tiers with the S/A/B/C/D buttons, then drag some between tiers and within a tier
  - Drag a song into an empty tier
  - Try "Sort this tier" on a tier with 4+ songs, including "Too close to call" and Cancel
  - Press Escape mid-drag: the song should go back where it was
  - Remove a concert and check that its songs disappear from the tiers
  - Try it on your phone (press and hold to drag)
- **Custom lists**
  - Connect Spotify, create a list, and add a full discography of an artist you know well
    - Look for duplicates that got through (like a song appearing twice with different titles), and songs that shouldn't have merged
  - Add a single album with "Choose albums," and a single song with the Song search
  - Remove songs with ×, create a second list, switch between them, and delete one

---

## Known limitations (on purpose, for now)

- Data lives in one browser only (and one address: `localhost` and `127.0.0.1` count as different sites). Phase 2 fixes this with accounts
- Search needs an artist name. You can't search by venue or date alone
- "Make a playlist" is still a placeholder, but the Spotify login it needs is now done
- Search results are 20 per page, newest first, so older shows may need "Load more" or filters
- Name normalizing catches small differences but not bigger ones like "Pt. 2" vs "Part 2"
- Discographies are capped at 60 releases, so very prolific artists may be missing some older songs
- Reordering inside "Unranked" isn't saved, since unranked songs are always listed in their original order
- Spotify: development mode allows up to 5 allowlisted users, and Spotify has been changing its API rules this year, so endpoints may change again
- Styling is a rough first pass: no dark/light toggle, no animations beyond basics, and some screens (like errors) are plain

---

## What comes next

- **Phase 2: Supabase accounts**
  - Sign up and log in, save concerts and rankings to a Postgres database, and copy guest data into a new account
- **Phase 3: Spotify playlists**
  - Spotify login is already done. What's left: matching songs heard live to Spotify tracks (handling covers, missing songs, and versions), creating playlists, and a shared table of confirmed matches
  - Remember Spotify's current limits: the app owner needs Premium, and dev mode allows 5 users
- **Phase 4: the AI agent**
  - Finds songs that normal matching missed, with the user confirming every suggestion
  - Python/Strands vs. TypeScript decision still to be made

---

## Interview talking points

- **The client/server split**: why the setlist.fm key lives only in an API route
- **Deriving vs. storing data**: song counts are calculated from concerts rather than saved, so they can never go out of sync
- **Choosing tiers over pairwise ranking, using math**: any pairwise method needs at least log₂(n!) comparisons (about 525 for 100 songs), while tiers need n decisions, with binary insertion kept as an optional refinement
- **Drag and drop across multiple lists**: a temporary drag state that's only saved on drop, plus accessibility through keyboard sensors
- **OAuth done securely**: the authorization code flow, CSRF protection with `state`, httpOnly cookies, and automatic token refresh
- **Debugging a drag-and-drop feedback loop**: layout shifts re-triggering moves, fixed by freezing the drop target for one animation frame
- **Deduplicating messy music catalog data**: filtering release types, cleaning version labels with regular expressions, and letting the original release win
- **Working within API limits**: 1,440 requests/day shaped the decision to store setlist snapshots
- **Text normalization for matching**: merging near-duplicate song names, and its limitations
