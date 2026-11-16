"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { getCurriculum, resources, type PortfolioProject } from "./curriculum";
import { useLocale } from "./locale";
import { addDays, dateKey, dateObject, difference, jobStages, normalizedStage, sessionAt, statuses, weekStart, type Job, type Note, type OwnTask, type ProjectDetails, type Records, type Session, type Settings } from "./tracker-model";
import { Checklist, Empty, External, IconTile, Modal, Progress, RecordForm, ResourceLink, SectionTitle, TaskRow, checkedCount, formText, localId, pad, percent, statusOf, timeOf, type Store, type TaskItem } from "./ui";

type OpenTask=(task:TaskItem)=>void;
type OwnItem=OwnTask&{id:string;kind:string};
function recordList<T>(records:Records,prefix:string) {
 return Object.entries(records).filter(([key])=>key.startsWith(prefix+":")).map(([key,value])=>({id:key,value:value as T}));
}
function IconButton({icon,label,onClick,disabled=false}:{icon:string;label:string;onClick:()=>void;disabled?:boolean}){
 return <button className="icon-button outlined" title={label} aria-label={label} onClick={onClick} disabled={disabled}><Icon name={icon} width="18" height="18"/></button>;
}

export function ProgramView({store,week,setWeek,open,settings}:{store:Store;week:number;setWeek:(week:number)=>void;open:OpenTask;settings:Settings}){
 const {language,t,dateLabel}=useLocale();
 const {modules,weeks}=getCurriculum(language);
 const item=weeks[week-1], module=modules.find(m=>m.id===item.module)!;
 const date=addDays(settings.start,(week-1)*7);
 const last=addDays(date,6);
 const weekEnd=settings.end>=date&&settings.end<last?settings.end:last;
 const done=item.tasks.filter(task=>statusOf(store.records,task.id)==="done").length;
 return <>
  <SectionTitle eyebrow={t("01 / LEARNING PATH")} title={t("28-week program")} description={t("Five Code Platoon modules and hands-on labs of 2–3 hours each.")}/>
  <label className="panel mobile-week-picker">{t("Jump to a week")}<select value={week} onChange={e=>setWeek(Number(e.target.value))}>{modules.map(m=><optgroup key={m.id} label={m.short}>{weeks.filter(w=>w.module===m.id).map(w=><option key={w.number} value={w.number}>{pad(w.number)} · {w.title}</option>)}</optgroup>)}</select></label>
  <div className="program-layout">
   <section className="panel program-nav" aria-label={t("Course modules")}><h2>{t("Modules")}</h2>{modules.map(m=>{
    const all=weeks.filter(w=>w.module===m.id).flatMap(w=>w.tasks), n=all.filter(t=>statusOf(store.records,t.id)==="done").length;
    return <div className={"program-module "+(m.id===module.id?"selected":"")} key={m.id}><button className="module-select" aria-expanded={m.id===module.id} onClick={()=>setWeek(m.from)}><IconTile icon={m.icon} color={m.color}/><span><strong>{m.short}</strong><small>{pad(m.from)}–{pad(m.to)} · {m.hours} {t("h ·")} {percent(n,all.length)}%</small></span><Icon name={m.id===module.id?"down":"chevron"} width="16" height="16"/></button>
     {m.id===module.id&&<div className="program-week-list">{weeks.filter(w=>w.module===m.id).map(w=><button key={w.number} className={w.number===week?"selected":""} aria-current={w.number===week?"step":undefined} onClick={()=>setWeek(w.number)}><span>{pad(w.number)}</span>{w.title}</button>)}</div>}
    </div>;
   })}</section>
   <section className="panel week-detail"><div className="week-detail-controls"><span className="pill peach">{t("MODULE")} {pad(module.id)} {t("· WEEK")} {pad(week)}</span><div><IconButton icon="left" label={t("Previous week")} disabled={week===1} onClick={()=>setWeek(week-1)}/><IconButton icon="chevron" label={t("Next week")} disabled={week===28} onClick={()=>setWeek(week+1)}/></div></div>
    <h2>{item.title}</h2><p className="muted">{dateLabel(date)} – {dateLabel(weekEnd)} · {module.name}</p>
    <div className="week-progress"><Progress value={percent(done,item.tasks.length)} color={module.color}/><small>{done} / {item.tasks.length} {t("done")}</small></div>
    <div className="task-list">{item.tasks.map(task=><div key={task.id}><span className="mini-label">{dateLabel(addDays(date,task.day),{weekday:"short",day:"numeric",month:"short"})}</span><TaskRow task={task} store={store} open={()=>open(task)}/></div>)}</div>
    <div className="panel-foot resource-list"><ResourceLink resource={item.resource}/>{settings.labUrl&&<External url={settings.labUrl}>{t("Cohort labs")}</External>}</div>
   </section>
  </div>
  <div className="notice"><Icon name="info"/><span>{t("The catalog defines the module ranges and hours. The weekly topics and labs are a suggested study path. Planned time and actual hours are tracked separately.")}</span></div>
 </>;
}

