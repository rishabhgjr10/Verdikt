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
