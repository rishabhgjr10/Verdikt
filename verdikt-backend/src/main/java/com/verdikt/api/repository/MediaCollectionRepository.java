package com.verdikt.api.repository;

import com.verdikt.api.MediaCollection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MediaCollectionRepository extends JpaRepository<MediaCollection, UUID> {

    /** System collections first, then the user's own in creation order. */
    @Query("select c from MediaCollection c where c.userId = :userId order by c.isSystem desc, c.createdAt asc")
    List<MediaCollection> findAllForUser(@Param("userId") UUID userId);

    Optional<MediaCollection> findByUserIdAndSystemType(UUID userId, String systemType);

    @Query("select count(c) from MediaCollection c where c.userId = :userId and c.isSystem = false")
    long countUserCollections(@Param("userId") UUID userId);

    @Query("select count(c) > 0 from MediaCollection c where c.userId = :userId "
            + "and lower(c.name) = lower(:name) and (:excludeId is null or c.id <> :excludeId)")
    boolean nameTaken(@Param("userId") UUID userId, @Param("name") String name, @Param("excludeId") UUID excludeId);

    @Modifying
    @Query("delete from MediaCollection c where c.userId = :userId")
    int deleteAllByUserId(@Param("userId") UUID userId);
}
