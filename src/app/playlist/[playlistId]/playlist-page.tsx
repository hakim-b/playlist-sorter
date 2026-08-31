"use client";

import {
  Button,
  Label,
  ListBox,
  Select,
  Skeleton,
  Spinner,
} from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth-client";
import type { PlaylistSortOrder, SpotifyPlaylist } from "~/lib/spotify";

const SORT_OPTIONS: Array<{ id: PlaylistSortOrder; label: string }> = [
  { id: "oldest", label: "Release date (oldest first)" },
  { id: "newest", label: "Release date (newest first)" },
];

function SortForm({ playlistId }: { playlistId: string }) {
  const [order, setOrder] = useState<PlaylistSortOrder>("oldest");
  const [isSorting, setIsSorting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function sortPlaylist() {
    setIsSorting(true);
    setMessage(null);
    setFailed(false);

    try {
      const res = await fetch(`/api/playlists/${playlistId}/sort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setFailed(true);
        setMessage(data.error ?? "Failed to sort playlist.");
        return;
      }

      setMessage("Playlist sorted on Spotify.");
    } catch {
      setFailed(true);
      setMessage("Failed to sort playlist.");
    } finally {
      setIsSorting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="w-70"
          value={order}
          onChange={(value) => {
            if (value === "oldest" || value === "newest") {
              setOrder(value);
            }
          }}
        >
          <Label>Sort by</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {SORT_OPTIONS.map((option) => (
                <ListBox.Item
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                >
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button isPending={isSorting} onPress={() => void sortPlaylist()}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? "Sorting..." : "Sort playlist"}
            </>
          )}
        </Button>
      </div>
      {message ? (
        <p className={`text-sm ${failed ? "text-danger" : "text-success"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export default function PlaylistPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId;
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !playlistId) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/playlists/${playlistId}`);
        const data = (await res.json()) as {
          playlist?: SpotifyPlaylist;
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) {
            setFailed(data.error ?? "Failed to load playlist.");
          }
          return;
        }
        if (!cancelled && data.playlist) {
          setPlaylist(data.playlist);
        }
      } catch {
        if (!cancelled) setFailed("Failed to load playlist.");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [playlistId, session]);

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

  if (failed) {
    return (
      <main className="flex w-full flex-1 flex-col gap-6 p-6">
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          ← Your playlists
        </Link>
        <p className="text-sm text-muted">{failed}</p>
      </main>
    );
  }

  if (!playlist) {
    return (
      <main className="flex w-full flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-4 w-28 rounded-lg" />
        <div className="flex flex-col gap-6 sm:flex-row">
          <Skeleton className="size-48 rounded-2xl sm:size-64" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-10 w-72 rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          ← Your playlists
        </Link>
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
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {playlist.image ? (
          <Image
            alt={`${playlist.name} cover`}
            className="size-48 rounded-2xl object-cover sm:size-64"
            height={640}
            src={playlist.image}
            width={640}
          />
        ) : (
          <div className="size-48 rounded-2xl bg-surface-secondary sm:size-64" />
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold">{playlist.name}</h1>
            <p className="text-sm text-muted">
              {playlist.trackCount}{" "}
              {playlist.trackCount === 1 ? "song" : "songs"}
            </p>
          </div>
          <SortForm playlistId={playlist.id} />
        </div>
      </div>
    </main>
  );
}
