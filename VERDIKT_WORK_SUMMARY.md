# Verdikt — Work Summary

Date: 2026-10-26 · Scope: local development only

> **Nothing was staged, committed, pushed or deployed.** All changes are uncommitted files on disk.
> No Render settings, production environment variables or the production database were touched.
> No API keys, `.env` or `application-local.properties` contents were read or printed.

---

## How to run locally

| Part | Command / notes |
|---|---|
| Frontend | `cd verdikt-frontend && npm run dev` → http://localhost:3000 (Next.js 16, Turbopack) |
| Backend | `cd verdikt-backend && ./mvnw.cmd spring-boot:run "-Dspring-boot.run.jvmArguments=-Djdk.net.unixdomain.tmpdir=C:/Users/hp/.jdksock"` → :8080 |
| Backend tests | Also need `JDK_JAVA_OPTIONS=-Dnet.bytebuddy.experimental=true` (Byte Buddy on Java 26) |
| Database | Local MySQL `verdikt_db` |

**Why the extra JVM flags:**
- `jdk.net.unixdomain.tmpdir` fixes a Java NIO loopback error on this machine.
- `net.bytebuddy.experimental` lets Mockito/Byte Buddy run on Java 26.

---

## 1. Launching the app

The frontend (Next.js) and backend (Spring Boot + MySQL) were both started locally and confirmed working.

**Problems fixed along the way:**
- **Java NIO loopback error:** fixed with the `jdk.net.unixdomain.tmpdir` flag above.
- **Stale Next dev server returning 404s:** fixed by restarting it.

## 2. Login diagnosis

Login was traced end to end (frontend → `/api/auth` → JWT) and the root cause fixed. Local only, nothing deployed.

## 3. Auth-aware navbar and protected actions

- **Navbar:**
  - Logged-out users see Log in / Sign up.
  - While auth is loading, a placeholder holds the space so the layout doesn't jump.
  - Signed-in users see their account menu.
  - Responsive and accessible.
- **Protected actions:** user-only actions send logged-out users to `/login?next=…`. After login they return to where they were.
  - The `next` target is checked: only same-site paths are allowed, so no open redirect.
  - This is handled by `useRequireAuth` in `src/lib/auth-redirect`.

## 4. Library features (large phased task)

### Backend
- **New entities:**
  - `UserMediaState` (watched / watch later)
  - `MediaCollection`
  - `CollectionItem`
- **New controllers:**
  - `UserMediaController`
  - `CollectionController`
  - `MediaInsightsController` (Most Interested)
- **Migration:** `database/migrations/2026-10-26_user_media_features.sql`, applied to the **local** DB only.
- **Rules:**
  - "Watch History" is a reserved collection name.
  - Unwatching a title also deletes your review for it.
  - Marking a title watched removes it from Watch Later.
- **Tests:** 34 passing.

### Frontend components
- `GlassButton`: shared glass-style button, including a `size="hero"` variant.
- `MediaActions`: Mark as Watched, Watch Later and Collections.
  - Updates show instantly and roll back if the server call fails.
- `GlassConfirmDialog`: the "Unwatch Content?" confirmation.
- `CollectionsSheet`: add or remove a title from collections, or create a new one.
- `MostInterested` widget plus `PeriodDropdown`; the full list is at `/most-interested`.
- `/library` page: Watch History, Watch Later and Collections.
- `RatingBadges`: ratings from OMDb (IMDb / Rotten Tomatoes / Metacritic), AniList, RAWG, Open Library and Google Books.
- `ExternalReviews`: reviews pulled from TMDB.
- **Hooks location:** the new hooks live in `src/lib`, because `.gitignore` ignores `src/hooks/`.

## 5. Media detail hero redesign (layout and styling only)

- **Files:**
  - `MediaHeroDetails` component
  - `src/styles/media-hero.css`
  - the hero block in `src/app/media/[id]/page.tsx`
