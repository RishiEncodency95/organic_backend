const {chromium}=require('playwright-core');const fs=require('node:fs');const path=require('node:path');
const fixture=require('../tests/competitor-analyzer/fixtures/shared-report.json');
const directory=path.resolve('../docs/06-implementation/competitor-analyzer/screenshots');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const manage of [true,false]){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   const saved={accessToken:'offline-test-token',refreshToken:'offline-refresh',admin:{id:'offline-admin',name:'Offline test admin',phone:'',userType:'INTERNAL',roleSlug:manage?'SUPER_ADMIN':'READER',permissions:[]}};
   await context.addCookies([{name:'ms_admin_token',value:saved.accessToken,url:'http://localhost:3015'}]);
   await context.addInitScript(auth=>localStorage.setItem('ms_admin_auth',JSON.stringify(auth)),saved);
   let created=false,started=false,createdBody;
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());const endpoint=url.pathname.replace(/^\/api(?:\/v1)?/,'');
    if(url.pathname.includes('/auth/'))console.log('Auth fixture',url.pathname,route.request().resourceType());
    const respond=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data}),headers:{'access-control-allow-origin':'http://localhost:3015','access-control-allow-credentials':'true','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'}});
    if(endpoint.includes('capabilities'))console.log('Capabilities fixture',endpoint,route.request().resourceType());
    if(endpoint==='/auth/me')return respond({user:{id:'offline-admin',name:'Offline test admin',role:'superadmin',isTwoFactorEnabled:true}});
    if(endpoint==='/system-services/summary'||endpoint==='/cases/admin/sla-breaches')return respond([]);
    if(url.pathname.startsWith('/api/') && endpoint.startsWith('/competitor-analyzer') && ['fetch','xhr'].includes(route.request().resourceType())){
     if(endpoint.endsWith('/capabilities'))return respond({read:true,manage});
     if(endpoint.endsWith('/clients'))return respond([]);
     if(endpoint.endsWith('/tasks')||endpoint.endsWith('/alerts'))return respond([]);
     if(endpoint.endsWith('/usage'))return respond({runs:0,estimatedCostUsd:0,inputTokens:0,outputTokens:0,reservations:{costUsd:0,tokens:0,calls:0},note:'Offline test fixture'});
     if(endpoint.endsWith('/site-name')){const domain=url.searchParams.get('url');return respond({url:`https://${domain}/`,domain,name:domain,reachable:true});}
     if(endpoint.endsWith('/location'))return respond({city:null,state:null,country:null,basis:'Offline fixture',cached:false});
     if(endpoint==='/competitor-analyzer/studies'&&route.request().method()==='POST'){created=true;createdBody=route.request().postDataJSON();return respond({...fixture.study,latestRun:null,report:null});}
     if(endpoint.endsWith('/runs')){started=true;return respond({run:{...fixture.study.report,status:'running',stage:'queued'},reused:false});}
     if(endpoint==='/competitor-analyzer/studies')return respond([{...fixture.study,latestRun:{...fixture.study.report,overall:fixture.study.report.ai.result.overall}}]);
     if(endpoint.includes('/studies/'))return respond({...fixture.study,latestRun:fixture.study.report});
     return respond({});
    }
    if(url.pathname.startsWith('/api/'))return respond({});
    if(url.origin==='http://localhost:3015')return route.continue();return route.abort();
   });
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')console.log('Browser:',message.text().slice(0,300));});
   await page.goto('http://localhost:3015/competitor-analyzer',{waitUntil:'domcontentloaded',timeout:120000});
   await page.getByRole('main').getByRole('heading',{name:'Competitor Analyzer',exact:true}).waitFor({timeout:60000});
   if(manage){
    try { await page.getByRole('button',{name:'New analysis',exact:true}).click(); }
    catch(error){console.log('Current URL',page.url());console.log((await page.locator('body').innerText()).slice(0,1600));throw error;}
    await page.getByRole('dialog').waitFor();
    await page.getByPlaceholder('yourwebsite.com',{exact:true}).fill('own.example');
    await page.getByPlaceholder('competitor.com or a business name',{exact:true}).fill('rival.example');
    await page.getByLabel('Business scoring profile',{exact:true}).selectOption('expo-v1');
    await page.screenshot({path:path.join(directory,'target-new-analysis.png'),fullPage:true,animations:'disabled',timeout:90000});
    await page.getByRole('button',{name:'Compare now',exact:true}).click();
    await page.waitForURL('**/competitor-analyzer/'+fixture.study.id,{timeout:60000});
    await page.getByRole('tab',{name:'Overview',exact:true}).waitFor();
    if(!created||!started||createdBody.profile!=='expo-v1')throw new Error('Create/run contract not exercised');
   }else{
    await page.getByRole('link',{name:'Open report',exact:true}).waitFor();
    if(await page.getByRole('button',{name:'New analysis',exact:true}).count())throw new Error('Read-only account can create analyses');
    await page.getByRole('link',{name:'Open report',exact:true}).click();
    await page.getByRole('tab',{name:'Overview',exact:true}).waitFor();
    if(await page.getByRole('button',{name:'Edit sites',exact:true}).count())throw new Error('Read-only account can edit');
   }
   await page.screenshot({path:path.join(directory,manage?'target-admin-study.png':'target-reader-study.png'),fullPage:true,animations:'disabled',timeout:90000});
   if(errors.length)throw new Error(errors.join('; '));
   await context.close();console.log(manage?'Admin create/run/UI: passed':'Read-only UI: passed');
  }
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
