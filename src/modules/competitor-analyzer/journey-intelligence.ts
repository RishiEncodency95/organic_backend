import { load } from 'cheerio';

export interface JourneyRule { key:string; label:string; paths:RegExp }
export interface JourneyEvidence {
  key:string;label:string;state:'observed_form'|'entry_page_only'|'not_observed';completed:false;
  pages:{url:string;method:'static'|'rendered';forms:number;fields:number;requiredFields:number;labelledFields:number;
    https:boolean;captchaObserved:boolean;privacyNoticeObserved:boolean;externalFormDestination:boolean}[];
}
/** Inspect public HTML only. Never submit forms, create accounts or infer conversion rates. */
export function inspectJourneys(pages:{url:string;html:string;method?:'static'|'rendered'}[],rules:readonly JourneyRule[]):JourneyEvidence[] {
  return rules.map(rule=>{
    const observed:JourneyEvidence['pages']=[];
    for(const page of pages.slice(0,10)){
      const url=new URL(page.url);
      if(!rule.paths.test(url.pathname))continue;
      const $=load(page.html);
      const forms=$('form').toArray().slice(0,5);
      let fields=0,requiredFields=0,labelledFields=0,externalFormDestination=false;
      for(const form of forms){
        const action=$(form).attr('action');
        if(action){try{const destination=new URL(action,url);if(destination.origin!==url.origin)externalFormDestination=true;}catch{/* malformed destination is not evidence of a working journey */}}
        for(const element of $(form).find('input,select,textarea').toArray().slice(0,50)){
          const field=$(element),type=(field.attr('type')??'text').toLowerCase();
          if(['hidden','submit','button','reset','image'].includes(type)||field.is('[disabled]'))continue;
          fields++;
          if(field.is('[required]')||field.attr('aria-required')==='true')requiredFields++;
          const id=field.attr('id'),labelledBy=field.attr('aria-labelledby')?.split(/\s+/).filter(Boolean)??[];
          const explicitLabel=id?$('label').toArray().some(node=>$(node).attr('for')===id&&$(node).text().trim().length>0):false;
          const ariaReference=labelledBy.some(reference=>$('[id]').toArray().some(node=>$(node).attr('id')===reference&&$(node).text().trim().length>0));
          if(explicitLabel||field.parents('label').text().trim()||field.attr('aria-label')?.trim()||ariaReference)labelledFields++;
        }
      }
      observed.push({url:page.url,method:page.method??'static',forms:forms.length,fields,requiredFields,labelledFields,https:url.protocol==='https:',
        captchaObserved:/recaptcha|hcaptcha|cf-turnstile/i.test(page.html),privacyNoticeObserved:/privacy policy|data protection|consent/i.test($('body').text()),externalFormDestination});
    }
    return {key:rule.key,label:rule.label,state:observed.some(p=>p.forms>0)?'observed_form':observed.length?'entry_page_only':'not_observed',completed:false,pages:observed};
  });
}
