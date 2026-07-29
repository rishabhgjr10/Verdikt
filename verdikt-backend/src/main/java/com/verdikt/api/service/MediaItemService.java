package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.service.external.UnifiedMediaSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MediaItemService {

    private static final Logger log = LoggerFactory.getLogger(MediaItemService.class);

    private final MediaItemRepository mediaItemRepository;
    private final UnifiedMediaSearchService unifiedMediaSearchService;

    public MediaItemService(MediaItemRepository mediaItemRepository, UnifiedMediaSearchService unifiedMediaSearchService) {
        this.mediaItemRepository = mediaItemRepository;
        this.unifiedMediaSearchService = unifiedMediaSearchService;
    }

    @Transactional(readOnly = true)
    public List<MediaItemDTO> searchMedia(String query, String mediaTypeFilter) {
        return searchMedia(query, mediaTypeFilter, 1);
    }

    @Transactional(readOnly = true)
    public List<MediaItemDTO> searchMedia(String query, String mediaTypeFilter, int page) {
        List<MediaItem> localResults;
        String q = query != null ? query : "";
        if (mediaTypeFilter != null && !mediaTypeFilter.equalsIgnoreCase("ALL")) {
            try {
                MediaType mediaType = MediaType.valueOf(mediaTypeFilter.toUpperCase());
                localResults = mediaItemRepository.findByMediaTypeAndTitleContainingIgnoreCase(mediaType, q);
            } catch (IllegalArgumentException e) {
                localResults = mediaItemRepository.findByTitleContainingIgnoreCase(q);
            }
        } else {
            localResults = mediaItemRepository.findByTitleContainingIgnoreCase(q);
        }

        List<MediaItemDTO> results = localResults.stream()
                .map(MediaItemDTO::fromEntity)
                .collect(Collectors.toList());

        List<MediaItemDTO> externalResults = unifiedMediaSearchService.search(q, mediaTypeFilter, page);

        for (MediaItemDTO ext : externalResults) {
            Optional<MediaItem> existing = mediaItemRepository.findByExternalIdAndMediaType(
                    ext.getExternalId(), ext.getMediaType());
            if (existing.isPresent()) {
                ext.setId(existing.get().getId());
            }
            boolean existsInLocalList = results.stream().anyMatch(
                    local -> local.getExternalId().equals(ext.getExternalId()) && local.getMediaType() == ext.getMediaType());
            if (!existsInLocalList) {
                results.add(ext);
            }
        }

        return results;
    }

    @Transactional
    public MediaItemDTO getMediaItemById(UUID id) {
        MediaItem entity = mediaItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Media item not found with id: " + id));
        return MediaItemDTO.fromEntity(entity);
    }

    @Transactional
    public MediaItem getOrCreateMediaItem(String externalId, MediaType mediaType) {
        Optional<MediaItem> existing = mediaItemRepository.findByExternalIdAndMediaType(externalId, mediaType);
        if (existing.isPresent()) {
            return existing.get();
        }

        MediaItemDTO externalDto = unifiedMediaSearchService.fetchExternalDetails(externalId, mediaType);
        if (externalDto == null) {
            throw new ResourceNotFoundException("Media item not found from external provider: " + externalId + " (" + mediaType + ")");
        }

        return saveDTOToEntity(externalDto);
    }

    @Transactional
    public MediaItem getOrCreateFromDTO(MediaItemDTO dto) {
        if (dto == null) {
            throw new IllegalArgumentException("MediaItemDTO details are required");
        }
        if (dto.getId() != null) {
            Optional<MediaItem> existing = mediaItemRepository.findById(dto.getId());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        if (dto.getExternalId() != null && dto.getMediaType() != null) {
            Optional<MediaItem> existing = mediaItemRepository.findByExternalIdAndMediaType(dto.getExternalId(), dto.getMediaType());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        return saveDTOToEntity(dto);
    }

    private MediaItem saveDTOToEntity(MediaItemDTO dto) {
        MediaItem entity = MediaItem.builder()
                .externalId(dto.getExternalId())
                .mediaType(dto.getMediaType())
                .title(dto.getTitle())
                .releaseYear(dto.getReleaseYear())
                .coverImage(dto.getCoverImage())
                .backdropImage(dto.getBackdropImage())
                .description(dto.getDescription())
                .trailerUrl(dto.getTrailerUrl())
                .creatorsJson(dto.getCreatorsJson() != null ? dto.getCreatorsJson() : new ArrayList<>())
                .genresJson(dto.getGenresJson() != null ? dto.getGenresJson() : new ArrayList<>())
                .platformsJson(dto.getPlatformsJson() != null ? dto.getPlatformsJson() : new ArrayList<>())
                .build();

        log.info("Persisting new MediaItem to MySQL verdikt_db: title='{}', externalId='{}', type={}",
                entity.getTitle(), entity.getExternalId(), entity.getMediaType());
        return mediaItemRepository.save(entity);
    }
}
