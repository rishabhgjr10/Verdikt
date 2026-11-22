import type { Metadata } from "next";

// Same fallback chain as src/lib/api.ts
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://verdikt-aegh.onrender.com/api"
).replace(/\/$/, "");

const TYPE_LABEL: Record<string, string> = { MOVIE: "Movie", SERIES: "Series", ANIME: "Anime", GAME: "Game", BOOK: "Book" };

interface TitleMeta {
  title?: string;
  mediaType?: string;
  releaseYear?: number | null;
  description?: string | null;
  coverImage?: string | null;
  backdropImage?: string | null;
}

/**
 * The title page renders in the browser, so search engines and link previews would otherwise see only the generic
 * site title. This fetches just the title's basics on the server; a slow or sleeping API falls back to the generic
 * tags after 3 s rather than holding up the page.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return {};
  try {
    const res = await fetch(`${API_BASE_URL}/media/${id}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return {};
    const m = (await res.json()) as TitleMeta;
    if (!m.title) return {};
    const kind = [TYPE_LABEL[m.mediaType ?? ""], m.releaseYear].filter(Boolean).join(", ");
    const title = `${m.title}${kind ? ` (${kind})` : ""} — Verdikt`;
    const description = (m.description || `Verdicts and reviews for ${m.title} on Verdikt.`).slice(0, 200);
    const image = m.backdropImage || m.coverImage || undefined;
    return {
      title,
      description,
      openGraph: { title, description, type: "website", ...(image ? { images: [image] } : {}) },
      twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
    };
  } catch {
    return {};
  }
}

export default function TitleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
