package com.verdikt.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Per-user watched / watch-later / favorite flags for one media item.
 * Invariant (enforced in UserMediaService): watched and watchLater are never both true.
 */
@Entity
@Table(
        name = "user_media_state",
        uniqueConstraints = @UniqueConstraint(name = "uk_ums_user_media", columnNames = {"user_id", "media_id"}),
        indexes = {
                @Index(name = "idx_ums_watch_later", columnList = "watch_later, watch_later_at"),
                @Index(name = "idx_ums_media", columnList = "media_id")
        }
)
public class UserMediaState {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "CHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, updatable = false, columnDefinition = "CHAR(36)")
    private UUID userId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "media_id", nullable = false, updatable = false, columnDefinition = "CHAR(36)")
    private UUID mediaId;

    @Column(name = "watched", nullable = false)
    private boolean watched;

    @Column(name = "watched_at")
    private Instant watchedAt;

    @Column(name = "watch_later", nullable = false)
    private boolean watchLater;

    @Column(name = "watch_later_at")
    private Instant watchLaterAt;

    // Independent of watched/watch-later; the default backfills rows that existed before the column
    @Column(name = "favorite", nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
    private boolean favorite;

    @Column(name = "favorited_at")
    private Instant favoritedAt;

    public UserMediaState() {
    }

    public UserMediaState(UUID userId, UUID mediaId) {
        this.userId = userId;
        this.mediaId = mediaId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getMediaId() {
        return mediaId;
    }

    public boolean isWatched() {
        return watched;
    }

    public void setWatched(boolean watched) {
        this.watched = watched;
    }

    public Instant getWatchedAt() {
        return watchedAt;
    }

    public void setWatchedAt(Instant watchedAt) {
        this.watchedAt = watchedAt;
    }

    public boolean isWatchLater() {
        return watchLater;
    }

    public void setWatchLater(boolean watchLater) {
        this.watchLater = watchLater;
    }

    public Instant getWatchLaterAt() {
        return watchLaterAt;
    }

    public void setWatchLaterAt(Instant watchLaterAt) {
        this.watchLaterAt = watchLaterAt;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public Instant getFavoritedAt() {
        return favoritedAt;
    }

    public void setFavoritedAt(Instant favoritedAt) {
        this.favoritedAt = favoritedAt;
    }
}
