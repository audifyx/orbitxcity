import { Buffer } from "buffer";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";

import { solanaRpcUrl } from "./env";
import { signAndSendWithPrivy, signTransactionWithPrivy } from "./privyTx";
import { invokeFunction, supabase } from "./supabase";

export type OrbitxNft = {
  id: string;
  name: string;
  symbol: string;
  mint_address: string;
  status: string;
  current_owner: string | null;
  image_url: string | null;
  price_sol?: number;
  listing_id?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export async function listMarketplaceNfts(): Promise<OrbitxNft[]> {
  const { data, error } = await supabase
    .from("orbitx_nfts")
    .select("id, name, symbol, mint_address, status, current_owner, image_url")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    throw new Error(error.message);
  }

  const { data: listings } = await supabase
    .from("orbitx_nft_listings")
    .select("id, nft_id, price_sol, status")
    .eq("status", "active")
    .limit(80);

  const byNft = new Map<string, { id: string; price_sol: number }>();
  for (const row of listings ?? []) {
    byNft.set(String(row.nft_id), {
      id: String(row.id),
      price_sol: Number(row.price_sol),
    });
  }

  return (data ?? []).map((row) => {
    const listing = byNft.get(String(row.id));
    return {
      id: String(row.id),
      name: String(row.name ?? "Untitled"),
      symbol: String(row.symbol ?? "NFT"),
      mint_address: String(row.mint_address ?? ""),
      status: String(row.status ?? "unknown"),
      current_owner:
        typeof row.current_owner === "string" ? row.current_owner : null,
      image_url: typeof row.image_url === "string" ? row.image_url : null,
      price_sol: listing?.price_sol,
      listing_id: listing?.id,
    };
  });
}

export async function mintOrbitxNft(input: {
  wallet: string;
  name: string;
  symbol: string;
  description?: string;
}): Promise<{ mint: string; signature: string; nftId?: string }> {
  const owner = new PublicKey(input.wallet);
  const mint = Keypair.generate();
  const connection = new Connection(solanaRpcUrl, "confirmed");
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const ata = getAssociatedTokenAddressSync(mint.publicKey, owner);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, 0, owner, owner),
    createAssociatedTokenAccountInstruction(owner, ata, owner, mint.publicKey),
    createMintToInstruction(mint.publicKey, ata, owner, 1),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  tx.partialSign(mint);

  const signature = await signAndSendWithPrivy(
    Buffer.from(tx.serialize({ requireAllSignatures: false })).toString("base64"),
  );

  const { data } = await supabase
    .from("orbitx_nfts")
    .insert({
      mint_address: mint.publicKey.toBase58(),
      creator_wallet: input.wallet,
      current_owner: input.wallet,
      name: input.name.trim(),
      symbol: input.symbol.trim().toUpperCase(),
      metadata_uri: input.description ?? "",
      status: "minted",
      royalty_bps: 500,
    })
    .select("id")
    .single();

  return {
    mint: mint.publicKey.toBase58(),
    signature,
    nftId: data ? String(data.id) : undefined,
  };
}

export async function listOrbitxNft(input: {
  nftId: string;
  wallet: string;
  priceSol: number;
}): Promise<void> {
  const { error } = await supabase.from("orbitx_nft_listings").insert({
    nft_id: input.nftId,
    seller_wallet: input.wallet,
    price_sol: input.priceSol,
    status: "active",
    currency: "SOL",
  });
  if (error) {
    throw new Error(error.message);
  }
  await supabase
    .from("orbitx_nfts")
    .update({ delegate_approved: true, status: "listed" })
    .eq("id", input.nftId);
}

export async function buyOrbitxNft(input: {
  listingId: string;
  wallet: string;
}): Promise<string> {
  const built = await invokeFunction("nft-execute-sale", {
    action: "build",
    mode: "listing",
    sourceId: input.listingId,
    buyerWallet: input.wallet,
  });
  const rec = asRecord(built);
  const tx = typeof rec?.transactionBase64 === "string" ? rec.transactionBase64 : "";
  const pendingSaleId =
    typeof rec?.pendingSaleId === "string" ? rec.pendingSaleId : "";
  if (!tx || !pendingSaleId) {
    throw new Error(
      typeof rec?.error === "string"
        ? rec.error
        : "NFT sale could not be built. The listing may need marketplace approval.",
    );
  }
  const signedTransactionBase64 = await signTransactionWithPrivy(tx);
  const submitted = await invokeFunction("nft-execute-sale", {
    action: "submit",
    pendingSaleId,
    signedTransactionBase64,
  });
  const submittedRec = asRecord(submitted);
  if (typeof submittedRec?.signature === "string" && submittedRec.signature) {
    return submittedRec.signature;
  }
  if (typeof submittedRec?.error === "string") {
    throw new Error(submittedRec.error);
  }
  return signedTransactionBase64.slice(0, 16);
}
