package com.verdikt.api.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GoogleBooksService {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksService.class);

    private final WebClient webClient;

    @Value("${verdikt.integrations.google-books.api-key:your-google-books-api-key-here}")
    private String apiKey;

    @Value("${verdikt.integrations.google-books.base-url:https://www.googleapis.com/books/v1}")
    private String baseUrl;

    public GoogleBooksService(WebClient webClient) {
        this.webClient = webClient;
    }

    // Google Books allows 1,000 queries a day per key, and the homepage alone fires dozens, so identical
    // requests are answered from memory for CACHE_TTL. Failures (e.g. 429 quota) are never cached.
    // shortcut: unbounded growth is capped by clearing at CACHE_MAX_ENTRIES; swap for Caffeine if traffic grows
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final int CACHE_MAX_ENTRIES = 2000;
    private record CachedResponse(JsonNode body, Instant fetchedAt) {
    }
    private final ConcurrentHashMap<String, CachedResponse> responseCache = new ConcurrentHashMap<>();

    /** GET a Google Books URI as JSON via the cache; empty on any error, logged with `what`. */
    private Mono<JsonNode> cachedGet(String uri, String what) {
        CachedResponse hit = responseCache.get(uri);
        if (hit != null && hit.fetchedAt().plus(CACHE_TTL).isAfter(Instant.now())) {
            return Mono.just(hit.body());
        }
        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .doOnNext(body -> {
                    if (responseCache.size() >= CACHE_MAX_ENTRIES) {
                        responseCache.clear();
                    }
                    responseCache.put(uri, new CachedResponse(body, Instant.now()));
                })
                .onErrorResume(e -> {
                    log.error("Error {}: {}", what, e.getMessage());
                    return Mono.empty();
                });
    }

    public List<MediaItemDTO> searchBooks(String query) {
        return searchBooks(query, 1);
    }

    public List<MediaItemDTO> searchBooks(String query, int page) {
        int targetPage = Math.max(1, page);
        int maxResults = 40;
        int startIndex = (targetPage - 1) * maxResults;
        if (query == null || query.isBlank()) {
            return curatedBooks(targetPage);
        }
        String q = query;

        try {
            String uri = baseUrl + "/volumes?q=" + q + "&maxResults=" + maxResults + "&startIndex=" + startIndex;
            if (apiKey != null && !apiKey.contains("your-")) {
                uri += "&key=" + apiKey;
            }

            JsonNode response = cachedGet(uri, "searching Google Books").block();

            if (response == null || !response.has("items")) {
                return Collections.emptyList();
            }

            List<MediaItemDTO> list = new ArrayList<>();
            for (JsonNode node : response.get("items")) {
                list.add(mapBookNodeToDTO(node));
            }
            return list;
        } catch (Exception e) {
            log.error("Failed to execute Google Books search", e);
            return Collections.emptyList();
        }
    }

    /** Query groups for the default catalog: modern, decade blockbusters, Indian literature, genre hits. */
    private static final List<List<String>> CURATED_QUERIES = List.of(
            List.of("bestseller fiction 2020s", "award winning novel 2024", "contemporary fiction"),
            List.of("cult classic novel", "iconic thriller", "modern classic fiction"),
            List.of("Indian author fiction", "Booker Prize India", "Ruskin Bond", "Chetan Bhagat", "Arundhati Roy", "Hindi literature novel"),
            List.of("science fiction bestseller", "fantasy series", "mystery thriller", "romance bestseller"));
    private static final int CURATED_PER_QUERY = 10;
    private static final int CURATED_LIMIT = 30;

    /** Blank-query catalog: all curated queries run in parallel, filtered, deduped, then interleaved across groups. */
    private List<MediaItemDTO> curatedBooks(int page) {
        int startIndex = (page - 1) * CURATED_PER_QUERY;
        List<String> flat = CURATED_QUERIES.stream().flatMap(List::stream).toList();
        List<Mono<JsonNode>> calls = flat.stream()
                .map(q -> cachedGet(volumesUri(q, CURATED_PER_QUERY, startIndex) + "&orderBy=relevance&printType=books",
                                "searching Google Books (" + q + ")")
                        .defaultIfEmpty(com.fasterxml.jackson.databind.node.MissingNode.getInstance()))
                .toList();
        List<Object> responses;
        try {
            responses = Mono.zip(calls, Arrays::asList).block();
        } catch (Exception e) {
            log.error("Failed to execute curated Google Books search", e);
            return Collections.emptyList();
        }
        if (responses == null) {
            return Collections.emptyList();
        }

        Set<String> seen = new HashSet<>();
        List<List<MediaItemDTO>> groups = new ArrayList<>();
        int next = 0;
        for (List<String> group : CURATED_QUERIES) {
            // Round-robin inside the group too, so one query cannot dominate it
            List<List<MediaItemDTO>> perQuery = new ArrayList<>();
            for (int i = 0; i < group.size(); i++) {
                List<MediaItemDTO> books = new ArrayList<>();
                JsonNode items = ((JsonNode) responses.get(next++)).path("items");
                for (JsonNode node : items) {
                    MediaItemDTO dto = mapBookNodeToDTO(node);
                    if (isCuratedBook(dto) && seen.add(dto.getExternalId())) {
                        books.add(dto);
                    }
                }
                perQuery.add(books);
            }
            groups.add(interleave(perQuery, Integer.MAX_VALUE));
        }
        return interleave(groups, CURATED_LIMIT);
    }

    /** Needs a cover; pre-1970 books only when they present themselves as classics. */
    private boolean isCuratedBook(MediaItemDTO dto) {
        if (dto.getCoverImage() == null || dto.getTitle() == null || dto.getTitle().isBlank()) {
            return false;
        }
        Integer year = dto.getReleaseYear();
        if (year != null && year >= 1970) {
            return true;
        }
        String title = dto.getTitle().toLowerCase();
        return title.contains("classic") || title.contains("masterpiece");
    }

    private static <T> List<T> interleave(List<List<T>> lists, int limit) {
        List<T> out = new ArrayList<>();
        for (int i = 0; out.size() < limit; i++) {
            boolean any = false;
            for (List<T> list : lists) {
                if (i < list.size()) {
                    any = true;
                    if (out.size() < limit) {
                        out.add(list.get(i));
                    }
                }
            }
            if (!any) {
                break;
            }
        }
        return out;
    }

    private String volumesUri(String q, int maxResults, int startIndex) {
        String uri = baseUrl + "/volumes?q=" + q + "&maxResults=" + maxResults + "&startIndex=" + startIndex;
        if (apiKey != null && !apiKey.contains("your-")) {
            uri += "&key=" + apiKey;
        }
        return uri;
    }

    public MediaItemDTO fetchBookDetails(String externalId) {
        try {
            String uri = baseUrl + "/volumes/" + externalId;
            if (apiKey != null && !apiKey.contains("your-")) {
                uri += "?key=" + apiKey;
            }

            JsonNode node = cachedGet(uri, "fetching Google Books volume details").block();

            if (node == null) {
                return null;
            }

            return mapBookNodeToDTO(node);
        } catch (Exception e) {
            log.error("Failed to fetch Google Books details", e);
            return null;
        }
    }

    private MediaItemDTO mapBookNodeToDTO(JsonNode node) {
        String id = node.path("id").asText();
        JsonNode volumeInfo = node.path("volumeInfo");

        String title = volumeInfo.path("title").asText("");
        String publishedDate = volumeInfo.path("publishedDate").asText("");
        Integer releaseYear = parseYear(publishedDate);
        String description = volumeInfo.path("description").asText(null);

        String coverImage = null;
        String backdropImage = null;
        if (volumeInfo.has("imageLinks")) {
            JsonNode imageLinks = volumeInfo.get("imageLinks");
            if (imageLinks.has("thumbnail")) {
                coverImage = formatImageUrl(imageLinks.get("thumbnail").asText());
            } else if (imageLinks.has("smallThumbnail")) {
                coverImage = formatImageUrl(imageLinks.get("smallThumbnail").asText());
            }

            if (imageLinks.has("extraLarge")) {
                backdropImage = formatImageUrl(imageLinks.get("extraLarge").asText());
            } else if (imageLinks.has("large")) {
                backdropImage = formatImageUrl(imageLinks.get("large").asText());
            } else if (imageLinks.has("medium")) {
                backdropImage = formatImageUrl(imageLinks.get("medium").asText());
            } else {
                backdropImage = coverImage;
            }
        }

        List<String> authors = new ArrayList<>();
        if (volumeInfo.has("authors") && volumeInfo.get("authors").isArray()) {
            for (JsonNode author : volumeInfo.get("authors")) {
                authors.add(author.asText());
            }
        }

        List<String> categories = new ArrayList<>();
        if (volumeInfo.has("categories") && volumeInfo.get("categories").isArray()) {
            for (JsonNode category : volumeInfo.get("categories")) {
                categories.add(category.asText());
            }
        }

        List<String> platforms = new ArrayList<>();
        if (volumeInfo.has("publisher")) {
            platforms.add(volumeInfo.get("publisher").asText());
        }
        platforms.add("Google Play Books");

        return MediaItemDTO.builder()
                .externalId(id)
                .mediaType(MediaType.BOOK)
                .title(title)
                .releaseYear(releaseYear)
                .releaseDate(parseFullDate(publishedDate))
                .coverImage(coverImage)
                .backdropImage(backdropImage)
                .description(description)
                .trailerUrl(null)
                .creatorsJson(authors)
                .genresJson(categories)
                .platformsJson(platforms)
                .build();
    }

    private String formatImageUrl(String url) {
        if (url == null) return null;
        if (url.startsWith("http://")) {
            return url.replace("http://", "https://");
        }
        return url;
    }

    /** Google Books dates may be "yyyy", "yyyy-MM" or "yyyy-MM-dd"; only a full date is kept. */
    private java.time.LocalDate parseFullDate(String dateStr) {
        if (dateStr == null || dateStr.length() < 10) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(dateStr.substring(0, 10));
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    private Integer parseYear(String dateStr) {
        if (dateStr == null || dateStr.length() < 4) {
            return null;
        }
        try {
            return Integer.parseInt(dateStr.substring(0, 4));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
