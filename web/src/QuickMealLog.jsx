import {useEffect,useState,useRef,useId} from 'react';
import {Search,Plus,Library,Utensils,ChevronDown,ChevronRight,X} from 'lucide-react';
import {Button,StatusBanner} from './ui';
import {repeatMealInput} from './repeatMeal';

export default function QuickMealLog({apiRequest,date,onAdded,onManual,onLibraries,libraryOpen}){
 const menuRef=useRef(null),inputRef=useRef(null),quantityRef=useRef(null),scopeRef=useRef(null),menuId=useId();
 const [open,setOpen]=useState(false),[scope,setScope]=useState('all'),[collapsed,setCollapsed]=useState(new Set()),[libraries,setLibraries]=useState([]);
 const [recent,setRecent]=useState([]),[recentLoading,setRecentLoading]=useState(true),[recentError,setRecentError]=useState(''),[recentVersion,setRecentVersion]=useState(0),[browseView,setBrowseView]=useState('recent');
 const [items,setItems]=useState([]),[query,setQuery]=useState(''),[selected,setSelected]=useState(null),[quantity,setQuantity]=useState('1'),[mealType,setMealType]=useState('breakfast'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;setRecentLoading(true);setRecentError('');
  apiRequest('/api/diet/meals/recent').then(result=>{if(!Array.isArray(result?.meals))throw Error('Restart the local server to load recent meals.');if(active)setRecent(result.meals)}).catch(e=>{if(active)setRecentError(e.status===404?'Restart the local server to enable Recent meals, then retry.':e.message)}).finally(()=>{if(active)setRecentLoading(false)});
  return()=>{active=false};
 },[apiRequest,recentVersion]);
 useEffect(()=>{let active=true;async function load(){try{
  await apiRequest('/api/diet/libraries/migrate-existing',{method:'POST',body:'{}'});
  const list=await apiRequest('/api/diet/libraries?scope=mine');
  const results=await Promise.allSettled(list.libraries.map(l=>apiRequest('/api/diet/libraries/'+l.id)));
  if(!active)return;
  setError('');
  setLibraries(results.flatMap(r=>r.status==='fulfilled'?[{id:r.value.library.id,name:r.value.library.name}]:[]));
  setItems(results.flatMap(r=>r.status==='fulfilled'?r.value.library.items.map(item=>({...item,libraryId:r.value.library.id,libraryName:r.value.library.name})):[]));
  if(results.some(r=>r.status==='rejected'))setError('Some libraries could not load. Reopen Diet to retry.');
  else if(list.hasMore)setError('Search covers the first 200 added libraries.');
 }catch(e){if(active)setError(e.message)}finally{if(active)setLoading(false)}}load();return()=>{active=false}},[apiRequest,libraryOpen]);
 useEffect(()=>{if(!open)return;const outside=event=>{if(menuRef.current&&!menuRef.current.contains(event.target))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
 const term=selected?'':query.trim().toLowerCase();
 const matches=items.filter(i=>(scope==='all'||i.libraryId===scope)&&(!term||(i.name+' '+i.servingDescription+' '+i.libraryName).toLowerCase().includes(term)));
 const groups=libraries.filter(l=>scope==='all'||l.id===scope).map(l=>({...l,items:matches.filter(i=>i.libraryId===l.id)})).filter(l=>!term||l.items.length);
 const close=()=>{inputRef.current?.focus();setOpen(false)};
 const choose=item=>{setSelected(item);setQuantity('1');setQuery(item.name);setMealType(item.category);close()};
 const chooseRecent=meal=>{setSelected({...meal,category:meal.mealType,recorded:true});setQuantity('1');setQuery(meal.name);setMealType(meal.mealType);setOpen(false);quantityRef.current?.focus();};
 const toggle=id=>setCollapsed(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next});
 async function add(event){event.preventDefault();if(!selected||busy)return;setBusy(true);setError('');setMessage('');try{
  if(selected.recorded){
   await apiRequest('/api/diet/meals',{method:'POST',body:JSON.stringify(repeatMealInput(selected,{date,mealType,quantity}))});
  }else await apiRequest(`/api/diet/libraries/${selected.libraryId}/items/${selected.id}/add-to-day`,{method:'POST',body:JSON.stringify({date,mealType,quantity:Number(quantity)})});
  setMessage(`${selected.name} added to ${date}.`);setSelected(null);setQuery('');setQuantity('1');setRecentVersion(n=>n+1);
  try{await onAdded()}catch{setError('Meal saved, but the daily summary could not refresh. Reload Diet to see it.');}
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="quick-meal-log">
  <div className="quick-meal-header"><span className="quick-meal-header-icon"><Utensils size={20} aria-hidden="true" /></span><div><h3 className="quick-meal-heading">Add food</h3><p>Repeat a recent meal or choose from your Library.</p></div></div>
  <div className="quick-food-tabs" role="group" aria-label="Food source"><button type="button" disabled={busy} aria-pressed={browseView==='recent'} onClick={()=>{setBrowseView('recent');setOpen(false)}}>Recent meals</button><button type="button" disabled={busy} aria-pressed={browseView==='library'} onClick={()=>{setBrowseView('library');inputRef.current?.focus();setOpen(true)}}>Food Library</button></div>
  {browseView==='recent'&&<section className="quick-recent-meals" aria-label="Recent meals">{recentLoading?<p role="status">Loading recent meals…</p>:recentError?<StatusBanner tone="error" role="alert">{recentError} <Button type="button" onClick={()=>setRecentVersion(n=>n+1)}>Retry</Button></StatusBanner>:recent.length?<ul>{recent.map(meal=><li key={meal.id}><button type="button" disabled={busy} onClick={()=>chooseRecent(meal)} aria-pressed={selected?.recorded&&selected.id===meal.id}><span><strong>{meal.name}</strong><small>{meal.servingDescription||'Recorded portion'}</small></span><span>{meal.nutrition.calories} kcal</span></button></li>)}</ul>:<p>No recorded meals yet. Choose from Food Library or enter one manually.</p>}</section>}
  <form onSubmit={add} className="quick-meal-controls">
   <div className="quick-meal-search-area" ref={menuRef} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}}}>
    <div className="quick-meal-search"><Search size={18} aria-hidden="true"/><input ref={inputRef} aria-label="Search added library meals" aria-expanded={open} aria-controls={menuId} type="search" value={query} disabled={busy} placeholder={loading?'Loading library meals…':'Search or browse your meals'} onFocus={()=>{setBrowseView('library');setOpen(true)}} onClick={()=>setOpen(true)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);requestAnimationFrame(()=>scopeRef.current?.focus())}}} onChange={e=>{setQuery(e.target.value);setSelected(null);setOpen(true);setCollapsed(new Set())}}/><button className="meal-browse-toggle" type="button" aria-label={open?'Close meal browser':'Browse library meals'} aria-expanded={open} aria-controls={menuId} disabled={busy} onClick={()=>setOpen(v=>!v)}><ChevronDown size={17} aria-hidden="true"/></button></div>
    {open&&<div id={menuId} className="meal-browser" role="region" aria-label="Browse meals by library">
     <div className="meal-browser-header"><label><Library size={15} aria-hidden="true"/><span className="sr-only">Search within library</span><select ref={scopeRef} aria-label="Search within library" value={scope} onChange={e=>{setScope(e.target.value);setSelected(null);setQuery('');setCollapsed(new Set())}}><option value="all">All libraries</option>{libraries.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><button type="button" className="meal-browser-close" aria-label="Close library dropdown" onClick={close}><X size={17} aria-hidden="true"/></button></div>
     <div className="meal-browser-caption"><span>{loading?'Loading…':`${matches.length} ${matches.length===1?'meal':'meals'} · ${groups.length} ${groups.length===1?'library':'libraries'}`}</span><button type="button" onClick={()=>setCollapsed(new Set(groups.map(g=>g.id)))}>Collapse all</button><button type="button" onClick={()=>setCollapsed(new Set())}>Expand all</button></div>
     <div className="meal-browser-list">
      {loading?<p role="status">Loading your libraries…</p>:groups.map(group=>{const expanded=!collapsed.has(group.id);const groupId=menuId+'-'+group.id;return <section className="meal-browser-group" key={group.id}><button type="button" className="meal-browser-group-heading" aria-expanded={expanded} aria-controls={groupId} onClick={()=>toggle(group.id)}>{expanded?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>}<Library size={15} aria-hidden="true"/><strong>{group.name}</strong><span>{group.items.length}</span></button><ul id={groupId} hidden={!expanded}>{group.items.map(item=><li key={item.id}><button type="button" disabled={busy} className={selected?.id===item.id&&selected?.libraryId===group.id?'is-selected':''} onClick={()=>choose(item)}><span><strong>{item.name}</strong><small>{item.servingDescription||'1 serving'}</small></span><span>{item.nutrition.calories} <small>kcal</small></span></button></li>)}{!group.items.length&&<li className="meal-browser-empty">No meals in this library yet.</li>}</ul></section>})}
      {!loading&&!groups.length&&<p className="meal-browser-empty" role="status">{term?'No matching meals. Try another search or library.':'No added libraries yet. Use Manage libraries to get started.'}</p>}
     </div>
    </div>}
   </div>
   <label className="quick-meal-type"><span>Meal</span><select aria-label="Meal type" value={mealType} disabled={busy} onChange={e=>setMealType(e.target.value)}>{['breakfast','lunch','dinner','snack'].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></label>
   <label className="quick-meal-quantity"><span>{selected?.recorded?'Recorded portions':'Servings'}</span><input ref={quantityRef} aria-label={selected?.recorded?'Recorded portions':'Servings'} type="number" min="0.1" max="100" step="0.1" required value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/></label>
   <Button type="submit" variant="primary" icon={Plus} disabled={busy||!selected}>{busy?'Adding…':'Add meal'}</Button>
  </form>
  {selected&&<p className="quick-meal-selection">{selected.recorded?'Recorded meal · nutrition from that entry':selected.libraryName} · {selected.servingDescription||'1 serving'} · {Math.round(selected.nutrition.calories*Number(quantity||0))} kcal</p>}
  {message&&<p className="quick-meal-feedback" role="status">{message}</p>}
  {error&&<StatusBanner tone="error" role="alert">{error}</StatusBanner>}
  <div className="quick-meal-links"><Button variant="quiet" disabled={busy} onClick={onManual}>Enter manually</Button><Button variant="quiet" icon={Library} disabled={busy} aria-expanded={libraryOpen} aria-controls="diet-meal-library" onClick={onLibraries}>Manage Library</Button></div>
 </div>
}
