import { describe, expect, it } from 'vitest';
import { audienceVerdict, MIN_VERDICT_VOTES } from '@/lib/tmdb';

describe('audienceVerdict (the one verdict rule for every card)', () => {
  const now = new Date('2026-11-08T12:00:00Z');

  it('maps a well-voted score to its tier', () => {
    expect(audienceVerdict({ voteAverage: 8.5, voteCount: 9000, releaseDate: '1957-04-10' }, now)).toBe('PERFECTION');
    expect(audienceVerdict({ voteAverage: 8.1, voteCount: 6000, releaseDate: '2024-02-27' }, now)).toBe('GO_FOR_IT');
    expect(audienceVerdict({ voteAverage: 6.0, voteCount: 500, releaseYear: 2010 }, now)).toBe('TIMEPASS');
    expect(audienceVerdict({ voteAverage: 4.0, voteCount: 500, releaseYear: 2010 }, now)).toBe('SKIP_IT');
  });

  it('gives no verdict to thinly voted titles', () => {
    expect(audienceVerdict({ voteAverage: 9.0, voteCount: MIN_VERDICT_VOTES - 1, releaseYear: 1991 }, now)).toBeNull();
  });

  it('gives no verdict to unreleased titles', () => {
    expect(audienceVerdict({ voteAverage: 9.0, voteCount: 0, releaseDate: '2026-12-18' }, now)).toBeNull();
    expect(audienceVerdict({ voteAverage: 9.0, voteCount: 500, releaseYear: 2027 }, now)).toBeNull();
  });

  it('gives no verdict without a score', () => {
    expect(audienceVerdict({ voteAverage: null }, now)).toBeNull();
    expect(audienceVerdict({}, now)).toBeNull();
  });
});
