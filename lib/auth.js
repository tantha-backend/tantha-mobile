import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { tokenStore, setUnauthorizedHandler } from "./api";
import { authService } from "./services";

const USER_KEY = "tantha.user";

const AuthContext = createContext(null);

/**
 * Holds the signed-in user and the token lifecycle.
 *
 * The token lives in SecureStore (it is a credential); the user object sits in
 * AsyncStorage so the app can render a signed-in shell on launch without
 * waiting on the network.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const [token, cached] = await Promise.all([
          tokenStore.get(),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (token && cached) setUser(JSON.parse(cached));
      } catch {
        // A corrupt cache should not block launch — treat it as signed out.
      } finally {
        setRestoring(false);
      }
    };

    restore();
  }, []);

  // A 401 from anywhere drops the session rather than leaving a dead token.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      AsyncStorage.removeItem(USER_KEY);
    });
  }, []);

  const persist = async (token, nextUser) => {
    await Promise.all([
      tokenStore.set(token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)),
    ]);

    setUser(nextUser);
  };

  const value = useMemo(
    () => ({
      user,
      restoring,
      isSignedIn: Boolean(user),

      login: async (email, password) => {
        const res = await authService.login(email, password);

        if (!res?.token || !res?.user) {
          throw new Error("Unexpected response from the server");
        }

        await persist(res.token, res.user);

        return res.user;
      },

      register: async (payload) => {
        const res = await authService.register(payload);

        // Some deployments return a token on register, others expect a login.
        if (res?.token && res?.user) {
          await persist(res.token, res.user);
          return res.user;
        }

        return null;
      },

      /**
       * Completes a reset. The server hands back a session with the new
       * password already in place, so the person lands signed in rather than
       * being sent back to the login screen to type it again.
       */
      resetPassword: async (token, password) => {
        const res = await authService.resetPassword(token, password);

        if (!res?.token || !res?.user) {
          throw new Error("Unexpected response from the server");
        }

        await persist(res.token, res.user);

        return res.user;
      },

      signOut: async () => {
        await Promise.all([tokenStore.clear(), AsyncStorage.removeItem(USER_KEY)]);
        setUser(null);
      },

      // Keeps premium status fresh after a purchase without a full re-login.
      refresh: async () => {
        try {
          const fresh = await authService.me();
          if (fresh) {
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
            setUser(fresh);
          }
          return fresh;
        } catch {
          return null;
        }
      },
    }),
    [user, restoring],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");

  return ctx;
};
