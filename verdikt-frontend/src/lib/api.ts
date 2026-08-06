import axios from "axios";
import {
  AuthResponse,
  CreateReviewPayload,
  MediaItem,
  MediaType,
  ReviewWithRelations,
} from "@/types/media";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://verdikt-aegh.onrender.com/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
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

export const mediaApi = {
  search: async (query: string, mediaType: MediaType | "ALL" = "ALL", page: number = 1): Promise<MediaItem[]> => {
    const response = await api.get<MediaItem[]>("/media/search", {
      params: { q: query, type: mediaType, page },
    });
    return response.data;
  },
  getById: async (id: string): Promise<MediaItem> => {
    const response = await api.get<MediaItem>(`/media/${id}`);
    return response.data;
  },
  getByExternalId: async (mediaType: MediaType, externalId: string): Promise<MediaItem> => {
    const response = await api.get<MediaItem>(`/media/external/${mediaType}/${externalId}`);
    return response.data;
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
};
