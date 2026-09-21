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
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { authClient } from "~/lib/auth-client";
import { fetcher } from "~/lib/fetcher";
import type { PlaylistSortOrder, SpotifyPlaylist } from "~/lib/spotify";

const SORT_OPTIONS: Array<{ id: PlaylistSortOrder; label: string }> = [
  { id: "oldest", label: "Release date (oldest first)" },
  { id: "newest", label: "Release date (newest first)" },
];

type SortResponse = { ok: true; trackCount: number };

async function sortFetcher(
  url: string,
  { arg }: { arg: { order: PlaylistSortOrder } },
): Promise<SortResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const data = (await response.json()) as SortResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to sort playlist.");
  }

  return data;
}

function SortForm({ playlistId }: { playlistId: string }) {
  const [order, setOrder] = useState<PlaylistSortOrder>("oldest");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isSorted, setIsSorted] = useState(false);
  const { mutate } = useSWRConfig();
  const sortKey = `/api/playlists/${encodeURIComponent(playlistId)}/sort`;
  const playlistKey = `/api/playlists/${encodeURIComponent(playlistId)}`;
  const { trigger, isMutating } = useSWRMutation(sortKey, sortFetcher);

  async function sortPlaylist() {
    setMessage(null);
    setFailed(false);
    setIsSorted(false);

    try {
      await trigger({ order });
      await mutate(playlistKey);
      setMessage("Playlist sorted on Spotify.");
      setIsSorted(true);
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error ? error.message : "Failed to sort playlist.",
      );
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
        <Button isPending={isMutating} onPress={() => void sortPlaylist()}>
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
      {isSorted ? (
        <Link
          className="text-sm text-success underline underline-offset-4"
          href={`https://open.spotify.com/playlist/${playlistId}`}
          rel="noreferrer"
          target="_blank"
        >
          Open playlist in Spotify
        </Link>
      ) : null}
    </div>
  );
}

export default function PlaylistPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId;
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const playlistKey =
    session && playlistId
      ? `/api/playlists/${encodeURIComponent(playlistId)}`
      : null;
  const { data, error } = useSWR<{ playlist: SpotifyPlaylist }>(
    playlistKey,
    fetcher,
  );
  const playlist = data?.playlist;
  const failed = error instanceof Error ? error.message : null;

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
