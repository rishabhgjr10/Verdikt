package com.verdikt.api.service;

import com.verdikt.api.Verdict;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.repository.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * The members' verdict for each title, computed in one place for every card, list and title page. The most common
 * verdict wins; a tie goes to the more cautious verdict (Skip over Timepass over Go For It over Perfection), the same
 * rule as topVerdict() in verdikt-frontend/src/components/reviews/verdicts.ts.
 */
@Service
public class ConsensusService {

    private final ReviewRepository reviewRepository;

    public ConsensusService(ReviewRepository reviewRepository) {
        this.reviewRepository = reviewRepository;
    }

    /** Ascending: on a tie the earlier (more cautious) verdict wins */
    private static final List<Verdict> CAUTION_ORDER = List.of(Verdict.SKIP_IT, Verdict.TIMEPASS, Verdict.GO_FOR_IT, Verdict.PERFECTION);

    static Verdict top(Map<Verdict, Long> counts) {
        return counts.entrySet().stream()
                .max(Comparator.<Map.Entry<Verdict, Long>>comparingLong(Map.Entry::getValue)
                        .thenComparing(e -> -CAUTION_ORDER.indexOf(e.getKey())))
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    /** Sets consensus and reviewCount on every stored title in the list, in one grouped query */
    @Transactional(readOnly = true)
    public <T extends List<MediaItemDTO>> T attach(T items) {
        List<UUID> ids = items.stream().map(MediaItemDTO::getId).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return items;
        }
        Map<UUID, Map<Verdict, Long>> byMedia = new HashMap<>();
        for (Object[] row : reviewRepository.countVerdictsByMedia(ids)) {
            byMedia.computeIfAbsent((UUID) row[0], k -> new EnumMap<>(Verdict.class)).put((Verdict) row[1], (Long) row[2]);
        }
        for (MediaItemDTO item : items) {
            Map<Verdict, Long> counts = item.getId() == null ? null : byMedia.get(item.getId());
            if (counts != null) {
                item.setConsensus(top(counts));
                item.setReviewCount(counts.values().stream().mapToLong(Long::longValue).sum());
            }
        }
        return items;
    }

    public MediaItemDTO attach(MediaItemDTO item) {
        attach(List.of(item));
        return item;
    }
}
