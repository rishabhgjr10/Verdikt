import axios from "axios";
import {
  expandSearchQueries,
  fallbackSearchQueries,
  hasRatedTitleMatch,
  resolveSearchAlias,
} from "@/lib/catalog-navigation";
import {
  AuthResponse,
  CollectionDetail,
  CollectionSummary,
  CreateReviewPayload,
  ExternalReview,
  InterestPeriod,
  MediaItem,
  MediaItemExtras,
  MediaType,
  MediaUserState,
  MostInterestedItem,
  RatingSource,
  ReviewComment,
  ReviewWithRelations,
  UpdateProfilePayload,
  User,
  WatchedResult,
} from "@/types/media";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://verdikt-aegh.onrender.com/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Long enough for Render's free tier to wake up (50-90s) instead of failing every first request after idle
  timeout: 90000,
  // Stored poster/backdrop URLs point at image.tmdb.org, which some mobile networks block: use this site's proxy
  transformResponse: [
    (data) => (typeof data === "string" ? data.replace(/https?:\/\/image\.tmdb\.org\//g, "/tmdb-img/") : data),
    ...(Array.isArray(axios.defaults.transformResponse)
      ? axios.defaults.transformResponse
      : axios.defaults.transformResponse
        ? [axios.defaults.transformResponse]
        : []),
  ],
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("verdikt_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const authApi = {
  login: async (data: { username?: string; email?: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/login", data);
    return response.data;
  },
  register: async (data: { username: string; email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/register", data);
    return response.data;
  },
};

/** The server's message for a failed request, or the fallback */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

/** The signed-in user's own account */
export const profileApi = {
  me: async (): Promise<User> => (await api.get<User>("/me/profile")).data,
  update: async (data: UpdateProfilePayload): Promise<User> => (await api.put<User>("/me/profile", data)).data,
  uploadAvatar: async (photo: Blob): Promise<User> => {
    const form = new FormData();
    form.append("file", photo, "avatar.jpg");
    // Overrides the JSON default; axios fills in the multipart boundary
    return (await api.put<User>("/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  removeAvatar: async (): Promise<User> => (await api.delete<User>("/me/avatar")).data,
  /** Returns a fresh session: the old token stops working once the username changes */
  changeUsername: async (username: string): Promise<AuthResponse> =>
    (await api.put<AuthResponse>("/me/username", { username })).data,
  deleteAccount: async (password: string): Promise<void> => {
    await api.delete("/me", { data: { password } });
  },
};

const inFlightExternalImports = new Map<string, Promise<MediaItem>>();


export const mediaApi = {
  search: async (
    query: string,
    mediaType: MediaType | "ALL" = "ALL",
    page: number = 1,
    signal?: AbortSignal
  ): Promise<MediaItem[]> => {
    const finalQuery = resolveSearchAlias(query);
    const response = await api.get<MediaItem[]>("/media/search", {
      params: { q: finalQuery, type: mediaType, page },
      signal,
    });
    return response.data;
  },
  /**
   * User-typed search across all types: also searches the hyphenated form ("spiderman" -> "spider-man") and, when no
   * rated title matches, retries with one word dropped. Unranked and may hold duplicates: pass through rankAndFilterSearchResults.
   */
  searchTyped: async (query: string, page: number = 1, signal?: AbortSignal): Promise<MediaItem[]> => {
    const run = (queries: string[]) =>
      Promise.all(queries.map((q) => mediaApi.search(q, "ALL", page, signal))).then((r) => r.flat());
    const items = await run(expandSearchQueries(query));
    const fallbacks = fallbackSearchQueries(query);
    if (!fallbacks.length || hasRatedTitleMatch(items, query)) return items;
    return [...items, ...(await run(fallbacks))];
  },
  getById: async (id: string): Promise<MediaItem> => {
    const response = await api.get<MediaItem>(`/media/${id}`);
    return response.data;
  },
  getByExternalId: async (
    mediaType: MediaType,
    externalId: string
  ): Promise<MediaItem> => {
    const key = `${mediaType}:${externalId}`;
    const existing = inFlightExternalImports.get(key);
    if (existing) {
      return existing;
    }

    const requestPromise = api
      .get<MediaItem>(`/media/external/${mediaType}/${externalId}`)
      .then((res) => res.data)
      .finally(() => {
        inFlightExternalImports.delete(key);
      });

    inFlightExternalImports.set(key, requestPromise);
    return requestPromise;
  },
};

export const reviewApi = {
  create: async (payload: CreateReviewPayload): Promise<ReviewWithRelations> => {
    const response = await api.post<ReviewWithRelations>("/reviews", payload);
    return response.data;
  },
  getByMediaId: async (mediaId: string): Promise<ReviewWithRelations[]> => {
    const response = await api.get<ReviewWithRelations[]>(`/reviews/media/${mediaId}`);
    return response.data;
  },
  getByUserId: async (userId: string): Promise<ReviewWithRelations[]> => {
    const response = await api.get<ReviewWithRelations[]>(`/reviews/user/${userId}`);
    return response.data;
  },
  /** Owner-only; likes and comments are removed with it. */
  delete: async (reviewId: string): Promise<void> => {
    await api.delete(`/reviews/${reviewId}`);
  },
  toggleLike: async (reviewId: string): Promise<{ liked: boolean; likeCount: number }> => {
    const response = await api.post<{ liked: boolean; likeCount: number }>(`/reviews/${reviewId}/like`);
    return response.data;
  },
  getComments: async (reviewId: string): Promise<ReviewComment[]> => {
    const response = await api.get<ReviewComment[]>(`/reviews/${reviewId}/comments`);
    return response.data;
  },
  addComment: async (reviewId: string, text: string): Promise<ReviewComment> => {
    const response = await api.post<ReviewComment>(`/reviews/${reviewId}/comments`, { text });
    return response.data;
  },
};

export const userMediaApi = {
  getState: async (mediaId: string): Promise<MediaUserState> => {
    const response = await api.get<MediaUserState>(`/media/${mediaId}/me`);
    return response.data;
  },
  setWatched: async (mediaId: string, value: boolean): Promise<WatchedResult> => {
    const response = await api.put<WatchedResult>(`/media/${mediaId}/watched`, { value });
    return response.data;
  },
  setWatchLater: async (mediaId: string, value: boolean): Promise<WatchedResult> => {
    const response = await api.put<WatchedResult>(`/media/${mediaId}/watch-later`, { value });
    return response.data;
  },
  setFavorite: async (mediaId: string, value: boolean): Promise<{ favorite: boolean }> => {
    const response = await api.put<{ favorite: boolean }>(`/media/${mediaId}/favorite`, { value });
    return response.data;
  },
  getFavorites: async (): Promise<MediaItem[]> => {
    const response = await api.get<MediaItem[]>("/me/favorites");
    return response.data;
  },
  getWatchLater: async (): Promise<(MediaItem & MediaItemExtras)[]> => {
    const response = await api.get<(MediaItem & MediaItemExtras)[]>("/me/watch-later");
    return response.data;
  },
};

export const collectionsApi = {
  list: async (): Promise<CollectionSummary[]> => {
    const response = await api.get<CollectionSummary[]>("/collections");
    return response.data;
  },
  get: async (id: string): Promise<CollectionDetail> => {
    const response = await api.get<CollectionDetail>(`/collections/${id}`);
    return response.data;
  },
  create: async (data: { name: string; description?: string; isPublic?: boolean; mediaId?: string }): Promise<CollectionSummary> => {
    const response = await api.post<CollectionSummary>("/collections", data);
    return response.data;
  },
  update: async (id: string, data: { name?: string; description?: string; isPublic?: boolean }): Promise<CollectionSummary> => {
    const response = await api.patch<CollectionSummary>(`/collections/${id}`, data);
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/collections/${id}`);
  },
  addItem: async (id: string, mediaId: string): Promise<CollectionSummary> => {
    const response = await api.put<CollectionSummary>(`/collections/${id}/items/${mediaId}`);
    return response.data;
  },
  removeItem: async (id: string, mediaId: string): Promise<CollectionSummary> => {
    const response = await api.delete<CollectionSummary>(`/collections/${id}/items/${mediaId}`);
    return response.data;
  },
};

export const mostInterestedApi = {
  get: async (period: InterestPeriod, limit = 5, signal?: AbortSignal): Promise<MostInterestedItem[]> => {
    const response = await api.get<MostInterestedItem[]>("/media/most-interested", {
      params: { period, limit },
      signal,
    });
    return response.data;
  },
};

export const ratingsApi = {
  get: async (mediaId: string, signal?: AbortSignal): Promise<RatingSource[]> => {
    const response = await api.get<{ sources: RatingSource[] }>(`/media/${mediaId}/ratings`, { signal });
    return response.data?.sources ?? [];
  },
};

export const externalReviewsApi = {
  get: async (mediaId: string, signal?: AbortSignal): Promise<ExternalReview[]> => {
    const response = await api.get<{ reviews: ExternalReview[] }>(`/media/${mediaId}/external-reviews`, { signal });
    return response.data?.reviews ?? [];
  },
};
