/** Reproducible offline browser verification. Requires source :3016 and target :3015 dev servers. */
const {chromium}=require('playwright-core');
const fs=require('node:fs');const path=require('node:path');
const fixture=require('../tests/competitor-analyzer/fixtures/shared-report.json');
const out=path.resolve('../docs/06-implementation/competitor-analyzer/screenshots');fs.mkdirSync(out,{recursive:true});
const executable=[process.env.COMPETITOR_BROWSER_EXECUTABLE,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
async function main(){
 if(!executable)throw new Error('No local Chrome/Edge executable');
 const browser=await chromium.launch({executablePath:executable,headless:true});const results=[];
 try{
  for(const [app,port] of (process.argv.includes('--target-only') ? [['target',3015]] : [['target',3015],['source',3016]])){
   const context=await browser.newContext();
   await context.route('**/*',async route=>{
    const url=route.request().url();
    if(url.includes('/public/competitor-reports/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(app==='target'?{success:true,data:fixture}:fixture),headers:{'access-control-allow-origin':'*'}});
    if(url.includes('/api/') && !url.includes('/_next/'))return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'Offline visual test: signed out'})});
    if(url.startsWith(`http://localhost:${port}`))return route.continue();
    return route.abort();
   });
   let page;const errors=[];
   for(const [label,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844]]){
    console.log('Checking',app,label);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize({width,height});
    const response=await page.goto(`http://localhost:${port}/shared/competitor-report/offline-parity-fixture`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('tab',{name:'Overview',exact:true}).waitFor({timeout:60000});
    await page.screenshot({path:path.join(out,`${app}-${label}-overview.png`),fullPage:true,animations:'disabled',timeout:90000});
    const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    if(dimensions.scrollWidth>width)throw new Error(`${app} ${label} overflows: ${dimensions.scrollWidth}`);
    results.push({app,label,status:response.status(),...dimensions});
    if(label==='desktop')for(const tab of ['Scorecard','Head To Head','What They Sell','Social Media','Content & Topics','Speed & Tech','Action Plan','History']){
     await page.getByRole('tab',{name:tab,exact:true}).click();
     await page.screenshot({path:path.join(out,`${app}-${label}-${tab.toLowerCase().replaceAll(' ','-').replaceAll('&','and')}.png`),fullPage:true,animations:'disabled',timeout:90000});
    }
    if(label!=='mobile')await page.close();
   }
   if(app==='target'){
    const login=await page.goto('http://localhost:3015/login',{waitUntil:'domcontentloaded'});
    await page.screenshot({path:path.join(out,'target-login.png'),fullPage:true});results.push({app,page:'login',status:login.status()});
   }
   if(errors.length)throw new Error(`${app} browser errors: ${errors.join('; ')}`);
   await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
