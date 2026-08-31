/**
 * Native stand-in for web-only routes and packages (e.g. @privy-io/react-auth).
 * Expo Router's require.context includes *.web.tsx files in the Android bundle;
 * those modules must not evaluate browser-only Privy code in Expo Go.
 */
function WebOnlyRoute() {
  return null;
}

module.exports = WebOnlyRoute;
module.exports.default = WebOnlyRoute;
