import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, CalendarDays, Clapperboard, MessageSquareQuote } from "lucide-react";
import { SITE } from "@/lib/site";
import { fetchTrendingAll, TmdbItem } from "@/lib/tmdb";
import { VERDICT_OPTIONS } from "@/components/reviews/verdicts";

export const metadata: Metadata = {
  title: `About · ${SITE.name}`,
  description: `${SITE.name} tracks what you watch across every platform, with honest verdicts from the community.`,
};

const poster = (item: TmdbItem | undefined, size = "w342") =>
  item?.poster_path ? `/tmdb-img/t/p/${size}${item.poster_path}` : null;

// Slow vertical drift for the hero poster wall; motion stops for people who ask for reduced motion
const DRIFT_CSS = `
@keyframes poster-drift { from { transform: translateY(0); } to { transform: translateY(-50%); } }
.poster-drift { animation-name: poster-drift; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform; }
@media (prefers-reduced-motion: reduce) { .poster-drift { animation: none; } }
`;

const GLASS ="bg-white/[0.05] border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl";

function Poster({ item, className = "" }: { item?: TmdbItem; className?: string }) {
  const src = poster(item);
  return (
    <div className={`aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800/80 border border-white/10 shadow-xl ${className}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={item?.title || item?.name || ""} loading="lazy" className="w-full h-full object-cover" />
      )}
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  tagline,
  body,
  flip,
  children,
}: {
  icon: React.ElementType;
  title: string;
  tagline: string;
  body: string;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
      <div className={flip ? "md:order-2" : ""}>
        <span className="inline-flex w-11 h-11 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.1] text-violet-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-3xl font-bold text-white tracking-tight">{title}</h2>
        <p className="mt-2 text-lg font-semibold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">
          {tagline}
        </p>
        <p className="mt-4 text-zinc-400 leading-relaxed max-w-md">{body}</p>
      </div>
      <div className={`${GLASS} p-6 sm:p-8 ${flip ? "md:order-1" : ""}`}>{children}</div>
    </section>
  );
}

export default async function AboutPage() {
  // Posters are decoration: an empty list still renders the page with blank tiles
  const items = (await fetchTrendingAll()).filter((i) => i.poster_path).slice(0, 24);
  const pick = (i: number) => items[i % Math.max(items.length, 1)];
  // 6 x 3 = 18 tiles: TMDB trending returns ~20, so no poster repeats in the wall
  const columns = Array.from({ length: 6 }, (_, c) => [0, 1, 2].map((r) => pick(c * 3 + r)));
  const verdicts = [...VERDICT_OPTIONS].reverse();

  return (
    <main className="w-full">
      {/* Hero: brand over a drifting poster wall that fades into the page. -mt-28/pt-28 starts the glow behind the
          navbar; starting it at the section top left a hard edge just under the navbar. */}
      <section className="relative overflow-hidden -mt-28 pt-28">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-violet-700/30 via-fuchsia-700/10 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-6 pt-10 text-center">
          <p className="text-5xl sm:text-6xl font-black tracking-tighter text-white">
            {SITE.name}
            <span className="text-violet-500">.</span>
          </p>
          <p className="mt-4 text-lg text-zinc-300 max-w-xl mx-auto">
            Every movie, series, anime, game and book you care about, with honest verdicts from people who watched them.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="relative max-w-5xl mx-auto px-6 mt-12 h-[460px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_50%,transparent)]"
        >
          <style>{DRIFT_CSS}</style>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {columns.map((col, c) => (
              <div key={c} className={c >= 3 ? "hidden sm:block" : ""}>
                {/* Each column holds its posters twice and scrolls by half its height, so the loop is seamless.
                    Spacing is per-item padding (not gap) so that half-height lands exactly on the copy. */}
                <div
                  className="poster-drift"
                  style={{
                    animationDuration: `${[46, 58, 50, 62, 54, 60][c]}s`,
                    animationDirection: c % 2 ? "reverse" : "normal",
                    animationDelay: `-${[0, 12, 6, 20, 3, 15][c]}s`,
                  }}
                >
                  {[...col, ...col].map((item, r) => (
                    <div key={r} className="pb-3 sm:pb-4">
                      <Poster item={item} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 space-y-28 mt-8">
        <Feature
          icon={Clapperboard}
          title="Track everything you watch"
          tagline="Every platform, one place."
          body="Find out where a title is streaming in India, from Netflix and Prime Video to JioHotstar, Crunchyroll, Sony LIV and Apple TV+, and keep a history of everything you finish."
        >
          <div className="relative h-64">
            <Poster item={pick(5)} className="absolute left-[8%] top-6 w-[30%] -rotate-6" />
            <Poster item={pick(9)} className="absolute left-[35%] top-0 w-[32%] z-10" />
            <Poster item={pick(13)} className="absolute right-[8%] top-8 w-[28%] rotate-6" />
            {[
              { src: "/Svg/netflix.svg", cls: "left-[4%] bottom-6", wordmark: true },
              { src: "/Svg/prime-video.webp", cls: "left-[44%] bottom-0" },
              { src: "/Svg/jiohotstar.webp", cls: "right-[6%] bottom-10" },
            ].map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={l.src}
                src={l.src}
                alt=""
                className={`absolute z-20 w-11 h-11 rounded-xl border border-white/20 shadow-xl object-contain ${l.cls} ${l.wordmark ? "bg-white p-1" : ""}`}
              />
            ))}
          </div>
        </Feature>

        <Feature
          icon={MessageSquareQuote}
          title="Share your verdict"
          tagline="Four words say it all."
          body="Skip, Timepass, Go For It or Perfection. Rate in one tap, add a review if you like, and see what the community thinks before you press play."
          flip
        >
          <div className="relative h-64 flex items-center justify-center">
            <Poster item={pick(2)} className="w-[38%]" />
            {verdicts.map((v, i) => (
              <span
                key={v.value}
                className={`absolute ${v.solid} text-xs font-bold px-3 py-1.5 rounded-full shadow-xl`}
                style={[
                  { top: "8%", left: "10%" },
                  { top: "30%", right: "6%" },
                  { bottom: "26%", left: "4%" },
                  { bottom: "6%", right: "16%" },
                ][i]}
              >
                {v.label}
              </span>
            ))}
          </div>
        </Feature>

        <Feature
          icon={CalendarDays}
          title="Find what's upcoming"
          tagline="Never miss a release."
          body="See what lands in theatres and on streaming today, this week and over the coming months, all on one timeline."
        >
          <ol className="space-y-4">
            {["Today", "This week", "Next month"].map((label, i) => (
              <li key={label} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
                <span className="w-px self-stretch bg-white/10" aria-hidden="true" />
                <div className="flex gap-3">
                  <Poster item={pick(15 + i * 2)} className="w-16" />
                  <Poster item={pick(16 + i * 2)} className="w-16" />
                </div>
              </li>
            ))}
          </ol>
        </Feature>

        <Feature
          icon={Bookmark}
          title="Save to watch later"
          tagline="Your list, your way."
          body="Keep a watch-later list for tonight and build collections for every mood, franchise or marathon you are planning."
          flip
        >
          <div className="grid grid-cols-3 gap-3">
            {[4, 7, 10, 12, 14, 17].map((n) => (
              <Poster key={n} item={pick(n)} />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="font-semibold text-white">Watch Later</span>
            <span className="text-zinc-500">6 titles</span>
          </div>
        </Feature>

        {/* Founder */}
        <section aria-labelledby="founder-title" className="flex flex-col items-center text-center">
          <h2 id="founder-title" className="text-3xl font-bold text-white tracking-tight">
            Meet the Founder
          </h2>
          <figure className="mt-8 w-full max-w-xs bg-white/[0.03] border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* Natural 3:4 portrait, never cropped; width/height reserve the space before it loads */}
            <img
              src="/Svg/photo.jpg"
              alt="Rishabh Gurjar"
              width={1013}
              height={1357}
              className="w-full h-auto rounded-xl mb-4 bg-zinc-800"
            />
            <figcaption>
              <p className="text-xl font-bold text-white">Rishabh Gurjar</p>
              <p className="text-sm text-zinc-400">Founder</p>
            </figcaption>
          </figure>
        </section>
      </div>

      {/* Closing call to action */}
      <section className="relative mt-28 bg-gradient-to-t from-purple-900/40 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <h2 className="text-3xl font-bold text-white tracking-tight max-w-md leading-tight">
            Create your account and experience {SITE.name} for yourself
          </h2>
          <Link
            href="/register"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold shadow-[0_0_32px_rgba(168,85,247,0.55),inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Join Now
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
