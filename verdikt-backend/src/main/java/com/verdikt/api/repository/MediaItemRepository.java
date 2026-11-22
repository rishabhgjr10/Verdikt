package com.verdikt.api.repository;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MediaItemRepository extends JpaRepository<MediaItem, UUID> {

    Optional<MediaItem> findByExternalIdAndMediaType(String externalId, MediaType mediaType);

    Optional<MediaItem> findFirstByExternalIdAndMediaTypeIn(String externalId, Collection<MediaType> mediaTypes);

    List<MediaItem> findByMediaType(MediaType mediaType);

    List<MediaItem> findByTitleContainingIgnoreCase(String title);

    /** Bounded local search: a substring match can't use an index, so it never returns the whole table */
    List<MediaItem> findByTitleContainingIgnoreCase(String title, Pageable page);

    List<MediaItem> findByMediaTypeAndTitleContainingIgnoreCase(MediaType mediaType, String title, Pageable page);

    List<MediaItem> findByExternalIdIn(Collection<String> externalIds);

    List<MediaItem> findByMediaTypeAndTitleContainingIgnoreCase(MediaType mediaType, String title);
}
