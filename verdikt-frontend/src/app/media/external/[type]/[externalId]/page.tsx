"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { mediaApi } from "@/lib/api";
import { MediaType } from "@/types/media";
import { MediaDetailSkeleton } from "@/components/MediaDetailSkeleton";
import { useNav, type NavMediaCategory } from "@/context/NavContext";

export default function ExternalMediaPage({
  params,
}: {
  params: Promise<{ type: string; externalId: string }>;
}) {
  const { type, externalId } = use(params);
  const router = useRouter();
  const { setActiveCategory } = useNav();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrImport() {
      setIsLoading(true);
      setError(null);

      try {
        const mediaType = type.toUpperCase() as MediaType;
        const item = await mediaApi.getByExternalId(mediaType, externalId);

        if (isCancelled) return;

        if (item && item.id) {
          if (item.mediaType) {
            setActiveCategory(item.mediaType as NavMediaCategory);
          }
          router.replace(`/media/${item.id}`);
        } else {
          throw new Error("Invalid media item received from server");
        }
      } catch (err: unknown) {
        if (isCancelled) return;

        // Never show the error card for CanceledError / AbortError
        if (
          axios.isCancel(err) ||
          (err instanceof Error &&
            (err.name === "AbortError" ||
              err.name === "CanceledError" ||
              err.message.toLowerCase().includes("canceled") ||
              err.message.toLowerCase().includes("aborted")))
        ) {
          return;
        }

        console.error("Failed to import external item", err);
        const message =
          err instanceof Error
            ? err.message
            : "We encountered an issue fetching this item. It might be temporarily unavailable.";
        setError(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadOrImport();

    return () => {
      isCancelled = true;
    };
  }, [type, externalId, router, setActiveCategory, retryTrigger]);

  if (isLoading) {
    return <MediaDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-semibold text-white tracking-tight mb-2">
          Couldn't load this title
        </h1>
        <p className="text-sm text-neutral-400 max-w-sm mb-6 leading-relaxed">
          {error.includes("502")
            ? "External provider is temporarily unavailable. Please try again."
            : error.includes("404")
            ? "This media item could not be found."
            : "We encountered an issue fetching this item. It might be temporarily unavailable."}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRetryTrigger((c) => c + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-200 text-sm font-medium border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
