import { describe, expect, it } from 'vitest';
import { safeTrailerUrl, youtubeVideoId } from '@/lib/streamingUtils';

describe('youtubeVideoId', () => {
  it('reads watch, short and embed links', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')).toBe('dQw4w9WgXcQ');
  });

  it('rejects anything that only looks like YouTube', () => {
    expect(youtubeVideoId('javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeVideoId('https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeVideoId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(safeTrailerUrl(null)).toBeNull();
  });
});