export function CalendarView({store,day,setDay,today,settings,own,open}:{store:Store;day:string;setDay:(day:string)=>void;today:string;settings:Settings;own:OwnItem[];open:OpenTask}){
 const {language,t,dateLabel,hours,dayNames}=useLocale();
 const {weeks}=getCurriculum(language);
 const month=day.slice(0,7)+"-01", first=weekStart(month);
 const monthDate=dateObject(month);
 const nextMonth=dateKey(new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,1,12)));
 const previousMonth=dateKey(new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()-1,1,12)));
 const dayCount=Math.ceil(difference(nextMonth,first)/7)*7;
 const [edit,setEdit]=useState(false);
 const scheduled=(date:string)=>{
  const offset=difference(date,settings.start);
  return offset>=0&&offset<196&&date<=settings.end ? weeks[Math.floor(offset/7)].tasks.filter(t=>t.day===offset%7):[];
 };
 const classEvent=sessionAt(day,settings,store.records);
 const actualKey="time:class-"+day;
 const sessionKey="session:"+day;
 const personal=own.filter(item=>item.date===day);
 const assigned:TaskItem[]=[...scheduled(day),...personal];
 const monthLabel=dateLabel(month,{month:"long",year:"numeric"});
 return <>
  <SectionTitle eyebrow={t("02 / SCHEDULE")} title={t("Class calendar")} description={t("Cohort classes, independent practice and personal tasks. Class times use Chicago time.")}/>
  <div className="calendar-layout">
   <section className="panel calendar-panel"><header className="panel-head"><div><p className="eyebrow">AMERICA/CHICAGO</p><h2 className="month-name">{monthLabel}</h2></div><div className="calendar-controls"><button className="button secondary compact" onClick={()=>setDay(today)}>{t("Today")}</button><IconButton icon="left" label={t("Previous month")} onClick={()=>setDay(previousMonth)}/><IconButton icon="chevron" label={t("Next month")} onClick={()=>setDay(nextMonth)}/></div></header>
    <div className="month-grid">{dayNames.map(d=><span className="weekday" key={d}>{d}</span>)}{Array.from({length:dayCount},(_,i)=>{
     const d=addDays(first,i), e=sessionAt(d,settings,store.records), practice=scheduled(d).length||own.some(t=>t.date===d);
     return <button key={d} className={"calendar-day "+(d.slice(0,7)!==day.slice(0,7)?"outside ":"")+(d===day?"selected ":"")+(d===today?"actual-today":"")} aria-pressed={d===day} aria-label={dateLabel(d,{weekday:"long",day:"numeric",month:"long"})+(e&&!e.cancelled?t(", class"):"")+(practice?t(", practice"):"")} onClick={()=>setDay(d)}><strong>{Number(d.slice(-2))}</strong><span>{e&&!e.cancelled&&<i className="marker class-marker"/>}{!!practice&&<i className="marker practice-marker"/>}{e?.cancelled&&<i className="marker cancel-marker"/>}</span></button>;
    })}</div>
    <div className="calendar-legend"><span><i className="marker class-marker"/>{t("Class")}</span><span><i className="marker practice-marker"/>{t("Practice")}</span><span><i className="marker cancel-marker"/>{t("Cancel")}</span></div>
   </section>
   <section className="panel calendar-agenda"><header className="panel-head"><div><p className="eyebrow">{t("ON THIS DAY")}</p><h2>{dateLabel(day,{day:"numeric",month:"long"})}</h2></div><IconButton icon="edit" label={t("Edit class")} onClick={()=>setEdit(true)}/></header>
    {classEvent&&!classEvent.cancelled&&<div className="agenda-event"><div><IconTile icon="calendar" color="blue"/><div><strong>{t("Code Platoon class")}</strong><small>{classEvent.start}–{classEvent.end} CT · {hours(classEvent.minutes)}{classEvent.minutes===480?t(" after subtracting the break"):""}</small></div></div>
     {settings.classUrl&&<External url={settings.classUrl}>{t("Open class link")}</External>}
     <button className={"button "+(store.records[actualKey]?"secondary":"soft")} disabled={!store.ready||store.busy(actualKey)} onClick={()=>void store.set(actualKey,store.records[actualKey]?null:classEvent.minutes)}><Icon name={store.records[actualKey]?"check":"plus"} width="16" height="16"/>{store.records[actualKey]?t("Hours logged · undo"):t("Log ")+hours(classEvent.minutes)}</button>
    </div>}
    {classEvent?.cancelled&&<p className="notice">{t("Class canceled.")}</p>}{(!classEvent||classEvent.cancelled)&&!!store.records[actualKey]&&<button className="button secondary" disabled={!store.ready||store.busy(actualKey)} onClick={()=>void store.set(actualKey,null)}>{t("Remove logged hours")}</button>}
    {assigned.map(task=><TaskRow key={task.id} task={task} store={store} open={()=>open(task)}/>)}
    {!classEvent&&!assigned.length&&<Empty icon="calendar">{t("No classes or tasks on this day.")}</Empty>}
    <p className="muted fine">{t("The catalog supplies a default schedule. Edit a date to enter a change or cancellation.")}</p>
   </section>
  </div>
  {edit&&<Modal title={t("Class · ")+dateLabel(day)} onClose={()=>setEdit(false)}><RecordForm store={store} id={sessionKey} kind="session" onClose={()=>setEdit(false)} build={data=>({start:formText(data,"start"),end:formText(data,"end"),minutes:Number(formText(data,"minutes")),cancelled:data.get("cancelled")==="on"})} onDelete={store.records[sessionKey]?()=>store.set(sessionKey,null):undefined}><div className="form-grid"><label>{t("Start time CT")}<input type="time" name="start" required defaultValue={classEvent?.start??"17:30"}/></label><label>{t("End time CT")}<input type="time" name="end" required defaultValue={classEvent?.end??"21:30"}/></label></div><label>{t("Class minutes excluding breaks")}<input type="number" name="minutes" min="0" max="1440" required defaultValue={classEvent?.minutes??240}/></label><label className="inline-check"><input type="checkbox" name="cancelled" defaultChecked={classEvent?.cancelled}/> {t("Cancel class on this date")}</label><p className="fine muted">{t("To move a class, cancel it on the original date and add it on the new date. You can remove hours already logged before moving it.")}</p></RecordForm></Modal>}
 </>;
}

