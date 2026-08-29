import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type ProfileRow = {
  username?: string;
  display_name?: string;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
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
      let query = supabase.from("profiles").select("username, display_name");

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

  const copyAddress = async () => {
    if (!wallet) {
      return;
    }
    try {
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(wallet);
      } else {
        setError("Copy is available on web. Long-press the address on mobile.");
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
    }
  };

  const displayName =
    profile?.display_name ?? profile?.username ?? "OrbitX user";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.kicker}>Username</Text>
        {loading ? (
          <ActivityIndicator color={colors.signal} />
        ) : (
          <Text style={styles.username}>{displayName}</Text>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>Wallet address</Text>
        {wallet ? (
          <>
            <Text style={styles.address} selectable>
              {wallet}
            </Text>
            <Pressable style={styles.copyButton} onPress={() => void copyAddress()}>
              <Text style={styles.copyButtonText}>
                {copied ? "Copied" : "Copy address"}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.muted}>No wallet connected.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    gap: 8,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
  },
  username: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
  },
  address: {
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  copyButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(126, 182, 255, 0.16)",
  },
  copyButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  errorText: {
    color: "#FF9A9A",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
