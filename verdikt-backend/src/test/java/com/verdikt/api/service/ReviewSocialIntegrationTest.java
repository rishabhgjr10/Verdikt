package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.Review;
import com.verdikt.api.User;
import com.verdikt.api.Verdict;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ForbiddenException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.ReviewCommentRepository;
import com.verdikt.api.repository.ReviewLikeRepository;
import com.verdikt.api.repository.ReviewRepository;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.service.external.TmdbService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Likes, comments and delete on reviews, against the in-memory H2 database (profile "test"). */
@SpringBootTest
@ActiveProfiles("test")
class ReviewSocialIntegrationTest {

    @Autowired ReviewService reviewService;
    @Autowired UserRepository userRepository;
    @Autowired MediaItemRepository mediaItemRepository;
    @Autowired ReviewRepository reviewRepository;
    @Autowired ReviewLikeRepository likeRepository;
    @Autowired ReviewCommentRepository commentRepository;

    @MockitoBean TmdbService tmdbService;

    private Review aliceReview;

    @BeforeEach
    void setUp() {
        User alice = userRepository.save(User.builder().username("alice").email("alice@test.local").passwordHash("x").build());
        userRepository.save(User.builder().username("bob").email("bob@test.local").passwordHash("x").build());
        MediaItem dune = mediaItemRepository.save(MediaItem.builder().externalId("438631").mediaType(MediaType.MOVIE)
                .title("Dune").releaseYear(2024).build());
        aliceReview = reviewRepository.save(Review.builder().user(alice).mediaItem(dune).verdict(Verdict.GO_FOR_IT)
                .content("Great").containsSpoilers(false).build());
    }

    @AfterEach
    void cleanUp() {
        commentRepository.deleteAllInBatch();
        likeRepository.deleteAllInBatch();
        reviewRepository.deleteAllInBatch();
        mediaItemRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
    }

    @Test
    @DisplayName("Like toggles on and off, and counts and likedByMe follow the viewer")
    void likeToggles() {
        assertThat(reviewService.toggleLike(aliceReview.getId(), "bob")).isEqualTo(new ReviewService.LikeResult(true, 1));
        var forBob = reviewService.getReviewsByMediaId(aliceReview.getMediaItem().getId(), "bob").get(0);
        var forAnon = reviewService.getReviewsByMediaId(aliceReview.getMediaItem().getId(), null).get(0);
        assertThat(forBob.getLikeCount()).isEqualTo(1);
        assertThat(forBob.isLikedByMe()).isTrue();
        assertThat(forAnon.isLikedByMe()).isFalse();

        assertThat(reviewService.toggleLike(aliceReview.getId(), "bob")).isEqualTo(new ReviewService.LikeResult(false, 0));
    }

    @Test
    @DisplayName("Comments are trimmed, blank ones are rejected, and they are blocked when the author turns them off")
    void commentsRespectAllowComments() {
        var comment = reviewService.addComment(aliceReview.getId(), "  agreed  ", "bob");
        assertThat(comment.text()).isEqualTo("agreed");
        assertThat(comment.createdAt()).isNotNull();
        assertThat(reviewService.getComments(aliceReview.getId())).hasSize(1);
        assertThatThrownBy(() -> reviewService.addComment(aliceReview.getId(), "   ", "bob"))
                .isInstanceOf(BadRequestException.class);

        aliceReview.setAllowComments(false);
        reviewRepository.save(aliceReview);
        assertThatThrownBy(() -> reviewService.addComment(aliceReview.getId(), "hi", "bob"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("Only the author can delete a review, and its likes and comments go with it")
    void deleteIsOwnerOnlyAndCascades() {
        reviewService.toggleLike(aliceReview.getId(), "bob");
        reviewService.addComment(aliceReview.getId(), "nice", "bob");

        assertThatThrownBy(() -> reviewService.deleteReview(aliceReview.getId(), "bob"))
                .isInstanceOf(ForbiddenException.class);

        reviewService.deleteReview(aliceReview.getId(), "alice");
        assertThat(reviewRepository.count()).isZero();
        assertThat(likeRepository.count()).isZero();
        assertThat(commentRepository.count()).isZero();
    }
}
