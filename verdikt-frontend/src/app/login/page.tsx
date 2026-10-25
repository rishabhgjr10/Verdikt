"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle, ArrowRight, KeyRound, User, Sparkles, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login({
        username: usernameOrEmail.trim(),
        password,
      });
      router.push("/");
    } catch (err: any) {
      console.error("Login failed", err);
      setError(err.response?.data?.message || "Invalid username/email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Centered Atmosphere Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/20 via-transparent to-zinc-900/10 pointer-events-none" />
      <div className="w-[500px] h-[350px] bg-purple-600/10 blur-[130px] rounded-full pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Outer Card */}
      <div className="w-full max-w-md bg-zinc-950/70 border border-white/[0.08] backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group mb-1">
            <span className="text-2xl font-black tracking-tight text-white group-hover:text-zinc-200 transition-colors">
              Verdikt<span className="text-violet-500">.</span>
            </span>
            <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
              Editorial
            </span>
          </Link>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Welcome Back
          </h1>
          <p className="text-xs text-zinc-400">
            Sign in to curate your verdicts.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-medium animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1.5 block">
              Username or Email
            </label>
            <div className="relative">
              <input
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Enter your username or email"
                className="w-full bg-zinc-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
                autoComplete="username"
              />
              <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
                autoComplete="current-password"
              />
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Primary CTA Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2.5 rounded-xl shadow-[0_0_20px_-3px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 text-purple-200" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="pt-2 text-center border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-zinc-400 hover:text-white transition-colors font-medium underline underline-offset-4"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
