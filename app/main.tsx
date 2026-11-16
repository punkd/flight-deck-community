import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./dashboard";
import { LanguagePicker, LocaleProvider, useLocale } from "./locale";
import { Icon } from "./icons";
import { independentSchedule } from "./tracker-model";
import "./globals.css";
import "./auth.css";

type Session={signedIn:boolean;registrationOpen:boolean};
function getToday() {
 const now=new Date();
 const digits=(value:number)=>String(value).padStart(2,"0");
 return `${now.getFullYear()}-${digits(now.getMonth()+1)}-${digits(now.getDate())}`;
}
async function request(path:string,data?:object) {
 const response=await fetch(path,data===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const body=await response.json().catch(()=>null);
 if(!response.ok) throw Error(body?.error??"Could not complete the request.");
 return body;
}

function CommunityApp(){
 const {t}=useLocale();
 const [session,setSession]=useState<Session|null>(null);
 const [mode,setMode]=useState<"login"|"register">("login");
 const [error,setError]=useState(""),[working,setWorking]=useState(false);
 const [today]=useState(getToday);
 async function loadSession(){
  setError("");
  try {setSession(await request("/api/auth/me"));}
  catch {setError("Check your connection and try again.");}
 }
 useEffect(()=>{void loadSession();},[]);
 async function authenticate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=new FormData(event.currentTarget);
  setWorking(true);setError("");
  try {
   await request("/api/auth/"+mode,{username:form.get("username"),password:form.get("password"),code:form.get("code")});
   setSession(current=>current?{...current,signedIn:true}:null);
  }catch(error){
   setError(error instanceof TypeError?"Check your connection and try again.":(error as Error).message);
  }finally{setWorking(false);}
 }
 async function signOut(){
  if(working)return;
  setWorking(true);setError("");
  try {
   await request("/api/auth/logout",{});
   setSession(current=>current?{...current,signedIn:false}:null);
   setMode("login");
  }catch {setError("Check your connection and try again.");}
  finally {setWorking(false);}
 }
 if(session?.signedIn) return <>
  {error&&<div className="notice error auth-notice" role="alert">{t(error)}</div>}
  <Dashboard today={today} preview={false} defaults={independentSchedule(today)} onSignOut={signOut}/>
 </>;
 const register=mode==="register";
 return <main className="auth-page">
  <section className="auth-shell">
   <div className="auth-cover"><span className="brand-icon"><Icon name="terminal" width="23" height="23"/></span><p className="hero-kicker"><i/> DEVOPS FLIGHT DECK</p><h1>{t("DevOps, one lab at a time.")}</h1><p>{t("Keep your progress, notes and portfolio in one private account.")}</p></div>
   <div className="auth-form">
    <header><h2>{t(register?"Create account":"Sign in")}</h2><LanguagePicker/></header>
    {error&&<p className="notice error" role="alert">{t(error)}</p>}
    {!session&&(error?<button className="button secondary" onClick={()=>void loadSession()}>{t("Retry")}</button>:<p role="status">{t("Signing in…")}</p>)}
    {session&&<>
     {session.registrationOpen&&<div className="segments">
      <button type="button" aria-pressed={!register} onClick={()=>{setMode("login");setError("");}}>{t("Sign in")}</button>
      <button type="button" aria-pressed={register} onClick={()=>{setMode("register");setError("");}}>{t("Create account")}</button>
     </div>}
     <form key={mode} className="form stack" onSubmit={authenticate}>
      <label>{t("Username")}<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} pattern={String.raw`[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,31}`} required/>{register&&<span className="fine">{t("Use letters, numbers, dots, underscores or hyphens.")}</span>}</label>
      <label>{t("Password")}<input name="password" type="password" autoComplete={register?"new-password":"current-password"} minLength={12} maxLength={128} required/>{register&&<span className="fine">{t("Choose a password of at least 12 characters.")}</span>}</label>
      {register&&<label>{t("Invitation code")}<input name="code" autoComplete="off" minLength={24} maxLength={240} required/></label>}
      <button className="button primary" disabled={working}>{t(working?"Working…":register?"Create account":"Sign in")}</button>
     </form>
    </>}
   </div>
  </section>
 </main>;
}
createRoot(document.getElementById("root")!).render(<LocaleProvider><CommunityApp/></LocaleProvider>);
