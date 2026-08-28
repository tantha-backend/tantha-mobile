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
 * Off. The AdMob unit is not live, and shipping the slots without it means
 * blank space where an ad should be. The native SDK is removed from the
 * build too, so nothing is carried that nothing uses.
 *
 * Turning this back on needs three things together: an approved AdMob unit,
 * react-native-google-mobile-ads reinstalled with its config plugin, and a
 * rebuilt binary — it is a native module and will not appear in an OTA
 * update or in Expo Go.
 */
export const ADS_ENABLED = false;
