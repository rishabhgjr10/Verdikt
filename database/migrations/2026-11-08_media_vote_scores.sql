-- Verdikt migration: TMDB audience score stored on media items (one verdict source for every card).
-- Target: MySQL 8.0+ | Database: verdikt_db
-- Hibernate adds these on its own while HIBERNATE_DDL_AUTO=update (the default); apply by hand only when it is
-- set to validate/none. Apply once. Existing rows fill in lazily (title page and library views backfill them).

ALTER TABLE media_items
    ADD COLUMN vote_average DOUBLE NULL,
    ADD COLUMN vote_count   INT    NULL;
