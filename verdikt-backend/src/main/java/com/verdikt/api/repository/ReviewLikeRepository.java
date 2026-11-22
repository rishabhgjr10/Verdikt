package com.verdikt.api.repository;

import com.verdikt.api.ReviewLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewLikeRepository extends JpaRepository<ReviewLike, UUID> {

    long countByReviewId(UUID reviewId);

    boolean existsByReviewIdAndUserId(UUID reviewId, UUID userId);

    Optional<ReviewLike> findByReviewIdAndUserId(UUID reviewId, UUID userId);

    /** Rows: [reviewId, likeCount] */
    @Query("select l.review.id, count(l) from ReviewLike l where l.review.id in :ids group by l.review.id")
    List<Object[]> countByReviewIds(@Param("ids") java.util.Collection<UUID> ids);

    @Query("select l.review.id from ReviewLike l where l.user.id = :userId and l.review.id in :ids")
    List<UUID> findLikedReviewIds(@Param("userId") UUID userId, @Param("ids") java.util.Collection<UUID> ids);

    /** Account deletion: the user's own likes plus every like on the user's reviews */
    @Modifying
    @Query("delete from ReviewLike l where l.user.id = :userId or l.review.id in (select r.id from Review r where r.user.id = :userId)")
    int deleteAllForUser(@Param("userId") UUID userId);
}
