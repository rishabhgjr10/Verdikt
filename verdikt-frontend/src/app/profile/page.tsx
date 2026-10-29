"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Heart, Layers, MessageCircle, User as UserIcon, Users } from "lucide-react";
import { CollectionSummary, MediaItem, MediaType, ReviewWithRelations, Verdict } from "@/types/media";
import { collectionsApi, reviewApi, userMediaApi } from "@/lib/api";
import { SlidingPill } from "@/components/ui/SlidingPill";
import { verdictOption, VERDICT_OPTIONS } from "@/components/reviews/verdicts";
import { InstagramIcon, XIcon, YouTubeIcon } from "@/components/profile/SocialIcons";
import { displayName, joinedLabel, useSignedInUser } from "@/components/profile/profileData";

const GLASS = "bg-[#0f0f11]/80 backdrop-blur-xl border border-white/[0.08]";
const TYPE_LABELS: Record<MediaType, string> = { MOVIE: "Movie", SERIES: "Series", ANIME: "Anime", GAME: "Game", BOOK: "Book" };
const SELECT =
  "bg-[#09090b] border border-white/[0.1] rounded-xl pl-3 pr-8 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer";

function Avatar({ url, size }: { url?: string | null; size: string }) {
  return (
    <span className={`${size} shrink-0 rounded-full border-2 border-white/10 bg-zinc-800 overflow-hidden flex items-center justify-center`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <UserIcon className="w-1/2 h-1/2 text-zinc-500" aria-hidden="true" />
      )}
    </span>
  );
}

