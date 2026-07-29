package com.verdikt.api.dto;

import com.verdikt.api.Verdict;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public class CreateReviewRequest {

    private UUID mediaItemId;

    @NotNull(message = "Verdict is required")
    private Verdict verdict;

    @NotNull(message = "Review content is required")
    private String content;

    private boolean containsSpoilers;

    private MediaItemDTO mediaDetails;

    public CreateReviewRequest() {
    }

    public CreateReviewRequest(UUID mediaItemId, Verdict verdict, String content, boolean containsSpoilers, MediaItemDTO mediaDetails) {
        this.mediaItemId = mediaItemId;
        this.verdict = verdict;
        this.content = content;
        this.containsSpoilers = containsSpoilers;
        this.mediaDetails = mediaDetails;
    }

    public UUID getMediaItemId() {
        return mediaItemId;
    }

    public void setMediaItemId(UUID mediaItemId) {
        this.mediaItemId = mediaItemId;
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

    public MediaItemDTO getMediaDetails() {
        return mediaDetails;
    }

    public void setMediaDetails(MediaItemDTO mediaDetails) {
        this.mediaDetails = mediaDetails;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID mediaItemId;
        private Verdict verdict;
        private String content;
        private boolean containsSpoilers;
        private MediaItemDTO mediaDetails;

        public Builder mediaItemId(UUID mediaItemId) {
            this.mediaItemId = mediaItemId;
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

        public Builder mediaDetails(MediaItemDTO mediaDetails) {
            this.mediaDetails = mediaDetails;
            return this;
        }

        public CreateReviewRequest build() {
            return new CreateReviewRequest(mediaItemId, verdict, content, containsSpoilers, mediaDetails);
        }
    }
}
