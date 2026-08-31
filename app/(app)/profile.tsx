import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

import { ProfileView, type ProfileQuickLink } from "../../src/components";
import { useAuth } from "../../src/lib/auth";
import { walletExportUrl } from "../../src/lib/hostedAuth";
import { supabase } from "../../src/lib/supabase";
import { openExternalUrl } from "../../src/lib/walletOpen";

type ProfileRow = {
  username?: string;
  display_name?: string;
  created_at?: string;
};

const QUICK_LINKS: ProfileQuickLink[] = [
  { id: "wallet", label: "Wallet", hint: "Holdings, portfolio value, and PnL" },
  { id: "settings", label: "Settings", hint: "Model, memory, and permissions" },
  { id: "export", label: "Export wallet", hint: "Reveal your private key on ogscan.fun" },
];

function formatDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { wallet, userId } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId && !wallet) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("profiles")
        .select("username, display_name, created_at");
      if (userId) {
        query = query.eq("user_id", userId);
      } else if (wallet) {
        query = query.eq("wallet", wallet);
      }
      const { data, error: dbError } = await query.maybeSingle();
      if (dbError) {
        setError(dbError.message);
        setProfile(null);
        return;
      }
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId, wallet]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const copyAddress = useCallback(async () => {
    if (!wallet) {
      return;
    }
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.clipboard
    ) {
      try {
        await navigator.clipboard.writeText(wallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Could not copy address.");
      }
    }
  }, [wallet]);

  const onQuickLink = useCallback(
    (id: string) => {
      if (id === "wallet") {
        router.push("/wallet");
      } else if (id === "settings") {
        router.push("/settings");
      } else if (id === "export") {
        void openExternalUrl(walletExportUrl());
      }
    },
    [router],
  );

  const displayName =
    profile?.display_name ?? profile?.username ?? "OrbitX user";

  return (
    <ProfileView
      displayName={displayName}
      handle={profile?.username}
      address={wallet}
      memberSince={formatDate(profile?.created_at)}
      loading={loading}
      error={error}
      copied={copied}
      quickLinks={QUICK_LINKS}
      onCopyAddress={() => void copyAddress()}
      onOpenExplorer={
        wallet
          ? () => void openExternalUrl(`https://solscan.io/account/${wallet}`)
          : undefined
      }
      onQuickLink={onQuickLink}
    />
  );
}
