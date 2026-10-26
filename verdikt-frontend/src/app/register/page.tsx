"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail, User } from "lucide-react";
import { PosterWall } from "@/components/PosterWall";
import { buildAuthHref, useNextParam } from "@/lib/auth-redirect";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Validated ?next= target (null on the server, so hydration stays consistent).
  const nextPath = useNextParam();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please choose a username.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      router.push(nextPath ?? "/");
    } catch (err: any) {
      console.error("Registration failed", err);
      const rawMsg = err?.response?.data?.message || err?.message || "";
      if (err?.response?.status === 409 || /taken|exists|duplicate/i.test(rawMsg)) {
        setError("Username or email is already taken. Please try another.");
      } else {
        setError("Registration could not be completed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#09090b]">
      {/* 
        LAYOUT:
        Desktop (>=1024px): Split CSS grid (58% Poster Wall on left, 42% centered card on right)
        Tablet & Mobile (<1024px): Poster wall as dim, blurred full-screen background; card centered
      */}
      <div className="relative w-full min-h-dvh lg:grid lg:grid-cols-[58%_42%] items-center overflow-hidden">
        {/* Left Column (Desktop) & Full-Screen Backdrop (Tablet <1024px) */}
        <div className="absolute inset-0 lg:relative lg:inset-auto h-full w-full overflow-hidden -z-10 lg:z-0 max-lg:opacity-25 max-lg:blur-[2px] max-lg:scale-105 max-sm:hidden pointer-events-none select-none">
          <PosterWall />
        </div>

        {/* Right Column (Desktop) & Centered Card Container */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full min-h-dvh p-4 sm:p-8">
          {/* Centered vibrant atmospheric glow directly behind the frosted glass card */}
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] max-w-[90vw] max-h-[90vw] rounded-full bg-gradient-to-tr from-violet-600/35 via-indigo-600/30 to-purple-600/25 blur-[120px] -z-10"
            aria-hidden="true"
          />

          {/* Back to home shortcut above card */}
          <div className="w-[min(420px,calc(100vw-2rem))] mb-3 flex items-center justify-start">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-violet-400 rounded-md py-1 px-1.5"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
          </div>

          {/* Single Frosted Glass Panel Container */}
          <div className="w-[min(420px,calc(100vw-2rem))] rounded-[28px] p-8 sm:p-10 bg-zinc-900/40 backdrop-blur-3xl backdrop-saturate-150 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(255,255,255,0.05),0_20px_60px_rgba(0,0,0,0.5),0_0_80px_rgba(139,92,246,0.15)] relative overflow-hidden before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent auth-glass-panel animate-auth-card">
            {/* Brand Header */}
            <div className="text-center mb-7">
              <Link
                href="/"
                className="inline-block text-3xl font-black tracking-tight text-white hover:text-zinc-200 transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-violet-400 rounded"
                aria-label="Verdikt home"
              >
                Verdikt<span className="text-violet-500">.</span>
              </Link>
              <h1 className="text-lg font-bold text-white tracking-tight mt-3 mb-1">
                Create account
              </h1>
              <p className="text-xs text-zinc-400">
                Sign up to get started.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1"
                >
                  Username
                </label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Choose a username"
                    autoComplete="username"
                    className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-300"
                  />
                  <User className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-300"
                  />
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 pl-11 pr-11 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-300"
                  />
                  <KeyRound className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-violet-400 rounded-md"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Inline Error Pill under form fields */}
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] mt-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Primary CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_0_24px_rgba(139,92,246,0.3)] transition-all duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] mt-5 outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4 text-violet-200" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Navigation */}
            <div className="pt-6 mt-6 text-center border-t border-white/10">
              <p className="text-xs text-zinc-400">
                Already have an account?{" "}
                <Link
                  href={buildAuthHref("/login", nextPath ?? "/")}
                  className="text-violet-400 hover:text-violet-300 font-medium transition-colors ml-0.5 hover:underline underline-offset-4 outline-none focus-visible:ring-1 focus-visible:ring-violet-400 rounded"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
