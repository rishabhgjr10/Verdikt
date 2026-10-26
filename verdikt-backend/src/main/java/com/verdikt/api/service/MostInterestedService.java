package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.UserMediaStateRepository;
import com.verdikt.api.service.external.TmdbService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Public "Most Interested" ranking: titles with the most current Watch Later saves
 * inside a rolling window. Only aggregate counts are exposed, never user ids.
 */
@Service
public class MostInterestedService {

    private static final Logger log = LoggerFactory.getLogger(MostInterestedService.class);
    static final Duration CACHE_TTL = Duration.ofSeconds(60);
    static final int MAX_LIMIT = 50;

    public enum Period {
        WEEK(7), MONTH(30), QUARTER(90), YEAR(365), ALL(0);

        final int days;

        Period(int days) {
            this.days = days;
        }

        static Period parse(String raw) {
            try {
                return Period.valueOf(raw == null ? "WEEK" : raw.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("period must be one of WEEK, MONTH, QUARTER, YEAR, ALL");
            }
        }
    }

    /** interestedCount is null for popularity fill items (the UI shows no count for them). */
    public record MostInterestedItem(UUID id, String externalId, MediaType mediaType, String title, String posterUrl,
                                     LocalDate releaseDate, Integer releaseYear, String statusLabel,
                                     Long interestedCount) {
    }

    private record CacheEntry(Instant expiresAt, List<MostInterestedItem> items) {
    }

    private final UserMediaStateRepository stateRepository;
    private final MediaItemRepository mediaItemRepository;
    private final TmdbService tmdbService;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private Clock clock = Clock.systemUTC();

    public MostInterestedService(UserMediaStateRepository stateRepository,
                                 MediaItemRepository mediaItemRepository,
                                 TmdbService tmdbService) {
        this.stateRepository = stateRepository;
        this.mediaItemRepository = mediaItemRepository;
        this.tmdbService = tmdbService;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    void clearCache() {
        cache.clear();
    }

    public List<MostInterestedItem> getMostInterested(String rawPeriod, int rawLimit) {
        Period period = Period.parse(rawPeriod);
        int limit = Math.max(1, Math.min(MAX_LIMIT, rawLimit));
        String key = period + ":" + limit;
        Instant now = clock.instant();
        CacheEntry cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.items();
        }
        List<MostInterestedItem> items = compute(period, limit, now);
        cache.put(key, new CacheEntry(now.plus(CACHE_TTL), items));
        return items;
    }

    private List<MostInterestedItem> compute(Period period, int limit, Instant now) {
        PageRequest page = PageRequest.of(0, limit);
        List<Object[]> rows = period == Period.ALL
                ? stateRepository.countInterestAllTime(page)
                : stateRepository.countInterestSince(now.minus(period.days, ChronoUnit.DAYS), page);

        List<UUID> ids = rows.stream().map(r -> (UUID) r[0]).toList();
        Map<UUID, MediaItem> media = mediaItemRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(MediaItem::getId, Function.identity()));
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);

        List<MostInterestedItem> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Object[] row : rows) {
            MediaItem m = media.get((UUID) row[0]);
            if (m == null) {
                continue;
            }
            seen.add(dedupeKey(m.getMediaType(), m.getExternalId()));
            result.add(new MostInterestedItem(m.getId(), m.getExternalId(), m.getMediaType(), m.getTitle(),
                    m.getCoverImage(), m.getReleaseDate(), m.getReleaseYear(),
                    statusLabel(m.getMediaType(), m.getReleaseDate(), today), (Long) row[1]));
        }
        if (result.size() < limit) {
            fillFromPopularity(result, seen, limit, today);
        }
        return List.copyOf(result);
    }

    /** Tops up with the existing TMDB trending/popular lists; these carry no interest count. */
    private void fillFromPopularity(List<MostInterestedItem> result, Set<String> seen, int limit, LocalDate today) {
        List<MediaItemDTO> movies;
        List<MediaItemDTO> series;
        try {
            movies = tmdbService.searchMovies("", 1);
            series = tmdbService.searchSeries("", 1);
        } catch (Exception e) {
            log.warn("Most Interested popularity fill unavailable: {}", e.getClass().getSimpleName());
            return;
        }
        List<MediaItemDTO> pool = new ArrayList<>();
        for (int i = 0; i < Math.max(movies.size(), series.size()); i++) {
            if (i < movies.size()) pool.add(movies.get(i));
            if (i < series.size()) pool.add(series.get(i));
        }
        for (MediaItemDTO dto : pool) {
            if (result.size() >= limit) {
                break;
            }
            if (dto == null || dto.getExternalId() == null || dto.getMediaType() == null || dto.getCoverImage() == null) {
                continue;
            }
            if (!seen.add(dedupeKey(dto.getMediaType(), dto.getExternalId()))) {
                continue;
            }
            // Link to the local page when the title was already imported
            UUID localId = mediaItemRepository.findByExternalIdAndMediaType(dto.getExternalId(), dto.getMediaType())
                    .map(MediaItem::getId).orElse(null);
            result.add(new MostInterestedItem(localId, dto.getExternalId(), dto.getMediaType(), dto.getTitle(),
                    dto.getCoverImage(), dto.getReleaseDate(), dto.getReleaseYear(),
                    statusLabel(dto.getMediaType(), dto.getReleaseDate(), today), null));
        }
    }

    private static String dedupeKey(MediaType type, String externalId) {
        // SERIES and ANIME share TMDB tv ids
        String namespace = type == MediaType.SERIES || type == MediaType.ANIME ? "TV" : type.name();
        return namespace + ":" + externalId;
    }

    static String statusLabel(MediaType type, LocalDate releaseDate, LocalDate today) {
        if (releaseDate == null || type == null) {
            return null;
        }
        if (releaseDate.isAfter(today)) {
            return "Upcoming";
        }
        long daysSince = ChronoUnit.DAYS.between(releaseDate, today);
        if (type == MediaType.MOVIE && daysSince <= 45) {
            return "In Theatres";
        }
        if ((type == MediaType.SERIES || type == MediaType.ANIME) && daysSince <= 90) {
            return "New Show";
        }
        return null;
    }
}