function ProfileReviewCard({ review }: { review: ReviewWithRelations }) {
  const media = review.mediaItem;
  const v = verdictOption(review.verdict);
  const poster = media?.coverImage?.replace(/^http:\/\//, "https://");
  const body = (
    <>
      <div className="w-20 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 border border-white/10">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-white truncate group-hover:text-violet-300 transition-colors">{media?.title ?? "Untitled"}</p>
            <p className="text-xs text-zinc-500">
              {[media ? TYPE_LABELS[media.mediaType] : null, media?.releaseYear, review.createdAt && new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
          <span className={`${v.solid} shrink-0 font-semibold px-3 py-1 rounded-full text-xs`}>{v.label}</span>
        </div>
        {review.containsSpoilers ? (
          <p className="mt-3 text-sm text-amber-300/80 italic">Contains spoilers. Open the title to read it.</p>
        ) : (
          <p className="mt-3 text-sm text-zinc-300 leading-relaxed line-clamp-3 whitespace-pre-line">{review.content}</p>
        )}
        <div className="mt-3 flex gap-4 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="w-4 h-4" aria-hidden="true" />
            <span className="tabular-nums">{review.likeCount ?? 0}</span>
            <span className="sr-only">likes</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span className="tabular-nums">{review.commentCount ?? 0}</span>
            <span className="sr-only">comments</span>
          </span>
        </div>
      </div>
    </>
  );
  const cls = `group flex gap-4 ${GLASS} rounded-2xl p-4 transition-colors`;
  return media?.id ? (
    <Link href={`/media/${media.id}`} className={`${cls} hover:border-white/[0.16] outline-none focus-visible:ring-2 focus-visible:ring-white/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Horizontal row of the titles the user hearted on media pages, newest first. */
function FavoritesRow({ items }: { items: MediaItem[] | null }) {
  return (
    <section aria-labelledby="favorites-title">
      <h2 id="favorites-title" className="flex items-center gap-2 text-lg font-bold text-white mb-3">
        <Heart className="w-5 h-5 fill-rose-500 text-rose-500" aria-hidden="true" />
        Favorites
      </h2>
      {items === null ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-32 shrink-0 aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 text-center text-zinc-500 text-sm">
          No favorites yet. Click the heart icon on any movie or show to add it here.
        </p>
      ) : (
        <ul className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {items.map((m) => {
            const poster = m.coverImage?.replace(/^http:\/\//, "https://");
            return (
              <li key={m.id} className="w-32 shrink-0">
                <Link href={`/media/${m.id}`} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 border border-white/10 group-hover:border-white/20 transition-colors">
                    {poster && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">{m.title}</p>
                  <p className="text-xs text-zinc-500">{[TYPE_LABELS[m.mediaType], m.releaseYear].filter(Boolean).join(" • ")}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { user } = useSignedInUser();
  const [tab, setTab] = useState<"reviews" | "collections">("reviews");
  const [reviews, setReviews] = useState<ReviewWithRelations[] | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [favorites, setFavorites] = useState<MediaItem[] | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<MediaType | "ALL">("ALL");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    reviewApi
      .getByUserId(user.id)
      .then((r) => !cancelled && setReviews(r.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))))
      .catch(() => !cancelled && setReviews([]));
    collectionsApi
      .list()
      .then((c) => !cancelled && setCollections(c.filter((x) => !x.isSystem)))
      .catch(() => !cancelled && setCollections([]));
    userMediaApi
      .getFavorites()
      .then((f) => !cancelled && setFavorites(f))
      .catch(() => !cancelled && setFavorites([]));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleReviews = useMemo(
    () =>
      (reviews ?? []).filter(
        (r) =>
          (verdictFilter === "ALL" || r.verdict === verdictFilter) &&
          (typeFilter === "ALL" || r.mediaItem?.mediaType === typeFilter)
      ),
    [reviews, verdictFilter, typeFilter]
  );

  if (!user) return null;
  const joined = joinedLabel(user.createdAt);
  const publicCollections = (collections ?? []).filter((c) => c.isPublic).length;

  return (
    <main className="max-w-7xl w-full mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
      {/* Left: identity */}
      <aside className="lg:w-72 lg:flex-shrink-0">
        <div className={`${GLASS} rounded-3xl p-6 flex flex-col items-center text-center lg:sticky lg:top-28`}>
          <div className="mb-4">
            <Avatar url={user.avatarUrl} size="w-24 h-24" />
          </div>
          <h1 className="text-xl font-bold text-white break-words">{displayName(user)}</h1>
          <p className="text-sm text-zinc-400 mb-6">@{user.username}</p>

          <dl className="w-full grid grid-cols-2 gap-3">
            {/* dt must precede dd; flex-col-reverse puts the number on top */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-3 flex flex-col-reverse">
              <dt className="text-xs text-zinc-500">Reviews Posted</dt>
              <dd className="text-xl font-bold text-white tabular-nums">{reviews?.length ?? "–"}</dd>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-3 flex flex-col-reverse">
              <dt className="text-xs text-zinc-500">Public Collections</dt>
              <dd className="text-xl font-bold text-white tabular-nums">{collections ? publicCollections : "–"}</dd>
            </div>
          </dl>

          {user.bio ? (
            <p className="mt-6 text-sm text-zinc-300 whitespace-pre-line break-words">{user.bio}</p>
          ) : (
            <Link href="/settings/profile" className="mt-6 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Add a bio
            </Link>
          )}

          <div className="mt-4 w-full space-y-2 text-sm text-zinc-400">
            <p className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>
                <strong className="text-white font-semibold">0</strong> Followers
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-white font-semibold">0</strong> Following
              </span>
            </p>
            {joined && (
              <p className="flex items-center justify-center gap-2">
                <CalendarDays className="w-4 h-4" aria-hidden="true" />
                {joined}
              </p>
            )}
          </div>

          {/* Socials appear once links are added in Edit Profile */}
          <div className="mt-4 flex gap-3 text-zinc-500">
            {[
              { label: "Instagram", Icon: InstagramIcon, href: user.instagramUrl },
              { label: "X", Icon: XIcon, href: user.xUrl },
              { label: "YouTube", Icon: YouTubeIcon, href: user.youtubeUrl },
            ].map(({ label, Icon, href }) =>
              href ? (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </a>
              ) : (
                <span key={label} title={`Add your ${label} in Edit Profile`} aria-label={`${label} not added`} className="opacity-50">
                  <Icon className="w-5 h-5" />
                </span>
              )
            )}
          </div>

          <Link
            href="/settings/profile"
            className="w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white text-sm font-medium py-2 rounded-xl mt-6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Edit Profile
          </Link>
        </div>
      </aside>

      {/* Center: reviews / collections */}
      <section className="flex-1 min-w-0" aria-label="Activity">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SlidingPill
            variant="tabs"
            ariaLabel="Profile sections"
            className="bg-white/[0.03] border border-white/[0.08] rounded-full p-1 backdrop-blur-xl"
            items={[
              { label: "Reviews", value: "reviews" },
              { label: "Collections", value: "collections" },
            ]}
            activeValue={tab}
            onChange={(v) => setTab(v as "reviews" | "collections")}
          />
          {tab === "reviews" && (
            <div className="flex gap-3">
              <label className="sr-only" htmlFor="verdict-filter">
                Filter by verdict
              </label>
              <select id="verdict-filter" value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value as Verdict | "ALL")} className={SELECT}>
                <option value="ALL">All Reviews</option>
                {[...VERDICT_OPTIONS].reverse().map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="type-filter">
                Filter by type
              </label>
              <select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as MediaType | "ALL")} className={SELECT}>
                <option value="ALL">All Types</option>
                {(Object.keys(TYPE_LABELS) as MediaType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {tab === "reviews" ? (
            reviews === null ? (
              [0, 1, 2].map((i) => <div key={i} className={`${GLASS} rounded-2xl h-36 animate-pulse`} />)
            ) : visibleReviews.length === 0 ? (
              <div className={`${GLASS} rounded-2xl p-10 text-center`}>
                <p className="text-white font-medium">{reviews.length ? "No reviews match these filters" : "No reviews yet"}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {reviews.length ? "Try a different verdict or type." : "Your verdicts will show up here once you post them."}
                </p>
              </div>
            ) : (
              visibleReviews.map((r) => <ProfileReviewCard key={r.id} review={r} />)
            )
          ) : (
            <>
              <FavoritesRow items={favorites} />
              <h2 className="text-lg font-bold text-white pt-4">Collections</h2>
              {collections === null ? (
            [0, 1].map((i) => <div key={i} className={`${GLASS} rounded-2xl h-24 animate-pulse`} />)
          ) : collections.length === 0 ? (
            <div className={`${GLASS} rounded-2xl p-10 text-center`}>
              <p className="text-white font-medium">No collections yet</p>
              <p className="mt-1 text-sm text-zinc-400">Collections you create from any title page show up here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {collections.map((c) => (
                <Link
                  key={c.id}
                  href="/library"
                  className={`${GLASS} rounded-2xl p-4 flex gap-4 items-center hover:border-white/[0.16] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
                >
                  <div className="flex -space-x-6 shrink-0">
                    {(c.previewPosters.length ? c.previewPosters.slice(0, 3) : [null]).map((src, i) => (
                      <div key={i} className="w-12 aspect-[2/3] rounded-md overflow-hidden bg-zinc-800 border border-white/10 shadow-lg">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Layers className="w-5 h-5 m-auto mt-5 text-zinc-600" aria-hidden="true" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{c.name}</p>
                    <p className="text-xs text-zinc-500">
                      {c.itemCount} {c.itemCount === 1 ? "title" : "titles"} · {c.isPublic ? "Public" : "Private"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      </section>

      {/* Right: interests */}
      <aside className="lg:w-64 lg:flex-shrink-0" aria-labelledby="interested-title">
        <h2 id="interested-title" className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Interested In
        </h2>
        <div className={`${GLASS} rounded-2xl p-6 text-center`}>
          <CalendarDays className="w-6 h-6 text-zinc-600 mx-auto" aria-hidden="true" />
          <p className="mt-2 text-sm text-zinc-400">No upcoming content</p>
        </div>
      </aside>
    </main>
  );
}
