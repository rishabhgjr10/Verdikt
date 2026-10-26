package com.verdikt.api.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.verdikt.api.CollectionItem;
import com.verdikt.api.MediaCollection;
import com.verdikt.api.User;
import com.verdikt.api.UserMediaState;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.ConflictException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.CollectionItemRepository;
import com.verdikt.api.repository.MediaCollectionRepository;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.ReviewRepository;
import com.verdikt.api.repository.UserMediaStateRepository;
import com.verdikt.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Per-user watched / watch-later state and the system "Watch History" collection.
 */
@Service
public class UserMediaService {

    private final UserMediaStateRepository stateRepository;
    private final MediaCollectionRepository collectionRepository;
    private final CollectionItemRepository collectionItemRepository;
    private final ReviewRepository reviewRepository;
    private final MediaItemRepository mediaItemRepository;
    private final UserRepository userRepository;

    public UserMediaService(UserMediaStateRepository stateRepository,
                            MediaCollectionRepository collectionRepository,
                            CollectionItemRepository collectionItemRepository,
                            ReviewRepository reviewRepository,
                            MediaItemRepository mediaItemRepository,
                            UserRepository userRepository) {
        this.stateRepository = stateRepository;
        this.collectionRepository = collectionRepository;
        this.collectionItemRepository = collectionItemRepository;
        this.reviewRepository = reviewRepository;
        this.mediaItemRepository = mediaItemRepository;
        this.userRepository = userRepository;
    }

    public record MediaUserState(boolean watched, boolean watchLater, List<UUID> collectionIds, boolean hasReview) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WatchedResult(boolean watched, boolean watchLater, Boolean deletedReview) {
    }

    public record WatchLaterResult(boolean watched, boolean watchLater) {
    }

    @Transactional(readOnly = true)
    public MediaUserState getState(String username, UUID mediaId) {
        UUID userId = requireUserId(username);
        requireMedia(mediaId);
        UserMediaState state = stateRepository.findByUserIdAndMediaId(userId, mediaId).orElse(null);
        return new MediaUserState(
                state != null && state.isWatched(),
                state != null && state.isWatchLater(),
                collectionItemRepository.findCollectionIdsContaining(userId, mediaId),
                reviewRepository.existsByUserIdAndMediaItemId(userId, mediaId));
    }

    /**
     * Watched: sets watched, clears watch-later and adds to Watch History.
     * Unwatched: clears watched, removes from Watch History and deletes the user's own review.
     * Each direction runs in one transaction, so a failure leaves nothing half-applied.
     */
    @Transactional
    public WatchedResult setWatched(String username, UUID mediaId, boolean value) {
        UUID userId = requireUserId(username);
        requireMedia(mediaId);
        UserMediaState state = stateRepository.findByUserIdAndMediaId(userId, mediaId)
                .orElseGet(() -> new UserMediaState(userId, mediaId));

        MediaCollection watchHistory = ensureWatchHistory(userId);
        CollectionItem.Key historyKey = new CollectionItem.Key(watchHistory.getId(), mediaId);

        if (value) {
            if (!state.isWatched()) {
                state.setWatched(true);
                state.setWatchedAt(Instant.now());
            }
            state.setWatchLater(false);
            state.setWatchLaterAt(null);
            stateRepository.save(state);
            if (!collectionItemRepository.existsById(historyKey)) {
                collectionItemRepository.save(new CollectionItem(watchHistory.getId(), mediaId));
                watchHistory.touch();
            }
            return new WatchedResult(true, false, null);
        }

        state.setWatched(false);
        state.setWatchedAt(null);
        stateRepository.save(state);
        if (collectionItemRepository.existsById(historyKey)) {
            collectionItemRepository.deleteById(historyKey);
            watchHistory.touch();
        }
        // Verdict averages/counts are derived from the reviews table on read, so deleting
        // the row is all that is needed to keep them correct.
        boolean deletedReview = reviewRepository.findByUserIdAndMediaItemId(userId, mediaId)
                .map(review -> {
                    reviewRepository.delete(review);
                    return true;
                })
                .orElse(false);
        return new WatchedResult(false, state.isWatchLater(), deletedReview);
    }

    @Transactional
    public WatchLaterResult setWatchLater(String username, UUID mediaId, boolean value) {
        UUID userId = requireUserId(username);
        requireMedia(mediaId);
        UserMediaState state = stateRepository.findByUserIdAndMediaId(userId, mediaId)
                .orElseGet(() -> new UserMediaState(userId, mediaId));

        if (value) {
            if (state.isWatched()) {
                throw new ConflictException("Watched titles can't be added to Watch Later.");
            }
            if (!state.isWatchLater()) {
                state.setWatchLater(true);
                state.setWatchLaterAt(Instant.now());
            }
        } else {
            state.setWatchLater(false);
            state.setWatchLaterAt(null);
        }
        stateRepository.save(state);
        return new WatchLaterResult(state.isWatched(), state.isWatchLater());
    }

    @Transactional(readOnly = true)
    public List<MediaItemDTO> getWatchLater(String username) {
        UUID userId = requireUserId(username);
        List<UUID> ids = stateRepository.findByUserIdAndWatchLaterTrueOrderByWatchLaterAtDesc(userId).stream()
                .map(UserMediaState::getMediaId)
                .toList();
        Map<UUID, MediaItemDTO> byId = mediaItemRepository.findAllById(ids).stream()
                .map(MediaItemDTO::fromEntity)
                .collect(Collectors.toMap(MediaItemDTO::getId, Function.identity()));
        return ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
    }

    /** Returns the user's Watch History collection, creating it on first use. */
    @Transactional
    public MediaCollection ensureWatchHistory(UUID userId) {
        return collectionRepository.findByUserIdAndSystemType(userId, MediaCollection.SYSTEM_WATCH_HISTORY)
                .orElseGet(() -> collectionRepository.save(MediaCollection.watchHistory(userId)));
    }

    UUID requireUserId(String username) {
        return userRepository.findByUsername(username)
                .map(User::getId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void requireMedia(UUID mediaId) {
        if (!mediaItemRepository.existsById(mediaId)) {
            throw new ResourceNotFoundException("Media item not found");
        }
    }
}
