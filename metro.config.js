const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

// Expo Go over ngrok hangs when launchAsset uses lazy=true (module-by-module
// fetches). Force a single eager bundle in the development manifest.
process.env.EXPO_NO_METRO_LAZY = "1";
process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
const resolveRequest = config.resolver.resolveRequest;

const SPL_TOKEN_CJS_ENTRY = {
  "@solana/spl-token": "node_modules/@solana/spl-token/lib/cjs/index.js",
  "@solana/spl-token-group":
    "node_modules/@solana/spl-token-group/lib/cjs/index.js",
  "@solana/spl-token-metadata":
    "node_modules/@solana/spl-token-metadata/lib/cjs/index.js",
};

function fileIfExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
      ? filePath
      : null;
  } catch {
    return null;
  }
}

function resolveSplTokenRelative(originModulePath, moduleName) {
  if (
    !originModulePath.includes(`${path.sep}@solana${path.sep}spl-token`) ||
    (!moduleName.startsWith("./") && !moduleName.startsWith("../"))
  ) {
    return null;
  }

  const absolute = path.normalize(
    path.join(path.dirname(originModulePath), moduleName),
  );
  const candidates = [absolute];
  if (!path.extname(moduleName)) {
    candidates.push(
      `${absolute}.js`,
      `${absolute}.cjs`,
      path.join(absolute, "index.js"),
    );
  }
  for (const candidate of candidates) {
    const found = fileIfExists(candidate);
    if (found) {
      return found;
    }
  }
  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const cjsEntry = SPL_TOKEN_CJS_ENTRY[moduleName];
  if (cjsEntry) {
    const filePath = fileIfExists(path.resolve(__dirname, cjsEntry));
    if (filePath) {
      return { type: "sourceFile", filePath };
    }
  }

  const origin =
    typeof context.originModulePath === "string" ? context.originModulePath : "";
  const splRelative = resolveSplTokenRelative(origin, moduleName);
  if (splRelative) {
    return { type: "sourceFile", filePath: splRelative };
  }

  if (moduleName === "isows") {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }
  if (moduleName.startsWith("zustand")) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }
  if (moduleName === "jose") {
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ["browser"] },
      moduleName,
      platform,
    );
  }
  if (typeof resolveRequest === "function") {
    return resolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
const privyHostBlock = /privy-host\/.*/;
const existingBlockList = config.resolver.blockList;
if (Array.isArray(existingBlockList)) {
  config.resolver.blockList = [...existingBlockList, privyHostBlock];
} else if (existingBlockList) {
  config.resolver.blockList = [existingBlockList, privyHostBlock];
} else {
  config.resolver.blockList = privyHostBlock;
}

module.exports = config;
