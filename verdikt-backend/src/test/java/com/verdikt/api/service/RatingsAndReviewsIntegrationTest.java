package com.verdikt.api.service;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.repository.MediaItemRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ratings and external reviews against a local stub HTTP server standing in for
 * TMDB, OMDb, AniList, RAWG, Open Library and Google Books. No real provider is called.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class RatingsAndReviewsIntegrationTest {

    private static final String TMDB_KEY = "stub-tmdb-key-123";
    private static final String OMDB_KEY = "stub-omdb-key-456";
    private static final String RAWG_KEY = "stub-rawg-key-789";
    private static final Map<String, AtomicInteger> HITS = new ConcurrentHashMap<>();
    private static final HttpServer SERVER = startServer();

    @DynamicPropertySource
    static void providers(DynamicPropertyRegistry registry) {
        String base = "http://127.0.0.1:" + SERVER.getAddress().getPort();
        registry.add("verdikt.integrations.tmdb.api-key", () -> TMDB_KEY);
        registry.add("verdikt.integrations.tmdb.base-url", () -> base + "/tmdb");
        registry.add("verdikt.integrations.omdb.api-key", () -> OMDB_KEY);
        registry.add("verdikt.integrations.omdb.base-url", () -> base + "/omdb");
        registry.add("verdikt.integrations.rawg.api-key", () -> RAWG_KEY);
        registry.add("verdikt.integrations.rawg.base-url", () -> base + "/rawg");
        registry.add("verdikt.integrations.anilist.base-url", () -> base + "/anilist");
        registry.add("verdikt.integrations.openlibrary.base-url", () -> base + "/ol");
        registry.add("verdikt.integrations.google-books.base-url", () -> base + "/gb");
    }

    @Autowired RatingsService ratingsService;
    @Autowired ExternalReviewsService externalReviewsService;
    @Autowired MediaItemRepository mediaItemRepository;
    @Autowired MockMvc mvc;

    @BeforeEach
    void reset() {
        HITS.clear();
        ratingsService.clearMemory();
        ratingsService.resetOmdbBackoff();
    }

    @AfterEach
    void cleanUp() {
        mediaItemRepository.deleteAllInBatch();
    }

    @AfterAll
    static void stopServer() {
        SERVER.stop(0);
    }

    private MediaItem media(String externalId, MediaType type, String title, Integer year) {
        return mediaItemRepository.save(MediaItem.builder().externalId(externalId).mediaType(type)
                .title(title).releaseYear(year).build());
    }

    private static int hits(String key) {
        return HITS.getOrDefault(key, new AtomicInteger()).get();
    }

    private static List<Object> keys(List<Map<String, Object>> sources) {
        return sources.stream().map(s -> s.get("key")).toList();
    }

    @Test
    @DisplayName("Movie: IMDb + Rotten Tomatoes + Metascore via TMDB external_ids and OMDb, stored in ratings_json")
    void movieRatings() {
        MediaItem dune = media("438631", MediaType.MOVIE, "Dune", 2021);
        List<Map<String, Object>> sources = ratingsService.getRatings(dune.getId());

        assertThat(keys(sources)).containsExactly("imdb", "rottenTomatoes", "metascore");
        assertThat(sources.get(0)).containsEntry("display", "8.0").containsEntry("count", 900123L)
                .containsEntry("url", "https://www.imdb.com/title/tt1160419/");
        MediaItem stored = mediaItemRepository.findById(dune.getId()).orElseThrow();
        assertThat(stored.getImdbId()).isEqualTo("tt1160419");
        assertThat(stored.getRatingsJson()).hasSize(3);
        assertThat(stored.getRatingsFetchedAt()).isNotNull();
    }

    @Test
    @DisplayName("10 parallel requests trigger exactly one provider fetch; the next is served from cache")
    void singleFlight() throws Exception {
        MediaItem dune = media("438631", MediaType.MOVIE, "Dune", 2021);
        int before = ratingsService.providerFetchCount();
        ExecutorService pool = Executors.newFixedThreadPool(10);
        List<Callable<List<Map<String, Object>>>> calls = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            calls.add(() -> ratingsService.getRatings(dune.getId()));
        }
        List<Future<List<Map<String, Object>>>> results = pool.invokeAll(calls);
        pool.shutdown();
        for (Future<List<Map<String, Object>>> f : results) {
            assertThat(keys(f.get())).containsExactly("imdb", "rottenTomatoes", "metascore");
        }
        assertThat(ratingsService.providerFetchCount() - before).isEqualTo(1);
        assertThat(hits("omdb")).isEqualTo(1);

        ratingsService.getRatings(dune.getId());
        assertThat(hits("omdb")).isEqualTo(1);
        assertThat(ratingsService.providerFetchCount() - before).isEqualTo(1);
    }

    @Test
    @DisplayName("Stored ratings are served without provider calls; stale ones are served and refreshed")
    void storedAndStale() throws Exception {
        MediaItem dune = media("438631", MediaType.MOVIE, "Dune", 2021);
        ratingsService.getRatings(dune.getId());
        ratingsService.clearMemory();
        HITS.clear();

        assertThat(ratingsService.getRatings(dune.getId())).hasSize(3);
        assertThat(hits("omdb")).isZero();

        MediaItem stale = mediaItemRepository.findById(dune.getId()).orElseThrow();
        stale.setRatingsFetchedAt(Instant.now().minus(8, ChronoUnit.DAYS));
        mediaItemRepository.save(stale);
        ratingsService.clearMemory();

        assertThat(ratingsService.getRatings(dune.getId())).hasSize(3); // stale answer, immediately
        for (int i = 0; i < 50 && hits("omdb") == 0; i++) {
            Thread.sleep(100);
        }
        assertThat(hits("omdb")).isEqualTo(1);
    }

    @Test
    @DisplayName("Series without a Rotten Tomatoes score: N/A values are ignored")
    void seriesWithoutRottenTomatoes() {
        MediaItem arcane = media("94605", MediaType.SERIES, "Arcane", 2021);
        assertThat(keys(ratingsService.getRatings(arcane.getId()))).containsExactly("imdb");
    }

    @Test
    @DisplayName("Anime: AniList score accepted only for a similar title within one year")
    void animeAniList() {
        MediaItem frieren = media("209867", MediaType.ANIME, "Frieren: Beyond Journey's End", 2023);
        assertThat(keys(ratingsService.getRatings(frieren.getId()))).containsExactly("imdb", "anilist");

        MediaItem wrongYear = media("209868", MediaType.ANIME, "Frieren: Beyond Journey's End", 2010);
        assertThat(keys(ratingsService.getRatings(wrongYear.getId()))).doesNotContain("anilist");
    }

    @Test
    @DisplayName("Game via RAWG and book via Open Library")
    void gameAndBook() {
        MediaItem game = media("1942", MediaType.GAME, "The Witcher 3: Wild Hunt", 2015);
        assertThat(keys(ratingsService.getRatings(game.getId()))).containsExactly("metacritic", "rawg");

        MediaItem book = media("gb-dune", MediaType.BOOK, "Dune", 1965);
        List<Map<String, Object>> bookSources = ratingsService.getRatings(book.getId());
        assertThat(keys(bookSources)).containsExactly("openLibrary");
        assertThat(bookSources.get(0)).containsEntry("display", "4.3/5");
    }

    @Test
    @DisplayName("A provider timeout returns no badges within the 8s budget and nothing is stored")
    void providerTimeout() {
        MediaItem slow = media("SLOW", MediaType.MOVIE, "Slow Movie", 2020);
        long start = System.nanoTime();
        assertThat(ratingsService.getRatings(slow.getId())).isEmpty();
        long seconds = (System.nanoTime() - start) / 1_000_000_000L;
        assertThat(seconds).isLessThan(12);
        assertThat(mediaItemRepository.findById(slow.getId()).orElseThrow().getRatingsFetchedAt()).isNull();
    }

    @Test
    @DisplayName("OMDb daily limit pauses OMDb calls and never stores the failed fetch")
    void omdbLimit() {
        MediaItem limited = media("LIMIT", MediaType.MOVIE, "Limited", 2020);
        assertThat(ratingsService.getRatings(limited.getId())).isEmpty();
        assertThat(hits("omdb")).isEqualTo(1);

        MediaItem other = media("438632", MediaType.MOVIE, "Dune Part Two", 2024);
        ratingsService.getRatings(other.getId());
        assertThat(hits("omdb")).isEqualTo(1); // blocked for an hour
        assertThat(mediaItemRepository.findById(other.getId()).orElseThrow().getRatingsFetchedAt()).isNull();
    }

    @Test
    @DisplayName("Provider keys never appear in API responses or logs")
    void keysNeverLeak(CapturedOutput output) throws Exception {
        MediaItem dune = media("438631", MediaType.MOVIE, "Dune", 2021);
        MediaItem slow = media("SLOW", MediaType.MOVIE, "Slow Movie", 2020);
        String body = mvc.perform(get("/api/media/{id}/ratings", dune.getId())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String reviews = mvc.perform(get("/api/media/{id}/external-reviews", dune.getId())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/media/{id}/ratings", slow.getId())).andExpect(status().isOk());

        for (String key : List.of(TMDB_KEY, OMDB_KEY, RAWG_KEY)) {
            assertThat(body).doesNotContain(key);
            assertThat(reviews).doesNotContain(key);
            assertThat(output.getAll()).doesNotContain(key);
        }
    }

    @Test
    @DisplayName("External reviews: plain-text excerpts, max 6, games empty, TMDB failure empty")
    void externalReviews() {
        MediaItem dune = media("438631", MediaType.MOVIE, "Dune", 2021);
        var reviews = externalReviewsService.getReviews(dune.getId());
        assertThat(reviews).hasSize(6);
        assertThat(reviews.get(0).excerpt()).doesNotContain("**").doesNotContain("<b>").doesNotContain("](");
        assertThat(reviews.get(0).excerpt()).startsWith("Bold claim and a link here.");
        assertThat(reviews.get(0).excerpt().length()).isLessThanOrEqualTo(ExternalReviewsService.EXCERPT_LENGTH + 1);
        assertThat(reviews.get(0).excerpt()).endsWith("…");
        assertThat(reviews.get(0).rating()).isEqualTo(8.0);

        MediaItem arcane = media("94605", MediaType.SERIES, "Arcane", 2021);
        assertThat(externalReviewsService.getReviews(arcane.getId())).hasSize(1);

        MediaItem game = media("1942", MediaType.GAME, "The Witcher 3: Wild Hunt", 2015);
        assertThat(externalReviewsService.getReviews(game.getId())).isEmpty();

        MediaItem broken = media("BROKEN", MediaType.MOVIE, "Broken", 2020);
        assertThat(externalReviewsService.getReviews(broken.getId())).isEmpty();
    }

    @Test
    void parsingHelpers() {
        assertThat(RatingsService.parseNumber("1,234,567")).isEqualTo(1234567.0);
        assertThat(RatingsService.parseNumber("85%")).isEqualTo(85.0);
        assertThat(RatingsService.parseNumber("74/100")).isEqualTo(74.0);
        assertThat(RatingsService.parseNumber("N/A")).isNull();
        assertThat(RatingsService.similarTitle("Frieren: Beyond Journey's End", "Frieren: Beyond Journey’s End")).isTrue();
        assertThat(RatingsService.similarTitle("Dune", "Dune: Part Two")).isFalse();
        assertThat(RatingsService.yearMatches(2023, 2024)).isTrue();
        assertThat(RatingsService.yearMatches(2023, 2025)).isFalse();
    }

    // ── Stub providers ───────────────────────────────────────────────

    private static HttpServer startServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            server.createContext("/tmdb", RatingsAndReviewsIntegrationTest::tmdb);
            server.createContext("/omdb", RatingsAndReviewsIntegrationTest::omdb);
            server.createContext("/anilist", ex -> respond(ex, 200, hit("anilist",
                    "{\"data\":{\"Page\":{\"media\":[{\"siteUrl\":\"https://anilist.co/anime/154587\",\"averageScore\":91,"
                            + "\"seasonYear\":2023,\"startDate\":{\"year\":2023},\"title\":{\"romaji\":\"Sousou no Frieren\","
                            + "\"english\":\"Frieren: Beyond Journey’s End\",\"native\":\"葬送のフリーレン\"}}]}}}")));
            server.createContext("/rawg", ex -> respond(ex, 200, hit("rawg",
                    "{\"results\":[{\"name\":\"The Witcher 3: Wild Hunt\",\"slug\":\"the-witcher-3-wild-hunt\","
                            + "\"released\":\"2015-05-18\",\"metacritic\":92,\"rating\":4.66,\"ratings_count\":6500}]}")));
            server.createContext("/ol", ex -> {
                if (ex.getRequestURI().getPath().endsWith("ratings.json")) {
                    respond(ex, 200, hit("ol", "{\"summary\":{\"average\":4.2857,\"count\":120}}"));
                } else {
                    respond(ex, 200, hit("ol", "{\"docs\":[{\"key\":\"/works/OL893415W\",\"title\":\"Dune\",\"first_publish_year\":1965}]}"));
                }
            });
            server.createContext("/gb", ex -> respond(ex, 200, hit("gb", "{\"volumeInfo\":{\"averageRating\":4.0,\"ratingsCount\":10}}")));
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hit(String key, String body) {
        HITS.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();
        return body;
    }

    private static void tmdb(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path.endsWith("/external_ids")) {
            String imdb = path.contains("/SLOW/") ? "ttSLOW" : path.contains("/LIMIT/") ? "ttLIMIT"
                    : path.contains("/tv/94605/") ? "tt11126994" : path.contains("/tv/") ? "tt22248376" : "tt1160419";
            respond(ex, 200, hit("tmdb", "{\"imdb_id\":\"" + imdb + "\"}"));
        } else if (path.endsWith("/reviews")) {
            if (path.contains("BROKEN")) {
                respond(ex, 500, hit("tmdb", "{\"status_message\":\"boom\"}"));
                return;
            }
            StringBuilder results = new StringBuilder();
            int count = path.contains("/tv/") ? 1 : 8;
            String longText = "**Bold** claim and a [link](https://example.com) here. <b>Tags</b> vanish. "
                    + "word ".repeat(150);
            for (int i = 0; i < count; i++) {
                if (i > 0) results.append(',');
                results.append("{\"author\":\"critic_").append(i).append("\",\"author_details\":{\"username\":\"critic_")
                        .append(i).append("\",\"rating\":8.0},\"content\":\"").append(longText)
                        .append("\",\"created_at\":\"2021-10-22T10:00:00.000Z\",\"url\":\"https://www.themoviedb.org/review/")
                        .append(i).append("\"}");
            }
            respond(ex, 200, hit("tmdb", "{\"results\":[" + results + "]}"));
        } else {
            respond(ex, 404, "{}");
        }
    }

    private static void omdb(HttpExchange ex) throws IOException {
        String query = ex.getRequestURI().getQuery();
        hit("omdb", "");
        if (!query.contains("apikey=" + OMDB_KEY)) {
            respond(ex, 401, "{\"Response\":\"False\",\"Error\":\"No API key provided.\"}");
        } else if (query.contains("ttSLOW")) {
            sleep(10_000);
            respond(ex, 200, "{}");
        } else if (query.contains("ttLIMIT")) {
            respond(ex, 401, "{\"Response\":\"False\",\"Error\":\"Request limit reached!\"}");
        } else if (query.contains("tt11126994")) {
            respond(ex, 200, "{\"Response\":\"True\",\"imdbRating\":\"9.0\",\"imdbVotes\":\"350,000\","
                    + "\"Ratings\":[{\"Source\":\"Rotten Tomatoes\",\"Value\":\"N/A\"}],\"Metascore\":\"N/A\"}");
        } else if (query.contains("tt22248376")) {
            respond(ex, 200, "{\"Response\":\"True\",\"imdbRating\":\"8.9\",\"imdbVotes\":\"40,000\",\"Ratings\":[],\"Metascore\":\"N/A\"}");
        } else {
            sleep(400); // keep the single-flight window open
            respond(ex, 200, "{\"Response\":\"True\",\"imdbRating\":\"8.0\",\"imdbVotes\":\"900,123\","
                    + "\"Ratings\":[{\"Source\":\"Internet Movie Database\",\"Value\":\"8.0/10\"},"
                    + "{\"Source\":\"Rotten Tomatoes\",\"Value\":\"83%\"}],\"Metascore\":\"74\"}");
        }
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void respond(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
