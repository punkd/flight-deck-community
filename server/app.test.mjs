import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "./app.mjs";

const origin="https://flight-deck.example.test";
const inviteCode="private-demo-invitation-code";
const password="a-password-for-the-tests";
async function boot(database,code=inviteCode){
 const server=createApp({database,origin,inviteCode:code,assets:join(process.cwd(),"dist")});
 server.listen(0,"127.0.0.1");
 await once(server,"listening");
 const url="http://127.0.0.1:"+server.address().port;
 return {server,call:(path,{method="GET",body,cookie,from=origin}={})=>fetch(url+path,{method,headers:{"Content-Type":"application/json",Origin:from,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})};
}
async function close(server){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
const register=(app,username,code=inviteCode)=>app.call("/api/auth/register",{method:"POST",body:{username,password,code}});
const cookieOf=response=>response.headers.get("set-cookie").split(";")[0];
const read=(app,cookie)=>app.call("/api/tracker",{cookie});
const write=(app,cookie,key,value,from)=>app.call("/api/tracker",{method:"PATCH",cookie,body:{key,value},from});

test("invites, authenticated persistence and isolation across accounts",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"flight-deck-"));
 const db=join(dir,"data.sqlite");
 let app;
 try {
  app=await boot(db);
  assert.equal((await app.call("/healthz")).status,200);
  assert.equal((await read(app)).status,401);
  assert.equal((await register(app,"alice","invalid")).status,403);
  const alice=await register(app,"Alice");
  assert.equal(alice.status,201);
  const aliceCookie=cookieOf(alice);
  assert.match(alice.headers.get("set-cookie"),/^__Host-flight_deck=[a-f0-9]{64}.*HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal((await register(app,"alice")).status,409);
  const bob=await register(app,"bob");
  assert.equal(bob.status,201);
  const bobCookie=cookieOf(bob);
  assert.equal((await (await read(app,bobCookie)).json()).settings.showClasses,false);
  assert.equal((await write(app,aliceCookie,"status:w1-1","review","https://untrusted.example.test")).status,403);
  assert.equal((await write(app,aliceCookie,"status:w1-1","bogus")).status,400);
  assert.equal((await write(app,aliceCookie,"status:w1-1","review")).status,200);
  const note={title:"Linux",body:"Check systemd units.",week:1,updated:"2026-01-01T00:00:00.000Z"};
  assert.equal((await write(app,aliceCookie,"note:example",note)).status,200);
  assert.equal((await (await read(app,bobCookie)).json())["note:example"],undefined);
  await close(app.server);
  app=await boot(db,"");
  assert.equal((await (await app.call("/api/auth/me")).json()).registrationOpen,false);
  assert.equal((await register(app,"carol")).status,403);
  assert.deepEqual((await (await read(app,aliceCookie)).json())["note:example"],note);
  const badLogin=await app.call("/api/auth/login",{method:"POST",body:{username:"alice",password:"not-the-password"}});
  assert.equal(badLogin.status,401);
  const login=await app.call("/api/auth/login",{method:"POST",body:{username:"alice",password}});
  assert.equal(login.status,200);
  const secondCookie=cookieOf(login);
  assert.equal((await (await read(app,secondCookie)).json())["status:w1-1"],"review");
  assert.equal((await write(app,secondCookie,"note:example",null)).status,200);
  assert.equal((await (await read(app,aliceCookie)).json())["note:example"],undefined);
  assert.equal((await app.call("/api/auth/logout",{method:"POST",cookie:aliceCookie})).status,200);
  assert.equal((await read(app,aliceCookie)).status,401);
  assert.equal((await read(app,secondCookie)).status,200);
 }finally {
  if(app?.server.listening) await close(app.server);
  await rm(dir,{recursive:true,force:true});
 }
});
