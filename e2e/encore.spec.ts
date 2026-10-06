// Browser tests: the main flows a guest goes through, in a real browser (desktop and phone sizes)

import { test, expect, addBothConcerts, openTab } from "./fixtures";

test("searching and adding concerts, which survive a refresh", async ({ page }) => {
  await addBothConcerts(page);
  await expect(page.getByRole("heading", { name: "your concerts" })).toBeVisible();
  await expect(page.locator(".concert-card.selected")).toHaveCount(4); // 2 in results + 2 in Your concerts

  await page.reload(); // saved in the browser, so they're still there
  await expect(page.locator(".concert-card.selected")).toHaveCount(2);
});

test("the songs tab counts songs across concerts", async ({ page }) => {
  await addBothConcerts(page);
  await openTab(page, "songs");
  await expect(page.getByText("2 concerts")).toBeVisible();
  await expect(page.getByText("4 different songs")).toBeVisible();
  // Amnesia was played at both shows
  await expect(page.locator(".song-row").first()).toContainText("Amnesia");
  await expect(page.locator(".song-row").first()).toContainText("2×");
});

test("making a saved list shows only its concerts' songs", async ({ page }) => {
  await addBothConcerts(page);
  await openTab(page, "songs");
  await page.getByRole("button", { name: "+ New list" }).click();
  await page.getByPlaceholder('List name (like "2026")').fill("Vancouver");
  await page.getByRole("checkbox").nth(1).check(); // the older show (Vancouver), since the list is newest first
  await page.getByRole("button", { name: "Create list" }).click();

  await expect(page.getByText("2 different songs")).toBeVisible(); // Amnesia and Easier
  await expect(page.locator(".song-row")).toHaveCount(2);
});

test("placing a song in a tier with the quick S button", async ({ page }) => {
  await addBothConcerts(page);
  await openTab(page, "rank");
  const unranked = page.locator(".tier-row").last();
  await unranked.locator(".song-chip").first().getByRole("button", { name: "S", exact: true }).click();
  await expect(page.locator(".tier-row").first().locator(".song-chip")).toHaveCount(1);
});

test("dark mode is remembered", async ({ page }) => {
  await page.goto("/");
  await page.locator(".icon-btn[aria-label*='dark mode']").filter({ visible: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the phone menu opens and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the ☰ menu only appears on narrow screens");
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Log in" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Log in" })).toBeHidden();
});

test("dragging a song from unranked into a tier", async ({ page, isMobile }) => {
  test.skip(isMobile, "phones use press-and-hold to drag; the mouse version is tested on desktop");
  // A tall window, so the unranked songs and tier A are both on screen (mouse positions only work on screen)
  await page.setViewportSize({ width: 1280, height: 1600 });
  await addBothConcerts(page);
  await openTab(page, "rank");

  const song = page.locator(".tier-row").last().locator(".song-chip").first();
  const tierA = page.locator(".tier-row").nth(1); // S is first, then A
  const from = (await song.boundingBox())!;
  const to = (await tierA.boundingBox())!;

  // Press, move in small steps (the drag starts after 5px of movement), then release over tier A
  await page.mouse.move(from.x + 20, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 25, { steps: 5 });
  await expect(page.locator(".song-chip.lifted")).toBeVisible(); // the floating copy means the drag started
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  await expect(tierA.locator(".song-chip")).toHaveCount(1);
});

test("the playlist builder reopens after returning from connecting Spotify", async ({ page }) => {
  await addBothConcerts(page);

  // Pretend we just came back from Spotify's login: connected now, with a note saying a
  // playlist of all songs was being made (what the builder saves before leaving)
  await page.route("**/api/spotify/status", (route) => route.fulfill({ json: { connected: true } }));
  await page.route("**/api/spotify/match", (route) =>
    route.fulfill({ json: { results: [] } }) // matching isn't what this test is about
  );
  await page.evaluate(() =>
    sessionStorage.setItem("encore:resumePlaylist", JSON.stringify({ kind: "songs", listId: "all" }))
  );
  await page.goto("/?tab=songs");

  await expect(page.getByRole("heading", { name: "make a playlist" })).toBeVisible();
  // ...and only once: the note is cleared, so a refresh doesn't reopen it
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("encore:resumePlaylist"))).toBeNull();
});
