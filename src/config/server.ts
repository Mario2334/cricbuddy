/**
 * Base URL of cricbuddy-api (server/ in this repo), reachable only over Sanket's tailnet.
 * Expo inlines EXPO_PUBLIC_* at build time; set EXPO_PUBLIC_CRICBUDDY_API_URL=http://localhost:8787 for a local server.
 */
export const CRICBUDDY_API_URL = (process.env.EXPO_PUBLIC_CRICBUDDY_API_URL ?? 'https://veyden.tail2874a5.ts.net:8787').replace(/\/+$/, '');
