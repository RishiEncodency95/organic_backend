import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import asyncHandler from '../../utils/asyncHandler';
import { CompetitorAnalyzerService } from './competitor-analyzer.service';
import { CompetitorShareService } from './competitor-share.service';
import { AnalyzerRepository } from './repository';
import { ORGANISATION_ID } from './adapters';
import { Client, Study, Task, Alert, Run, Suggestion } from './models';
import { Budget } from './budget-provider';
import { BUSINESS_PROFILES } from './profiles';
import { normalizeSite } from './analyzer-evidence';
import { HttpException } from './errors';
import { Admin } from '../../models/Admin.model';
import { Role } from '../../models/Role.model';
import * as v from './validation';
import { industrySettings,IndustrySettings,defaultProfileFor } from './industry-settings';
import { normalizeSite as normalizedSite } from './analyzer-evidence';

const repository = new AnalyzerRepository();
const analyzer = new CompetitorAnalyzerService(repository);
const shares = new CompetitorShareService(repository, analyzer);
const router = Router();
export const publicReportsRouter = Router();
const read = requirePermission('perm_analyzer_view', 'perm_analyzer_manage');
const manage = requirePermission('perm_analyzer_manage');
const actor = (req: Request) => ({ companyId: ORGANISATION_ID, userId: req.user!.id });
const id = (req: Request) => v.uuid(req.params.id);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, message: 'OK', data });
const pdf = (res: Response, file: { fileName: string; content: Buffer }) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file.fileName}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return res.send(file.content);
};
const lang = (req: Request) => v.parse((awaitlessLangSchema), req.query.lang ?? 'en');
import { z } from 'zod';
import { isValidObjectId } from 'mongoose';
const awaitlessLangSchema = z.enum(['en', 'hi']);

