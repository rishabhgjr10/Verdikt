-- Verdikt migration: stored weekly homepage selections (Editor's Pick, Worth Your Time To Read, platform shelves).
-- Target: MySQL 8.0+ | Database: verdikt_db
-- Hibernate creates this on its own while HIBERNATE_DDL_AUTO=update (the default); apply by hand only when it is
-- set to validate/none. Apply once.
--
-- Weeks start Monday 00:00 Asia/Kolkata (week_start is that Monday's date). The app writes AUTO rows only.
-- To hand-curate a week, insert a MANUAL row for the section and week; it is served instead of the AUTO row and
-- the app never changes it. picks_json/pool_json hold a JSON array of objects with: externalId, mediaType
-- (MOVIE/SERIES/ANIME/BOOK), title, releaseYear, releaseDate, coverImage, voteAverage, voteCount, href.

CREATE TABLE IF NOT EXISTS weekly_picks (
    id           VARCHAR(36) NOT NULL,
    section      VARCHAR(40) NOT NULL,
    week_start   DATE        NOT NULL,
    source       VARCHAR(10) NOT NULL,
    picks_json   JSON        NOT NULL,
    pool_json    JSON        NOT NULL,
    refreshed_at DATETIME(6) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_weekly_picks (section, week_start, source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
