package com.verdikt.api.service;

import com.verdikt.api.CollectionItem;
import com.verdikt.api.MediaCollection;
import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.Review;
import com.verdikt.api.User;
import com.verdikt.api.UserMediaState;
import com.verdikt.api.Verdict;
import com.verdikt.api.exception.ConflictException;
import com.verdikt.api.exception.ForbiddenException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.CollectionItemRepository;
import com.verdikt.api.repository.MediaCollectionRepository;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.ReviewRepository;
import com.verdikt.api.repository.UserMediaStateRepository;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.service.CollectionService.CreateCollectionRequest;
import com.verdikt.api.service.CollectionService.UpdateCollectionRequest;
import com.verdikt.api.service.external.TmdbService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.sql.Connection;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Service-level integration tests against an in-memory H2 database (profile "test").
 * No class-level @Transactional, so each service call commits or rolls back for real.
 */
@SpringBootTest
@ActiveProfiles("test")
class UserMediaFeaturesIntegrationTest {

    @Autowired UserMediaService userMediaService;
    @Autowired CollectionService collectionService;
    @Autowired MostInterestedService mostInterestedService;
    @Autowired UserRepository userRepository;
    @Autowired MediaItemRepository mediaItemRepository;
    @Autowired ReviewRepository reviewRepository;
    @Autowired UserMediaStateRepository stateRepository;
    @Autowired MediaCollectionRepository collectionRepository;
    @Autowired CollectionItemRepository collectionItemRepository;
    @Autowired JdbcTemplate jdbc;

    @MockitoBean TmdbService tmdbService;

    private User alice;
    private User bob;
    private MediaItem dune;
    private MediaItem arcane;
    private MediaItem frieren;

    @BeforeEach
    void setUp() {
        when(tmdbService.searchMovies(anyString(), anyInt())).thenReturn(List.of());
        when(tmdbService.searchSeries(anyString(), anyInt())).thenReturn(List.of());
        mostInterestedService.clearCache();
        alice = userRepository.save(User.builder().username("alice").email("alice@test.local").passwordHash("x").build());
        bob = userRepository.save(User.builder().username("bob").email("bob@test.local").passwordHash("x").build());
        dune = media("438631", MediaType.MOVIE, "Dune");
        arcane = media("94605", MediaType.SERIES, "Arcane");
        frieren = media("209867", MediaType.ANIME, "Frieren");
    }

    @AfterEach
    void cleanUp() {
        collectionItemRepository.deleteAllInBatch();
        collectionRepository.deleteAllInBatch();
        stateRepository.deleteAllInBatch();
        reviewRepository.deleteAllInBatch();
        mediaItemRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
    }

    private MediaItem media(String externalId, MediaType type, String title) {
        return mediaItemRepository.save(MediaItem.builder().externalId(externalId).mediaType(type).title(title)
                .releaseYear(2024).coverImage("https://img.test/" + externalId + ".jpg").build());
    }

    private Review review(User user, MediaItem item) {
        return reviewRepository.save(Review.builder().user(user).mediaItem(item).verdict(Verdict.GO_FOR_IT)
                .content("Great").containsSpoilers(false).build());
    }

    private List<UUID> watchHistoryItems(User user) {
        MediaCollection wh = collectionRepository
                .findByUserIdAndSystemType(user.getId(), MediaCollection.SYSTEM_WATCH_HISTORY).orElseThrow();
        return collectionItemRepository.findByIdCollectionIdOrderByAddedAtDesc(wh.getId()).stream()
                .map(CollectionItem::getMediaId).toList();
    }

    // ── watched / watch later ────────────────────────────────────────

    @Test
    @DisplayName("Marking watched twice is idempotent and creates Watch History exactly once")
    void watchedIsIdempotentAndCreatesWatchHistoryOnce() {
        userMediaService.setWatched("alice", dune.getId(), true);
        userMediaService.setWatched("alice", dune.getId(), true);

        assertThat(collectionRepository.findAllForUser(alice.getId()))
                .filteredOn(MediaCollection::isSystem).hasSize(1);
        assertThat(watchHistoryItems(alice)).containsExactly(dune.getId());
        assertThat(userMediaService.getState("alice", dune.getId()).watched()).isTrue();
    }

    @Test
    @DisplayName("Watch Later toggling is idempotent")
    void watchLaterIsIdempotent() {
        userMediaService.setWatchLater("alice", dune.getId(), true);
        Instant firstSavedAt = stateRepository.findByUserIdAndMediaId(alice.getId(), dune.getId()).orElseThrow().getWatchLaterAt();
        userMediaService.setWatchLater("alice", dune.getId(), true);

        UserMediaState state = stateRepository.findByUserIdAndMediaId(alice.getId(), dune.getId()).orElseThrow();
        assertThat(state.isWatchLater()).isTrue();
        assertThat(state.getWatchLaterAt()).isEqualTo(firstSavedAt);
        assertThat(stateRepository.count()).isEqualTo(1);

        userMediaService.setWatchLater("alice", dune.getId(), false);
        userMediaService.setWatchLater("alice", dune.getId(), false);
        assertThat(userMediaService.getState("alice", dune.getId()).watchLater()).isFalse();
    }

