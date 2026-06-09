export const FRONTEND_URL = "https://www.oncemetros.com";
export const API_BASE_URL = "https://www.oncemetros.com/api";

// Same web client ID used by the deployed web app and the backend to verify Google tokens.
export const GOOGLE_WEB_CLIENT_ID =
  "636175972249-ep1bv8bifo5a0j1m9nrdtp0ljlr2pajv.apps.googleusercontent.com";

// expo-auth-session v7 removed the `useProxy` option from makeRedirectUri.
// Hardcode the Expo auth proxy URL so Google OAuth receives the whitelisted redirect URI.
export const EXPO_AUTH_REDIRECT_URI = "https://auth.expo.io/@mateomarenco/once-metros-mobile";
