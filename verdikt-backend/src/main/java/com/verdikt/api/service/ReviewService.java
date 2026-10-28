package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.Review;
import com.verdikt.api.ReviewComment;
import com.verdikt.api.ReviewLike;
import com.verdikt.api.User;
import com.verdikt.api.dto.CreateReviewRequest;
import com.verdikt.api.dto.ReviewCommentDTO;
import com.verdikt.api.dto.ReviewResponseDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ForbiddenException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.ReviewCommentRepository;
import com.verdikt.api.repository.ReviewLikeRepository;
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

    public static final int MAX_COMMENT_LENGTH = 1000;

    public record LikeResult(boolean liked, long likeCount) {
    }

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final MediaItemService mediaItemService;
    private final ReviewLikeRepository reviewLikeRepository;
    private final ReviewCommentRepository reviewCommentRepository;

    public ReviewService(ReviewRepository reviewRepository, UserRepository userRepository, MediaItemService mediaItemService,
                         ReviewLikeRepository reviewLikeRepository, ReviewCommentRepository reviewCommentRepository) {
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.mediaItemService = mediaItemService;
        this.reviewLikeRepository = reviewLikeRepository;
        this.reviewCommentRepository = reviewCommentRepository;
    }

    @Transactional
    public ReviewResponseDTO createOrUpdateReview(CreateReviewRequest request, String currentUsername) {
        User user = requireUser(currentUsername);

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
        if (request.getAllowComments() != null) {
            review.setAllowComments(request.getAllowComments());
        }

        Review savedReview = reviewRepository.save(review);
        return enrich(ReviewResponseDTO.fromEntity(savedReview), user.getId());
    }

    @Transactional(readOnly = true)
    public List<ReviewResponseDTO> getReviewsByMediaId(UUID mediaId, String viewerUsername) {
        UUID viewerId = viewerId(viewerUsername);
        return reviewRepository.findByMediaItemId(mediaId).stream()
                .map(review -> enrich(ReviewResponseDTO.fromEntity(review), viewerId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ReviewResponseDTO> getReviewsByUserId(UUID userId, String viewerUsername) {
        UUID viewerId = viewerId(viewerUsername);
        return reviewRepository.findByUserId(userId).stream()
                .map(review -> enrich(ReviewResponseDTO.fromEntity(review), viewerId))
                .collect(Collectors.toList());
    }

    /** Owner-only. Likes and comments are removed by the database cascade. */
    @Transactional
    public void deleteReview(UUID reviewId, String currentUsername) {
        User user = requireUser(currentUsername);
        Review review = requireReview(reviewId);
        if (!review.getUser().getId().equals(user.getId())) {
            throw new ForbiddenException("You can only delete your own review");
        }
        reviewRepository.delete(review);
    }

    @Transactional
    public LikeResult toggleLike(UUID reviewId, String currentUsername) {
        User user = requireUser(currentUsername);
        Review review = requireReview(reviewId);
        Optional<ReviewLike> existing = reviewLikeRepository.findByReviewIdAndUserId(reviewId, user.getId());
        boolean liked;
        if (existing.isPresent()) {
            reviewLikeRepository.delete(existing.get());
            liked = false;
        } else {
            reviewLikeRepository.save(new ReviewLike(user, review));
            liked = true;
        }
        reviewLikeRepository.flush();
        return new LikeResult(liked, reviewLikeRepository.countByReviewId(reviewId));
    }

    @Transactional(readOnly = true)
    public List<ReviewCommentDTO> getComments(UUID reviewId) {
        requireReview(reviewId);
        return reviewCommentRepository.findByReviewIdOrderByCreatedAtAsc(reviewId).stream()
                .map(ReviewCommentDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public ReviewCommentDTO addComment(UUID reviewId, String text, String currentUsername) {
        User user = requireUser(currentUsername);
        Review review = requireReview(reviewId);
        if (!review.isAllowComments()) {
            throw new ForbiddenException("Comments are turned off for this review");
        }
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("Comment cannot be empty");
        }
        if (trimmed.length() > MAX_COMMENT_LENGTH) {
            throw new BadRequestException("Comment must be at most " + MAX_COMMENT_LENGTH + " characters");
        }
        // Flush so @CreationTimestamp is set before the DTO is built
        return ReviewCommentDTO.fromEntity(reviewCommentRepository.saveAndFlush(new ReviewComment(user, review, trimmed)));
    }

    // shortcut: two count queries per review (N+1); batch them with a grouped query if review lists get long
    private ReviewResponseDTO enrich(ReviewResponseDTO dto, UUID viewerId) {
        dto.setLikeCount(reviewLikeRepository.countByReviewId(dto.getId()));
        dto.setCommentCount(reviewCommentRepository.countByReviewId(dto.getId()));
        dto.setLikedByMe(viewerId != null && reviewLikeRepository.existsByReviewIdAndUserId(dto.getId(), viewerId));
        return dto;
    }

    private UUID viewerId(String viewerUsername) {
        if (viewerUsername == null) return null;
        return userRepository.findByUsername(viewerUsername).map(User::getId).orElse(null);
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    private Review requireReview(UUID reviewId) {
        return reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found: " + reviewId));
    }
}
