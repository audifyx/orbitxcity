const { getDefaultConfig } = require("expo/metro-config");

// Expo Go over ngrok hangs when launchAsset uses lazy=true (module-by-module
// fetches). Force a single eager bundle in the development manifest.
process.env.EXPO_NO_METRO_LAZY = "1";
process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
// Some deps (e.g. jose, pulled in transitively by @privy-io/expo's SDK core)
// publish a Node-only entry point that imports the built-in `crypto` module,
// which doesn't exist in the Metro/Hermes runtime. Their package.json also
// declares a "browser" export condition specifically to avoid that — Metro
// just needs to be told to honor it, otherwise it falls through to the
// Node build and bundling fails with "Unable to resolve module crypto".
config.resolver.unstable_conditionNames = ["browser", "require", "react-native"];
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
