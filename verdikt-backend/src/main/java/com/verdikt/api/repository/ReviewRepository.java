package com.verdikt.api.repository;

import com.verdikt.api.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {

    List<Review> findByMediaItemId(UUID mediaItemId);

    List<Review> findByUserId(UUID userId);

    Optional<Review> findByUserIdAndMediaItemId(UUID userId, UUID mediaItemId);

    boolean existsByUserIdAndMediaItemId(UUID userId, UUID mediaItemId);

    /** Rows: [mediaItemId, verdict, count] for the given titles */
    @Query("select r.mediaItem.id, r.verdict, count(r) from Review r where r.mediaItem.id in :ids group by r.mediaItem.id, r.verdict")
    List<Object[]> countVerdictsByMedia(@Param("ids") java.util.Collection<UUID> ids);

    @Modifying
    @Query("delete from Review r where r.user.id = :userId")
    int deleteAllByUserId(@Param("userId") UUID userId);
}
