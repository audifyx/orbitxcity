// OrbitX wallet-auth — Sign-In-With-Solana + one-time legacy account merge.
//
// actions:
//  - nonce  {pubkey}                      -> { nonce, message }
//  - verify {pubkey, signature(b58), nonce?} -> { access_token, refresh_token, isNew }
//  - merge  {email, password}  (Bearer wallet session) -> { ok, result }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json",
};
const admin = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const walletEmail = (pk: string) => `${pk.toLowerCase()}@wallet.orbitx.app`;
const randPass = () => bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
const NONCE_TTL_MS = 5 * 60_000;

function buildMessage(pubkey: string, nonce: string) {
  return `OrbitX — sign in with your wallet.\n\nWallet: ${pubkey}\nNonce: ${nonce}\n\nThis request will not trigger a transaction or cost any fees.`;
}

function issueNonce(): string {
  return `${Date.now()}.${crypto.randomUUID()}`;
}

function nonceTimestamp(nonce: string): number | null {
  const stamp = nonce.split(".")[0] ?? "";
  if (!/^\d{10,16}$/.test(stamp)) {
    return null;
  }
  return Number(stamp);
}

function isFreshNonce(nonce: string): boolean {
  const stamp = nonceTimestamp(nonce);
  if (stamp === null) {
    return false;
  }
  const age = Date.now() - stamp;
  return age >= -30_000 && age <= NONCE_TTL_MS;
}

function isTransient(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : String(error);
  return /503|504|timeout|timed out|upstream|fetch|network|connection|schema cache|could not query the database|cloudflare|gateway/i.test(
    message,
  );
}

async function bestEffortStoreNonce(
  db: ReturnType<typeof admin>,
  pubkey: string,
  nonce: string,
): Promise<void> {
  try {
    await Promise.race([
      db.from("wallet_auth_nonces").upsert({
        pubkey,
        nonce,
        expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
      }),
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]);
  } catch {
    // PostgREST may be down. Verify accepts the issued nonce instead.
  }
}

async function readStoredNonce(
  db: ReturnType<typeof admin>,
  pubkey: string,
): Promise<string | null> {
  try {
    const { data, error } = await Promise.race([
      db
        .from("wallet_auth_nonces")
        .select("nonce, expires_at")
        .eq("pubkey", pubkey)
        .maybeSingle(),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "timeout" } }),
          1500,
        ),
      ),
    ]);
    if (error || !data?.nonce) {
      return null;
    }
    if (
      typeof data.expires_at === "string" &&
      new Date(data.expires_at).getTime() < Date.now()
    ) {
      return null;
    }
    return data.nonce;
  } catch {
    return null;
  }
}

