import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import {
  type PlaylistSortOrder,
  sortPlaylistByReleaseDate,
} from "~/lib/spotify";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const order =
    typeof body === "object" && body !== null && "order" in body
      ? (body as { order: unknown }).order
      : undefined;

  if (order !== "oldest" && order !== "newest") {
    return NextResponse.json({ error: "Invalid sort order" }, { status: 400 });
  }

  const result = await sortPlaylistByReleaseDate(
    session.user.id,
    playlistId,
    order satisfies PlaylistSortOrder,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, trackCount: result.data.trackCount });
}
