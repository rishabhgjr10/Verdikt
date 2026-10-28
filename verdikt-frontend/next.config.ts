import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Some Indian mobile networks (e.g. Jio) block api.themoviedb.org and image.tmdb.org, so the browser
  // talks to TMDB through this site instead; Vercel's servers fetch from TMDB on its behalf.
  async rewrites() {
    return [
      { source: "/tmdb-api/:path*", destination: "https://api.themoviedb.org/3/:path*" },
      { source: "/tmdb-img/:path*", destination: "https://image.tmdb.org/:path*" },
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
