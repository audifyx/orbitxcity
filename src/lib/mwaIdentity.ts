import { publicAppUrl } from "./env";

export const MWA_IDENTITY = {
  name: "OrbitX",
  uri: publicAppUrl.replace(/\/$/, ""),
  icon: "favicon.png",
} as const;

export const MWA_CHAIN = "solana:mainnet" as const;
