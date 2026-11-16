"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { spanish } from "./content/messages";
import { dateLabel as formatDate, hours as formatHours, dayNames as englishDays } from "./tracker-model";

export type Language="en"|"es";
const languageKey="flight-deck-language";
type Locale={
 language:Language;
 setLanguage:(language:Language)=>void;
 t:(message:string)=>string;
 dateLabel:(key:string,format?:Intl.DateTimeFormatOptions)=>string;
 hours:(minutes:number)=>string;
 dayNames:string[];
};
const LocaleContext=createContext<Locale|null>(null);

export function LocaleProvider({children}:{children:ReactNode}) {
 const [language,setSelected]=useState<Language>("en");
 useEffect(()=>{
  try {if(localStorage.getItem(languageKey)==="es") setSelected("es");}
  catch {}
 },[]);
 useEffect(()=>{document.documentElement.lang=language;},[language]);
 const locale=useMemo<Locale>(()=>{
  const t=(message:string)=>language==="es"?(Object.hasOwn(spanish,message)?spanish[message]:message):message;
  return {language,t,dayNames:englishDays.map(t),dateLabel:(key,format)=>formatDate(key,format,language),hours:minutes=>formatHours(minutes,language),setLanguage:next=>{
   setSelected(next);
   try {localStorage.setItem(languageKey,next);}
   catch {}
  }};
 },[language]);
 return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useLocale() {
 const locale=useContext(LocaleContext);
 if(!locale) throw Error("LocaleProvider is required");
 return locale;
}
export function LanguagePicker() {
 const {language,setLanguage,t}=useLocale();
 return <div className="language-picker" role="group" aria-label={t("Language")}>
  <button type="button" aria-label="English" lang="en" aria-pressed={language==="en"} onClick={()=>setLanguage("en")}>EN</button>
  <button type="button" aria-label="Español" lang="es" aria-pressed={language==="es"} onClick={()=>setLanguage("es")}>ES</button>
 </div>;
}
