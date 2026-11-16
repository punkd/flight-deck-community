"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { getCurriculum } from "./curriculum";
import { LanguagePicker, useLocale } from "./locale";
import { addDays, difference, sessionAt, weekStart, type OwnTask, type Records, type Settings } from "./tracker-model";
import { Empty, External, IconTile, Modal, Progress, RecordForm, ResourceLink, StatusSelect, TaskRow, formText, localId, pad, percent, statusOf, timeOf, type Store, type TaskItem } from "./ui";
import { CalendarView, LabsView, NotesView, PortfolioView, ProgramView, SettingsView, SkillsView } from "./views";

const navigation=[
 {id:"today",name:"Overview",icon:"home"},
 {id:"program",name:"Program",icon:"route"},
 {id:"calendar",name:"Calendar",icon:"calendar"},
 {id:"labs",name:"Labs",icon:"flask"},
 {id:"skills",name:"Checklists",icon:"checks"},
 {id:"notes",name:"Notes",icon:"notes"},
 {id:"portfolio",name:"Portfolio & career",icon:"brief"},
] as const;
type View=typeof navigation[number]["id"]|"settings";
const storageKey="flight-deck-preview-v1";
function useTracker(preview:boolean) {
 const [records,setRecords]=useState<Records>({});
 const data=useRef<Records>({});
 const [ready,setReady]=useState(false);
 const [message,setMessage]=useState("");
 const [pending,setPending]=useState<string[]>([]);
 const active=useRef(new Set<string>());
 const read=useCallback(async()=>{
  setMessage("");
  try {
   let next:Records;
   if(preview) next=JSON.parse(localStorage.getItem(storageKey)??"{}");
   else {
    const response=await fetch("/api/tracker",{cache:"no-store"});
    if(!response.ok) throw Error(response.status===401?"Sign in to open your records.":"Could not load your records.");
    next=await response.json();
   }
   data.current=next;setRecords(next);setReady(true);
  }catch(error){setMessage(error instanceof Error ? error.message:"Could not load your records.");}
 },[preview]);
 useEffect(()=>{void read();},[read]);
 const set=async(key:string,value:unknown)=>{
  if(!ready||active.current.has(key))return false;
  active.current.add(key);setPending([...active.current]);setMessage("");
  const previous=data.current[key];
  function change(nextValue:unknown) {
   const next={...data.current};
   if(nextValue==null) delete next[key];else next[key]=nextValue;
   data.current=next;setRecords(next);
  }
  change(value);
  try {
   if(preview) localStorage.setItem(storageKey,JSON.stringify(data.current));
   else {
    const response=await fetch("/api/tracker",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value})});
    if(!response.ok) {
     const result=await response.json().catch(()=>null);
     throw Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Could not save the change. Try again.");
    }
   }
   return true;
  }catch(error){change(previous);setMessage(error instanceof Error ? error.message:"Could not save the change.");return false;}
  finally {active.current.delete(key);setPending([...active.current]);}
 };
 return {store:{records,set,busy:(key:string)=>pending.includes(key),ready} satisfies Store,message,read,pending};
}

