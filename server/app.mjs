import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { independentSchedule, parseRecord } from "../app/tracker-model.ts";

const derive = promisify(scrypt);
const sessionAge = 14 * 24 * 60 * 60;
const authError = "Incorrect username or password.";
const mimeTypes = {".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml"};

function hash(value) {
  return createHash("sha256").update(value).digest();
}
async function passwordHash(password, salt) {
  return derive(password, salt, 64, {N:65536,r:8,p:1,maxmem:100663296});
}
function json(response, status, payload) {
  response.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  response.end(JSON.stringify(payload));
}
function reject(response, status, error) { return json(response,status,{error}); }
async function readJson(request) {
  if(request.headers["content-type"]?.split(";")[0].trim().toLowerCase()!=="application/json") return null;
  const chunks=[];
  let size=0;
  for await(const chunk of request){
    size+=chunk.length;
    if(size>32_768) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return null; }
}

export function createApp({database,origin,inviteCode="",assets}) {
  const appOrigin = new URL(origin);
  if(appOrigin.origin!==origin || !["https:","http:"].includes(appOrigin.protocol)) throw Error("APP_ORIGIN must be an origin such as https://study.example.org");
  if(appOrigin.protocol==="http:" && !["localhost","127.0.0.1","[::1]"].includes(appOrigin.hostname)) throw Error("Use HTTPS for non-loopback APP_ORIGIN");
  if(inviteCode && inviteCode.length<24) throw Error("REGISTRATION_CODE needs at least 24 characters");
  const secure = appOrigin.protocol==="https:";
  const cookieName = secure ? "__Host-flight_deck" : "flight_deck";
  const cookieAttrs = "Path=/; HttpOnly; SameSite=Lax"+(secure?"; Secure":"");
  if(database!==":memory:") mkdirSync(dirname(database),{recursive:true});
  const db=new DatabaseSync(database,{timeout:5000});
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions(expires);
    CREATE TABLE IF NOT EXISTS tracker_records (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(user_id,record_key)
    );
  `);
  const findUser=db.prepare("SELECT id,password,salt FROM users WHERE username=?");
  const addUser=db.prepare("INSERT INTO users(id,username,password,salt) VALUES(?,?,?,?)");
  const activeUser=db.prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires>?");
  const addSession=db.prepare("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)");
  const endSession=db.prepare("DELETE FROM sessions WHERE token_hash=?");
  const purgeSessions=db.prepare("DELETE FROM sessions WHERE expires<=?");
  const list=db.prepare("SELECT record_key,value FROM tracker_records WHERE user_id=?");
  const update=db.prepare("INSERT INTO tracker_records VALUES(?,?,?) ON CONFLICT(user_id,record_key) DO UPDATE SET value=excluded.value");
  const remove=db.prepare("DELETE FROM tracker_records WHERE user_id=? AND record_key=?");
  const inviteHash=hash(inviteCode);
  const emptySalt=Buffer.alloc(16);
  const emptyPassword=Buffer.alloc(64);
  const attempts=new Map();
  let runningHashes=0;
  function takeAttempt(username) {
    const minute=Math.floor(Date.now()/60_000);
    for(const [name,entry] of attempts) if(entry.minute!==minute) attempts.delete(name);
    if((attempts.get("")?.count??0)>=90 || (attempts.get(username)?.count??0)>=8 || runningHashes>=4) return false;
    for(const key of ["",username]) attempts.set(key,{minute,count:(attempts.get(key)?.count??0)+1});
    return true;
  }
  function sessionToken(request) {
    const item=request.headers.cookie?.split(";").map(part=>part.trim()).find(part=>part.startsWith(cookieName+"="));
    const token=item?.slice(cookieName.length+1)??"";
    return /^[a-f0-9]{64}$/.test(token)?hash(token).toString("hex"):"";
  }
  function openSession(userId) {
    const token=randomBytes(32).toString("hex");
    const now=Date.now();
    purgeSessions.run(now);
    addSession.run(hash(token).toString("hex"),userId,now+sessionAge*1000);
    return `${cookieName}=${token}; Max-Age=${sessionAge}; ${cookieAttrs}`;
  }
  async function authenticate(request,response,register) {
    const body=await readJson(request);
    const username=typeof body?.username==="string"?body.username.trim().toLowerCase():"";
    const password=typeof body?.password==="string"?body.password:"";
    if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)||password.length<12||password.length>128) {
      return reject(response,400,"Use 3–32 username characters and a password of 12–128 characters.");
    }
    if(!takeAttempt(username)) return reject(response,429,"Too many attempts. Try again in a minute.");
    if(register && (!inviteCode || typeof body.code!=="string" || !timingSafeEqual(hash(body.code),inviteHash))) {
      return reject(response,403,"Registration requires a valid invitation code.");
    }
    const user=findUser.get(username);
    const salt=register ? randomBytes(16) : user ? Buffer.from(user.salt,"hex") : emptySalt;
    runningHashes++;
    let digest;
    try { digest=await passwordHash(password,salt); }
    finally { runningHashes--; }
    if(!register) {
      const expected=user?Buffer.from(user.password,"hex"):emptyPassword;
      if(!timingSafeEqual(digest,expected)||!user) return reject(response,401,authError);
      response.setHeader("Set-Cookie",openSession(user.id));
      return json(response,200,{signedIn:true});
    }
    // Another request can finish hashing while this request is waiting for scrypt.
    if(findUser.get(username)) return reject(response,409,"That username is already taken.");
    const id=randomUUID();
    const settings=independentSchedule(new Date().toISOString().slice(0,10));
    db.exec("BEGIN IMMEDIATE");
    try {
      addUser.run(id,username,digest.toString("hex"),salt.toString("hex"));
      update.run(id,"settings",JSON.stringify(settings));
      const cookie=openSession(id);
      db.exec("COMMIT");
      response.setHeader("Set-Cookie",cookie);
    } catch(error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return json(response,201,{signedIn:true});
  }
  const server=createServer({requestTimeout:15_000,headersTimeout:10_000},async(request,response)=>{
    response.setHeader("X-Content-Type-Options","nosniff");
    response.setHeader("Referrer-Policy","no-referrer");
    response.setHeader("X-Frame-Options","DENY");
    response.setHeader("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    if(secure) response.setHeader("Strict-Transport-Security","max-age=86400");
    try {
      const method=request.method;
      const path=new URL(request.url,"http://localhost").pathname;
      if(method==="GET"&&path==="/healthz"){
        db.prepare("SELECT 1").get();
        return json(response,200,{ok:true});
      }
      if(method==="POST"||method==="PATCH") {
        if(request.headers.origin!==appOrigin.origin) return reject(response,403,"Request origin is not allowed.");
      }
      if(method==="POST"&&path==="/api/auth/register") return await authenticate(request,response,true);
      if(method==="POST"&&path==="/api/auth/login") return await authenticate(request,response,false);
      if(path.startsWith("/api/")) {
        const token=sessionToken(request);
        if(method==="POST"&&path==="/api/auth/logout"){
          if(token) endSession.run(token);
          response.setHeader("Set-Cookie",`${cookieName}=; Max-Age=0; ${cookieAttrs}`);
          return json(response,200,{signedIn:false});
        }
        const userId=token?activeUser.get(token,Date.now())?.user_id:undefined;
        if(method==="GET"&&path==="/api/auth/me") return json(response,200,{signedIn:!!userId,registrationOpen:!!inviteCode});
        if(path==="/api/tracker"){
          if(!userId) return reject(response,401,"Sign in to open your records.");
          if(method==="GET") return json(response,200,Object.fromEntries(list.all(userId).map(row=>[row.record_key,JSON.parse(row.value)])));
          if(method==="PATCH") {
            const parsed=parseRecord(await readJson(request));
            if("error" in parsed) return reject(response,400,parsed.error);
            if(parsed.value===null) remove.run(userId,parsed.key);
            else update.run(userId,parsed.key,parsed.value);
            return json(response,200,{ok:true});
          }
        }
        return reject(response,404,"Page not found.");
      }
      if(method!=="GET"&&method!=="HEAD") return reject(response,405,"Method not allowed.");
      const assetMatch=/^\/assets\/([a-zA-Z0-9_.-]+\.(js|css|svg))$/.exec(path);
      const relative=path==="/"?"index.html":path==="/favicon.svg"?"favicon.svg":assetMatch?"assets/"+assetMatch[1]:null;
      const file=relative?join(assets,relative):null;
      if(!file||!existsSync(file)) return reject(response,404,"Page not found.");
      const contentType=path==="/"?"text/html; charset=utf-8":mimeTypes[file.slice(file.lastIndexOf("."))];
      response.writeHead(200,{"Content-Type":contentType,"Cache-Control":assetMatch?"public, max-age=31536000, immutable":"no-cache"});
      if(method==="HEAD") return response.end();
      const stream=createReadStream(file);
      stream.on("error",()=>response.destroy());
      stream.pipe(response);
    }catch(error) {
      console.error(error);
      if(!response.headersSent) reject(response,500,"Could not complete the request.");
      else response.destroy();
    }
  });
  server.once("close",()=>db.close());
  return server;
}
