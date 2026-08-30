// src/db.ts
import { drizzle } from "drizzle-orm/neon-http";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { env } from "~/env";

config({ path: ".env" }); // or .env.local

const sql = neon(env.DATABASE_URL);
export const db = drizzle({ client: sql });