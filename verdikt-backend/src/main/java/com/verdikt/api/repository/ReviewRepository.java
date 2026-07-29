package com.verdikt.api.repository;

import com.verdikt.api.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {

    List<Review> findByMediaItemId(UUID mediaItemId);

    List<Review> findByUserId(UUID userId);

    Optional<Review> findByUserIdAndMediaItemId(UUID userId, UUID mediaItemId);
}
