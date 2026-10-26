package com.verdikt.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.service.external.ExternalHttp;
import com.verdikt.api.service.external.ExternalHttp.JsonResponse;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * External rating badges (IMDb / Rotten Tomatoes / Metascore via OMDb, AniList, RAWG,
 * Open Library, Google Books). One provider set per media type, 8s timeout per call,
 * and every failure degrades to "no badges" rather than an error.
 *
 * Caching: media_items.ratings_json (stale after 7 days, served while revalidating),
 * a 24h in-memory layer, and a single-flight lock so parallel requests for one item
 * trigger one provider fetch. API keys are only ever sent to the providers.
 */
@Service
public class RatingsService {

    private static final Logger log = LoggerFactory.getLogger(RatingsService.class);

    static final Duration STALE_AFTER = Duration.ofDays(7);
    static final Duration MEMORY_TTL = Duration.ofHours(24);
    static final Duration FAILURE_MEMORY_TTL = Duration.ofMinutes(10);
    static final Duration OMDB_LIMIT_BACKOFF = Duration.ofHours(1);
    private static final Duration WAIT_FOR_FETCH = Duration.ofSeconds(25);
    private static final List<String> ORDER =
            List.of("imdb", "rottenTomatoes", "metascore", "anilist", "metacritic", "rawg", "openLibrary", "googleBooks");

    private record Cached(Instant expiresAt, List<Map<String, Object>> sources) {
    }

    private record FetchResult(List<Map<String, Object>> sources, boolean failed, String imdbId) {
    }

    private record ProviderResult(List<Map<String, Object>> sources, boolean failed) {
        static ProviderResult none() {
            return new ProviderResult(List.of(), false);
        }

        static ProviderResult failure() {
            return new ProviderResult(List.of(), true);
        }
    }

    private final MediaItemRepository mediaItemRepository;
    private final WebClient tmdb;
    private final WebClient omdb;
    private final WebClient rawg;
    private final WebClient anilist;
    private final WebClient openLibrary;
    private final WebClient googleBooks;
    private final String tmdbKey;
    private final String omdbKey;
    private final String rawgKey;
    private final String googleBooksKey;

