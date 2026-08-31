export function resolveCreateFields(
  kind: "launch" | "nft",
  name?: string,
  symbol?: string,
): { name: string; symbol: string } {
  const rawName = String(name ?? "").trim();
  const rawSymbol = String(symbol ?? "").trim();
  const fallbackName = kind === "launch" ? "OrbitX Coin" : "OrbitX Pass";
  const fallbackSymbol = kind === "launch" ? "ORB" : "PASS";

  const resolvedName =
    rawName.length >= 2 ? rawName : fallbackName;
  const letters = (rawSymbol.length >= 2 ? rawSymbol : resolvedName)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  return {
    name: resolvedName,
    symbol: letters.length >= 2 ? letters.slice(0, 6) : fallbackSymbol,
  };
}
