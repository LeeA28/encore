# Encore: Build Guide

A complete walkthrough of how Encore works, step by step, so you can read through it at your own pace and explain any part of it later.

---

## Installing these files

- Copy everything from the zip into your `encore` project, keeping the same folder structure, and replace files when asked
- Delete these old files, which were replaced:
  - `components/RankSongs.tsx` (replaced by `RankTab.tsx`, `TierBoard.tsx`, and friends)
  - `lib/ranking.ts` (replaced by `lib/tiers.ts`)
- Install the libraries: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @supabase/supabase-js @supabase/ssr`
- Delete `lib/useLocalStorage.ts` (replaced by `lib/useEncoreData.ts`)
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

## Setting up Supabase (accounts)

- Create a project at supabase.com, and save the database password somewhere safe
- Create the tables with migrations (see Step 21): `npx supabase login`, `npx supabase link --project-ref <your project ref>`, then `npm run db:push`
  - For a brand new database, `db:push` runs every file in `supabase/migrations/` in order
  - (Encore's first database was set up by pasting SQL into the SQL Editor, before migrations existed. Step 21 explains how that was brought in line)
- Email confirmation (checks that emails are real): Authentication → Sign In / Providers → Email → "Confirm email"
  - Add `http://127.0.0.1:3000/**` under Authentication → URL Configuration → Redirect URLs. Supabase only sends people back to addresses on this list, which stops attackers from using your confirmation emails to redirect people elsewhere
  - The default email works as-is: its link confirms the email, then sends people to `/auth/callback`, which logs them in (in the same browser they signed up with)
  - Templates can only be edited after connecting a custom email provider (Authentication → SMTP). Once you have one, you can switch the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, which also works across devices. The `/auth/confirm` page is already built for that
  - Supabase's built-in email sender is only meant for testing (it's heavily rate-limited, and may only deliver to your own team's addresses). Before real users sign up, connect a custom email provider
- Set the Site URL: Authentication → URL Configuration → `http://127.0.0.1:3000`
- Add to `.env.local`, then restart the dev server:
  - `NEXT_PUBLIC_SUPABASE_URL=` the Project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` the publishable key (API Keys; "Create new API Keys" if there isn't one)

## The big picture

### What the user does

- **Concerts tab**: search for an artist (optionally with a year and city), click "I was there" on the shows they attended
- **Songs tab**: see every song they've heard live, from most heard to least, with counts
- **Rank tab**, with two modes:
  - **Songs I've heard live**: an S/A/B/C/D tier list of every song from your concerts
  - **Custom lists**: named lists filled with any songs from Spotify (a full discography, chosen albums, or single songs), each with its own tier list
  - Songs can be dragged within and between tiers, or placed quickly with S/A/B/C/D buttons
- Concert search can be filtered by year, city, and country
- Logged out ("guest"), everything is saved in the browser. Logged in, everything is saved to your account in Supabase, so it follows you across devices (Spotify login is separate, saved in secure cookies)

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
  EncoreApp.tsx              Top-level: header, tabs, who's logged in, Spotify connection
  ConcertSearch.tsx          Concerts tab: search (with country dropdown), results, your concerts
  SongList.tsx               Songs tab: most-heard list with counts
  RankTab.tsx                Rank tab: switches between live songs and custom lists
  TierBoard.tsx              The drag-and-drop S/A/B/C/D tier list (used by both modes)
  Workspace.tsx              Owns the user's data (via useEncoreData) and shows the current tab
  AuthModal.tsx              The log in / sign up pop-up (with resend confirmation email)
  ThemeToggle.tsx            The sun/moon light/dark mode button (kept in sync across both header layouts)
  HeaderMenu.tsx             The ☰ menu on narrow screens: Spotify, Account, Log in/out
  DiscoverTab.tsx            The discover tab: recommended artists, with reasons
  AddSongPanel.tsx           "+ Add a song" on your concerts: search Spotify or type a song setlist.fm missed
  ConfirmDialog.tsx          Encore's "are you sure?" pop-up, used through useConfirm()
  AccountTab.tsx             The Account tab: your details and changing your password
  PasswordForm.tsx           "Set a new password" (typed twice), used by Account and reset links
  PlaylistList.tsx           "Your playlists": detects playlists deleted in Spotify, Restore and Remove
  PlaylistBuilder.tsx        Match songs to Spotify, review and fix matches, create the playlist
  TierPlaylistButton.tsx     Pick tiers from a tier list, then open the playlist builder
  CustomLists.tsx            Create, pick, and delete custom lists
  SpotifyAdder.tsx           Search Spotify and add songs to a custom list
  Icons.tsx                  Small hand-drawn SVG icons (logo, ticket, note, tier stack)
lib/
  types.ts                   Shared types: Song, Concert, SongCount, RankItem, CustomList
  setlistfm.ts               Server-only: talks to setlist.fm
  concerts.ts                Pure: raw setlist.fm data → Concert, date and place formatting
  countries.ts               The country list for the dropdown
  songs.ts                   Pure: counting songs across concerts, normalizing names
  tiers.ts                   Pure: tier list logic and tier colors
  music.ts                   Pure: Spotify tracks → rankable items, cleaning titles, removing duplicates
  spotifyAuth.ts             Server-only: Spotify login, token cookies, refreshing tokens
  spotify.ts                 Server-only: calls to Spotify's Web API
  spotifyRoute.ts            Server-only: shared error handling for the Spotify routes
  useEncoreData.ts           Custom hook: all user data, saved to the browser (guest) or Supabase (logged in)
  guestData.ts               Reading, writing, and clearing guest data in localStorage
  accountData.ts             Reading and saving data in Supabase, and merging guest data into an account
  supabase/client.ts         Creates the Supabase client used in the browser
  supabase/proxy.ts          Refreshes login sessions (used by /proxy.ts)
  supabase/server.ts         The Supabase client for server code (email confirmation)
  siteUrl.ts                 The real address to redirect back to (not the dev server's "localhost")
  emailDomains.ts            The list of email providers allowed for sign-up
  passwordRules.ts           The minimum password length and the "typed twice" check
  authErrors.ts              Turns Supabase's error codes into plain-language messages
  matching.ts                Pure: Spotify search queries and scoring for song matching
  matchCache.ts              Remembers matched tracks in the browser
  recommend.ts               Pure: taste profile, candidate scoring, and reasons for recommendations
  sharedMatches.ts           The shared match table: reading shared matches, saving your votes, and which match wins
  database.types.ts          Generated from the database: every table and column's type (npm run db:types)
  db.ts                      Short names for the database types: Row<"concerts">, Insert<...>, EncoreSupabase
next.config.ts               Allows hot reload from 127.0.0.1 (needed for Spotify login)
proxy.ts                     Runs before each page request: keeps the Supabase login fresh
app/auth/confirm/route.ts    Where custom-template confirmation links land (for later, with custom SMTP)
app/auth/callback/route.ts   Where the default confirmation email lands: logs you in
app/api/recommendations      Server: similar artists from Last.fm (cached for a day)
app/api/spotify/match        Server: matches songs to Spotify tracks
app/api/spotify/playlists    Server: creates a playlist and adds its tracks
app/api/spotify/playlists/status   Server: which playlists are still in your Spotify library
app/api/spotify/playlists/restore  Server: adds a deleted playlist back to your library
supabase/migrations/         The database's version history: one SQL file per change, applied in order
lib/*.test.ts                Automated tests for the pure functions (npm test)
vitest.config.mts            Test settings (including the time zone tests run in)
.github/workflows/ci.yml     Runs lint, type check, and tests on GitHub for every push
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

- An S/A/B/C/D tier list (`TierBoard.tsx`), with drag and drop and quick tier buttons
- It replaced the first "which do you like more?" ranking, because comparing two favorites head to head is hard, and fully ranking everything takes many questions

### Why tiers: the math

- Any "which do you like more?" method needs a minimum number of questions to fully rank songs
  - 100 songs have 100! possible orders, and each yes/no answer can at best rule out half of the remaining orders
  - So you need at least log₂(100!) questions:
    - ln(100!) ≈ 363.74
    - log₂(100!) = 363.74 ÷ 0.6931 ≈ 524.8
  - So about 525 questions minimum, for any pairwise method, in the worst case
- A tier list needs just 100 decisions (one per song), and each is easier: judging one song on its own ("is this an S?") instead of comparing two
- An optional "Sort this tier" mode (binary insertion with "which do you like more?" questions) was built and later removed to keep ranking simple: dragging within a tier covers precise ordering. It's still in your Git history if you ever want it back

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

### The Spotify button in the header

- Top right: an outlined "Connect Spotify" pill when not connected, and a Spotify-green "Spotify connected" pill when connected (clicking it asks to disconnect)
- Next to it, a black "Log in" pill for Encore accounts. For now it opens a "coming soon" pop-up; Phase 2 (Supabase) makes it real
  - Spotify and Encore accounts are separate on purpose: Spotify only powers music browsing and playlists, while an Encore account will save your data across devices
- **The pop-up (modal)**: a dimmed layer (`.modal-backdrop`, `position: fixed; inset: 0`) covers the page, with a card in the middle
  - Clicking the dimmed layer closes it. Clicks inside the card call `e.stopPropagation()`, which stops the click from "bubbling up" to the dimmed layer, so clicking the card doesn't close it
  - `z-index: 100` keeps it above everything else on the page
- The connection status lives in `EncoreApp`, the top-level component, because both the header and custom lists need it ("lifting state up"). It's checked once when the page loads
- "Connect Spotify" is a normal link, not a `fetch`, because logging in means actually visiting Spotify's website
- `?returnTo=songs` on the login link is saved in a short-lived cookie, and the callback sends you back to that tab
  - Only the three known tab names are accepted, so the value can't be abused to redirect somewhere unexpected (an "open redirect")
- After returning, `window.history.replaceState` cleans `?tab=...&spotifyError=...` out of the address bar, so refreshing doesn't show an old error again
  - It changes the URL without reloading the page

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
- **Spotify green**: `--spotify-green: #1db954` with dark text on top, since dark text has better contrast on that shade than white
- **Icons** (`components/Icons.tsx`) are small hand-drawn SVGs that use `currentColor`, so they automatically take the text color of whatever they sit inside

