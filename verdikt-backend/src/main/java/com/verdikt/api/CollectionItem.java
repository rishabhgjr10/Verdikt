package com.verdikt.api;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "collection_items", indexes = @Index(name = "idx_ci_media", columnList = "media_id"))
public class CollectionItem {

    @EmbeddedId
    private Key id;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    public CollectionItem() {
    }

    public CollectionItem(UUID collectionId, UUID mediaId) {
        this.id = new Key(collectionId, mediaId);
        this.addedAt = Instant.now();
    }

    public Key getId() {
        return id;
    }

    public UUID getCollectionId() {
        return id.collectionId;
    }

    public UUID getMediaId() {
        return id.mediaId;
    }

    public Instant getAddedAt() {
        return addedAt;
    }

    @Embeddable
    public static class Key implements Serializable {

        @JdbcTypeCode(SqlTypes.CHAR)
        @Column(name = "collection_id", nullable = false, columnDefinition = "CHAR(36)")
        private UUID collectionId;

        @JdbcTypeCode(SqlTypes.CHAR)
        @Column(name = "media_id", nullable = false, columnDefinition = "CHAR(36)")
        private UUID mediaId;

        public Key() {
        }

        public Key(UUID collectionId, UUID mediaId) {
            this.collectionId = collectionId;
            this.mediaId = mediaId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(collectionId, key.collectionId) && Objects.equals(mediaId, key.mediaId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(collectionId, mediaId);
        }
    }
}
