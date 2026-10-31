/** Runs existing Organic regression tests against a disposable database, never the configured application DB. */
const {MongoMemoryServer}=require('mongodb-memory-server');
const {spawn}=require('node:child_process');
(async()=>{
 const mongo=await MongoMemoryServer.create({instance:{dbName:'organic_infra_test'},binary:{downloadDir:'.test-mongodb'}});
 try{
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/infrastructure','--hookTimeout=180000'],{stdio:'inherit',env:{...process.env,INFRA_TEST_MONGODB_URI:mongo.getUri('organic_infra_test'),IHWE_MONGODB_URI:mongo.getUri('organic_ihwe_isolated_test')}});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});process.exitCode=code??1;
 }finally{await mongo.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