async function findWalletUser(
  db: ReturnType<typeof admin>,
  pubkey: string,
): Promise<string | null> {
  const email0 = walletEmail(pubkey);
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
      },
    );
    if (response.ok) {
      const body = (await response.json()) as {
        users?: Array<{
          id?: string;
          email?: string;
          user_metadata?: { wallet?: string };
        }>;
      };
      const match = (body.users ?? []).find(
        (user) =>
          user.email === email0 || user.user_metadata?.wallet === pubkey,
      );
      if (match?.id) {
        return match.id;
      }
    }
  } catch {
    // Fall through to createUser.
  }

  try {
    const { data } = await Promise.race([
      db
        .from("wallet_identities")
        .select("user_id")
        .eq("wallet", pubkey)
        .maybeSingle(),
      new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 800),
      ),
    ]);
    if (typeof data?.user_id === "string") {
      return data.user_id;
    }
  } catch {
    // PostgREST may be down.
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, pubkey, signature, nonce, email, password } = await req.json();
    const db = admin();

    if (action === "nonce") {
      if (!pubkey) throw new Error("pubkey required");
      const issued = issueNonce();
      await bestEffortStoreNonce(db, pubkey, issued);
      return json({ nonce: issued, message: buildMessage(pubkey, issued) });
    }

    if (action === "verify") {
      if (!pubkey || !signature) throw new Error("pubkey and signature required");
      const stored = await readStoredNonce(db, pubkey);
      const provided = typeof nonce === "string" ? nonce.trim() : "";
      const usedNonce = stored ?? provided;
      if (!usedNonce) throw new Error("no nonce — request one first");
      if (!stored && !isFreshNonce(usedNonce)) {
        throw new Error("nonce expired");
      }
      const ok = nacl.sign.detached.verify(
        new TextEncoder().encode(buildMessage(pubkey, usedNonce)),
        bs58.decode(signature),
        bs58.decode(pubkey),
      );
      if (!ok) throw new Error("invalid signature");
      try {
        await Promise.race([
          db.from("wallet_auth_nonces").delete().eq("pubkey", pubkey),
          new Promise((resolve) => setTimeout(resolve, 400)),
        ]);
      } catch {
        // Optional one-time consume.
      }

      let userId = await findWalletUser(db, pubkey);
      let isNew = false;
      if (!userId) {
        const email0 = walletEmail(pubkey);
        const created = await db.auth.admin.createUser({
          email: email0,
          password: randPass(),
          email_confirm: true,
          user_metadata: { wallet: pubkey, login: "wallet" },
        });
        if (
          created.error &&
          !`${created.error.message}`.toLowerCase().includes("already")
        ) {
          throw created.error;
        }
        userId = created.data?.user?.id ?? (await findWalletUser(db, pubkey));
        if (!userId) throw new Error("could not resolve wallet user");
        try {
          await Promise.race([
            (async () => {
              await db
                .from("wallet_identities")
                .upsert({ wallet: pubkey, user_id: userId });
              await db.from("profiles").upsert(
                {
                  user_id: userId,
                  username: pubkey.slice(0, 4) + pubkey.slice(-4),
                },
                { onConflict: "user_id", ignoreDuplicates: true },
              );
            })(),
            new Promise((resolve) => setTimeout(resolve, 800)),
          ]);
        } catch {
          // Session still works from Auth. Identities can sync later.
        }
        isNew = true;
      }

      const { data: u } = await db.auth.admin.getUserById(userId);
      const loginEmail = u.user?.email ?? walletEmail(pubkey);
      const pass = randPass();
      await db.auth.admin.updateUserById(userId, { password: pass });
      const anonClient = createClient(SUPABASE_URL, ANON, {
        auth: { persistSession: false },
      });
      const { data: sess, error: sErr } = await anonClient.auth.signInWithPassword({
        email: loginEmail,
        password: pass,
      });
      if (sErr || !sess.session) {
        throw new Error(sErr?.message || "session issue failed");
      }
      return json({
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
        isNew,
      });
    }

    if (action === "merge") {
      if (!email || !password) throw new Error("email and password required");
      const authz = req.headers.get("Authorization") || "";
      const token = authz.replace(/^Bearer\s+/i, "");
      if (!token) throw new Error("wallet session required");
      const { data: me, error: meErr } = await db.auth.getUser(token);
      if (meErr || !me?.user?.id) {
        throw new Error(
          "wallet session invalid — reconnect your wallet and try again",
        );
      }
      const newId = me.user.id;
      const verifier = createClient(SUPABASE_URL, ANON, {
        auth: { persistSession: false },
      });
      const { data: legacy, error: lErr } = await verifier.auth.signInWithPassword({
        email,
        password,
      });
      if (lErr || !legacy.user) throw new Error("legacy email/password incorrect");
      const oldId = legacy.user.id;
      if (oldId === newId) return json({ ok: true, result: "already this account" });
      const { data: result, error: mErr } = await db.rpc("orbitx_merge_user_data", {
        p_old: oldId,
        p_new: newId,
      });
      if (mErr) throw mErr;
      await db.auth.admin.deleteUser(oldId).catch(() => {});
      return json({ ok: true, result });
    }

    throw new Error("unknown action");
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e && typeof e.message === "string"
          ? e.message
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return String(e);
              }
            })();
    return json({ error: msg || "wallet-auth error" }, isTransient(e) || isTransient(msg) ? 503 : 400);
  }
});
