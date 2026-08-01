"use client";

import React, { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { mediaApi } from "@/lib/api";
import { MediaType } from "@/types/media";

export default function ExternalMediaPage({
  params,
}: {
  params: Promise<{ type: string; externalId: string }>;
}) {
  const { type, externalId } = use(params);
  const router = useRouter();

  useEffect(() => {
    async function loadOrImport() {
      try {
        const mediaType = type.toUpperCase() as MediaType;
        const item = await mediaApi.getByExternalId(mediaType, externalId);
        if (item && item.id) {
          router.replace(`/media/${item.id}`);
        } else {
          router.replace("/");
        }
      } catch (err) {
        console.error("Failed to import external item", err);
        router.replace("/");
      }
    }
    loadOrImport();
  }, [type, externalId, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-semibold text-slate-300">Fetching media metadata...</p>
    </div>
  );
}
