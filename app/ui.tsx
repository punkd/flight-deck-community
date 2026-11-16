"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { resources, type Task } from "./curriculum";
import { useLocale } from "./locale";
import { recordSchemas, statuses, type Records, type Status } from "./tracker-model";

export type Store={records:Records; set:(key:string,value:unknown)=>Promise<boolean>; busy:(key:string)=>boolean; ready:boolean};
export type TaskItem=Task|{id:string;title:string;minutes:number;week?:undefined;kind:string;date:string};
export const statusOf=(records:Records,id:string)=>(records["status:"+id] as Status|undefined)??"todo";
export const timeOf=(records:Records,id:string)=>(records["time:"+id] as number|undefined)??0;
export const percent=(n:number,total:number)=>total ? Math.round(100*n/total) : 0;
export const pad=(value:number)=>String(value).padStart(2,"0");
export const formText=(data:FormData,key:string)=>String(data.get(key)??"").trim();
export const localId=(prefix:string)=>prefix+"-"+crypto.randomUUID();

export function IconTile({icon,color="orange"}:{icon:string;color?:string}) {return <span className={"icon-tile "+color}><Icon name={icon}/></span>;}
export function Progress({value,color="orange"}:{value:number;color?:string}) {const {t}=useLocale();return <div className={"progress "+color} role="progressbar" aria-label={t("Progress")} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{width:value+"%"}}/></div>;}
export function Empty({icon="notes",children}:{icon?:string;children:ReactNode}) {return <div className="empty"><Icon name={icon}/><p>{children}</p></div>;}
export function External({url,children}:{url:string;children:ReactNode}) {return <a className="text-link" href={url} target="_blank" rel="noreferrer">{children}<Icon name="external" width="15" height="15"/></a>;}
export function ResourceLink({resource}:{resource:keyof typeof resources}) {const {t}=useLocale();const [title,url]=resources[resource];return <External url={url}>{t(title)}</External>;}
export function SectionTitle({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children?:ReactNode}) {
 return <div className="section-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="section-description">{description}</p></div>{children}</div>;
}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const {t}=useLocale();
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
 return <dialog ref={ref} className="modal" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="modal-content"><header><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label={t("Close")}><Icon name="x"/></button></header>{children}</div>
 </dialog>;
}
export function RecordForm({store,id,kind,onClose,build,children,saveLabel="Save",onDelete,showCancel=true}:{store:Store;id:string;kind:string;onClose:()=>void;build:(data:FormData)=>unknown;children:ReactNode;saveLabel?:string;onDelete?:()=>Promise<boolean>;showCancel?:boolean}) {
 const {t}=useLocale();
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const parsed=recordSchemas[kind].safeParse(build(new FormData(event.currentTarget)));
  if(!parsed.success){setError(t(parsed.error.issues[0]?.message??"Check the fields."));return;}
  setSaving(true);setError("");
  const ok=await store.set(id,parsed.data);
  setSaving(false);
  if(ok) onClose();
  else setError(t("The record was not saved. Try again."));
 }
 return <form className="stack form" onSubmit={submit}>{children}{error&&<p className="form-error" role="alert">{error}</p>}
  <footer>{onDelete&&<button type="button" className="button danger" disabled={saving||!store.ready} onClick={async()=>{if(!confirm(t("Delete this record?")))return;setSaving(true);if(await onDelete())onClose();else{setSaving(false);setError(t("The record was not deleted. Try again."));}}}><Icon name="trash"/>{t("Delete")}</button>}
   {showCancel&&<button type="button" className="button secondary" onClick={onClose}>{t("Cancel")}</button>}<button className="button primary" disabled={saving||!store.ready}>{saving?t("Saving…"):t(saveLabel)}</button></footer>
 </form>;
}
export function StatusSelect({store,id,title}:{store:Store;id:string;title:string}) {
 const {t}=useLocale();
 const key="status:"+id;
 return <select aria-label={t("Status: ")+title} className={"status-select "+statusOf(store.records,id)} value={statusOf(store.records,id)} onChange={e=>void store.set(key,e.target.value)} disabled={!store.ready||store.busy(key)}>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select>;
}
export function TaskRow({task,store,open}:{task:TaskItem;store:Store;open:()=>void}) {
 const {t,hours}=useLocale();
 const status=statusOf(store.records,task.id), key="status:"+task.id;
 return <div className="task-row">
  <button className={"round-check "+(status==="done"?"checked":"")} aria-pressed={status==="done"} aria-label={(status==="done"?t("Unmark: "):t("Mark complete: "))+task.title} disabled={!store.ready||store.busy(key)} onClick={()=>void store.set(key,status==="done"?"todo":"done")}>{status==="done"&&<Icon name="check" width="14" height="14"/>}</button>
  <button className="task-title" onClick={open}><strong>{task.title}</strong><small>{task.kind}{task.week ? t(" · Week ")+pad(task.week):""}{timeOf(store.records,task.id)>0 ? t(" · Logged ")+hours(timeOf(store.records,task.id)):""}</small></button>
  <span className="task-time">{hours(task.minutes)}</span><StatusSelect store={store} id={task.id} title={task.title}/>
 </div>;
}
export function Checklist({items,prefix,store}:{items:readonly string[];prefix:string;store:Store}) {
 return <div className="checklist">{items.map((item,i)=>{
  const key="check:"+prefix+"-"+i;
  return <label key={item}><input type="checkbox" checked={store.records[key]===true} disabled={!store.ready||store.busy(key)} onChange={e=>void store.set(key,e.target.checked)}/><span>{item}</span></label>;
 })}</div>;
}
export const checkedCount=(store:Store,prefix:string,items:readonly string[])=>items.filter((_,i)=>store.records["check:"+prefix+"-"+i]===true).length;
