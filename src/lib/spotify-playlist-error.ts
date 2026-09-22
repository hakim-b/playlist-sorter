export async function spotifyPlaylistError(response: Response) {
  const body = await response.text();
  let detail = "";

  try {
    const data: unknown = JSON.parse(body);
    if (data && typeof data === "object" && "error" in data) {
      const error = data.error;
      if (typeof error === "string") {
        detail = error;
      } else if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        detail = error.message;
      }
    }
  } catch {
    // Spotify can return plain text rather than its usual JSON error body.
    if (!body.trimStart().startsWith("<")) detail = body;
  }

  detail = detail
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);
  const retryAfter = response.headers.get("Retry-After");
  let error = `Spotify could not load your playlists (HTTP ${response.status}).`;

  if (response.status === 401) {
    error =
      "Spotify authorization failed (HTTP 401). Sign out and sign in again.";
  } else if (response.status === 403) {
    error =
      "Spotify denied playlist access (HTTP 403). Check this app's Spotify dashboard access settings and playlist permissions.";
  } else if (response.status === 429) {
    error = "Spotify rate limit exceeded (HTTP 429).";
    error +=
      retryAfter && /^\d+$/.test(retryAfter)
        ? ` Wait at least ${retryAfter} seconds before trying again.`
        : " Wait before trying again.";
  }

  // Log only error details, never request headers, credentials, or account data.
  console.error("[Spotify] GET /v1/me/playlists failed", {
    status: response.status,
    message: detail || "No error details returned",
    retryAfter,
  });

  return {
    ok: false as const,
    status: response.status,
    error: detail ? `${error} Spotify says: ${detail}` : error,
    ...(retryAfter ? { retryAfter } : {}),
  };
}
