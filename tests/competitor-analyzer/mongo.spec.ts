import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Study, Run, Share, Client, Task } from '../../src/modules/competitor-analyzer/models';
import { enqueueRun, claimRun, renewLease, settleRun } from '../../src/modules/competitor-analyzer/queue';
import { AnalyzerRepository } from '../../src/modules/competitor-analyzer/repository';
import { CompetitorAnalyzerService } from '../../src/modules/competitor-analyzer/competitor-analyzer.service';
import { ORGANISATION_ID } from '../../src/modules/competitor-analyzer/adapters';
import { Admin } from '../../src/models/Admin.model';
import { Role } from '../../src/models/Role.model';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Delivery, enqueueDueReports, processDelivery } from '../../src/modules/competitor-analyzer/outbox';
import { Budget, callProvider } from '../../src/modules/competitor-analyzer/budget-provider';

vi.hoisted(()=>Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:'mongodb://127.0.0.1/analyzer_unused',ACCESS_TOKEN_SECRET:'analyzer-test-access',REFRESH_TOKEN_SECRET:'test-refresh',COOKIE_SECRET:'test-cookie',OPENAI_API_KEY:'',GEMINI_API_KEY:''}));
vi.mock('dotenv',()=>({default:{config:()=>({parsed:{}})},config:()=>({parsed:{}})}));
vi.mock('../../src/config/redis',()=>({getCache:async()=>null,CACHE_KEYS:{}}));
vi.mock('../../src/modules/website-intelligence/ai/website-ai.providers',()=>({callProvider:async(_provider:unknown,request:any)=>{for(let i=0;i<(request.system==='retry-fixture'?2:1);i++){const denied=await request.beforeAttempt?.();if(denied)return denied;}return {ok:true,provider:'openai',model:'offline-model',text:'{}',usage:{inputTokens:1,outputTokens:1,cachedInputTokens:0},latencyMs:1,truncated:false};}}));
let mongo:MongoMemoryServer, server:Server, base:string, adminToken:string, viewToken:string;
const service=new CompetitorAnalyzerService();
const actor={companyId:ORGANISATION_ID,userId:'test-owner'};
const input={own:'own.example',competitors:['rival.example'],names:{'own.example':'Own','rival.example':'Rival'}};
async function study() { return service.create(actor,input); }
async function call(path:string,method='GET',body?:unknown,token=adminToken) {
  const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}), 'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json().catch(()=>null)};
}
beforeAll(async()=>{
  mongo=await MongoMemoryServer.create({instance:{dbName:'analyzer_isolated_test'},binary:{downloadDir:'.test-mongodb'}});
  await mongoose.connect(mongo.getUri());
  await Promise.all([Study,Run,Share,Client,Task].map(m=>m.init()));
  Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:mongo.getUri(),ACCESS_TOKEN_SECRET:'analyzer-test-access',REFRESH_TOKEN_SECRET:'test-refresh',COOKIE_SECRET:'test-cookie',OPENAI_API_KEY:'',GEMINI_API_KEY:''});
  const {default:router,publicReportsRouter}=await import('../../src/modules/competitor-analyzer/routes');
  const app=express(); app.use(express.json());app.use('/competitor-analyzer',router);app.use('/public/competitor-reports',publicReportsRouter);
  app.use((error:any,_req:any,res:any,_next:any)=>res.status(error.statusCode??500).json({message:error.message}));
  server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const owner=await Admin.create({name:'Owner',email:'owner@example.test',password:'TestPassword123!',role:'superadmin',isActive:true});
  const role=await Role.create({name:'Analyzer Reader',slug:'ANALYZER_READER',status:'ACTIVE',permissionIds:['perm_analyzer_view']});
  const viewer=await Admin.create({name:'Viewer',email:'viewer@example.test',password:'TestPassword123!',role:'admin',roleId:String(role._id),isActive:true});
  adminToken=jwt.sign({id:String(owner._id),role:'superadmin'},'analyzer-test-access');viewToken=jwt.sign({id:String(viewer._id),role:'admin'},'analyzer-test-access');
},120_000);
beforeEach(async()=>{await Promise.all([Run,Study,Share,Client,Task,Delivery,Budget].map(m=>m.deleteMany({})));});
afterAll(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await mongoose.disconnect();await mongo?.stop();});

