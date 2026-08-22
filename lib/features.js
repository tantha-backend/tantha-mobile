/**
 * Switches for parts of the product that are built but not being offered yet.
 *
 * Kept as flags rather than deleted code: the work exists and is wired up, it
 * simply is not part of what this release promises. Flipping one back on
 * should be a one-line change, not an archaeology exercise.
 */

/**
 * Paid membership: the upgrade card, the plans screen and the checkout.
 *
 * Off for launch — the app is going out completely free. Leaving it visible
 * would offer people an upgrade that unlocks nothing (no premium-only tracks
 * exist, and there are no ads to remove) through a checkout that currently
 * returns to google.com afterwards.
 *
 * Before switching this on: give premium something concrete to unlock, and
 * fix the payment return URL in the backend's premiumController.
 */
export const MONETISATION_ENABLED = false;

/**
 * Banner ad slots.
 *
 * On, but currently filled by a placeholder: no ad network is wired up. Real
 * banners need an AdMob account and `react-native-google-mobile-ads`, which
 * is a native module — it needs a config plugin and a rebuilt binary, and it
 * will not run under Expo Go. AdBanner is the single place that changes when
 * that arrives.
 *
 * Note this pulls against MONETISATION_ENABLED being off: the app is going
 * out free with no premium tier, so ads are the only revenue in the build and
 * there is no ad-free upgrade to sell against them.
 */
export const ADS_ENABLED = true;
