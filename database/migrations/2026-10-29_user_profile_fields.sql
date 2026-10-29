-- Verdikt migration: editable profile fields on users.
-- Target: MySQL 8.0+ | Database: verdikt_db
-- Hibernate adds these on its own while HIBERNATE_DDL_AUTO=update (the default); apply by hand only when it is
-- set to validate/none. Apply once.

ALTER TABLE users
    ADD COLUMN first_name    VARCHAR(50)  NULL,
    ADD COLUMN last_name     VARCHAR(50)  NULL,
    ADD COLUMN bio           VARCHAR(500) NULL,
    ADD COLUMN instagram_url VARCHAR(255) NULL,
    ADD COLUMN x_url         VARCHAR(255) NULL,
    ADD COLUMN youtube_url   VARCHAR(255) NULL;

-- Uploaded profile photos (256px JPEGs re-encoded by the server), one per user
CREATE TABLE IF NOT EXISTS user_avatars (
    user_id    VARCHAR(36) NOT NULL,
    image      MEDIUMBLOB  NOT NULL,
    updated_at DATETIME(6) NOT NULL,

    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_avatars_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
