import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/**
 * A phone cannot reach the dev machine on "localhost", so the default is the
 * LAN address Expo is already serving from. Override with EXPO_PUBLIC_API_URL
 * when pointing at a deployed backend.
 */
const lanHost = () => {
  // e.g. "192.168.1.3:8081" — the host Metro is bundling from.
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || "";

  const host = hostUri.split(":")[0];

  return host || "localhost";
};

/**
 * The fallback is for a developer's own machine, and nothing else.
 *
 * EXPO_PUBLIC_API_URL is read from .env by a local build, which is why Android
 * has always worked. An EAS build never sees .env — it is gitignored, and EAS
 * respects that — so the first iOS build shipped with no API address at all
 * and fell through to localhost. On a phone that means the phone itself,
 * nothing is listening, and every request failed as "network error", which
 * sent us looking at Google sign-in rather than at the address.
 *
 * EAS builds get the value from the `env` block in eas.json. If a built app
 * ever reports network errors on every screen at once, check there first.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${lanHost()}:5000/api`;

const TOKEN_KEY = "tantha.token";

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Uploads must go out as multipart. Axios will not replace a Content-Type
   * that is already set, so a FormData body would be labelled as JSON and the
   * server would drop the files — the same trap the admin dashboard hit.
   */
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

/**
 * Session expiry is surfaced through this callback rather than a hard
 * navigation, so the auth provider can clear state and the router can react.
 */
let onUnauthorized = null;

export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStore.clear();
      if (onUnauthorized) onUnauthorized();
    }

    return Promise.reject(error);
  },
);

/**
 * Server errors arrive as { success: false, message }. Falls back to the
 * network-level message so a dead connection still says something useful.
 */
export const errorMessage = (error, fallback = "Something went wrong") =>
  error?.response?.data?.message || error?.message || fallback;

export default api;
