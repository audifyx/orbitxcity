const { getDefaultConfig } = require("expo/metro-config");

// Expo Go over ngrok hangs when launchAsset uses lazy=true (module-by-module
// fetches). Force a single eager bundle in the development manifest.
process.env.EXPO_NO_METRO_LAZY = "1";
process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
// Prefer browser-compatible exports in Metro for dependencies that publish
// both browser and Node entry points.
config.resolver.unstable_conditionNames = ["browser", "require", "react-native"];
module.exports = config;
