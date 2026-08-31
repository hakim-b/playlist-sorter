import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Always call this origin. A hardcoded localhost URL caused CORS on Vercel.
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
});
