import mongoose, { Schema } from 'mongoose';
import { callProvider as originalCall, type ProviderRequest, type ProviderResult } from '../website-intelligence/ai/website-ai.providers';
import { aiLimits, costMicros, estimateTokens, modelFor, type ProviderId } from '../website-intelligence/ai/website-ai.config';
import { ORGANISATION_ID } from './adapters';

export const Budget = mongoose.model('AnalyzerAiBudget', new Schema({
  _id: String, reservedMicros: { type: Number, default: 0 }, reservedTokens: { type: Number, default: 0 },
  calls: { type: Number, default: 0 }, expiresAt: Date,
}, { versionKey: false }).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }));
/** Reserve each real attempt atomically. Failed/unknown attempts retain their reservation. */
export async function callProvider(provider: ProviderId, request: ProviderRequest): Promise<ProviderResult> {
  const model = request.model ?? modelFor(provider);
  const tokens = estimateTokens(request.system + request.user) + request.maxOutputTokens;
  const micros = Math.max(1, costMicros(model, estimateTokens(request.system + request.user), request.maxOutputTokens).micros);
  const key = `${ORGANISATION_ID}:${new Date().toISOString().slice(0, 10)}`;
  const maxTokens = Math.max(1000, Number(process.env.COMPETITOR_AI_DAILY_TOKENS) || 250_000);
  const failure: ProviderResult = { ok: false, provider, model, code: 'rate_limited', message: 'The daily AI reservation budget is exhausted. Measured evidence remains available.', retryable: false, httpStatus: 429 };
  if (tokens > maxTokens || micros > aiLimits.dailyBudgetMicros()) return failure;
  // Upsert only the empty bucket; budget-conditioned upserts would race on the unique key.
  try { await Budget.updateOne({ _id: key }, { $setOnInsert: { reservedMicros: 0, reservedTokens: 0, calls: 0, expiresAt: new Date(Date.now()+3*86400_000) } }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  let dispatched=0;
  const result=await originalCall(provider,{...request,beforeAttempt:async()=>{
    const reserved = await Budget.updateOne({ _id: key, reservedMicros: { $lte: aiLimits.dailyBudgetMicros() - micros }, reservedTokens: { $lte: maxTokens - tokens }, calls: { $lt: aiLimits.dailyCalls() } }, {
      $inc: { reservedMicros: micros, reservedTokens: tokens, calls: 1 },
    });
    if(!reserved.modifiedCount)return failure;
    dispatched++;
    return undefined;
  }});
  if(result.ok&&dispatched&&result.usage.inputTokens!=null&&result.usage.outputTokens!=null){
    // Release unused allowance for the successful attempt only. Retain every failed attempt.
    const usedTokens=result.usage.inputTokens+result.usage.outputTokens;
    const usedMicros=costMicros(result.model,result.usage.inputTokens,result.usage.outputTokens,result.usage.cachedInputTokens??0).micros;
    await Budget.updateOne({_id:key},{$inc:{reservedTokens:-Math.max(0,tokens-usedTokens),reservedMicros:-Math.max(0,micros-usedMicros)}});
  }
  return result;
}
