package com.verdikt.api.controller;

import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.service.MediaItemService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private static final Logger log = LoggerFactory.getLogger(MediaController.class);

    private final MediaItemService mediaItemService;

    public MediaController(MediaItemService mediaItemService) {
        this.mediaItemService = mediaItemService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<MediaItemDTO>> search(
            @RequestParam(value = "q", required = false, defaultValue = "") String query,
            @RequestParam(value = "type", required = false, defaultValue = "ALL") String mediaType,
            @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        try {
            List<MediaItemDTO> results = mediaItemService.searchMedia(query, mediaType, page);
            return ResponseEntity.ok(results != null ? results : Collections.emptyList());
        } catch (Exception e) {
            log.error("Unhandled exception during media search [query='{}', type='{}', page={}]: {}",
                    query, mediaType, page, e.getMessage(), e);
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<MediaItemDTO> getById(@PathVariable UUID id) {
        MediaItemDTO mediaItem = mediaItemService.getMediaItemById(id);
        return ResponseEntity.ok(mediaItem);
    }

    @GetMapping("/external/{mediaType}/{externalId}")
    public ResponseEntity<MediaItemDTO> getOrCreateByExternalId(
            @PathVariable String mediaType,
            @PathVariable String externalId) {
        MediaType type = MediaType.valueOf(mediaType.toUpperCase());
        var entity = mediaItemService.getOrCreateMediaItem(externalId, type);
        return ResponseEntity.ok(MediaItemDTO.fromEntity(entity));
    }
}
