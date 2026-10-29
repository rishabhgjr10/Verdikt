package com.verdikt.api;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * An uploaded profile photo, already re-encoded by the server to a small square JPEG. Kept apart from users so
 * loading an account never pulls the image bytes.
 */
@Entity
@Table(name = "user_avatars")
public class UserAvatar {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false, updatable = false, columnDefinition = "VARCHAR(36)")
    private UUID userId;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "image", nullable = false, length = 512_000)
    private byte[] image;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserAvatar() {
    }

    public UserAvatar(UUID userId, byte[] image, Instant updatedAt) {
        this.userId = userId;
        this.image = image;
        this.updatedAt = updatedAt;
    }

    public UUID getUserId() {
        return userId;
    }

    public byte[] getImage() {
        return image;
    }

    public void setImage(byte[] image) {
        this.image = image;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