### Why plain CSS (for now)

- No new tools to learn, and it keeps styles readable in one place
- Tailwind is an option later (it's popular in job postings); switching would mean replacing these classes with Tailwind utility classes in the JSX

---

## Step 12: Accounts with Supabase (Phase 2)

### What you built

- Email and password accounts. Logged in, your concerts, live tiers, and custom lists save to a Postgres database, so they're available on any device
- Guests still work exactly as before, saving in the browser
- When a guest logs in, their browser data is moved into their account

### The database (`supabase/migrations/`)

- Three tables:
  - `concerts`: one row per concert a user added. Details are real columns (date, artist, venue, city, country, link); the song list is JSON
    - Why the mix: concert details are fixed, simple fields that fit columns, while songs are only ever used as a whole list, so JSON keeps them simple
    - `primary key (user_id, setlist_id)`: a *composite* key, meaning a user can add each concert only once, but different users can add the same concert
  - `live_tiers`: one row per user, with their tiers as JSON
  - `custom_lists`: one row per list
- `references auth.users (id) on delete cascade`: every row belongs to a user in Supabase's built-in users table, and deleting a user deletes their rows automatically
- `default auth.uid()`: if `user_id` isn't given, Postgres fills in the ID of whoever sent the request

### Security: Row Level Security (RLS)

- The URL and publishable key are in browser code on purpose (`NEXT_PUBLIC_` variables are sent to the browser), so anyone could send requests to the database
- RLS makes Postgres itself check every request: each policy says a logged-in user can only read or change rows where `user_id` is their own ID
  - `using (...)` checks which existing rows you can see or change; `with check (...)` checks what new or updated rows are allowed to look like
  - `(select auth.uid())` is written with `select` around it because Supabase recommends it: Postgres then calculates it once per request instead of once per row
- Result: even a hand-written request with the public key can't touch anyone else's data. This is what makes it safe for the browser to talk to the database directly, with no API routes in between
- Logged-out visitors (`anon`) get no access to these tables at all

### How login works

- `AuthModal` calls `supabase.auth.signInWithPassword` or `supabase.auth.signUp`
  - With email confirmation off, signing up logs you in immediately. When it's turned on later, `signUp` returns no session, and the pop-up asks the user to check their email instead (already handled)
- Supabase stores the login in cookies. `proxy.ts` (called `middleware.ts` before Next.js 16) runs on the server before each page request and refreshes the login when it's about to expire
- `EncoreApp` asks `supabase.auth.getUser()` who's logged in when the page loads, then listens with `onAuthStateChange` for logging in and out
  - `user` has three states: `undefined` (still checking), `null` (guest), or the user. Nothing below the header shows while it's `undefined`, so you never see a flash of guest data before an account loads

### One hook for all data (`useEncoreData`)

- Components call the same functions (`addConcert`, `setLiveTiers`, `updateList`...) whether you're logged in or not, and the hook decides where to save
  - Guest: effects write each change to `localStorage`
  - Logged in: each action updates the screen immediately, then saves to Supabase in the background (an "optimistic update"), showing an error banner if the save fails
- **Resetting with `key`**: `<Workspace key={user?.id ?? "guest"} ...>`. When the key changes (logging in, out, or switching accounts), React throws away the old component and its state and creates a fresh one
  - This is simpler and safer than manually clearing every piece of state, and it guarantees one person's data never shows up in another's session
- **Debouncing**: tier dragging can change things many times per second. Tier and list saves wait until changes stop for 800ms, then save once. Each list has its own timer, so editing one list doesn't delay another
  - Before logging out, `flush()` saves anything still waiting, so a drag right before logging out isn't lost. `EncoreApp` reaches this function through a ref (`flushRef`), since the function lives inside `Workspace`
- `Promise.all` loads the three tables at the same time instead of one after another
- `let cancelled = false` in the loading effect: if the component is thrown away mid-load (say, a quick log out), the late results are ignored instead of updating a component that no longer exists

### Moving guest data into an account (`mergeGuestData`)

- Concerts: `upsert` with `ignoreDuplicates`, so concerts the account already has are skipped
- Live tiers: only copied if the account has none, so an existing ranking is never overwritten
- Custom lists: copied with the same IDs, so running the merge twice can't create duplicates
  - This matters because React runs effects twice in development (Strict Mode) to catch bugs. Every step of the merge is designed so doing it twice gives the same result, which is called being *idempotent*
- Afterward, the browser copy is cleared, and a green banner confirms the move

---

## Step 13: Polish from testing

### What changed

- **Clicking "Encore" reloads the page**: it's a plain `<a href="/">` instead of Next.js's `<Link>`, since `<Link>` switches pages without reloading (and there's only one page)
- **Concert cards redesigned for scanning**: date and city are the biggest text, the tour name is a yellow pill, and the artist and venue are small and quiet, since you already know which artist you searched. The song count is gone (the setlist is still one click away)
  - Tour names come from setlist.fm's `tour.name`, and are saved in a new `tour` database column
- **Search as you type**: results update as you type, and clearing the artist clears them
  - **Debouncing** again: the search waits until you pause typing for 600ms, to stay within setlist.fm's limits (2 requests per second, 1,440 per day)
  - **Cancelling stale searches** with `AbortController`: if you keep typing, the previous request is cancelled. Otherwise, a slow old response could arrive after a newer one and replace the right results with outdated ones (a "race condition")
  - Partial years like "20" don't trigger a search, and the year box only accepts digits
- **Dark mode**, with a sun/moon button in the header
  - Every color is a CSS variable, so dark mode is just a second set of values under `:root[data-theme="dark"]`. The button changes `data-theme` on `<html>`, and everything switches instantly
  - The first visit follows your device's light/dark setting; after that, your choice is remembered
  - A tiny script in `layout.tsx` sets the theme *before* the page is drawn. Without it, dark mode users would see a white flash on every load
  - On a black page, shadows barely show, so dark cards get a faint 1px border instead
- **Real email checks**: with "Confirm email" turned on, signing up sends a confirmation link, and the account only works once it's clicked. Only the owner of the inbox can click it, which is how you know the email is real
  - The link goes to `/auth/confirm`, where the server calls `supabase.auth.verifyOtp` to verify it and log you in
  - Trying to log in before confirming shows a clear message and a "Resend confirmation email" button

---

## Step 14: Spotify playlists

### What you built

- "Make a playlist" on the Songs tab (every song you've heard live, most heard first) and on any tier list (pick tiers, like S and A)
- A playlist builder: automatic matching, a review screen to change or skip matches and search for songs that weren't found, then the playlist is created in your Spotify account
- "Your playlists" on the Songs tab, saved to your account (or the browser, as a guest)

### Matching: the core of Encore (`lib/matching.ts`)

- Each song is searched on Spotify up to three ways, from most to least precise:
  - `track:"Song" artist:"Artist"`: Spotify's search filters, which only look in that field
  - For covers: the same with the original artist, since the performer may never have recorded it
  - A loose search of the title and artist, as a last resort
- Every result gets a score:
  - Same cleaned title: +50. Title starts with the other (like "Song" vs. "Song, Pt. 1"): +20. Different title: 0, never used
  - The performing artist: +40. The original artist of a cover: +30
  - A live, remix, or karaoke version when the song itself isn't one: −30
- 70 or more (right title plus right artist) is accepted automatically. 90 or more is excellent, so the remaining searches are skipped to save requests
- Examples, for "Creep" by Radiohead:
  - "Creep" by Radiohead: 50 + 40 = **90**, accepted
  - "Creep - Remastered 2008" by Radiohead: the title cleans to "Creep", so also **90**
  - "Creep - Live" by Radiohead: 50 + 40 − 30 = **60**, not automatic, but offered under "Change"
  - "Creep" by a different band: 50, a candidate only
  - "Creeping Death" by Metallica: 20, basically never chosen
- The match rate (shown in the builder) is a great resume number: "matched 9X% of songs automatically"

### How the pieces fit

- The browser sends songs to `/api/spotify/match` in batches of 10, which shows progress and paces the requests for Spotify's rate limit
- Songs from custom lists already have Spotify IDs, so they skip matching entirely
- Matches you create playlists with are saved in a browser cache (`encore:matchCache`), so the same song is instant next time. It's only a cache: losing it just means searching again
- `/api/spotify/playlists` creates a **private** playlist (`POST /me/playlists`), then adds tracks in chunks of 100, Spotify's limit per request
- Two songs can match the same track (like two spellings of one song), so track IDs are deduplicated with a `Set` before creating
- The playlist is recorded in the new `playlists` table, with the same Row Level Security rules as the other tables

---

## Step 15: Fixes from testing (round 2)

### Playlist matching that survives errors

- A temporary `502` from Spotify used to wipe out the whole matching run, putting every song in "Not found"
- Now, in layers:
  - **Retries with exponential backoff** (`spotifyGet` in `lib/spotify.ts`): temporary errors (`429`, `500`, `502`, `503`, `504`, and network hiccups) are retried up to 3 more times, waiting 0.5s, then 1s, then 2s. Doubling the wait each time gives an overloaded server room to recover. For `429`, Spotify's `Retry-After` header says exactly how long to wait, so that's used instead
  - **One failure doesn't spread**: if one search style fails for a song, the next style is tried. If every search for a song fails, it's marked "couldn't check" instead of "not found," since those mean different things
  - Login errors (`401`, `403`) still stop everything right away, since they'd affect every song
  - **"Retry these"**: songs that couldn't be checked get their own section and a button to search just those again
  - A little more spacing between searches (200ms), so errors are less likely in the first place

### The playlist builder can't close by accident

- Clicking the dimmed background no longer closes it: during a long matching run, a stray click threw everything away
- "Cancel" (while matching) and "Close" (while reviewing) ask for confirmation first
- Cancelling calls `abort()` on an `AbortController`, which stops the requests in progress and prevents new ones, instead of leaving them running in the background using up Spotify requests

### Playlist order: grouped by artist (`groupByArtist` in `lib/songs.ts`)

- "Every song I've heard live" playlists keep each artist's songs together
  - Artists are ordered by their most-heard song, with ties broken by total plays, then alphabetically
  - Within an artist, songs go from most to least heard
- Example: A by X ×6, E by Y ×5, F by Y ×4, B by X ×3, C by X ×2, D by X ×1 → A, B, C, D, E, F
  - Artist X goes first because its top song (A, ×6) beats artist Y's top song (E, ×5)
- How it works: group songs into a `Map` by artist, sort inside each group, sort the groups by their first (most-heard) song, then `.flat()` joins the groups back into one list
- Tier list playlists keep tier order (S, then A...), since that's the order you chose

### Redirects to the right address (`lib/siteUrl.ts`)

- After Spotify login, you were sent to `localhost:3000` even if you started on `127.0.0.1:3000`. Since cookies belong to one exact address, that looked like being disconnected
- Why: redirects were built from `request.url`, which Next.js's dev server reports as `localhost` no matter what the browser used
- Fix: `getOrigin` uses the request's `Host` header, which is the address the browser actually used. Once deployed, a `SITE_URL` environment variable can pin it to the real site address

### Sign-up only with common email providers (`lib/emailDomains.ts`)

- The part after `@` must exactly match a list of well-known providers (Gmail, Outlook, Hotmail, Yahoo and its regional versions, iCloud, Proton, and more)
- This catches typos like `mgail.com` before a confirmation email is sent to an inbox that doesn't exist. Bounced emails count against a Supabase project's email sending
- A `Set` is used for the list, since checking whether a `Set` contains something is instant, no matter how big it is
- Tradeoff: school, work, and custom-domain emails are blocked too. Add domains to the list to allow them
- This check runs in the browser, so it stops honest mistakes, not determined people. To enforce it strictly, Supabase supports a "before user created" auth hook (a database function that can reject sign-ups)

### Logging in automatically after confirming (`app/auth/callback/route.ts`)

- The default confirmation email confirms the address, then sends people to `/auth/callback?code=...`
- The server trades that one-time code for a login session (`exchangeCodeForSession`), the same idea as the Spotify callback
- **PKCE** (Proof Key for Code Exchange): at sign-up, the browser stored a secret, and the code only works together with it. That way, someone who intercepts the link can't use it to log in as you. The downside is that it only works in the same browser; on another device, the email is still confirmed, and the page asks you to log in

---

## Step 16: Encore's own pop-ups, and friendlier errors

### A reusable confirmation pop-up (`components/ConfirmDialog.tsx`)

- Replaces the browser's built-in `confirm()` box, which can't be styled, in three places: disconnecting Spotify, deleting a list, and cancelling or closing the playlist builder
- Buttons name the action ("Disconnect," "Delete list," "Stop") instead of a vague "OK," and deleting uses a red button as a warning
- Escape or clicking outside cancels; the confirm button is focused when it opens, so Enter confirms
- **How it works**:
  - `ConfirmProvider` wraps the whole app (in `EncoreApp`) and holds one pop-up's state
  - **React Context** lets any component, however deep, reach the provider's `confirm` function through `useConfirm()`, without passing it down through every component as a prop
  - `confirm({...})` returns a **Promise** that resolves to `true` or `false` when a button is clicked. So code can simply `await` the answer: `if (!(await confirm({...}))) return;`
  - The Escape listener is added with `useEffect` only while the pop-up is open, and its cleanup function removes it when it closes (otherwise listeners would pile up)
  - `z-index: 200` puts it above the playlist builder (100), since it can be opened from there

### Other fixes

- The playlist builder, when Spotify isn't connected, shows "To make a playlist, please connect your Spotify account" with a Connect Spotify button, which sends you back to the same tab afterward. Its button says "Close" and doesn't ask for confirmation, since nothing has started
- Login and sign-up errors are translated into plain language (`friendlyError` in `AuthModal.tsx`), using Supabase's error codes, like `over_email_send_rate_limit` becoming "Too many sign-up emails have been sent recently..."

### Playlist review colors

- Not found songs are at the top, since they need attention: red heading with a count, red-tinted rows, and a dashed red "No match" bubble
- Songs that couldn't be checked (Spotify errors) come next in an amber panel with "Retry these"
- Matched songs are last, with blue track bubbles. The summary pills at the top use the same colors
- Each color is three CSS variables: a soft background (`--red-tint`), a border (`--red-edge`), and text (`--red-ink`), so they stay consistent everywhere they're used

### Fading between light and dark mode (`ThemeToggle.tsx`)

- **View Transitions API** (Chrome, Edge, Safari): `document.startViewTransition(() => applyTheme(next))`. The browser captures the page, applies the change, then cross-fades from the old picture to the new one
- **Fallback** for other browsers: the `theme-fading` class turns on color transitions on every element for 0.4 seconds, just long enough for the fade, then it's removed so hover effects stay instant
  - Checking `if (document.startViewTransition)` before using it is called *feature detection*: use the better tool when the browser has it, and fall back when it doesn't
- If someone's device is set to reduce motion (`prefers-reduced-motion`), the switch stays instant. Respecting that setting is an accessibility habit worth keeping for every animation

### Splitting medleys (`splitMedley` in `lib/songs.ts`)

- Found by measuring: the only 2 songs matching couldn't find (out of 77) were both medleys, like "It Will Rain / Talking to the Moon / When I Was Your Man"
- setlist.fm lists songs played back-to-back as one entry, separated by " / ". Spotify has each song, but not the combination
- `splitMedley` splits on " / " (with spaces), so each part counts and matches as its own song. Titles like "Face/Off" have no spaces around the slash, so they stay whole
- It runs in `countSongs`, not when concerts are saved, so concerts saved before this change benefit too, and the concert's setlist still shows the original entry
- A song heard both in a medley and on its own at the same show still counts once for that show, thanks to the existing `concertIds` check
- A good example of fixing a data problem with a simple rule, before reaching for AI

### Other visual changes

- Not-found rows no longer show a "No match" bubble, since the red row already says it. The row is just the song and a Search button
- Dark mode is now a dark gray page (`#232325`) with near-black cards, instead of a black page. It mirrors light mode (dark cards on a lighter page), so both themes feel like one design, and the soft card shadows are visible again

### Email sending limits (custom SMTP)

- Supabase's built-in email sender allows only a few emails per hour for the whole project, and may only deliver to your own team's addresses
- A custom email provider (SMTP: the standard way programs send email) removes that. Supabase connects to it under Authentication → SMTP Settings, with a host, port, username, password, and sender address
- Once it's connected, the email rate limit can be raised (Authentication → Rate Limits), and email templates become editable

---

## Step 17: Restoring playlists deleted in Spotify

### What "deleting" a playlist means on Spotify

- Deleting a playlist you made doesn't erase it. Spotify only removes it from your library; the playlist, its songs, and its link still exist
- So "was it deleted?" really means "is it still in my library?", and restoring it means adding it back, which keeps the same songs, order, and link

### How Encore handles it (`components/PlaylistList.tsx`)

- When "Your playlists" appears, Encore asks Spotify once which of them are still in your library
- Playlists that aren't show a red "Deleted in Spotify" label, with **Restore** (adds it back) instead of Open
- Every playlist has **Remove**, which takes it off Encore's list (with a confirmation pop-up). It doesn't touch Spotify
- **Why check ahead of time instead of when you click Open**: browsers block new tabs that open after a delay (like waiting for Spotify to answer), treating them as unwanted pop-ups. Checking first means Open still opens instantly, as a normal link

### The Spotify endpoints (from the February 2026 API changes)

- `GET /me/library/contains?uris=spotify:playlist:...`: answers true/false for many items at once, in the same order as asked. It's checked in groups of 20
- `PUT /me/library?uris=spotify:playlist:...`: adds an item to your library. It replaced the old "follow playlist" endpoint
- Spotify identifies things with **URIs** like `spotify:playlist:abc123`: the type plus the id, so one endpoint can handle tracks, albums, and playlists
- The routes only accept ids made of letters and numbers, so nothing unexpected can be slipped into the request to Spotify (a habit called *input validation*)
- `spotifyGet` now handles empty responses too, since saving to the library succeeds without sending anything back

### New Spotify permissions (scopes)

- `playlist-read-private`, `user-library-read`, and `user-library-modify` were added, for checking and restoring
- Permissions are granted when you connect, so existing connections need to **disconnect and reconnect** once to get the new ones. Until then, the check quietly fails and the list shows as before

---

## Step 18: Forgot password and the Account tab

### Forgot password

- Log in pop-up → "Forgot password?" → enter your email → "Send reset link"
- The message is the same whether or not an account exists ("If an account exists for..."). Saying "no account found" would let anyone check which emails have Encore accounts, a weakness called **account enumeration**
- `supabase.auth.resetPasswordForEmail(email, { redirectTo })` emails a one-time link. Following it:
  - Supabase checks the link, then sends you to `/auth/callback?next=reset&code=...`
  - The callback trades the code for a temporary login (like email confirmation), then sends you to `/?reset=1`, which opens "set a new password"
  - `?next=reset` is only accepted as that exact value, so the link can't be bent into redirecting people somewhere else (an "open redirect")
- With the default email, the link only works in the same browser you requested it from (PKCE, from Step 15). The error message says so if someone opens it elsewhere
- With custom SMTP (which you have), the "Reset password" template is editable. Changing its link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` makes it work on any device; `/auth/confirm` now handles `type=recovery`

### The Account tab (`components/AccountTab.tsx`)

- The email in the header became an **Account** button, which opens the Account tab: your email, the date you joined, and **change password**
- It only exists while logged in. Logging out while on it switches you to the concerts tab
- Room to grow: more account info and stats can go here later

### One password form for both (`components/PasswordForm.tsx`)

- Changing your password and setting one from a reset link are the same action: `supabase.auth.updateUser({ password })` for whoever is logged in. So both use one component
- Type it twice, checked in the browser first for instant feedback (`checkNewPassword` in `lib/passwordRules.ts`); Supabase checks again on its side
- `autoComplete="new-password"` tells password managers this is a new password, so they offer to save it
- Errors go through `friendlyAuthError` (now in `lib/authErrors.ts`, shared with the log in pop-up)

### Requiring the current password (Account tab)

- Changing your password from the Account tab asks for your **current password** first
  - Why: without it, anyone with access to a logged-in browser (a shared computer, an unlocked laptop) could change your password and lock you out
- It's **enforced by Supabase's server**, not just the page: with "Require current password when updating" turned on (Authentication → Sign In / Providers → Email), Supabase rejects any password change whose `current_password` is wrong
  - A check that only happens in the page could be skipped by someone sending requests to Supabase directly. A server-side check can't be
  - `updateUser({ password, current_password })` is supported in supabase-js v2.102.0 and newer
- Reset links don't need it: tested with the setting on, the reset flow still works, since clicking the emailed link already proves it's you
- Before building, this was tested first: the documentation didn't say whether reset links were exempt, so a 5-minute manual test answered it. Checking an unknown before writing code is a good habit
- `autoComplete="current-password"` lets password managers fill in the saved password

### Minimum password length

- `MIN_PASSWORD_LENGTH` is 6, because that's the lowest Supabase's hosted service allows. A shorter rule in Encore would only lead to errors from Supabase
- Supabase's own guidance recommends 8 or more, which you can set under Authentication → Providers → Email, and then change `MIN_PASSWORD_LENGTH` to match

---

## Step 19: Mobile pass

### Two header layouts, chosen by width (not device)

- CSS can't tell whether it's on a phone, only how wide the window is. So the switch happens at **900px**, roughly where the full header stops fitting:
  - **900px and wider** (computers, sideways tablets): logo, tabs, and every button in one row
  - **Narrower** (phones, upright tablets around 768–834px): the logo with dark mode and a **☰ menu** in the top right, and the tabs as a full-width bar underneath
- Both layouts are in the page, and a `@media (max-width: 899px)` rule shows whichever fits. Rotating a tablet or resizing a window switches instantly, with nothing to reload
- The switch point is based on the widest version of the header (logged in, with "Spotify connected," "Account," and "Log out")

### The ☰ menu (`components/HeaderMenu.tsx`)

- Holds Spotify (connect, or connected / disconnect), Account, and Log in or Log out, with your email at the top
- Closes when you pick something, press Escape, or tap outside it
  - "Outside" is detected with a `pointerdown` listener on the whole window and `.contains()`, which checks whether the tap landed inside the menu
  - The listeners are only attached while the menu is open, and removed in the effect's cleanup
- `aria-expanded` and `role="menu"` describe the menu to screen readers

### Keeping two theme buttons in sync (`ThemeToggle.tsx`)

- Each header layout has its own dark mode button. If each kept its own state, switching in one would leave the other showing the wrong icon
- So both read the theme straight from `<html data-theme>`, using **`useSyncExternalStore`** (React's way of reading something outside React) with a **`MutationObserver`** (the browser's way of watching an element for changes)

### Pinned playlist builder header

- "make a playlist," Close (or Cancel), and the Create button stay at the top of the pop-up while the song list scrolls, using `position: sticky`
- Sticky elements need a solid background (`--card-solid`) so the scrolling list doesn't show through

### Long song names and phone-sized cards

- Song cards are never wider than their tier (`max-width: min(280px, 100%)`)
- Long names wrap onto a second line; beyond two lines, they end with "…" (`-webkit-line-clamp: 2`)
- On phones, cards fill their tier, one per row
- Search results and the "Change" panel wrap their buttons onto a new line instead of cutting them off

### Touch target sizes

- Apple recommends at least 44×44 points, Google 48×48, and the web accessibility standard (WCAG 2.2) sets 24×24 as its minimum and 44×44 as its higher level
- On touch screens, buttons, tabs, and menu items are at least 44px tall
- These use **`@media (pointer: coarse)`** ("is the main pointer a finger?") instead of screen width, since a sideways iPad is wide but still touch, and a narrow desktop window is narrow but still a mouse
- The S/A/B/C/D buttons are 44px tall and share the card's width; on a phone that's about 36px each, since five of them have to fit side by side

---

## Step 20: Automated tests and continuous integration

### Running the tests

- `npm test` runs every test once. `npm run test:watch` keeps watching, and re-runs tests every time you save
- `npm run typecheck` checks all the TypeScript, and `npm run lint` runs ESLint
- Tests live next to the code they test: `lib/songs.ts` → `lib/songs.test.ts`

### How a test reads

- `describe("countSongs", ...)` groups related tests
- `it("counts each song once per concert...", ...)` is one test, named after the behavior it checks, so a failure reads like a sentence
- `expect(actual).toBe(expected)` fails the test if they don't match. `toEqual` compares the contents of arrays and objects; `toBeLessThan`, `toMatch`, and `toBeNull` check other kinds of conditions

### What's tested, and why these

- Only the **pure functions** in `lib/`: data in, data out, so no browser, Spotify, or database is needed. That's the payoff of keeping logic separate from UI and API calls
- 42 tests across songs (counting, medleys, artist order), matching scores, title cleaning, setlist.fm conversion and dates, tier logic, and sign-up rules
- **Regression tests** pin down bugs that were already found and fixed, so they can't quietly come back:
  - Medleys counted as one unmatchable song
  - March 14 showing as March 13 in Toronto's time zone
  - `mgail.com` being accepted
- **Proof the date test works**: with `formatDate` deliberately broken back to `new Date("2025-03-14")`, the test failed; with the fix restored, it passed. A test is only useful if it can fail
- `vitest.config.mts` runs every test in Toronto's time zone, so date tests behave the same on every computer, including GitHub's servers (which use UTC)

### Continuous integration (`.github/workflows/ci.yml`)

- On every push, GitHub starts a fresh Linux machine, installs Node 22 and your packages (`npm ci`, which installs exactly the versions in `package-lock.json`), then runs lint, the type check, and the tests
- The result appears as a green check or red X next to each commit, and on pull requests. If you break something, you find out within minutes, even if you forgot to run the tests yourself
- See the runs under your repository's **Actions** tab

---

## Step 21: Migrations and generated types

### Migrations: version history for the database

- Each change to the database's structure is one SQL file in `supabase/migrations/`, named with a timestamp so they sort in order:
  - `20260930000000_initial_schema.sql`: the original tables and security rules (formerly `schema.sql`)
  - `20261001000000_tour_and_playlists.sql`: tour names and the playlists table (formerly `update-002.sql`)
- Supabase keeps a table recording which migrations each database has already run. `npm run db:push` runs only the new ones, in order
- A brand new database (like a production one for launch) is built by running every migration from the start, so it ends up identical
- The files are in Git, so each commit records what the database looked like at that point
- Git tracks your code's history; migrations track your database structure's history (not the data in it)

### Bringing an existing database in line

- Your database already had both changes (pasted by hand), so running them again would fail with "already exists"
- `npx supabase migration repair --status applied <timestamps>` tells Supabase "these already ran" without running them
- `npx supabase migration list` shows each migration's status locally and on the database; both columns should match

### The new workflow for database changes

- `npm run db:new add_something`: creates an empty, timestamped migration file to write the SQL in
- `npm run db:push`: applies it to the linked database
- `npm run db:types`: regenerates `lib/database.types.ts` from the real database
- Never edit a migration that has already been pushed; write a new one instead. Other databases may have already run the old version

### Generated types (`lib/database.types.ts`)

- The Supabase CLI reads the real database and writes a TypeScript description of every table and column: what you get back when reading (`Row`), and what you can send when adding (`Insert`) or changing (`Update`) a row
- Both Supabase clients use it (`createBrowserClient<Database>`), and `lib/db.ts` adds short names: `Row<"concerts">`, `Insert<"concerts">`, and `EncoreSupabase`
- What TypeScript now catches before anything runs (each was tested by introducing the typo on purpose):
  - A misspelled table: `from("concert")` → "not assignable to `concerts | custom_lists | live_tiers | playlists`"
  - A misspelled column when reading: `r.artst` → "Did you mean 'artist'?"
  - A misspelled column when saving: `{ artst: ... }` → "Did you mean to write 'artist'?"
- One limit: column names inside filters and sorting (like `.order("added_at")`) are plain strings, so a typo there isn't caught
- JSON columns (`songs`, `tiers`, `items`) can hold any JSON, so the types only know them as `Json`. The code states their real shape when reading (`as unknown as Song[]`); that's the one place the types have to be trusted
- The hand-written row types that used to be in `accountData.ts` are gone, so there's one source of truth: the database itself
- `database.types.ts` is regenerated, never edited by hand, so the short names live in a separate file (`db.ts`) that survives regeneration

---

## Step 22: The shared match table

### The idea

- When you make a playlist, the Spotify track used for each song counts as your **vote** for it (matches you left as-is count too, since you reviewed them; skipped songs don't)
- Once **2 or more people** agree on a track for a song, with no tie, it becomes the **shared match**, and everyone's matching uses it instead of searching Spotify
- So a fix spreads: once a couple of people correct a bad match, nobody else hits it. And matching gets faster as Encore is used more, with fewer Spotify requests

### The database (`supabase/migrations/20261003000000_shared_matches.sql`)

- `match_votes`: one row per person per song (`primary key (user_id, song_key)`). Picking a different track later *moves* your vote, so one person can't vote twice
- It stores the track's name, artist, and album too, so a shared match can be shown without asking Spotify
- An **index** on `song_key` makes "all votes for these songs" fast, like a book's index lets you jump to a topic instead of reading every page
- **Row Level Security**: you can only see and change your own votes, so nobody can find out which songs someone else has heard live

### Counting votes safely: `get_shared_matches`

- A database function, called from the app with `supabase.rpc("get_shared_matches", { song_keys })`
- It's `security definer`: it runs with the database owner's permissions, so it can count *everyone's* votes even though each user can only read their own. That's safe because it only ever returns totals, never who voted
- `set search_path = ''` is a standard safety habit for such functions: every table is written in full (`public.match_votes`), so nothing else can be swapped in
- How it picks a winner, in SQL:
  - `count(*) ... group by song_key, track_id`: votes per track, per song
  - `rank() over (partition by song_key order by votes desc)`: 1 for the most-voted track of each song. **Window functions** like `rank() over (...)` calculate across groups of rows without collapsing them
  - `count(*) over (partition by song_key, votes)`: how many tracks share that vote count. More than 1 means a tie
  - Kept only when it's first place, not tied, and has at least 2 votes
- Tested in an in-memory Postgres database (PGlite) with sample votes: 2 votes for one track → shared; a single vote → not shared; a 2–2 tie → not shared; 3–1 → the winner with 3

### Who can do what

- **Everyone, including guests**, can use shared matches
- **Only logged-in users** can vote. Accounts need confirmed real emails, so pushing a bad match alone would take two real inboxes, and real users' votes can still outnumber it

### Which match a song uses (`resolveKnownMatch`, tested)

- In order: a track the song came with (custom list songs from Spotify), then **your own earlier choice**, then the **shared match**, then a normal Spotify search
- Shared matches show "Confirmed by N people" in the review screen. Changing one makes it your own choice
- Votes are saved in the background after the playlist is created, so if saving fails, your playlist is still made
- If the shared table can't be reached, matching simply searches Spotify as before: shared matches are a bonus, never a requirement

### Applying it (the new migration workflow)

- `npm run db:push` applies the new migration to your database, then `npm run db:types` regenerates the types (now including `match_votes` and the function)

---

## Step 23: Adding songs setlist.fm missed

### What it's for

- Songs you heard that aren't in setlist.fm's setlist, like 5SOS's secret song on the Everyone's a Star Tour (chosen the day of each show), an encore someone forgot, or a whole setlist for a concert marked "no setlist yet"

### How it works for you

- **Your concerts** → **"+ Add a song"** on any concert
- **Search Spotify** (when connected) and pick the exact track, or **add it as typed** for songs that aren't on Spotify (like an unreleased secret song)
- Added songs appear at the end of the setlist with an **"added by you"** label and a remove link. Songs from setlist.fm can't be removed
- They count everywhere: the Songs tab, tier lists, and playlists

### How it's built

- **No database change**: each saved concert already stores its song list as JSON, so added songs join that list with `addedByYou: true`. Saving uses a new `updateConcertSongs` (Supabase) and `updateConcert` action (in `useEncoreData`)
- **Pure functions, tested** (`addSongToConcert` and `removeAddedSong` in `lib/songs.ts`):
  - Duplicates are refused, including songs inside a medley entry ("Teeth" is already in "Easier / Teeth")
  - A track by a different artist than the performer is recorded as a cover, the same way setlist.fm marks covers
  - Both return new concert objects instead of changing the old one
- **Songs added from Spotify keep their track ID** (`spotifyId`), which carries through `countSongs`, so playlists use that exact track instead of searching
- **Added songs are never split** like medleys, since you chose exactly one song (even if its name contains " / ")

---

## Step 24: Recommendations (the discover tab)

### The approach: content-based recommendation

- Recommend artists **similar to the ones you already like**. It works from day one, even with a single user
- Spotify removed its related-artists and recommendations features from its API for new apps in late 2024, so Encore builds its own, using **Last.fm's similar-artists data** (based on millions of people's listening) through `/api/recommendations`, which keeps the Last.fm key on the server and caches answers for a day

### The math (`lib/recommend.ts`, all tested)

- **Step 1: your taste profile.** Every artist you know gets points:
  - Each of their songs in your tiers (live and custom lists): S = 5, A = 4, B = 3, C = 2, D = 1
  - Plus 1 point per concert of theirs you've been to
  - These are **explicit signals** (rankings you chose) and **implicit signals** (what your behavior shows, like going to a band's shows three times). Designing and weighting signals is a core recommender-systems skill
- **Step 2: seeds.** Your top 8 artists by points
- **Step 3: candidates.** For each seed, Last.fm returns similar artists with a similarity from 0 to 1. A candidate's score is the sum of (seed's points × similarity) over every seed that points to it, so artists similar to *several* of your favorites rise to the top
- **Worked example** (also a test):
  - 5SOS: 3 S + 2 A + 3 concerts = 3 × 5 + 2 × 4 + 3 × 1 = 15 + 8 + 3 = **26**
  - Bruno Mars: 1 S + 2 B + 1 concert = 1 × 5 + 2 × 3 + 1 × 1 = 5 + 6 + 1 = **12**
  - Candidate A (0.9 to 5SOS, 0.2 to Bruno Mars): 26 × 0.9 + 12 × 0.2 = 23.4 + 2.4 = **25.8**
  - Candidate B (0.3 to 5SOS, 0.8 to Bruno Mars): 26 × 0.3 + 12 × 0.8 = 7.8 + 9.6 = **17.4**
- Artists you've already seen or ranked are skipped, so every suggestion is new
- Each suggestion's **reason** names the seed that contributed the most points (5SOS gave 23.4 of Candidate A's 25.8), described by your strongest signal ("Because you ranked 3 songs by 5SOS in S tier")
- The tab shows which artists it's based on, with their points: **explainable** recommendations are easier to trust, and easier to debug

### Evaluating it

- A recommender is only as good as its measurement. The simplest offline check is a **hold-out test**: hide something you know the user likes, and see if the recommendations find it
- `recommend.test.ts` does a miniature version: remove Bruno Mars from the profile, and check he comes back as the top recommendation from the artists that remain
- With real data, this scales up: hide each of a user's favorite artists in turn, and measure how often it appears in the top 10 (called **hit rate @ 10**)

### What's next for it (stage 2)

- **Collaborative filtering**: "people who saw the same shows as you also saw ___," using Encore's own users. It finds connections that similarity data can't, but needs many users to work, a limitation called the **cold start problem**

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
  - Press Escape mid-drag: the song should go back where it was
  - Remove a concert and check that its songs disappear from the tiers
  - Try it on your phone (press and hold to drag)
- **Polish**
  - Click "Encore" (the page reloads), switch dark mode on and off, and refresh (your choice is remembered)
  - Type an artist slowly and quickly, then delete it: results should follow along and clear
  - Check that concerts with tours show the yellow tour pill
- **Round 2 fixes**
  - Disconnect and reconnect Spotify while on `127.0.0.1:3000`: you should land back on `127.0.0.1`
  - Try signing up with `@mgail.com`: it should be refused with a clear message
  - Sign up with a real email, click the link in the email, and you should arrive logged in
  - Start a playlist and click the dimmed background (nothing happens), then Cancel (asks first)
  - Check that a "songs heard live" playlist is grouped by artist in Spotify
- **Playlists**
  - Songs tab → Make a playlist: watch the progress, then review. Try Change, Skip, and searching for a not-found song. Create it and open it in Spotify
  - Rank tab → Make a playlist → pick S and A → create
  - Make a second playlist from the same songs: matching should be almost instant (cached)
  - Note your match rate, and which kinds of songs weren't found
- **Accounts**
  - As a guest, add a couple of concerts and rank a few songs, then sign up: the green banner should appear, and your data should still be there
  - Refresh: still logged in, with the same data
  - Log out: you're back to an empty guest session (the guest data moved into the account)
  - Open the site in a different browser (or a private window), log in, and check your data is there
  - Rank a song and log out within a second: after logging back in, the change should be saved
  - In Supabase's Table Editor, look at your rows in `concerts`, `live_tiers`, and `custom_lists`
- **Custom lists**
  - Connect Spotify, create a list, and add a full discography of an artist you know well
    - Look for duplicates that got through (like a song appearing twice with different titles), and songs that shouldn't have merged
  - Add a single album with "Choose albums," and a single song with the Song search
  - Remove songs with ×, create a second list, switch between them, and delete one

---

## Known limitations (on purpose, for now)

- Guest data lives in one browser only (and one address: `localhost` and `127.0.0.1` count as different sites). Accounts fix this
- Supabase's built-in email sender is for testing only; connect a custom email provider before real users sign up
- If the same account is open in two tabs, the last save wins (changes in one tab don't appear in the other until refresh)
- Search needs an artist name. You can't search by venue or date alone
- Playlists are always new (updating an existing playlist isn't supported yet), and always private
- Search-as-you-type uses more of setlist.fm's 1,440 daily requests than a search button did
- Search results are 20 per page, newest first, so older shows may need "Load more" or filters
- Name normalizing catches small differences but not bigger ones like "Pt. 2" vs "Part 2"
- Discographies are capped at 60 releases, so very prolific artists may be missing some older songs
- Reordering inside "Unranked" isn't saved, since unranked songs are always listed in their original order
- Spotify: development mode allows up to 5 allowlisted users, and Spotify has been changing its API rules this year, so endpoints may change again
- Styling is a rough first pass: no dark/light toggle, no animations beyond basics, and some screens (like errors) are plain

---

## What comes next

- **Phase 2: Supabase accounts** (done)
- **Phase 3: Spotify playlists** (done)
  - The shared match table (done): one person's fix helps everyone, once 2+ people agree
  - Remember Spotify's current limits: the app owner needs Premium, and dev mode allows 5 users
- **Phase 4: the AI agent**
  - Finds songs that normal matching missed, with the user confirming every suggestion
  - Python/Strands vs. TypeScript decision still to be made

---

## Interview talking points

- **The client/server split**: why the setlist.fm key lives only in an API route
- **Deriving vs. storing data**: song counts are calculated from concerts rather than saved, so they can never go out of sync
- **Choosing tiers over pairwise ranking, using math**: any pairwise method needs at least log₂(n!) comparisons (about 525 for 100 songs), while tiers need n decisions
- **Drag and drop across multiple lists**: a temporary drag state that's only saved on drop, plus accessibility through keyboard sensors
- **OAuth done securely**: the authorization code flow, CSRF protection with `state`, httpOnly cookies, and automatic token refresh
- **Song matching with a scoring system**: multiple search strategies, a score for title, artist, and version, automatic thresholds, and a measured match rate
- **Versioned database migrations and generated types**: a reproducible schema, and typos caught at compile time
- **Automated tests and CI**: 42 tests on the core logic, regression tests for real bugs, and checks on every push
- **Resilience to flaky APIs**: retries with exponential backoff, isolating failures per song, and separating "failed" from "not found"
- **Race conditions in search-as-you-type**: debouncing plus cancelling stale requests with `AbortController`
- **A recommender system**: explicit and implicit signals, weighted similarity scoring, explainable reasons, and a hold-out evaluation
- **A crowdsourced match table with privacy**: votes hidden by RLS, totals exposed through a security definer function, and a tie-aware winner picked with SQL window functions
- **Database security with Row Level Security**: why a public key is safe when Postgres enforces per-user access rules
- **Designing an idempotent data migration**: merging guest data safely even when it runs twice
- **Optimistic updates with debounced saves**, plus flushing pending saves before logout
- **Debugging a drag-and-drop feedback loop**: layout shifts re-triggering moves, fixed by freezing the drop target for one animation frame
- **Deduplicating messy music catalog data**: filtering release types, cleaning version labels with regular expressions, and letting the original release win
- **Working within API limits**: 1,440 requests/day shaped the decision to store setlist snapshots
- **Text normalization for matching**: merging near-duplicate song names, and its limitations
