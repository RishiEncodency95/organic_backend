import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { readSettings, nextReportAt } from './analyzer-tracking';
import { Study } from './models';
import { withDeliveryContext } from './delivery-context';

export const Delivery = mongoose.model('AnalyzerDelivery',new Schema({
  _id:{type:String,default:()=>randomUUID()}, key:{type:String,unique:true,required:true}, companyId:String,studyId:String,
  recipients:[String], status:{type:String,enum:['queued','leased','sent','dead'],default:'queued'}, availableAt:{type:Date,default:Date.now},
  owner:String,leaseUntil:Date,attempts:{type:Number,default:0},lastError:String,sentAt:Date,
},{timestamps:true,versionKey:false}).index({status:1,availableAt:1,leaseUntil:1}).index({createdAt:1},{expireAfterSeconds:365*86400}));
export async function enqueueDueReports(limit=3) {
  const now=new Date();
  const due=await Study.find({archivedAt:null,nextReportAt:{$ne:null,$lte:now}}).sort({nextReportAt:1}).limit(limit).lean();
  let queued=0;
  for(const study of due) {
    const settings=readSettings(study.settings);
    if(!settings.reportMonthly || !settings.reportEmails.length) continue;
    const key=`${study._id}:${study.nextReportAt!.toISOString()}`;
    try {
      await Delivery.updateOne({key},{$setOnInsert:{key,companyId:study.companyId,studyId:study._id,recipients:settings.reportEmails}},{upsert:true});
    } catch(error) {if((error as {code?:number}).code!==11000)throw error;}
    // Advance only after the delivery is durably persisted. A crash here safely repeats the same unique key.
    await Study.updateOne({_id:study._id,nextReportAt:study.nextReportAt},{$set:{nextReportAt:nextReportAt(now)}});queued++;
  }
  return queued;
}
export async function processDelivery(owner:string,send:(companyId:string,studyId:string,to:string[])=>Promise<unknown>) {
  const now=new Date();
  await Delivery.updateMany({status:'leased',leaseUntil:{$lte:now},attempts:{$gte:3}},{$set:{status:'dead',lastError:'Delivery worker stopped repeatedly.'}});
  const delivery=await Delivery.findOneAndUpdate({attempts:{$lt:3},$or:[{status:'queued',availableAt:{$lte:now}},{status:'leased',leaseUntil:{$lte:now}}]},
    {$set:{status:'leased',owner,leaseUntil:new Date(Date.now()+10*60_000)},$inc:{attempts:1}},{returnDocument:'after',sort:{availableAt:1}}).lean();
  if(!delivery)return false;
  const filter={_id:delivery._id,owner,status:'leased' as const,attempts:delivery.attempts};
  const heartbeat=setInterval(()=>{
    Delivery.updateOne({...filter,leaseUntil:{$gt:new Date()}},{$set:{leaseUntil:new Date(Date.now()+10*60_000)}}).catch(()=>undefined);
  },15_000);
  try {
    const study=await Study.findOne({_id:delivery.studyId,companyId:delivery.companyId,archivedAt:null}).lean();
    if(!study || !readSettings(study.settings).reportMonthly)throw new Error('Scheduled report was disabled or archived.');
    await withDeliveryContext(delivery.key,()=>send(delivery.companyId!,delivery.studyId!,delivery.recipients));
    await Delivery.updateOne(filter,{$set:{status:'sent',sentAt:new Date()}});
  }catch(error){await Delivery.updateOne(filter,{$set:{status:delivery.attempts!>=3?'dead':'queued',availableAt:new Date(Date.now()+60_000*2**delivery.attempts!),lastError:(error instanceof Error?error.message:'Delivery failed').slice(0,500)}});}
  finally{clearInterval(heartbeat);}
  return true;
}
