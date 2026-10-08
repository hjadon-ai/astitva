const {validDate}=require('./diet');
const {fields}=require('../models/Diet');
const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
function historyRange(end,timezone='UTC',now=new Date()){
 let today;try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));today=`${p.year}-${p.month}-${p.day}`;}catch{return {error:'Use a valid IANA timezone.'}}
 const d=new Date(today+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-3);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));const earliest=d.toISOString().slice(0,10);
 end=end||today;if(!validDate(end)||end<earliest||end>today)return {error:'End date must be within the past three calendar months, through today.'};
 return {start:shift(end,-9)<earliest?earliest:shift(end,-9),end,earliest,latest:today};
}
function historyDays(range,meals,water){const m=new Map(meals.map(r=>[r._id,r])),w=new Map(water.map(r=>[r._id,r]));const days=[];for(let date=range.start;date<=range.end;date=shift(date,1)){const meal=m.get(date),entry=w.get(date);days.push({date,totals:{...Object.fromEntries(fields.map(key=>[key,Math.round((meal?.[key]||0)*10)/10])),waterMilliliters:entry?.waterMilliliters||0},mealCount:meal?.count||0,waterEntryCount:entry?.count||0})}return days}
module.exports={historyRange,historyDays,shift};
