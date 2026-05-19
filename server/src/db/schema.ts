import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const experts = sqliteTable("experts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  roleKey: text("role_key").notNull(),
  bioKey: text("bio_key").notNull(),
  priceCents: integer("price_cents").notNull(),
  rating: text("rating").notNull(),
  reviewCount: integer("review_count").notNull(),
  responseHours: integer("response_hours").notNull(),
  imageUrl: text("image_url"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const briefs = sqliteTable("briefs", {
  id: text("id").primaryKey(),
  seekerId: text("seeker_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  budgetCents: integer("budget_cents").notNull(),
  tags: text("tags").notNull(),
  status: text("status").notNull().default("pending_match"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  briefId: text("brief_id").references(() => briefs.id),
  expertId: text("expert_id").references(() => experts.id),
  status: text("status").notNull(),
  amountCents: integer("amount_cents").notNull(),
  feedbackPreview: text("feedback_preview"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const syncState = sqliteTable("sync_state", {
  id: text("id").primaryKey().default("postgres"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  lastError: text("last_error"),
});

export type Expert = typeof experts.$inferSelect;
export type Brief = typeof briefs.$inferSelect;
export type Request = typeof requests.$inferSelect;
