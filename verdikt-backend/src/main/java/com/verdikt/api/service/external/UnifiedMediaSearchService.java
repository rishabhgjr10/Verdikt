package com.verdikt.api.service.external;

import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class UnifiedMediaSearchService {

    private static final Logger log = LoggerFactory.getLogger(UnifiedMediaSearchService.class);

    private final TmdbService tmdbService;
    private final IgdbService igdbService;
    private final GoogleBooksService googleBooksService;

    public UnifiedMediaSearchService(TmdbService tmdbService, IgdbService igdbService, GoogleBooksService googleBooksService) {
        this.tmdbService = tmdbService;
        this.igdbService = igdbService;
        this.googleBooksService = googleBooksService;
    }

    public List<MediaItemDTO> search(String query, String mediaTypeFilter) {
        return search(query, mediaTypeFilter, 1);
    }

    public List<MediaItemDTO> search(String query, String mediaTypeFilter, int page) {
        String typeUpper = mediaTypeFilter != null ? mediaTypeFilter.trim().toUpperCase() : "ALL";

        switch (typeUpper) {
            case "MOVIE":
                return tmdbService.searchMovies(query, page);
            case "SERIES":
                return tmdbService.searchSeries(query, page);
            case "ANIME":
                return tmdbService.searchAnime(query, page);
            case "GAME":
                return igdbService.searchGames(query, page);
            case "BOOK":
                return googleBooksService.searchBooks(query, page);
            case "ALL":
            default:
                return searchAllInParallel(query, page);
        }
    }

    public MediaItemDTO fetchExternalDetails(String externalId, MediaType mediaType) {
        if (externalId == null || mediaType == null) {
            return null;
        }

        switch (mediaType) {
            case MOVIE:
                return tmdbService.fetchMovieDetails(externalId);
            case SERIES:
            case ANIME:
                return tmdbService.fetchSeriesDetails(externalId, mediaType);
            case GAME:
                return igdbService.fetchGameDetails(externalId);
            case BOOK:
                return googleBooksService.fetchBookDetails(externalId);
            default:
                return null;
        }
    }

    private List<MediaItemDTO> searchAllInParallel(String query, int page) {
        try {
            CompletableFuture<List<MediaItemDTO>> moviesFuture = CompletableFuture.supplyAsync(() -> tmdbService.searchMovies(query, page));
            CompletableFuture<List<MediaItemDTO>> seriesFuture = CompletableFuture.supplyAsync(() -> tmdbService.searchSeries(query, page));
            CompletableFuture<List<MediaItemDTO>> animeFuture = CompletableFuture.supplyAsync(() -> tmdbService.searchAnime(query, page));
            CompletableFuture<List<MediaItemDTO>> gamesFuture = CompletableFuture.supplyAsync(() -> igdbService.searchGames(query, page));
            CompletableFuture<List<MediaItemDTO>> booksFuture = CompletableFuture.supplyAsync(() -> googleBooksService.searchBooks(query, page));

            CompletableFuture.allOf(moviesFuture, seriesFuture, animeFuture, gamesFuture, booksFuture).join();

            List<MediaItemDTO> results = new ArrayList<>();
            results.addAll(moviesFuture.get());
            results.addAll(seriesFuture.get());
            results.addAll(animeFuture.get());
            results.addAll(gamesFuture.get());
            results.addAll(booksFuture.get());

            return results;
        } catch (Exception e) {
            log.error("Error performing parallel media search across services", e);
            return Collections.emptyList();
        }
    }
}