    @Test
    @DisplayName("Watched clears Watch Later, and Watch Later is rejected while watched")
    void watchedAndWatchLaterAreExclusive() {
        userMediaService.setWatchLater("alice", dune.getId(), true);
        var result = userMediaService.setWatched("alice", dune.getId(), true);

        assertThat(result.watched()).isTrue();
        assertThat(result.watchLater()).isFalse();
        assertThatThrownBy(() -> userMediaService.setWatchLater("alice", dune.getId(), true))
                .isInstanceOf(ConflictException.class);
        assertThat(userMediaService.getState("alice", dune.getId()).watchLater()).isFalse();
    }

    // ── unwatch ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Unwatch removes the item from Watch History and deletes the user's review")
    void unwatchRemovesHistoryAndDeletesReview() {
        userMediaService.setWatched("alice", dune.getId(), true);
        review(alice, dune);

        var result = userMediaService.setWatched("alice", dune.getId(), false);

        assertThat(result.watched()).isFalse();
        assertThat(result.deletedReview()).isTrue();
        assertThat(watchHistoryItems(alice)).isEmpty();
        assertThat(reviewRepository.findByMediaItemId(dune.getId())).isEmpty();
        assertThat(userMediaService.getState("alice", dune.getId()).hasReview()).isFalse();
    }

    @Test
    @DisplayName("Unwatch with no review succeeds with deletedReview=false")
    void unwatchWithoutReview() {
        userMediaService.setWatched("alice", dune.getId(), true);
        var result = userMediaService.setWatched("alice", dune.getId(), false);

        assertThat(result.deletedReview()).isFalse();
        assertThat(watchHistoryItems(alice)).isEmpty();
    }

    @Test
    @DisplayName("Unwatch is atomic: if deleting the review fails, history and watched state are kept")
    void unwatchRollsBackEverythingWhenReviewDeleteFails() throws Exception {
        userMediaService.setWatched("alice", dune.getId(), true);
        review(alice, dune);
        jdbc.execute("CREATE TRIGGER fail_review_delete BEFORE DELETE ON reviews FOR EACH ROW CALL \""
                + FailingTrigger.class.getName() + "\"");
        try {
            assertThatThrownBy(() -> userMediaService.setWatched("alice", dune.getId(), false))
                    .isInstanceOf(Exception.class);
        } finally {
            jdbc.execute("DROP TRIGGER fail_review_delete");
        }

        assertThat(userMediaService.getState("alice", dune.getId()).watched()).isTrue();
        assertThat(watchHistoryItems(alice)).containsExactly(dune.getId());
        assertThat(reviewRepository.findByMediaItemId(dune.getId())).hasSize(1);
    }

    @Test
    @DisplayName("One user's unwatch never touches another user's review or history")
    void unwatchIsScopedToTheUser() {
        userMediaService.setWatched("alice", dune.getId(), true);
        userMediaService.setWatched("bob", dune.getId(), true);
        review(alice, dune);
        review(bob, dune);

        userMediaService.setWatched("alice", dune.getId(), false);

        List<Review> remaining = reviewRepository.findByMediaItemId(dune.getId());
        assertThat(remaining).hasSize(1);
        assertThat(remaining.get(0).getUser().getId()).isEqualTo(bob.getId());
        assertThat(watchHistoryItems(bob)).containsExactly(dune.getId());
        assertThat(userMediaService.getState("bob", dune.getId()).watched()).isTrue();
    }

    // ── collections ──────────────────────────────────────────────────

