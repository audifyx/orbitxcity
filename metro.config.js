const { getDefaultConfig } = require("expo/metro-config");

// Expo Go over ngrok hangs when launchAsset uses lazy=true (module-by-module
// fetches). Force a single eager bundle in the development manifest.
process.env.EXPO_NO_METRO_LAZY = "1";
process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
