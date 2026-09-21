"use client";

import { Button, Card, Skeleton, Spinner } from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { authClient } from "~/lib/auth-client";
import { fetcher } from "~/lib/fetcher";
import type {
  SpotifyPlaylist,
  SpotifyTransferMode,
  SpotifyTransferTrack,
} from "~/lib/spotify";

type PlaylistItemsResponse = {
  playlistId: string;
  tracks: SpotifyTransferTrack[];
};

type PlaylistsResponse = { playlists: SpotifyPlaylist[] };

type TransferResponse = {
  ok: boolean;
  mode: SpotifyTransferMode;
  trackCount: number;
  destinationCount: number;
  sourceRemoved: boolean;
  failedDestinations: Array<{ id: string; error: string }>;
};

type TransferRequest = {
  mode: SpotifyTransferMode;
  destinationPlaylistIds: string[];
  items: Array<Pick<SpotifyTransferTrack, "position" | "uri">>;
};

class TransferError extends Error {
  failedDestinations: Array<{ id: string; error: string }>;

  constructor(
    message: string,
    failedDestinations: Array<{ id: string; error: string }>,
  ) {
    super(message);
    this.name = "TransferError";
    this.failedDestinations = failedDestinations;
  }
}

async function transferFetcher(
  url: string,
  { arg }: { arg: TransferRequest },
): Promise<TransferResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const data = (await response.json()) as TransferResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new TransferError(
      data.error ?? "The transfer could not be completed.",
      data.failedDestinations ?? [],
    );
  }

  return data;
}

function trackKey(track: Pick<SpotifyTransferTrack, "position" | "uri">) {
  return `${track.position}:${track.uri}`;
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return null;
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function TransferModeControl({
  mode,
  onChange,
}: {
  mode: SpotifyTransferMode;
  onChange: (mode: SpotifyTransferMode) => void;
}) {
  return (
    <fieldset className="inline-flex rounded-xl bg-surface-secondary p-1">
      <legend className="sr-only">Transfer mode</legend>
      {(["copy", "move"] as const).map((option) => (
        <button
          aria-pressed={mode === option}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === option
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:text-foreground"
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === "copy" ? "Copy" : "Move"}
        </button>
      ))}
    </fieldset>
  );
}

