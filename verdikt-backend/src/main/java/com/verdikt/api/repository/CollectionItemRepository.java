package com.verdikt.api.repository;

import com.verdikt.api.CollectionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CollectionItemRepository extends JpaRepository<CollectionItem, CollectionItem.Key> {

    List<CollectionItem> findByIdCollectionIdOrderByAddedAtDesc(UUID collectionId);

    /** Rows: [collectionId (UUID), itemCount (Long)]. */
    @Query("select ci.id.collectionId, count(ci) from CollectionItem ci "
            + "where ci.id.collectionId in :ids group by ci.id.collectionId")
    List<Object[]> countByCollectionIds(@Param("ids") Collection<UUID> ids);

    /** Ids of the given user's collections that contain the media item. */
    @Query("select ci.id.collectionId from CollectionItem ci, MediaCollection c "
            + "where c.id = ci.id.collectionId and c.userId = :userId and ci.id.mediaId = :mediaId")
    List<UUID> findCollectionIdsContaining(@Param("userId") UUID userId, @Param("mediaId") UUID mediaId);
}
