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
        tracks?: { total?: number };
      }>;
      next: string | null;
    };

    playlists.push(
      ...data.items.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.images[0]?.url ?? null,
        trackCount: item.tracks?.total ?? 0,
      })),
    );

    nextUrl = data.next;
  }

  return playlists;
}
