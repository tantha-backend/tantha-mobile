import api from "./api";

/**
 * Thin wrappers over the Tantha API.
 *
 * Paths here mirror backend/routes exactly — several are not the obvious
 * spelling (trending is /songs/trending/all, an artist profile is
 * /artists/profile/:id), so screens should always go through this module
 * rather than calling api directly.
 *
 * Responses are unwrapped to the shape screens want, so a change in the
 * envelope is fixed here instead of in every component.
 */

export const authService = {
  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },

  register: async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return data;
  },

  me: async () => {
    const { data } = await api.get("/users/me");
    return data.user || data;
  },

  /**
   * Sends the profile as multipart so the avatar can ride along with the
   * name in one request. `photo` is a local file uri from the picker.
   */
  updateMe: async ({ name, photo }) => {
    const form = new FormData();

    if (name !== undefined) form.append("name", name);

    if (photo) {
      form.append("profileImage", {
        uri: photo.uri,
        name: photo.fileName || "avatar.jpg",
        type: photo.mimeType || "image/jpeg",
      });
    }

    const { data } = await api.put("/users/me", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return data.user || data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const { data } = await api.put("/users/me/password", {
      currentPassword,
      newPassword,
    });
    return data;
  },

  /**
   * Starts a reset. The reply is the same whether or not the address is
   * registered, so the screen must not treat success as "this email exists".
   */
  forgotPassword: async (email) => {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data;
  },

  // Returns a session on success, so a reset signs the person straight in.
  resetPassword: async (token, password) => {
    const { data } = await api.post("/auth/reset-password", { token, password });
    return data;
  },
};

export const homeService = {
  feed: async () => {
    const { data } = await api.get("/home");
    return data.home || data;
  },

  recommendations: async () => {
    const { data } = await api.get("/recommendations");
    return data.songs || [];
  },
};

export const songService = {
  all: async () => {
    const { data } = await api.get("/songs");
    return data.songs || [];
  },

  trending: async () => {
    const { data } = await api.get("/songs/trending/all");
    return data.songs || [];
  },

  /**
   * Ranked by all-time playCount. Paginated (unlike the other list methods
   * here) since this is a dedicated charts screen, not a home-page preview.
   */
  popular: async (page = 1, limit = 20) => {
    const { data } = await api.get("/songs/popular/all", {
      params: { page, limit },
    });
    return {
      songs: data.songs || [],
      page: data.page || page,
      totalPages: data.totalPages || 1,
      total: data.total || 0,
    };
  },

  search: async (query) => {
    const { data } = await api.get("/songs/search", { params: { q: query } });
    return data.songs || [];
  },

  byId: async (id) => {
    const { data } = await api.get(`/songs/${id}`);
    return data.song;
  },

  byArtist: async (artistId) => {
    const { data } = await api.get(`/songs/artist/${artistId}`);
    return data.songs || [];
  },

  /**
   * The endpoint answers with `likedSongs`, not `songs` — reading the wrong
   * key returned an empty list every time, so the Liked tab looked empty no
   * matter how many tracks had been hearted.
   */
  liked: async () => {
    const { data } = await api.get("/songs/liked/me");
    return data.likedSongs || data.songs || [];
  },

  /**
   * Records the play and returns a signed, playable URL. Called when a track
   * actually starts, not when it is merely queued.
   */
  play: async (id) => {
    const { data } = await api.put(`/songs/play/${id}`);
    return data;
  },

  like: async (id) => {
    const { data } = await api.put(`/songs/like/${id}`);
    return data;
  },
};

