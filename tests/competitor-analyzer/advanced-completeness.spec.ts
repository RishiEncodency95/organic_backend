import {describe,it,expect} from 'vitest';
import fixture from './fixtures/shared-report.json';
import type {SiteEvidence} from '../../src/modules/competitor-analyzer/analyzer-evidence';
import {selectImportantPages} from '../../src/modules/competitor-analyzer/analyzer-evidence';
import {publicObservations,buildBusinessIntelligence} from '../../src/modules/competitor-analyzer/business-intelligence';
import {evaluateProfile} from '../../src/modules/competitor-analyzer/profiles';
import {buildCanonicalReportModel} from '../../src/modules/competitor-analyzer/analyzer-report-model';

const sites=()=>structuredClone(fixture.study.report.sites) as unknown as SiteEvidence[];
describe('advanced report completeness regressions',()=>{
 it('keeps measured scores when the AI comparison failed',()=>{
  const report=buildCanonicalReportModel({startedAt:new Date(),finishedAt:new Date(),sites:sites(),ai:{status:'failed',reason:'budget exhausted'}});
  expect(Object.keys(report.analysis!.overall).length).toBeGreaterThanOrEqual(2);
  expect(report.analysis!.actions).toEqual([]);
 });
 it('uses body evidence for capabilities and removes navigation noise',()=>{
  const evidence=sites()[0]!;
  evidence.businessPages=publicObservations([{url:evidence.pages[0]!.url,html:'<html><head><title>Expo</title></head><body><nav>Login Password Dashboard</nav><main><h1>Meet the industry</h1><p>Venue: City Convention Centre. Sponsorship packages are available. Our conference welcomes industry speakers and business matchmaking.</p></main></body></html>'}]);
  expect(evidence.businessPages[0]!.text).not.toContain('Password');
  const result=evaluateProfile('expo-organic-v1',[evidence]);
  expect(result.sites[0]!.rules.find(r=>r.key==='venue')!.state).toBe('present');
  expect(result.sites[0]!.rules.find(r=>r.key==='sponsor')!.state).toBe('present');
 });
 it('finds a specific gap even when both sites mention exhibitors',()=>{
  const data=sites().slice(0,2);data[0]!.role='own';data[1]!.role='competitor';
  for(const [index,site]of data.entries())site.businessPages=publicObservations([{url:site.pages[0]!.url,html:`<main><h1>Exhibitor registration</h1><p>${index?'Our stall tariff is INR 20000 for shell scheme.':'Book your stand and meet industry leaders.'}</p></main>`}]);
  const business=buildBusinessIntelligence({profileId:'expo-organic-v1',sites:data,analysis:null})!;
  expect(business.roadmap.some(a=>a.action==='Review public stall pricing or package')).toBe(true);
  expect(business.roadmap.find(a=>a.action==='Review public stall pricing or package')!.evidence[0]!.url).toBe(data[1]!.pages[0]!.url);
 });
 it('does not sample irrelevant casino URLs in place of business pages',()=>{
  const selected=selectImportantPages('<a href="/casino-loyalty-services">Services</a><a href="/contact">Contact</a>',new URL('https://example.com/'),[],9);
  expect(selected.map(p=>p.url.pathname)).toEqual(['/contact']);
 });
});
