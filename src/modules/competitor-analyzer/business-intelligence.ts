import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { visibleText } from '../website-intelligence/competitor-ai';
import type { SiteEvidence } from './analyzer-evidence';
import type { AnalyzerResult } from './analyzer-ai';
import type { OffersBlock } from './analyzer-offers';

export interface PublicObservation {url:string;title:string;text:string;method:'static'|'rendered';observedAt:string;schemaTypes:string[];invalidSchemas:number;events:{name:string;startDate:string|null;endDate:string|null;venue:string|null;organizer:string|null}[]}
export interface BusinessFinding {id:string;label:string;quote:string;url:string;observedAt:string;kind:'fact'|'website_claim'|'ai_interpretation';confidence:'high'|'medium'|'low';method:string}
export interface BusinessSection {id:string;title:string;sites:{domain:string;status:'observed'|'not_observed'|'inaccessible';findings:BusinessFinding[];metrics:Record<string,unknown>;warnings:string[]}[]}
export interface BusinessIntelligence {
  version:'expo-organic-1';profileId:string;observedAt:string;summary:string;sections:BusinessSection[];
  swot:{strengths:BusinessFinding[];weaknesses:string[];opportunities:string[];threats:string[]};
  roadmap:{priority:'high'|'medium'|'low';action:string;reason:string;kind:'interpretation'|'ai_interpretation';evidence:BusinessFinding[]}[];
  changes:{domain:string;section:string;message:string;added:string[];notObserved:string[]}[];
  methodology:{scoringVersion:'media360-original';businessProfileVersion:'expo-organic-1';rule:string;budget:unknown;traffic:null;revenue:null;leads:null;conversionRate:null};
}
export const BUSINESS_SECTIONS=[
  {id:'overview',title:'Expo Competitive Overview',terms:/\b(expo|exhibition|trade fair|trade show|organis[ez]r|organis[ez]d by)\b/gi},
  {id:'exhibitors',title:'Exhibitor Intelligence',terms:/exhibitor|exhibit with|book (?:a )?(?:stall|stand)|stall booking|exhibition space|exhibitor benefit/gi},
  {id:'buyers',title:'Buyer and B2B Opportunities',terms:/\bbuyer|visitor registration|business match|buyer.seller|b2b|hosted buyer|trade visitor/gi},
  {id:'sponsors',title:'Sponsorship Intelligence',terms:/sponsor|partnership|partner with|media partner|knowledge partner/gi},
  {id:'events',title:'Event and Conference Comparison',terms:/conference|summit|edition|venue|event dates?|exhibition dates?|workshop|seminar|speaker/gi},
  {id:'industry',title:'Organic Industry Intelligence',terms:/organic|ayurved|herbal|natural product|sustainab|regenerative|certifi|gots|nopop|npop|usda|apeda|fssai/gi},
  {id:'digital',title:'SEO and Digital Marketing',terms:/newsletter|blog|news|press|download brochure|youtube|instagram|linkedin/gi},
  {id:'conversion',title:'Conversion Experience',terms:/register|registration|enquir|contact|book|apply|request a call|whatsapp/gi},
  {id:'trust',title:'Trust and Credibility',terms:/organis[ez]r|organis[ez]d by|association|accredit|certif|testimonial|supported by|official partner|government/gi},
  {id:'swot',title:'SWOT and Opportunity Gaps',terms:/\bnever-match-derived-section\b/gi},
  {id:'roadmap',title:'Priority Action Roadmap',terms:/\bnever-match-derived-section\b/gi},
  {id:'history',title:'Historical Changes',terms:/\bnever-match-derived-section\b/gi},
] as const;
export const INDUSTRY_SEGMENTS=[
  ['Organic food and beverages',/organic.{0,25}(?:food|beverage)|organic (?:tea|coffee|spice|grain)|millet/i],
  ['Herbal and Ayurveda',/herbal|ayurved|medicinal plant/i],['Natural beauty and wellness',/natural cosmetic|organic skincare|wellness|nutraceutical/i],
  ['Organic agriculture',/organic farm|agricultur|regenerative|bio.?fertili[sz]/i],['Sustainable packaging and textiles',/sustainable pack|eco.?pack|organic cotton|natural fibre|organic textile/i],
  ['Certification and exports',/certifi|apeda|export|usda|npop|gots/i],
] as const;
const COMPARISON_SIGNALS:Record<string,{label:string;terms:RegExp}[]>={
  exhibitors:[{label:'Exhibitor directory',terms:/exhibitor.{0,35}(?:list|directory)|(?:list|directory).{0,35}exhibitor/i},{label:'Stall pricing or package',terms:/stall.{0,45}(?:price|tariff|rate|cost)|(?:shell scheme|bare space)|(?:INR|Rs\.?|₹)\s*[\d,]+/i},{label:'Exhibitor audience and benefits',terms:/why exhibit|exhibitor benefit|meet.{0,25}buyer|exhibitor profile/i}],
  buyers:[{label:'Buyer registration',terms:/(?:buyer|visitor).{0,35}regist|regist.{0,35}(?:buyer|visitor)/i},{label:'Hosted buyer programme',terms:/hosted buyer|buyer programme|buyer program/i},{label:'Business matchmaking',terms:/matchmaking|buyer.seller|b2b meeting|business match/i}],
  sponsors:[{label:'Named sponsors or partners',terms:/title sponsor|gold sponsor|silver sponsor|platinum sponsor|media partner|knowledge partner|supported by/i},{label:'Sponsorship packages',terms:/sponsor.{0,45}(?:package|benefit|tier|brochure)|(?:package|tier).{0,45}sponsor/i}],
  events:[{label:'Event venue',terms:/venue|yashobhoomi|pragati maidan|convention cent|exhibition cent|trade cent/i},{label:'Conference programme',terms:/conference|seminar|workshop|summit|speaker/i}],
  trust:[{label:'Organizer identity',terms:/organi[sz]er|organi[sz]ed by|presented by/i},{label:'Past edition evidence',terms:/past edition|previous edition|post.event report|testimonial|past.{0,20}exhibition/i}],
};
export function publicObservations(pages:{url:string;html:string;method?:'static'|'rendered'}[],observedAt=new Date().toISOString()):PublicObservation[]{
  return pages.slice(0,10).map(page=>{
    const $=load(page.html),types=new Set<string>(),events:PublicObservation['events']=[];let invalidSchemas=0,nodes=0;
    const walk=(value:unknown,depth=0)=>{
      if(!value||typeof value!=='object'||depth>8||nodes++>150)return;
      if(Array.isArray(value)){value.slice(0,30).forEach(item=>walk(item,depth+1));return;}
      const item=value as Record<string,any>,type=Array.isArray(item['@type'])?item['@type']:[item['@type']];
      type.filter((v:unknown)=>typeof v==='string').forEach((v:string)=>types.add(v.slice(0,120)));
      if(type.some((v:unknown)=>typeof v==='string'&&/Event$/.test(v))&&events.length<10){
        const place=item.location;events.push({name:String(item.name??'Published event').slice(0,160),startDate:typeof item.startDate==='string'?item.startDate.slice(0,50):null,endDate:typeof item.endDate==='string'?item.endDate.slice(0,50):null,
          venue:typeof place==='string'?place.slice(0,200):place&&typeof place==='object'?[place.name,typeof place.address==='string'?place.address:place.address?.streetAddress,place.address?.addressLocality,place.address?.addressRegion,place.address?.addressCountry].filter(Boolean).join(', ').slice(0,300):null,
          organizer:typeof item.organizer==='string'?item.organizer.slice(0,160):item.organizer?.name?String(item.organizer.name).slice(0,160):null});
      }
      Object.values(item).forEach(child=>walk(child,depth+1));
    };
    $('script[type="application/ld+json"]').slice(0,15).each((_,element)=>{try{walk(JSON.parse($(element).text()));}catch{invalidSchemas++;}});
    const title=$('title').text().slice(0,200);
    // Repeated menus, login dialogs and country options are not business findings.
    $('script,style,noscript,svg,template,head,nav,header,footer,[role="navigation"],[role="dialog"],select').remove();
    const main=$('main,[role="main"]').first();
    const content=main.length&&visibleText(main.html()??'').length>120?main.html():$('body').html()??$.html();
    return {url:page.url,title,text:visibleText(content??'').slice(0,24000),method:page.method??'static',observedAt,schemaTypes:[...types].slice(0,30),invalidSchemas,events};
  });
}
function finding(section:string,page:PublicObservation,label:string,quote:string,kind:BusinessFinding['kind']='website_claim'):BusinessFinding{
  return {id:createHash('sha256').update(`${section}|${page.url}|${quote}`).digest('hex').slice(0,20),label,quote:quote.slice(0,260),url:page.url,observedAt:page.observedAt,kind,confidence:kind==='fact'?'high':'medium',method:page.method};
}
function excerpts(page:PublicObservation,terms:RegExp){
  const pattern=new RegExp(terms.source,'gi'),quotes:string[]=[];let match:RegExpExecArray|null;
  let previousEnd=-1;
  while((match=pattern.exec(page.text))&&quotes.length<3){if(match.index<previousEnd)continue;const start=Math.max(0,match.index-65),end=Math.min(page.text.length,match.index+160);const quote=page.text.slice(start,end).trim();if(quote.length>35&&!quotes.includes(quote)){quotes.push(quote);previousEnd=end;}if(!match[0])break;}
  return quotes;
}
export function buildBusinessIntelligence(input:{profileId:string;sites:SiteEvidence[];analysis:AnalyzerResult|null;offers?:OffersBlock|null;previous?:BusinessIntelligence|null;budget?:unknown;at?:string}):BusinessIntelligence|null{
  if(input.profileId!=='expo-organic-v1')return null;
  const observedAt=input.at??new Date().toISOString();
  const sections:BusinessSection[]=BUSINESS_SECTIONS.map(section=>({id:section.id,title:section.title,sites:input.sites.map((site):BusinessSection['sites'][number]=>{
    const pages=site.businessPages??[],findings:BusinessFinding[]=[],warnings:string[]=[],metrics:Record<string,unknown>={};
    if(COMPARISON_SIGNALS[section.id])metrics.comparisonSignals=COMPARISON_SIGNALS[section.id]!.map(signal=>{const page=pages.find(item=>signal.terms.test(item.text));const match=page?signal.terms.exec(page.text):null;return {label:signal.label,status:page?'observed':'not_observed',evidence:page&&match?finding(section.id,page,signal.label,page.text.slice(Math.max(0,match.index-55),match.index+match[0].length+140)):null};});
    if(!['swot','roadmap','history'].includes(section.id))for(const page of pages){for(const quote of excerpts(page,section.terms).slice(0,1)){if(!findings.some(item=>item.quote===quote))findings.push(finding(section.id,page,section.title,quote));if(findings.length>=5)break;}if(findings.length>=5)break;}
    if(section.id==='events'){
      const events=pages.flatMap(page=>page.events.map(event=>({...event,url:page.url,observedAt:page.observedAt,kind:'website_claim'})));
      metrics.events=events;
      for(const page of pages)for(const event of page.events.slice(0,2))findings.push(finding(section.id,page,event.name,[event.startDate,event.endDate,event.venue,event.organizer].filter(Boolean).join(' | ')));
      const dates=events.flatMap(event=>event.startDate&&/^\d{4}-\d{2}-\d{2}/.test(event.startDate)?[new Date(event.startDate).getTime()]:[]).filter(Number.isFinite);
      if(dates.length&&dates.every(date=>date<Date.parse(observedAt)))warnings.push('Only past event dates were observed. A future edition is not verified.');
    }
    if(section.id==='overview')metrics.positioning=input.analysis?.sites.find(item=>item.domain===site.domain)?{kind:'ai_interpretation',value:input.analysis.sites.find(item=>item.domain===site.domain),contextUrls:pages.map(page=>page.url)}:null;
    if(['exhibitors','buyers'].includes(section.id)){
      const stats:Record<string,string>[]=[];
      for(const page of pages)for(const match of page.text.matchAll(/\b(\d[\d,]*(?:\s*\+)?)[ \t]*(exhibitors?|visitors?|buyers?|delegates?)\b/gi)){
        const entry={label:match[2]!.toLowerCase().replace(/s$/,''),value:match[1]!,quote:page.text.slice(Math.max(0,match.index!-45),Math.min(page.text.length,match.index!+match[0].length+50)),url:page.url,observedAt:page.observedAt,kind:'website_claim'};
        if(stats.length<12)stats.push(entry);
      }
      metrics.publishedStatistics=stats;
      for(const label of [...new Set(stats.map(item=>item.label))])if(new Set(stats.filter(item=>item.label===label).map(item=>item.value)).size>1)warnings.push(`Different published ${label} figures were observed. Verify the edition and context before comparing them.`);
    }
    if(section.id==='industry'){
      metrics.segments=INDUSTRY_SEGMENTS.filter(([,pattern])=>pages.some(page=>pattern.test(page.text))).map(([label])=>label);
      metrics.segmentEvidence=INDUSTRY_SEGMENTS.flatMap(([label,pattern])=>{const page=pages.find(item=>pattern.test(item.text));if(!page)return [];const match=pattern.exec(page.text)!;return [{label,quote:page.text.slice(Math.max(0,match.index-40),match.index+match[0].length+90),url:page.url,observedAt:page.observedAt,kind:'website_claim'}];});
      metrics.certificationMentions=pages.flatMap(page=>[...page.text.matchAll(/\b(?:USDA Organic|NPOP|GOTS|EU Organic|APEDA|FSSAI|PGS[- ]India|India Organic)\b/gi)].slice(0,5).map(match=>({name:match[0],quote:page.text.slice(Math.max(0,match.index!-35),match.index!+match[0].length+70),url:page.url,observedAt:page.observedAt,kind:'website_claim'}))).slice(0,12);
      warnings.push('Certification names on a website are claims or mentions; official accreditation was not independently checked.');
    }
    if(section.id==='digital'){
      metrics.technical={title:site.title,description:site.description,canonical:site.tech?.canonical??null,mobileViewport:site.tech?.viewport??null,robotsObserved:site.tech?.robotsTxt??null,schemaTypes:[...new Set(pages.flatMap(page=>page.schemaTypes))],invalidSchemaBlocks:pages.reduce((n,p)=>n+p.invalidSchemas,0),mobilePerformance:site.speed?.performance??null,mobileSeo:site.speed?.seo??null,accessibility:site.speed?.accessibility??null};
      metrics.socials=site.socials?{kind:'fact',note:'Observed profile links; counts only where an official API returned status ok.',data:site.socials}:null;
      metrics.content={kind:'fact',pagesSampled:site.pages.length,wordsOnSampledPages:site.pages.reduce((count,page)=>count+page.words,0),pageTypes:site.coverage?.pageTypes??[],semanticInterpretations:{kind:'ai_interpretation',topics:input.analysis?.topics?.filter(topic=>topic.sites.includes(site.domain))??[],contentIdeas:site.role==='own'?input.analysis?.contentIdeas??[]:[],contextUrls:pages.map(page=>page.url)}};
      if(pages[0])findings.unshift(finding(section.id,pages[0],'Observed SEO and AI-search signals',`Canonical: ${site.tech?.canonical??'not measured'}; viewport: ${site.tech?.viewport??'not measured'}; structured types: ${pages.flatMap(p=>p.schemaTypes).join(', ')||'not observed'}`,'fact'));
      warnings.push('AI-search inclusion and rankings are not measured. Structured-data presence is not a ranking guarantee.');
    }
    if(section.id==='conversion'){metrics.journeys=site.journeys??[];warnings.push('No forms were submitted. Completion rates and later registration steps are not observed.');for(const journey of site.journeys??[])for(const page of journey.pages){const observation=pages.find(item=>item.url===page.url);if(observation)findings.push(finding(section.id,observation,journey.label,`${page.forms} forms; ${page.fields} form fields; ${page.requiredFields} required; ${page.labelledFields} associated labels.`,'fact'));}}
    const offers=input.offers?.status==='completed'?input.offers.sites.find(item=>item.domain===site.domain):undefined;
    if(offers&&['exhibitors','buyers','events'].includes(section.id)){
      const keys=section.id==='exhibitors'?['exhibitors','stallPrice','deadline']:section.id==='buyers'?['visitors','ticketPrice']:['eventName','dates','location'];
      metrics.publishedClaims=keys.flatMap(key=>{const item=offers[key as keyof typeof offers];return item&&typeof item==='object'&&!Array.isArray(item)&&'value' in item?[{field:key,...item,kind:'website_claim',observedAt}]:[];});
    }
    return {domain:site.domain,status:!site.reachable?'inaccessible':findings.length?'observed':'not_observed',findings:findings.slice(0,7),metrics,warnings};
  })}));
  const own=input.sites.find(site=>site.role==='own'),roadmap:BusinessIntelligence['roadmap']=[],opportunities:string[]=[];
  for(const section of sections){
    const ownSite=section.sites.find(site=>site.domain===own?.domain);
    const signals=(ownSite?.metrics.comparisonSignals??[]) as {label:string;status:string;evidence:BusinessFinding|null}[];
    for(const signal of signals.filter(item=>item.status==='not_observed')){
      const evidence=section.sites.filter(site=>site.domain!==own?.domain).flatMap(site=>((site.metrics.comparisonSignals??[]) as typeof signals).filter(item=>item.label===signal.label&&item.status==='observed').flatMap(item=>item.evidence?[item.evidence]:[]));
      if(!evidence.length)continue;
      const reason=`${signal.label} was observed on competitor pages but not in your sampled content. Verify your public visibility before assuming the capability is absent.`;
      opportunities.push(reason);roadmap.push({priority:section.id==='exhibitors'||section.id==='buyers'?'high':'medium',action:`Review public ${signal.label.toLowerCase()}`,reason,kind:'interpretation',evidence:evidence.slice(0,3)});
    }
  }
  for(const section of sections.filter(section=>!['overview','swot','roadmap','history'].includes(section.id))){
    const current=section.sites.find(site=>site.domain===own?.domain),leaders=section.sites.filter(site=>site.domain!==own?.domain&&site.status==='observed');
    if(current?.status==='not_observed'&&leaders.length){const reason=`${section.title}: evidence was observed on ${leaders.map(site=>site.domain).join(', ')} but not in the sampled pages of your website. This is a visibility gap to verify, not proof that the capability is absent.`;opportunities.push(reason);roadmap.push({priority:['exhibitors','buyers','conversion'].includes(section.id)?'high':'medium',action:`Verify and improve public ${section.title.toLowerCase()}`,reason,kind:'interpretation',evidence:leaders.flatMap(site=>site.findings.slice(0,1)).slice(0,3)});}
  }
  for(const action of (input.analysis?.actions??[]).slice(0,6)){const urls=new Set(action.evidenceUrls??[]),evidence=sections.flatMap(section=>section.sites.flatMap(site=>site.findings)).filter(item=>urls.has(item.url)).slice(0,3);if(evidence.length)roadmap.push({priority:action.priority,action:action.action,reason:action.reason,kind:'ai_interpretation',evidence});}
  const changes:BusinessIntelligence['changes']=[];
  if(input.previous)for(const section of sections)for(const site of section.sites){const prior=input.previous.sections.find(s=>s.id===section.id)?.sites.find(s=>s.domain===site.domain);if(!prior)continue;const before=new Set(prior.findings.map(f=>f.id)),after=new Set(site.findings.map(f=>f.id)),added=site.findings.filter(f=>!before.has(f.id)).map(f=>f.id),notObserved=prior.findings.filter(f=>!after.has(f.id)).map(f=>f.id);if(added.length||notObserved.length)changes.push({domain:site.domain,section:section.title,message:`${added.length} new evidence references; ${notObserved.length} previous references not observed in this sample.`,added,notObserved});}
  const ownFindings=sections.filter(section=>!['swot','roadmap','history'].includes(section.id)).flatMap(section=>section.sites.filter(site=>site.domain===own?.domain).flatMap(site=>site.findings)).slice(0,8);
  return {version:'expo-organic-1',profileId:input.profileId,observedAt,summary:`Evidence-based comparison of ${input.sites.length} websites across exhibition, organic-industry and website experience signals. ${opportunities.length} public visibility gaps require review. Published business figures remain website-stated claims.`,sections,
    swot:{strengths:ownFindings,weaknesses:opportunities.slice(0,5),opportunities:roadmap.slice(0,5).map(action=>action.action),threats:['Website evidence does not establish market share, commercial threat, revenue or lead performance.']},
    roadmap:roadmap.sort((a,b)=>({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority])).slice(0,15),changes,
    methodology:{scoringVersion:'media360-original',businessProfileVersion:'expo-organic-1',rule:'No evidence = not observed. Website-stated claims are not independently verified business facts.',budget:input.budget??null,traffic:null,revenue:null,leads:null,conversionRate:null}};
}

