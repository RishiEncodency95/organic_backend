import { describe, expect, it } from 'vitest';
import { deterministicComparison, assessQuality } from '../../src/modules/competitor-analyzer/analyzer-intelligence';
import { deterministicComparison as sourceScores } from '../../../backend/src/competitor-analyzer/analyzer-intelligence';
import { renderAnalyzerPdf } from '../../src/modules/competitor-analyzer/analyzer-pdf';
import { renderAnalyzerPdf as sourcePdf } from '../../../backend/src/competitor-analyzer/analyzer-pdf';
import { enhancedShared, fixtureAnalysis, fixtureSites, fixtureStudy, fixtureTime, registrationHtml } from '../../scripts/analyzer-fixture';
import { inspectJourneys } from '../../src/modules/competitor-analyzer/journey-intelligence';
import type { AnalyzerResult } from '../../src/modules/competitor-analyzer/analyzer-ai';
import { evaluateProfile } from '../../src/modules/competitor-analyzer/profiles';
import { isPrivateAddress, safeFetch } from '../../src/modules/website-intelligence/safe-fetch';
import { selectImportantPages } from '../../src/modules/competitor-analyzer/analyzer-evidence';
import { createRequire } from 'node:module';
const parsePdf = createRequire(__filename)('pdf-parse/lib/pdf-parse.js') as (buffer:Buffer)=>Promise<{text:string;numpages:number}>;
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('source scoring and PDF parity',()=>{
  it('produces the exact original scores on identical and incomplete evidence',()=>{
    for(const sites of [fixtureSites,fixtureSites.map(s=>({...s,speed:null})),fixtureSites.map(s=>({...s,coverage:undefined,features:undefined})),fixtureSites.map(s=>({...s,reachable:false}))]) {
      expect(deterministicComparison(sites)).toEqual(sourceScores(sites));
    }
  });
  for(const lang of ['en','hi'] as const)it(`renders the original ${lang} report content from identical saved evidence`,async()=>{
    const input={studyName:fixtureStudy.name,preparedFor:'Offline test organisation',generatedAt:new Date(fixtureTime),checkedAt:new Date(fixtureTime),sites:fixtureStudy.sites,evidence:fixtureSites,
      ai:fixtureAnalysis as AnalyzerResult,aiNote:null,narrative:null,changes:null,quality:assessQuality(fixtureSites,fixtureAnalysis as AnalyzerResult),lang};
    const [target,source]=await Promise.all([renderAnalyzerPdf(input),sourcePdf(input)]);
    expect(target.subarray(0,5).toString()).toBe('%PDF-');
    const [a,b]=await Promise.all([parsePdf(target),parsePdf(source)]);
    expect(a.numpages).toBe(b.numpages);expect(a.text).toBe(b.text);expect(a.numpages).toBeGreaterThan(3);
    const output=resolve('../docs/06-implementation/competitor-analyzer/reports');mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`target-${lang}.pdf`),target);
  });
});
describe('enhanced evidence and SSRF boundaries',()=>{
  it('measures actual form controls, labels and required fields without claiming a successful registration',()=>{
    const journey=inspectJourneys([{url:'https://own.example/exhibitor-registration',html:registrationHtml,method:'rendered'}],[{key:'exhibitor',label:'Exhibitor registration',paths:/exhibitor-registration/}])[0]!;
    expect(journey.completed).toBe(false);expect(journey.state).toBe('observed_form');
    expect(journey.pages[0]).toMatchObject({forms:1,fields:3,requiredFields:2,labelledFields:2,method:'rendered',https:true,privacyNoticeObserved:true});
  });
  for(const lang of ['en','hi'] as const)it(`renders the enhanced ${lang} appendix from the same saved profile and journey data`,async()=>{
    const pdf=await renderAnalyzerPdf({studyName:'Offline Expo fixture',brandName:'Offline test organisation',preparedFor:'Offline test organisation',generatedAt:new Date(fixtureTime),checkedAt:new Date(fixtureTime),sites:fixtureStudy.sites,evidence:enhancedShared.study.report.sites,ai:fixtureAnalysis as AnalyzerResult,aiNote:null,narrative:null,changes:null,profileResults:enhancedShared.study.report.profileResults,lang});
    const parsed=await parsePdf(pdf);expect(parsed.text).toContain('https://own.example/exhibitor-registration');expect(parsed.text).toContain('expo-v1');
    expect(parsed.text).not.toContain('Media360');
    const output=resolve('../docs/06-implementation/competitor-analyzer/reports');mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`enhanced-${lang}.pdf`),pdf);
  });
  it('selects important business journeys without changing default source selection',()=>{
    const html='<a href="/about">About</a><a href="/contact">Contact</a><a href="/services">Services</a><a href="/exhibitor-registration">Register as exhibitor</a>';
    const base=selectImportantPages(html,new URL('https://own.example'),[],2);
    expect(base.map(p=>p.url.pathname)).toEqual(['/contact','/about']);
    const tailored=selectImportantPages(html,new URL('https://own.example'),[],2,[/exhibitor.*registration/]);
    expect(tailored.map(p=>p.url.pathname)).toEqual(['/exhibitor-registration','/contact']);
  });
  it('keeps business scoring separate, provides citations and never treats missing evidence as a verified absence',()=>{
    const result=evaluateProfile('expo-v1',fixtureSites);
    expect(result.separateFromCoreScores).toBe(true);
    const registration=result.sites[0]!.rules.find(r=>r.key==='exhibitor')!;
    expect(registration.state).toBe('present');expect(registration.verifiedJourney).toBe(false);expect(registration.evidence[0]?.url).toBe('https://own.example/');
    expect(result.sites[0]!.rules.find(r=>r.key==='sponsor')?.state).toBe('not_observed');
    expect(evaluateProfile('general-v1',fixtureSites).sites[0]!.observedCapabilityScore).toBeNull();
  });
  it('rejects loopback, link-local, IPv6 and DNS records with a private address',async()=>{
    for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','::ffff:127.0.0.1'])expect(isPrivateAddress(address)).toBe(true);
    await expect(safeFetch('https://fixture.example',{},{resolve:async()=>['93.184.216.34','127.0.0.1']})).rejects.toThrow();
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow();
    await expect(safeFetch('http://user:pass@fixture.example')).rejects.toThrow();
  });
});
