package com.verdikt.api.controller;

import com.verdikt.api.service.CollectionService;
import com.verdikt.api.service.CollectionService.CollectionDTO;
import com.verdikt.api.service.CollectionService.CollectionDetailDTO;
import com.verdikt.api.service.CollectionService.CreateCollectionRequest;
import com.verdikt.api.service.CollectionService.UpdateCollectionRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** The signed-in user's collections (auth required, ownership checked in the service). */
@RestController
@RequestMapping("/api/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping
    public List<CollectionDTO> list(@AuthenticationPrincipal UserDetails user) {
        return collectionService.list(user.getUsername());
    }

    @GetMapping("/{id}")
    public CollectionDetailDTO get(@PathVariable UUID id, @AuthenticationPrincipal UserDetails user) {
        return collectionService.get(user.getUsername(), id);
    }

    @PostMapping
    public ResponseEntity<CollectionDTO> create(@RequestBody CreateCollectionRequest request,
                                                @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(collectionService.create(user.getUsername(), request));
    }

    @PatchMapping("/{id}")
    public CollectionDTO update(@PathVariable UUID id, @RequestBody UpdateCollectionRequest request,
                                @AuthenticationPrincipal UserDetails user) {
        return collectionService.update(user.getUsername(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @AuthenticationPrincipal UserDetails user) {
        collectionService.delete(user.getUsername(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/items/{mediaId}")
    public CollectionDTO addItem(@PathVariable UUID id, @PathVariable UUID mediaId,
                                 @AuthenticationPrincipal UserDetails user) {
        return collectionService.addItem(user.getUsername(), id, mediaId);
    }

    @DeleteMapping("/{id}/items/{mediaId}")
    public CollectionDTO removeItem(@PathVariable UUID id, @PathVariable UUID mediaId,
                                    @AuthenticationPrincipal UserDetails user) {
        return collectionService.removeItem(user.getUsername(), id, mediaId);
    }
}
