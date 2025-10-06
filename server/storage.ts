import { type User, type InsertUser, type Keyword, type InsertKeyword, type Measurement, type InsertMeasurement } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getKeywords(): Promise<Keyword[]>;
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
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getKeywords(): Promise<Keyword[]> {
    return Array.from(this.keywords.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getKeyword(id: number): Promise<Keyword | undefined> {
    return this.keywords.get(id);
  }

  async createKeyword(insertKeyword: InsertKeyword): Promise<Keyword> {
    const id = this.nextKeywordId++;
    const now = new Date();
    const keyword: Keyword = {
      id,
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
      blogTabRank: insertMeasurement.blogTabRank ?? null,
      searchVolumeAvg: insertMeasurement.searchVolumeAvg ?? null,
      durationMs: insertMeasurement.durationMs ?? null,
      errorMessage: insertMeasurement.errorMessage ?? null,
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

export const storage = new MemStorage();
