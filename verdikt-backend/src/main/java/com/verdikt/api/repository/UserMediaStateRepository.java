package com.verdikt.api.repository;

import com.verdikt.api.UserMediaState;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserMediaStateRepository extends JpaRepository<UserMediaState, UUID> {

    Optional<UserMediaState> findByUserIdAndMediaId(UUID userId, UUID mediaId);

    List<UserMediaState> findByUserIdAndWatchLaterTrueOrderByWatchLaterAtDesc(UUID userId);

    List<UserMediaState> findByUserIdAndFavoriteTrueOrderByFavoritedAtDesc(UUID userId);

    /** Rows: [mediaId (UUID), interestedCount (Long)] — aggregates only, never user ids. */
    @Query("select s.mediaId, count(s) from UserMediaState s "
            + "where s.watchLater = true and s.watchLaterAt >= :since "
            + "group by s.mediaId order by count(s) desc, max(s.watchLaterAt) desc")
    List<Object[]> countInterestSince(@Param("since") Instant since, Pageable pageable);

    @Query("select s.mediaId, count(s) from UserMediaState s "
            + "where s.watchLater = true "
            + "group by s.mediaId order by count(s) desc, max(s.watchLaterAt) desc")
    List<Object[]> countInterestAllTime(Pageable pageable);
}
