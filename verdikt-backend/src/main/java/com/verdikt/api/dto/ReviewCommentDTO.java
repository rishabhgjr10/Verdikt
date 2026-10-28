package com.verdikt.api.dto;

import com.verdikt.api.ReviewComment;

import java.time.Instant;
import java.util.UUID;

public record ReviewCommentDTO(UUID id, UUID reviewId, UserSummaryDTO user, String text, Instant createdAt) {

    public static ReviewCommentDTO fromEntity(ReviewComment comment) {
        return new ReviewCommentDTO(
                comment.getId(),
                comment.getReview().getId(),
                UserSummaryDTO.fromEntity(comment.getUser()),
                comment.getText(),
                comment.getCreatedAt());
    }
}
