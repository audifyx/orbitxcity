import {
  formatPnl,
  formatTokenAmount,
  formatUsd,
  type WalletSnapshot,
} from "./portfolio";

export function voiceForPortfolio(
  phase: "start" | "success" | "empty",
): string {
  if (phase === "start") {
    return "Pulling your holdings straight from Solana — same source as Wallet → Holdings.";
  }
  if (phase === "empty") {
    return "Wallet is live but mostly SOL right now. No SPL tokens with balance yet.";
  }
  return "Here's your live bag from chain.";
}

export function formatPortfolioSummary(
  wallet: string,
  snapshot: WalletSnapshot,
): string {
  const lines: string[] = [];
  const short = `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
  lines.push(`Your OrbitX wallet ${short}:`);
  lines.push(
    `• Total ${formatUsd(snapshot.totalUsd)} · SOL ${formatTokenAmount(snapshot.solBalance ?? 0)}`,
  );
  if (snapshot.pnl24h !== undefined) {
    lines.push(`• 24h ${formatPnl(snapshot.pnl24h)}`);
  }

  const tokens = snapshot.tokens.filter((token) => token.balance > 0);
  if (tokens.length === 0) {
    lines.push("No SPL tokens with balance besides SOL.");
    lines.push("Say buy <mint> when you want to add a position.");
    return lines.join("\n");
  }

  lines.push(`Top ${Math.min(tokens.length, 8)} holdings:`);
  for (const token of tokens.slice(0, 8)) {
    const usd =
      token.usdValue !== undefined ? ` · ${formatUsd(token.usdValue)}` : "";
    lines.push(`• ${token.symbol}: ${formatTokenAmount(token.balance)}${usd}`);
  }
  if (tokens.length > 8) {
    lines.push(`…and ${tokens.length - 8} more in Wallet → Holdings.`);
  }
  lines.push("Want to sell something? Say sell 50% <mint> or tap a token card.");
  return lines.join("\n");
}

export function snapshotToCardData(
  wallet: string,
  snapshot: WalletSnapshot,
): Record<string, string | number | boolean | undefined> {
  const tokens = snapshot.tokens
    .filter((token) => token.balance > 0)
    .slice(0, 12)
    .map((token) => ({
      mint: token.mint,
      symbol: token.symbol,
      balance: token.balance,
      usdValue: token.usdValue,
    }));

  return {
    address: wallet,
    portfolio: formatUsd(snapshot.totalUsd),
    pnl: formatPnl(snapshot.pnl24h),
    solBalance: snapshot.solBalance,
    tokenCount: tokens.length,
    holdingsJson: JSON.stringify(tokens),
    source: snapshot.source,
  };
}
