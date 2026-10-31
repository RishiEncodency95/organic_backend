import { Run, type CompetitorStudy } from './models';
import { ConflictException } from './errors';

export const LEASE_MS = 60_000;
export const MAX_RUN_MS = 12 * 60_000;
/** The run IS the job. Insertion is atomic, including its immutable input snapshot. */
export async function enqueueRun(companyId: string, study: CompetitorStudy, trigger: 'manual' | 'scheduled') {
  await Run.init();
  try {
    const run = await Run.create({ companyId, studyId: study.id, snapshot: study, status: 'running', job: 'queued', stage: 'queued', trigger });
    return { run: { ...run.toObject(), id: String(run._id) }, reused: false };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const active = await Run.findOne({ companyId, studyId: study.id, status: 'running' }).lean();
    if (!active) throw new ConflictException('The analysis changed. Try again.');
    return { run: { ...active, id: String(active._id) }, reused: true };
  }
}
export async function claimRun(owner: string, now = new Date()) {
  await Run.updateMany({ status: { $in: ['completed','failed','cancelled'] }, job: { $in: ['queued','leased'] } }, {
    $set: { job: 'done', expiresAt: new Date(now.getTime()+365*86400_000) },
  });
  // Exhausted jobs cannot occupy the unique active-study slot indefinitely after a crash.
  await Run.updateMany({ status: 'running', attempts: { $gte: 3 }, job: 'leased', leaseUntil: { $lte: now } }, {
    $set: { status: 'failed', job: 'dead', finishedAt: now, stage: null, expiresAt: new Date(now.getTime()+365*86400_000), errorMessage: 'Worker stopped repeatedly. Run the analysis again.' },
  });
  return Run.findOneAndUpdate({ status: 'running', attempts: { $lt: 3 }, $or: [
    { job: 'queued', availableAt: { $lte: now } }, { job: 'leased', leaseUntil: { $lte: now } },
  ] }, { $set: { owner, job: 'leased', leaseUntil: new Date(now.getTime() + LEASE_MS), heartbeatAt: now }, $inc: { attempts: 1, fence: 1 } }, {
    returnDocument: 'after', sort: { availableAt: 1, startedAt: 1 },
  }).lean();
}
export async function renewLease(id: string, owner: string, fence: number) {
  const now = new Date();
  const result = await Run.updateOne({ _id: id, owner, fence, job: 'leased', status: 'running', leaseUntil: { $gt: now } }, {
    $set: { leaseUntil: new Date(now.getTime() + LEASE_MS), heartbeatAt: now },
  });
  return result.modifiedCount === 1;
}
export async function settleRun(id: string, owner: string, fence: number, error?: string) {
  const filter = { _id: id, owner, fence, leaseUntil: { $gt: new Date() } };
  const current = await Run.findOne(filter).lean();
  if (!current) return;
  if (current.status !== 'running') {
    await Run.updateOne(filter, { $set: { job: current.status === 'cancelled' ? 'cancelled' : 'done', expiresAt: new Date(Date.now() + 365 * 86400_000) } });
  } else if ((current.attempts ?? 0) >= 3) {
    await Run.updateOne(filter, { $set: { job: 'dead', status: 'failed', stage: null, finishedAt: new Date(), expiresAt: new Date(Date.now()+365*86400_000), errorMessage: error?.slice(0, 500) ?? 'Worker failed.' } });
  } else {
    await Run.updateOne(filter, { $set: { job: 'queued', stage: 'retrying', availableAt: new Date(Date.now() + 5_000 * 2 ** (current.attempts ?? 1)), lastError: error?.slice(0, 500), leaseUntil: null }, $unset: { owner: 1 } });
  }
}
