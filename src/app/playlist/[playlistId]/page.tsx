import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { getSpotifyPlaylist } from "~/lib/spotify";
import PlaylistPage from "./playlist-page";

export async function generateMetadata({
  params,
}: PageProps<"/playlist/[playlistId]">): Promise<Metadata> {
  const { playlistId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return { title: "Playlist" };
  }

  const result = await getSpotifyPlaylist(session.user.id, playlistId);
  if (!result.ok) {
    return { title: "Playlist" };
  }

  return { title: result.data.name };
}

export default function Page() {
  return <PlaylistPage />;
}
