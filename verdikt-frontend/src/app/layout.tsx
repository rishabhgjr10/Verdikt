import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Verdikt — Unified Entertainment Verdicts & Reviews",
  description: "Discover, rate, and review Movies, TV Series, Anime, Video Games, and Books on Verdikt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-violet-500 selection:text-white`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
