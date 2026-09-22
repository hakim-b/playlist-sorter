import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import { getSpotifyPlaylists } from "~/lib/spotify";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getSpotifyPlaylists(session.user.id);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status: result.status,
        headers: result.retryAfter
          ? { "Retry-After": result.retryAfter }
          : undefined,
      },
    );
  }

  return NextResponse.json({ playlists: result.data });
}