export function LabsView({store,filter,setFilter,settings,own,open}:{store:Store;filter:string;setFilter:(status:string)=>void;settings:Settings;own:OwnItem[];open:OpenTask}){
 const {language,t}=useLocale();
 const {modules,tasks,weeks}=getCurriculum(language);
 const [query,setQuery]=useState(""),[module,setModule]=useState("all"),[limit,setLimit]=useState(16);
 const all:TaskItem[]=filter==="review"?[...tasks,...own]:tasks;
 const found=all.filter(task=>(filter==="all"||statusOf(store.records,task.id)===filter)&&(module==="all"||(task.week!==undefined&&String(task.week?weeks[task.week-1].module:0)===module))&&(!query.trim()||[task.title,task.kind,"steps" in task?resources[task.resource][0]:"","steps" in task?task.steps.join(" "):""].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
 return <>
  <SectionTitle eyebrow={t("03 / PRACTICE")} title={t("Labs")} description={t("Browse labs by module, with steps, verification criteria and documentation links.")}>{settings.labUrl&&<External url={settings.labUrl}>{t("Cohort resources")}</External>}</SectionTitle>
  <section className="panel labs-panel"><div className="filters"><label className="search-field"><Icon name="search" width="18" height="18"/><input aria-label={t("Search labs")} placeholder={t("Search, for example Terraform…")} value={query} onChange={e=>{setQuery(e.target.value);setLimit(16);}}/></label><select aria-label={t("Filter by module")} value={module} onChange={e=>{setModule(e.target.value);setLimit(16);}}><option value="all">{t("All modules")}</option><option value="0">{t("Preparation")}</option>{modules.map(m=><option value={m.id} key={m.id}>{m.short}</option>)}</select><select aria-label={t("Filter by status")} value={filter} onChange={e=>{setFilter(e.target.value);setLimit(16);}}><option value="all">{t("All statuses")}</option>{Object.entries(statuses).map(([id,label])=><option value={id} key={id}>{t(label)}</option>)}</select></div>
   <p className="list-count">{t("Results ·")} {found.length}</p>
   {found.length ? <div className="task-list">{found.slice(0,limit).map(task=><TaskRow key={task.id} task={task} store={store} open={()=>open(task)}/>)}</div> : <Empty icon={filter==="review"?"repeat":"search"}>{filter==="review"?t("Set a task to Review to add it to this queue."):t("No matching labs.")}</Empty>}
   {found.length>limit&&<button className="button secondary panel-foot" onClick={()=>setLimit(limit+16)}>{t("Show more")} <Icon name="down" width="16" height="16"/></button>}
  </section>
 </>;
}

export function SkillsView({store}:{store:Store}){
 const {language,t}=useLocale();
 const {skills}=getCurriculum(language);
 const total=skills.reduce((n,s)=>n+s.items.length,0), complete=skills.reduce((n,s)=>n+checkedCount(store,s.id,s.items),0);
 return <>
  <SectionTitle eyebrow={t("04 / SKILL MATRIX")} title={t("Technical checklists")} description={t("Check off a skill when you can reproduce the result and explain it.")}/>
  <div className="panel skill-overall"><IconTile icon="checks" color="orange"/><div><strong>{t("Skills across all topics")}</strong><small>{complete} {t("of")} {total} {t("verified")}</small></div><Progress value={percent(complete,total)}/><strong>{percent(complete,total)}%</strong></div>
  <div className="card-grid">{skills.map(item=>{const n=checkedCount(store,item.id,item.items);return <section className="panel feature-card" key={item.id}><header className="feature-head"><IconTile icon={item.icon} color={item.color}/><div><h2>{item.name}</h2><small>{t("Weeks")} {item.weeks}</small></div><span className="pill neutral">{n}/{item.items.length}</span></header><Progress value={percent(n,item.items.length)} color={item.color}/><Checklist items={item.items} prefix={item.id} store={store}/><ResourceLink resource={item.resource}/></section>;})}</div>
 </>;
}

export function NotesView({store,current}:{store:Store;current:number}){
 const {language,t,dateLabel}=useLocale();
 const {weeks}=getCurriculum(language);
 const [edit,setEdit]=useState<{id:string;value?:Note}|null>(null),[query,setQuery]=useState(""),[week,setWeek]=useState("all");
 const all=recordList<Note>(store.records,"note");
 const shown=all.filter(({value})=>(week==="all"||String(value.week)===week)&&[value.title,value.body].join(" ").toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>b.value.updated.localeCompare(a.value.updated));
 const close=()=>setEdit(null);
 return <>
  <SectionTitle eyebrow={t("05 / STUDY JOURNAL")} title={t("Notes")} description={t("Keep commands, discoveries, troubleshooting notes and ideas worth revisiting.")}><button className="button primary" onClick={()=>setEdit({id:"note:"+localId("n")})}><Icon name="plus" width="18" height="18"/> {t("New note")}</button></SectionTitle>
  <div className="panel filters note-filters"><label className="search-field"><Icon name="search" width="18" height="18"/><input aria-label={t("Search notes")} placeholder={t("Search your notes…")} value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label={t("Filter by week")} value={week} onChange={e=>setWeek(e.target.value)}><option value="all">{t("All weeks")}</option><option value="0">{t("No week / preparation")}</option>{weeks.map(w=><option key={w.number} value={w.number}>{t("Week")} {pad(w.number)}</option>)}</select></div>
  {shown.length ? <div className="card-grid">{shown.map(({id,value})=><article className="panel feature-card note-card" key={id}><header className="feature-head"><IconTile icon="notes" color="purple"/><div><h2>{value.title}</h2><small>{value.week?t("Week ")+pad(value.week):t("General")} · {dateLabel(value.updated.slice(0,10))}</small></div><IconButton icon="edit" label={t("Edit ")+value.title} onClick={()=>setEdit({id,value})}/></header><p>{value.body}</p></article>)}</div>:<section className="panel"><Empty>{all.length?t("No matching notes."):t("Your notes will appear here. Start by recording the commands and result of your first lab.")}</Empty></section>}
  {edit&&<Modal title={edit.value?t("Edit note"):t("New note")} onClose={close}><RecordForm store={store} id={edit.id} kind="note" onClose={close} build={data=>({title:formText(data,"title"),body:formText(data,"body"),week:Number(formText(data,"week")),updated:new Date().toISOString()})} onDelete={edit.value?()=>store.set(edit.id,null):undefined}><label>{t("Title")}<input name="title" required maxLength={140} defaultValue={edit.value?.title} placeholder={t("How I diagnosed the failure…")}/></label><label>{t("Week")}<select name="week" defaultValue={edit.value?.week??current}><option value={0}>{t("No week / preparation")}</option>{weeks.map(w=><option key={w.number} value={w.number}>{pad(w.number)} · {w.title}</option>)}</select></label><label>{t("Note")}<textarea name="body" rows={8} required maxLength={12000} defaultValue={edit.value?.body} placeholder={t("Symptom → command → result")}/></label></RecordForm></Modal>}
 </>;
}

export function PortfolioView({store,today}:{store:Store;today:string}){
 const {language,t,dateLabel}=useLocale();
 const {career,projects}=getCurriculum(language);
 const [tab,setTab]=useState("projects"),[project,setProject]=useState<PortfolioProject|null>(null),[job,setJob]=useState<{id:string;value?:Job}|null>(null);
 const jobs=recordList<Job>(store.records,"job").sort((a,b)=>b.value.date.localeCompare(a.value.date));
 const details=project ? store.records["project:"+project.id] as ProjectDetails|undefined:undefined;
 const closeProject=()=>setProject(null), closeJob=()=>setJob(null);
 return <>
  <SectionTitle eyebrow={t("06 / CAREER TRACK")} title={t("Portfolio & career")} description={t("Document your work and prepare for your first DevOps, Cloud or DevSecOps role.")}/>
  <div className="segments" aria-label={t("Portfolio sections")}>{[["projects",t("Projects")],["career",t("Preparation")],["jobs",t("Openings")]].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}{value==="jobs"?" · "+jobs.length:""}</button>)}</div>
  {tab==="projects"&&<div className="card-grid projects-grid">{projects.map((item,i)=>{const n=checkedCount(store,item.id,item.items), info=store.records["project:"+item.id] as ProjectDetails|undefined;return <section className="panel feature-card" key={item.id}><header className="feature-head"><IconTile icon={item.icon} color={item.color}/><div><h2>{item.name}</h2><small>{t("Project")} {pad(i+1)} {t("· Weeks")} {item.weeks}</small></div><IconButton icon="edit" label={t("Project links: ")+item.name} onClick={()=>setProject(item)}/></header><p className="muted">{item.summary}</p><Progress value={percent(n,item.items.length)} color={item.color}/><Checklist items={item.items} prefix={item.id} store={store}/>{info?.notes&&<p className="project-note">{info.notes}</p>}<div className="resource-list">{info?.repo&&<External url={info.repo}>{t("Repository")}</External>}{info?.demo&&<External url={info.demo}>{t("Demo")}</External>}{!info?.repo&&!info?.demo&&<button className="text-link" onClick={()=>setProject(item)}><Icon name="plus" width="16" height="16"/>{t("Add links")}</button>}</div></section>;})}</div>}
  {tab==="career"&&<div className="card-grid">{career.map((item,i)=><section className="panel feature-card" key={item.name}><header className="feature-head"><IconTile icon={["notes","target","brief"][i]} color={["orange","blue","green"][i]}/><div><h2>{item.name}</h2><small>{checkedCount(store,"career-"+i,item.items)} / {item.items.length} {t("done")}</small></div></header><Progress value={percent(checkedCount(store,"career-"+i,item.items),item.items.length)}/><Checklist items={item.items} prefix={"career-"+i} store={store}/></section>)}</div>}
  {tab==="jobs"&&<section className="panel labs-panel"><header className="panel-head"><div><p className="eyebrow">{t("JOB PIPELINE")}</p><h2>{t("Application tracker")}</h2></div><button className="button primary" onClick={()=>setJob({id:"job:"+localId("j")})}><Icon name="plus" width="17" height="17"/> {t("Job opening")}</button></header>{jobs.length?<div className="job-list">{jobs.map(({id,value})=><div className="job-row" key={id}><IconTile icon="brief" color="blue"/><div><strong>{value.role}</strong><small>{value.company} · {dateLabel(value.date)}{value.followup?" · "+t("Follow-up")+" "+dateLabel(value.followup):""}</small></div>{value.url&&<External url={value.url}>{t("Job opening")}</External>}<span className="pill neutral">{t(normalizedStage(value.stage))}</span><IconButton icon="edit" label={t("Edit ")+value.role} onClick={()=>setJob({id,value})}/></div>)}</div>:<Empty icon="brief">{t("Add a job opening to track applications, interviews and follow-up dates.")}</Empty>}</section>}
  {project&&<Modal title={project.name} onClose={closeProject}><RecordForm store={store} id={"project:"+project.id} kind="project" onClose={closeProject} build={data=>({repo:formText(data,"repo"),demo:formText(data,"demo"),notes:formText(data,"notes")})}><label>{t("Repository URL")}<input name="repo" type="url" defaultValue={details?.repo} placeholder="https://github.com/…"/></label><label>{t("Demo URL")}<input name="demo" type="url" defaultValue={details?.demo} placeholder="https://…"/></label><label>{t("Project note")}<textarea name="notes" rows={4} maxLength={2000} defaultValue={details?.notes}/></label></RecordForm></Modal>}
  {job&&<Modal title={job.value?t("Edit job opening"):t("Add job opening")} onClose={closeJob}><RecordForm store={store} id={job.id} kind="job" onClose={closeJob} onDelete={job.value?()=>store.set(job.id,null):undefined} build={data=>({company:formText(data,"company"),role:formText(data,"role"),url:formText(data,"url"),stage:formText(data,"stage"),date:formText(data,"date"),followup:formText(data,"followup")})}><label>{t("Company")}<input name="company" required maxLength={100} defaultValue={job.value?.company}/></label><label>{t("Role")}<input name="role" required maxLength={140} defaultValue={job.value?.role} placeholder="Junior Cloud Engineer"/></label><label>{t("Job opening URL")}<input name="url" type="url" defaultValue={job.value?.url}/></label><label>{t("Status")}<select name="stage" defaultValue={normalizedStage(job.value?.stage??"")}>{jobStages.map(stage=><option key={stage} value={stage}>{t(stage)}</option>)}</select></label><div className="form-grid"><label>{t("Date added / applied")}<input name="date" type="date" required defaultValue={job.value?.date??today}/></label><label>{t("Follow-up date")}<input name="followup" type="date" defaultValue={job.value?.followup}/></label></div></RecordForm></Modal>}
 </>;
}