/** Translate explanatory copy only. Quotes, domains, URLs, observation times and measured values stay intact. */
export function businessStrings(business:BusinessIntelligence|null|undefined){
  if(!business)return [];const result:{id:string;text:string}[]=[{id:'bx-summary',text:business.summary}];
  business.sections.forEach((section,i)=>section.sites.forEach((site,j)=>site.warnings.forEach((text,k)=>result.push({id:`bx-w-${i}-${j}-${k}`,text}))));
  for(const key of ['weaknesses','opportunities','threats'] as const)business.swot[key].forEach((text,i)=>result.push({id:`bx-sw-${key}-${i}`,text}));
  business.roadmap.forEach((action,i)=>{result.push({id:`bx-a-${i}`,text:action.action},{id:`bx-r-${i}`,text:action.reason});});
  business.changes.forEach((change,i)=>result.push({id:`bx-c-${i}`,text:change.message}));return result;
}
export function translateBusiness(business:BusinessIntelligence|null|undefined,map:Record<string,string>):BusinessIntelligence|null{
  if(!business)return null;const t=(id:string,value:string)=>map[id]??value;
  return {...business,summary:t('bx-summary',business.summary),sections:business.sections.map((section,i)=>({...section,sites:section.sites.map((site,j)=>({...site,warnings:site.warnings.map((warning,k)=>t(`bx-w-${i}-${j}-${k}`,warning))}))})),
    swot:{...business.swot,weaknesses:business.swot.weaknesses.map((value,i)=>t(`bx-sw-weaknesses-${i}`,value)),opportunities:business.swot.opportunities.map((value,i)=>t(`bx-sw-opportunities-${i}`,value)),threats:business.swot.threats.map((value,i)=>t(`bx-sw-threats-${i}`,value))},
    roadmap:business.roadmap.map((action,i)=>({...action,action:t(`bx-a-${i}`,action.action),reason:t(`bx-r-${i}`,action.reason)})),changes:business.changes.map((change,i)=>({...change,message:t(`bx-c-${i}`,change.message)}))};
}
