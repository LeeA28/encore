// Fake responses for Encore's API routes, so browser tests don't depend on setlist.fm, Spotify,
// Last.fm, or Ticketmaster. page.route() intercepts the browser's requests before they leave.

import { test as base, type Page } from "@playwright/test";

const concert = (id: string, date: string, city: string, songs: string[]) => ({
  id,
  date,
  artist: "5 Seconds of Summer",
  venue: "Arena",
  city,
  country: "Canada",
  tour: "EVERYONE'S A STAR! World Tour",
  url: `https://www.setlist.fm/${id}`,
  songs: songs.map((name) => ({ name })),
});

export const FAKE_CONCERTS = [
  concert("show1", "2026-08-05", "Toronto", ["Amnesia", "Bad Omens", "Boyband"]),
  concert("show2", "2026-07-04", "Vancouver", ["Amnesia", "Easier"]),
];

export async function fakeApis(page: Page) {
  await page.route("**/api/search?**", (route) =>
    route.fulfill({ json: { concerts: FAKE_CONCERTS, page: 1, hasMore: false } })
  );
  await page.route("**/api/spotify/status", (route) => route.fulfill({ json: { connected: false } }));
  await page.route("**/api/recommendations", (route) => route.fulfill({ json: { similar: {} } }));
  await page.route("**/api/recommendations/bands", (route) => route.fulfill({ json: { exclude: { ids: [], names: [] }, memberOf: {} } }));
}

// Every test starts with the fake APIs in place, and a fresh, empty browser (Playwright gives each test its own)
export const test = base.extend<{ fake: void }>({
  fake: [
    async ({ page }, use) => {
      await fakeApis(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

// Search for the artist and add both fake concerts to Your concerts
export async function addBothConcerts(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Start typing an artist").fill("5 Seconds of Summer");
  await page.getByRole("button", { name: "I was there" }).first().click();
  await page.getByRole("button", { name: "I was there" }).first().click();
}

// Click a tab in whichever header layout is showing (the wide one, or the phone-sized bar)
export async function openTab(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).filter({ visible: true }).first().click();
}
