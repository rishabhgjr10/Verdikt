package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.User;
import com.verdikt.api.Verdict;
import com.verdikt.api.dto.CreateReviewRequest;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ConflictException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.service.external.UnifiedMediaSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** Reviews take titles only from the provider, work by id alone, wait for release, and have a size limit. */
@SpringBootTest
@ActiveProfiles("test")
class ReviewIntegrityTest {

    @Autowired ReviewService reviewService;
    @Autowired UserRepository userRepository;
    @Autowired MediaItemRepository mediaItemRepository;
    @MockitoBean UnifiedMediaSearchService providers;

    private String username;

    @BeforeEach
    void setUp() {
        username = "rev" + UUID.randomUUID().toString().substring(0, 8);
        userRepository.save(User.builder().username(username).email(username + "@example.test").passwordHash("x").build());
    }

    private static CreateReviewRequest request(UUID mediaItemId, MediaItemDTO details, String content) {
        CreateReviewRequest r = new CreateReviewRequest();
        r.setMediaItemId(mediaItemId);
        r.setMediaDetails(details);
        r.setVerdict(Verdict.GO_FOR_IT);
        r.setContent(content);
        return r;
    }

    private MediaItem storedTitle(LocalDate releaseDate) {
        return mediaItemRepository.save(MediaItem.builder()
                .externalId("ext" + UUID.randomUUID()).mediaType(MediaType.MOVIE).title("Stored title")
                .releaseYear(releaseDate.getYear()).releaseDate(releaseDate).build());
    }

    @Test
    void clientSentDetailsNeverReachTheCatalogue() {
        String externalId = "tmdb" + UUID.randomUUID().toString().substring(0, 6);
        MediaItemDTO provider = MediaItemDTO.builder().externalId(externalId).mediaType(MediaType.MOVIE)
                .title("Real Title").releaseYear(2010).releaseDate(LocalDate.of(2010, 1, 1))
                .trailerUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").build();
        when(providers.fetchExternalDetails(eq(externalId), eq(MediaType.MOVIE))).thenReturn(provider);
        MediaItemDTO forged = MediaItemDTO.builder().externalId(externalId).mediaType(MediaType.MOVIE)
                .title("Free crypto here").trailerUrl("https://evil.example/phish").coverImage("https://evil.example/x.png").build();

        reviewService.createOrUpdateReview(request(null, forged, "Great film."), username);

        MediaItem saved = mediaItemRepository.findByExternalIdAndMediaType(externalId, MediaType.MOVIE).orElseThrow();
        assertThat(saved.getTitle()).isEqualTo("Real Title");
        assertThat(saved.getTrailerUrl()).isEqualTo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        assertThat(saved.getCoverImage()).isNull();
    }

    @Test
    void reviewingByIdAloneWorks() {
        MediaItem title = storedTitle(LocalDate.of(2001, 5, 5));
        assertThat(reviewService.createOrUpdateReview(request(title.getId(), null, "Solid."), username).getId()).isNotNull();
    }

    @Test
    void unreleasedTitlesRejectVerdicts() {
        MediaItem upcoming = storedTitle(LocalDate.now().plusDays(30));
        assertThatThrownBy(() -> reviewService.createOrUpdateReview(request(upcoming.getId(), null, "Can't wait"), username))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void commentsCanBeRemovedByTheirAuthorOrTheReviewAuthorOnly() {
        MediaItem title = storedTitle(LocalDate.of(2001, 5, 5));
        UUID reviewId = reviewService.createOrUpdateReview(request(title.getId(), null, "Solid."), username).getId();
        String commenter = "com" + UUID.randomUUID().toString().substring(0, 8);
        String stranger = "str" + UUID.randomUUID().toString().substring(0, 8);
        for (String n : new String[]{commenter, stranger}) {
            userRepository.save(User.builder().username(n).email(n + "@example.test").passwordHash("x").build());
        }
        UUID c1 = reviewService.addComment(reviewId, "rude words", commenter).id();
        UUID c2 = reviewService.addComment(reviewId, "more", commenter).id();

        assertThatThrownBy(() -> reviewService.deleteComment(reviewId, c1, stranger))
                .isInstanceOf(com.verdikt.api.exception.ForbiddenException.class);
        reviewService.deleteComment(reviewId, c1, username);   // the review author
        reviewService.deleteComment(reviewId, c2, commenter);  // the comment author
        assertThat(reviewService.getComments(reviewId)).isEmpty();
    }

    @Test
    void contentIsRequiredAndCapped() {
        MediaItem title = storedTitle(LocalDate.of(2001, 5, 5));
        assertThatThrownBy(() -> reviewService.createOrUpdateReview(request(title.getId(), null, "   "), username))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> reviewService.createOrUpdateReview(
                request(title.getId(), null, "x".repeat(ReviewService.MAX_REVIEW_LENGTH + 1)), username))
                .isInstanceOf(BadRequestException.class);
    }
}
