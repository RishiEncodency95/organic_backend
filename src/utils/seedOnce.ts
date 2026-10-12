import mongoose, { Schema } from "mongoose";

/*
 * Starting data for an admin-managed list is inserted only ONCE per database. A marker records
 * that it happened, so when the team later deletes every item the starters do not come back.
 */

const SeedMarker = mongoose.model(
  "OrganicSeedMarker",
  new Schema({ key: { type: String, required: true, unique: true } }, { timestamps: true })
);

const running = new Map<string, Promise<void>>();

/**
 * Runs `insert` the first time `key` is seen, and only while `model` is still empty
 * (a list that already has data is just marked as seeded).
 */
export const seedOnce = (key: string, model: { estimatedDocumentCount(): Promise<number> }, insert: () => Promise<unknown>) => {
  let job = running.get(key);
  if (!job) {
    job = (async () => {
      if (await SeedMarker.exists({ key })) return;
      if (!(await model.estimatedDocumentCount())) await insert();
      await SeedMarker.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true });
    })();
    // A failed attempt is retried on the next request
    job.catch(() => running.delete(key));
    running.set(key, job);
  }
  return job;
};
