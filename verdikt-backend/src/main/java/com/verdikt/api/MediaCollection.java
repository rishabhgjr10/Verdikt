package com.verdikt.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * A user's named collection of media. System collections (e.g. Watch History)
 * are created and maintained by the app and are read-only through the API.
 */
@Entity
@Table(
        name = "collections",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_collections_user_name", columnNames = {"user_id", "name"}),
                @UniqueConstraint(name = "uk_collections_user_system", columnNames = {"user_id", "system_type"})
        }
)
public class MediaCollection {

    public static final String SYSTEM_WATCH_HISTORY = "WATCH_HISTORY";
    public static final String WATCH_HISTORY_NAME = "Watch History";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "CHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, updatable = false, columnDefinition = "CHAR(36)")
    private UUID userId;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @Column(name = "description", length = 280)
    private String description;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(name = "is_system", nullable = false, updatable = false)
    private boolean isSystem;

    @Column(name = "system_type", length = 20, updatable = false)
    private String systemType;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public MediaCollection() {
    }

    public static MediaCollection userCollection(UUID userId, String name, String description, boolean isPublic) {
        MediaCollection c = new MediaCollection();
        c.userId = userId;
        c.name = name;
        c.description = description;
        c.isPublic = isPublic;
        return c;
    }

    public static MediaCollection watchHistory(UUID userId) {
        MediaCollection c = new MediaCollection();
        c.userId = userId;
        c.name = WATCH_HISTORY_NAME;
        c.isSystem = true;
        c.systemType = SYSTEM_WATCH_HISTORY;
        return c;
    }

    /** Bumps updated_at when only the items changed. */
    public void touch() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isPublic() {
        return isPublic;
    }

    public void setPublic(boolean isPublic) {
        this.isPublic = isPublic;
    }

    public boolean isSystem() {
        return isSystem;
    }

    public String getSystemType() {
        return systemType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
