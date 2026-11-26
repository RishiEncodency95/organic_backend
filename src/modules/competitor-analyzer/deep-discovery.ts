import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { Run } from './models';
import { BadRequestException, ServiceUnavailableException } from './errors';
import { normalizeSite, siteName } from './analyzer-evidence';
import { nameMatchesSite, isIgnoredHost, validateSuggest, type SuggestScope } from './analyzer-suggest';
import { safeFetch, type SafeFetchDeps } from '../website-intelligence/safe-fetch';
import { visibleText } from '../website-intelligence/competitor-ai';
import { searchEntities, knowledgeGraphApiKey } from '../website-intelligence/website-brand';
import { callProvider } from './budget-provider';
import { aiLimits,providerKey,estimateTokens,costMicros } from '../website-intelligence/ai/website-ai.config';
import { mapLimited } from './industry-settings';
import { INDUSTRY_SEGMENTS, publicObservations } from './business-intelligence';

export const DEEP_DISCOVERY_VERSION='expo-discovery-1';
const POOL=16,MAX_HTTP=50;
export interface DiscoverySnapshot {kind:'discovery';own:string;scope:SuggestScope;place:string;profile:string}
export interface DiscoveryEvidence {url:string;quote:string;observedAt:string;kind:'fact'|'website_claim';criterion:string}
export interface VerifiedSuggestion {name:string;domain:string;url:string;siteName:string|null;why:string;source:'ai'|'knowledge_graph'|'web_search';classification:'direct'|'adjacent';relevanceScore:number;verifiedAt:string;
  verification:{officialDomain:'matched_site_brand';geography:'observed';eventVenue:'observed'|'not_observed';businessModel:'exhibition'|'adjacent_b2b';eventActivity:'current_or_upcoming'|'past_only'|'not_observed';audience:'observed_subject_overlap'};evidence:DiscoveryEvidence[];warnings:string[]}
