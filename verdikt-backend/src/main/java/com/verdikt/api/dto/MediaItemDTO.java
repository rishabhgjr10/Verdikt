package com.verdikt.api.dto;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;

import java.util.List;
import java.util.UUID;

public class MediaItemDTO {

    private UUID id;
    private String externalId;
    private MediaType mediaType;
    private String title;
    private Integer releaseYear;
    private String coverImage;
    private String backdropImage;
    private String description;
    private String trailerUrl;
    private List<String> creatorsJson;
    private List<String> genresJson;
    private List<String> platformsJson;

    public MediaItemDTO() {
    }

    public MediaItemDTO(UUID id, String externalId, MediaType mediaType, String title, Integer releaseYear,
                        String coverImage, String backdropImage, String description, String trailerUrl,
                        List<String> creatorsJson, List<String> genresJson, List<String> platformsJson) {
        this.id = id;
        this.externalId = externalId;
        this.mediaType = mediaType;
        this.title = title;
        this.releaseYear = releaseYear;
        this.coverImage = coverImage;
        this.backdropImage = backdropImage;
        this.description = description;
        this.trailerUrl = trailerUrl;
        this.creatorsJson = creatorsJson;
        this.genresJson = genresJson;
        this.platformsJson = platformsJson;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public MediaType getMediaType() {
        return mediaType;
    }

    public void setMediaType(MediaType mediaType) {
        this.mediaType = mediaType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Integer getReleaseYear() {
        return releaseYear;
    }

    public void setReleaseYear(Integer releaseYear) {
        this.releaseYear = releaseYear;
    }

    public String getCoverImage() {
        return coverImage;
    }

    public void setCoverImage(String coverImage) {
        this.coverImage = coverImage;
    }

    public String getBackdropImage() {
        return backdropImage;
    }

    public void setBackdropImage(String backdropImage) {
        this.backdropImage = backdropImage;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTrailerUrl() {
        return trailerUrl;
    }

    public void setTrailerUrl(String trailerUrl) {
        this.trailerUrl = trailerUrl;
    }

    public List<String> getCreatorsJson() {
        return creatorsJson;
    }

    public void setCreatorsJson(List<String> creatorsJson) {
        this.creatorsJson = creatorsJson;
    }

    public List<String> getGenresJson() {
        return genresJson;
    }

    public void setGenresJson(List<String> genresJson) {
        this.genresJson = genresJson;
    }

    public List<String> getPlatformsJson() {
        return platformsJson;
    }

    public void setPlatformsJson(List<String> platformsJson) {
        this.platformsJson = platformsJson;
    }

    public static MediaItemDTO fromEntity(MediaItem entity) {
        if (entity == null) {
            return null;
        }
        return MediaItemDTO.builder()
                .id(entity.getId())
                .externalId(entity.getExternalId())
                .mediaType(entity.getMediaType())
                .title(entity.getTitle())
                .releaseYear(entity.getReleaseYear())
                .coverImage(entity.getCoverImage())
                .backdropImage(entity.getBackdropImage())
                .description(entity.getDescription())
                .trailerUrl(entity.getTrailerUrl())
                .creatorsJson(entity.getCreatorsJson())
                .genresJson(entity.getGenresJson())
                .platformsJson(entity.getPlatformsJson())
                .build();
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID id;
        private String externalId;
        private MediaType mediaType;
        private String title;
        private Integer releaseYear;
        private String coverImage;
        private String backdropImage;
        private String description;
        private String trailerUrl;
        private List<String> creatorsJson;
        private List<String> genresJson;
        private List<String> platformsJson;

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder externalId(String externalId) {
            this.externalId = externalId;
            return this;
        }

        public Builder mediaType(MediaType mediaType) {
            this.mediaType = mediaType;
            return this;
        }

        public Builder title(String title) {
            this.title = title;
            return this;
        }

        public Builder releaseYear(Integer releaseYear) {
            this.releaseYear = releaseYear;
            return this;
        }

        public Builder coverImage(String coverImage) {
            this.coverImage = coverImage;
            return this;
        }

        public Builder backdropImage(String backdropImage) {
            this.backdropImage = backdropImage;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder trailerUrl(String trailerUrl) {
            this.trailerUrl = trailerUrl;
            return this;
        }

        public Builder creatorsJson(List<String> creatorsJson) {
            this.creatorsJson = creatorsJson;
            return this;
        }

        public Builder genresJson(List<String> genresJson) {
            this.genresJson = genresJson;
            return this;
        }

        public Builder platformsJson(List<String> platformsJson) {
            this.platformsJson = platformsJson;
            return this;
        }

        public MediaItemDTO build() {
            return new MediaItemDTO(id, externalId, mediaType, title, releaseYear, coverImage, backdropImage, description, trailerUrl, creatorsJson, genresJson, platformsJson);
        }
    }
}
