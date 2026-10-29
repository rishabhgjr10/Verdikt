package com.verdikt.api.controller;

import com.verdikt.api.dto.AuthResponse;
import com.verdikt.api.service.ProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * The signed-in user's own account (auth required: /api/me/** in SecurityConfig).
 */
@RestController
@RequestMapping("/api/me")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    public record UsernameRequest(String username) {
    }

    public record DeleteAccountRequest(String password) {
    }

    @GetMapping("/profile")
    public ProfileService.MeResponse getProfile(@AuthenticationPrincipal UserDetails user) {
        return profileService.getMe(user.getUsername());
    }

    @PutMapping("/profile")
    public ProfileService.MeResponse updateProfile(@RequestBody ProfileService.UpdateProfileRequest body,
                                                   @AuthenticationPrincipal UserDetails user) {
        return profileService.updateProfile(user.getUsername(), body);
    }

    @PutMapping(value = "/avatar", consumes = "multipart/form-data")
    public ProfileService.MeResponse uploadAvatar(@RequestParam("file") MultipartFile file,
                                                  @AuthenticationPrincipal UserDetails user) throws IOException {
        return profileService.uploadAvatar(user.getUsername(), file.getBytes());
    }

    @DeleteMapping("/avatar")
    public ProfileService.MeResponse removeAvatar(@AuthenticationPrincipal UserDetails user) {
        return profileService.removeAvatar(user.getUsername());
    }

    @PutMapping("/username")
    public AuthResponse changeUsername(@RequestBody UsernameRequest body, @AuthenticationPrincipal UserDetails user) {
        return profileService.changeUsername(user.getUsername(), body == null ? null : body.username());
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(@RequestBody DeleteAccountRequest body, @AuthenticationPrincipal UserDetails user) {
        profileService.deleteAccount(user.getUsername(), body == null ? null : body.password());
        return ResponseEntity.noContent().build();
    }
}
