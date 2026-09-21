import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import {
  type SpotifyTransferItem,
  type SpotifyTransferMode,
  transferSpotifyTracks,
} from "~/lib/spotify";

type TransferBody = {
  mode: SpotifyTransferMode;
  destinationPlaylistIds: string[];
  items: SpotifyTransferItem[];
};

export const maxDuration = 60;

function isTransferMode(value: unknown): value is SpotifyTransferMode {
  return value === "copy" || value === "move";
}

function isTransferItem(value: unknown): value is SpotifyTransferItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    Number.isInteger(item.position) &&
    (item.position as number) >= 0 &&
    typeof item.uri === "string" &&
    /^spotify:track:[^:]+$/.test(item.uri)
  );
}

function parseTransferBody(
  value: unknown,
  sourcePlaylistId: string,
): TransferBody | string {
  if (typeof value !== "object" || value === null) {
    return "Invalid JSON body";
  }

  const body = value as Record<string, unknown>;
  const destinationPlaylistIds = body.destinationPlaylistIds;
  const items = body.items;

  if (!isTransferMode(body.mode)) return "Invalid transfer mode";
  if (
    !Array.isArray(destinationPlaylistIds) ||
    destinationPlaylistIds.length === 0 ||
    destinationPlaylistIds.some(
      (id) => typeof id !== "string" || id.length === 0,
    )
  ) {
    return "Select at least one destination playlist";
  }
  if (new Set(destinationPlaylistIds).size !== destinationPlaylistIds.length) {
    return "Destination playlists must be unique";
  }
  if (destinationPlaylistIds.includes(sourcePlaylistId)) {
    return "The source playlist cannot be a destination";
  }
  if (!Array.isArray(items) || items.length === 0) {
    return "Select at least one track";
  }
  if (!items.every(isTransferItem)) return "Invalid track selection";

  const uniqueItems = new Set(
    items.map((item) => `${item.position}:${item.uri}`),
  );
  if (uniqueItems.size !== items.length) {
    return "Selected tracks must be unique";
  }

  return {
    mode: body.mode,
    destinationPlaylistIds,
    items,
  };
}

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

  const parsed = parseTransferBody(body, playlistId);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const result = await transferSpotifyTracks(
    session.user.id,
    playlistId,
    parsed.destinationPlaylistIds,
    parsed.items,
    parsed.mode,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const hasFailures = result.data.failedDestinations.length > 0;
  return NextResponse.json(
    {
      ok: !hasFailures,
      ...result.data,
    },
    { status: hasFailures ? 207 : 200 },
  );
}
