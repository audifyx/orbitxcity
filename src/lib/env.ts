const FALLBACK_SUPABASE_URL =
  "https://ffjipnkhcebjvttliptb.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2VianZ0dGxpcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjc5NDgsImV4cCI6MjA5MzEwMzk0OH0.aXu8bbpVVwc8KOJf1-lHqO3cz_0GZD10_TE0GlKQ1BI";

function requireEnv(
  value: string | undefined,
  name: string,
  fallback: string,
): string {
  const resolved = (value?.trim() || fallback).trim();
  if (!resolved) {
    throw new Error(
      `Missing ${name}. Set ${name} in .env or your Expo public config.`,
    );
  }
  return resolved;
}

export const supabaseUrl = requireEnv(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  "EXPO_PUBLIC_SUPABASE_URL",
  FALLBACK_SUPABASE_URL,
);

export const supabaseAnonKey = requireEnv(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  FALLBACK_SUPABASE_ANON_KEY,
);

export const solanaRpcUrl = requireEnv(
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
  "EXPO_PUBLIC_SOLANA_RPC_URL",
  "https://api.mainnet-beta.solana.com",
);

export const publicAppUrl = requireEnv(
  process.env.EXPO_PUBLIC_APP_URL,
  "EXPO_PUBLIC_APP_URL",
  "https://orbitxcity.vercel.app",
);
