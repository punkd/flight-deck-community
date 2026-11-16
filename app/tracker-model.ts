import { z } from "zod";

export const statuses = {todo:"Planned", doing:"In progress", done:"Done", review:"Review"} as const;
export type Status = keyof typeof statuses;
export const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function dateObject(key:string) { return new Date(key + "T12:00:00Z"); }
export function dateKey(date:Date) { return date.toISOString().slice(0,10); }
export function addDays(key:string, days:number) {
  const date=dateObject(key);
  date.setUTCDate(date.getUTCDate()+days);
  return dateKey(date);
}
export function weekday(key:string) { return (dateObject(key).getUTCDay()+6)%7; }
export function weekStart(key:string) {return addDays(key,-weekday(key));}
export function difference(a:string,b:string) {return Math.round((+dateObject(a)-+dateObject(b))/86400000);}
export function chicagoToday() {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get = (key:string) => parts.find(part=>part.type===key)!.value;
  return get("year")+"-"+get("month")+"-"+get("day");
}
export function dateLabel(key:string, format:Intl.DateTimeFormatOptions = {day:"numeric",month:"short"},language="en") {
  return new Intl.DateTimeFormat(language,{...format,timeZone:"UTC"}).format(dateObject(key));
}
export function hours(minutes:number,language="en") {
  if(minutes < 60) return minutes+" min";
  return new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(minutes/60)+" h";
}
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d=dateObject(value);
  return value >= "2020-01-01" && value <= "2099-12-31" && !Number.isNaN(+d) && dateKey(d)===value;
},"Check the date.");
export const urlSchema=z.string().trim().max(1200).refine(value=>{
  if(!value) return true;
  try { return ["https:","http:"].includes(new URL(value).protocol); }
  catch { return false; }
},"Use a URL beginning with http:// or https://.");
export const timeSchema=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const minutesSchema=z.number().int().min(0).max(1440);
export const sessionSchema=z.object({start:timeSchema,end:timeSchema,minutes:minutesSchema,cancelled:z.boolean().default(false)})
  .refine(s=>s.start<s.end,"The end time must be after the start time.")
  .refine(s=>{
    const toMinutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
    return s.minutes<=toMinutes(s.end)-toMinutes(s.start);
  },"Class minutes exceed the duration of the session.");
export const defaultSessions:Record<number,Session> = {
  0:{start:"17:30",end:"21:30",minutes:240,cancelled:false},
  1:{start:"17:30",end:"21:30",minutes:240,cancelled:false},
  3:{start:"17:30",end:"21:30",minutes:240,cancelled:false},
  5:{start:"08:00",end:"17:00",minutes:480,cancelled:false},
};
export const settingsSchema=z.object({
  start:dateSchema, end:dateSchema, labUrl:urlSchema, classUrl:urlSchema, showClasses:z.boolean().default(true),
}).refine(s=>s.start<=s.end,"The end date must be on or after the start date.");
export function independentSchedule(today:string):Settings {
 const start=weekStart(today);
 return {start,end:addDays(start,195),labUrl:"",classUrl:"",showClasses:false};
}
export const noteSchema=z.object({title:z.string().trim().min(1).max(140), body:z.string().trim().min(1).max(12000), week:z.number().int().min(0).max(28), updated:z.string().datetime()});
export const ownTaskSchema=z.object({title:z.string().trim().min(1).max(160), date:dateSchema, minutes:z.number().int().min(10).max(180)});
export const jobStages=["Planned","Applied","Interview","Offer","Closed"] as const;
const legacyStages=["В планах","Отклик отправлен","Собеседование","Оффер","Закрыта"];
export function normalizedStage(stage:string) {
 return jobStages.find(value=>value===stage)??jobStages[legacyStages.indexOf(stage)]??jobStages[0];
}
export const jobSchema=z.object({company:z.string().trim().min(1).max(100),role:z.string().trim().min(1).max(140),url:urlSchema,stage:z.enum(jobStages),date:dateSchema,followup:z.union([dateSchema,z.literal("")])});
export const projectSchema=z.object({repo:urlSchema,demo:urlSchema,notes:z.string().trim().max(2000)});
export const recordSchemas:Record<string,z.ZodTypeAny>={
  status:z.enum(["todo","doing","done","review"]), time:minutesSchema, check:z.boolean(), settings:settingsSchema,
  note:noteSchema, own:ownTaskSchema, job:jobSchema, project:projectSchema, session:sessionSchema,
};
export function parseRecord(input:unknown) {
  if(!input || typeof input!=="object" || !("key" in input) || !("value" in input)) return {error:"Invalid record."} as const;
  const {key,value}=input;
  if(typeof key!=="string" || !/^(settings|(?:status|time|check|note|own|job|project|session):[a-z0-9-]{1,60})$/.test(key)) return {error:"Invalid record."} as const;
  if(value===null) return {key,value:null} as const;
  const checked=recordSchemas[key.split(":")[0]].safeParse(value);
  if(!checked.success) return {error:checked.error.issues[0]?.message??"Check the fields."} as const;
  return {key,value:JSON.stringify(checked.data)} as const;
}
export type Settings=z.infer<typeof settingsSchema>;
export type Session=z.infer<typeof sessionSchema>;
export type Note=z.infer<typeof noteSchema>;
export type OwnTask=z.infer<typeof ownTaskSchema>;
export type Job=z.infer<typeof jobSchema>;
export type ProjectDetails=z.infer<typeof projectSchema>;
export type Records=Record<string,unknown>;
export function sessionAt(date:string, settings:Settings, records:Records):Session|undefined {
  const special=records["session:"+date] as Session|undefined;
  if(special) return special;
  if(settings.showClasses===false || date < settings.start || date > settings.end) return;
  return defaultSessions[weekday(date)];
}
