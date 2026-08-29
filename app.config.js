const appJson = require("./app.json");

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      privyAppId: firstEnv(
        "EXPO_PUBLIC_PRIVY_APP_ID",
        "PRIVY_APP_ID",
        "NEXT_PUBLIC_PRIVY_APP_ID",
        "PRIVY_APP_KEY",
        "EXPO_PUBLIC_PRIVY_APP_KEY",
      ),
      privyClientId: firstEnv(
        "EXPO_PUBLIC_PRIVY_CLIENT_ID",
        "PRIVY_CLIENT_ID",
        "NEXT_PUBLIC_PRIVY_CLIENT_ID",
      ),
    },
  },
};
