package com.verdikt.api.repository;

import com.verdikt.api.ReviewLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewLikeRepository extends JpaRepository<ReviewLike, UUID> {

    long countByReviewId(UUID reviewId);

    boolean existsByReviewIdAndUserId(UUID reviewId, UUID userId);

    Optional<ReviewLike> findByReviewIdAndUserId(UUID reviewId, UUID userId);
}
