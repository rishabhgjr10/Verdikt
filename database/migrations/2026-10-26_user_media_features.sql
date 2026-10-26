-- Verdikt migration: user media state, collections (incl. Watch History),
-- media release dates and external-ratings cache columns.
-- Target: MySQL 8.0+ | Database: verdikt_db
-- Apply once. Id/FK columns are CHAR(36) to match users.id / media_items.id.

-- ---------------------------------------------------------------------------
-- user_media_state: per-user watched / watch-later flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_media_state (
    id              CHAR(36)    NOT NULL,
    user_id         CHAR(36)    NOT NULL,
    media_id        CHAR(36)    NOT NULL,
    watched         BOOLEAN     NOT NULL DEFAULT FALSE,
    watched_at      DATETIME(6) NULL,
    watch_later     BOOLEAN     NOT NULL DEFAULT FALSE,
    watch_later_at  DATETIME(6) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_ums_user_media (user_id, media_id),
    KEY idx_ums_watch_later (watch_later, watch_later_at),
    KEY idx_ums_media (media_id),

    CONSTRAINT fk_ums_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ums_media FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- collections: user collections; one locked system collection per type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
    id           CHAR(36)     NOT NULL,
    user_id      CHAR(36)     NOT NULL,
    name         VARCHAR(60)  NOT NULL,
    description  VARCHAR(280) NULL,
    is_public    BOOLEAN      NOT NULL DEFAULT FALSE,
    is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
    system_type  VARCHAR(20)  NULL,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uk_collections_user_name (user_id, name),
    -- NULL system_type is allowed many times; each system type at most once per user
    UNIQUE KEY uk_collections_user_system (user_id, system_type),
    CONSTRAINT chk_collections_system_type CHECK (system_type IS NULL OR system_type = 'WATCH_HISTORY'),

    CONSTRAINT fk_collections_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS collection_items (
    collection_id CHAR(36)    NOT NULL,
    media_id      CHAR(36)    NOT NULL,
    added_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (collection_id, media_id),
    KEY idx_ci_media (media_id),

    CONSTRAINT fk_ci_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_media FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- media_items: release date (future calendar queries) + ratings cache
-- ---------------------------------------------------------------------------
ALTER TABLE media_items
    ADD COLUMN release_date       DATE        NULL,
    ADD COLUMN imdb_id            VARCHAR(20) NULL,
    ADD COLUMN ratings_json       JSON        NULL,
    ADD COLUMN ratings_fetched_at DATETIME(6) NULL,
    ADD KEY idx_media_release_date (release_date);

-- ---------------------------------------------------------------------------
-- Backfill: Watch History for users who already have watched rows
-- (no-op on a fresh install; the app also creates it lazily)
-- ---------------------------------------------------------------------------
INSERT INTO collections (id, user_id, name, is_public, is_system, system_type)
SELECT UUID(), s.user_id, 'Watch History', FALSE, TRUE, 'WATCH_HISTORY'
FROM (SELECT DISTINCT user_id FROM user_media_state WHERE watched = TRUE) s
WHERE NOT EXISTS (
    SELECT 1 FROM collections c WHERE c.user_id = s.user_id AND c.system_type = 'WATCH_HISTORY'
);

INSERT IGNORE INTO collection_items (collection_id, media_id, added_at)
SELECT c.id, s.media_id, COALESCE(s.watched_at, CURRENT_TIMESTAMP(6))
FROM user_media_state s
JOIN collections c ON c.user_id = s.user_id AND c.system_type = 'WATCH_HISTORY'
WHERE s.watched = TRUE;
