import 'dotenv/config';
import '../../config/dns';
import mongoose from 'mongoose';
import { fork, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join, extname } from 'node:path';
import { claimRun, renewLease, settleRun, MAX_RUN_MS } from './queue';
import { Study, Run, Share, Suggestion, Task, Client, Alert } from './models';
import { CompetitorAnalyzerService } from './competitor-analyzer.service';
import { logger } from './errors';
import { Delivery, processDelivery } from './outbox';

let stopping = false;
let active: ChildProcess | null = null;
const owner = randomUUID();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopping = true; active?.kill('SIGTERM'); });
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function processOne(run: NonNullable<Awaited<ReturnType<typeof claimRun>>>) {
  const id = String(run._id), fence = run.fence ?? 0;
  let error = '';
  const child = fork(join(__dirname, `worker-child${extname(__filename)}`), [id, owner, String(fence)], {
    execArgv: [...process.execArgv.filter(v => !v.startsWith('--max-old-space-size')), '--max-old-space-size=512'], stdio: 'inherit',
  });
  active = child;
  const timeout = setTimeout(() => { error = 'Analysis exceeded its execution deadline.'; child.kill('SIGKILL'); }, MAX_RUN_MS);
  let renewing = false;
  const heartbeat = setInterval(() => {
    if (renewing) return;
    renewing = true;
    renewLease(id, owner, fence).then(ok => { if (!ok) { error = 'Lease lost or analysis cancelled.'; child.kill('SIGKILL'); } })
      .catch(() => { error = 'Unable to renew worker lease.'; child.kill('SIGKILL'); }).finally(() => { renewing = false; });
  }, 15_000);
  await new Promise<void>(resolve => {
    child.once('error', e => { error = e.message; resolve(); });
    child.once('exit', code => { if (code && !error) error = `Worker exited with code ${code}.`; resolve(); });
  });
  clearTimeout(timeout); clearInterval(heartbeat); active = null;
  await settleRun(id, owner, fence, error || undefined);
}
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Study, Run, Share, Suggestion, Task, Client, Alert, Delivery].map(model => model.init()));
  const scheduler = new CompetitorAnalyzerService();
  let scheduledAt = 0;
  while (!stopping) {
    try {
      if (Date.now() - scheduledAt > 60_000) {
        await scheduler.runDueChecks();
        await scheduler.sendDueReports();
        scheduledAt = Date.now();
      }
      const run = await claimRun(owner);
      if (run) await processOne(run);
      else if (!(await processDelivery(owner, (companyId,studyId,to)=>scheduler.emailReport({companyId,userId:'scheduler'},studyId,to)))) await pause(2000);
    } catch (error) { logger.error({ event: 'analyzer.worker_error', message: error instanceof Error ? error.message : 'Unknown error' }); await pause(5000); }
  }
}
main().catch(error => { logger.error(error.message); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
