package com.verdikt.api.dto;

import com.verdikt.api.Review;
import com.verdikt.api.Verdict;

import java.time.Instant;
import java.util.UUID;

public class ReviewResponseDTO {

    private UUID id;
    private UUID userId;
    private UUID mediaItemId;
    private UserSummaryDTO user;
    private MediaItemDTO mediaItem;
    private Verdict verdict;
    private String content;
    private boolean containsSpoilers;
    private Instant createdAt;
    private String formattedCreatedAt;
    private boolean allowComments = true;
    private long likeCount;
    private long commentCount;
    private boolean likedByMe;

    public ReviewResponseDTO() {
    }

    public boolean isAllowComments() {
        return allowComments;
    }

    public void setAllowComments(boolean allowComments) {
        this.allowComments = allowComments;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(long likeCount) {
        this.likeCount = likeCount;
    }

    public long getCommentCount() {
        return commentCount;
    }

    public void setCommentCount(long commentCount) {
        this.commentCount = commentCount;
    }

    public boolean isLikedByMe() {
        return likedByMe;
    }

    public void setLikedByMe(boolean likedByMe) {
        this.likedByMe = likedByMe;
    }

    public ReviewResponseDTO(UUID id, UUID userId, UUID mediaItemId, UserSummaryDTO user, MediaItemDTO mediaItem,
                             Verdict verdict, String content, boolean containsSpoilers, Instant createdAt, String formattedCreatedAt) {
        this.id = id;
        this.userId = userId;
        this.mediaItemId = mediaItemId;
        this.user = user;
        this.mediaItem = mediaItem;
        this.verdict = verdict;
        this.content = content;
        this.containsSpoilers = containsSpoilers;
        this.createdAt = createdAt;
        this.formattedCreatedAt = formattedCreatedAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getMediaItemId() {
        return mediaItemId;
    }

    public void setMediaItemId(UUID mediaItemId) {
        this.mediaItemId = mediaItemId;
    }

    public UserSummaryDTO getUser() {
        return user;
    }

    public void setUser(UserSummaryDTO user) {
        this.user = user;
    }

    public MediaItemDTO getMediaItem() {
        return mediaItem;
    }

    public void setMediaItem(MediaItemDTO mediaItem) {
        this.mediaItem = mediaItem;
    }

    public Verdict getVerdict() {
        return verdict;
    }

    public void setVerdict(Verdict verdict) {
        this.verdict = verdict;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public boolean isContainsSpoilers() {
        return containsSpoilers;
    }

    public void setContainsSpoilers(boolean containsSpoilers) {
        this.containsSpoilers = containsSpoilers;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getFormattedCreatedAt() {
        return formattedCreatedAt;
    }

    public void setFormattedCreatedAt(String formattedCreatedAt) {
        this.formattedCreatedAt = formattedCreatedAt;
    }

    public static ReviewResponseDTO fromEntity(Review review) {
        if (review == null) {
            return null;
        }
        ReviewResponseDTO dto = ReviewResponseDTO.builder()
                .id(review.getId())
                .userId(review.getUser() != null ? review.getUser().getId() : null)
                .mediaItemId(review.getMediaItem() != null ? review.getMediaItem().getId() : null)
                .user(UserSummaryDTO.fromEntity(review.getUser()))
                .mediaItem(MediaItemDTO.fromEntity(review.getMediaItem()))
                .verdict(review.getVerdict())
                .content(review.getContent())
                .containsSpoilers(review.isContainsSpoilers())
                .createdAt(review.getCreatedAt())
                .formattedCreatedAt(review.getCreatedAt() != null ? review.getCreatedAt().toString() : null)
                .build();
        dto.setAllowComments(review.isAllowComments());
        return dto;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID id;
        private UUID userId;
        private UUID mediaItemId;
        private UserSummaryDTO user;
        private MediaItemDTO mediaItem;
        private Verdict verdict;
        private String content;
        private boolean containsSpoilers;
        private Instant createdAt;
        private String formattedCreatedAt;

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder userId(UUID userId) {
            this.userId = userId;
            return this;
        }

        public Builder mediaItemId(UUID mediaItemId) {
            this.mediaItemId = mediaItemId;
            return this;
        }

        public Builder user(UserSummaryDTO user) {
            this.user = user;
            return this;
        }

        public Builder mediaItem(MediaItemDTO mediaItem) {
            this.mediaItem = mediaItem;
            return this;
        }

        public Builder verdict(Verdict verdict) {
            this.verdict = verdict;
            return this;
        }

        public Builder content(String content) {
            this.content = content;
            return this;
        }

        public Builder containsSpoilers(boolean containsSpoilers) {
            this.containsSpoilers = containsSpoilers;
            return this;
        }

        public Builder createdAt(Instant createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder formattedCreatedAt(String formattedCreatedAt) {
            this.formattedCreatedAt = formattedCreatedAt;
            return this;
        }

        public ReviewResponseDTO build() {
            return new ReviewResponseDTO(id, userId, mediaItemId, user, mediaItem, verdict, content, containsSpoilers, createdAt, formattedCreatedAt);
        }
    }
}