export interface DeepDiscoveryResult {status:'queued'|'running'|'completed'|'failed';runId:string;business:{what:string;where:string|null};scope:SuggestScope;place:string;area:string|null;suggestions:VerifiedSuggestion[];dropped:number;cached:boolean;at:string;message?:string;methodology:{version:string;candidatePool:number;verifiedCandidates:number;maxSuggestions:8;httpRequests:number;maxHttpRequests:50;source:string}}
const initial=(id:string,snapshot:DiscoverySnapshot,status:DeepDiscoveryResult['status']):DeepDiscoveryResult=>({status,runId:id,business:{what:'',where:null},scope:snapshot.scope,place:snapshot.place,area:snapshot.place,suggestions:[],dropped:0,cached:false,at:new Date().toISOString(),methodology:{version:DEEP_DISCOVERY_VERSION,candidatePool:0,verifiedCandidates:0,maxSuggestions:8,httpRequests:0,maxHttpRequests:50,source:'Public page verification'}});
export async function enqueueDiscovery(companyId:string,url:string,scope:SuggestScope,place:string,profile:string):Promise<DeepDiscoveryResult>{
  const own=normalizeSite(url);if(!own)throw new BadRequestException('Enter a public website address.');
  const requested=place.trim().slice(0,120);if(!requested)throw new BadRequestException('Enter the city, state or country to search. Geography is never guessed.');
  const snapshot:DiscoverySnapshot={kind:'discovery',own:own.url,scope,place:requested,profile};
  const key=`discovery:${createHash('sha256').update(JSON.stringify({...snapshot,own:own.domain,place:requested.toLowerCase().replace(/\s+/g,' '),version:DEEP_DISCOVERY_VERSION})).digest('hex')}`;
  const recent=await Run.findOne({companyId,studyId:key,startedAt:{$gte:new Date(Date.now()-7*86400_000)}}).sort({startedAt:-1}).lean();
  if(recent){
    if(recent.status==='completed'&&recent.discoveryResult)return {...recent.discoveryResult,cached:true};
    if(recent.status==='running')return initial(recent._id,snapshot,recent.job==='queued'?'queued':'running');
    if(recent.status==='failed'||recent.status==='cancelled')return {...initial(recent._id,snapshot,'failed'),message:recent.errorMessage??'Discovery was stopped. Retry when ready.'};
  }
  await Run.init();
  try{const run=await Run.create({companyId,studyId:key,snapshot,status:'running',stage:'queued',job:'queued'});return initial(run._id,snapshot,'queued');}
  catch(error){if((error as {code?:number}).code!==11000)throw error;const run=await Run.findOne({companyId,studyId:key,status:'running'}).lean();if(!run)throw error;return initial(run._id,snapshot,'queued');}
}
function allowedByRobots(robots:string,url:URL){
  let applicable=false,hasRules=false;const rules:{allow:boolean;path:string}[]=[];
  for(const raw of robots.split(/\r?\n/)){const line=raw.split('#')[0]!.trim();const colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
    if(key==='user-agent'){if(hasRules){applicable=false;hasRules=false;}applicable=applicable||value==='*'||/organiccompetitor/i.test(value);continue;}
    if((key==='allow'||key==='disallow')&&applicable&&value){hasRules=true;const path=value.replace(/\*.*$/,'').replace(/\$$/,'');if(path&&url.pathname.startsWith(path))rules.push({allow:key==='allow',path});}
  }
  return rules.sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow))[0]?.allow??true;
}
const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function geographicEvidence(html:string,text:string,place:string):string|null{
  const target=place.split(',')[0]!.trim();if(!target)return null;
  const regex=new RegExp(`\\b${escaped(target).replace(/\s+/g,'\\s+')}\\b`,'i'),match=regex.exec(text);
  if(match)return text.slice(Math.max(0,match.index-70),Math.min(text.length,match.index+target.length+100));
  const $=load(html);let found:string|null=null;
  $('script[type="application/ld+json"]').slice(0,10).each((_,element)=>{
    try{const value=JSON.parse($(element).text());let visited=0;const walk=(node:any,depth=0)=>{if(!node||typeof node!=='object'||depth>7||visited++>100||found)return;
      for(const [key,item]of Object.entries(node)){if(['addressLocality','addressRegion','addressCountry'].includes(key)&&typeof item==='string'){
        let normalized=item;if(key==='addressCountry'&&/^[A-Z]{2}$/.test(item)){try{normalized=new Intl.DisplayNames(['en'],{type:'region'}).of(item)??item;}catch{}}
        if(regex.test(normalized))found=`${key}: ${item}`;
      }else if(item&&typeof item==='object')walk(item,depth+1);}};walk(value);}catch{}
  });return found;
}
async function searchPool(query:string):Promise<{name:string;website:string;why:string}[]>{
  const key=process.env.COMPETITOR_SEARCH_API_KEY||process.env.GOOGLE_SEARCH_API_KEY,cx=process.env.COMPETITOR_SEARCH_ENGINE_ID||process.env.GOOGLE_SEARCH_ENGINE_ID;
  if(!key||!cx)return [];
  const url=new URL('https://www.googleapis.com/customsearch/v1');url.search=new URLSearchParams({key,cx,q:query,num:'10'}).toString();
  try{const response=await fetch(url,{signal:AbortSignal.timeout(12_000)});if(!response.ok)return [];const body=await response.json() as {items?:{title?:string;link?:string;snippet?:string}[]};return (body.items??[]).flatMap(item=>item.link?[{name:(item.title??'').split(/[|–]/)[0]!.trim().slice(0,120),website:item.link,why:(item.snippet??'').slice(0,200)}]:[]);}catch{return [];}
}
export async function performDeepDiscovery(snapshot:DiscoverySnapshot,baseDeps:SafeFetchDeps,control:{stage:(stage:string)=>Promise<boolean>;usage:(usage:{model:string;inputTokens:number;outputTokens:number;costMicros:number})=>Promise<void>}):Promise<DeepDiscoveryResult>{
  let httpRequests=0;const deps={...baseDeps,onRequest:()=>{baseDeps.onRequest?.();if(httpRequests>=MAX_HTTP)throw new Error('Discovery crawl budget exhausted.');httpRequests++;}};
  const own=normalizeSite(snapshot.own)!;
  const home=await safeFetch(own.url,{timeoutMs:6000,maxBytes:800_000},deps);
  if(!home.ok)throw new BadRequestException('The primary website could not be read.');
  const ownText=visibleText(home.body).slice(0,12000);
  if(!await control.stage('discovering'))throw new Error('Discovery stopped.');
  const query=`organic herbal natural products exhibition trade fair ${snapshot.place}`;
  const web=await searchPool(query);
  let proposed:{name:string;website:string|null;why:string}[]=[];let source='Configured web search and public-page verification';
  if(aiLimits.defaultMode()!=='disabled'&&providerKey('openai')){
    const system=`Find up to 24 real exhibition competitors for the supplied website. Search the actual requested geographic scope: city means that city, state means its whole state, country means the entire country, not just the primary site's city. Prefer organic, herbal, natural products, agriculture and sustainability trade exhibitions with exhibitor and buyer programmes. Include a smaller group of adjacent trade events. Never invent a business or domain to fill slots. Do not claim private metrics. Return JSON {"business":{"what":"...","where":"..."},"area":"...","competitors":[{"name":"official event name","website":"official domain or null","why":"relevance and location"}]}. Candidate names will be independently checked against their pages; your claims are not accepted as evidence.`;
    const user=`Primary website: ${own.domain}\nScope: ${snapshot.scope}\nRequested area: ${snapshot.place}\nPublic website text:\n${ownText.slice(0,6000)}`;
    const response=await callProvider('openai',{system,user,maxOutputTokens:5000,timeoutMs:60_000});
    if(response.ok){const tokens=response.usage.inputTokens??estimateTokens(system+user),output=response.usage.outputTokens??estimateTokens(response.text);await control.usage({model:response.model,inputTokens:tokens,outputTokens:output,costMicros:costMicros(response.model,tokens,output,response.usage.cachedInputTokens??0).micros});proposed=validateSuggest(response.text,own.domain,24)?.candidates??[];source=web.length?'Web search + AI-named candidate pool; public-page verification':'AI-named candidate pool; public-page verification';}
  }
  const candidates=[...web,...proposed].filter((candidate,index,items)=>candidate.name&&items.findIndex(item=>item.name.toLowerCase()===candidate.name.toLowerCase())===index).slice(0,POOL);
  if(!candidates.length)throw new ServiceUnavailableException('Discovery needs a configured search provider or AI. No competitors were invented.');
  if(!await control.stage('verifying'))throw new Error('Discovery stopped.');
  const checked=await mapLimited(candidates,3,async(candidate):Promise<VerifiedSuggestion|null>=>{
    let site=candidate.website?normalizeSite(candidate.website):null;let resolvedBy:VerifiedSuggestion['source']=web.some(item=>item.website===candidate.website)?'web_search':'ai';
    if(!site){const entities=await searchEntities(candidate.name,{apiKey:knowledgeGraphApiKey()}).catch(()=>null);const entity=entities?.ok?entities.entities.find(item=>item.url&&nameMatchesSite(candidate.name,normalizeSite(item.url)?.domain??'',item.name)):null;site=entity?.url?normalizeSite(entity.url):null;resolvedBy='knowledge_graph';}
    if(!site||site.domain===own.domain||isIgnoredHost(site.domain))return null;
    try{
      const robots=await safeFetch(new URL('/robots.txt',site.url),{timeoutMs:4000,maxBytes:80_000},deps).catch(()=>null);
      const robotsText=robots?.ok?robots.body:'';if(!allowedByRobots(robotsText,new URL(site.url)))return null;
      const response=await safeFetch(site.url,{timeoutMs:5000,maxBytes:800_000},deps);if(!response.ok||normalizeSite(response.url)?.domain!==site.domain)return null;
      const $=load(response.body),officialName=siteName(response.body,$('title').text());if(!nameMatchesSite(candidate.name,site.domain,officialName))return null;
      const pages=[{url:response.url,html:response.body}];
      // Two content pages plus robots = three requests per candidate; total verification stays inside 50 HTTP requests.
      const link=$('a[href]').toArray().map(node=>$(node).attr('href')!).find(href=>/venue|event|contact|about|exhibit|visit/i.test(href)&&!/^mailto:|^tel:|\.(?:pdf|jpg|png)$/i.test(href));
      if(link&&httpRequests<MAX_HTTP){const next=new URL(link,response.url);if(normalizeSite(next.href)?.domain===site.domain&&next.href!==response.url&&allowedByRobots(robotsText,next)){const detail=await safeFetch(next,{timeoutMs:4000,maxBytes:600_000},deps).catch(()=>null);if(detail?.ok&&normalizeSite(detail.url)?.domain===site.domain)pages.push({url:detail.url,html:detail.body});}}
      const at=new Date().toISOString(),observations=publicObservations(pages,at),all=observations.map(page=>page.text).join('\n');
      const venues=observations.flatMap(page=>page.events.flatMap(event=>event.venue?[{url:page.url,value:event.venue}]:[]));
      for(const page of observations){const venue=/(?:venue|held at|taking place at)\s*:?\s*.{5,180}/i.exec(page.text);if(venue)venues.push({url:page.url,value:venue[0]});}
      const venueInScope=venues.some(venue=>new RegExp(`\\b${escaped(snapshot.place.split(',')[0]!.trim())}\\b`,'i').test(venue.value));
      if(snapshot.scope!=='country'&&!venueInScope)return null;
      const geo=pages.map(page=>({page,quote:geographicEvidence(page.html,visibleText(page.html),snapshot.place)})).find(item=>item.quote);if(!geo)return null;
      const exhibition=/expo|exhibition|trade fair|trade show/i.test(all),audience=/exhibitor|trade visitor|buyer|b2b|business match|conference|delegate/i.test(all),industry=/organic|herbal|ayurved|natural product|sustainab|agricultur/i.test(all);
      if(!audience||(!exhibition&&!industry))return null;
      const ownSegments=INDUSTRY_SEGMENTS.filter(([,rule])=>rule.test(ownText)).map(([label])=>label),segments=INDUSTRY_SEGMENTS.filter(([,rule])=>rule.test(all)).map(([label])=>label);
      const dates=observations.flatMap(page=>page.events.flatMap(event=>event.startDate&&/^\d{4}-\d{2}-\d{2}/.test(event.startDate)?[Date.parse(event.startDate)]:[])).filter(Number.isFinite);
      const currentYear=new Date().getUTCFullYear(),currentText=new RegExp(`(?:expo|exhibition|edition|conference|fair)[^.!?]{0,65}(?:${currentYear}|${currentYear+1})|(?:${currentYear}|${currentYear+1})[^.!?]{0,65}(?:expo|exhibition|edition|conference|fair)`,'i').test(all);
      const activity=dates.some(date=>date>=Date.now()-180*86400_000)||currentText?'current_or_upcoming':dates.length?'past_only':'not_observed';
      const classification=exhibition&&industry?'direct':'adjacent';
      const evidence:DiscoveryEvidence[]=[{url:response.url,quote:officialName??$('title').text().slice(0,200),observedAt:at,kind:'website_claim',criterion:'Official site identity'},{url:geo.page.url,quote:geo.quote!,observedAt:at,kind:'website_claim',criterion:`${snapshot.scope} scope: ${snapshot.place}`}];
      for(const page of observations){const match=/(?:exhibitor|buyer|b2b|exhibition|organic|herbal|venue|conference).{0,150}/i.exec(page.text);if(match)evidence.push({url:page.url,quote:match[0],observedAt:at,kind:'website_claim',criterion:'Business model and audience subject overlap'});}
      return {name:candidate.name,domain:site.domain,url:response.url,siteName:officialName,why:`${classification==='direct'?'Exhibition with observed organic-industry positioning':'Adjacent event or B2B business'}; ${snapshot.place} was observed on its public pages.`,source:resolvedBy,classification,
        relevanceScore:(classification==='direct'?100:40)+segments.filter(segment=>ownSegments.includes(segment)).length*8+(activity==='current_or_upcoming'?15:activity==='past_only'?-15:0),verifiedAt:at,
        verification:{officialDomain:'matched_site_brand',geography:'observed',eventVenue:venues.length?'observed':'not_observed',businessModel:exhibition?'exhibition':'adjacent_b2b',eventActivity:activity,audience:'observed_subject_overlap'},evidence:[...evidence,...venues.slice(0,1).map(venue=>({url:venue.url,quote:venue.value,observedAt:at,kind:'website_claim' as const,criterion:'Published event venue'}))].slice(0,6),warnings:[...(venues.length?[]:['An event venue was not observed.']),...(activity==='current_or_upcoming'?[]:[activity==='past_only'?'Only past event dates were observed.':'Current or upcoming event activity was not observed.'])]};
    }catch{return null;}
  });
  const unique=new Map<string,VerifiedSuggestion>();for(const item of checked)if(item&&!unique.has(item.domain))unique.set(item.domain,item);
  const suggestions=[...unique.values()].sort((a,b)=>b.relevanceScore-a.relevanceScore).slice(0,8);
  return {...initial('',snapshot,'completed'),business:{what:'Exhibition and organic-industry public website comparison',where:snapshot.place},suggestions,dropped:candidates.length-suggestions.length,
    methodology:{version:DEEP_DISCOVERY_VERSION,candidatePool:candidates.length,verifiedCandidates:unique.size,maxSuggestions:8,httpRequests,maxHttpRequests:50,source}};
}
