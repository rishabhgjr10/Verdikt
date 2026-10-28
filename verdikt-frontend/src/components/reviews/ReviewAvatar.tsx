import React from "react";
import { User as UserIcon } from "lucide-react";

export function ReviewAvatar({ url, name, size = "md" }: { url?: string | null; name?: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  return (
    <span className={`${box} shrink-0 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name ? `${name}'s avatar` : ""} className="w-full h-full object-cover" />
      ) : (
        <UserIcon className="w-1/2 h-1/2 text-zinc-400" aria-hidden="true" />
      )}
    </span>
  );
}
