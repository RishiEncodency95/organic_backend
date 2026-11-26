import 'dotenv/config';
import '../src/config/dns';
import mongoose from 'mongoose';
import { writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Study,Run } from '../src/modules/competitor-analyzer/models';
import { Budget } from '../src/modules/competitor-analyzer/budget-provider';
import { aiLimits,providerKey,modelFor } from '../src/modules/website-intelligence/ai/website-ai.config';
import { measureSite } from '../src/modules/competitor-analyzer/analyzer-evidence';
import { BUSINESS_PROFILES,evaluateProfile } from '../src/modules/competitor-analyzer/profiles';
import { buildBusinessIntelligence } from '../src/modules/competitor-analyzer/business-intelligence';
import { measuredAnalysis } from '../src/modules/competitor-analyzer/analyzer-intelligence';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { renewLease,settleRun,MAX_RUN_MS } from '../src/modules/competitor-analyzer/queue';
import {CompetitorAnalyzerService} from '../src/modules/competitor-analyzer/competitor-analyzer.service';

async function main(){
  console.log(JSON.stringify({aiMode:aiLimits.defaultMode(),aiConfigured:Boolean(providerKey('openai')),model:modelFor('openai'),pageSpeedConfigured:Boolean(process.env.PAGESPEED_API_KEY)}));
  if(process.argv.includes('--pdf')){
    await mongoose.connect(process.env.MONGODB_URI!,{serverSelectionTimeoutMS:8000});
    const study=await Study.findOne({'sites.domain':'bharatorganicexpo.com'}).sort({updatedAt:-1}).lean();if(!study)throw new Error('No matching study');
    const report=await new CompetitorAnalyzerService().reportPdf({companyId:study.companyId,userId:'live-review'},study._id,'en');
    const output=resolve('../docs/06-implementation/competitor-analyzer/reports/live-rerun-en.pdf');await writeFile(output,report.content);console.log(JSON.stringify({output,bytes:report.content.length}));return;
  }
  if(process.argv.includes('--rerun')){
    await mongoose.connect(process.env.MONGODB_URI!,{serverSelectionTimeoutMS:8000});
    const study=await Study.findOne({'sites.domain':'bharatorganicexpo.com'}).sort({updatedAt:-1}).lean();
    if(!study)throw new Error('No matching study');
    await Run.init();const owner=`live-review:${randomUUID()}`;
    const run=await Run.create({companyId:study.companyId,studyId:study._id,snapshot:{...study,id:study._id},status:'running',stage:'reading',trigger:'manual',job:'leased',owner,fence:1,attempts:1,leaseUntil:new Date(Date.now()+60000),heartbeatAt:new Date()});
    console.log(`Started live review run ${run._id}`);
    const child=fork(resolve('src/modules/competitor-analyzer/worker-child.ts'),[run._id,owner,'1'],{execArgv:[...process.execArgv,'--max-old-space-size=512'],stdio:'inherit'});
    const heartbeat=setInterval(()=>{void renewLease(run._id,owner,1).then(ok=>{if(!ok)child.kill();}).catch(()=>child.kill());},15000);
    const deadline=setTimeout(()=>child.kill('SIGKILL'),MAX_RUN_MS);
    let error:string|undefined;
    try{await new Promise<void>(done=>{child.once('error',e=>{error=e.message;done();});child.once('exit',code=>{if(code)error=`Child exited ${code}`;done();});});}
    finally{clearInterval(heartbeat);clearTimeout(deadline);await settleRun(run._id,owner,1,error);}
    const result=await Run.findById(run._id).lean();
    const output=resolve('../docs/06-implementation/competitor-analyzer/reports/live-rerun.json');await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify(result,null,2));
    console.log(JSON.stringify({studyId:study._id,runId:run._id,status:result?.status,ai:(result?.ai as any)?.status,reason:(result?.ai as any)?.reason,scores:(result?.ai as any)?.result?.overall,actions:(result?.businessIntelligence as any)?.roadmap?.map((a:any)=>a.action),output}));return;
  }
  if(process.argv.includes('--inspect')){
    await mongoose.connect(process.env.MONGODB_URI!,{serverSelectionTimeoutMS:8000});
    const study=await Study.findOne({'sites.domain':'bharatorganicexpo.com'}).sort({updatedAt:-1}).lean();
    if(!study){console.log('No matching study in this database');return;}
    const run=await Run.findOne({studyId:study._id,status:'completed'}).sort({startedAt:-1}).lean();
    console.log(JSON.stringify({studyId:study._id,profile:study.profile,sites:study.sites,runId:run?._id,aiStatus:(run?.ai as any)?.status,reason:(run?.ai as any)?.reason,failureCode:(run?.ai as any)?.failureCode,usage:{model:run?.model,input:run?.inputTokens,output:run?.outputTokens},budget:await Budget.findOne({_id:`organic-bharat:${new Date().toISOString().slice(0,10)}`}).lean()},null,2));return;
  }
  const profile=BUSINESS_PROFILES.find(p=>p.id==='expo-organic-v1')!;
  const sites=[];
  for(const [index,domain]of ['bharatorganicexpo.com','indiafoodex.com','megatradefair.com','wmnc.in'].entries()){
    const measured=await measureSite({url:`https://${domain}/`,domain,role:index===0?'own':'competitor'},{},{businessProfile:true,preferredPaths:profile.importantPaths,journeyRules:profile.journeys,pagespeed:false});
    sites.push(measured.evidence);console.log(JSON.stringify({domain,reachable:measured.evidence.reachable,pages:measured.evidence.pages.length,error:measured.evidence.error}));
  }
  const analysis=measuredAnalysis(sites),business=buildBusinessIntelligence({profileId:profile.id,sites,analysis});
  const output=resolve('../docs/06-implementation/competitor-analyzer/reports/live-review.json');await mkdir(resolve(output,'..'),{recursive:true});
  await writeFile(output,JSON.stringify({at:new Date().toISOString(),sites,analysis,profile:evaluateProfile(profile.id,sites),business},null,2));
  console.log(JSON.stringify({output,scores:analysis.overall,actions:business?.roadmap.map(a=>a.action)}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
