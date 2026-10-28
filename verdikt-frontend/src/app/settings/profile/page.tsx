"use client";

import React, { useId, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PROFILE_PLACEHOLDER } from "@/components/profile/profileData";
import { InstagramIcon, XIcon, YouTubeIcon } from "@/components/profile/SocialIcons";
import { INPUT, PageHeader, PRIMARY_PILL, SectionTitle } from "@/components/profile/settingsUi";

const BIO_MAX = 500;

export default function EditProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const ids = useId();
  const [form, setForm] = useState({
    firstName: PROFILE_PLACEHOLDER.firstName,
    lastName: PROFILE_PLACEHOLDER.lastName,
    bio: PROFILE_PLACEHOLDER.bio,
    instagram: PROFILE_PLACEHOLDER.instagram,
    x: PROFILE_PLACEHOLDER.x,
    youtube: PROFILE_PLACEHOLDER.youtube,
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // shortcut: no profile endpoint exists yet, so nothing is saved; wire this to the API when it lands
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Profile changes aren't saved yet", { tone: "error", detail: "Profile editing is coming soon." });
  };

  if (!user) return null;

  return (
    <form onSubmit={save}>
      <PageHeader title="Edit Profile" />

      <div className="p-4 border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl rounded-2xl flex items-center gap-4">
        <span className="w-16 h-16 shrink-0 rounded-full border-2 border-white/10 bg-zinc-800 overflow-hidden flex items-center justify-center">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-7 h-7 text-zinc-500" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="text-white font-medium">Profile Photo</p>
          <button
            type="button"
            onClick={() => showToast("Photo uploads aren't available yet", { tone: "error", detail: "Your avatar is generated from your username for now." })}
            className="text-purple-400 hover:text-purple-300 text-sm font-medium cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50"
          >
            Change Photo
          </button>
        </div>
      </div>

      <div className="mt-8">
        <SectionTitle>Basic Info</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${ids}-first`} className="block text-sm text-zinc-300 mb-1.5">
              First Name
            </label>
            <input id={`${ids}-first`} value={form.firstName} onChange={set("firstName")} maxLength={50} className={INPUT} autoComplete="given-name" />
          </div>
          <div>
            <label htmlFor={`${ids}-last`} className="block text-sm text-zinc-300 mb-1.5">
              Last Name
            </label>
            <input id={`${ids}-last`} value={form.lastName} onChange={set("lastName")} maxLength={50} className={INPUT} autoComplete="family-name" />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between mb-1.5">
          <label htmlFor={`${ids}-bio`} className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Bio
          </label>
          <span className="text-xs text-zinc-500 tabular-nums" aria-live="polite">
            {form.bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id={`${ids}-bio`}
          rows={4}
          value={form.bio}
          onChange={set("bio")}
          maxLength={BIO_MAX}
          placeholder="Tell people what you love to watch."
          className={`${INPUT} resize-none leading-relaxed`}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Social Links</SectionTitle>
        <div className="space-y-3">
          {[
            { key: "instagram" as const, label: "Instagram", Icon: InstagramIcon, placeholder: "https://instagram.com/yourname" },
            { key: "x" as const, label: "X (Twitter)", Icon: XIcon, placeholder: "https://x.com/yourname" },
            { key: "youtube" as const, label: "YouTube", Icon: YouTubeIcon, placeholder: "https://youtube.com/@yourchannel" },
          ].map(({ key, label, Icon, placeholder }) => (
            <div key={key} className="relative">
              <label htmlFor={`${ids}-${key}`} className="sr-only">
                {label}
              </label>
              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
              <input
                id={`${ids}-${key}`}
                type="url"
                inputMode="url"
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                className={`${INPUT} pl-12`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className={`${PRIMARY_PILL} mt-6`}>
          Save Changes
        </button>
      </div>
    </form>
  );
}