    private final Map<UUID, Cached> memory = new ConcurrentHashMap<>();
    private final Map<UUID, CompletableFuture<List<Map<String, Object>>>> inFlight = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "ratings-fetch");
        t.setDaemon(true);
        return t;
    });
    private final AtomicInteger providerFetchCount = new AtomicInteger();
    private volatile Instant omdbBlockedUntil = Instant.EPOCH;
    private Clock clock = Clock.systemUTC();

    public RatingsService(MediaItemRepository mediaItemRepository,
                          @Value("${verdikt.integrations.tmdb.api-key:}") String tmdbKey,
                          @Value("${verdikt.integrations.tmdb.base-url:https://api.themoviedb.org/3}") String tmdbBaseUrl,
                          @Value("${verdikt.integrations.omdb.api-key:}") String omdbKey,
                          @Value("${verdikt.integrations.omdb.base-url:https://www.omdbapi.com}") String omdbBaseUrl,
                          @Value("${verdikt.integrations.rawg.api-key:}") String rawgKey,
                          @Value("${verdikt.integrations.rawg.base-url:https://api.rawg.io/api}") String rawgBaseUrl,
                          @Value("${verdikt.integrations.anilist.base-url:https://graphql.anilist.co}") String anilistBaseUrl,
                          @Value("${verdikt.integrations.openlibrary.base-url:https://openlibrary.org}") String openLibraryBaseUrl,
                          @Value("${verdikt.integrations.google-books.api-key:}") String googleBooksKey,
                          @Value("${verdikt.integrations.google-books.base-url:https://www.googleapis.com/books/v1}") String googleBooksBaseUrl) {
        this.mediaItemRepository = mediaItemRepository;
        this.tmdbKey = tmdbKey;
        this.omdbKey = omdbKey;
        this.rawgKey = rawgKey;
        this.googleBooksKey = googleBooksKey;
        this.tmdb = ExternalHttp.client(tmdbBaseUrl);
        this.omdb = ExternalHttp.client(omdbBaseUrl);
        this.rawg = ExternalHttp.client(rawgBaseUrl);
        this.anilist = ExternalHttp.client(anilistBaseUrl);
        this.openLibrary = ExternalHttp.client(openLibraryBaseUrl);
        this.googleBooks = ExternalHttp.client(googleBooksBaseUrl);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    int providerFetchCount() {
        return providerFetchCount.get();
    }

    void clearMemory() {
        memory.clear();
    }

    void resetOmdbBackoff() {
        omdbBlockedUntil = Instant.EPOCH;
    }

    /** Rating sources for the media page. Never throws for provider problems. */
    public List<Map<String, Object>> getRatings(UUID mediaId) {
        Instant now = clock.instant();
        Cached cached = memory.get(mediaId);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.sources();
        }

        MediaItem item = mediaItemRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media item not found"));

        if (item.getRatingsFetchedAt() != null && item.getRatingsJson() != null) {
            List<Map<String, Object>> stored = item.getRatingsJson();
            if (item.getRatingsFetchedAt().plus(STALE_AFTER).isAfter(now)) {
                memory.put(mediaId, new Cached(now.plus(MEMORY_TTL), stored));
            } else {
                // Stale-while-revalidate: answer with stored data, refresh in the background
                singleFlight(mediaId);
            }
            return stored;
        }

        try {
            return singleFlight(mediaId).get(WAIT_FOR_FETCH.toSeconds(), TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Ratings fetch did not complete for media {}: {}", mediaId, e.getClass().getSimpleName());
            return List.of();
        }
    }

    /** One fetch per item at a time; concurrent callers share the same future. */
    private CompletableFuture<List<Map<String, Object>>> singleFlight(UUID mediaId) {
        CompletableFuture<List<Map<String, Object>>> created = new CompletableFuture<>();
        CompletableFuture<List<Map<String, Object>>> existing = inFlight.putIfAbsent(mediaId, created);
        if (existing != null) {
            return existing;
        }
        executor.execute(() -> {
            try {
                created.complete(fetchAndStore(mediaId));
            } catch (Throwable t) {
                log.warn("Ratings fetch failed for media {}: {}", mediaId, t.getClass().getSimpleName());
                created.complete(List.of());
            } finally {
                inFlight.remove(mediaId, created);
            }
        });
        return created;
    }

    private List<Map<String, Object>> fetchAndStore(UUID mediaId) {
        MediaItem item = mediaItemRepository.findById(mediaId).orElse(null);
        if (item == null) {
            return List.of();
        }
        providerFetchCount.incrementAndGet();
        log.info("Ratings provider fetch started for media {} ({})", mediaId, item.getMediaType());
        FetchResult result = fetchSources(item);
        Instant now = clock.instant();

        List<Map<String, Object>> sources = new ArrayList<>(result.sources());
        sources.sort(Comparator.comparingInt(s -> ORDER.indexOf(String.valueOf(s.get("key")))));

        if (result.failed()) {
            // Don't persist a partial/failed fetch; serve what we have and retry later
            List<Map<String, Object>> fallback = item.getRatingsJson() != null && sources.isEmpty()
                    ? item.getRatingsJson() : sources;
            memory.put(mediaId, new Cached(now.plus(FAILURE_MEMORY_TTL), fallback));
            log.info("Ratings provider fetch for media {} incomplete; {} source(s), not stored", mediaId, fallback.size());
            return fallback;
        }

        item.setRatingsJson(sources);
        item.setRatingsFetchedAt(now);
        if (result.imdbId() != null) {
            item.setImdbId(result.imdbId());
        }
        mediaItemRepository.save(item);
        memory.put(mediaId, new Cached(now.plus(MEMORY_TTL), sources));
        log.info("Ratings provider fetch finished for media {}: {} source(s) stored", mediaId, sources.size());
        return sources;
    }

    private FetchResult fetchSources(MediaItem item) {
        List<Map<String, Object>> sources = new ArrayList<>();
        boolean failed = false;
        String imdbId = item.getImdbId();
        MediaType type = item.getMediaType();

        if (type == MediaType.ANIME) {
            ProviderResult anime = fetchAniList(item);
            sources.addAll(anime.sources());
            failed |= anime.failed();
        }
        if (type == MediaType.MOVIE || type == MediaType.SERIES || type == MediaType.ANIME) {
            if (imdbId == null) {
                Optional<String> resolved = fetchImdbIdFromTmdb(item);
                if (resolved == null) {
                    failed = true;
                } else {
                    imdbId = resolved.orElse(null);
                }
            }
            if (imdbId != null) {
                ProviderResult omdbResult = fetchOmdb(imdbId, item.getTitle());
                sources.addAll(omdbResult.sources());
                failed |= omdbResult.failed();
            }
        } else if (type == MediaType.GAME) {
            ProviderResult games = fetchRawg(item);
            sources.addAll(games.sources());
            failed |= games.failed();
        } else if (type == MediaType.BOOK) {
            ProviderResult ol = fetchOpenLibrary(item);
            failed |= ol.failed();
            if (!ol.sources().isEmpty()) {
                sources.addAll(ol.sources());
            } else {
                ProviderResult gb = fetchGoogleBooks(item);
                sources.addAll(gb.sources());
                failed |= gb.failed();
            }
        }
        return new FetchResult(sources, failed, imdbId);
    }

    // ── TMDB external ids ────────────────────────────────────────────

    /** Optional.empty() = no IMDb id; null = provider failure. */
    private Optional<String> fetchImdbIdFromTmdb(MediaItem item) {
        if (isBlank(tmdbKey)) {
            return Optional.empty();
        }
        String kind = item.getMediaType() == MediaType.MOVIE ? "movie" : "tv";
        Optional<JsonResponse> resp = ExternalHttp.get(tmdb, "TMDB", b -> b.path("/{kind}/{id}/external_ids")
                .queryParam("api_key", tmdbKey).build(kind, item.getExternalId()));
        if (resp.isEmpty() || resp.get().status() >= 500) {
            return null;
        }
        JsonNode body = resp.get().body();
        String id = body == null ? null : text(body.path("imdb_id"));
        return Optional.ofNullable(id != null && id.startsWith("tt") ? id : null);
    }

    // ── OMDb (IMDb, Rotten Tomatoes, Metascore) ──────────────────────

    private ProviderResult fetchOmdb(String imdbId, String title) {
        if (isBlank(omdbKey)) {
            return ProviderResult.none();
        }
        if (omdbBlockedUntil.isAfter(clock.instant())) {
            return ProviderResult.failure();
        }
        Optional<JsonResponse> resp = ExternalHttp.get(omdb, "OMDb", b -> b.path("/")
                .queryParam("i", imdbId).queryParam("apikey", omdbKey).build());
        if (resp.isEmpty() || resp.get().body() == null) {
            return ProviderResult.failure();
        }
        JsonNode body = resp.get().body();
        if (!"True".equalsIgnoreCase(body.path("Response").asText())) {
            String error = body.path("Error").asText("").toLowerCase(Locale.ROOT);
            if (error.contains("limit")) {
                omdbBlockedUntil = clock.instant().plus(OMDB_LIMIT_BACKOFF);
                log.warn("OMDb daily limit reached; pausing OMDb calls for {}", OMDB_LIMIT_BACKOFF);
                return ProviderResult.failure();
            }
            return resp.get().status() >= 400 ? ProviderResult.failure() : ProviderResult.none();
        }

        List<Map<String, Object>> sources = new ArrayList<>();
        Double imdb = parseNumber(body.path("imdbRating").asText(null));
        if (imdb != null) {
            Double votes = parseNumber(body.path("imdbVotes").asText(null));
            sources.add(source("imdb", "IMDb", imdb, String.format(Locale.ROOT, "%.1f", imdb), votes == null ? null : votes.longValue(),
                    "https://www.imdb.com/title/" + imdbId + "/"));
        }
        for (JsonNode rating : body.path("Ratings")) {
            if ("Rotten Tomatoes".equals(rating.path("Source").asText())) {
                Double rt = parseNumber(rating.path("Value").asText(null));
                if (rt != null) {
                    sources.add(source("rottenTomatoes", "Rotten Tomatoes", rt, trimNumber(rt) + "%", null,
                            "https://www.rottentomatoes.com/search?search=" + encode(title)));
                }
            }
        }
        Double metascore = parseNumber(body.path("Metascore").asText(null));
        if (metascore != null) {
            sources.add(source("metascore", "Metascore", metascore, trimNumber(metascore), null,
                    "https://www.metacritic.com/search/" + encode(title) + "/"));
        }
        return new ProviderResult(sources, false);
    }

    // ── AniList (no key) ─────────────────────────────────────────────

    private static final String ANILIST_QUERY = "query ($search: String) { Page(perPage: 6) { media(search: $search, type: ANIME) "
            + "{ siteUrl averageScore seasonYear startDate { year } title { romaji english native } } } }";

    private ProviderResult fetchAniList(MediaItem item) {
        Optional<JsonResponse> resp = ExternalHttp.postJson(anilist, "AniList",
                Map.of("query", ANILIST_QUERY, "variables", Map.of("search", item.getTitle())));
        if (resp.isEmpty() || resp.get().body() == null || resp.get().status() >= 500) {
            return ProviderResult.failure();
        }
        for (JsonNode media : resp.get().body().path("data").path("Page").path("media")) {
            int year = media.path("seasonYear").asInt(media.path("startDate").path("year").asInt(0));
            JsonNode titles = media.path("title");
            boolean titleMatches = similarTitle(item.getTitle(), text(titles.path("english")))
                    || similarTitle(item.getTitle(), text(titles.path("romaji")))
                    || similarTitle(item.getTitle(), text(titles.path("native")));
            if (titleMatches && yearMatches(item.getReleaseYear(), year) && media.path("averageScore").isNumber()) {
                int score = media.path("averageScore").asInt();
                return new ProviderResult(List.of(source("anilist", "AniList", score, score + "%", null,
                        text(media.path("siteUrl")))), false);
            }
        }
        return ProviderResult.none();
    }

    // ── RAWG (games) ─────────────────────────────────────────────────

    private ProviderResult fetchRawg(MediaItem item) {
        if (isBlank(rawgKey)) {
            return ProviderResult.none();
        }
        Optional<JsonResponse> resp = ExternalHttp.get(rawg, "RAWG", b -> b.path("/games")
                .queryParam("search", item.getTitle()).queryParam("page_size", 5)
                .queryParam("key", rawgKey).build());
        if (resp.isEmpty() || resp.get().body() == null || resp.get().status() >= 400) {
            return ProviderResult.failure();
        }
        for (JsonNode game : resp.get().body().path("results")) {
            String released = text(game.path("released"));
            int year = released != null && released.length() >= 4 ? Integer.parseInt(released.substring(0, 4)) : 0;
            if (!similarTitle(item.getTitle(), text(game.path("name"))) || !yearMatches(item.getReleaseYear(), year)) {
                continue;
            }
            String url = "https://rawg.io/games/" + game.path("slug").asText("");
            List<Map<String, Object>> sources = new ArrayList<>();
            if (game.path("metacritic").isNumber()) {
                int mc = game.path("metacritic").asInt();
                sources.add(source("metacritic", "Metacritic", mc, String.valueOf(mc), null, url));
            }
            double rating = game.path("rating").asDouble(0);
            if (rating > 0) {
                sources.add(source("rawg", "RAWG", rating, trimNumber(rating) + "/5",
                        game.path("ratings_count").asLong(0), url));
            }
            return new ProviderResult(sources, false);
        }
        return ProviderResult.none();
    }

    // ── Books ────────────────────────────────────────────────────────

    private ProviderResult fetchOpenLibrary(MediaItem item) {
        Optional<JsonResponse> search = ExternalHttp.get(openLibrary, "OpenLibrary", b -> b.path("/search.json")
                .queryParam("title", item.getTitle()).queryParam("limit", 5)
                .queryParam("fields", "key,title,first_publish_year").build());
        if (search.isEmpty() || search.get().body() == null || search.get().status() >= 500) {
            return ProviderResult.failure();
        }
        for (JsonNode doc : search.get().body().path("docs")) {
            String workKey = text(doc.path("key"));
            if (workKey == null || !workKey.startsWith("/works/") || !similarTitle(item.getTitle(), text(doc.path("title")))) {
                continue;
            }
            Optional<JsonResponse> ratings = ExternalHttp.get(openLibrary, "OpenLibrary",
                    b -> b.path(workKey + "/ratings.json").build());
            if (ratings.isEmpty() || ratings.get().body() == null) {
                return ProviderResult.failure();
            }
            JsonNode summary = ratings.get().body().path("summary");
            long count = summary.path("count").asLong(0);
            if (count > 0 && summary.path("average").isNumber()) {
                double avg = summary.path("average").asDouble();
                return new ProviderResult(List.of(source("openLibrary", "Open Library", round1(avg),
                        trimNumber(round1(avg)) + "/5", count, "https://openlibrary.org" + workKey)), false);
            }
            return ProviderResult.none();
        }
        return ProviderResult.none();
    }

    private ProviderResult fetchGoogleBooks(MediaItem item) {
        Optional<JsonResponse> resp = ExternalHttp.get(googleBooks, "GoogleBooks", b -> {
            var builder = b.path("/volumes/{id}");
            if (!isBlank(googleBooksKey)) {
                builder.queryParam("key", googleBooksKey);
            }
            return builder.build(item.getExternalId());
        });
        if (resp.isEmpty() || resp.get().body() == null || resp.get().status() >= 500) {
            return ProviderResult.failure();
        }
        JsonNode info = resp.get().body().path("volumeInfo");
        if (!info.path("averageRating").isNumber()) {
            return ProviderResult.none();
        }
        double avg = info.path("averageRating").asDouble();
        String url = text(info.path("infoLink"));
        return new ProviderResult(List.of(source("googleBooks", "Google Books", avg, trimNumber(avg) + "/5",
                info.path("ratingsCount").isNumber() ? info.path("ratingsCount").asLong() : null,
                url != null ? url : "https://books.google.com/books?id=" + encode(item.getExternalId()))), false);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static Map<String, Object> source(String key, String label, double value, String display, Long count, String url) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("key", key);
        s.put("label", label);
        s.put("value", value);
        s.put("display", display);
        s.put("count", count);
        s.put("url", url);
        return s;
    }

    /** "7.8" -> 7.8, "1,234,567" -> 1234567, "85%" -> 85; "N/A"/blank -> null. */
    static Double parseNumber(String raw) {
        if (raw == null) {
            return null;
        }
        String cleaned = raw.replace(",", "").replace("%", "").trim();
        if (cleaned.isEmpty() || cleaned.equalsIgnoreCase("N/A")) {
            return null;
        }
        if (cleaned.contains("/")) {
            cleaned = cleaned.substring(0, cleaned.indexOf('/'));
        }
        try {
            return Double.parseDouble(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String trimNumber(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    static boolean yearMatches(Integer expected, int actual) {
        return expected == null || actual == 0 || Math.abs(expected - actual) <= 1;
    }

    static String normalizeTitle(String title) {
        if (title == null) {
            return "";
        }
        String folded = Normalizer.normalize(title, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
        return folded.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }

    /** Equal after normalisation, or token overlap >= 0.6 (so "Dune" never matches "Dune: Part Two"). */
    static boolean similarTitle(String a, String b) {
        String x = normalizeTitle(a);
        String y = normalizeTitle(b);
        if (x.isEmpty() || y.isEmpty()) {
            return false;
        }
        if (x.equals(y)) {
            return true;
        }
        Set<String> tx = new HashSet<>(Arrays.asList(x.split(" ")));
        Set<String> ty = new HashSet<>(Arrays.asList(y.split(" ")));
        Set<String> union = new HashSet<>(tx);
        union.addAll(ty);
        tx.retainAll(ty);
        return !union.isEmpty() && (double) tx.size() / union.size() >= 0.6;
    }

    private static String text(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode() || node.asText().isBlank() ? null : node.asText();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String encode(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
