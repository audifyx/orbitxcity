import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabaseUrl } from "./env";
import { supabase } from "./supabase";

const ORBITX_API = "https://www.orbitx.world";
const LS_VERIFIER = "orbitx_x_pkce_verifier";
const LS_STATE = "orbitx_x_pkce_state";
const LS_REDIRECT = "orbitx_x_pkce_redirect";

export type XConnectionStatus = {
  connected: boolean;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
};

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes).slice(0, length);
}

async function sha256Challenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function xCallbackUri(): string {
  return Linking.createURL("x-callback");
}

export async function fetchXConnectionStatus(
  userId: string,
): Promise<XConnectionStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "twitter_username, twitter_name, twitter_avatar, twitter_access_token",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const connected = Boolean(data?.twitter_access_token);
  return {
    connected,
    username:
      typeof data?.twitter_username === "string"
        ? data.twitter_username
        : undefined,
    displayName:
      typeof data?.twitter_name === "string" ? data.twitter_name : undefined,
    avatarUrl:
      typeof data?.twitter_avatar === "string" ? data.twitter_avatar : undefined,
  };
}

export async function startXOAuth(): Promise<XConnectionStatus> {
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = await sha256Challenge(verifier);
  const redirectUri = xCallbackUri();

  await AsyncStorage.multiSet([
    [LS_VERIFIER, verifier],
    [LS_STATE, state],
    [LS_REDIRECT, redirectUri],
  ]);

  const start = await fetch(`${ORBITX_API}/api/x/agent/oauth/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirectUri,
      codeChallenge: challenge,
      state,
    }),
  });

  const payload: unknown = await start.json().catch(() => null);
  const rec =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const authorizeUrl =
    typeof rec.authorizeUrl === "string" ? rec.authorizeUrl : "";
  if (!start.ok || !authorizeUrl) {
    throw new Error(
      typeof rec.error === "string"
        ? rec.error
        : `Could not start X login (${start.status}).`,
    );
  }

  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl,
    redirectUri,
  );
  if (result.type !== "success" || !result.url) {
    throw new Error("X connection was cancelled.");
  }

  return await completeXOAuthFromUrl(result.url);
}

export async function completeXOAuthFromUrl(url: string): Promise<XConnectionStatus> {
  const parsed = Linking.parse(url);
  const code =
    typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : "";
  const returnedState =
    typeof parsed.queryParams?.state === "string"
      ? parsed.queryParams.state
      : "";

  if (!code) {
    throw new Error("X did not return an authorization code.");
  }

  const [[, verifier], [, savedState], [, redirectUri]] =
    await AsyncStorage.multiGet([LS_VERIFIER, LS_STATE, LS_REDIRECT]);

  if (!verifier) {
    throw new Error("PKCE verifier missing — try connecting again.");
  }
  if (returnedState && savedState && returnedState !== savedState) {
    throw new Error("State mismatch — try connecting again.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Sign in before connecting X.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  let response = await fetch(`${ORBITX_API}/api/x/agent/oauth/callback`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code,
      verifier,
      redirectUri: redirectUri ?? xCallbackUri(),
    }),
  });

  if (response.status === 404 || response.status === 405) {
    response = await fetch(`${supabaseUrl}/functions/v1/x-oauth-callback`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code,
        verifier,
        redirectUri: redirectUri ?? xCallbackUri(),
      }),
    });
  }

  const body: unknown = await response.json().catch(() => null);
  const rec =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (!response.ok) {
    throw new Error(
      typeof rec.error === "string"
        ? rec.error
        : `X token exchange failed (${response.status}).`,
    );
  }

  await AsyncStorage.multiRemove([LS_VERIFIER, LS_STATE, LS_REDIRECT]);

  const username =
    typeof rec.twitter_username === "string"
      ? rec.twitter_username
      : undefined;

  return {
    connected: true,
    username,
    displayName:
      typeof rec.twitter_name === "string" ? rec.twitter_name : undefined,
    avatarUrl:
      typeof rec.twitter_avatar === "string" ? rec.twitter_avatar : undefined,
  };
}

export async function disconnectXAccount(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Sign in before disconnecting X.");
  }

  const response = await fetch(`${ORBITX_API}/api/x/agent/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const rec =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
    throw new Error(
      typeof rec.error === "string"
        ? rec.error
        : `Could not disconnect X (${response.status}).`,
    );
  }
}
