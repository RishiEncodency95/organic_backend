import 'dotenv/config';
import '../../config/dns';
import mongoose from 'mongoose';
import { CompetitorAnalyzerService } from './competitor-analyzer.service';
import { AnalyzerRepository } from './repository';
import { Run, type CompetitorStudy } from './models';
import { performDeepDiscovery, type DiscoverySnapshot } from './deep-discovery';
import { networkDeps } from './adapters';

async function main() {
  const [id, owner, generation] = process.argv.slice(2);
  if (!id || !owner || !generation || !process.env.MONGODB_URI) throw new Error('Missing worker configuration');
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 3, serverSelectionTimeoutMS: 5000 });
  const fence = Number(generation);
  const run = await Run.findOne({ _id: id, owner, fence, status: 'running', leaseUntil: { $gt: new Date() } }).lean();
  if (!run) return;
  const repository=new AnalyzerRepository({id,owner,fence});
  if((run.snapshot as {kind?:string}).kind==='discovery'){
    const result=await performDeepDiscovery(run.snapshot as DiscoverySnapshot,networkDeps(),{
      stage:async stage=>(await repository.competitorStudyRun.updateMany({where:{id,status:'running'},data:{stage}})).count>0,
      usage:async usage=>{await repository.competitorStudyRun.updateMany({where:{id},data:usage});},
    });
    result.runId=id;
    await repository.competitorStudyRun.updateMany({where:{id,status:'running'},data:{discoveryResult:result,status:'completed',stage:null,finishedAt:new Date()}});
    return;
  }
  const service = new CompetitorAnalyzerService(repository);
  await service.execute(run.companyId, run.snapshot as CompetitorStudy, id, run.trigger as 'manual' | 'scheduled');
}
main().catch(error => { console.error(JSON.stringify({ event: 'analyzer.worker_child_failed', message: error.message })); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
