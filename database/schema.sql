-- Verdikt Database Baseline Schema
-- Target: MySQL 8.0+ | Database: verdikt_db

CREATE DATABASE IF NOT EXISTS verdikt_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE verdikt_db;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36)        NOT NULL,
    username        VARCHAR(50)     NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    avatar_url      VARCHAR(512)    NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- media_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_items (
    id              CHAR(36)        NOT NULL,
    external_id     VARCHAR(255)    NOT NULL,
    media_type      ENUM('MOVIE', 'SERIES', 'ANIME', 'GAME', 'BOOK') NOT NULL,
    title           VARCHAR(512)    NOT NULL,
    release_year    INT             NULL,
    cover_image     VARCHAR(512)    NULL,
    backdrop_image  VARCHAR(512)    NULL,
    description     TEXT            NULL,
    trailer_url     VARCHAR(512)    NULL,
    creators_json   JSON            NULL,
    genres_json     JSON            NULL,
    platforms_json  JSON            NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_media_external_type (external_id, media_type),
    KEY idx_media_type (media_type),
    KEY idx_media_title (title(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id                  CHAR(36)    NOT NULL,
    user_id             CHAR(36)    NOT NULL,
    media_item_id       CHAR(36)    NOT NULL,
    verdict             ENUM('PERFECTION', 'GO_FOR_IT', 'TIMEPASS', 'SKIP_IT') NOT NULL,
    content             TEXT        NOT NULL,
    contains_spoilers   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_reviews_user_media (user_id, media_item_id),
    KEY idx_reviews_media_item (media_item_id),
    KEY idx_reviews_verdict (verdict),

    CONSTRAINT fk_reviews_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_reviews_media_item
        FOREIGN KEY (media_item_id) REFERENCES media_items (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
