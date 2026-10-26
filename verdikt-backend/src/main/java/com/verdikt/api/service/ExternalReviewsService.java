package com.verdikt.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.service.external.ExternalHttp;
import com.verdikt.api.service.external.ExternalHttp.JsonResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * "What others are saying": up to 6 TMDB user reviews for movies, series and anime.
 * Reviews are never stored in the database; results are cached in memory for 24h.
 * Any provider problem yields an empty list. external_id is the TMDB id for these types.
 */
@Service
public class ExternalReviewsService {

    static final int MAX_REVIEWS = 6;
    static final int EXCERPT_LENGTH = 450;
    static final Duration CACHE_TTL = Duration.ofHours(24);

    public record ExternalReview(String author, Double rating, String createdAt, String excerpt, String url) {
    }

    private record Cached(Instant expiresAt, List<ExternalReview> reviews) {
    }

    private final MediaItemRepository mediaItemRepository;
    private final WebClient tmdb;
    private final String tmdbKey;
    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    public ExternalReviewsService(MediaItemRepository mediaItemRepository,
                                  @Value("${verdikt.integrations.tmdb.api-key:}") String tmdbKey,
                                  @Value("${verdikt.integrations.tmdb.base-url:https://api.themoviedb.org/3}") String tmdbBaseUrl) {
        this.mediaItemRepository = mediaItemRepository;
        this.tmdbKey = tmdbKey;
        this.tmdb = ExternalHttp.client(tmdbBaseUrl);
    }

    public List<ExternalReview> getReviews(UUID mediaId) {
        Cached cached = cache.get(mediaId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.reviews();
        }
        MediaItem item = mediaItemRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media item not found"));

        MediaType type = item.getMediaType();
        if (type == MediaType.GAME || type == MediaType.BOOK || tmdbKey == null || tmdbKey.isBlank()) {
            return List.of();
        }
        String kind = type == MediaType.MOVIE ? "movie" : "tv";
        Optional<JsonResponse> resp = ExternalHttp.get(tmdb, "TMDB reviews", b -> b.path("/{kind}/{id}/reviews")
                .queryParam("api_key", tmdbKey).queryParam("page", 1).build(kind, item.getExternalId()));
        if (resp.isEmpty() || resp.get().body() == null || resp.get().status() >= 400) {
            return List.of(); // not cached, so a transient failure is retried on the next view
        }

        List<ExternalReview> reviews = new ArrayList<>();
        for (JsonNode node : resp.get().body().path("results")) {
            if (reviews.size() >= MAX_REVIEWS) {
                break;
            }
            String excerpt = excerpt(node.path("content").asText(""));
            String url = node.path("url").asText("");
            if (excerpt.isEmpty() || !url.startsWith("https://")) {
                continue;
            }
            JsonNode rating = node.path("author_details").path("rating");
            String author = node.path("author_details").path("username").asText(node.path("author").asText("TMDB user"));
            String name = node.path("author").asText("").isBlank() ? author : node.path("author").asText();
            reviews.add(new ExternalReview(name.replaceAll("<[^>]*>", "").trim(), rating.isNumber() ? rating.asDouble() : null,
                    node.path("created_at").asText(null), excerpt, url));
        }
        List<ExternalReview> result = List.copyOf(reviews);
        cache.put(mediaId, new Cached(Instant.now().plus(CACHE_TTL), result));
        return result;
    }

    /** Markdown/HTML-free text cut at a word boundary near EXCERPT_LENGTH characters. */
    static String excerpt(String raw) {
        String text = plain(raw);
        if (text.length() <= EXCERPT_LENGTH) {
            return text;
        }
        int cut = text.lastIndexOf(' ', EXCERPT_LENGTH);
        if (cut < EXCERPT_LENGTH / 2) {
            cut = EXCERPT_LENGTH;
        }
        return text.substring(0, cut).replaceAll("[\\s,;:.\\-]+$", "") + "…";
    }

    static String plain(String raw) {
        if (raw == null) {
            return "";
        }
        return raw
                .replaceAll("(?s)<[^>]*>", " ")                       // HTML tags
                .replaceAll("!\\[[^\\]]*]\\([^)]*\\)", " ")            // images
                .replaceAll("\\[([^\\]]*)]\\([^)]*\\)", "$1")          // links -> text
                .replaceAll("(?m)^\\s{0,3}(#{1,6}|>+|[-*+]\\s|\\d+\\.\\s)", " ") // headings, quotes, lists
                .replaceAll("(\\*\\*|__|\\*|_|~~|`)", "")              // emphasis/code markers
                .replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
