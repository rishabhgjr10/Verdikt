package com.verdikt.api.controller;

import com.verdikt.api.service.ProfileService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.UUID;

/**
 * Public profile photos (shown next to every review). URLs carry ?v=<upload time>, so each one can be cached forever.
 */
@RestController
@RequestMapping("/api/avatars")
public class AvatarController {

    private final ProfileService profileService;

    public AvatarController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<byte[]> avatar(@PathVariable UUID userId) {
        return profileService.avatarImage(userId)
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                        .header("X-Content-Type-Options", "nosniff")
                        .header("Content-Security-Policy", "default-src 'none'")
                        .body(bytes))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
