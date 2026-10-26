import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NavProvider } from "@/context/NavContext";
import { AmbientBackground } from "@/components/AmbientBackground";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import { ToastProvider } from "@/context/ToastContext";

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
    <html lang="en" className="dark h-full antialiased bg-[#09090b]">
      <body className="font-sans min-h-full flex flex-col text-zinc-100 selection:bg-purple-500/80 selection:text-white relative">
        <AuthProvider>
          <NavProvider>
            <AmbientBackground />
            <ToastProvider>
              <NavbarWrapper>{children}</NavbarWrapper>
            </ToastProvider>
          </NavProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
