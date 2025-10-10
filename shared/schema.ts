import { sql } from "drizzle-orm";
import { pgTable, text, varchar, bigserial, bigint, boolean, timestamp, integer, decimal, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for passport
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const keywords = pgTable("keywords", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Nullable for migration
  keyword: text("keyword").notNull(),
  targetUrl: text("target_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  measurementInterval: text("measurement_interval").notNull().default("24h"), // 1h, 6h, 12h, 24h
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const measurements = pgTable("measurements", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  rankSmartblock: integer("rank_smartblock"),
  smartblockStatus: text("smartblock_status").notNull(),
  smartblockConfidence: decimal("smartblock_confidence", { precision: 3, scale: 2 }),
  smartblockDetails: text("smartblock_details"),
  blogTabRank: integer("blog_tab_rank"),
  searchVolumeAvg: decimal("search_volume_avg", { precision: 10, scale: 2 }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  method: text("method"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  keyword: z.string().min(1, "키워드를 입력해주세요"),
  targetUrl: z.string().url("올바른 URL을 입력해주세요"),
  measurementInterval: z.enum(["1h", "6h", "12h", "24h"]).default("24h"),
});

export const insertMeasurementSchema = createInsertSchema(measurements).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  username: z.string().min(3, "사용자 이름은 최소 3자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
  role: z.enum(["admin", "user"]).optional(),
});

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurements.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
