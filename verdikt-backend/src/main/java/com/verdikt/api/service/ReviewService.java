package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.Review;
import com.verdikt.api.ReviewComment;
import com.verdikt.api.ReviewLike;
import com.verdikt.api.User;
import com.verdikt.api.dto.CreateReviewRequest;
import com.verdikt.api.dto.ReviewCommentDTO;
import com.verdikt.api.dto.ReviewResponseDTO;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ConflictException;
import com.verdikt.api.exception.ForbiddenException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.ReviewCommentRepository;
import com.verdikt.api.repository.ReviewLikeRepository;
import com.verdikt.api.repository.ReviewRepository;
import com.verdikt.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.HashSet;
import java.util.HashMap;
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
    private final MediaItemRepository mediaItemRepository;

    /** Same limit as the composer (MAX_REVIEW_LENGTH in verdikt-frontend/src/components/reviews/verdicts.ts) */
    public static final int MAX_REVIEW_LENGTH = 1000;

    public ReviewService(ReviewRepository reviewRepository, UserRepository userRepository, MediaItemService mediaItemService,
                         ReviewLikeRepository reviewLikeRepository, ReviewCommentRepository reviewCommentRepository,
                         MediaItemRepository mediaItemRepository) {
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.mediaItemService = mediaItemService;
        this.reviewLikeRepository = reviewLikeRepository;
        this.reviewCommentRepository = reviewCommentRepository;
        this.mediaItemRepository = mediaItemRepository;
    }

    @Transactional
    public ReviewResponseDTO createOrUpdateReview(CreateReviewRequest request, String currentUsername) {
        User user = requireUser(currentUsername);

        MediaItem mediaItem = resolveMediaItem(request);
        requireReleased(mediaItem);
        String content = request.getContent() == null ? "" : request.getContent().trim();
        if (content.isEmpty()) {
            throw new BadRequestException("Write a few words with your verdict.");
        }
        if (content.codePointCount(0, content.length()) > MAX_REVIEW_LENGTH) {
            throw new BadRequestException("Reviews can be at most " + MAX_REVIEW_LENGTH + " characters.");
        }

        Optional<Review> existingReviewOpt = reviewRepository.findByUserIdAndMediaItemId(user.getId(), mediaItem.getId());

        Review review;
        if (existingReviewOpt.isPresent()) {
            review = existingReviewOpt.get();
            review.setVerdict(request.getVerdict());
            review.setContent(content);
            review.setContainsSpoilers(request.isContainsSpoilers());
        } else {
            review = Review.builder()
                    .user(user)
                    .mediaItem(mediaItem)
                    .verdict(request.getVerdict())
                    .content(content)
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
        return enrichAll(reviewRepository.findByMediaItemId(mediaId).stream().map(ReviewResponseDTO::fromEntity).toList(), viewerId);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponseDTO> getReviewsByUserId(UUID userId, String viewerUsername) {
        UUID viewerId = viewerId(viewerUsername);
        return enrichAll(reviewRepository.findByUserId(userId).stream().map(ReviewResponseDTO::fromEntity).toList(), viewerId);
    }

    /** The comment's author or the review's author may remove a comment (abuse on your own review included) */
    @Transactional
    public void deleteComment(UUID reviewId, UUID commentId, String currentUsername) {
        User user = requireUser(currentUsername);
        ReviewComment comment = reviewCommentRepository.findById(commentId)
                .filter(c -> c.getReview().getId().equals(reviewId))
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        boolean author = comment.getUser().getId().equals(user.getId());
        boolean reviewOwner = comment.getReview().getUser().getId().equals(user.getId());
        if (!author && !reviewOwner) {
            throw new ForbiddenException("You can only remove your own comments, or comments on your review");
        }
        reviewCommentRepository.delete(comment);
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
    /**
     * The title being reviewed. Only its id or its provider id is taken from the request: the catalogue row is always
     * built from the provider's own data, so a crafted request can't add fake titles, posters or trailer links.
     */
    private MediaItem resolveMediaItem(CreateReviewRequest request) {
        if (request.getMediaItemId() != null) {
            Optional<MediaItem> stored = mediaItemRepository.findById(request.getMediaItemId());
            if (stored.isPresent()) {
                return stored.get();
            }
        }
        MediaItemDTO details = request.getMediaDetails();
        if (details != null && details.getExternalId() != null && !details.getExternalId().isBlank()
                && details.getMediaType() != null) {
            return mediaItemService.getOrCreateMediaItem(details.getExternalId().trim(), details.getMediaType());
        }
        throw new BadRequestException("Choose a title to review.");
    }

    /** Verdicts open on release day, wherever it arrives first (UTC+14), matching the title page */
    private static void requireReleased(MediaItem item) {
        LocalDate today = LocalDate.now(ZoneId.of("Pacific/Kiritimati"));
        boolean unreleased = item.getReleaseDate() != null
                ? item.getReleaseDate().isAfter(today)
                : item.getReleaseYear() != null && item.getReleaseYear() > today.getYear();
        if (unreleased) {
            throw new ConflictException("Verdicts open on release.");
        }
    }

    /** Like counts, comment counts and "liked by me" for a whole list in three grouped queries, not three per review */
    private List<ReviewResponseDTO> enrichAll(List<ReviewResponseDTO> dtos, UUID viewerId) {
        List<UUID> ids = dtos.stream().map(ReviewResponseDTO::getId).toList();
        if (ids.isEmpty()) {
            return dtos;
        }
        Map<UUID, Long> likes = new HashMap<>();
        reviewLikeRepository.countByReviewIds(ids).forEach(r -> likes.put((UUID) r[0], (Long) r[1]));
        Map<UUID, Long> comments = new HashMap<>();
        reviewCommentRepository.countByReviewIds(ids).forEach(r -> comments.put((UUID) r[0], (Long) r[1]));
        Set<UUID> liked = viewerId == null ? Set.of() : new HashSet<>(reviewLikeRepository.findLikedReviewIds(viewerId, ids));
        for (ReviewResponseDTO dto : dtos) {
            dto.setLikeCount(likes.getOrDefault(dto.getId(), 0L));
            dto.setCommentCount(comments.getOrDefault(dto.getId(), 0L));
            dto.setLikedByMe(liked.contains(dto.getId()));
        }
        return dtos;
    }

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
