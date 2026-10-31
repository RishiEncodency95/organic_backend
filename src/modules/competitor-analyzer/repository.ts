/** Mongoose persistence boundary. Converts source query shapes; no Prisma runtime or SQL dependency. */
import type { Model } from 'mongoose';
import { Study, Run, Share, Suggestion, Client } from './models';
import type { CompetitorStudy, CompetitorStudyShare } from './models';

type Row = Record<string, any> & { id: string; createdAt: Date; updatedAt: Date };
type RunRow = Row & { startedAt: Date; finishedAt: Date | null; sites: unknown; ai: unknown; status: string };
type StudyRow = CompetitorStudy & Row & { runs: RunRow[] };
type Query = { where?: Record<string, any>; orderBy?: Record<string, 'asc' | 'desc'>; select?: Record<string, any>; take?: number; include?: Record<string, any> };
const operators: Record<string, string> = { gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', not: '$ne', in: '$in' };
export function mongoWhere(where: Record<string, any> = {}): Record<string, any> {
  return Object.fromEntries(Object.entries(where).map(([key, value]) => {
    if (key === 'OR' || key === 'AND') return [key === 'OR' ? '$or' : '$and', value.map(mongoWhere)];
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      if(Array.isArray(value.path)&&'equals' in value)return [[key,...value.path].join('.'),value.equals];
      if ('contains' in value) value = { $regex: String(value.contains).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: value.mode === 'insensitive' ? 'i' : '' };
      else value = Object.fromEntries(Object.entries(value).map(([op, val]) => [operators[op] ?? op, val]));
    }
    // Mongo compares null below all dates. Due schedules must exclude unscheduled rows.
    if (value && typeof value === 'object' && ('$lte' in value || '$lt' in value)) value = { ...value, $ne: null };
    return [key === 'id' ? '_id' : key, value];
  }));
}
function row(doc: any): Row { const { _id, __v, ...rest } = doc; return { ...rest, id: String(_id) }; }
function mutation(data: Record<string, any>) {
  const set: Record<string, any> = {}, inc: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && 'increment' in v) inc[k] = v.increment;
    else set[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(inc).length ? { $inc: inc } : {}) };
}
export class CollectionRepository<T extends Row = Row> {
  constructor(private readonly model: Model<any>, private readonly fence?: { id: string; owner: string; fence: number }) {}
  private filter(where?: Record<string, any>) {
    const filter = mongoWhere(where);
    if (this.model === Run && this.fence) Object.assign(filter, { _id: this.fence.id, owner: this.fence.owner, fence: this.fence.fence, leaseUntil: { $gt: new Date() } });
    return filter;
  }
  async findMany(q: Query = {}): Promise<T[]> {
    let query = this.model.find(mongoWhere(q.where));
    if (q.orderBy) query = query.sort(Object.fromEntries(Object.entries(q.orderBy).map(([k,v]) => [k,v === 'asc' ? 1 : -1])));
    if (q.take) query = query.limit(q.take);
    // Deliberately load full records: source projections include relation selections unavailable in Mongo.
    const rows = (await query.lean()).map(row);
    if (q.include?.runs && this.model === Study) {
      const spec = q.include.runs;
      for (const study of rows) study.runs = await new CollectionRepository(Run).findMany({ ...spec, where: { studyId: study.id, companyId: study.companyId } });
    }
    return rows as T[];
  }
  async findFirst(q: Query = {}): Promise<T | null> { return (await this.findMany({ ...q, take: 1 }))[0] ?? null; }
  async findUnique(q: Query): Promise<T | null> { return this.findFirst(q); }
  async count(q: Query = {}) { return this.model.countDocuments(mongoWhere(q.where)); }
  async create({ data }: { data: Record<string, any> }): Promise<T> {
    const normalized = Object.fromEntries(Object.entries(data).map(([k,v]) => [k === 'id' ? '_id' : k, typeof v === 'bigint' ? Number(v) : v]));
    return row((await this.model.create(normalized)).toObject()) as T;
  }
  async update({ where, data }: { where: Record<string, any>; data: Record<string, any> }): Promise<T> {
    const doc = await this.model.findOneAndUpdate(this.filter(where), mutation(data), { returnDocument: 'after', runValidators: true }).lean();
    if (!doc) throw new Error('Record changed or worker lease lost');
    return row(doc) as T;
  }
  async updateMany({ where, data }: { where: Record<string, any>; data: Record<string, any> }) {
    const result = await this.model.updateMany(this.filter(where), mutation(data), { runValidators: true });
    return { count: result.modifiedCount };
  }
  async aggregate(q: Query & { _sum: Record<string, boolean> }): Promise<{ _sum: Record<string, number> }> {
    const sums = Object.fromEntries(Object.keys(q._sum).map(k => [k, { $sum: `$${k}` }]));
    const results = await this.model.aggregate([{ $match: mongoWhere(q.where) }, { $group: { _id: null, ...sums } }]);
    return { _sum: results[0] ?? {} };
  }
}
export class AnalyzerRepository {
  competitorStudy = new CollectionRepository<StudyRow>(Study);
  competitorStudyRun: CollectionRepository<RunRow>;
  competitorStudyShare = new CollectionRepository<CompetitorStudyShare & Row>(Share);
  competitorSuggestion = new CollectionRepository(Suggestion);
  client = new CollectionRepository(Client);
  constructor(fence?: { id: string; owner: string; fence: number }) { this.competitorStudyRun = new CollectionRepository<RunRow>(Run, fence); }
}
