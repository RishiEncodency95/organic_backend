import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';

const mixed = Schema.Types.Mixed;
const identity = { _id: { type: String, default: () => randomUUID() }, companyId: { type: String, required: true, index: true } };
const options = { timestamps: true, versionKey: false, strict: true } as const;
export const Study = mongoose.model('AnalyzerStudy', new Schema({
  ...identity, clientId: { type: String, default: null }, name: { type: String, required: true, maxlength: 120 },
  sites: { type: [mixed], required: true }, createdByUserId: String,
  settings: { type: mixed, default: () => ({}) }, actions: { type: mixed, default: () => ({}) },
  profile: { type: String, enum: ['general-v1', 'expo-v1','expo-organic-v1'], default: 'general-v1' },crawlBudget:{type:mixed,default:()=>({maxPagesPerSite:10,maxPagesPerRun:50,concurrency:2,maxHttpRequests:150})},
  nextCheckAt: { type: Date, default: null }, nextReportAt: { type: Date, default: null }, archivedAt: { type: Date, default: null },
}, options).index({ companyId: 1, archivedAt: 1, updatedAt: -1 }).index({ nextCheckAt: 1 }).index({ nextReportAt: 1 }));

export const Run = mongoose.model('AnalyzerRun', new Schema({
  ...identity, studyId: { type: String, required: true },
  status: { type: String, enum: ['running', 'completed', 'failed', 'cancelled'], required: true },
  stage: { type: String, default: null }, sites: { type: [mixed], default: null }, ai: { type: mixed, default: null },
  changes: { type: mixed, default: null }, profileResults: mixed,businessIntelligence:mixed,discoveryResult:mixed,crawlUsage:mixed, scoringVersion: { type: String, default: 'media360-original' },
  model: String, inputTokens: Number, outputTokens: Number, costMicros: Number,
  errorMessage: { type: String, default: null, maxlength: 500 }, startedAt: { type: Date, default: Date.now }, finishedAt: { type: Date, default: null },
  job: { type: String, enum: ['queued', 'leased', 'done', 'dead', 'cancelled'], default: 'queued' },
  trigger: { type: String, enum: ['manual', 'scheduled'], default: 'manual' },
  snapshot: { type: mixed, required: true }, availableAt: { type: Date, default: Date.now },
  owner: String, fence: { type: Number, default: 0 }, leaseUntil: Date, heartbeatAt: Date,
  attempts: { type: Number, default: 0 }, maxAttempts: { type: Number, default: 3 },
  lastError: String, expiresAt: Date,
}, options)
  .index({ companyId: 1, studyId: 1 }, { unique: true, partialFilterExpression: { status: 'running' } })
  .index({ studyId: 1, startedAt: -1 }).index({ companyId: 1, startedAt: -1 })
  .index({ job: 1, availableAt: 1, leaseUntil: 1 }).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }));

export const Suggestion = mongoose.model('AnalyzerSuggestion', new Schema({
  ...identity, domain: { type: String, required: true }, result: mixed, model: String,
  inputTokens: Number, outputTokens: Number, costMicros: Number,
}, options).index({ companyId: 1, domain: 1, createdAt: -1 }).index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 }));

export const Share = mongoose.model('AnalyzerShare', new Schema({
  ...identity, studyId: { type: String, required: true }, token: { type: String, required: true, unique: true, select: true },
  label: { type: String, default: null }, lang: { type: String, enum: ['en', 'hi'], default: 'en' },
  expiresAt: { type: Date, required: true }, revokedAt: { type: Date, default: null },
  viewCount: { type: Number, default: 0 }, lastViewedAt: { type: Date, default: null }, createdByUserId: String,
}, options).index({ companyId: 1, studyId: 1, createdAt: -1 }).index({ expiresAt: 1 }, { expireAfterSeconds: 90 * 86400 }));

export const Client = mongoose.model('AnalyzerClient', new Schema({
  ...identity, name: { type: String, required: true }, website: { type: String, required: true },
}, options));
export const Task = mongoose.model('AnalyzerTask', new Schema({
  ...identity, studyId: String, actionKey: String, clientId: String, name: String, status: { type: String, default: 'pending' }, payload: mixed,
}, options).index({ companyId: 1, studyId: 1, actionKey: 1 }, { unique: true }));
export const Alert = mongoose.model('AnalyzerAlert', new Schema({
  ...identity, userId: String, type: String, title: String, message: String, data: mixed, readAt: Date,
}, options).index({ companyId: 1, createdAt: -1 }).index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 }));

export interface CompetitorStudy {
  id: string; companyId: string; clientId: string | null; name: string; sites: unknown;
  settings: unknown; actions: unknown; createdByUserId: string | null; profile: string; crawlBudget?:import('./industry-settings').CrawlBudget;
  nextCheckAt: Date | null; nextReportAt: Date | null; archivedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface CompetitorStudyShare {
  id: string; companyId: string; studyId: string; token: string; label: string | null; lang: string;
  expiresAt: Date; revokedAt: Date | null; viewCount: number; lastViewedAt: Date | null; createdAt: Date;
}
