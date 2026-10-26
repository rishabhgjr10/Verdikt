export type MediaType = "MOVIE" | "SERIES" | "ANIME" | "GAME" | "BOOK";

export type Verdict = "PERFECTION" | "GO_FOR_IT" | "TIMEPASS" | "SKIP_IT";

export interface MediaItem {
  id: string;
  externalId: string;
  mediaType: MediaType;
  title: string;
  releaseYear: number | null;
  coverImage: string | null;
  backdropImage: string | null;
  description: string | null;
  trailerUrl: string | null;
  creatorsJson: string[] | null;
  genresJson: string[] | null;
  platformsJson: string[] | null;
}

export interface Review {
  id: string;
  userId: string;
  mediaItemId: string;
  verdict: Verdict;
  content: string;
  containsSpoilers: boolean;
  createdAt: string;
}

export interface ReviewWithRelations extends Review {
  user?: UserSummary;
  mediaItem?: MediaItem;
}

export interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface CreateReviewRequest {
  mediaItemId: string;
  verdict: Verdict;
  content: string;
  containsSpoilers: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

export interface CreateReviewPayload {
  mediaItemId?: string;
  verdict: Verdict;
  content: string;
  containsSpoilers: boolean;
  mediaDetails?: MediaItem;
}

export interface MediaItemSearchParams {
  query?: string;
  mediaType?: MediaType | "ALL";
  page?: number;
  size?: number;
}

// ── User media state, collections, Most Interested, ratings ────────────────

export interface RatingSource {
  key: string;
  label: string;
  value: number;
  display: string;
  count: number | null;
  url: string | null;
}

export interface MediaItemExtras {
  releaseDate?: string | null;
  topRatings?: RatingSource[] | null;
}

export interface MediaUserState {
  watched: boolean;
  watchLater: boolean;
  collectionIds: string[];
  hasReview: boolean;
}

export interface WatchedResult {
  watched: boolean;
  watchLater: boolean;
  deletedReview?: boolean;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isSystem: boolean;
  systemType: "WATCH_HISTORY" | null;
  itemCount: number;
  previewPosters: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDetail {
  collection: CollectionSummary;
  items: (MediaItem & MediaItemExtras)[];
}

export type InterestPeriod = "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "ALL";

export interface MostInterestedItem {
  id: string | null;
  externalId: string;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  statusLabel: string | null;
  interestedCount: number | null;
}

export interface ExternalReview {
  author: string;
  rating: number | null;
  createdAt: string | null;
  excerpt: string;
  url: string;
}
