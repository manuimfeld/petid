import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const qrStatus = pgEnum("qr_status", [
  "available",
  "reserved",
  "activated",
  "disabled",
]);
export const petStatus = pgEnum("pet_status", ["active", "lost", "disabled"]);

// Better Auth core schema. The exported names are intentionally singular.
export const user = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: userRole("role").default("user").notNull(),
    phone: varchar("phone", { length: 32 }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`)],
);

export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const availableQrs = pgTable(
  "available_qrs",
  {
    id: varchar("id", { length: 12 }).primaryKey(),
    status: qrStatus("status").default("available").notNull(),
    batch: varchar("batch", { length: 80 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (table) => [
    index("available_qrs_status_idx").on(table.status),
    index("available_qrs_batch_idx").on(table.batch),
  ],
);

export const pets = pgTable(
  "pets",
  {
    id: varchar("id", { length: 12 })
      .primaryKey()
      .references(() => availableQrs.id, { onDelete: "restrict" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 80 }).notNull(),
    description: varchar("description", { length: 1000 }),
    imageUrl: text("image_url"),
    imageKey: text("image_key"),
    address: varchar("address", { length: 300 }).notNull(),
    province: varchar("province", { length: 80 }).notNull().default(""),
    locality: varchar("locality", { length: 120 }).notNull().default(""),
    street: varchar("street", { length: 180 }).notNull().default(""),
    streetNumber: varchar("street_number", { length: 20 }).notNull().default(""),
    googlePlaceId: varchar("google_place_id", { length: 255 }),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
    status: petStatus("status").default("active").notNull(),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("pets_owner_id_idx").on(table.ownerId)],
);

export const activationDrafts = pgTable(
  "activation_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    qrId: varchar("qr_id", { length: 12 })
      .notNull()
      .references(() => availableQrs.id, { onDelete: "cascade" }),
    temporaryTokenHash: varchar("temporary_token_hash", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    description: varchar("description", { length: 1000 }),
    address: varchar("address", { length: 300 }).notNull(),
    province: varchar("province", { length: 80 }).notNull().default(""),
    locality: varchar("locality", { length: 120 }).notNull().default(""),
    street: varchar("street", { length: 180 }).notNull().default(""),
    streetNumber: varchar("street_number", { length: 20 }).notNull().default(""),
    googlePlaceId: varchar("google_place_id", { length: 255 }),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
    imageKey: text("image_key"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activation_drafts_qr_id_idx").on(table.qrId),
    index("activation_drafts_expires_at_idx").on(table.expiresAt),
  ],
);

export const qrScans = pgTable(
  "qr_scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    qrId: varchar("qr_id", { length: 12 })
      .notNull()
      .references(() => availableQrs.id, { onDelete: "cascade" }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow().notNull(),
    userAgent: varchar("user_agent", { length: 500 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    referrer: varchar("referrer", { length: 500 }),
    country: varchar("country", { length: 2 }),
  },
  (table) => [index("qr_scans_qr_date_idx").on(table.qrId, table.scannedAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const authSchema = { user, session, account, verification };
