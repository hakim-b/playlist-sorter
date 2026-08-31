import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "~/db"; // your drizzle instance
import * as schema from "~/db/schema";
import { env } from "~/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: {
    allowedHosts: [
      "127.0.0.1:3000",
      "localhost:3000",
      "playlist-sorter-theta.vercel.app",
      "*.vercel.app",
    ],
    fallback: env.BETTER_AUTH_URL,
  },
  socialProviders: {
    spotify: {
      clientId: env.SPOTIFY_CLIENT_ID,
      clientSecret: env.SPOTIFY_CLIENT_SECRET,
      scope: [
        "playlist-read-private",
        "playlist-read-collaborative",
        "playlist-modify-public",
        "playlist-modify-private",
      ],
    },
  },
});
