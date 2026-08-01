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
import java.util.function.Supplier;

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
        try {
            String typeUpper = mediaTypeFilter != null ? mediaTypeFilter.trim().toUpperCase() : "ALL";

            switch (typeUpper) {
                case "MOVIE":
                    return safeCall(() -> tmdbService.searchMovies(query, page), "MOVIE");
                case "SERIES":
                    return safeCall(() -> tmdbService.searchSeries(query, page), "SERIES");
                case "ANIME":
                    return safeCall(() -> tmdbService.searchAnime(query, page), "ANIME");
                case "GAME":
                    return safeCall(() -> igdbService.searchGames(query, page), "GAME");
                case "BOOK":
                    return safeCall(() -> googleBooksService.searchBooks(query, page), "BOOK");
                case "ALL":
                default:
                    return searchAllInParallel(query, page);
            }
        } catch (Exception e) {
            log.error("Exception in UnifiedMediaSearchService.search: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    public MediaItemDTO fetchExternalDetails(String externalId, MediaType mediaType) {
        if (externalId == null || mediaType == null) {
            return null;
        }

        try {
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
        } catch (Exception e) {
            log.error("Exception fetching external details [id={}, type={}]: {}", externalId, mediaType, e.getMessage(), e);
            return null;
        }
    }

    private List<MediaItemDTO> searchAllInParallel(String query, int page) {
        CompletableFuture<List<MediaItemDTO>> moviesFuture = CompletableFuture.supplyAsync(() -> safeCall(() -> tmdbService.searchMovies(query, page), "MOVIE"));
        CompletableFuture<List<MediaItemDTO>> seriesFuture = CompletableFuture.supplyAsync(() -> safeCall(() -> tmdbService.searchSeries(query, page), "SERIES"));
        CompletableFuture<List<MediaItemDTO>> animeFuture = CompletableFuture.supplyAsync(() -> safeCall(() -> tmdbService.searchAnime(query, page), "ANIME"));
        CompletableFuture<List<MediaItemDTO>> gamesFuture = CompletableFuture.supplyAsync(() -> safeCall(() -> igdbService.searchGames(query, page), "GAME"));
        CompletableFuture<List<MediaItemDTO>> booksFuture = CompletableFuture.supplyAsync(() -> safeCall(() -> googleBooksService.searchBooks(query, page), "BOOK"));

        try {
            CompletableFuture.allOf(moviesFuture, seriesFuture, animeFuture, gamesFuture, booksFuture).join();
        } catch (Exception e) {
            log.warn("One or more parallel search futures encountered an exception: {}", e.getMessage());
        }

        List<MediaItemDTO> results = new ArrayList<>();
        addSafeResults(results, moviesFuture);
        addSafeResults(results, seriesFuture);
        addSafeResults(results, animeFuture);
        addSafeResults(results, gamesFuture);
        addSafeResults(results, booksFuture);

        return results;
    }

    private List<MediaItemDTO> safeCall(Supplier<List<MediaItemDTO>> supplier, String serviceName) {
        try {
            List<MediaItemDTO> list = supplier.get();
            return list != null ? list : Collections.emptyList();
        } catch (Exception e) {
            log.warn("External provider [{}] search failed: {}", serviceName, e.getMessage());
            return Collections.emptyList();
        }
    }

    private void addSafeResults(List<MediaItemDTO> target, CompletableFuture<List<MediaItemDTO>> future) {
        try {
            List<MediaItemDTO> items = future.get();
            if (items != null) {
                target.addAll(items);
            }
        } catch (Exception e) {
            log.warn("Failed to retrieve async search results from future: {}", e.getMessage());
        }
    }
}