export function SettingsView({store,settings,preview}:{store:Store;settings:Settings;preview:boolean}){
 const {t}=useLocale();
 const [saved,setSaved]=useState(false);
 return <>
  <SectionTitle eyebrow={t("07 / PREFERENCES")} title={t("Tracker settings")} description={t("Set course dates and add links to class and lab materials.")}/>
  <div className="settings-layout">
   <section className="panel feature-card"><h2>{t("Schedule and materials")}</h2><RecordForm store={store} id="settings" kind="settings" showCancel={false} onClose={()=>setSaved(true)} build={data=>({start:formText(data,"start"),end:formText(data,"end"),classUrl:formText(data,"classUrl"),labUrl:formText(data,"labUrl"),showClasses:data.get("showClasses")==="on"})}><div className="form-grid"><label>{t("Course start date")}<input name="start" type="date" required defaultValue={settings.start}/></label><label>{t("Last day")}<input name="end" type="date" required defaultValue={settings.end}/></label></div><label>{t("Class URL")}<input name="classUrl" type="url" defaultValue={settings.classUrl} placeholder="https://…"/></label><label>{t("Cohort labs URL")}<input name="labUrl" type="url" defaultValue={settings.labUrl} placeholder="https://…"/></label><label className="inline-check"><input type="checkbox" name="showClasses" defaultChecked={settings.showClasses!==false}/>{t("Use the Code Platoon class schedule")}</label>{saved&&<p className="success-text" role="status">{t("Settings saved.")}</p>}</RecordForm></section>
   <section className="panel feature-card"><header className="feature-head"><IconTile icon="info" color="blue"/><div><h2>{t("About the plan")}</h2><small>AI Cloud & DevOps</small></div></header><div className="settings-copy"><p>{t("Choose dates for your cohort or your own study plan. Enable the template schedule if your class follows the Code Platoon catalog.")}</p><p>{t("The catalog lists 150 hours of theory and 410 hours of practice. Log actual study time manually. If a lab takes place during class, count that time once.")}</p><p>{preview?t("Preview changes are stored in this browser."):t("Your records are tied to your account and available on other devices after you sign in.")}</p></div><External url="https://www.codeplatoon.org/hubfs/Website/Files/Code_Platoon_Academic_Catalog_FS_DevOps.pdf">{t("2026 academic catalog")}</External><External url="https://www.codeplatoon.org/calendar">{t("Code Platoon calendar")}</External></section>
  </div>
 </>;
}
