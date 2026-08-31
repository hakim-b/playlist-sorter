import { and, eq } from "drizzle-orm";
import { db } from "~/db";
import { account } from "~/db/schema";
import { env } from "~/env";

export type SpotifyPlaylist = {
  id: string;
  name: string;
  image: string | null;
  trackCount: number;
};

export type PlaylistSortOrder = "oldest" | "newest";

export type SpotifyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

type SpotifyMedia = {
  type?: string;
  uri?: string;
  is_local?: boolean;
  release_date?: string;
  album?: { release_date?: string };
};

type SpotifyPlaylistEntry = {
  is_local?: boolean;
  item?: SpotifyMedia | null;
  track?: SpotifyMedia | null;
};

const YEAR_ONLY = /^\d{4}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;
const ADDABLE_URI = /^(spotify:track:|spotify:episode:)/;
const SPOTIFY_ITEM_PAGE_SIZE = 50;
const SPOTIFY_WRITE_BATCH_SIZE = 100;

type SpotifyTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

async function refreshAccessToken(acc: {
  id: string;
  refreshToken: string | null;
}): Promise<string | null> {
  if (!acc.refreshToken) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: acc.refreshToken,
    }),
  });

  if (!res.ok) return null;

  const token = (await res.json()) as SpotifyTokenResponse;
  if (!token.access_token) return null;

  await db
    .update(account)
    .set({
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(
        Date.now() + (token.expires_in ?? 3600) * 1000,
      ),
    })
    .where(eq(account.id, acc.id));

  return token.access_token;
}

async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  const [acc] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "spotify")));

  if (!acc?.accessToken) return null;

  const expiresAt = acc.accessTokenExpiresAt?.getTime() ?? 0;
  if (acc.refreshToken && expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(acc);
    if (refreshed) return refreshed;
  }

  return acc.accessToken;
}

async function spotifyRequest(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

function spotifyError(
  status: number,
  fallback: string,
): { ok: false; status: number; error: string } {
  if (status === 401) {
    return {
      ok: false,
      status,
      error: "Spotify authorization expired. Sign in again.",
    };
  }
  if (status === 403) {
    return {
      ok: false,
      status,
      error:
        "You don't have permission to change this playlist. Sign out and sign in again to grant edit access.",
    };
  }
  if (status === 404) {
    return { ok: false, status, error: "Playlist not found." };
  }
  if (status === 429) {
    return {
      ok: false,
      status,
      error: "Spotify rate limit exceeded. Try again in a moment.",
    };
  }
  return { ok: false, status, error: fallback };
}

function parseReleaseDate(date: string | undefined): number {
  if (!date) return Number.NaN;
  if (YEAR_ONLY.test(date)) return Date.parse(`${date}-01-01`);
  if (YEAR_MONTH.test(date)) return Date.parse(`${date}-01`);
  return Date.parse(date);
}

function mediaFromEntry(entry: SpotifyPlaylistEntry): SpotifyMedia | null {
  return entry.item ?? entry.track ?? null;
}

function releaseDateFromMedia(media: SpotifyMedia | null): string | undefined {
  if (!media) return undefined;
  if (media.type === "episode") return media.release_date;
  return media.album?.release_date ?? media.release_date;
}

function compareReleaseDates(
  aTime: number,
  aIndex: number,
  bTime: number,
  bIndex: number,
  order: PlaylistSortOrder,
): number {
  const aMissing = Number.isNaN(aTime);
  const bMissing = Number.isNaN(bTime);
  if (aMissing && bMissing) return aIndex - bIndex;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const diff = order === "oldest" ? aTime - bTime : bTime - aTime;
  return diff !== 0 ? diff : aIndex - bIndex;
}

async function getPlaylistEntries(
  token: string,
  playlistId: string,
): Promise<SpotifyResult<SpotifyPlaylistEntry[]>> {
  const entries: SpotifyPlaylistEntry[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=${SPOTIFY_ITEM_PAGE_SIZE}&additional_types=track,episode`;

  while (nextUrl) {
    const res = await spotifyRequest(token, nextUrl);
    if (!res.ok) {
      return spotifyError(
        res.status,
        "Failed to fetch playlist tracks from Spotify",
      );
    }

    const data = (await res.json()) as {
      items: SpotifyPlaylistEntry[];
      next: string | null;
    };
    entries.push(...data.items);
    nextUrl = data.next;
  }

  return { ok: true, data: entries };
}

async function replacePlaylistItems(
  token: string,
  playlistId: string,
  uris: string[],
): Promise<SpotifyResult<null>> {
  const encodedId = encodeURIComponent(playlistId);
  const first = uris.slice(0, SPOTIFY_WRITE_BATCH_SIZE);
  const rest = uris.slice(SPOTIFY_WRITE_BATCH_SIZE);

  const putRes = await spotifyRequest(
    token,
    `https://api.spotify.com/v1/playlists/${encodedId}/items`,
    {
      method: "PUT",
      body: JSON.stringify({ uris: first }),
    },
  );
  if (!putRes.ok) {
    return spotifyError(
      putRes.status,
      "Failed to update playlist order on Spotify",
    );
  }

  for (
    let offset = 0;
    offset < rest.length;
    offset += SPOTIFY_WRITE_BATCH_SIZE
  ) {
    const batch = rest.slice(offset, offset + SPOTIFY_WRITE_BATCH_SIZE);
    const postRes = await spotifyRequest(
      token,
      `https://api.spotify.com/v1/playlists/${encodedId}/items`,
      {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      },
    );
    if (!postRes.ok) {
      return spotifyError(
        postRes.status,
        "Failed to update playlist order on Spotify",
      );
    }
  }

  return { ok: true, data: null };
}

async function reorderPlaylistItems(
  token: string,
  playlistId: string,
  current: number[],
  target: number[],
  snapshotId: string | undefined,
): Promise<SpotifyResult<null>> {
  const encodedId = encodeURIComponent(playlistId);
  let snapshot = snapshotId;
  const order = [...current];

  for (let i = 0; i < target.length; i++) {
    const desired = target[i];
    if (order[i] === desired) continue;

    const from = order.indexOf(desired, i);
    if (from < 0) continue;

    const res = await spotifyRequest(
      token,
      `https://api.spotify.com/v1/playlists/${encodedId}/items`,
      {
        method: "PUT",
        body: JSON.stringify({
          range_start: from,
          insert_before: i,
          range_length: 1,
          ...(snapshot ? { snapshot_id: snapshot } : {}),
        }),
      },
    );
    if (!res.ok) {
      return spotifyError(res.status, "Failed to reorder playlist on Spotify");
    }

    const data = (await res.json()) as { snapshot_id?: string };
    if (data.snapshot_id) snapshot = data.snapshot_id;

    const [moved] = order.splice(from, 1);
    order.splice(i, 0, moved);
  }

  return { ok: true, data: null };
}

export async function getSpotifyPlaylists(
  userId: string,
): Promise<SpotifyPlaylist[] | null> {
  const token = await getSpotifyAccessToken(userId);
  if (!token) return null;

  const playlists: SpotifyPlaylist[] = [];
  let nextUrl: string | null =
    "https://api.spotify.com/v1/me/playlists?limit=50";

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      items: Array<{
        id: string;
        name: string;
        images: Array<{ url: string }>;
        items?: { total?: number };
        tracks?: { total?: number };
      }>;
      next: string | null;
    };

    playlists.push(
      ...data.items.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.images[0]?.url ?? null,
        trackCount: item.items?.total ?? item.tracks?.total ?? 0,
      })),
    );

    nextUrl = data.next;
  }

  return playlists;
}