router.use(protect);
router.use(asyncHandler(async (req,_res,next) => {
  const admin = await Admin.findById(req.user!.id).select('isActive role').lean();
  if (!admin?.isActive) throw new HttpException('Your account is not active.',403);
  req.user!.role = admin.role;
  next();
}));
router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
router.use((_req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });
router.get('/capabilities', read, asyncHandler(async (req,res) => {
  const admin = await Admin.findById(req.user!.id).select('role roleId roleName isActive').lean();
  const role = (admin?.roleId && isValidObjectId(admin.roleId) ? await Role.findById(admin.roleId).lean() : null) ||
    (admin?.roleName ? await Role.findOne({name:admin.roleName}).lean() : null) || await Role.findOne({slug:'EXPO_ADMIN'}).lean();
  send(res,{read:true,manage:admin?.role === 'superadmin' || Boolean(role?.permissionIds?.includes('perm_analyzer_manage'))});
}));
router.get('/profiles', read, asyncHandler(async (_req,res) => send(res, BUSINESS_PROFILES.map(p=>({ id:p.id, label:p.label })))));
router.get('/industry-settings',read,asyncHandler(async(_req,res)=>send(res,await industrySettings())));
router.patch('/industry-settings',manage,asyncHandler(async(req,res)=>{
  const body=v.parse(v.industryPolicy,req.body);if(!normalizedSite(body.primaryWebsite))throw new HttpException('Enter a public primary website.',400);
  await IndustrySettings.updateOne({_id:ORGANISATION_ID},{$set:{...body,updatedBy:req.user!.id}},{upsert:true,runValidators:true});send(res,await industrySettings());
}));
router.post('/discovery/:runId/retry',manage,asyncHandler(async(req,res)=>{
  const run=await Run.findOne({_id:v.uuid(req.params.runId),companyId:ORGANISATION_ID,'snapshot.kind':'discovery'}).lean();if(!run)throw new HttpException('Discovery not found.',404);
  if(!['failed','cancelled'].includes(run.status))throw new HttpException('Only stopped or failed discoveries can be retried.',409);
  await Run.updateOne({_id:run._id,status:run.status},{$set:{status:'running',job:'queued',stage:'queued',attempts:0,availableAt:new Date(),finishedAt:null,errorMessage:null},$inc:{fence:1},$unset:{owner:1,leaseUntil:1,expiresAt:1}});
  send(res,{queued:true},202);
}));
router.post('/discovery/:runId/stop',manage,asyncHandler(async(req,res)=>{const result=await Run.updateOne({_id:v.uuid(req.params.runId),companyId:ORGANISATION_ID,status:'running','snapshot.kind':'discovery'},{$set:{status:'cancelled',job:'cancelled',finishedAt:new Date(),stage:null,errorMessage:'Discovery stopped.'}});send(res,{stopped:result.modifiedCount>0});}));
router.get('/usage', read, asyncHandler(async (_req,res) => {
  const since=new Date();since.setUTCHours(0,0,0,0);
  const [runs,suggestions,reservations]=await Promise.all([
    Run.aggregate([{$match:{companyId:ORGANISATION_ID,startedAt:{$gte:since}}},{$group:{_id:null,runs:{$sum:1},costMicros:{$sum:'$costMicros'},inputTokens:{$sum:'$inputTokens'},outputTokens:{$sum:'$outputTokens'}}}]),
    Suggestion.aggregate([{$match:{companyId:ORGANISATION_ID,createdAt:{$gte:since}}},{$group:{_id:null,costMicros:{$sum:'$costMicros'}}}]),
    Budget.findById(`${ORGANISATION_ID}:${since.toISOString().slice(0,10)}`).lean(),
  ]);
  send(res,{since,runs:runs[0]?.runs??0,estimatedCostUsd:((runs[0]?.costMicros??0)+(suggestions[0]?.costMicros??0))/1_000_000,inputTokens:runs[0]?.inputTokens??0,outputTokens:runs[0]?.outputTokens??0,
    reservations:{costUsd:(reservations?.reservedMicros??0)/1_000_000,tokens:reservations?.reservedTokens??0,calls:reservations?.calls??0},note:'Tokens are provider-reported where available, otherwise estimated. Costs use configured model prices. Reservations include worst-case retries and failed calls; these are not invoices.'});
}));
router.get('/clients', read, asyncHandler(async (_req,res) => send(res, await repository.client.findMany({ where:{ companyId:ORGANISATION_ID }, take:200 }))));
router.post('/clients', manage, asyncHandler(async (req,res) => {
  const body = v.parse(v.client,req.body), site=normalizeSite(body.website);
  if (!site) throw new HttpException('Invalid website.',400);
  send(res,await repository.client.create({ data:{ companyId:ORGANISATION_ID, name:body.name, website:site.url } }),201);
}));
router.get('/tasks', read, asyncHandler(async (_req,res) => send(res,await Task.find({companyId:ORGANISATION_ID}).sort({createdAt:-1}).limit(200).lean())));
router.patch('/tasks/:id', manage, asyncHandler(async (req,res) => {
  const body=v.parse(z.object({status:z.enum(['pending','doing','done'])}).strict(),req.body);
  const task=await Task.findOneAndUpdate({_id:v.uuid(req.params.id),companyId:ORGANISATION_ID},{$set:body},{returnDocument:'after'}).lean();
  if(!task) throw new HttpException('Task not found.',404);
  if(task.studyId && task.actionKey)await Study.updateOne({_id:task.studyId,companyId:ORGANISATION_ID},{$set:{
    [`actions.${task.actionKey}.status`]:body.status==='pending'?'todo':body.status,
    [`actions.${task.actionKey}.updatedAt`]:new Date().toISOString(),[`actions.${task.actionKey}.updatedBy`]:req.user!.id,
  }});
  send(res,task);
}));
router.get('/alerts', read, asyncHandler(async (req,res) => send(res,await Alert.find({companyId:ORGANISATION_ID,userId:req.user!.id}).sort({createdAt:-1}).limit(100).lean())));
router.patch('/alerts/:id', read, asyncHandler(async (req,res) => {
  const result=await Alert.updateOne({_id:v.uuid(req.params.id),companyId:ORGANISATION_ID,userId:req.user!.id},{$set:{readAt:new Date()}});
  send(res,{updated:result.modifiedCount});
}));
router.get('/studies', read, asyncHandler(async (req,res) => send(res,await analyzer.list(actor(req)))));
router.get('/lookup', read, asyncHandler(async (req,res) => send(res,await analyzer.lookup(actor(req),v.parse(v.lookupQuery,req.query).q))));
router.get('/site-name', manage, asyncHandler(async (req,res) => send(res,await analyzer.siteName(actor(req),v.parse(v.urlQuery,req.query).url))));
router.get('/location', manage, asyncHandler(async (req,res) => send(res,await analyzer.location(actor(req),v.parse(v.urlQuery,req.query).url))));
router.get('/suggest', manage, asyncHandler(async (req,res) => {
  const q=v.parse(v.suggestQuery,req.query);const result=await analyzer.suggest(actor(req),q.url,q.scope,q.place,q.profile);send(res,result,'status' in result&&['queued','running'].includes(result.status as string)?202:200);
}));
router.post('/studies', manage, asyncHandler(async (req,res) => {
  const body=v.parse(v.createStudy,req.body);
  const study=await analyzer.create(actor(req),body);
  const policy=await industrySettings();await Study.updateOne({_id:study.id,companyId:ORGANISATION_ID},{$set:{profile:body.profile??await defaultProfileFor(body.own),crawlBudget:body.crawlBudget??policy.crawlBudget}});
  send(res,await analyzer.detail(actor(req),study.id),201);
}));
router.get('/studies/:id',read,asyncHandler(async(req,res)=>send(res,await analyzer.detail(actor(req),id(req)))));
router.patch('/studies/:id',manage,asyncHandler(async(req,res)=>{
  const body=v.parse(v.updateStudy,req.body);
  await analyzer.update(actor(req),id(req),body);
  if(body.profile||body.crawlBudget) await Study.updateOne({_id:id(req),companyId:ORGANISATION_ID},{$set:{...(body.profile?{profile:body.profile}:{}),...(body.crawlBudget?{crawlBudget:body.crawlBudget}:{})}});
  send(res,await analyzer.detail(actor(req),id(req)));
}));
router.delete('/studies/:id',manage,asyncHandler(async(req,res)=>{ await analyzer.archive(actor(req),id(req)); res.status(204).end(); }));
router.post('/studies/:id/runs',manage,asyncHandler(async(req,res)=>send(res,await analyzer.run(actor(req),id(req)),202)));
router.get('/studies/:id/runs/:runId',read,asyncHandler(async(req,res)=>send(res,await analyzer.runStatus(actor(req),id(req),v.uuid(req.params.runId)))));
router.post('/studies/:id/runs/:runId/stop',manage,asyncHandler(async(req,res)=>send(res,await analyzer.stopRun(actor(req),id(req),v.uuid(req.params.runId)))));
router.get('/studies/:id/report',read,asyncHandler(async(req,res)=>pdf(res,await analyzer.reportPdf(actor(req),id(req),lang(req)))));
router.post('/studies/:id/report/email',manage,asyncHandler(async(req,res)=>send(res,await analyzer.emailReport(actor(req),id(req),v.parse(v.email,req.body).to))));
router.patch('/studies/:id/settings',manage,asyncHandler(async(req,res)=>send(res,await analyzer.updateSettings(actor(req),id(req),v.parse(v.settings,req.body)))));
router.patch('/studies/:id/actions',manage,asyncHandler(async(req,res)=>send(res,await analyzer.setActionStatus(actor(req),id(req),v.parse(v.action,req.body)))));
router.post('/studies/:id/actions/task',manage,asyncHandler(async(req,res)=>send(res,await analyzer.createActionTask(actor(req),id(req),v.parse(v.task,req.body)),201)));
router.get('/studies/:id/shares',read,asyncHandler(async(req,res)=>send(res,await shares.list(actor(req),id(req)))));
router.post('/studies/:id/shares',manage,asyncHandler(async(req,res)=>send(res,await shares.create(actor(req),id(req),v.parse(v.share,req.body)),201)));
router.delete('/studies/:id/shares/:shareId',manage,asyncHandler(async(req,res)=>send(res,await shares.revoke(actor(req),id(req),v.uuid(req.params.shareId)))));

publicReportsRouter.use(rateLimit({windowMs:60_000,limit:30,standardHeaders:true,legacyHeaders:false}));
publicReportsRouter.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});next();});
publicReportsRouter.get('/:token',asyncHandler(async(req,res)=>send(res,await shares.publicView(String(req.params.token)))));
publicReportsRouter.get('/:token/pdf',asyncHandler(async(req,res)=>pdf(res,await shares.publicPdf(String(req.params.token),lang(req)))));
function errors(error: unknown,_req:Request,res:Response,next:NextFunction) {
  if(error instanceof HttpException) { res.status(error.statusCode).json({success:false,message:error.message,reason:error.reason}); return; }
  next(error);
}
router.use(errors); publicReportsRouter.use(errors);
export default router;
