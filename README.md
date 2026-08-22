# Tantha Music — mobile

Listener app for the Tantha backend. React Native via Expo (SDK 57), JavaScript
to match the admin dashboard.

## Running it

The backend must be running first:

```bash
cd "../backend" && npm run dev
```

Then start the app:

```bash
npm start
```

Scan the QR code with Expo Go, or press `a` for an Android emulator / `i` for an
iOS simulator.

### Talking to the backend

A phone cannot reach `localhost`, so the API base URL defaults to the same LAN
host Metro is serving from — if Expo says `exp://192.168.1.3:8081`, the app
calls `http://192.168.1.3:5000/api`. The login screen prints the resolved URL in
development so a wrong host is obvious.

Phone and computer must be on the same network. To point somewhere else:

```bash
EXPO_PUBLIC_API_URL=https://api.example.com/api npm start
```

## Layout

```
app/                 screens (expo-router, file-based)
  (auth)/            login, register
  (tabs)/            home, search, library, profile
  artist/[id].js     artist profile
  album/[id].js      album tracks
  playlist/[id].js   playlist tracks
  player.js          full-screen player (modal)
  premium.js         subscription plans
components/          shared UI, SongRow, MiniPlayer
lib/
  api.js             axios instance, token storage, 401 handling
  services.js        every backend call, one place
  auth.js            session provider
  player.js          queue + playback provider
  song.js            credit lines, durations, artwork
  theme.js           colours, spacing, type
```

## How playback works

`lib/player.js` owns a single audio player for the whole app.

Media in R2 is private, so URLs are short-lived signed links. A track's URL is
fetched from `PUT /songs/play/:id` at the moment it starts — not when the queue
is built — because a link minted earlier could expire before the listener
reaches that track. That call also records the play.

Background audio and lock-screen controls are configured in `app.json`
(`expo-audio` plugin, `UIBackgroundModes: ["audio"]`) and set per track via
`setActiveForLockScreen`.

## Known gaps

- **Cashfree checkout is not wired.** `premium.js` creates the order and can
  verify it afterwards, but the payment step itself needs Cashfree's React
  Native SDK, using the `paymentSessionId` the backend returns.
- **`return_url` is a placeholder.** The backend sends Cashfree
  `https://www.google.com?order_id=...`, so after paying the user lands on
  Google. It should be a deep link back into the app —
  `tantha://premium?order_id=...` — using the `tantha` scheme already set in
  `app.json`.
- **Tab icons are text glyphs**, so the app runs without an icon dependency.
  Swap for `@expo/vector-icons` in a visual pass.
- **Not run on a device yet.** The bundle compiles and every endpoint it calls
  was verified against the running backend, but layout and audio have not been
  exercised on real hardware.
