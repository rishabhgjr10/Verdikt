# Verdikt — Session Summary

Verdikt is an entertainment review app. Verdicts: **Skip / Timepass / Go For It / Perfection**.

| Part | Stack | Location / URL |
|---|---|---|
| Frontend | Next.js 16 (Turbopack), React 19, Tailwind v4 | `verdikt-frontend/` — live at https://verdiikt.vercel.app/ |
| Backend | Spring Boot, MySQL, JWT | `verdikt-backend/` — live at https://verdikt-aegh.onrender.com/api (Render free tier) |
| Repo | GitHub, branch `main` | https://github.com/rishabhgjr10/verdikt.git |

Working rule: changes stay local and uncommitted unless you explicitly ask for a push. One push was made this session, on request (commit `b9573c6`).

---

## 1. Media detail page (`src/app/media/[id]/page.tsx`)

### Hero
- Layout: 3 columns inside `max-w-[1500px]`.
- Poster: fixed 2:3 ratio, never stretched or cropped. On desktop its height is scaled to match the details column. A callback ref with a ResizeObserver sets the width, clamped to 240–340px.
- Center column, top to bottom:
  - Type pill, consensus verdict badge (member majority, else TMDB score) and a "Your verdict" chip.
  - Age rating, date and runtime.
  - Ratings and genre pills.
  - Action row: Favorite (heart), Bookmark (fills violet when the title is in one of your collections) and Share.
  - Tagline, synopsis, then the Director/Writer crew grid with no divider.
- Right column: `MediaActions`, a release card for unreleased titles ("Coming soon · Releases … · In N days") or a "Not streaming in India yet" card, and Watch Online.
- Every "write verdict" entry point goes through one handler. It edits your existing review if you have one, otherwise it scrolls to the composer or opens the modal.

### Below the hero
- **Top Cast:** rail with chevrons in the header, 96px avatars, tighter gaps and fade masks on both edges.
- **Saga Marathon Track** (franchise timeline):
  - Header pill: "X of N Watched • total runtime", plus a "Marathon Next" link.
  - Poster cards with "+N Yrs later" bridge pills between them.
  - A laser rail with watched, current and upcoming nodes, and an "Upcoming" chip.
- **More Like This:** rail that excludes franchise titles. Verdict chips only show when the title has votes.
- **Community Verdicts:** breakdown bar, filter tabs (shown when there are more than 3 reviews) and the composer.

## 2. Action buttons and reviews
- **`MediaActions.tsx`:**
  - Main button: purple "Mark as Watched", which turns into an emerald "✓ Watched".
  - Unreleased titles get an orange **Mark as Interested** toggle. It uses the Watch Later flag.
  - Watch Later uses the new `selected` look when on.
  - The Collections button shows the name of the collection you saved to most recently.
- **`GlassButton.tsx`:** added a `selected` variant.
- **Composer and modal (`ReviewComposer.tsx`, `ReviewModal.tsx`):** no verdict is pre-selected, so the old overwrite bug is gone. Post stays disabled until you pick one. Spoilers is now an iOS-style switch.
- **`ReviewCard.tsx`:** glass card with a "You" badge on your own review.
- **Verdict modal:** Apple-glass redesign, with glowing verdict pills and an inset textarea.

## 3. Homepage (`src/app/page.tsx`)
- **Hero carousel:** 5 slides (Movie, Series, Anime, Book, Games).
  - Games shows a "Coming Soon" overlay on a mesh gradient.
  - Progress-pill timer and chevrons; clicking a slide opens it.
  - The book slide shows a sharp cover over a blurred background.
- **Shelves:** Talk Of The Town and the sidebar on top. Below them, every shelf shows 6 per row:
  - **Editor's Pick:** 6 titles that rotate weekly, with no Shuffle and no See All.
  - **Worth Your Time To Read:** 6 books, with Shuffle.
  - **Netflix / platform shelf:** 12 titles, with Shuffle.
  - **Watch Now:** with Shuffle, plays the trailer in a modal.
- **`src/lib/discovery.ts`:** weekly rotation, plus a fallback book catalog for when Google Books quota runs out.

## 4. Navigation and footer
- **`Navbar.tsx`:**
  - Search results not yet in the database route to `/media/external/{type}/{id}`.
  - Search aliases work, e.g. `tmkoc`.
  - Better background contrast.
- **`Footer.tsx` and `SocialIcons.tsx`:** GitHub and LinkedIn icon links (`src/lib/site.ts`).

## 5. Backend
- **Favorites:**
  - New `favorite` and `favoritedAt` fields on `UserMediaState`.
  - New endpoints `PUT /api/media/{id}/favorite` and `GET /api/me/favorites`, with a matching security rule.
  - Favorites are shown on the profile.
- **`GoogleBooksService`:** 24h in-memory cache (max 2,000 entries, failures never cached) to protect the 1,000/day quota.
- **`CollectionItemRepository.findCollectionIdsContaining`:** now ordered by `addedAt desc`, which is what the "last saved collection" label relies on.
- **Tests:** `GoogleBooksServiceCacheTest`, plus additions to `UserMediaFeaturesIntegrationTest`.
  - Running them needs `-Dnet.bytebuddy.experimental=true` and `-Djdk.net.unixdomain.tmpdir=C:/Users/hp/.jdksock`.

## 6. Mobile loading fix (deployed)
**Problem:** content was missing on iOS over Indian mobile data. Two causes:
- The browser called `api.themoviedb.org` and `image.tmdb.org` directly. Those domains are likely blocked on networks such as Jio.
- Earlier 4–6s timeouts failed every first request while Render's free tier woke up, which takes 50–90s.

**Fix** (commit `b9573c6`, pushed to `main`, Vercel deploy succeeded):
- `next.config.ts` rewrites `/tmdb-api/*` to `api.themoviedb.org/3/*` and `/tmdb-img/*` to `image.tmdb.org/*`, so all TMDB traffic goes through the site's own domain.
- `src/lib/tmdb.ts`: the browser uses `/tmdb-api`, and image helpers build `/tmdb-img/...` URLs.
- `src/lib/api.ts`:
  - The axios timeout is now 90s.
  - TMDB image URLs in backend responses are rewritten to `/tmdb-img/`.
- `MostInterested.tsx`: abort timer raised to 90s.
- `PosterImage.tsx`, `about/page.tsx` and `streamingUtils.ts` use `/tmdb-img`.

**Verified on the live site from desktop:**
- 0 direct TMDB requests, 15 proxied data calls and 40 proxied images.
- All 5 hero slides and every shelf load.
- The backend answered in 1.4s.

## 7. Open items
- **Not yet confirmed on a phone over mobile data.**
- Older React lint errors (setState inside effects) were left untouched.
- The backend must be restarted or redeployed for the collection-order change to take effect.
