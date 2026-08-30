import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import { getSpotifyPlaylists } from "~/lib/spotify";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const playlists = await getSpotifyPlaylists(session.user.id);

  if (!playlists) {
    return NextResponse.json(
      { error: "Failed to fetch playlists from Spotify" },
      { status: 502 },
    );
  }

  return NextResponse.json({ playlists });
}
