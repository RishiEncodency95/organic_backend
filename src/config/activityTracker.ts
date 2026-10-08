import { AsyncLocalStorage } from "async_hooks";
import mongoose, { Schema } from "mongoose";

/*
 * Old → new values for the Activity Log.
 *
 * A global Mongoose plugin watches every create / update / delete made while an admin write
 * request is running (activityLog.middleware opens the request context) and notes what the
 * record looked like before and after. Only changed fields are kept for updates; secrets
 * (passwords, tokens, OTPs…) are masked and long text is shortened.
 *
 * Must be imported before any model is compiled: it is the first import of app.ts.
 */

export type ChangeOperation = "created" | "updated" | "deleted";
export interface RecordedChange {
  entity: string;
  entityId?: string;
  operation: ChangeOperation;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface RequestContext {
  changes: RecordedChange[];
}

export const activityContext = new AsyncLocalStorage<RequestContext>();

const MAX_CHANGES = 20; // per request
const MAX_DOCS_PER_QUERY = 20; // updateMany / deleteMany snapshot
const MAX_STRING = 400;
const MAX_ARRAY = 25;
const MAX_DEPTH = 4;

// Never stored in the log
const SECRET = /pass(word)?|secret|token|otp|hash|salt|api[-_]?key|private[-_]?key|2fa|totp/i;
// Not worth showing as a change
const NOISE = new Set(["updatedAt", "createdAt", "__v"]);
// Models whose writes are bookkeeping, not admin content
const SKIP_MODELS = new Set(["ActivityLog", "DropdownListMeta"]);

/** A JSON-safe, size-limited copy with secrets masked. */
const clean = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length} chars)` : value;
  if (typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[${value.length} items]` : "{…}";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => clean(v, depth + 1));
    return value.length > MAX_ARRAY ? [...items, `… ${value.length - MAX_ARRAY} more`] : items;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET.test(key) ? "••••••" : clean(v, depth + 1);
  }
  return out;
};

const snapshot = (doc: unknown): Record<string, unknown> => {
  const plain = doc && typeof (doc as any).toObject === "function" ? (doc as any).toObject({ depopulate: true }) : doc;
  const out = (clean(plain) as Record<string, unknown>) ?? {};
  for (const key of NOISE) delete out[key];
  return out;
};

/** Only the top-level fields whose value changed. */
const diff = (before: Record<string, unknown>, after: Record<string, unknown>) => {
  const old: Record<string, unknown> = {};
  const now: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === "_id" || NOISE.has(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      old[key] = before[key];
      now[key] = after[key];
    }
  }
  return { old, now, changed: Object.keys(now).length > 0 };
};

const note = (change: RecordedChange) => {
  const ctx = activityContext.getStore();
  if (!ctx || ctx.changes.length >= MAX_CHANGES || SKIP_MODELS.has(change.entity)) return;
  // doc.deleteOne() also runs the query hook: keep one entry per record and operation
  if (ctx.changes.some((c) => c.entity === change.entity && c.entityId === change.entityId && c.operation === change.operation && change.operation !== "updated")) return;
  ctx.changes.push(change);
};

const idOf = (doc: any) => (doc?._id !== undefined ? String(doc._id) : undefined);

const UPDATE_QUERIES = ["findOneAndUpdate", "updateOne", "updateMany", "findOneAndReplace", "replaceOne"] as const;
const DELETE_QUERIES = ["findOneAndDelete", "deleteOne", "deleteMany"] as const;

function activityPlugin(schema: Schema) {
  // Mongoose's typings take one hook name at a time; it accepts a list at runtime
  const hooks = schema as any;
  // Documents loaded during an admin request remember how they looked, for save() diffs
  schema.post("init", function (this: any) {
    if (activityContext.getStore()) this.$locals.activityOriginal = snapshot(this);
  });

  schema.pre("save", function (this: any) {
    if (!activityContext.getStore()) return;
    this.$locals.activityWasNew = this.isNew;
  });

  schema.post("save", function (this: any) {
    const model = (this.constructor as any)?.modelName;
    if (!activityContext.getStore() || !model) return;
    const after = snapshot(this);
    if (this.$locals.activityWasNew) {
      note({ entity: model, entityId: idOf(this), operation: "created", after });
    } else {
      const { old, now, changed } = diff((this.$locals.activityOriginal as Record<string, unknown>) ?? {}, after);
      if (changed) note({ entity: model, entityId: idOf(this), operation: "updated", before: old, after: now });
    }
    this.$locals.activityOriginal = after;
  });

  // doc.deleteOne()
  schema.pre("deleteOne", { document: true, query: false }, function (this: any) {
    const model = (this.constructor as any)?.modelName;
    if (activityContext.getStore() && model) note({ entity: model, entityId: idOf(this), operation: "deleted", before: snapshot(this) });
  });

  // Model.updateOne / findByIdAndUpdate / …: read the matching records before and after
  hooks.pre(UPDATE_QUERIES, async function (this: any) {
    if (!activityContext.getStore() || SKIP_MODELS.has(this.model?.modelName)) return;
    const docs = await this.model.find(this.getFilter()).limit(MAX_DOCS_PER_QUERY).lean();
    this._activityBefore = docs;
  });
  hooks.post(UPDATE_QUERIES, async function (this: any) {
    if (!activityContext.getStore() || !this._activityBefore) return;
    const model = this.model.modelName;
    const before: any[] = this._activityBefore;
    if (before.length === 0) {
      // an upsert that created the record
      if (this.getOptions()?.upsert) {
        const created = await this.model.findOne(this.getFilter()).lean();
        if (created) note({ entity: model, entityId: idOf(created), operation: "created", after: snapshot(created) });
      }
      return;
    }
    const afterDocs: any[] = await this.model.find({ _id: { $in: before.map((d) => d._id) } }).lean();
    const byId = new Map(afterDocs.map((d) => [String(d._id), d]));
    for (const old of before) {
      const now = byId.get(String(old._id));
      if (!now) continue;
      const result = diff(snapshot(old), snapshot(now));
      if (result.changed) note({ entity: model, entityId: idOf(old), operation: "updated", before: result.old, after: result.now });
    }
  });

  // Model.deleteOne / findByIdAndDelete / deleteMany: keep a copy of what is removed
  hooks.pre(DELETE_QUERIES, { document: false, query: true }, async function (this: any) {
    if (!activityContext.getStore() || SKIP_MODELS.has(this.model?.modelName)) return;
    const docs: any[] = await this.model.find(this.getFilter()).limit(MAX_DOCS_PER_QUERY).lean();
    for (const doc of docs) note({ entity: this.model.modelName, entityId: idOf(doc), operation: "deleted", before: snapshot(doc) });
  });

  // Model.insertMany
  hooks.post("insertMany", function (this: any, docs: any[]) {
    if (!activityContext.getStore()) return;
    for (const doc of (docs ?? []).slice(0, MAX_DOCS_PER_QUERY)) {
      note({ entity: this.modelName, entityId: idOf(doc), operation: "created", after: snapshot(doc) });
    }
  });
}

mongoose.plugin(activityPlugin);
