/**
 * streamingUtils.ts
 * Maps streaming platform names → deep-link search URLs and brand colours.
 * Logo images come from TMDB when available; otherwise we fall back to
 * a coloured initial badge rendered in CSS.
 */

export interface PlatformMeta {
  name: string;
  searchUrl: string;
  color: string;       // Tailwind bg colour class for the initial badge fallback
  textColor: string;   // Tailwind text colour class
}

/** Build a direct watch / search URL for a given platform + title */
export function getPlatformSearchUrl(platform: string, title: string): string {
  const q = encodeURIComponent(title);
  const p = platform.toLowerCase();

  if (p.includes("netflix"))          return `https://www.netflix.com/search?q=${q}`;
  if (p.includes("prime") || p.includes("amazon"))
                                       return `https://www.amazon.com/s?k=${q}&i=instant-video`;
  if (p.includes("disney"))            return `https://www.disneyplus.com/search/${q}`;
  if (p.includes("hbo") || p.includes("max"))
                                       return `https://www.max.com/search?q=${q}`;
  if (p.includes("apple"))             return `https://tv.apple.com/search?term=${q}`;
  if (p.includes("hulu"))              return `https://www.hulu.com/search?q=${q}`;
  if (p.includes("peacock"))           return `https://www.peacocktv.com/watch/search?q=${q}`;
  if (p.includes("paramount"))         return `https://www.paramountplus.com/search/${q}/`;
  if (p.includes("crunchyroll"))       return `https://www.crunchyroll.com/search?q=${q}`;
  if (p.includes("funimation"))        return `https://www.funimation.com/search/?q=${q}`;
  if (p.includes("vudu"))              return `https://www.vudu.com/content/movies/search?searchString=${q}`;
  if (p.includes("google") || p.includes("play"))
                                       return `https://play.google.com/store/search?q=${q}&c=movies`;
  if (p.includes("youtube"))           return `https://www.youtube.com/results?search_query=${q}`;
  if (p.includes("mubi"))              return `https://mubi.com/en/search?q=${q}`;
  if (p.includes("showtime"))          return `https://www.paramountplus.com/search/${q}/`;
  if (p.includes("starz"))             return `https://www.starz.com/search#${q}`;

  // Generic Google search fallback
  return `https://www.google.com/search?q=${q}+watch+online+${encodeURIComponent(platform)}`;
}

/** Brand colour map for initial-badge fallback */
export function getPlatformColor(platform: string): { bg: string; text: string } {
  const p = platform.toLowerCase();
  if (p.includes("netflix"))    return { bg: "bg-red-600",    text: "text-white" };
  if (p.includes("prime") || p.includes("amazon"))
                                 return { bg: "bg-sky-500",   text: "text-white" };
  if (p.includes("disney"))     return { bg: "bg-blue-700",   text: "text-white" };
  if (p.includes("hbo") || p.includes("max"))
                                 return { bg: "bg-indigo-700", text: "text-white" };
  if (p.includes("apple"))      return { bg: "bg-slate-700",  text: "text-white" };
  if (p.includes("hulu"))       return { bg: "bg-green-600",  text: "text-white" };
  if (p.includes("peacock"))    return { bg: "bg-yellow-500", text: "text-slate-900" };
  if (p.includes("paramount"))  return { bg: "bg-blue-500",   text: "text-white" };
  if (p.includes("crunchyroll"))return { bg: "bg-orange-500", text: "text-white" };
  if (p.includes("funimation")) return { bg: "bg-violet-600", text: "text-white" };
  return                               { bg: "bg-slate-600",  text: "text-white" };
}

/** Prefix a TMDB logo path with the image CDN base URL */
export function tmdbLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  const clean = logoPath.startsWith("/") ? logoPath : `/${logoPath}`;
  return `https://image.tmdb.org/t/p/w92${clean}`;
}

/** Generate a YouTube trailer fallback URL for a given title */
export function youtubeTrailerUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " official trailer")}`;
}
