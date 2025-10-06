import { sql } from "drizzle-orm";
import { pgTable, text, varchar, bigserial, boolean, timestamp, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const keywords = pgTable("keywords", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  keyword: text("keyword").notNull(),
  targetUrl: text("target_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const measurements = pgTable("measurements", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  keywordId: bigserial("keyword_id", { mode: "number" }).notNull().references(() => keywords.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  rankSmartblock: integer("rank_smartblock"),
  smartblockStatus: text("smartblock_status").notNull(),
  smartblockConfidence: decimal("smartblock_confidence", { precision: 3, scale: 2 }),
  blogTabRank: integer("blog_tab_rank"),
  searchVolumeAvg: decimal("search_volume_avg", { precision: 10, scale: 2 }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  keyword: z.string().min(1, "키워드를 입력해주세요"),
  targetUrl: z.string().url("올바른 URL을 입력해주세요"),
});

export const insertMeasurementSchema = createInsertSchema(measurements).omit({
  id: true,
  createdAt: true,
});

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurements.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
