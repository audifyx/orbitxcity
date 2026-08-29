function isSafeAppReturn(value, httpsOrigins) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    if (url.username || url.password) {
      return false;
    }
    if (url.protocol === "orbitx:") {
      const path = `${url.host}${url.pathname}`.replace(/\/+$/, "");
      return path === "auth" || path === "/auth" || path.endsWith("/auth");
    }
    if (url.protocol === "exp:" || url.protocol === "exps:") {
      return url.href.includes("/auth");
    }
    if (url.protocol === "https:" || url.protocol === "http:") {
      const origin = url.origin.replace(/\/$/, "");
      const allowed = httpsOrigins.some((item) => item.replace(/\/$/, "") === origin);
      return allowed && url.pathname.replace(/\/+$/, "") === "/auth";
    }
  } catch {
    return false;
  }
  return false;
}

const origins = ["https://orbitxcity.vercel.app"];

const cases = [
  ["orbitx://auth", true],
  ["orbitx:///auth", true],
  ["orbitx://auth?wallet=phantom", true],
  ["exp://u.expo.dev/--/auth", true],
  ["https://orbitxcity.vercel.app/auth", true],
  ["https://orbitxcity.vercel.app/auth?wallet=jupiter", true],
  ["https://evil.example/auth", false],
  ["https://orbitxcity.vercel.app/connect", false],
  ["javascript:alert(1)", false],
  ["orbitx://wallet", false],
];

for (const [value, expected] of cases) {
  const actual = isSafeAppReturn(value, origins);
  if (actual !== expected) {
    throw new Error(`isSafeAppReturn(${value}) === ${actual}, expected ${expected}`);
  }
}

console.log("hosted-auth checks passed");
