import { 
  type User, type InsertUser, 
  type Keyword, type InsertKeyword, 
  type Measurement, type InsertMeasurement,
  type Group, type InsertGroup,
  type KeywordGroup, type InsertKeywordGroup,
  type UserSettings, type InsertUserSettings,
  keywords, measurements, users, groups, keywordGroups, userSettings 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, inArray, and } from "drizzle-orm";

export interface UserStats {
  user: User;
  keywordCount: number;
  measurementCount: number;
  lastActivityAt: Date | null;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersWithStats(): Promise<UserStats[]>;
  
  getKeywords(): Promise<Keyword[]>;
  getKeywordsByUser(userId: string): Promise<Keyword[]>;
  getKeyword(id: number): Promise<Keyword | undefined>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: number, data: Partial<InsertKeyword>): Promise<Keyword | undefined>;
  updateKeywordCompetition(id: number, documentCount: number, competitionRate: string | null): Promise<void>;
  deleteKeyword(id: number): Promise<boolean>;
  
  getMeasurements(keywordId: number, limit?: number): Promise<Measurement[]>;
  getMeasurementsByUser(userId: string, limit?: number): Promise<Measurement[]>;
  createMeasurement(measurement: InsertMeasurement): Promise<Measurement>;
  getLatestMeasurements(): Promise<Map<number, Measurement>>;
  getPreviousMeasurements(): Promise<Map<number, Measurement>>;
  
  getGroups(userId: string): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<boolean>;
  
  getKeywordsByGroup(groupId: number): Promise<Keyword[]>;
  addKeywordToGroup(keywordId: number, groupId: number): Promise<KeywordGroup>;
  removeKeywordFromGroup(keywordId: number, groupId: number): Promise<boolean>;
  getGroupsForKeyword(keywordId: number): Promise<Group[]>;
  
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private keywords: Map<number, Keyword>;
  private measurements: Map<number, Measurement>;
  private groups: Map<number, Group>;
  private keywordGroupRelations: Map<string, KeywordGroup>;
  private settings: Map<string, UserSettings>;
  private nextKeywordId: number;
  private nextMeasurementId: number;
  private nextGroupId: number;

  constructor() {
    this.users = new Map();
    this.keywords = new Map();
    this.measurements = new Map();
    this.groups = new Map();
    this.keywordGroupRelations = new Map();
    this.settings = new Map();
    this.nextKeywordId = 1;
    this.nextMeasurementId = 1;
    this.nextGroupId = 1;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role ?? "user",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getUsersWithStats(): Promise<UserStats[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.map(user => {
      const userKeywords = Array.from(this.keywords.values()).filter(k => k.userId === user.id);
      const keywordIds = userKeywords.map(k => k.id);
      const userMeasurements = Array.from(this.measurements.values())
        .filter(m => keywordIds.includes(m.keywordId))
        .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
      
      return {
        user,
        keywordCount: userKeywords.length,
        measurementCount: userMeasurements.length,
        lastActivityAt: userMeasurements[0]?.measuredAt ?? null,
      };
    });
  }

  async getKeywords(): Promise<Keyword[]> {
    return Array.from(this.keywords.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getKeywordsByUser(userId: string): Promise<Keyword[]> {
    return Array.from(this.keywords.values())
      .filter(k => k.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getKeyword(id: number): Promise<Keyword | undefined> {
    return this.keywords.get(id);
  }

  async createKeyword(insertKeyword: InsertKeyword): Promise<Keyword> {
    const id = this.nextKeywordId++;
    const now = new Date();
    const keyword: Keyword = {
      id,
      userId: insertKeyword.userId ?? null,
      keyword: insertKeyword.keyword,
      targetUrl: insertKeyword.targetUrl,
      isActive: insertKeyword.isActive ?? true,
      measurementInterval: insertKeyword.measurementInterval ?? '24h',
      documentCount: null,
      competitionRate: null,
      createdAt: now,
      updatedAt: now,
    };
    this.keywords.set(id, keyword);
    return keyword;
  }

  async updateKeyword(id: number, data: Partial<InsertKeyword>): Promise<Keyword | undefined> {
    const keyword = this.keywords.get(id);
    if (!keyword) return undefined;
    
    const updated: Keyword = {
      ...keyword,
      ...data,
      updatedAt: new Date(),
    };
    this.keywords.set(id, updated);
    return updated;
  }

  async updateKeywordCompetition(id: number, documentCount: number, competitionRate: string | null): Promise<void> {
    const keyword = this.keywords.get(id);
    if (!keyword) return;
    
    const updated: Keyword = {
      ...keyword,
      documentCount,
      competitionRate,
      updatedAt: new Date(),
    };
    this.keywords.set(id, updated);
  }

  async deleteKeyword(id: number): Promise<boolean> {
    const deleted = this.keywords.delete(id);
    if (deleted) {
      Array.from(this.measurements.values())
        .filter(m => m.keywordId === id)
        .forEach(m => this.measurements.delete(m.id));
    }
    return deleted;
  }

  async getMeasurements(keywordId: number, limit: number = 100): Promise<Measurement[]> {
    return Array.from(this.measurements.values())
      .filter(m => m.keywordId === keywordId)
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .slice(0, limit);
  }

  async getMeasurementsByUser(userId: string, limit: number = 50): Promise<Measurement[]> {
    const userKeywords = await this.getKeywordsByUser(userId);
    const keywordIds = userKeywords.map(k => k.id);
    return Array.from(this.measurements.values())
      .filter(m => keywordIds.includes(m.keywordId))
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .slice(0, limit);
  }

  async createMeasurement(insertMeasurement: InsertMeasurement): Promise<Measurement> {
    const id = this.nextMeasurementId++;
    const measurement: Measurement = {
      id,
      keywordId: Number(insertMeasurement.keywordId),
      measuredAt: insertMeasurement.measuredAt ?? new Date(),
      rankSmartblock: insertMeasurement.rankSmartblock ?? null,
      smartblockStatus: insertMeasurement.smartblockStatus,
      smartblockConfidence: insertMeasurement.smartblockConfidence ?? null,
      smartblockDetails: insertMeasurement.smartblockDetails ?? null,
      isVisibleInSearch: insertMeasurement.isVisibleInSearch ?? null,
      hiddenReason: insertMeasurement.hiddenReason ?? null,
      hiddenReasonCategory: insertMeasurement.hiddenReasonCategory ?? null,
      hiddenReasonDetail: insertMeasurement.hiddenReasonDetail ?? null,
      detectionMethod: insertMeasurement.detectionMethod ?? null,
      recoveryEstimate: insertMeasurement.recoveryEstimate ?? null,
      blogTabRank: insertMeasurement.blogTabRank ?? null,
      searchVolumeAvg: insertMeasurement.searchVolumeAvg ?? null,
      durationMs: insertMeasurement.durationMs ?? null,
      errorMessage: insertMeasurement.errorMessage ?? null,
      method: insertMeasurement.method ?? null,
      createdAt: new Date(),
    };
    this.measurements.set(id, measurement);
    return measurement;
  }

  async getLatestMeasurements(): Promise<Map<number, Measurement>> {
    const latest = new Map<number, Measurement>();
    
    Array.from(this.measurements.values())
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .forEach(measurement => {
        if (!latest.has(measurement.keywordId)) {
          latest.set(measurement.keywordId, measurement);
        }
      });
    
    return latest;
  }

  async getPreviousMeasurements(): Promise<Map<number, Measurement>> {
    const previous = new Map<number, Measurement>();
    const latest = new Map<number, Measurement>();
    
    Array.from(this.measurements.values())
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .forEach(measurement => {
        if (!latest.has(measurement.keywordId)) {
          latest.set(measurement.keywordId, measurement);
        } else if (!previous.has(measurement.keywordId)) {
          previous.set(measurement.keywordId, measurement);
        }
      });
    
    return previous;
  }

  async getGroups(userId: string): Promise<Group[]> {
    return Array.from(this.groups.values())
      .filter(g => g.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getGroup(id: number): Promise<Group | undefined> {
    return this.groups.get(id);
  }

  async createGroup(insertGroup: InsertGroup): Promise<Group> {
    const id = this.nextGroupId++;
    const now = new Date();
    const group: Group = {
      id,
      userId: insertGroup.userId,
      name: insertGroup.name,
      description: insertGroup.description ?? null,
      color: insertGroup.color ?? "#3b82f6",
      createdAt: now,
      updatedAt: now,
    };
    this.groups.set(id, group);
    return group;
  }

  async updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const group = this.groups.get(id);
    if (!group) return undefined;
    
    const updated: Group = {
      ...group,
      ...data,
      updatedAt: new Date(),
    };
    this.groups.set(id, updated);
    return updated;
  }

  async deleteGroup(id: number): Promise<boolean> {
    const deleted = this.groups.delete(id);
    if (deleted) {
      Array.from(this.keywordGroupRelations.keys())
        .filter(key => key.endsWith(`-${id}`))
        .forEach(key => this.keywordGroupRelations.delete(key));
    }
    return deleted;
  }

  async getKeywordsByGroup(groupId: number): Promise<Keyword[]> {
    const keywordIds = Array.from(this.keywordGroupRelations.values())
      .filter(rel => rel.groupId === groupId)
      .map(rel => rel.keywordId);
    
    return Array.from(this.keywords.values())
      .filter(k => keywordIds.includes(k.id));
  }

  async addKeywordToGroup(keywordId: number, groupId: number): Promise<KeywordGroup> {
    const key = `${keywordId}-${groupId}`;
    const relation: KeywordGroup = {
      keywordId,
      groupId,
      createdAt: new Date(),
    };
    this.keywordGroupRelations.set(key, relation);
    return relation;
  }

  async removeKeywordFromGroup(keywordId: number, groupId: number): Promise<boolean> {
    const key = `${keywordId}-${groupId}`;
    return this.keywordGroupRelations.delete(key);
  }

  async getGroupsForKeyword(keywordId: number): Promise<Group[]> {
    const groupIds = Array.from(this.keywordGroupRelations.values())
      .filter(rel => rel.keywordId === keywordId)
      .map(rel => rel.groupId);
    
    return Array.from(this.groups.values())
      .filter(g => groupIds.includes(g.id));
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.settings.get(userId);
  }

  async updateUserSettings(userId: string, settingsData: Partial<InsertUserSettings>): Promise<UserSettings> {
    const existing = this.settings.get(userId);
    const settings: UserSettings = {
      userId,
      navigationItems: settingsData.navigationItems ?? existing?.navigationItems ?? [],
      preferences: settingsData.preferences ?? existing?.preferences ?? {},
      updatedAt: new Date(),
    };
    this.settings.set(userId, settings);
    return settings;
  }
}

class PostgresStorage implements IStorage {
  private db;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersWithStats(): Promise<UserStats[]> {
    const allUsers = await this.getAllUsers();
    const stats: UserStats[] = [];
    
    for (const user of allUsers) {
      const userKeywords = await this.getKeywordsByUser(user.id);
      const keywordIds = userKeywords.map(k => k.id);
      
      let measurementCount = 0;
      let lastActivityAt: Date | null = null;
      
      if (keywordIds.length > 0) {
        const userMeasurements = await this.db.select()
          .from(measurements)
          .where(inArray(measurements.keywordId, keywordIds))
          .orderBy(desc(measurements.measuredAt))
          .limit(1);
        
        if (userMeasurements.length > 0) {
          lastActivityAt = userMeasurements[0].measuredAt;
        }
        
        const countResult = await this.db.select()
          .from(measurements)
          .where(inArray(measurements.keywordId, keywordIds));
        measurementCount = countResult.length;
      }
      
      stats.push({
        user,
        keywordCount: userKeywords.length,
        measurementCount,
        lastActivityAt,
      });
    }
    
    return stats;
  }

  async getKeywords(): Promise<Keyword[]> {
    return await this.db.select().from(keywords).orderBy(desc(keywords.createdAt));
  }

  async getKeywordsByUser(userId: string): Promise<Keyword[]> {
    return await this.db.select().from(keywords).where(eq(keywords.userId, userId)).orderBy(desc(keywords.createdAt));
  }

  async getKeyword(id: number): Promise<Keyword | undefined> {
    const result = await this.db.select().from(keywords).where(eq(keywords.id, id)).limit(1);
    return result[0];
  }

  async createKeyword(insertKeyword: InsertKeyword): Promise<Keyword> {
    const result = await this.db.insert(keywords).values(insertKeyword).returning();
    return result[0];
  }

  async updateKeyword(id: number, data: Partial<InsertKeyword>): Promise<Keyword | undefined> {
    const result = await this.db.update(keywords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(keywords.id, id))
      .returning();
    return result[0];
  }

  async updateKeywordCompetition(id: number, documentCount: number, competitionRate: string | null): Promise<void> {
    await this.db.update(keywords)
      .set({ 
        documentCount, 
        competitionRate,
        updatedAt: new Date() 
      })
      .where(eq(keywords.id, id));
  }

  async deleteKeyword(id: number): Promise<boolean> {
    const result = await this.db.delete(keywords).where(eq(keywords.id, id)).returning();
    return result.length > 0;
  }

  async getMeasurements(keywordId: number, limit: number = 100): Promise<Measurement[]> {
    return await this.db.select()
      .from(measurements)
      .where(eq(measurements.keywordId, keywordId))
      .orderBy(desc(measurements.measuredAt))
      .limit(limit);
  }

  async getMeasurementsByUser(userId: string, limit: number = 50): Promise<Measurement[]> {
    const userKeywords = await this.getKeywordsByUser(userId);
    const keywordIds = userKeywords.map(k => k.id);
    
    if (keywordIds.length === 0) {
      return [];
    }
    
    return await this.db.select()
      .from(measurements)
      .where(inArray(measurements.keywordId, keywordIds))
      .orderBy(desc(measurements.measuredAt))
      .limit(limit);
  }

  async createMeasurement(insertMeasurement: InsertMeasurement): Promise<Measurement> {
    const result = await this.db.insert(measurements).values(insertMeasurement).returning();
    return result[0];
  }

  async getLatestMeasurements(): Promise<Map<number, Measurement>> {
    const allMeasurements = await this.db.select()
      .from(measurements)
      .orderBy(desc(measurements.measuredAt));
    
    const latest = new Map<number, Measurement>();
    allMeasurements.forEach(measurement => {
      if (!latest.has(measurement.keywordId)) {
        latest.set(measurement.keywordId, measurement);
      }
    });
    
    return latest;
  }

  async getPreviousMeasurements(): Promise<Map<number, Measurement>> {
    const allMeasurements = await this.db.select()
      .from(measurements)
      .orderBy(desc(measurements.measuredAt));
    
    const previous = new Map<number, Measurement>();
    const latest = new Map<number, Measurement>();
    
    allMeasurements.forEach(measurement => {
      if (!latest.has(measurement.keywordId)) {
        latest.set(measurement.keywordId, measurement);
      } else if (!previous.has(measurement.keywordId)) {
        previous.set(measurement.keywordId, measurement);
      }
    });
    
    return previous;
  }

  async getGroups(userId: string): Promise<Group[]> {
    return await this.db.select().from(groups)
      .where(eq(groups.userId, userId))
      .orderBy(desc(groups.createdAt));
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const result = await this.db.select().from(groups).where(eq(groups.id, id)).limit(1);
    return result[0];
  }

  async createGroup(insertGroup: InsertGroup): Promise<Group> {
    const result = await this.db.insert(groups).values(insertGroup).returning();
    return result[0];
  }

  async updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const result = await this.db.update(groups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(groups.id, id))
      .returning();
    return result[0];
  }

  async deleteGroup(id: number): Promise<boolean> {
    const result = await this.db.delete(groups).where(eq(groups.id, id)).returning();
    return result.length > 0;
  }

  async getKeywordsByGroup(groupId: number): Promise<Keyword[]> {
    const relations = await this.db.select()
      .from(keywordGroups)
      .where(eq(keywordGroups.groupId, groupId));
    
    if (relations.length === 0) return [];
    
    const keywordIds = relations.map(r => r.keywordId);
    return await this.db.select().from(keywords)
      .where(inArray(keywords.id, keywordIds));
  }

  async addKeywordToGroup(keywordId: number, groupId: number): Promise<KeywordGroup> {
    const result = await this.db.insert(keywordGroups)
      .values({ keywordId, groupId })
      .returning();
    return result[0];
  }

  async removeKeywordFromGroup(keywordId: number, groupId: number): Promise<boolean> {
    const result = await this.db.delete(keywordGroups)
      .where(and(
        eq(keywordGroups.keywordId, keywordId),
        eq(keywordGroups.groupId, groupId)
      ))
      .returning();
    return result.length > 0;
  }

  async getGroupsForKeyword(keywordId: number): Promise<Group[]> {
    const relations = await this.db.select()
      .from(keywordGroups)
      .where(eq(keywordGroups.keywordId, keywordId));
    
    if (relations.length === 0) return [];
    
    const groupIds = relations.map(r => r.groupId);
    return await this.db.select().from(groups)
      .where(inArray(groups.id, groupIds));
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await this.db.select().from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return result[0];
  }

  async updateUserSettings(userId: string, settingsData: Partial<InsertUserSettings>): Promise<UserSettings> {
    const existing = await this.getUserSettings(userId);
    
    if (existing) {
      const result = await this.db.update(userSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return result[0];
    } else {
      const result = await this.db.insert(userSettings)
        .values({ userId, ...settingsData })
        .returning();
      return result[0];
    }
  }
}

export const storage = new PostgresStorage();
