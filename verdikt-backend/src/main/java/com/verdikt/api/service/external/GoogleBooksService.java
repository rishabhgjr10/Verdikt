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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

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

    public List<MediaItemDTO> searchBooks(String query) {
        return searchBooks(query, 1);
    }

    public List<MediaItemDTO> searchBooks(String query, int page) {
        int targetPage = Math.max(1, page);
        int maxResults = 40;
        int startIndex = (targetPage - 1) * maxResults;
        String q = (query == null || query.isBlank()) ? "bestseller" : query;

        try {
            String uri = baseUrl + "/volumes?q=" + q + "&maxResults=" + maxResults + "&startIndex=" + startIndex;
            if (apiKey != null && !apiKey.contains("your-")) {
                uri += "&key=" + apiKey;
            }

            JsonNode response = webClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .onErrorResume(e -> {
                        log.error("Error searching Google Books: {}", e.getMessage());
                        return Mono.empty();
                    })
                    .block();

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

    public MediaItemDTO fetchBookDetails(String externalId) {
        try {
            String uri = baseUrl + "/volumes/" + externalId;
            if (apiKey != null && !apiKey.contains("your-")) {
                uri += "?key=" + apiKey;
            }

            JsonNode node = webClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .onErrorResume(e -> {
                        log.error("Error fetching Google Books volume details: {}", e.getMessage());
                        return Mono.empty();
                    })
                    .block();

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
