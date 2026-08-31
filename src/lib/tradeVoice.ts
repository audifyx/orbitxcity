import type { LimitOrder } from "./limitOrders";

const SELL_WIN = [
  "Done my friend — you just banked some nice wins. Let's go.",
  "Sold. Clean exit. That's how we play it.",
  "There we go — bag secured. Nice work.",
  "All set. You just took profit like a pro.",
];

const SELL_PLACE = [
  "Got you — placing that sell right now.",
  "On it. Selling your slice now.",
  "Copy that. I'm firing the sell.",
  "Say less — selling now.",
];

const BUY_WIN = [
  "Bought. You're in — let's see where this goes.",
  "Done. Position opened. Let's ride.",
  "Locked in. Good entry — fingers crossed.",
];

const BUY_PLACE = [
  "Got you — buying now.",
  "On it. Sniping that buy.",
  "Copy — opening the position now.",
];

const LIMIT_SET_SELL = [
  "Limit sell armed. I'll fire when your target hits — nothing moves until then.",
  "Got it — that's on the limit desk as a pending sell until price hits.",
  "Sell limit set. I'll watch the chart and pull the trigger when it's time.",
];

const LIMIT_SET_BUY = [
  "Limit buy armed. I'll scoop when your target hits — sitting on the desk until then.",
  "Got it — buy order is pending on the limit desk until mcap or price hits.",
  "Buy limit set. I'll watch for your entry and auto-sign when it's time.",
];

const CLAIM_WIN = [
  "Fees claimed — creator bag secured. That's yours.",
  "Done. Creator fees are in your wallet now.",
  "Claimed. Clean pull from the pump vault.",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}

export function voiceForMarketTrade(input: {
  side: "buy" | "sell";
  phase: "start" | "success" | "fail";
  percent?: number;
  signature?: string;
}): string {
  if (input.phase === "fail") {
    return input.side === "sell"
      ? "That sell didn't go through — check your balance and try again."
      : "Buy didn't land — might need more SOL or a smaller size.";
  }
  if (input.phase === "start") {
    if (input.side === "sell") {
      const pct =
        typeof input.percent === "number"
          ? ` ${input.percent}%`
          : "";
      return `${pick(SELL_PLACE)}${pct}`;
    }
    return pick(BUY_PLACE);
  }
  return input.side === "sell" ? pick(SELL_WIN) : pick(BUY_WIN);
}

export function voiceForLimitOrder(order: LimitOrder, phase: "create" | "fill"): string {
  if (phase === "fill") {
    if (order.side === "buy") {
      const size =
        typeof order.amountSol === "number"
          ? `${order.amountSol} SOL`
          : "your size";
      return `Target hit — bought ${size} and it's on chain. Let's go.`;
    }
    return `Target hit — sold ${order.percent ?? 100}% and it's on chain. Let's go.`;
  }
  const target =
    order.triggerType === "mcap"
      ? `mcap $${formatCompact(order.triggerValue)}`
      : `price $${order.triggerValue}`;
  if (order.side === "buy") {
    const size =
      typeof order.amountSol === "number"
        ? `${order.amountSol} SOL`
        : "a SOL slice";
    return `${pick(LIMIT_SET_BUY)} (${size} when ${target})`;
  }
  return `${pick(LIMIT_SET_SELL)} (${order.percent ?? 100}% when ${target})`;
}

export function voiceForClaimFees(phase: "start" | "success" | "fail"): string {
  if (phase === "fail") {
    return "Couldn't claim fees right now — vault might be empty or the network hiccuped.";
  }
  if (phase === "start") {
    return "On it — claiming your pump.fun creator fees with your OrbitX wallet.";
  }
  return pick(CLAIM_WIN);
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function formatSolscanLink(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}
