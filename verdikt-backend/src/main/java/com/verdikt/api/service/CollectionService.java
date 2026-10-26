package com.verdikt.api.service;

import com.verdikt.api.CollectionItem;
import com.verdikt.api.MediaCollection;
import com.verdikt.api.MediaItem;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ConflictException;
import com.verdikt.api.exception.ForbiddenException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.CollectionItemRepository;
import com.verdikt.api.repository.MediaCollectionRepository;
import com.verdikt.api.repository.MediaItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CollectionService {

    static final int MAX_USER_COLLECTIONS = 100;
    static final int MAX_NAME_LENGTH = 60;
    static final int MAX_DESCRIPTION_LENGTH = 280;
    private static final String LOCKED_MESSAGE = "This collection is managed automatically and can't be changed.";
    private static final String NOT_FOUND_MESSAGE = "Collection not found";

    private final MediaCollectionRepository collectionRepository;
    private final CollectionItemRepository itemRepository;
    private final MediaItemRepository mediaItemRepository;
    private final UserMediaService userMediaService;

    public CollectionService(MediaCollectionRepository collectionRepository,
                             CollectionItemRepository itemRepository,
                             MediaItemRepository mediaItemRepository,
                             UserMediaService userMediaService) {
        this.collectionRepository = collectionRepository;
        this.itemRepository = itemRepository;
        this.mediaItemRepository = mediaItemRepository;
        this.userMediaService = userMediaService;
    }

    public record CollectionDTO(UUID id, String name, String description, boolean isPublic, boolean isSystem,
                                String systemType, long itemCount, List<String> previewPosters,
                                Instant createdAt, Instant updatedAt) {
    }

    public record CollectionDetailDTO(CollectionDTO collection, List<MediaItemDTO> items) {
    }

    public record CreateCollectionRequest(String name, String description, Boolean isPublic, UUID mediaId) {
    }

    public record UpdateCollectionRequest(String name, String description, Boolean isPublic) {
    }

    /** All of the user's collections; the system Watch History is created on first visit and listed first. */
    @Transactional
    public List<CollectionDTO> list(String username) {
        UUID userId = userMediaService.requireUserId(username);
        userMediaService.ensureWatchHistory(userId);
        List<MediaCollection> collections = collectionRepository.findAllForUser(userId);
        Map<UUID, Long> counts = new HashMap<>();
        if (!collections.isEmpty()) {
            for (Object[] row : itemRepository.countByCollectionIds(collections.stream().map(MediaCollection::getId).toList())) {
                counts.put((UUID) row[0], (Long) row[1]);
            }
        }
        return collections.stream().map(c -> toDto(c, counts.getOrDefault(c.getId(), 0L))).toList();
    }

    @Transactional(readOnly = true)
    public CollectionDetailDTO get(String username, UUID collectionId) {
        MediaCollection collection = requireOwned(username, collectionId);
        List<CollectionItem> items = itemRepository.findByIdCollectionIdOrderByAddedAtDesc(collectionId);
        List<UUID> mediaIds = items.stream().map(CollectionItem::getMediaId).toList();
        Map<UUID, MediaItem> media = mediaItemRepository.findAllById(mediaIds).stream()
                .collect(Collectors.toMap(MediaItem::getId, Function.identity()));
        List<MediaItemDTO> dtos = mediaIds.stream().map(media::get).filter(Objects::nonNull)
                .map(MediaItemDTO::fromEntity).toList();
        return new CollectionDetailDTO(toDto(collection, dtos.size()), dtos);
    }

    @Transactional
    public CollectionDTO create(String username, CreateCollectionRequest request) {
        UUID userId = userMediaService.requireUserId(username);
        if (request == null) {
            throw new BadRequestException("Collection details are required.");
        }
        String name = validateName(request.name());
        String description = validateDescription(request.description());
        if (collectionRepository.countUserCollections(userId) >= MAX_USER_COLLECTIONS) {
            throw new ConflictException("You've reached the limit of " + MAX_USER_COLLECTIONS + " collections.");
        }
        if (collectionRepository.nameTaken(userId, name, null)) {
            throw new ConflictException("You already have a collection with that name.");
        }
        MediaCollection saved = collectionRepository.save(MediaCollection.userCollection(
                userId, name, description, Boolean.TRUE.equals(request.isPublic())));
        long count = 0;
        if (request.mediaId() != null) {
            requireMedia(request.mediaId());
            itemRepository.save(new CollectionItem(saved.getId(), request.mediaId()));
            count = 1;
        }
        return toDto(saved, count);
    }

    @Transactional
    public CollectionDTO update(String username, UUID collectionId, UpdateCollectionRequest request) {
        MediaCollection collection = requireEditable(username, collectionId);
        if (request == null) {
            throw new BadRequestException("Nothing to update.");
        }
        if (request.name() != null) {
            String name = validateName(request.name());
            if (collectionRepository.nameTaken(collection.getUserId(), name, collection.getId())) {
                throw new ConflictException("You already have a collection with that name.");
            }
            collection.setName(name);
        }
        if (request.description() != null) {
            collection.setDescription(validateDescription(request.description()));
        }
        if (request.isPublic() != null) {
            collection.setPublic(request.isPublic());
        }
        MediaCollection saved = collectionRepository.saveAndFlush(collection);
        return toDto(saved, itemCount(saved.getId()));
    }

    @Transactional
    public void delete(String username, UUID collectionId) {
        MediaCollection collection = requireEditable(username, collectionId);
        itemRepository.deleteAllInBatch(itemRepository.findByIdCollectionIdOrderByAddedAtDesc(collectionId));
        collectionRepository.delete(collection);
    }

    /** Idempotent: adding an item that is already present is a no-op. */
    @Transactional
    public CollectionDTO addItem(String username, UUID collectionId, UUID mediaId) {
        MediaCollection collection = requireEditable(username, collectionId);
        requireMedia(mediaId);
        CollectionItem.Key key = new CollectionItem.Key(collectionId, mediaId);
        if (!itemRepository.existsById(key)) {
            itemRepository.save(new CollectionItem(collectionId, mediaId));
            collection.touch();
        }
        return toDto(collection, itemCount(collectionId));
    }

    /** Idempotent: removing an item that is not present is a no-op. */
    @Transactional
    public CollectionDTO removeItem(String username, UUID collectionId, UUID mediaId) {
        MediaCollection collection = requireEditable(username, collectionId);
        CollectionItem.Key key = new CollectionItem.Key(collectionId, mediaId);
        if (itemRepository.existsById(key)) {
            itemRepository.deleteById(key);
            collection.touch();
        }
        return toDto(collection, itemCount(collectionId));
    }

    /** Another user's collection is reported as not found so its existence isn't revealed. */
    private MediaCollection requireOwned(String username, UUID collectionId) {
        UUID userId = userMediaService.requireUserId(username);
        return collectionRepository.findById(collectionId)
                .filter(c -> c.getUserId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException(NOT_FOUND_MESSAGE));
    }

    private MediaCollection requireEditable(String username, UUID collectionId) {
        MediaCollection collection = requireOwned(username, collectionId);
        if (collection.isSystem()) {
            throw new ForbiddenException(LOCKED_MESSAGE);
        }
        return collection;
    }

    private void requireMedia(UUID mediaId) {
        if (!mediaItemRepository.existsById(mediaId)) {
            throw new ResourceNotFoundException("Media item not found");
        }
    }

    private long itemCount(UUID collectionId) {
        return itemRepository.countByCollectionIds(List.of(collectionId)).stream()
                .findFirst().map(row -> (Long) row[1]).orElse(0L);
    }

    private CollectionDTO toDto(MediaCollection c, long itemCount) {
        List<UUID> previewIds = itemRepository.findByIdCollectionIdOrderByAddedAtDesc(c.getId()).stream()
                .limit(3).map(CollectionItem::getMediaId).toList();
        Map<UUID, MediaItem> media = mediaItemRepository.findAllById(previewIds).stream()
                .collect(Collectors.toMap(MediaItem::getId, Function.identity()));
        List<String> posters = previewIds.stream().map(media::get).filter(Objects::nonNull)
                .map(MediaItem::getCoverImage).filter(Objects::nonNull).toList();
        return new CollectionDTO(c.getId(), c.getName(), c.getDescription(), c.isPublic(), c.isSystem(),
                c.getSystemType(), itemCount, posters, c.getCreatedAt(), c.getUpdatedAt());
    }

    static String validateName(String raw) {
        String name = raw == null ? "" : raw.strip();
        if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
            throw new BadRequestException("Collection name must be 1-" + MAX_NAME_LENGTH + " characters.");
        }
        if (name.chars().anyMatch(Character::isISOControl)) {
            throw new BadRequestException("Collection name contains invalid characters.");
        }
        // Reserved even before the user's system collection exists, so it can always be created later
        if (name.equalsIgnoreCase(MediaCollection.WATCH_HISTORY_NAME)) {
            throw new ConflictException("You already have a collection with that name.");
        }
        return name;
    }

    static String validateDescription(String raw) {
        if (raw == null) {
            return null;
        }
        String description = raw.strip();
        if (description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new BadRequestException("Description must be at most " + MAX_DESCRIPTION_LENGTH + " characters.");
        }
        return description.isEmpty() ? null : description;
    }
}