function TrackList({
  tracks,
  selected,
  onToggle,
}: {
  tracks: SpotifyTransferTrack[];
  selected: Set<string>;
  onToggle: (track: SpotifyTransferTrack) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    getItemKey: (index) => trackKey(tracks[index]),
    overscan: 8,
  });

  return (
    <div
      className="h-[min(58vh,520px)] overflow-auto rounded-2xl border border-border bg-surface-secondary"
      ref={scrollRef}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualTrack) => {
          const track = tracks[virtualTrack.index];
          const key = trackKey(track);
          const duration = formatDuration(track.durationMs);

          return (
            <label
              className="absolute inset-x-0 flex min-h-18 cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 hover:bg-surface"
              htmlFor={`track-${key}`}
              key={virtualTrack.key}
              style={{
                height: `${virtualTrack.size}px`,
                transform: `translateY(${virtualTrack.start}px)`,
              }}
            >
              <input
                checked={selected.has(key)}
                className="size-4 accent-accent"
                id={`track-${key}`}
                onChange={() => onToggle(track)}
                type="checkbox"
              />
              {track.image ? (
                <Image
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                  height={96}
                  src={track.image}
                  width={96}
                />
              ) : (
                <div className="size-12 shrink-0 rounded-lg bg-surface" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {track.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {track.artists.join(", ") || "Unknown artist"}
                </span>
              </span>
              {duration ? (
                <span className="shrink-0 text-xs text-muted">{duration}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function BulkTransferPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId;
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { mutate } = useSWRConfig();
  const [mode, setMode] = useState<SpotifyTransferMode>("copy");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destinations, setDestinations] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [failedDestinations, setFailedDestinations] = useState<string[]>([]);
  const itemsKey =
    session && playlistId
      ? `/api/playlists/${encodeURIComponent(playlistId)}/items`
      : null;
  const { data: itemsData, error: itemsError } = useSWR<PlaylistItemsResponse>(
    itemsKey,
    fetcher,
  );
  const { data: playlistsData, error: playlistsError } =
    useSWR<PlaylistsResponse>(session ? "/api/playlists" : null, fetcher);
  const transferKey = `/api/playlists/${encodeURIComponent(playlistId)}/transfer`;
  const { trigger, isMutating } = useSWRMutation(transferKey, transferFetcher);
  const tracks = itemsData?.tracks ?? [];
  const playlists = (playlistsData?.playlists ?? []).filter(
    (playlist) => playlist.id !== playlistId,
  );
  const selectedTracks = tracks.filter((track) =>
    selected.has(trackKey(track)),
  );
  const allSelected = tracks.length > 0 && selected.size === tracks.length;
  const isLoading = !itemsData || !playlistsData;
  const loadError = itemsError ?? playlistsError;

  function toggleTrack(track: SpotifyTransferTrack) {
    const key = trackKey(track);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setMessage(null);
  }

  function toggleDestination(destinationId: string) {
    setDestinations((current) => {
      const next = new Set(current);
      if (next.has(destinationId)) next.delete(destinationId);
      else next.add(destinationId);
      return next;
    });
    setMessage(null);
  }

  async function submitTransfer() {
    setMessage(null);
    setFailedDestinations([]);

    try {
      const result = await trigger({
        mode,
        destinationPlaylistIds: [...destinations],
        items: selectedTracks.map(({ position, uri }) => ({ position, uri })),
      });
      await mutate(itemsKey);
      await mutate(`/api/playlists/${encodeURIComponent(playlistId)}`);
      await mutate("/api/playlists");
      setSelected(new Set());
      setMessage(
        result.sourceRemoved
          ? `Moved ${result.trackCount} ${result.trackCount === 1 ? "track" : "tracks"}.`
          : `Copied ${result.trackCount} ${result.trackCount === 1 ? "track" : "tracks"} to ${result.destinationCount} ${result.destinationCount === 1 ? "playlist" : "playlists"}.`,
      );
    } catch (error) {
      if (error instanceof TransferError) {
        setFailedDestinations(error.failedDestinations.map(({ id }) => id));
        setMessage(error.message);
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "The transfer could not be completed.",
        );
      }
    }
  }

  if (isSessionPending) return <p className="p-6">Loading...</p>;

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold">Not signed in</h1>
        <Link
          className="rounded-full bg-[#1DB954] px-6 py-3 font-semibold text-black"
          href="/sign-in"
        >
          Sign in with Spotify
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          className="text-sm text-muted hover:text-foreground"
          href={`/playlist/${playlistId}`}
        >
          ← Back to playlist
        </Link>
        <button
          className="rounded-full border border-zinc-400 px-6 py-3 font-semibold transition hover:bg-zinc-800"
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
          }}
          type="button"
        >
          Sign out
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
          Playlist tools
        </p>
        <h1 className="text-3xl font-bold">Bulk transfer tracks</h1>
        <p className="max-w-2xl text-sm text-muted">
          Choose tracks from this playlist, then copy or move them into one or
          more destinations.
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-danger">
          {loadError instanceof Error
            ? loadError.message
            : "Failed to load transfer data."}
        </p>
      ) : isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <Skeleton className="h-[min(58vh,520px)] rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <Card>
            <Card.Header className="flex-row items-center justify-between gap-4">
              <div>
                <Card.Title>Select tracks</Card.Title>
                <Card.Description>
                  {selected.size} of {tracks.length} tracks selected
                </Card.Description>
              </div>
              <Button
                onPress={() => {
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(tracks.map((track) => trackKey(track))),
                  );
                }}
                variant="secondary"
              >
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </Card.Header>
            <Card.Content>
              {tracks.length > 0 ? (
                <TrackList
                  onToggle={toggleTrack}
                  selected={selected}
                  tracks={tracks}
                />
              ) : (
                <p className="py-12 text-center text-sm text-muted">
                  This playlist has no transferable Spotify tracks.
                </p>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Transfer options</Card.Title>
              <Card.Description>
                Select one or more destinations.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Action</span>
                <TransferModeControl mode={mode} onChange={setMode} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">
                  Destination playlists
                </span>
                <div className="max-h-64 overflow-auto rounded-xl border border-border">
                  {playlists.map((playlist) => (
                    <label
                      className={`flex cursor-pointer items-center gap-3 border-b border-border/60 p-3 last:border-b-0 hover:bg-surface-secondary ${
                        failedDestinations.includes(playlist.id)
                          ? "text-danger"
                          : ""
                      }`}
                      key={playlist.id}
                    >
                      <input
                        checked={destinations.has(playlist.id)}
                        className="size-4 accent-accent"
                        onChange={() => toggleDestination(playlist.id)}
                        type="checkbox"
                      />
                      {playlist.image ? (
                        <Image
                          alt=""
                          className="size-9 rounded-md object-cover"
                          height={72}
                          src={playlist.image}
                          width={72}
                        />
                      ) : (
                        <div className="size-9 rounded-md bg-surface-secondary" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {playlist.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-surface-secondary p-3 text-sm text-muted">
                {selected.size === 0
                  ? "Select tracks to continue."
                  : destinations.size === 0
                    ? "Select at least one destination."
                    : `${mode === "move" ? "Move" : "Copy"} ${selected.size} ${selected.size === 1 ? "track" : "tracks"} to ${destinations.size} ${destinations.size === 1 ? "playlist" : "playlists"}.`}
              </div>
              <Button
                className="w-full"
                isDisabled={
                  selected.size === 0 || destinations.size === 0 || isMutating
                }
                isPending={isMutating}
                onPress={() => void submitTransfer()}
              >
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner color="current" size="sm" /> : null}
                    {isPending
                      ? "Transferring..."
                      : mode === "move"
                        ? "Move tracks"
                        : "Copy tracks"}
                  </>
                )}
              </Button>
              {message ? (
                <p
                  className={`text-sm ${failedDestinations.length > 0 ? "text-danger" : "text-success"}`}
                >
                  {message}
                </p>
              ) : null}
            </Card.Content>
          </Card>
        </div>
      )}
    </main>
  );
}
