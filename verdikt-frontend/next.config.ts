import type { NextConfig } from "next";

// Same fallback chain as src/lib/api.ts
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://verdikt-aegh.onrender.com/api"
).replace(/\/$/, "");
const API_ORIGIN = new URL(API_BASE_URL).origin;

// TMDB's key stays on the server: the /tmdb-api rewrite below adds it, so it never reaches a browser bundle.
// Reads TMDB_API_KEY (or NEXT_PUBLIC_TMDB_API_KEY) from environment, with a default fallback.
const FALLBACK_TMDB_KEY = "801a93954c3a3f63f691e72f175cf265";
const TMDB_API_KEY =
  process.env.TMDB_API_KEY ||
  process.env.NEXT_PUBLIC_TMDB_API_KEY ||
  FALLBACK_TMDB_KEY;

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy: scripts only from this site, network calls only to this site and the API, frames only
 * from YouTube. shortcut: 'unsafe-inline' scripts are still allowed because Next's App Router injects inline
 * scripts; a nonce-based policy (via middleware) removes that, at the cost of dynamic rendering.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN}${isDev ? " ws: http://localhost:8080" : ""}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // Some Indian mobile networks (e.g. Jio) block api.themoviedb.org and image.tmdb.org, so the browser
  // talks to TMDB through this site instead; Vercel's servers fetch from TMDB on its behalf.
  async rewrites() {
    return [
      {
        source: "/tmdb-api/:path*",
        destination: `https://api.themoviedb.org/3/:path*?api_key=${encodeURIComponent(TMDB_API_KEY)}`,
      },
      { source: "/tmdb-img/:path*", destination: "https://image.tmdb.org/:path*" },
      // Uploaded profile photos are stored as /avatars/<userId>?v=..., a same-origin path that works in every <img>
      { source: "/avatars/:userId", destination: `${API_BASE_URL}/avatars/:userId` },
    ];
  },
  images: {
    // The only next/image user (PosterWall) loads TMDB posters through /tmdb-img; an open "**" pattern let anyone
    // use this site's image optimizer, and its quota, for arbitrary URLs
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },
};

export default nextConfig;
