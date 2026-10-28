package com.verdikt.api.controller;

import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.service.MostInterestedService;
import com.verdikt.api.service.UserMediaService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Per-user media state (auth required, see SecurityConfig) and the public Most Interested ranking.
 */
@RestController
@RequestMapping("/api")
public class UserMediaController {

    private final UserMediaService userMediaService;
    private final MostInterestedService mostInterestedService;

    public UserMediaController(UserMediaService userMediaService, MostInterestedService mostInterestedService) {
        this.userMediaService = userMediaService;
        this.mostInterestedService = mostInterestedService;
    }

    public record ToggleRequest(Boolean value) {
        boolean required() {
            if (value == null) {
                throw new BadRequestException("value (true/false) is required");
            }
            return value;
        }
    }

    @GetMapping("/media/{id}/me")
    public UserMediaService.MediaUserState getState(@PathVariable UUID id,
                                                    @AuthenticationPrincipal UserDetails user) {
        return userMediaService.getState(user.getUsername(), id);
    }

    @PutMapping("/media/{id}/watched")
    public UserMediaService.WatchedResult setWatched(@PathVariable UUID id,
                                                     @RequestBody ToggleRequest body,
                                                     @AuthenticationPrincipal UserDetails user) {
        return userMediaService.setWatched(user.getUsername(), id, body.required());
    }

    @PutMapping("/media/{id}/watch-later")
    public UserMediaService.WatchLaterResult setWatchLater(@PathVariable UUID id,
                                                           @RequestBody ToggleRequest body,
                                                           @AuthenticationPrincipal UserDetails user) {
        return userMediaService.setWatchLater(user.getUsername(), id, body.required());
    }

    @PutMapping("/media/{id}/favorite")
    public UserMediaService.FavoriteResult setFavorite(@PathVariable UUID id,
                                                       @RequestBody ToggleRequest body,
                                                       @AuthenticationPrincipal UserDetails user) {
        return userMediaService.setFavorite(user.getUsername(), id, body.required());
    }

    @GetMapping("/me/watch-later")
    public List<MediaItemDTO> getWatchLater(@AuthenticationPrincipal UserDetails user) {
        return userMediaService.getWatchLater(user.getUsername());
    }

    @GetMapping("/me/favorites")
    public List<MediaItemDTO> getFavorites(@AuthenticationPrincipal UserDetails user) {
        return userMediaService.getFavorites(user.getUsername());
    }

    @GetMapping("/media/most-interested")
    public ResponseEntity<List<MostInterestedService.MostInterestedItem>> mostInterested(
            @RequestParam(value = "period", defaultValue = "WEEK") String period,
            @RequestParam(value = "limit", defaultValue = "5") int limit) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic())
                .body(mostInterestedService.getMostInterested(period, limit));
    }
}
