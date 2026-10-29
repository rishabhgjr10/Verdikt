package com.verdikt.api.repository;

import com.verdikt.api.ReviewComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewCommentRepository extends JpaRepository<ReviewComment, UUID> {

    long countByReviewId(UUID reviewId);

    List<ReviewComment> findByReviewIdOrderByCreatedAtAsc(UUID reviewId);

    /** Account deletion: the user's own comments plus every comment on the user's reviews */
    @Modifying
    @Query("delete from ReviewComment c where c.user.id = :userId or c.review.id in (select r.id from Review r where r.user.id = :userId)")
    int deleteAllForUser(@Param("userId") UUID userId);
}
