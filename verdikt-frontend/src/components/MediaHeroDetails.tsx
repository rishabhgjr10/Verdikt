"use client";

import React, { useEffect, useId, useRef, useState } from "react";

const MAX_VISIBLE_CREATORS = 3;

/** "Created by A, B, C +N more" — expands in place to the full list. */
export function CreatorsFact({ creators, ...rest }: { creators: string[] } & React.HTMLAttributes<HTMLParagraphElement>) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const hidden = creators.length - MAX_VISIBLE_CREATORS;
  const visible = expanded || hidden <= 0 ? creators : creators.slice(0, MAX_VISIBLE_CREATORS);

  return (
    <p className="text-sm leading-6" {...rest}>
      <span className="text-zinc-400">Created by </span>
      <span id={listId} className="text-zinc-200">
        {visible.join(", ")}
      </span>
      {hidden > 0 && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={listId}
            title={expanded ? undefined : creators.join(", ")}
            className="text-violet-300 hover:text-violet-200 font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            {expanded ? "Show less" : `+${hidden} more`}
          </button>
        </>
      )}
    </p>
  );
}

// Google Books returns HTML in description; strip tags before render
const stripHtml = (html: string) =>
  html
    .replace(/<\/?(br|p)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Description clamped to 4 lines, with a "Read more" toggle only when it is actually truncated. */
export function ExpandableDescription({ text, ...rest }: { text: string } & React.HTMLAttributes<HTMLDivElement>) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const textId = useId();

  // Re-measure on resize; the observer callback (not the effect body) updates state
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!expanded) setTruncated(el.scrollHeight - el.clientHeight > 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div {...rest}>
      <p
        id={textId}
        ref={ref}
        className={`text-[15px] leading-7 text-zinc-200 max-w-[62ch] ${expanded ? "" : "line-clamp-4"}`}
      >
        {stripHtml(text)}
      </p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={textId}
          className="mt-1 text-sm font-semibold text-violet-300 hover:text-violet-200 rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
