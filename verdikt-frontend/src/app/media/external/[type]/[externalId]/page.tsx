"use client";

import React, { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { mediaApi } from "@/lib/api";
import { MediaType } from "@/types/media";
import { MediaDetailSkeleton } from "@/components/MediaDetailSkeleton";

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

  return <MediaDetailSkeleton />;
}
