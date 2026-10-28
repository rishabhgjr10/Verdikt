"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { ReviewWithRelations } from "@/types/media";
import { reviewApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { verdictOption } from "@/components/reviews/verdicts";
import { PageHeader } from "@/components/profile/settingsUi";

export default function ContributionsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithRelations[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    reviewApi
      .getByUserId(user.id)
      .then((r) => !cancelled && setReviews(r))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const likes = (reviews ?? []).reduce((n, r) => n + (r.likeCount ?? 0), 0);
  const comments = (reviews ?? []).reduce((n, r) => n + (r.commentCount ?? 0), 0);

  return (
    <div>
      <PageHeader title="My Contributions">Everything you have added to Verdikt., and how the community responded.</PageHeader>

      <dl className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Reviews", value: reviews?.length },
          { label: "Likes received", value: reviews ? likes : undefined },
          { label: "Comments received", value: reviews ? comments : undefined },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4 flex flex-col-reverse">
            <dt className="text-xs text-zinc-500">{s.label}</dt>
            <dd className="text-2xl font-bold text-white tabular-nums">{s.value ?? "–"}</dd>
          </div>
        ))}
      </dl>

      {reviews === null ? (
        <div className="h-40 rounded-2xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-10 text-center">
          <p className="text-white font-medium">No contributions yet</p>
          <p className="mt-1 text-sm text-zinc-400">Post a verdict on any title and it will appear here.</p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
          {reviews.map((r) => {
            const v = verdictOption(r.verdict);
            return (
              <li key={r.id}>
                <Link
                  href={r.mediaItem?.id ? `/media/${r.mediaItem.id}` : "#"}
                  className="flex items-center gap-4 p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors outline-none focus-visible:bg-white/[0.06]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-white font-medium truncate">{r.mediaItem?.title ?? "Untitled"}</span>
                    <span className="block text-xs text-zinc-500">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <Heart className="w-3.5 h-3.5" aria-hidden="true" />
                    {r.likeCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    {r.commentCount ?? 0}
                  </span>
                  <span className={`${v.solid} font-semibold px-3 py-1 rounded-full text-xs`}>{v.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
