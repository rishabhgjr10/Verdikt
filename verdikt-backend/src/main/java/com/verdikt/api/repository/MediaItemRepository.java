package com.verdikt.api.repository;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MediaItemRepository extends JpaRepository<MediaItem, UUID> {

    Optional<MediaItem> findByExternalIdAndMediaType(String externalId, MediaType mediaType);

    List<MediaItem> findByMediaType(MediaType mediaType);

    List<MediaItem> findByTitleContainingIgnoreCase(String title);

    List<MediaItem> findByMediaTypeAndTitleContainingIgnoreCase(MediaType mediaType, String title);
}
