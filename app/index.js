import { Redirect } from "expo-router";

import { Loading } from "../components/ui";
import { useAuth } from "../lib/auth";

/**
 * The app's entry route.
 *
 * Nothing answered "/" before this: the tab group starts at home.js rather
 * than index.js, and the redirect in _layout.js runs from an effect after
 * mounting. In development that redirect wins the race, but a production
 * build resolves the route first and rendered expo-router's "Unmatched
 * Route" screen instead of the app — so the APK opened to an error page
 * while Expo Go looked fine.
 *
 * Redirecting declaratively here means the decision happens during routing
 * rather than after it, in every build.
 */
const Index = () => {
  const { isSignedIn, restoring } = useAuth();

  // The session is read from storage on launch; wait rather than sending
  // someone to the login screen a frame before their session appears.
  if (restoring) return <Loading label="Starting Tantha..." />;

  return <Redirect href={isSignedIn ? "/(tabs)/home" : "/(auth)/login"} />;
};

export default Index;