function Orbit() {
 return <svg className="orbit" viewBox="0 0 410 245" fill="none" aria-hidden="true">
  <defs>
   <pattern id="stargrid" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#697893" opacity=".37"/></pattern>
   <radialGradient id="orbGlow"><stop stopColor="#314467" stopOpacity=".83"/><stop offset="1" stopColor="#151f33" stopOpacity="0"/></radialGradient>
   <linearGradient id="orbPath" x1="48" y1="200" x2="350" y2="55" gradientUnits="userSpaceOnUse"><stop stopColor="#4f6587"/><stop offset=".6" stopColor="#8194b1"/><stop offset="1" stopColor="#ed805d"/></linearGradient>
  </defs>
  <rect x="9" width="401" height="245" fill="url(#orbGlow)"/><rect x="18" width="390" height="245" fill="url(#stargrid)" opacity=".62"/>
  <circle cx="247" cy="126" r="92" stroke="#536581" strokeOpacity=".35"/><circle cx="247" cy="126" r="66" stroke="#536581" strokeOpacity=".45"/><circle cx="247" cy="126" r="38" stroke="#536581" strokeOpacity=".65"/>
  <path d="M247 28v195M149 126h196" stroke="#4e607d" strokeOpacity=".45" strokeDasharray="3 5"/>
  <ellipse cx="247" cy="126" rx="116" ry="51" transform="rotate(-28 247 126)" stroke="#687b99" strokeOpacity=".66" strokeDasharray="4 6"/>
  <path d="M36 192h53l24-24h42l36-36h51l42-42h37l34-34h41" stroke="url(#orbPath)" strokeWidth="1.6" strokeDasharray="4 5"/>
  <circle cx="113" cy="168" r="4" fill="#adc0de"/><circle cx="191" cy="132" r="4" fill="#adc0de"/><circle cx="354" cy="56" r="5" fill="#ff8c68"/><circle cx="354" cy="56" r="11" stroke="#ff8c68" strokeOpacity=".5"/>
  <path d="M247 96l26 15v30l-26 15-26-15v-30z" fill="#21304d" stroke="#e97854" strokeWidth="1.5"/><path d="m221 111 26 15 26-15m-26 15v30" stroke="#e97854" strokeWidth="1.5"/>
  <circle cx="247" cy="126" r="3" fill="#ff9b7c"/>
  <path d="M123 62h12m-6-6v12m207 111h12m-6-6v12M94 114h8m-4-4v8" stroke="#95a5c0" strokeOpacity=".65"/>
  <text x="53" y="216" fill="#8fa0bf" fontSize="9" letterSpacing="2" fontFamily="monospace">SYS / 01</text><text x="316" y="34" fill="#ffab91" fontSize="9" letterSpacing="2" fontFamily="monospace">OPS / 28</text>
 </svg>;
}

