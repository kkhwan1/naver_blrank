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
  documentCount: bigint("document_count", { mode: "number" }), // 네이버 검색 API에서 조회한 문서 수
  competitionRate: decimal("competition_rate", { precision: 10, scale: 2 }), // 경쟁률 = 문서수 / 월간검색량
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const measurements = pgTable("measurements", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  rankSmartblock: integer("rank_smartblock"),
  smartblockStatus: text("smartblock_status").notNull(), // 'OK', 'NOT_IN_BLOCK', 'BLOCK_MISSING', 'RANKED_BUT_HIDDEN', 'ERROR'
  smartblockConfidence: decimal("smartblock_confidence", { precision: 3, scale: 2 }),
  smartblockDetails: text("smartblock_details"),
  isVisibleInSearch: boolean("is_visible_in_search"), // Phase 1: 통합검색 실제 노출 여부
  hiddenReason: text("hidden_reason"), // Phase 1: 기술적 원인 ('display_none', 'visibility_hidden', 'opacity_zero', etc.)
  hiddenReasonCategory: text("hidden_reason_category"), // Phase 2: 사용자 친화적 카테고리 ('품질_필터', '스팸_의심', '일시적_검토', '광고_우선노출', etc.)
  hiddenReasonDetail: text("hidden_reason_detail"), // Phase 2: 사용자에게 보여줄 구체적 설명
  detectionMethod: text("detection_method"), // Phase 2: 감지 방법 ('css_check', 'computed_style', 'z_index_check', etc.)
  recoveryEstimate: text("recovery_estimate"), // Phase 2: 예상 복구 시간 ('1-2시간', '24-48시간', '알 수 없음', etc.)
  blogTabRank: integer("blog_tab_rank"),
  searchVolumeAvg: decimal("search_volume_avg", { precision: 10, scale: 2 }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  method: text("method"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"), // Tailwind blue-500
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const keywordGroups = pgTable("keyword_groups", {
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  navigationItems: jsonb("navigation_items").notNull().default(sql`'[]'::jsonb`), // Array of visible nav items
  preferences: jsonb("preferences").notNull().default(sql`'{}'::jsonb`), // Other user preferences
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "그룹 이름을 입력해주세요"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "올바른 색상 코드를 입력해주세요").optional(),
});

export const insertKeywordGroupSchema = createInsertSchema(keywordGroups).omit({
  createdAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  userId: true,
  updatedAt: true,
});

export const keywordRecommendations = pgTable("keyword_recommendations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  recommendations: jsonb("recommendations").notNull(), // { related: [...], recommended: [...] }
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const keywordAlerts = pgTable("keyword_alerts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(), // 'rank_drop', 'search_visibility_loss', 'measurement_failure'
  isEnabled: boolean("is_enabled").notNull().default(true),
  threshold: jsonb("threshold"), // { rankThreshold: 3 } for rank_drop alerts
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKeywordRecommendationSchema = createInsertSchema(keywordRecommendations).omit({
  id: true,
  analyzedAt: true,
  createdAt: true,
});

export const insertKeywordAlertSchema = createInsertSchema(keywordAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  alertType: z.enum(["rank_drop", "search_visibility_loss", "measurement_failure"]),
});

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurements.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;
export type InsertKeywordGroup = z.infer<typeof insertKeywordGroupSchema>;
export type KeywordGroup = typeof keywordGroups.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertKeywordRecommendation = z.infer<typeof insertKeywordRecommendationSchema>;
export type KeywordRecommendation = typeof keywordRecommendations.$inferSelect;
export type InsertKeywordAlert = z.infer<typeof insertKeywordAlertSchema>;
export type KeywordAlert = typeof keywordAlerts.$inferSelect;
