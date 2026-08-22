/**
 * Shaping helpers for song and artist records.
 *
 * The API returns artists either populated or as a bare id depending on the
 * endpoint, and stores the display name on `stageName` — reading `.name` is
 * why the admin dashboard showed "Unknown Artist" for a while.
 */

export const artistName = (artist) => {
  if (!artist || typeof artist === "string") return "";

  return artist.stageName || artist.artistName || artist.name || "";
};

export const songArtistName = (song) =>
  artistName(song?.artistId) || song?.artistName || "Unknown Artist";

export const songFeaturedNames = (song) =>
  (song?.featuredArtists || []).map(artistName).filter(Boolean);

/**
 * "Artist A" alone, or "Artist A feat. B, C" for a collaboration.
 */
export const songCredit = (song) => {
  const featured = songFeaturedNames(song);
  const main = songArtistName(song);

  return featured.length ? `${main} feat. ${featured.join(", ")}` : main;
};

/**
 * Everyone credited on a track as `{ id, name, image, isVerified }`, the main
 * artist first.
 *
 * `songCredit` renders the same people as one string for display; this is the
 * version you can link to. Anyone the API returned as a bare id is skipped —
 * without a populated record there is no name to show on the row, and a
 * nameless entry in a chooser is worse than one fewer choice.
 *
 * Deduplicated by id: a track occasionally lists its main artist among the
 * featured ones too, which would otherwise offer the same person twice.
 */
export const songArtists = (song) => {
  const seen = new Set();
  const out = [];

  const add = (artist, fallbackName) => {
    const id = typeof artist === "string" ? artist : artist?._id;
    const name = artistName(artist) || fallbackName || "";

    if (!id || !name || seen.has(String(id))) return;

    seen.add(String(id));

    out.push({
      id: String(id),
      name,
      // Populated alongside the name on every endpoint that returns songs,
      // so a chooser can show who these people are rather than two identical
      // silhouettes.
      image: typeof artist === "string" ? null : artist?.profileImage || null,
      isVerified: typeof artist === "string" ? false : Boolean(artist?.isVerified),
    });
  };

  add(song?.artistId, song?.artistName);
  (song?.featuredArtists || []).forEach((artist) => add(artist));

  return out;
};

export const songArtwork = (song) =>
  song?.coverImage || song?.albumId?.coverImage || null;

/**
 * Seconds as clock time — 259 becomes "4:19".
 */
export const formatDuration = (seconds) => {
  const total = Math.floor(Number(seconds));

  if (!Number.isFinite(total) || total <= 0) return "0:00";

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (value) => String(value).padStart(2, "0");

  return hours
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
};

export const formatCount = (value) => {
  const n = Number(value || 0);

  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;

  return String(n);
};
