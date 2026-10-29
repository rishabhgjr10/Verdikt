"use client";

import React, { useId, useRef, useState } from "react";
import { Check, Loader2, Shuffle, Sparkles, Trash2, Upload, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiErrorMessage, profileApi } from "@/lib/api";
import { User } from "@/types/media";
import { AVATAR_STYLES, avatarUrl, isUploadedAvatar, parseAvatar, seedFrom } from "@/components/profile/profileData";
import { PhotoCropDialog } from "@/components/profile/PhotoCropDialog";
import { InstagramIcon, XIcon, YouTubeIcon } from "@/components/profile/SocialIcons";
import { INPUT, PageHeader, PRIMARY_PILL, SectionTitle } from "@/components/profile/settingsUi";

const BIO_MAX = 500;
const PHOTO_BUTTON =
  "inline-flex items-center gap-2 h-9 px-4 rounded-full border border-white/[0.1] bg-white/[0.04] text-sm font-medium text-zinc-200 hover:bg-white/[0.08] hover:border-white/[0.2] transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40";

type Form = { firstName: string; lastName: string; bio: string; instagramUrl: string; xUrl: string; youtubeUrl: string };

const formFrom = (u: User): Form => ({
  firstName: u.firstName ?? "",
  lastName: u.lastName ?? "",
  bio: u.bio ?? "",
  instagramUrl: u.instagramUrl ?? "",
  xUrl: u.xUrl ?? "",
  youtubeUrl: u.youtubeUrl ?? "",
});

const randomSeed = (username: string) => `${seedFrom(username).slice(0, 56)}-${Math.random().toString(36).slice(2, 7)}`;

export default function EditProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const ids = useId();
  // Drafts stay null until edited, so the server's copy (refreshed after sign-in) shows until the user types
  const [draft, setDraft] = useState<Form | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<{ style: string; seed: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  if (!user) return null;

  const uploaded = isUploadedAvatar(user.avatarUrl) && !avatarDraft;

  // Photos save on their own (after the crop dialog); the rest of the form still waits for Save Changes
  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("That photo is too large", { tone: "error", detail: "Pick one under 5 MB." });
      return;
    }
    setCropFile(file);
  };

  const uploadPhoto = async (photo: Blob) => {
    setPhotoBusy(true);
    try {
      setUser(await profileApi.uploadAvatar(photo));
      setAvatarDraft(null);
      setPickerOpen(false);
      setCropFile(null);
      showToast("Profile photo updated");
    } catch (err) {
      showToast("Couldn't upload your photo", { tone: "error", detail: apiErrorMessage(err, "Please try again.") });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      setUser(await profileApi.removeAvatar());
      showToast("Profile photo removed");
    } catch (err) {
      showToast("Couldn't remove your photo", { tone: "error", detail: apiErrorMessage(err, "Please try again.") });
    } finally {
      setPhotoBusy(false);
    }
  };

  const saved = formFrom(user);
  const form = draft ?? saved;
  const stored = parseAvatar(user.avatarUrl);
  const avatar = avatarDraft ?? stored;
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft({ ...form, [key]: e.target.value });

  const avatarChanged = !!avatar && (avatar.style !== stored?.style || avatar.seed !== stored?.seed);
  const dirty = avatarChanged || JSON.stringify(form) !== JSON.stringify(saved);
  const seed = avatar?.seed ?? seedFrom(user.username);
  const previewUrl = avatar ? avatarUrl(avatar.style, avatar.seed) : user.avatarUrl;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const next = await profileApi.update({
        ...form,
        ...(avatarChanged && avatar ? { avatarStyle: avatar.style, avatarSeed: avatar.seed } : {}),
      });
      setUser(next);
      setDraft(null);
      setAvatarDraft(null);
      setPickerOpen(false);
      showToast("Profile saved");
    } catch (err) {
      showToast("Couldn't save your profile", { tone: "error", detail: apiErrorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <PageHeader title="Edit Profile" />
      {cropFile && (
        <PhotoCropDialog file={cropFile} busy={photoBusy} onCancel={() => setCropFile(null)} onConfirm={uploadPhoto} />
      )}

      <div className="p-4 border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-16 h-16 shrink-0 rounded-full border-2 border-white/10 bg-zinc-800 overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-7 h-7 text-zinc-500" aria-hidden="true" />
              )}
            </span>
            <p className="text-white font-medium">Profile Photo</p>
          </div>
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} className={PHOTO_BUTTON}>
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Photo
            </button>
            <button
              type="button"
              aria-expanded={pickerOpen}
              aria-controls={`${ids}-avatars`}
              onClick={() => setPickerOpen((o) => !o)}
              className={`${PHOTO_BUTTON} ${pickerOpen ? "border-purple-500/60 bg-purple-500/15 text-white" : ""}`}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Choose Avatar
            </button>
            {uploaded && (
              <button
                type="button"
                onClick={removePhoto}
                disabled={photoBusy}
                aria-label="Remove photo"
                title="Remove photo"
                className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-white/[0.1] text-zinc-400 hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={pickPhoto} className="hidden" />
          </div>
        </div>

        {pickerOpen && (
          <div id={`${ids}-avatars`} className="mt-5 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm text-zinc-400">Pick a style. Shuffle for a new variation.</p>
              <button
                type="button"
                onClick={() => setAvatarDraft({ style: avatar?.style ?? AVATAR_STYLES[0].id, seed: randomSeed(user.username) })}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white px-3 py-1.5 rounded-full border border-white/[0.1] hover:border-white/[0.2] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
                Shuffle
              </button>
            </div>
            <div role="radiogroup" aria-label="Avatar style" className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {AVATAR_STYLES.map((s) => {
                const active = avatar?.style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setAvatarDraft({ style: s.id, seed })}
                    className={`group relative flex flex-col items-center gap-2 p-2 rounded-xl border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
                      active ? "border-purple-500 bg-purple-500/10" : "border-white/[0.08] hover:border-white/[0.2]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl(s.id, seed)} alt="" loading="lazy" className="w-14 h-14 rounded-full bg-zinc-800" />
                    <span className="text-xs text-zinc-300">{s.label}</span>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
            { key: "instagramUrl" as const, label: "Instagram", Icon: InstagramIcon, placeholder: "https://instagram.com/yourname" },
            { key: "xUrl" as const, label: "X (Twitter)", Icon: XIcon, placeholder: "https://x.com/yourname" },
            { key: "youtubeUrl" as const, label: "YouTube", Icon: YouTubeIcon, placeholder: "https://youtube.com/@yourchannel" },
          ].map(({ key, label, Icon, placeholder }) => (
            <div key={key} className="relative">
              <label htmlFor={`${ids}-${key}`} className="sr-only">
                {label}
              </label>
              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
              <input
                id={`${ids}-${key}`}
                inputMode="url"
                value={form[key]}
                onChange={set(key)}
                maxLength={255}
                placeholder={placeholder}
                className={`${INPUT} pl-12`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end items-center gap-4 mt-6">
        {dirty && !saving && <span className="text-xs text-zinc-500">Unsaved changes</span>}
        <button type="submit" disabled={!dirty || saving} className={`${PRIMARY_PILL} inline-flex items-center gap-2`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
