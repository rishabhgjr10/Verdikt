package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.service.external.UnifiedMediaSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class MediaItemService {

    private static final Logger log = LoggerFactory.getLogger(MediaItemService.class);

    private final MediaItemRepository mediaItemRepository;
    private final UnifiedMediaSearchService unifiedMediaSearchService;
    private final ConcurrentHashMap<String, Object> importLocks = new ConcurrentHashMap<>();
    private final Set<UUID> detailsBackfillAttempted = ConcurrentHashMap.newKeySet();

    /**
     * Provider ids that just came back empty, so repeated requests (or a script walking ids) don't each cost a provider
     * call. Short-lived because an outage also looks empty.
     */
    private final ConcurrentHashMap<String, Instant> missingTitles = new ConcurrentHashMap<>();
    private static final java.time.Duration MISSING_TTL = java.time.Duration.ofMinutes(10);

    private void rememberMissing(String key) {
        if (missingTitles.size() > 10_000) {
            missingTitles.entrySet().removeIf(e -> e.getValue().isBefore(Instant.now()));
        }
        missingTitles.put(key, Instant.now().plus(MISSING_TTL));
    }
    private final java.util.concurrent.ExecutorService backfillExecutor = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "media-details-backfill");
        t.setDaemon(true);
        return t;
    });

    public MediaItemService(MediaItemRepository mediaItemRepository, UnifiedMediaSearchService unifiedMediaSearchService) {
        this.mediaItemRepository = mediaItemRepository;
        this.unifiedMediaSearchService = unifiedMediaSearchService;
    }

    public List<MediaItemDTO> searchMedia(String query, String mediaTypeFilter) {
        return searchMedia(query, mediaTypeFilter, 1);
    }

    /** Local matches shown at most; the providers supply the rest */
    static final int LOCAL_RESULT_LIMIT = 40;
    /** Provider pages past this add nothing useful and only spend quota */
    static final int MAX_SEARCH_PAGE = 20;

    /**
     * Deliberately not @Transactional: each repository call takes a connection only for its own short query, so a slow
     * provider (up to the search timeout) never holds one of the pool's few connections while every other request waits.
     */
    public List<MediaItemDTO> searchMedia(String query, String mediaTypeFilter, int page) {
        List<MediaItem> localResults = Collections.emptyList();
        String q = query != null ? query.trim() : "";
        page = Math.max(1, Math.min(page, MAX_SEARCH_PAGE));
        Pageable firstLocal = PageRequest.of(0, LOCAL_RESULT_LIMIT);
        try {
            // Local matches only on page 1 and for real queries: "" or one letter would match most of the catalogue
            if (page == 1 && q.length() >= 2) {
                MediaType mediaType = parseType(mediaTypeFilter);
                localResults = mediaType != null
                        ? mediaItemRepository.findByMediaTypeAndTitleContainingIgnoreCase(mediaType, q, firstLocal)
                        : mediaItemRepository.findByTitleContainingIgnoreCase(q, firstLocal);
            }
        } catch (Exception e) {
            log.warn("Local DB search failed for query='{}': {}", q, e.getMessage());
            localResults = Collections.emptyList();
        }

        List<MediaItemDTO> results = new ArrayList<>();
        if (localResults != null) {
            results = localResults.stream()
                    .map(MediaItemDTO::fromEntity)
                    .collect(Collectors.toList());
        }

        List<MediaItemDTO> externalResults = Collections.emptyList();
        try {
            externalResults = unifiedMediaSearchService.search(q, mediaTypeFilter, page);
        } catch (Exception e) {
            log.warn("Unified external search failed for query='{}': {}", q, e.getMessage());
        }

        if (externalResults != null) {
            // One query for every provider result instead of one per result
            Map<String, List<MediaItem>> stored = Collections.emptyMap();
            try {
                List<String> ids = externalResults.stream().filter(java.util.Objects::nonNull)
                        .map(MediaItemDTO::getExternalId).filter(java.util.Objects::nonNull).distinct().toList();
                if (!ids.isEmpty()) {
                    stored = mediaItemRepository.findByExternalIdIn(ids).stream()
                            .collect(Collectors.groupingBy(MediaItem::getExternalId));
                }
            } catch (Exception e) {
                log.warn("Failed checking local DB for provider results: {}", e.getMessage());
            }
            for (MediaItemDTO ext : externalResults) {
                if (ext == null || ext.getExternalId() == null || ext.getMediaType() == null) {
                    continue;
                }
                List<MediaType> candidates = getCandidateMediaTypes(ext.getMediaType());
                stored.getOrDefault(ext.getExternalId(), List.of()).stream()
                        .filter(m -> candidates.contains(m.getMediaType()))
                        .findFirst()
                        .ifPresent(existing -> {
                            ext.setId(existing.getId());
                            ext.setMediaType(existing.getMediaType());
                        });

                Optional<MediaItemDTO> localMatch = results.stream().filter(
                        local -> local != null
                              && local.getExternalId() != null
                              && local.getExternalId().equals(ext.getExternalId())
                              && local.getMediaType() == ext.getMediaType()).findFirst();
                if (localMatch.isPresent()) {
                    // Saved rows have no live popularity or score, so keep the provider's for ranking and the verdict
                    localMatch.get().setVoteCount(ext.getVoteCount());
                    localMatch.get().setVoteAverage(ext.getVoteAverage());
                    localMatch.get().setPopularity(ext.getPopularity());
                } else {
                    results.add(ext);
                }
            }
        }

        return results;
    }

    private static MediaType parseType(String filter) {
        if (filter == null || filter.equalsIgnoreCase("ALL")) return null;
        try {
            return MediaType.valueOf(filter.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Transactional
    public MediaItemDTO getMediaItemById(UUID id) {
        MediaItem entity = mediaItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Media item not found with id: " + id));
        return MediaItemDTO.fromEntity(entity);
    }

    /**
     * Lazily fills release_date for items imported before the column existed.
     * Best effort: at most one provider call per item per process, failures are only logged.
     */
    /** Fire-and-forget variant so a slow provider never delays the media page response. */
    public void backfillMissingDetailsAsync(UUID id) {
        if (id == null || detailsBackfillAttempted.contains(id)) {
            return;
        }
        backfillExecutor.execute(() -> backfillMissingDetails(id));
    }

    /** Library/collection lists: rows imported before scores were stored get theirs on first view */
    public void backfillScoresAsync(List<MediaItemDTO> items) {
        items.stream().filter(d -> d.getVoteAverage() == null).forEach(d -> backfillMissingDetailsAsync(d.getId()));
    }

    /** Fills a missing release date and, for TMDB titles, the audience score; once per id per run */
    public void backfillMissingDetails(UUID id) {
        MediaItem item = mediaItemRepository.findById(id).orElse(null);
        if (item == null || !detailsBackfillAttempted.add(id)) {
            return;
        }
        boolean wantsScore = item.getVoteAverage() == null && item.getMediaType() != MediaType.BOOK && item.getMediaType() != MediaType.GAME;
        if (item.getReleaseDate() != null && !wantsScore) {
            return;
        }
        try {
            MediaItemDTO external = unifiedMediaSearchService.fetchExternalDetails(item.getExternalId(), item.getMediaType());
            if (external == null) {
                return;
            }
            boolean changed = false;
            if (item.getReleaseDate() == null && external.getReleaseDate() != null) {
                item.setReleaseDate(external.getReleaseDate());
                changed = true;
            }
            if (wantsScore && external.getVoteAverage() != null) {
                item.setVoteAverage(external.getVoteAverage());
                item.setVoteCount(external.getVoteCount());
                changed = true;
            }
            if (changed) {
                mediaItemRepository.save(item);
            }
        } catch (Exception e) {
            log.warn("Details backfill failed for media id={}: {}", id, e.getClass().getSimpleName());
        }
    }

    public MediaItem getOrCreateMediaItem(String externalId, MediaType mediaType) {
        if (externalId == null || mediaType == null) {
            throw new IllegalArgumentException("externalId and mediaType cannot be null");
        }

        List<MediaType> candidates = getCandidateMediaTypes(mediaType);

        // 1. Cheap check before calling external provider
        Optional<MediaItem> existing = mediaItemRepository.findFirstByExternalIdAndMediaTypeIn(externalId, candidates);
        if (existing.isPresent()) {
            return existing.get();
        }

        // Lock keyed by external ID (normalized for TV series / anime namespace)
        String lockKey = (mediaType == MediaType.SERIES || mediaType == MediaType.ANIME ? "TV:" : mediaType.name() + ":") + externalId;
        Instant missingUntil = missingTitles.get(lockKey);
        if (missingUntil != null && missingUntil.isAfter(Instant.now())) {
            throw new ResourceNotFoundException("Media item not found.");
        }
        Object lock = importLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // Re-check DB in case another thread just completed the import
                existing = mediaItemRepository.findFirstByExternalIdAndMediaTypeIn(externalId, candidates);
                if (existing.isPresent()) {
                    return existing.get();
                }

                // 2. Fetch from external provider (resolves SERIES -> ANIME rule inside provider mapping)
                MediaItemDTO externalDto = unifiedMediaSearchService.fetchExternalDetails(externalId, mediaType);
                if (externalDto == null) {
                    rememberMissing(lockKey);
                    throw new ResourceNotFoundException("Media item not found from external provider: " + externalId + " (" + mediaType + ")");
                }

                // 3. Resolve final media type FIRST, then check DB by (externalId, resolvedType)
                MediaType resolvedType = externalDto.getMediaType() != null ? externalDto.getMediaType() : mediaType;
                Optional<MediaItem> existingResolved = mediaItemRepository.findByExternalIdAndMediaType(externalId, resolvedType);
                if (existingResolved.isPresent()) {
                    return existingResolved.get();
                }

                // 4. Save with race protection against concurrent insert collisions
                try {
                    return saveDTOToEntity(externalDto);
                } catch (DataIntegrityViolationException | org.hibernate.exception.ConstraintViolationException e) {
                    log.warn("Concurrent insert collision for externalId='{}' (resolvedType={}), re-fetching: {}",
                            externalId, resolvedType, e.getMessage());
                    return mediaItemRepository.findByExternalIdAndMediaType(externalId, resolvedType)
                            .or(() -> mediaItemRepository.findFirstByExternalIdAndMediaTypeIn(externalId, candidates))
                            .orElseThrow(() -> new IllegalStateException("Failed to retrieve media item after concurrent insert", e));
                }
            } finally {
                importLocks.remove(lockKey, lock);
            }
        }
    }

    public List<MediaType> getCandidateMediaTypes(MediaType requestedType) {
        if (requestedType == MediaType.SERIES) {
            return List.of(MediaType.SERIES, MediaType.ANIME);
        } else if (requestedType == MediaType.ANIME) {
            return List.of(MediaType.ANIME, MediaType.SERIES);
        } else {
            return List.of(requestedType);
        }
    }

    /** Only ever called with provider responses (never client-sent details), so every field can be trusted */
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
                .releaseDate(dto.getReleaseDate())
                .build();
        entity.setVoteAverage(dto.getVoteAverage());
        entity.setVoteCount(dto.getVoteCount());

        log.info("Persisting new MediaItem to MySQL verdikt_db: title='{}', externalId='{}', type={}",
                entity.getTitle(), entity.getExternalId(), entity.getMediaType());
        return mediaItemRepository.save(entity);
    }
}
