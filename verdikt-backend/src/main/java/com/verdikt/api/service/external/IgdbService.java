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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class IgdbService {

    private static final Logger log = LoggerFactory.getLogger(IgdbService.class);

    private final WebClient webClient;

    @Value("${verdikt.integrations.igdb.client-id:your-igdb-client-id-here}")
    private String clientId;

    @Value("${verdikt.integrations.igdb.client-secret:your-igdb-client-secret-here}")
    private String clientSecret;

    @Value("${verdikt.integrations.igdb.base-url:https://api.igdb.com/v4}")
    private String baseUrl;

    private String cachedBearerToken;
    private Instant tokenExpiration = Instant.MIN;

    public IgdbService(WebClient webClient) {
        this.webClient = webClient;
    }

    private synchronized String getBearerToken() {
        if (cachedBearerToken != null && Instant.now().isBefore(tokenExpiration)) {
            return cachedBearerToken;
        }

        if (clientId == null || clientId.contains("your-") || clientSecret == null || clientSecret.contains("your-")) {
            log.warn("IGDB client-id or client-secret not configured properly.");
            return null;
        }

        try {
            String tokenUrl = "https://id.twitch.tv/oauth2/token?client_id=" + clientId
                    + "&client_secret=" + clientSecret
                    + "&grant_type=client_credentials";

            JsonNode response = webClient.post()
                    .uri(tokenUrl)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .onErrorResume(e -> {
                        log.error("Failed to obtain Twitch OAuth token for IGDB: {}", e.getMessage());
                        return Mono.empty();
                    })
                    .block();

            if (response != null && response.has("access_token")) {
                cachedBearerToken = response.get("access_token").asText();
                long expiresIn = response.path("expires_in").asLong(3600);
                tokenExpiration = Instant.now().plusSeconds(expiresIn - 60);
                return cachedBearerToken;
            }
        } catch (Exception e) {
            log.error("Exception fetching IGDB Bearer token", e);
        }
        return null;
    }

    public List<MediaItemDTO> searchGames(String query) {
        return searchGames(query, 1);
    }

    public List<MediaItemDTO> searchGames(String query, int page) {
        String token = getBearerToken();
        if (token == null) {
            log.warn("Skipping IGDB search due to missing OAuth token");
            return Collections.emptyList();
        }

        int targetPage = Math.max(1, page);
        int limit = 20;
        int offset = (targetPage - 1) * limit;
        String q = (query == null || query.isBlank()) ? "Zelda" : query;

        try {
            String body = "search \"" + q.replace("\"", "\\\"") + "\"; "
                    + "fields name, summary, first_release_date, cover.url, artworks.url, screenshots.url, videos.video_id, platforms.name, genres.name, involved_companies.company.name; "
                    + "limit " + limit + "; offset " + offset + ";";

            JsonNode response = webClient.post()
                    .uri(baseUrl + "/games")
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + token)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .onErrorResume(e -> {
                        log.error("Error executing IGDB game search: {}", e.getMessage());
                        return Mono.empty();
                    })
                    .block();

            if (response == null || !response.isArray()) {
                return Collections.emptyList();
            }

            List<MediaItemDTO> list = new ArrayList<>();
            for (JsonNode node : response) {
                list.add(mapGameNodeToDTO(node));
            }
            return list;
        } catch (Exception e) {
            log.error("Failed to execute IGDB search", e);
            return Collections.emptyList();
        }
    }

    public MediaItemDTO fetchGameDetails(String externalId) {
        String token = getBearerToken();
        if (token == null) {
            return null;
        }

        try {
            String body = "where id = " + externalId + "; "
                    + "fields name, summary, first_release_date, cover.url, artworks.url, screenshots.url, videos.video_id, platforms.name, genres.name, involved_companies.company.name;";

            JsonNode response = webClient.post()
                    .uri(baseUrl + "/games")
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + token)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .onErrorResume(e -> {
                        log.error("Error fetching IGDB game details: {}", e.getMessage());
                        return Mono.empty();
                    })
                    .block();

            if (response == null || !response.isArray() || response.isEmpty()) {
                return null;
            }

            return mapGameNodeToDTO(response.get(0));
        } catch (Exception e) {
            log.error("Failed to fetch IGDB game details", e);
            return null;
        }
    }

    private MediaItemDTO mapGameNodeToDTO(JsonNode node) {
        String id = node.path("id").asText();
        String title = node.path("name").asText("");
        String summary = node.path("summary").asText(null);

        Integer releaseYear = null;
        if (node.has("first_release_date")) {
            long unixSeconds = node.get("first_release_date").asLong();
            releaseYear = Instant.ofEpochSecond(unixSeconds).atZone(java.time.ZoneId.of("UTC")).getYear();
        }

        String coverUrl = null;
        if (node.has("cover") && node.get("cover").has("url")) {
            coverUrl = formatIgdbImageUrl(node.get("cover").get("url").asText(), "t_cover_big");
        }

        String backdropUrl = null;
        if (node.has("artworks") && node.get("artworks").isArray() && !node.get("artworks").isEmpty()) {
            backdropUrl = formatIgdbImageUrl(node.get("artworks").get(0).path("url").asText(), "t_1080p");
        } else if (node.has("screenshots") && node.get("screenshots").isArray() && !node.get("screenshots").isEmpty()) {
            backdropUrl = formatIgdbImageUrl(node.get("screenshots").get(0).path("url").asText(), "t_1080p");
        }

        String trailerUrl = null;
        if (node.has("videos") && node.get("videos").isArray() && !node.get("videos").isEmpty()) {
            String videoId = node.get("videos").get(0).path("video_id").asText(null);
            if (videoId != null && !videoId.isBlank()) {
                trailerUrl = "https://www.youtube.com/watch?v=" + videoId;
            }
        }

        List<String> genres = new ArrayList<>();
        if (node.has("genres") && node.get("genres").isArray()) {
            for (JsonNode g : node.get("genres")) {
                genres.add(g.path("name").asText());
            }
        }

        List<String> platforms = new ArrayList<>();
        if (node.has("platforms") && node.get("platforms").isArray()) {
            for (JsonNode p : node.get("platforms")) {
                platforms.add(p.path("name").asText());
            }
        }

        List<String> creators = new ArrayList<>();
        if (node.has("involved_companies") && node.get("involved_companies").isArray()) {
            for (JsonNode ic : node.get("involved_companies")) {
                if (ic.has("company")) {
                    creators.add(ic.get("company").path("name").asText());
                }
            }
        }

        return MediaItemDTO.builder()
                .externalId(id)
                .mediaType(MediaType.GAME)
                .title(title)
                .releaseYear(releaseYear)
                .coverImage(coverUrl)
                .backdropImage(backdropUrl)
                .description(summary)
                .trailerUrl(trailerUrl)
                .creatorsJson(creators)
                .genresJson(genres)
                .platformsJson(platforms)
                .build();
    }

    private String formatIgdbImageUrl(String url, String size) {
        if (url == null || url.isBlank()) {
            return null;
        }
        if (url.startsWith("//")) {
            url = "https:" + url;
        }
        return url.replace("t_thumb", size);
    }
}
