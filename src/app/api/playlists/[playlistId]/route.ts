import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import { getSpotifyPlaylist } from "~/lib/spotify";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId } = await params;
  const result = await getSpotifyPlaylist(session.user.id, playlistId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ playlist: result.data });
}