- **Layout:**
  - Poster with the library buttons underneath it, on the left.
  - Title, ratings, creators, description, genres, platforms, then Write a Verdict / Watch Trailer, on the right.
  - On phones it becomes one centred column.
  - Spacing between sections follows an 8px scale. Sections with no data collapse instead of leaving gaps.
  - The hero's left edge lines up with the navbar logo.
- **Still to verify:** after-screenshots for movie, anime, game, book and edge-case titles; a contrast check; and re-tests of the button behaviour. These were cut short by a usage limit.
  - Two local test titles exist for this: `0e0e0e0e-0000-4000-8000-00000000ed01` and `…ed02`.

## 6. Homepage redesign (latest task)

**Files:**
- `verdikt-frontend/src/app/page.tsx`
- `verdikt-frontend/src/lib/tmdb.ts` (new TMDB functions appended)
- `verdikt-frontend/src/lib/discovery.ts` (new)

| # | Requirement | Result |
|---|---|---|
| 1 | Remove Streaming Radar | Gone. Most Interested is now the top sidebar widget. The `StreamingHub` file still exists but is unused. |
| 2 | Balanced "Talk Of The Town" | 15 titles in turn: Indian 4 · Global 4 · Anime 3 · Books 3 · Game 1. If no game is available, an extra Indian title fills the slot. |
| 3 | 🤍 Editor's Pick Of The Week | 5 picks from a 10-title list spanning 1955–2024, mixing Indian and global titles. It switches between two sets of 5 each week. |
| 4 | 📚 Worth Your Time To Read | 5 books from a 10-book list, alternating Indian and global, switching weekly. Shows the original publication year and opens `/media/external/BOOK/[id]`. |
| 5 | Platform shelf with dropdown | Netflix 8, JioHotstar 122, Prime 119, Crunchyroll 283, Sony LIV 237, Apple TV+ 350 (TMDB, region India). Each platform has its own heading, and results are cached so switching back makes no new requests. |

**Verified:**
- Checked in the browser at 1440px and 390px; no horizontal scroll on mobile.
- `npm run build` passes.
- Screenshots were saved to the session scratchpad folder `homepage-verification`.

**Caveats:**
- **Movies/Series blend can't be reached yet:** the 50/50 Indian/global blend is coded, but the homepage has no category tabs (`setCategory` is never called).
- **Books are curated:** Google Books has no trending feed, so the books come from hand-picked lists. Study guides and summaries are filtered out.
- **Book verdict chips can look wrong:** they come from the existing title-hash fallback, so "1984" shows "Skip". This was left unchanged on purpose, per the rules for this task.
- **Existing lint errors:** two pre-existing errors in `page.tsx` (`setState` inside the existing data-loading effects) remain.

---

## Problems solved (all sessions)

- **Java 26 tooling:**
  - NIO loopback error → `unixdomain.tmpdir` flag.
  - Byte Buddy on Java 26 → `net.bytebuddy.experimental` flag.
- **Dev server:**
  - Stale dev server 404s → restart.
  - A CSS edit made with `sed` wasn't picked up → re-saved with a normal edit.
- **Dropdown:** offset by the scrollbar width → positioned with `clientWidth`.
- **Mobile overflow:** fixed.
- **Glass button styling:**
  - Tailwind padding classes clashed → CSS variables `--gb-px` / `--gb-gap`.
  - "In Watch Later" didn't fit on narrow screens → shorter label there.
- **Ratings:**
  - A title match gave a false positive → fixed.
  - IMDb rating format → fixed.
  - Release dates now fill in in the background, without blocking the page.
- **Discovery:**
  - Generic Google Books searches returned books *about* bestsellers → curated title + author lookups.
  - Platform heading was cut off at 390px → it now wraps.

## Open items

1. **Media hero:** finish its verification: screenshots per media type, a contrast check, behaviour re-tests.
2. **Homepage tabs:** add Movies/Series tabs if you want the 50/50 blend to show.
3. **Book verdicts:** decide on a real books rating source so book cards stop showing hash-based chips.
4. **Review and commit:** commit yourself when you're happy. Nothing has been committed.
