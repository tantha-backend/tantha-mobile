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
 * Where the app talks to, with production written down rather than supplied.
 *
 * ─── Why this is not left to an environment variable ─────────────────────
 *
 * Because it has now shipped wrong twice, the same way both times: every
 * screen reporting "network error" at once, because the app was asking
 * localhost — the phone itself, where nothing is listening.
 *
 * The first time, an EAS build never saw `.env`: it is gitignored, and EAS
 * respects that. The `env` block in eas.json fixed builds. The second time
 * was an over-the-air update, which does not read that block either — its
 * `--environment` flag means EAS's own stored variables, a different thing
 * with a confusingly similar name.
 *
 * There is nothing secret here. The address is in the binary either way, and
 * anyone can read it out of the app in a minute. Making it the default costs
 * nothing and removes a whole class of outage, and the variable still
 * overrides it for anyone pointing at another backend.
 *
 * The LAN fallback below is for development only, and is now reached only
 * when someone sets EXPO_PUBLIC_API_URL to an empty string.
 */
const PRODUCTION_API_URL =
  "https://tantha-music-backend-production-2816.up.railway.app/api";

const configured = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL =
  configured === undefined || configured === null || configured === ""
    ? __DEV__
      ? `http://${lanHost()}:5000/api`
      : PRODUCTION_API_URL
    : configured;

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