export const artistService = {
  all: async () => {
    const { data } = await api.get("/artists");
    return data.artists || [];
  },

  search: async (query) => {
    const { data } = await api.get("/artists/search", { params: { q: query } });
    return data.artists || [];
  },

  trending: async () => {
    const { data } = await api.get("/artists/trending");
    return data.artists || [];
  },

  /**
   * Ranked by real total streams (aggregated from their songs' playCount),
   * paginated for a dedicated charts screen.
   */
  billboard: async (page = 1, limit = 20) => {
    const { data } = await api.get("/artists/billboard", {
      params: { page, limit },
    });
    return {
      artists: data.artists || [],
      page: data.page || page,
      totalPages: data.totalPages || 1,
      total: data.total || 0,
    };
  },

  profile: async (artistId) => {
    const { data } = await api.get(`/artists/profile/${artistId}`);
    return data;
  },

  follow: async (artistId) => {
    const { data } = await api.put(`/artists/follow/${artistId}`);
    return data;
  },

  following: async () => {
    const { data } = await api.get("/artists/following/me");
    return data.followingArtists || [];
  },
};

export const albumService = {
  all: async () => {
    const { data } = await api.get("/albums");
    return data.albums || [];
  },

  byId: async (id) => {
    const { data } = await api.get(`/albums/${id}`);
    return data.album || data;
  },

  songs: async (id) => {
    const { data } = await api.get(`/albums/${id}/songs`);
    return data.songs || [];
  },
};

export const playlistService = {
  mine: async () => {
    const { data } = await api.get("/playlists/me");
    return data.playlists || [];
  },

  byId: async (id) => {
    const { data } = await api.get(`/playlists/${id}`);
    return data.playlist;
  },

  create: async (payload) => {
    const { data } = await api.post("/playlists/create", payload);
    return data.playlist;
  },

  addSong: async (playlistId, songId) => {
    const { data } = await api.put(
      `/playlists/${playlistId}/add-song/${songId}`,
    );
    return data;
  },

  removeSong: async (playlistId, songId) => {
    const { data } = await api.delete(
      `/playlists/${playlistId}/remove-song/${songId}`,
    );
    return data;
  },

  remove: async (id) => {
    const { data } = await api.delete(`/playlists/${id}`);
    return data;
  },
};

export const historyService = {
  recent: async () => {
    const { data } = await api.get("/history/recent");
    return data.recent || data.history || [];
  },

  all: async () => {
    const { data } = await api.get("/history/me");
    return data.history || data.songs || [];
  },

  /** Removes every play of one song, so the entry cannot reappear. */
  remove: async (songId) => {
    const { data } = await api.delete(`/history/${songId}`);
    return data;
  },

  clear: async () => {
    const { data } = await api.delete("/history/clear");
    return data;
  },
};

export const premiumService = {
  status: async () => {
    const { data } = await api.get("/premium/status");
    return data.user || data;
  },

  subscribe: async (plan) => {
    const { data } = await api.post("/premium/subscribe", { plan });
    return data;
  },

  verify: async (orderId) => {
    const { data } = await api.get(`/premium/verify/${orderId}`);
    return data;
  },
};

export const coffeeService = {
  support: async (artistId, payload) => {
    const { data } = await api.post(`/coffee/support/${artistId}`, payload);
    return data;
  },

  forArtist: async (artistId) => {
    const { data } = await api.get(`/coffee/artist/${artistId}`);
    return data;
  },
};

export const fanClubService = {
  subscribe: async (artistId) => {
    const { data } = await api.post(`/fanclub/subscribe/${artistId}`);
    return data;
  },

  mine: async () => {
    const { data } = await api.get("/fanclub/my-subscriptions");
    return data.subscriptions || [];
  },

  forArtist: async (artistId) => {
    const { data } = await api.get(`/fanclub/artist/${artistId}`);
    return data;
  },
};

export const notificationService = {
  list: async () => {
    const { data } = await api.get("/notifications");
    return data.notifications || [];
  },

  unreadCount: async () => {
    const { data } = await api.get("/notifications/unread-count");
    return data.unreadCount ?? 0;
  },

  markAllRead: async () => {
    const { data } = await api.put("/notifications/read-all");
    return data;
  },
};

export const commentService = {
  forSong: async (songId) => {
    const { data } = await api.get(`/comments/song/${songId}`);
    return data.comments || [];
  },

  add: async (songId, text) => {
    const { data } = await api.post(`/comments/song/${songId}`, { text });
    return data;
  },
};
