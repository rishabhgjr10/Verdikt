"use client";

import React, { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiErrorMessage, profileApi } from "@/lib/api";
import { PageHeader, PRIMARY_PILL } from "@/components/profile/settingsUi";

export default function SecurityPage() {
  const { user, replaceSession } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const signOutEverywhere = async () => {
    setBusy(true);
    try {
      // This device gets a fresh session back, so only the others are signed out
      replaceSession(await profileApi.signOutEverywhere());
      showToast("Signed out of all other devices");
    } catch (err) {
      showToast("Couldn't sign out other devices", { tone: "error", detail: apiErrorMessage(err, "Please try again.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Security">
        Lost a phone, or signed in on a shared computer? Sign out everywhere else. You stay signed in here.
      </PageHeader>

      <div className="p-5 border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-white font-medium">Sign out of all other devices</p>
          <p className="mt-1 text-sm text-zinc-400">Every other browser and phone will need to sign in again.</p>
        </div>
        <button type="button" onClick={signOutEverywhere} disabled={busy} className={`${PRIMARY_PILL} inline-flex items-center gap-2 shrink-0`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <LogOut className="w-4 h-4" aria-hidden="true" />}
          {busy ? "Signing out…" : "Sign out others"}
        </button>
      </div>
    </div>
  );
}
