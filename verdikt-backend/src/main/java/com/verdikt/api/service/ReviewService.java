package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.Review;
import com.verdikt.api.User;
import com.verdikt.api.dto.CreateReviewRequest;
import com.verdikt.api.dto.ReviewResponseDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.ReviewRepository;
import com.verdikt.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final MediaItemService mediaItemService;

    public ReviewService(ReviewRepository reviewRepository, UserRepository userRepository, MediaItemService mediaItemService) {
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.mediaItemService = mediaItemService;
    }

    @Transactional
    public ReviewResponseDTO createOrUpdateReview(CreateReviewRequest request, String currentUsername) {
        User user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + currentUsername));

        MediaItem mediaItem;
        if (request.getMediaItemId() != null) {
            mediaItem = mediaItemService.getOrCreateFromDTO(
                    request.getMediaDetails() != null ? request.getMediaDetails() : null);
            if (mediaItem == null || !mediaItem.getId().equals(request.getMediaItemId())) {
                mediaItem = mediaItemService.getOrCreateFromDTO(request.getMediaDetails());
            }
        } else if (request.getMediaDetails() != null) {
            mediaItem = mediaItemService.getOrCreateFromDTO(request.getMediaDetails());
        } else {
            throw new BadRequestException("Either mediaItemId or mediaDetails must be provided");
        }

        Optional<Review> existingReviewOpt = reviewRepository.findByUserIdAndMediaItemId(user.getId(), mediaItem.getId());

        Review review;
        if (existingReviewOpt.isPresent()) {
            review = existingReviewOpt.get();
            review.setVerdict(request.getVerdict());
            review.setContent(request.getContent());
            review.setContainsSpoilers(request.isContainsSpoilers());
        } else {
            review = Review.builder()
                    .user(user)
                    .mediaItem(mediaItem)
                    .verdict(request.getVerdict())
                    .content(request.getContent())
                    .containsSpoilers(request.isContainsSpoilers())
                    .build();
        }

        Review savedReview = reviewRepository.save(review);
        return ReviewResponseDTO.fromEntity(savedReview);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponseDTO> getReviewsByMediaId(UUID mediaId) {
        return reviewRepository.findByMediaItemId(mediaId).stream()
                .map(ReviewResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ReviewResponseDTO> getReviewsByUserId(UUID userId) {
        return reviewRepository.findByUserId(userId).stream()
                .map(ReviewResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }
}
