"use client";

import { Card, Skeleton } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth-client";
import type { SpotifyPlaylist } from "~/lib/spotify";

const PLACEHOLDER_KEYS = Array.from(
  { length: 8 },
  (_, index) => `placeholder-${index}`,
);

function PlaylistGrid() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/playlists");
        if (!res.ok) throw new Error("Failed to load playlists");
        const data = (await res.json()) as { playlists: SpotifyPlaylist[] };
        if (!cancelled) setPlaylists(data.playlists);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return <p className="text-sm text-muted">Failed to load your playlists.</p>;
  }

  if (!playlists) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PLACEHOLDER_KEYS.map((key) => (
          <div
            key={key}
            className="space-y-3 rounded-3xl bg-surface p-4 shadow-sm"
          >
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="h-3 w-3/5 rounded-lg" />
            <Skeleton className="h-3 w-2/5 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <p className="text-sm text-muted">You don&apos;t have any playlists.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {playlists.map((playlist) => (
        <Link
          key={playlist.id}
          className="block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href={`/playlist/${playlist.id}`}
        >
          <Card className="h-full gap-2 overflow-hidden transition hover:bg-surface-secondary">
            {playlist.image ? (
              <Image
                alt={`${playlist.name} cover`}
                className="pointer-events-none aspect-square w-full object-cover select-none"
                height={640}
                loading="lazy"
                src={playlist.image}
                width={640}
              />
            ) : (
              <div className="aspect-square w-full bg-surface-secondary" />
            )}
            <Card.Header className="gap-1">
              <Card.Title className="text-sm">{playlist.name}</Card.Title>
              <Card.Description className="text-xs">
                {playlist.trackCount}{" "}
                {playlist.trackCount === 1 ? "song" : "songs"}
              </Card.Description>
            </Card.Header>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) {
    return <p className="p-4">Loading...</p>;
  }

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold">Not signed in</h1>
        <Link
          href="/sign-in"
          className="rounded-full bg-[#1DB954] px-6 py-3 font-semibold text-black transition hover:bg-[#1ed760]"
        >
          Sign in with Spotify
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Your playlists</h1>
          <p className="text-sm text-muted">
            Signed in as {session.user.email}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-zinc-400 px-6 py-3 font-semibold transition hover:bg-zinc-800"
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
          }}
        >
          Sign out
        </button>
      </div>
      <PlaylistGrid />
    </main>
  );
}