    @Test
    @DisplayName("User B cannot read or edit user A's collection (reported as not found)")
    void collectionOwnershipIsEnforced() {
        var mine = collectionService.create("alice", new CreateCollectionRequest("Favorites", null, false, null));

        assertThatThrownBy(() -> collectionService.get("bob", mine.id())).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> collectionService.update("bob", mine.id(), new UpdateCollectionRequest("Mine now", null, null)))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> collectionService.addItem("bob", mine.id(), dune.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> collectionService.delete("bob", mine.id())).isInstanceOf(ResourceNotFoundException.class);
        assertThat(collectionRepository.findById(mine.id()).orElseThrow().getName()).isEqualTo("Favorites");
    }

    @Test
    @DisplayName("Adding the same item twice keeps one row; duplicate names are rejected")
    void duplicateAddAndDuplicateName() {
        var c = collectionService.create("alice", new CreateCollectionRequest("Sci-Fi", null, false, dune.getId()));
        collectionService.addItem("alice", c.id(), dune.getId());
        var after = collectionService.addItem("alice", c.id(), dune.getId());

        assertThat(after.itemCount()).isEqualTo(1);
        assertThatThrownBy(() -> collectionService.create("alice", new CreateCollectionRequest("sci-fi", null, false, null)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> collectionService.create("alice", new CreateCollectionRequest("Watch History", null, false, null)))
                .isInstanceOf(ConflictException.class);
        // Same name is fine for a different user
        assertThat(collectionService.create("bob", new CreateCollectionRequest("Sci-Fi", null, false, null)).name())
                .isEqualTo("Sci-Fi");
    }

    @Test
    @DisplayName("System Watch History cannot be renamed, deleted or edited, and is listed first")
    void systemCollectionIsLocked() {
        collectionService.create("alice", new CreateCollectionRequest("A first", null, false, null));
        userMediaService.setWatched("alice", dune.getId(), true);
        var collections = collectionService.list("alice");
        var wh = collections.get(0);

        assertThat(wh.isSystem()).isTrue();
        assertThat(wh.name()).isEqualTo("Watch History");
        assertThatThrownBy(() -> collectionService.update("alice", wh.id(), new UpdateCollectionRequest("Renamed", null, null)))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> collectionService.delete("alice", wh.id())).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> collectionService.addItem("alice", wh.id(), arcane.getId())).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> collectionService.removeItem("alice", wh.id(), dune.getId())).isInstanceOf(ForbiddenException.class);
        assertThat(watchHistoryItems(alice)).containsExactly(dune.getId());
    }

    @Test
    @DisplayName("Collection names are validated (1-60 chars)")
    void collectionNameValidation() {
        assertThatThrownBy(() -> collectionService.create("alice", new CreateCollectionRequest("   ", null, false, null)))
                .hasMessageContaining("1-60");
        assertThatThrownBy(() -> collectionService.create("alice", new CreateCollectionRequest("x".repeat(61), null, false, null)))
                .hasMessageContaining("1-60");
    }

    // ── most interested ──────────────────────────────────────────────

    private void watchLaterAt(User user, MediaItem item, Instant at) {
        UserMediaState s = new UserMediaState(user.getId(), item.getId());
        s.setWatchLater(true);
        s.setWatchLaterAt(at);
        stateRepository.save(s);
    }

    @Test
    @DisplayName("Most Interested respects the rolling window and counts only current Watch Later rows")
    void mostInterestedPeriodFiltering() {
        Instant now = Instant.now();
        watchLaterAt(alice, dune, now.minus(2, ChronoUnit.DAYS));
        watchLaterAt(bob, dune, now.minus(20, ChronoUnit.DAYS));
        watchLaterAt(alice, arcane, now.minus(60, ChronoUnit.DAYS));
        watchLaterAt(bob, frieren, now.minus(200, ChronoUnit.DAYS));

        var week = mostInterestedService.getMostInterested("WEEK", 5);
        assertThat(week).extracting(MostInterestedService.MostInterestedItem::title).containsExactly("Dune");
        assertThat(week.get(0).interestedCount()).isEqualTo(1L);

        var month = mostInterestedService.getMostInterested("MONTH", 5);
        assertThat(month.get(0).title()).isEqualTo("Dune");
        assertThat(month.get(0).interestedCount()).isEqualTo(2L);

        assertThat(mostInterestedService.getMostInterested("QUARTER", 5))
                .extracting(MostInterestedService.MostInterestedItem::title).containsExactly("Dune", "Arcane");
        assertThat(mostInterestedService.getMostInterested("ALL", 5))
                .extracting(MostInterestedService.MostInterestedItem::title).containsExactly("Dune", "Arcane", "Frieren");

        // Removing a Watch Later save drops it from ALL (after the 60s cache expires)
        userMediaService.setWatchLater("bob", frieren.getId(), false);
        mostInterestedService.clearCache();
        assertThat(mostInterestedService.getMostInterested("ALL", 5))
                .extracting(MostInterestedService.MostInterestedItem::title).doesNotContain("Frieren");
        assertThatThrownBy(() -> mostInterestedService.getMostInterested("DECADE", 5))
                .hasMessageContaining("period");
    }

    @Test
    @DisplayName("Status labels follow the release-date rules")
    void statusLabels() {
        LocalDate today = LocalDate.of(2026, 10, 26);
        assertThat(MostInterestedService.statusLabel(MediaType.MOVIE, today.plusDays(4), today)).isEqualTo("Upcoming");
        assertThat(MostInterestedService.statusLabel(MediaType.MOVIE, today.minusDays(45), today)).isEqualTo("In Theatres");
        assertThat(MostInterestedService.statusLabel(MediaType.MOVIE, today.minusDays(46), today)).isNull();
        assertThat(MostInterestedService.statusLabel(MediaType.SERIES, today.minusDays(90), today)).isEqualTo("New Show");
        assertThat(MostInterestedService.statusLabel(MediaType.ANIME, today.minusDays(91), today)).isNull();
        assertThat(MostInterestedService.statusLabel(MediaType.GAME, today.minusDays(3), today)).isNull();
        assertThat(MostInterestedService.statusLabel(MediaType.MOVIE, null, today)).isNull();
    }

    /** H2 trigger used to make the review DELETE fail inside the unwatch transaction. */
    public static class FailingTrigger implements org.h2.api.Trigger {
        @Override
        public void fire(Connection conn, Object[] oldRow, Object[] newRow) throws java.sql.SQLException {
            throw new java.sql.SQLException("Simulated review delete failure");
        }
    }
}
