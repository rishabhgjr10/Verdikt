package com.verdikt.api.controller;

import com.verdikt.api.dto.CreateReviewRequest;
import com.verdikt.api.dto.ReviewCommentDTO;
import com.verdikt.api.dto.ReviewResponseDTO;
import com.verdikt.api.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    public record CommentRequest(String text) {
    }

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping
    public ResponseEntity<ReviewResponseDTO> createOrUpdateReview(
            @Valid @RequestBody CreateReviewRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        String currentUsername = userDetails.getUsername();
        ReviewResponseDTO response = reviewService.createOrUpdateReview(request, currentUsername);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // GETs are public; a signed-in viewer also gets likedByMe
    @GetMapping("/media/{mediaId}")
    public ResponseEntity<List<ReviewResponseDTO>> getReviewsByMediaId(
            @PathVariable UUID mediaId,
            @AuthenticationPrincipal UserDetails userDetails) {
        List<ReviewResponseDTO> reviews = reviewService.getReviewsByMediaId(mediaId, username(userDetails));
        return ResponseEntity.ok(reviews);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ReviewResponseDTO>> getReviewsByUserId(
            @PathVariable UUID userId,
            @AuthenticationPrincipal UserDetails userDetails) {
        List<ReviewResponseDTO> reviews = reviewService.getReviewsByUserId(userId, username(userDetails));
        return ResponseEntity.ok(reviews);
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(
            @PathVariable UUID reviewId,
            @AuthenticationPrincipal UserDetails userDetails) {
        reviewService.deleteReview(reviewId, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{reviewId}/like")
    public ResponseEntity<ReviewService.LikeResult> toggleLike(
            @PathVariable UUID reviewId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(reviewService.toggleLike(reviewId, userDetails.getUsername()));
    }

    @GetMapping("/{reviewId}/comments")
    public ResponseEntity<List<ReviewCommentDTO>> getComments(@PathVariable UUID reviewId) {
        return ResponseEntity.ok(reviewService.getComments(reviewId));
    }

    @PostMapping("/{reviewId}/comments")
    public ResponseEntity<ReviewCommentDTO> addComment(
            @PathVariable UUID reviewId,
            @RequestBody CommentRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        ReviewCommentDTO comment = reviewService.addComment(reviewId, request.text(), userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(comment);
    }

    private static String username(UserDetails userDetails) {
        return userDetails != null ? userDetails.getUsername() : null;
    }
}
