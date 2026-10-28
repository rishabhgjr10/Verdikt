package com.verdikt.api.repository;

import com.verdikt.api.ReviewComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewCommentRepository extends JpaRepository<ReviewComment, UUID> {

    long countByReviewId(UUID reviewId);

    List<ReviewComment> findByReviewIdOrderByCreatedAtAsc(UUID reviewId);
}