describe('durable MongoDB execution',()=>{
  it('atomically caps concurrent AI reservations before provider dispatch',async()=>{
    vi.stubEnv('WEBSITE_AI_DAILY_CALLS','2');vi.stubEnv('WEBSITE_AI_RETRIES','0');vi.stubEnv('COMPETITOR_AI_DAILY_TOKENS','1000');
    try{
      const results=await Promise.all(Array.from({length:12},()=>callProvider('openai',{system:'Offline fixture',user:'Test',maxOutputTokens:100})));
      expect(results.filter(r=>r.ok)).toHaveLength(2);expect(results.filter(r=>!r.ok)).toHaveLength(10);
      const budget=await Budget.findOne().lean();expect(budget?.calls).toBe(2);expect(budget?.reservedTokens).toBe(4);
    }finally{vi.unstubAllEnvs();}
  });
  it('reserves one actual attempt instead of a hypothetical retry',async()=>{
    vi.stubEnv('WEBSITE_AI_DAILY_CALLS','1');vi.stubEnv('WEBSITE_AI_RETRIES','1');vi.stubEnv('COMPETITOR_AI_DAILY_TOKENS','1000');
    try {const result=await callProvider('openai',{system:'fixture',user:'test',maxOutputTokens:700});expect(result.ok).toBe(true);const budget=await Budget.findOne().lean();expect(budget?.calls).toBe(1);expect(budget?.reservedTokens).toBe(2);}finally{vi.unstubAllEnvs();}
  });
  it('retains the failed-attempt allowance when a retry succeeds',async()=>{
    vi.stubEnv('WEBSITE_AI_DAILY_CALLS','5');vi.stubEnv('COMPETITOR_AI_DAILY_TOKENS','1000');
    try {const result=await callProvider('openai',{system:'retry-fixture',user:'test',maxOutputTokens:100});expect(result.ok).toBe(true);const budget=await Budget.findOne().lean();expect(budget?.calls).toBe(2);expect(budget?.reservedTokens).toBe(107);}finally{vi.unstubAllEnvs();}
  });
  it('recovers a killed isolated worker and retains partial evidence when AI is disabled',async()=>{
    let reached!:()=>void;const firstPage=new Promise<void>(resolve=>{reached=resolve;});let blockFirst=true;
    const fixture=createServer((req,res)=>{
      if(req.url!=='/'){res.writeHead(404);res.end();return;}
      if(req.headers.host?.startsWith('bad.')){res.writeHead(503);res.end();return;}
      if(blockFirst){blockFirst=false;reached();return;}
      res.setHeader('Content-Type','text/html');res.end('<html lang="en"><head><title>Offline Expo</title><meta name="description" content="Offline exhibition fixture"></head><body><h1>Offline Expo</h1><p>'+ 'Organic exhibition information. '.repeat(100)+'</p><a href="/exhibitor-registration">Book exhibitor stand</a></body></html>');
    });
    await new Promise<void>(resolve=>fixture.listen(0,'127.0.0.1',resolve));
    const port=(fixture.address() as AddressInfo).port;
    try{
      const s=await service.create(actor,{own:`http://own.fixture.test:${port}`,competitors:[`http://rival.fixture.test:${port}`,`http://bad.fixture.test:${port}`]});
      await Study.updateOne({_id:s.id},{$set:{profile:'expo-v1'}});await service.run(actor,s.id);
      const run=(await claimRun('subprocess'))!;
      const launch=(claim:typeof run,owner:string)=>spawn(process.execPath,['--import','tsx',resolve('src/modules/competitor-analyzer/worker-child.ts'),claim._id,owner,String(claim.fence)],{cwd:process.cwd(),env:{...process.env,MONGODB_URI:mongo.getUri(),NODE_ENV:'test',COMPETITOR_TEST_HTTP_PORT:String(port),WEBSITE_AI_MODE:'disabled',COMPETITOR_SEARCH_CONSOLE_PROPERTY:'',COMPETITOR_META_ACCESS_TOKEN:'',GOOGLE_KNOWLEDGE_GRAPH_API_KEY:'',PAGESPEED_API_KEY:'',OPENAI_API_KEY:'',GEMINI_API_KEY:''},stdio:'pipe'});
      const interrupted=launch(run,'subprocess');const interruptedExit=new Promise(resolve=>interrupted.once('exit',resolve));
      const startupDeadline=setTimeout(()=>interrupted.kill('SIGKILL'),15_000);
      await Promise.race([firstPage,interruptedExit.then(()=>{throw new Error('Worker exited before reaching the fixture');})]);clearTimeout(startupDeadline);interrupted.kill('SIGKILL');await interruptedExit;
      expect((await Run.findById(run._id))?.status).toBe('running');
      await Run.updateOne({_id:run._id},{$set:{leaseUntil:new Date(Date.now()-1000)}});
      const recovered=(await claimRun('restarted-subprocess'))!;expect(recovered._id).toBe(run._id);expect(recovered.fence).toBe(run.fence!+1);
      const child=launch(recovered,'restarted-subprocess');
      let stderr='';child.stderr?.on('data',b=>stderr+=String(b));
      const deadline=setTimeout(()=>child.kill('SIGKILL'),30_000);
      const exit=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});clearTimeout(deadline);
      expect(exit,stderr).toBe(0);
      const done=await Run.findById(run._id).lean();expect(done?.status).toBe('completed');expect(done?.sites?.filter((s:any)=>s.reachable)).toHaveLength(2);expect(done?.sites?.filter((s:any)=>!s.reachable)).toHaveLength(1);expect(done?.ai.status).toBe('unavailable');expect(done?.profileResults.version).toBe('expo-v1');
      await settleRun(run._id,'restarted-subprocess',recovered.fence!);expect((await Run.findById(run._id))?.job).toBe('done');
    }finally{await new Promise<void>(resolve=>fixture.close(()=>resolve()));}
  },45_000);
  it('deduplicates concurrent starts and claims exactly once',async()=>{
    const s=await study();const snapshot=await new AnalyzerRepository().competitorStudy.findUnique({where:{id:s.id}});
    const starts=await Promise.all(Array.from({length:12},()=>enqueueRun(actor.companyId,snapshot!,'manual')));
    expect(new Set(starts.map(r=>r.run.id)).size).toBe(1);expect(starts.filter(r=>!r.reused)).toHaveLength(1);
    const claims=await Promise.all(Array.from({length:10},(_,i)=>claimRun(`worker-${i}`)));
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it('recovers expired leases and fences the previous worker from committing',async()=>{
    const s=await study();await service.run(actor,s.id);const first=(await claimRun('old'))!;
    await Run.updateOne({_id:first._id},{$set:{leaseUntil:new Date(Date.now()-1000)}});
    const second=(await claimRun('new'))!;expect(second._id).toBe(first._id);expect(second.fence).toBe(first.fence!+1);
    const stale=new AnalyzerRepository({id:first._id,owner:'old',fence:first.fence!});
    expect((await stale.competitorStudyRun.updateMany({where:{id:first._id,status:'running'},data:{status:'completed'}})).count).toBe(0);
    expect(await renewLease(first._id,'old',first.fence!)).toBe(false);
    expect(await renewLease(second._id,'new',second.fence!)).toBe(true);
  });
  it('keeps cancellation terminal and permits a new run',async()=>{
    const s=await study();const started=await service.run(actor,s.id);const claimed=(await claimRun('worker'))!;
    await service.stopRun(actor,s.id,started.run.id);expect(await renewLease(claimed._id,'worker',claimed.fence!)).toBe(false);
    await settleRun(claimed._id,'worker',claimed.fence!,'interrupted');expect((await Run.findById(claimed._id))?.status).toBe('cancelled');
    expect((await service.run(actor,s.id)).run.id).not.toBe(started.run.id);
  });
  it('retries with backoff and releases exhausted jobs',async()=>{
    const s=await study();await service.run(actor,s.id);const run=(await claimRun('worker'))!;
    await settleRun(run._id,'worker',run.fence!,'temporary failure');
    expect(await claimRun('next')).toBeNull();
    await Run.updateOne({_id:run._id},{$set:{availableAt:new Date(Date.now()-1000)}});
    const next=(await claimRun('next'))!;expect(next.attempts).toBe(2);
    await Run.updateOne({_id:run._id},{$set:{attempts:3,leaseUntil:new Date(Date.now()-1000)}});
    expect(await claimRun('last')).toBeNull();expect((await Run.findById(run._id))?.status).toBe('failed');
  });
  it('never expires a healthy run when an API reader polls',async()=>{
    const s=await study();const run=await service.run(actor,s.id);await Run.updateOne({_id:run.run.id},{$set:{startedAt:new Date(Date.now()-3600_000)}});
    expect((await service.detail(actor,s.id)).latestRun?.status).toBe('running');
  });
  it('keeps schedules off unless configured and does not enqueue unscheduled rows',async()=>{
    const s=await study();expect(await service.runDueChecks()).toBe(0);
    await service.updateSettings(actor,s.id,{schedule:'weekly'});await Study.updateOne({_id:s.id},{$set:{nextCheckAt:new Date(Date.now()-1000)}});
    await Promise.all([service.runDueChecks(),service.runDueChecks()]);expect(await Run.countDocuments({studyId:s.id})).toBe(1);
  });
  it('persists monthly deliveries before advancing dates, deduplicates and retries failures',async()=>{
    const s=await study();await service.updateSettings(actor,s.id,{reportMonthly:true,reportEmails:['reader@example.test']});
    await Study.updateOne({_id:s.id},{$set:{nextReportAt:new Date(Date.now()-1000)}});
    await Promise.all([enqueueDueReports(),enqueueDueReports()]);expect(await Delivery.countDocuments()).toBe(1);
    await processDelivery('mail',async()=>{throw new Error('SMTP unavailable');});
    const retry=await Delivery.findOne().lean();expect(retry?.status).toBe('queued');expect(retry?.lastError).toBe('SMTP unavailable');
    await Delivery.updateOne({_id:retry!._id},{$set:{availableAt:new Date(Date.now()-1000)}});
    const send=vi.fn(async()=>{});await processDelivery('restarted-mail',send);expect(send).toHaveBeenCalledTimes(1);expect((await Delivery.findOne())?.status).toBe('sent');
  });
});
describe('Organic HTTP contracts and security',()=>{
  it('refreshes RBAC from the database even for an old superadmin token',async()=>{
    const viewerId=(jwt.decode(viewToken) as {id:string}).id;
    const stale=jwt.sign({id:viewerId,role:'superadmin'},'analyzer-test-access');
    expect((await call('/competitor-analyzer/studies','POST',input,stale)).status).toBe(403);
    expect((await call('/competitor-analyzer/capabilities','GET',undefined,viewToken)).body.data.manage).toBe(false);
    await Admin.updateOne({_id:viewerId},{$set:{isActive:false}});
    try{expect((await call('/competitor-analyzer/studies','GET',undefined,viewToken)).status).toBe(403);}
    finally{await Admin.updateOne({_id:viewerId},{$set:{isActive:true}});}
  });
  it('persists action tasks once and synchronises their progress with the study',async()=>{
    const s=await study();
    const first=await call(`/competitor-analyzer/studies/${s.id}/actions/task`,'POST',{action:'Review registration journey',priority:'high',dueDate:'2026-11-01'});
    expect(first.status).toBe(201);expect(first.body.data.created).toBe(true);
    const second=await call(`/competitor-analyzer/studies/${s.id}/actions/task`,'POST',{action:'Review registration journey'});
    expect(second.body.data.taskId).toBe(first.body.data.taskId);expect(second.body.data.created).toBe(false);
    expect(await Task.countDocuments()).toBe(1);
    expect((await call(`/competitor-analyzer/tasks/${first.body.data.taskId}`,'PATCH',{status:'done'})).status).toBe(200);
    const detail=await service.detail(actor,s.id);expect(Object.values(detail.actions)[0]?.status).toBe('done');
  });
  it('requires authentication and differentiates read/manage roles',async()=>{
    expect((await call('/competitor-analyzer/studies','GET',undefined,'')).status).toBe(401);
    expect((await call('/competitor-analyzer/studies','GET',undefined,viewToken)).status).toBe(200);
    expect((await call('/competitor-analyzer/studies','POST',input,viewToken)).status).toBe(403);
    const result=await call('/competitor-analyzer/studies','POST',input);expect(result.status).toBe(201);expect(result.body.data.id).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('rejects unknown fields, bad IDs and invalid settings',async()=>{
    expect((await call('/competitor-analyzer/studies','POST',{...input,companyId:'attacker'})).status).toBe(400);
    expect((await call('/competitor-analyzer/studies/not-an-id')).status).toBe(400);
    const s=await study();expect((await call(`/competitor-analyzer/studies/${s.id}/settings`,'PATCH',{schedule:'daily'})).status).toBe(400);
    expect((await call('/competitor-analyzer/studies','POST',{own:'http://127.0.0.1',competitors:['rival.example']})).status).toBe(400);
  });
  it('cannot read foreign organisation records',async()=>{
    const foreign=await Study.create({companyId:'foreign',name:'Private',sites:[]});
    expect((await call(`/competitor-analyzer/studies/${foreign._id}`)).status).toBe(404);
  });
  it('creates, expires and revokes public shares and strips private report fields',async()=>{
    const s=await study();const snapshot=await new AnalyzerRepository().competitorStudy.findUnique({where:{id:s.id}});
    await Run.create({companyId:actor.companyId,studyId:s.id,snapshot,status:'completed',job:'done',finishedAt:new Date(),sites:[{domain:'own.example',role:'own',pages:[],search:{secret:'private-search'}}],ai:null});
    const made=await call(`/competitor-analyzer/studies/${s.id}/shares`,'POST',{days:7});expect(made.status).toBe(201);
    const token=made.body.data.token;const shared=await call(`/public/competitor-reports/${token}`,'GET',undefined,'');
    expect(shared.status).toBe(200);expect(JSON.stringify(shared.body)).not.toContain('private-search');expect(shared.body.data.study.actions).toEqual({});
    expect(shared.body.data.study.report.costUsd).toBeNull();
    await call(`/competitor-analyzer/studies/${s.id}/shares/${made.body.data.id}`,'DELETE');expect((await call(`/public/competitor-reports/${token}`,'GET',undefined,'')).status).toBe(410);
    const expired=await Share.create({companyId:actor.companyId,studyId:s.id,token:randomUUID().replace(/-/g,''),expiresAt:new Date(Date.now()-1000)});
    expect((await call(`/public/competitor-reports/${expired.token}`,'GET',undefined,'')).status).toBe(410);
  });
});
