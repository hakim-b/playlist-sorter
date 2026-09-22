import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { ApiError, fetcher } from "./fetcher";
import { spotifyPlaylistError } from "./spotify-playlist-error";

afterEach(() => mock.restoreAll());

test("preserves Spotify statuses and JSON error details", async () => {
  const logger = mock.method(console, "error", () => {});

  for (const status of [400, 401, 403, 429, 500, 502, 503]) {
    const result = await spotifyPlaylistError(
      Response.json(
        { error: { status, message: "Upstream reason" } },
        { status },
      ),
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, status);
    assert.match(result.error, new RegExp(`HTTP ${status}`));
    assert.match(result.error, /Upstream reason/);
  }

  assert.equal(logger.mock.callCount(), 7);
});

test("preserves Retry-After and explains the rate-limit wait", async () => {
  mock.method(console, "error", () => {});
  const result = await spotifyPlaylistError(
    new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": "120" },
    }),
  );

  assert.equal(result.retryAfter, "120");
  assert.match(result.error, /Wait at least 120 seconds/);
  assert.match(result.error, /Too many requests/);
});

test("handles empty, HTML, malformed JSON and string error responses", async () => {
  mock.method(console, "error", () => {});

  for (const body of ["", "<html>Bad gateway</html>", "{}", "null"]) {
    const result = await spotifyPlaylistError(
      new Response(body, { status: 502 }),
    );
    assert.equal(
      result.error,
      "Spotify could not load your playlists (HTTP 502).",
    );
  }

  for (const body of ["Not allowed", '{"error":"Not allowed"}']) {
    const result = await spotifyPlaylistError(
      new Response(body, { status: 403 }),
    );
    assert.match(result.error, /Spotify says: Not allowed/);
  }
});

test("bounds and normalizes upstream error details", async () => {
  mock.method(console, "error", () => {});
  const result = await spotifyPlaylistError(
    new Response(`Reason\n${"x".repeat(1000)}`, { status: 403 }),
  );

  assert.equal(result.error.split("Spotify says: ")[1].length, 500);
  assert.doesNotMatch(result.error, /\n/);
});

test("the client fetcher preserves the actionable error and status", async () => {
  mock.method(console, "error", () => {});
  const result = await spotifyPlaylistError(
    Response.json(
      { error: { message: "Insufficient client scope" } },
      { status: 403 },
    ),
  );
  mock.method(globalThis, "fetch", async () =>
    Response.json({ error: result.error }, { status: result.status }),
  );

  await assert.rejects(fetcher("/api/playlists"), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.match(error.message, /Insufficient client scope/);
    return true;
  });
});