export function Dashboard({today,preview,defaults,onSignOut}:{today:string;preview:boolean;defaults:Settings;onSignOut?:()=>Promise<void>}) {
 const {language,t,dateLabel,hours,dayNames}=useLocale();
 const {modules,prep,weeks}=getCurriculum(language);
 const {store,message,read,pending}=useTracker(preview);
 const [view,setView]=useState<View>("today"), [menu,setMenu]=useState(false), [week,setWeek]=useState(1);
 const [day,setDay]=useState(today), [task,setTask]=useState<TaskItem|null>(null), [addTask,setAddTask]=useState(false),[ownId,setOwnId]=useState("");
 const [labFilter,setLabFilter]=useState("all");
 const settings=(store.records.settings as Settings|undefined)??defaults;
 const rawWeek=Math.floor(difference(today,settings.start)/7)+1;
 const current=Math.min(28,Math.max(rawWeek,1));
 const todayWeek=weeks[current-1];
 const activeModule=modules.find(item=>item.id===todayWeek.module)!;
 const before=today<settings.start, after=today>settings.end;
 const done=weeks.flatMap(w=>w.tasks).filter(item=>statusOf(store.records,item.id)==="done").length;
 const review=Object.entries(store.records).filter(([key,value])=>key.startsWith("status:")&&value==="review").length;
 const logged=Object.entries(store.records).reduce((sum,[key,value])=>sum+(key.startsWith("time:")?Number(value):0),0);
 const own=Object.entries(store.records).filter(([key])=>key.startsWith("own:")).map(([key,value])=>{
  const item=value as OwnTask;
  return {...item,id:key.slice(4),kind:t("Personal task")};
 });
 const focus=before ? prep : after ? [] : todayWeek.tasks.filter(item=>addDays(settings.start,(current-1)*7+item.day)===today);
 const personal=own.filter(item=>item.date===today);
 const todayTasks:TaskItem[]=[...focus,...personal];
 const planned=todayTasks.reduce((sum,item)=>sum+item.minutes,0);
 const start=weekStart(before?settings.start:today);
 const nextTask=!before&&!after?todayWeek.tasks.find(item=>statusOf(store.records,item.id)!=="done"):undefined;
 const finishedToday=todayTasks.filter(item=>statusOf(store.records,item.id)==="done").length;
 const upcoming=Array.from({length:7},(_,i)=>addDays(start,i)).map(date=>({date,session:sessionAt(date,settings,store.records)}));
 const classGroups=new Map<string,string[]>();
 upcoming.forEach(({session},i)=>{
  if(!session||session.cancelled)return;
  const interval=session.start+"–"+session.end;
  classGroups.set(interval,[...(classGroups.get(interval)??[]),dayNames[i]]);
 });
 function go(next:View) {setView(next);setMenu(false);window.scrollTo({top:0});if(next!=="labs")setLabFilter("all");}
 function program(next:number) {setWeek(next);go("program");}
 function calendar(next=today) {setDay(next);go("calendar");}
 function showLabs(filter="all"){setLabFilter(filter);go("labs");}
 function createTask(){setOwnId(localId("personal"));setAddTask(true);}
 async function deleteOwn(id:string) {
  for(const key of ["status:"+id,"time:"+id,"own:"+id]) if(key.startsWith("own:")||store.records[key]!==undefined) if(!await store.set(key,null))return false;
  return true;
 }
 const navActive=navigation.find(entry=>entry.id===view);

 return <div className="app-shell">
  {menu&&<button className="nav-overlay" aria-label={t("Close menu")} onClick={()=>setMenu(false)}/>}
  <aside className={"sidebar "+(menu?"open":"")}>
   <button className="brand" onClick={()=>go("today")}><span className="brand-icon"><Icon name="terminal" width="23" height="23"/></span><span><strong>DevOps Flight Deck</strong><small>AI Cloud & DevOps</small></span></button>
   <div className="nav-caption">{t("LEARNING")}</div>
   <nav aria-label={t("Tracker sections")}>{navigation.map(item=><button className={"nav-item "+(view===item.id?"active":"")} aria-current={view===item.id?"page":undefined} key={item.id} onClick={()=>go(item.id)}><Icon name={item.icon}/>{t(item.name)}{view===item.id&&<span className="nav-active-dot"/>}</button>)}</nav>
   <div className="sidebar-bottom">
    <button className={"nav-item "+(view==="settings"?"active":"")} aria-current={view==="settings"?"page":undefined} onClick={()=>go("settings")}><Icon name="settings"/>{t("Settings")}</button>
    <div className="side-cohort"><span className="side-cohort-icon"><Icon name="target" width="18" height="18"/></span><div><strong>{t("DEVOPS STUDY PLAN")}</strong><small>{t("Evening & Weekend")}</small></div></div>
   </div>
  </aside>
  <div className="workspace">
   <header className="topbar">
    <div className="crumb"><button className="icon-button menu-button" aria-label={t("Open menu")} aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name="menu"/></button><span className="crumb-root">{t("My tracker")}</span><Icon name="chevron" width="14" height="14"/><strong>{t(navActive?.name??"Settings")}</strong></div>
    <div className="topbar-right"><button className="date-chip" onClick={()=>calendar()}><Icon name="calendar" width="16" height="16"/><span>{dateLabel(today,{day:"numeric",month:"long"})}</span></button><LanguagePicker/>{onSignOut&&<button className="icon-button outlined" title={t("Sign out")} aria-label={t("Sign out")} disabled={pending.length>0} onClick={()=>void onSignOut()}><Icon name="logout" width="16" height="16"/></button>}</div>
   </header>
   <main>
    {message&&<div className="notice error" role="alert"><Icon name="info"/><span>{t(message)}</span>{!store.ready&&<button className="button secondary" onClick={()=>void read()}>{t("Retry")}</button>}</div>}
    {!store.ready&&!message&&<p className="loading" role="status">{t("Loading saved progress…")}</p>}
    <span className="sr-only" role="status">{pending.length?t("Saving changes"):""}</span>
    {view==="today"&&<>
     <section className="hero">
      <Orbit/>
      <div className="hero-copy">
       <div className="hero-kicker"><i/> CODE PLATOON <span> / </span> {t("STUDY TRACKER")}</div>
       <h1>AI Cloud &amp;<br/>DevOps Engineering<span>.</span></h1>
       <p>{t("Study tracker · Evening & Weekend")}</p>
       <div className="hero-bottom"><button className="button primary" onClick={()=>before?document.getElementById("today-plan")?.scrollIntoView({behavior:"smooth",block:"start"}):program(current)}>{before?t("Start preparation"):after?t("Open program"):t("Open week ")+pad(current)}<Icon name="arrow" width="17" height="17"/></button>
       <span className="hero-date"><Icon name="calendar" width="15" height="15"/>{dateLabel(settings.start)} — {dateLabel(settings.end)}</span></div>
      </div>
     </section>
     <div className="metrics">
      <div className="metric"><IconTile icon="route"/><p>{t("Current week")}</p><strong>{before?"00":after?"28":pad(current)} <small>/ 28</small></strong><span>{before?t("Preparing to start"):after?t("Scheduled course dates ended"):activeModule.short}</span></div>
      <div className="metric"><IconTile icon="chart" color="blue"/><p>{t("Practice progress")}</p><strong>{percent(done,112)}<small>%</small></strong><Progress value={percent(done,112)} color="blue"/><span>{done} {t("of 112 study blocks")}</span></div>
      <div className="metric"><IconTile icon="clock" color="purple"/><p>{t("Hours logged")}</p><strong>{new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(logged/60)} <small>{t("/ 560 h")}</small></strong><span>{t("150 h theory · 410 h practice")}</span></div>
      <button className="metric metric-button" onClick={()=>showLabs("review")}><IconTile icon="repeat" color="green"/><p>{t("To review")}</p><strong>{pad(review)}</strong><span>{t("Open review queue")} <Icon name="arrow" width="13" height="13"/></span></button>
     </div>
     <div className="overview-grid">
      <section id="today-plan" className="panel today-panel">
       <header className="panel-head"><div><p className="eyebrow">{t("DAILY FOCUS")}</p><h2>{t("Today's tasks")}</h2></div><button className="icon-button outlined" onClick={createTask} aria-label={t("Add task")} title={t("Add task")}><Icon name="plus"/></button></header>
       <div className="today-meta"><span className="pill peach"><Icon name="clock" width="14" height="14"/>{planned?hours(planned):t("0 min")} {t("planned")}</span><span>{finishedToday} {t("of")} {todayTasks.length} {t("done")}</span></div>
       {todayTasks.length>0 ? <div className="task-list">{todayTasks.map(item=><TaskRow key={item.id} store={store} task={item} open={()=>setTask(item)}/>)}</div> : <Empty icon="target">{t("There are no tasks scheduled for today.")}{nextTask&&<> {t("The next block is available in the program.")}</>}</Empty>}
       {nextTask&&todayTasks.length===0&&<button className="text-link panel-foot" onClick={()=>setTask(nextTask)}>{nextTask.title}<Icon name="arrow" width="16" height="16"/></button>}
       {before&&<div className="panel-foot muted"><Icon name="terminal" width="16" height="16"/> {t("Choose a local shell, WSL, a VM or a remote host.")}</div>}
      </section>
      <section className="panel week-panel">
       <header className="panel-head"><div><p className="eyebrow">{t("SCHEDULE · CHICAGO")}</p><h2>{before?t("First week"):t("This week")}</h2></div><IconTile icon="calendar" color="blue"/></header>
       <div className="mini-week">{upcoming.map(({date,session},i)=><button className={"mini-day "+(session&&!session.cancelled?"class-day ":"")+(date===today?"is-today":"")} key={date} onClick={()=>calendar(date)} aria-label={dateLabel(date,{weekday:"long",day:"numeric",month:"long"})}><span>{dayNames[i]}</span><strong>{date.slice(-2)}</strong><i/></button>)}</div>
       <div className="week-details">{Array.from(classGroups,([interval,days])=><div key={interval}><i className="marker class-marker"/><span>{days.join(", ")}</span><strong>{interval}</strong></div>)}{!classGroups.size&&<span className="muted">{t("No classes this week.")}</span>}</div>
       <button className="text-link panel-foot" onClick={()=>calendar(before?settings.start:today)}>{t("Open calendar")}<Icon name="arrow" width="16" height="16"/></button>
      </section>
     </div>
     <section className="overview-roadmap"><header className="roadmap-head"><div><p className="eyebrow">{t("LEARNING PATH")}</p><h2>{t("Course modules")}</h2></div><button className="button secondary" onClick={()=>program(current)}>{t("All 28 weeks")} <Icon name="arrow" width="16" height="16"/></button></header>
      <div className="module-grid">{modules.map(item=>{const list=weeks.filter(w=>w.module===item.id).flatMap(w=>w.tasks);const n=list.filter(t=>statusOf(store.records,t.id)==="done").length;return <button className="panel module-card" key={item.id} onClick={()=>program(item.from)}><div className="module-top"><IconTile icon={item.icon} color={item.color}/><span>{t("MODULE")} {pad(item.id)}</span></div><strong>{item.short}</strong><span>{t("Weeks")} {pad(item.from)}–{pad(item.to)} · {item.hours} {t("h")}</span><Progress value={percent(n,list.length)} color={item.color}/></button>;})}</div>
     </section>
    </>}
    {view==="program"&&<ProgramView store={store} week={week} setWeek={setWeek} open={setTask} settings={settings}/>}
    {view==="calendar"&&<CalendarView store={store} day={day} setDay={setDay} today={today} settings={settings} own={own} open={setTask}/>}
    {view==="labs"&&<LabsView store={store} filter={labFilter} setFilter={setLabFilter} settings={settings} own={own} open={setTask}/>}
    {view==="skills"&&<SkillsView store={store}/>}
    {view==="notes"&&<NotesView store={store} current={before?0:current}/>}
    {view==="portfolio"&&<PortfolioView store={store} today={today}/>}
    {view==="settings"&&<SettingsView store={store} settings={settings} preview={preview}/>}
    <footer className="workspace-footer"><span>DEVOPS FLIGHT DECK</span><span>{t("CODE PLATOON · 28 WEEKS · 560 H")}</span></footer>
   </main>
  </div>
  {task&&<Modal title={task.title} onClose={()=>setTask(null)}>
   <div className="stack task-detail"><div className="detail-meta"><span className="pill peach">{task.kind} · {hours(task.minutes)}</span><StatusSelect store={store} id={task.id} title={task.title}/></div>
    {"steps" in task ? <><div><h3>{t("Steps")}</h3><ol>{task.steps.map(step=><li key={step}>{step}</li>)}</ol></div><div className="result"><h3>{t("How to verify")}</h3><p>{task.result}</p></div><ResourceLink resource={task.resource}/>{settings.labUrl&&<External url={settings.labUrl}>{t("Cohort resources")}</External>}</>:<p>{t("Scheduled for")} {dateLabel(task.date,{day:"numeric",month:"long"})}.</p>}
    <RecordForm key={task.id} store={store} id={"time:"+task.id} kind="time" onClose={()=>setTask(null)} build={data=>Number(formText(data,"minutes"))} saveLabel={t("Log time")} onDelete={task.week===undefined?()=>deleteOwn(task.id):undefined}>
     <label>{t("Time spent, minutes")}<input name="minutes" type="number" min="0" max="1440" required defaultValue={timeOf(store.records,task.id)}/></label>
    </RecordForm>
   </div>
  </Modal>}
  {addTask&&<Modal title={t("New task")} onClose={()=>setAddTask(false)}><RecordForm store={store} id={"own:"+ownId} kind="own" onClose={()=>setAddTask(false)} build={data=>({title:formText(data,"title"),date:formText(data,"date"),minutes:Number(formText(data,"minutes"))})}><label>{t("Task title")}<input name="title" required maxLength={160} placeholder={t("For example, review Docker volumes")}/></label><div className="form-grid"><label>{t("Date")}<input name="date" type="date" required defaultValue={today}/></label><label>{t("Planned minutes")}<input name="minutes" type="number" required min="10" max="180" defaultValue="60"/></label></div></RecordForm></Modal>}
 </div>;
}
