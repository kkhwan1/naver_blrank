import { type User, type InsertUser, type Keyword, type InsertKeyword, type Measurement, type InsertMeasurement, keywords, measurements, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  getKeywords(): Promise<Keyword[]>;
  getKeywordsByUser(userId: string): Promise<Keyword[]>;
  getKeyword(id: number): Promise<Keyword | undefined>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: number, data: Partial<InsertKeyword>): Promise<Keyword | undefined>;
  deleteKeyword(id: number): Promise<boolean>;
  
  getMeasurements(keywordId: number, limit?: number): Promise<Measurement[]>;
  createMeasurement(measurement: InsertMeasurement): Promise<Measurement>;
  getLatestMeasurements(): Promise<Map<number, Measurement>>;
  getPreviousMeasurements(): Promise<Map<number, Measurement>>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private keywords: Map<number, Keyword>;
  private measurements: Map<number, Measurement>;
  private nextKeywordId: number;
  private nextMeasurementId: number;

  constructor() {
    this.users = new Map();
    this.keywords = new Map();
    this.measurements = new Map();
    this.nextKeywordId = 1;
    this.nextMeasurementId = 1;
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
}

export const storage = new PostgresStorage();
