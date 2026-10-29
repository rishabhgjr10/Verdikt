import type { NextConfig } from "next";

// Same fallback chain as src/lib/api.ts
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://verdikt-aegh.onrender.com/api"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Some Indian mobile networks (e.g. Jio) block api.themoviedb.org and image.tmdb.org, so the browser
  // talks to TMDB through this site instead; Vercel's servers fetch from TMDB on its behalf.
  async rewrites() {
    return [
      { source: "/tmdb-api/:path*", destination: "https://api.themoviedb.org/3/:path*" },
      { source: "/tmdb-img/:path*", destination: "https://image.tmdb.org/:path*" },
      // Uploaded profile photos are stored as /avatars/<userId>?v=..., a same-origin path that works in every <img>
      { source: "/avatars/:userId", destination: `${API_BASE_URL}/avatars/:userId` },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