export async function getSpotifyPlaylist(
  userId: string,
  playlistId: string,
): Promise<SpotifyResult<SpotifyPlaylist>> {
  const token = await getSpotifyAccessToken(userId);
  if (!token) {
    return { ok: false, status: 401, error: "Missing Spotify access token" };
  }

  const res = await spotifyRequest(
    token,
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=id,name,images,items.total,tracks.total`,
  );
  if (!res.ok) {
    return spotifyError(res.status, "Failed to fetch playlist from Spotify");
  }

  const data = (await res.json()) as {
    id: string;
    name: string;
    images?: Array<{ url: string }>;
    items?: { total?: number };
    tracks?: { total?: number };
  };

  return {
    ok: true,
    data: {
      id: data.id,
      name: data.name,
      image: data.images?.[0]?.url ?? null,
      trackCount: data.items?.total ?? data.tracks?.total ?? 0,
    },
  };
}

export async function sortPlaylistByReleaseDate(
  userId: string,
  playlistId: string,
  order: PlaylistSortOrder,
): Promise<SpotifyResult<{ trackCount: number }>> {
  const token = await getSpotifyAccessToken(userId);
  if (!token) {
    return { ok: false, status: 401, error: "Missing Spotify access token" };
  }

  const playlistRes = await spotifyRequest(
    token,
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=snapshot_id`,
  );
  if (!playlistRes.ok) {
    return spotifyError(
      playlistRes.status,
      "Failed to fetch playlist from Spotify",
    );
  }
  const playlist = (await playlistRes.json()) as { snapshot_id?: string };

  const entriesResult = await getPlaylistEntries(token, playlistId);
  if (!entriesResult.ok) {
    return {
      ok: false,
      status: entriesResult.status,
      error: entriesResult.error,
    };
  }

  const entries = entriesResult.data;
  if (entries.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "This playlist has no tracks to sort.",
    };
  }

  const ranked = entries.map((entry, index) => {
    const media = mediaFromEntry(entry);
    const uri = media?.uri;
    return {
      index,
      uri,
      time: parseReleaseDate(releaseDateFromMedia(media)),
      addable: Boolean(uri && ADDABLE_URI.test(uri)),
    };
  });

  const target = ranked.toSorted((a, b) =>
    compareReleaseDates(a.time, a.index, b.time, b.index, order),
  );

  const alreadySorted = target.every((item, i) => item.index === i);
  if (alreadySorted) {
    return { ok: true, data: { trackCount: entries.length } };
  }

  const canReplace = ranked.every((item) => item.addable);
  if (canReplace) {
    const uris = target.flatMap((item) => (item.uri ? [item.uri] : []));
    const replaced = await replacePlaylistItems(token, playlistId, uris);
    if (!replaced.ok) return replaced;
    return { ok: true, data: { trackCount: uris.length } };
  }

  const reordered = await reorderPlaylistItems(
    token,
    playlistId,
    ranked.map((item) => item.index),
    target.map((item) => item.index),
    playlist.snapshot_id,
  );
  if (!reordered.ok) return reordered;

  return { ok: true, data: { trackCount: entries.length } };
}
