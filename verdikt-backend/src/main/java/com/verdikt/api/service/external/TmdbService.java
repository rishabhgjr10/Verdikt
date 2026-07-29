package com.verdikt.api.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class TmdbService {

    private static final Logger log = LoggerFactory.getLogger(TmdbService.class);

    private final WebClient tmdbClient;
    private final String apiKey;

    public TmdbService(
            @Value("${verdikt.integrations.tmdb.api-key:your-tmdb-api-key-here}") String apiKey,
            @Value("${verdikt.integrations.tmdb.base-url:https://api.themoviedb.org/3}") String baseUrl) {

        this.apiKey = apiKey;

        // Dedicated Netty HttpClient with aggressive timeouts for local-dev resilience
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000)
                .responseTimeout(Duration.ofSeconds(10))
                .doOnConnected(conn ->
                        conn.addHandlerLast(new ReadTimeoutHandler(10, TimeUnit.SECONDS))
                            .addHandlerLast(new WriteTimeoutHandler(10, TimeUnit.SECONDS)));

        this.tmdbClient = WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.ACCEPT, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();
    }

    // ──────────────────────────── Search ────────────────────────────

    public List<MediaItemDTO> searchMovies(String query) {
        return searchMovies(query, 1);
    }

    public List<MediaItemDTO> searchMovies(String query, int page) {
        int targetPage = Math.max(1, page);
        try {
            boolean isBlank = query == null || query.isBlank();
            String path = isBlank ? "/trending/movie/week" : "/search/movie";

            JsonNode response = tmdbClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path(path)
                                .queryParam("api_key", apiKey)
                                .queryParam("page", targetPage);
                        if (!isBlank) {
                            builder.queryParam("query", query);
                        }
                        return builder.build();
                    })
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1)))
                    .onErrorResume(e -> {
                        logNetworkWarning("searchMovies", "query=" + query + ", page=" + targetPage, e);
                        return Mono.empty();
                    })
                    .block();

            if (response == null || !response.has("results")) {
                return Collections.emptyList();
            }

            List<MediaItemDTO> list = new ArrayList<>();
            for (JsonNode node : response.get("results")) {
                list.add(mapMovieNodeToDTO(node));
            }
            return list;
        } catch (Exception e) {
            logNetworkWarning("searchMovies", "query=" + query + ", page=" + targetPage, e);
            return Collections.emptyList();
        }
    }

    public List<MediaItemDTO> searchSeries(String query) {
        return searchSeries(query, 1);
    }

    public List<MediaItemDTO> searchSeries(String query, int page) {
        int targetPage = Math.max(1, page);
        try {
            boolean isBlank = query == null || query.isBlank();
            String path = isBlank ? "/discover/tv" : "/search/tv";

            JsonNode response = tmdbClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path(path)
                                .queryParam("api_key", apiKey)
                                .queryParam("page", targetPage);
                        if (isBlank) {
                            builder.queryParam("sort_by", "popularity.desc");
                        } else {
                            builder.queryParam("query", query);
                        }
                        return builder.build();
                    })
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1)))
                    .onErrorResume(e -> {
                        logNetworkWarning("searchSeries", "query=" + query + ", page=" + targetPage, e);
                        return Mono.empty();
                    })
                    .block();

            if (response == null || !response.has("results")) {
                return Collections.emptyList();
            }

            List<MediaItemDTO> list = new ArrayList<>();
            for (JsonNode node : response.get("results")) {
                list.add(mapTvNodeToDTO(node, MediaType.SERIES));
            }
            return list;
        } catch (Exception e) {
            logNetworkWarning("searchSeries", "query=" + query + ", page=" + targetPage, e);
            return Collections.emptyList();
        }
    }

    public List<MediaItemDTO> searchAnime(String query) {
        return searchAnime(query, 1);
    }

    public List<MediaItemDTO> searchAnime(String query, int page) {
        int targetPage = Math.max(1, page);
        try {
            boolean isBlank = query == null || query.isBlank();

            JsonNode response = tmdbClient.get()
                    .uri(uriBuilder -> {
                        if (isBlank) {
                            return uriBuilder.path("/discover/tv")
                                    .queryParam("api_key", apiKey)
                                    .queryParam("with_genres", "16")
                                    .queryParam("with_original_language", "ja")
                                    .queryParam("sort_by", "popularity.desc")
                                    .queryParam("page", targetPage)
                                    .build();
                        } else {
                            return uriBuilder.path("/search/tv")
                                    .queryParam("api_key", apiKey)
                                    .queryParam("query", query)
                                    .queryParam("page", targetPage)
                                    .build();
                        }
                    })
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1)))
                    .onErrorResume(e -> {
                        logNetworkWarning("searchAnime", "query=" + query + ", page=" + targetPage, e);
                        return Mono.empty();
                    })
                    .block();

            if (response == null || !response.has("results")) {
                return Collections.emptyList();
            }

            List<MediaItemDTO> list = new ArrayList<>();
            for (JsonNode node : response.get("results")) {
                list.add(mapTvNodeToDTO(node, MediaType.ANIME));
            }
            return list;
        } catch (Exception e) {
            logNetworkWarning("searchAnime", "query=" + query + ", page=" + targetPage, e);
            return Collections.emptyList();
        }
    }

    // ──────────────────────── Detail Fetching ───────────────────────

    public MediaItemDTO fetchMovieDetails(String externalId) {
        try {
            JsonNode node = tmdbClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/movie/{id}")
                            .queryParam("api_key", apiKey)
                            .queryParam("append_to_response", "videos,watch/providers")
                            .build(externalId))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1)))
                    .onErrorResume(e -> {
                        logNetworkWarning("fetchMovieDetails", "id=" + externalId, e);
                        return Mono.empty();
                    })
                    .block();

            if (node == null) {
                return null;
            }

            MediaItemDTO dto = mapMovieNodeToDTO(node);
            extractExtraDetails(node, dto);
            return dto;
        } catch (Exception e) {
            logNetworkWarning("fetchMovieDetails", "id=" + externalId, e);
            return null;
        }
    }

    public MediaItemDTO fetchSeriesDetails(String externalId, MediaType mediaType) {
        try {
            JsonNode node = tmdbClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/tv/{id}")
                            .queryParam("api_key", apiKey)
                            .queryParam("append_to_response", "videos,watch/providers")
                            .build(externalId))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.fixedDelay(2, Duration.ofSeconds(1)))
                    .onErrorResume(e -> {
                        logNetworkWarning("fetchSeriesDetails", "id=" + externalId, e);
                        return Mono.empty();
                    })
                    .block();

            if (node == null) {
                return null;
            }

            MediaItemDTO dto = mapTvNodeToDTO(node, mediaType);
            extractExtraDetails(node, dto);
            return dto;
        } catch (Exception e) {
            logNetworkWarning("fetchSeriesDetails", "id=" + externalId, e);
            return null;
        }
    }

    // ───────────────────── Internal Mapping Helpers ─────────────────

    private MediaItemDTO mapMovieNodeToDTO(JsonNode node) {
        String id = node.path("id").asText();
        String title = node.path("title").asText("");
        String releaseDate = node.path("release_date").asText("");
        Integer releaseYear = parseYear(releaseDate);
        String posterPath = node.path("poster_path").asText(null);
        String backdropPath = node.path("backdrop_path").asText(null);
        String overview = node.path("overview").asText(null);

        List<String> genres = new ArrayList<>();
        if (node.has("genres")) {
            for (JsonNode g : node.get("genres")) {
                genres.add(g.path("name").asText());
            }
        }

        return MediaItemDTO.builder()
                .externalId(id)
                .mediaType(MediaType.MOVIE)
                .title(title)
                .releaseYear(releaseYear)
                .coverImage(posterPath != null ? "https://image.tmdb.org/t/p/w500" + posterPath : null)
                .backdropImage(backdropPath != null ? "https://image.tmdb.org/t/p/w1280" + backdropPath : null)
                .description(overview)
                .genresJson(genres)
                .build();
    }

    private MediaItemDTO mapTvNodeToDTO(JsonNode node, MediaType defaultType) {
        String id = node.path("id").asText();
        String title = node.path("name").asText("");
        String firstAirDate = node.path("first_air_date").asText("");
        Integer releaseYear = parseYear(firstAirDate);
        String posterPath = node.path("poster_path").asText(null);
        String backdropPath = node.path("backdrop_path").asText(null);
        String overview = node.path("overview").asText(null);

        List<String> genres = new ArrayList<>();
        if (node.has("genres")) {
            for (JsonNode g : node.get("genres")) {
                genres.add(g.path("name").asText());
            }
        }

        MediaType finalType = defaultType;
        if (defaultType == MediaType.SERIES && (genres.contains("Animation") || genres.contains("Anime"))) {
            String originCountry = node.path("origin_country").toString();
            if (originCountry.contains("JP")) {
                finalType = MediaType.ANIME;
            }
        }

        List<String> creators = new ArrayList<>();
        if (node.has("created_by")) {
            for (JsonNode c : node.get("created_by")) {
                creators.add(c.path("name").asText());
            }
        }

        return MediaItemDTO.builder()
                .externalId(id)
                .mediaType(finalType)
                .title(title)
                .releaseYear(releaseYear)
                .coverImage(posterPath != null ? "https://image.tmdb.org/t/p/w500" + posterPath : null)
                .backdropImage(backdropPath != null ? "https://image.tmdb.org/t/p/w1280" + backdropPath : null)
                .description(overview)
                .creatorsJson(creators)
                .genresJson(genres)
                .build();
    }

    private void extractExtraDetails(JsonNode node, MediaItemDTO dto) {
        if (node.has("videos") && node.get("videos").has("results")) {
            for (JsonNode video : node.get("videos").get("results")) {
                String site = video.path("site").asText("");
                String type = video.path("type").asText("");
                String key = video.path("key").asText("");
                if ("YouTube".equalsIgnoreCase(site) && ("Trailer".equalsIgnoreCase(type) || dto.getTrailerUrl() == null)) {
                    dto.setTrailerUrl("https://www.youtube.com/watch?v=" + key);
                    if ("Trailer".equalsIgnoreCase(type)) {
                        break;
                    }
                }
            }
        }

        List<String> platforms = new ArrayList<>();
        if (node.has("watch/providers") && node.get("watch/providers").has("results")) {
            JsonNode results = node.get("watch/providers").get("results");
            JsonNode us = results.has("US") ? results.get("US") : (results.fieldNames().hasNext() ? results.get(results.fieldNames().next()) : null);
            if (us != null && us.has("flatrate")) {
                for (JsonNode provider : us.get("flatrate")) {
                    platforms.add(provider.path("provider_name").asText());
                }
            }
        }
        if (!platforms.isEmpty()) {
            dto.setPlatformsJson(platforms);
        }
    }

    // ────────────────────── Logging / Utilities ─────────────────────

    /**
     * Unified warning logger for network/timeout failures.
     * Logs the method, context, root-cause class, and message at WARN level
     * so failures are visible but don't pollute ERROR dashboards.
     */
    private void logNetworkWarning(String method, String context, Throwable ex) {
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        log.warn("TMDB {} failed [{}] — {} : {}",
                method, context, root.getClass().getSimpleName(), root.getMessage());
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
