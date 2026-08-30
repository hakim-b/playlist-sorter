import { pgTable, text, timestamp, varchar, boolean, foreignKey, primaryKey, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const account = pgTable("account", {
	id: text().primaryKey(),
	accountId: varchar({ length: 255 }),
	provider: varchar({ length: 255 }).notNull(),
	providerAccountId: varchar({ length: 255 }).notNull(),
	refreshToken: text(),
	accessToken: text(),
	expiresAt: timestamp(),
	tokenType: varchar({ length: 255 }),
	scope: text(),
	idToken: text(),
	sessionState: text(),
	createdAt: timestamp(),
	updatedAt: timestamp(),
	userId: text().notNull().references(() => user.id, { onDelete: "cascade" } ),
});

export const session = pgTable("session", {
	id: text().primaryKey(),
	expiresAt: timestamp(),
	token: varchar({ length: 255 }),
	createdAt: timestamp(),
	updatedAt: timestamp(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull().references(() => user.id, { onDelete: "cascade" } ),
}, (table) => [
	unique("session_token_key").on(table.token),]);

export const user = pgTable("user", {
	id: text().primaryKey(),
	email: varchar({ length: 255 }),
	emailVerified: boolean(),
	name: varchar({ length: 255 }),
	image: text(),
	createdAt: timestamp(),
	updatedAt: timestamp(),
}, (table) => [
	unique("user_email_key").on(table.email),]);

export const verification = pgTable("verification", {
	id: text().primaryKey(),
	identifier: varchar({ length: 255 }).notNull(),
	value: varchar({ length: 255 }).notNull(),
	expiresAt: timestamp().notNull(),
	createdAt: timestamp(),
	updatedAt: timestamp(),
});
