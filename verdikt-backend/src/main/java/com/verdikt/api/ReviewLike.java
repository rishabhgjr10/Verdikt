package com.verdikt.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** One user's like on one review. Rows go away with their review (DB-level cascade). */
@Entity
@Table(
        name = "review_likes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_review_likes_user_review",
                columnNames = {"user_id", "review_id"}
        )
)
public class ReviewLike {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "VARCHAR(36)")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "review_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Review review;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public ReviewLike() {
    }

    public ReviewLike(User user, Review review) {
        this.user = user;
        this.review = review;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Review getReview() {
        return review;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
