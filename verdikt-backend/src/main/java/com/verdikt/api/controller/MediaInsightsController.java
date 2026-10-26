package com.verdikt.api.controller;

import com.verdikt.api.service.ExternalReviewsService;
import com.verdikt.api.service.RatingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Public, read-only external data for the media page: rating badges and TMDB reviews. */
@RestController
@RequestMapping("/api/media")
public class MediaInsightsController {

    private final RatingsService ratingsService;
    private final ExternalReviewsService externalReviewsService;

    public MediaInsightsController(RatingsService ratingsService, ExternalReviewsService externalReviewsService) {
        this.ratingsService = ratingsService;
        this.externalReviewsService = externalReviewsService;
    }

    @GetMapping("/{id}/ratings")
    public Map<String, List<Map<String, Object>>> ratings(@PathVariable UUID id) {
        return Map.of("sources", ratingsService.getRatings(id));
    }

    @GetMapping("/{id}/external-reviews")
    public Map<String, List<ExternalReviewsService.ExternalReview>> externalReviews(@PathVariable UUID id) {
        return Map.of("reviews", externalReviewsService.getReviews(id));
    }
}
