process.env.EXPO_ROUTER_APP_ROOT =
  process.env.EXPO_ROUTER_APP_ROOT || "./app";

module.exports = function (api) {
  api.cache(false);
  return {
    presets: ["babel-preset-expo"],
  };
};
