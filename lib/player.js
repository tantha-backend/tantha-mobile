import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

import { songService } from "./services";
import { songCredit, songArtwork } from "./song";
import { logPlayer } from "./playerLog";

const PlayerContext = createContext(null);

/**
 * One audio player for the whole app, with a queue.
 *
 * Playback URLs are short-lived signed links, so a track's URL is fetched at
 * the moment it starts rather than when the queue is built — a link minted
 * when the queue loaded could expire before the listener reaches that track.
 */
export const PlayerProvider = ({ children }) => {
  // No initial source: the first track is loaded through replace().
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffleState] = useState(false);

  // The running order while shuffling. Held in a ref rather than state so
  // advancing a track doesn't rebuild it and reshuffle mid-listen.
  const shuffleOrder = useRef([]);

  /** A shuffled run of every position, starting from the one playing now. */
  const buildShuffleOrder = (length, startIndex) => {
    const rest = [];
    for (let i = 0; i < length; i += 1) if (i !== startIndex) rest.push(i);

    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    return startIndex >= 0 ? [startIndex, ...rest] : rest;
  };

  const setShuffle = useCallback(
    (on) => {
      setShuffleState(on);
      if (on) shuffleOrder.current = buildShuffleOrder(queue.length, index);
    },
    [queue.length, index],
  );

  const current = index >= 0 ? queue[index] : null;

  // Guards against a slow URL fetch resolving after the user skipped on.
  const requestRef = useRef(0);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {
      // Non-fatal: playback still works, it just won't survive backgrounding.
    });
  }, []);

  /**
   * Resolves a playable URL and starts it. `/songs/play/:id` both records the
   * play and returns a fresh signed URL, so it is the only source of truth.
   */
  const loadAt = useCallback(
    async (position, list) => {
      const source = list || queue;
      const song = source[position];

      if (!song) return;

      const requestId = ++requestRef.current;

      logPlayer("loadAt: start", `${position} · ${song.title}`);

      setLoading(true);

      try {
        /**
         * Start from the URL the list already carries, and only ask the
         * server when there isn't one.
         *
         * Songs arrive with `audio320` already signed by the API on its way
         * out, so it is playable without another round trip. That matters
         * most exactly when the phone is locked: a track ending used to
         * require a request to mint a fresh URL, and on a dozing device that
         * request can hang with no timeout — so the queue stopped dead at the
         * end of a song, pressing play did nothing because the player had
         * never been given a new source, and only skipping recovered it.
         *
         * Starting playback must not depend on the network being awake.
         */
        let url = song.audio320 || null;

        if (url) {
          logPlayer("loadAt: using url from list");

          // Recording the play is not worth making anyone wait for, and if it
          // fails the listening still happened.
          songService.play(song._id).catch(() => {});
        } else {
          logPlayer("loadAt: no url in list, asking server");

          try {
            const res = await songService.play(song._id);
            url = res?.streamUrl || res?.song?.audio320 || null;
            logPlayer("loadAt: server replied", url ? "got url" : "no url");
          } catch {
            logPlayer("loadAt: server request FAILED");
            // Premium-only tracks and network trouble land here with nothing
            // to play, which the throw below reports.
          }
        }

        // A newer request started while this one was in flight.
        if (requestId !== requestRef.current) return;

        if (!url) throw new Error("This track has no playable audio");

        player.replace({ uri: url });
        logPlayer("loadAt: replace() done");

        player.play();
        logPlayer("loadAt: play() called");

        // A fresh track has not finished yet, whatever the last one did.
        finishHandled.current = false;

        /**
         * Deliberately not awaited.
         *
         * This call downloads the cover art so the lock screen can show it,
         * and on a phone that has been asleep a while that download can hang
         * for as long as the system feels like deferring it. Awaited, it kept
         * the whole load alive: `loading` never cleared, so the track had in
         * fact started while the app still showed a spinner that would never
         * resolve — which is exactly what a locked phone did at the end of
         * every song.
         *
         * The audio is already playing by this line. Artwork on the lock
         * screen is decoration, and decoration must never be able to hold up
         * the thing it decorates.
         */
        player.setActiveForLockScreen?.(
            true,
            {
              title: song.title || "Unknown track",
              artist: songCredit(song),
              albumTitle: song.albumId?.title || "Tantha Music",
              // `artworkUrl`, not `artwork` — the wrong key was silently
              // dropped, which is why the lock screen showed the title and
              // artist over a blank square instead of the cover.
              artworkUrl: songArtwork(song) || undefined,
            },
            {
              /**
               * Skip buttons rather than seek buttons, because this is music:
               * on an album, moving to the next track is what someone reaches
               * for, and jumping fifteen seconds into a song is not.
               *
               * These are the only controls the plain player exposes. Wiring
               * the lock screen's next/previous to our own queue needs
               * expo-audio's AudioPlaylist, which owns the running order
               * itself — see the note on playQueue.
               */
              showSeekForward: false,
              showSeekBackward: false,
              isLiveStream: false,
            },
          )
          // Not awaited, so this has to catch for itself. Audio is already
          // playing either way; the lock screen just stays plain.
          ?.catch?.(() => {});
      } catch (err) {
        logPlayer("loadAt: THREW", err?.message);
        throw err;
      } finally {
        logPlayer("loadAt: finished, loading cleared");
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [player, queue],
  );

  const playQueue = useCallback(
    async (songs, startIndex = 0) => {
      const list = (songs || []).filter(Boolean);

      if (!list.length) return;

      setQueue(list);
      setIndex(startIndex);

      await loadAt(startIndex, list);
    },
    [loadAt],
  );

  const playSong = useCallback(
    (song, contextList) => playQueue(contextList?.length ? contextList : [song],
      contextList?.length
        ? Math.max(contextList.findIndex((s) => s._id === song._id), 0)
        : 0),
    [playQueue],
  );

  const next = useCallback(async () => {
    logPlayer("next() called", `index ${index} of ${queue.length}`);

    if (index < 0 || !queue.length) {
      logPlayer("next(): nothing queued, stopping");
      return;
    }

    if (shuffle) {
      const order = shuffleOrder.current.length
        ? shuffleOrder.current
        : buildShuffleOrder(queue.length, index);

      const position = order.indexOf(index);
      const following = order[position + 1];

      if (following === undefined) {
        player.pause();
        return;
      }

      setIndex(following);
      await loadAt(following);
      return;
    }

    const following = index + 1;

    if (following >= queue.length) {
      // End of queue: stop rather than silently looping the last track.
      player.pause();
      return;
    }

    setIndex(following);
    await loadAt(following);
  }, [index, queue, loadAt, player, shuffle]);

  const previous = useCallback(async () => {
    if (index < 0) return;

    // Standard behaviour: restart the track unless already near its start.
    if ((status?.currentTime ?? 0) > 3) {
      player.seekTo(0);
      return;
    }

    const before = index - 1;

    if (before < 0) {
      player.seekTo(0);
      return;
    }

    setIndex(before);
    await loadAt(before);
  }, [index, status?.currentTime, loadAt, player]);

  const toggle = useCallback(() => {
    if (!current) return;

    if (status?.playing) return player.pause();

    /**
     * Calling play() on a track sitting at its own end does nothing — the
     * playhead is already past the last frame — so the button appeared stuck
     * loading forever, and only skipping recovered it. Rewind first, which is
     * what pressing play on a finished track is asking for anyway.
     */
    const at = status?.currentTime ?? 0;
    const length = status?.duration ?? 0;

    if (status?.didJustFinish || (length > 0 && at >= length - 0.25)) {
      player.seekTo(0);
    }

    player.play();
  }, [
    current,
    status?.playing,
    status?.didJustFinish,
    status?.currentTime,
    status?.duration,
    player,
  ]);

  /**
   * Advance when a track ends.
   *
   * This used to watch `status.didJustFinish` alone, and it stopped the queue
   * dead at the end of a track: the effect captured whichever `next` existed
   * the last time it ran, and `next` is rebuilt every time the index moves.
   * So the handler kept trying to advance from a position the listener had
   * already left, which did nothing — the album stopped after one song, and
   * only pressing skip (calling the live `next`) got it going again.
   *
   * Now the effect runs on every render and reads the current handler through
   * a ref, so it can never be looking at an old queue position. A flag makes
   * sure one ending advances one track, however many renders report it, and
   * loadAt clears the flag when the next track starts.
   */
  const finishHandled = useRef(false);
  const onFinish = useRef(() => {});

  onFinish.current = () => {
    if (repeat) {
      player.seekTo(0);
      player.play();
      return;
    }

    next();
  };

  useEffect(() => {
    if (!status?.didJustFinish || finishHandled.current) return;

    finishHandled.current = true;
    logPlayer("track finished → advancing");
    onFinish.current();
  });

  /**
   * Fetch a fresh URL when a track fails to play, once per track.
   *
   * The URLs carried in a list are signed and expire after an hour, so a long
   * session can reach a track whose link has gone stale. Rather than showing
   * an error for something the server can simply reissue, ask for a new one
   * and carry on. Once per track, so a genuinely unplayable file reports
   * itself instead of retrying forever.
   */
  const retriedFor = useRef(null);

  useEffect(() => {
    if (!status?.error || !current?._id) return;
    if (retriedFor.current === current._id) return;

    retriedFor.current = current._id;

    songService
      .play(current._id)
      .then((res) => {
        const fresh = res?.streamUrl || res?.song?.audio320;
        if (!fresh) return;

        player.replace({ uri: fresh });
        player.play();
      })
      .catch(() => {
        // Nothing more to try; the error already showing is the right answer.
      });
  }, [status?.error, current?._id, player]);

  /**
   * Which songs this listener has loved, shared by every screen.
   *
   * Kept here rather than in each screen because the mini player and the full
   * player show the same state and must not disagree — and because the song
   * objects in the queue carry a `likes` array that was correct only at the
   * moment the list was fetched.
   */
  const [likedIds, setLikedIds] = useState(() => new Set());

  const refreshLiked = useCallback(async () => {
    try {
      const songs = await songService.liked();
      setLikedIds(new Set(songs.map((s) => String(s._id))));
    } catch {
      // Signed out, or offline. Keep whatever is already known.
    }
  }, []);

  useEffect(() => {
    refreshLiked();
  }, [refreshLiked]);

  const isLiked = useCallback(
    (songId) => likedIds.has(String(songId)),
    [likedIds],
  );

  /** Flips a song's loved state, putting it back if the server refuses. */
  const toggleLike = useCallback(async (songId) => {
    const id = String(songId);
    let wasLiked = false;

    setLikedIds((prev) => {
      wasLiked = prev.has(id);
      const nextSet = new Set(prev);
      if (wasLiked) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });

    try {
      const res = await songService.like(id);

      setLikedIds((prev) => {
        const nextSet = new Set(prev);
        if (res?.liked) nextSet.add(id);
        else nextSet.delete(id);
        return nextSet;
      });

      return Boolean(res?.liked);
    } catch (err) {
      setLikedIds((prev) => {
        const nextSet = new Set(prev);
        if (wasLiked) nextSet.add(id);
        else nextSet.delete(id);
        return nextSet;
      });
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      current,
      queue,
      index,
      loading,
      repeat,
      setRepeat,
      shuffle,
      setShuffle,

      likedIds,
      isLiked,
      toggleLike,
      refreshLiked,

      isPlaying: Boolean(status?.playing),
      isBuffering: Boolean(status?.isBuffering),
      position: status?.currentTime ?? 0,
      duration: status?.duration ?? current?.duration ?? 0,
      error: status?.error ?? null,

      playSong,
      playQueue,
      toggle,
      next,
      previous,
      seekTo: (seconds) => player.seekTo(seconds),

      stop: () => {
        player.pause();
        player.clearLockScreenControls?.();
        setQueue([]);
        setIndex(-1);
      },
    }),
    [
      current,
      queue,
      index,
      loading,
      repeat,
      shuffle,
      setShuffle,
      status?.playing,
      status?.isBuffering,
      status?.currentTime,
      status?.duration,
      status?.error,
      playSong,
      playQueue,
      toggle,
      next,
      previous,
      player,
      likedIds,
      isLiked,
      toggleLike,
      refreshLiked,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);

  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");

  return ctx;
};
