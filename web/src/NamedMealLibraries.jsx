import {useEffect,useState,useRef} from 'react';
import {Library,Globe2,UserRound,Plus,ArrowUpRight,Search,MessageCircle,Sparkles,Bot,ChevronLeft,ChevronDown,Pencil,Share2,Trash2} from 'lucide-react';
import {Button,Surface,SectionHeader,StatusBanner,LoadingState,ConfirmDialog} from './ui';
import {LibraryMealForm,AddLibraryMealForm} from './Diet';
const headers='name,category,servingDescription,calories,proteinGrams,carbohydrateGrams,fatGrams,fiberGrams,ingredients,notes';
const prompt=`Generate a CSV food library for my application.

Use this exact header:

${headers}

Rules:

- category must be exactly one of: breakfast, lunch, dinner, snack
- calories must be a whole number
- proteinGrams, carbohydrateGrams, fatGrams, and fiberGrams must have at most one decimal place
- nutrition values must match the servingDescription
- ingredients and notes may be empty
- use practical approximate nutrition values suitable for a food-tracking app
- keep names simple and recognizable
- do not generate the CSV immediately

First, confirm that you understand the format and rules.

Then ask me one simple multiple-choice question at a time.

Ask only 3 to 5 questions total.

Use simple options such as A, B, C, D so I can reply with just one letter.

Start with:

Question 1: What type of library do you want?

A. Regional meals
B. Snacks
C. Nuts, seeds, and dry fruits
D. Dairy and protein
E. Individual food items
F. Mixed library

Then continue with only the questions relevant to my previous answer.

Possible follow-up questions can cover:

- cuisine or region
- individual items vs complete meals
- common items vs broader variety
- foods to include or avoid
- approximate library size

After the final question:

1. Briefly summarize what you understood.
2. Generate the CSV using the exact header and rules above.
3. Do not add extra columns.`;
const aiTools=[{name:'ChatGPT',url:'https://chatgpt.com/',icon:MessageCircle},{name:'Claude',url:'https://claude.ai/',icon:Bot},{name:'Gemini',url:'https://gemini.google.com/',icon:Sparkles}];
const sample=headers+'\nExample meal,lunch,1 serving,300,20,40,6,4,,\n';
const blank={name:'',category:'breakfast',servingDescription:'',nutrition:{calories:0,proteinGrams:0,carbohydrateGrams:0,fatGrams:0,fiberGrams:0},ingredients:'',notes:''};
export default function NamedMealLibraries({apiRequest,selectedDate,onAdded}){
 const [scope,setScope]=useState('mine'),[libraries,setLibraries]=useState([]),[library,setLibrary]=useState(null),[version,setVersion]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[creating,setCreating]=useState(false),[editingDetails,setEditingDetails]=useState(false),[editor,setEditor]=useState(null),[adding,setAdding]=useState(null),[confirm,setConfirm]=useState(null),[email,setEmail]=useState(''),[search,setSearch]=useState(''),[libraryQuery,setLibraryQuery]=useState(''),[sharing,setSharing]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setLibraries([]);(scope==='mine'?apiRequest('/api/diet/libraries/migrate-existing',{method:'POST',body:'{}'}):Promise.resolve()).then(()=>apiRequest('/api/diet/libraries?scope='+scope)).then(r=>{if(active){setLibraries(r.libraries);if(r.hasMore)setMessage('Showing the first 200 libraries.');}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[apiRequest,scope,version]);
 async function run(work){setBusy(true);setError('');setMessage('');try{const r=await work();setVersion(v=>v+1);return r||true}catch(e){setError(e.message);return null}finally{setBusy(false)}}
 async function open(id){setLibrary(null);setEditor(null);setAdding(null);setEditingDetails(false);setSharing(false);setSearch('');const r=await run(()=>apiRequest('/api/diet/libraries/'+id));if(r)setLibrary(r.library)}
 async function change(path,method='POST',extra={}){if(!library)return;const id=library.id;const r=await run(()=>apiRequest('/api/diet/libraries/'+id+path,{method,body:JSON.stringify({expectedRevision:library.revision,...extra})}));if(r){const fresh=await run(()=>apiRequest('/api/diet/libraries/'+id));if(fresh)setLibrary(fresh.library);}return r}
 const locked=library?.reviewStatus==='submitted';
 const menuAction=(event,action)=>{event.currentTarget.closest('details')?.removeAttribute('open');action()};
 return <Surface className="meal-library named-libraries"><SectionHeader title={creating?"Create a collection":library?"Library details":"Your collections"} description={creating?"A few simple steps to build your library.":library?"Browse meals and manage your collection.":"Owned, shared and saved libraries in one place."} action={!creating&&!library?<Button variant="primary" icon={Plus} disabled={busy} onClick={()=>{setCreating(true);setLibrary(null)}}>Create library</Button>:<Button icon={ChevronLeft} disabled={busy} onClick={()=>{setCreating(false);setLibrary(null)}}>All libraries</Button>}/>
 {error&&<StatusBanner tone="error" role="alert">{error}</StatusBanner>}{message&&<StatusBanner role="status">{message}</StatusBanner>}
 {creating&&<CreateLibrary apiRequest={apiRequest} busy={busy} run={run} onCancel={()=>setCreating(false)} onCreated={l=>{setCreating(false);setLibrary(l)}}/>}
 {!creating&&!library&&<>
 <div className="diet-toolbar library-browse-bar"><div className="library-view-switch" role="group" aria-label="Library collection"><Button icon={UserRound} disabled={busy} aria-pressed={scope==='mine'} onClick={()=>{setScope('mine');setLibrary(null)}}>My libraries</Button><Button icon={Globe2} disabled={busy} aria-pressed={scope==='public'} onClick={()=>{setScope('public');setLibrary(null)}}>Discover</Button></div><Button variant="quiet" disabled={busy} onClick={async()=>{const r=await run(()=>apiRequest('/api/diet/libraries/migrate-existing',{method:'POST',body:'{}'}));if(r?.library){setLibrary(r.library);setMessage('Existing meals are available in My personal meals. Original records are preserved.')}else if(r)setMessage('No existing personal meals to import.')}}>Import existing personal meals</Button></div>
 <label className="library-name-search"><Search size={17} aria-hidden="true"/><input aria-label="Search libraries by name" placeholder="Search libraries" value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)}/></label>
 {loading?<LoadingState>Loading libraries…</LoadingState>:<div className="named-library-grid">{libraries.filter(l=>l.name.toLowerCase().includes(libraryQuery.trim().toLowerCase())).map(l=><button disabled={busy} className={`named-library-card library-access-${l.owner?'owned':scope==='public'?'public':'shared'} ${library?.id===l.id?'is-selected':''}`} key={l.id} aria-pressed={library?.id===l.id} onClick={()=>open(l.id)}><span className="library-card-top"><span className="library-card-icon"><Library size={22} aria-hidden="true"/></span><span className="library-access-badge">{l.owner?'Owned':scope==='public'?'Public':'Shared / saved'}</span></span><strong>{l.name}</strong><span className="library-card-count">{l.itemCount??l.items.length} meals <ArrowUpRight size={16} aria-hidden="true"/></span><small>{l.nutritionSource}</small>{l.owner&&<span className={`library-review-badge library-review-${l.reviewStatus}`}>{({draft:'Draft',submitted:'In review',published:'Published',returned:'Changes requested'})[l.reviewStatus]||l.reviewStatus}</span>}</button>)}{!libraries.some(l=>l.name.toLowerCase().includes(libraryQuery.trim().toLowerCase()))&&<p>{libraryQuery?'No matching libraries. Try another name.':'No libraries here yet.'}</p>}</div>}
 </>}
 {library&&<section className="named-library-details"><SectionHeader title={library.name} description={library.description||library.nutritionSource}/><p>{library.nutritionSource} · {(library.tags||[]).join(', ')}{library.owner?' · Owner':' · Read only'}</p>{library.feedback&&<StatusBanner>Admin feedback: {library.feedback}</StatusBanner>}{locked&&<StatusBanner>Submitted for Admin review. Editing is locked until a decision.</StatusBanner>}
 <div className="diet-toolbar library-owner-actions">{library.owner?<><Button variant="primary" icon={Plus} disabled={busy||locked} onClick={()=>setEditor(blank)}>Add item</Button><details className="library-actions-menu"><summary>Library actions <ChevronDown size={15} aria-hidden="true"/></summary><div><button type="button" disabled={busy||locked} onClick={event=>menuAction(event,()=>setEditingDetails(v=>!v))}><Pencil size={16} aria-hidden="true"/>Edit details</button><button type="button" disabled={busy||locked} onClick={event=>menuAction(event,()=>setSharing(v=>!v))}><Share2 size={16} aria-hidden="true"/>Share library</button><button type="button" disabled={busy||locked} onClick={event=>menuAction(event,()=>setConfirm({kind:'submit',title:'Submit for public review?',text:'Admins will review this version before anyone can discover it publicly.'}))}><Globe2 size={16} aria-hidden="true"/>Submit for publication</button><button type="button" className="is-danger" disabled={busy} onClick={event=>menuAction(event,()=>setConfirm({kind:'delete',title:library.everDistributed?'Archive library?':'Delete library?',text:'Shared or public libraries are archived. New meal selections stop; existing food logs remain unchanged.'}))}><Trash2 size={16} aria-hidden="true"/>Delete / archive</button></div></details></>:<>{scope==='public'&&<Button disabled={busy} onClick={()=>change('/reference','PUT')}>Add to my libraries</Button>}{scope==='mine'&&<Button disabled={busy} onClick={async()=>{const r=await run(()=>apiRequest('/api/diet/libraries/'+library.id+'/reference',{method:'DELETE'}));if(r)setLibrary(null)}}>Remove from my libraries</Button>}</>}</div>
 {editingDetails&&library.owner&&!locked&&<LibraryDetails key={library.id} library={library} busy={busy} onCancel={()=>setEditingDetails(false)} onSave={async values=>{if(await change('','PATCH',values))setEditingDetails(false)}}/>}
 {sharing&&library.owner&&!locked&&<form className="diet-toolbar library-share-form" onSubmit={async e=>{e.preventDefault();if(await change('/access','PUT',{email}))setEmail('')}}><label>Share with a verified user<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address"/></label><Button type="submit" disabled={busy}>Share read only</Button></form>}
 {sharing&&library.owner&&library.sharedWith?.map(u=><div className="diet-toolbar" key={u.id}><span>{u.name} · {u.email}</span><Button disabled={busy||locked} onClick={()=>change('/access/'+u.id,'DELETE')}>Revoke access</Button></div>)}
 {editor&&<LibraryMealForm key={editor.id||'new'} initial={editor} busy={busy} onCancel={()=>setEditor(null)} onSave={async item=>{if(await change('/items'+(editor.id?'/'+editor.id:''),editor.id?'PATCH':'POST',{item}))setEditor(null)}}/>}
 {adding&&<AddLibraryMealForm key={adding.id} meal={adding} initialDate={selectedDate} selectedDate={selectedDate} busy={busy} onCancel={()=>setAdding(null)} onSave={async values=>{const r=await run(()=>apiRequest('/api/diet/libraries/'+library.id+'/items/'+adding.id+'/add-to-day',{method:'POST',body:JSON.stringify(values)}));if(r){setAdding(null);onAdded(values.date);await open(library.id)}}}/>}
 <label className="library-item-search">Search items<input aria-label="Search library items" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Meal name"/></label>
 <div className="library-list">{library.items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())).map(item=><article className="library-meal" key={item.id}><div className="library-meal-heading"><div><h3>{item.name}</h3><p>{item.category} · {item.servingDescription}</p></div><strong>{item.nutrition.calories} kcal</strong></div><p>Protein {item.nutrition.proteinGrams} g · Carbs {item.nutrition.carbohydrateGrams} g · Fat {item.nutrition.fatGrams} g · Fiber {item.nutrition.fiberGrams} g</p>{item.notes&&<p>{item.notes}</p>}<div className="diet-toolbar"><Button disabled={busy} onClick={()=>setAdding(item)}>Add to day</Button>{library.owner&&<><Button disabled={busy||locked} onClick={()=>setEditor(item)}>Edit</Button><Button disabled={busy||locked} variant="danger" onClick={()=>setConfirm({kind:'item',item,title:'Delete meal?',text:'Previously logged meals remain unchanged.'})}>Delete</Button></>}</div></article>)}</div></section>}
 <ConfirmDialog open={Boolean(confirm)} title={confirm?.title} description={confirm?.text} busy={busy} onCancel={()=>setConfirm(null)} confirmLabel="Confirm" onConfirm={async()=>{let r;if(confirm.kind==='delete'){r=await run(()=>apiRequest('/api/diet/libraries/'+library.id,{method:'DELETE',body:JSON.stringify({expectedRevision:library.revision})}));if(r)setLibrary(null)}else if(confirm.kind==='submit')r=await change('/submit');else r=await change('/items/'+confirm.item.id,'DELETE');if(r)setConfirm(null)}}/>
 </Surface>
}
function CreateLibrary({apiRequest,busy,run,onCreated,onCancel}){
 const [step,setStep]=useState(0),[form,setForm]=useState({name:'',nutritionSource:'AI estimates',description:'',tags:''}),[file,setFile]=useState(null),[preview,setPreview]=useState(null),[selected,setSelected]=useState(new Set()),[copied,setCopied]=useState(false);
 const field=k=>({value:form[k],onChange:e=>setForm({...form,[k]:e.target.value})});
 const ready=!file||Boolean(preview&&selected.size);
 async function submit(event){event.preventDefault();if(step<2){if(step===1&&!ready)return;setStep(s=>s+1);return;}const rows=preview?.validRows.filter(r=>selected.has(r.sourceRowNumber));const result=await run(()=>apiRequest('/api/diet/libraries',{method:'POST',body:JSON.stringify({...form,tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean),...(rows?.length?{rows}:{})})}));if(result)onCreated(result.library)}
 return <Surface className="library-editor library-create-panel"><ol className="library-create-steps" aria-label="Library creation steps">{['Details','CSV / AI prompt','Preview and save'].map((name,index)=><li key={name} aria-current={step===index?'step':undefined} className={step===index?'is-current':step>index?'is-complete':''}><span>{index+1}</span>{name}</li>)}</ol><form onSubmit={submit}><fieldset disabled={busy} className="diet-form-grid">
 {step===0&&<><label>Library name<input autoFocus required maxLength={100} {...field('name')} placeholder="e.g. Everyday breakfasts"/></label><label>Nutrition source<select {...field('nutritionSource')}>{['AI estimates','Product labels','Reference source','Mixed'].map(v=><option key={v}>{v}</option>)}</select></label><label>Description (optional)<textarea maxLength={1000} {...field('description')}/></label><label>Tags (optional, comma separated)<input {...field('tags')}/></label></>}
 {step===1&&<><label className="csv-upload-field">CSV (optional)<small>UTF-8 · up to 1 MB · 500 meals</small><input type="file" accept=".csv,text/csv" onChange={e=>{setFile(e.target.files[0]||null);setPreview(null);setSelected(new Set())}}/>{file&&<small>Selected: {file.name}</small>}</label><Button className="csv-preview-button" type="button" disabled={!file||busy} onClick={async()=>{const data=new FormData();data.append('file',file);const r=await run(()=>apiRequest('/api/diet/libraries/import-preview',{method:'POST',body:data}));if(r){setPreview(r);setSelected(new Set(r.validRows.map(row=>row.sourceRowNumber)))}}}>Preview CSV</Button>
 <details className="wide-field csv-ai-help"><summary>Generate CSV with an AI tool</summary><p>Copy this prompt into an AI chat. Answer 3–5 simple questions, then review the generated CSV and nutrition values before uploading.</p><nav className="csv-ai-links" aria-label="AI tools for generating CSV">{aiTools.map(({name,url,icon:Icon})=><a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name} in a new tab`}><Icon size={18} aria-hidden="true"/><span>{name}</span><ArrowUpRight size={14} aria-hidden="true"/></a>)}</nav><pre tabIndex={0} aria-label="CSV generation prompt">{prompt}</pre><Button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setCopied(true)}catch{setCopied(false)}}}>{copied?'Copied':'Copy prompt'}</Button><a download="meal-library-sample.csv" href={'data:text/csv;charset=utf-8,'+encodeURIComponent(sample)}>Download sample CSV</a></details>
 {preview&&<StatusBanner className="wide-field">{preview.validRows.length} valid items · {preview.invalidRows.length} invalid rows. Select the items to save in the next step.</StatusBanner>}
 {Boolean(preview?.invalidRows.length)&&<details className="wide-field csv-invalid-details"><summary>See invalid row details</summary>{preview.invalidRows.map(row=><p key={row.rowNumber}>Row {row.rowNumber}: {Object.entries(row.fields).map(([key,value])=>key+': '+value).join('; ')}</p>)}</details>}
 {!file&&<p className="wide-field library-step-hint">No CSV yet? Continue to create an empty library and add items manually.</p>}
 </>}
 {step===2&&<><div className="wide-field library-save-summary"><h3>{form.name}</h3><p>{form.nutritionSource} · {selected.size} items to import</p>{form.description&&<p>{form.description}</p>}{form.tags&&<p>Tags: {form.tags}</p>}</div>
 {preview?<div className="csv-preview wide-field"><section><h4>Choose items ({selected.size} selected)</h4>{preview.validRows.map(row=><label key={row.sourceRowNumber}><input type="checkbox" checked={selected.has(row.sourceRowNumber)} onChange={()=>setSelected(old=>{const next=new Set(old);next.has(row.sourceRowNumber)?next.delete(row.sourceRowNumber):next.add(row.sourceRowNumber);return next})}/><span>{row.name} · {row.servingDescription} · {row.calories} kcal · P {row.proteinGrams} / C {row.carbohydrateGrams} / F {row.fatGrams} / Fiber {row.fiberGrams} g</span></label>)}</section>{!!preview.invalidRows.length&&<section><h4>Invalid rows ({preview.invalidRows.length})</h4>{preview.invalidRows.map(row=><p key={row.rowNumber}>Row {row.rowNumber}: {Object.entries(row.fields).map(([k,v])=>k+': '+v).join('; ')}</p>)}</section>}</div>:<p className="wide-field library-step-hint">This library will start empty. Add items whenever you are ready.</p>}
 </>}
 <div className="diet-toolbar wide-field library-wizard-actions">{step>0&&<Button type="button" onClick={()=>setStep(s=>s-1)}>Back</Button>}<Button variant="primary" type="submit" disabled={busy||(step>0&&!ready)}>{step===0?'Continue to CSV':step===1?'Review library':'Accept and create library'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
 </fieldset></form></Surface>
}
export function AdminMealLibraries({apiRequest}){
 const [libraries,setLibraries]=useState([]),[current,setCurrent]=useState(null),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;apiRequest('/api/admin/meal-libraries').then(r=>{if(active)setLibraries(r.libraries)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[apiRequest,version]);
 async function review(action){setBusy(true);setError('');try{await apiRequest('/api/admin/meal-libraries/'+current.id+'/review',{method:'POST',body:JSON.stringify({expectedRevision:current.revision,action,feedback})});setCurrent(null);setFeedback('');setVersion(v=>v+1)}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <Surface><SectionHeader title="Meal library review" description="Publication makes the approved library available to Diet users; it is not nutrition certification."/>{error&&<StatusBanner tone="error" role="alert">{error}</StatusBanner>}<div className="named-library-grid">{libraries.map(l=><Button disabled={busy} key={l.id} onClick={async()=>{setBusy(true);setError('');try{const r=await apiRequest('/api/admin/meal-libraries/'+l.id);setCurrent(r.library);setFeedback('')}catch(e){setError(e.message)}finally{setBusy(false)}}}>{l.name} · {l.reviewStatus}</Button>)}</div>{!libraries.length&&<p>No libraries awaiting review or published.</p>}{current&&<section><h3>{current.name}</h3><p>{current.description} · {current.nutritionSource}</p><div className="library-list">{current.items.map(i=><article className="library-meal" key={i.id}><strong>{i.name}</strong><p>{i.servingDescription} · {Object.entries(i.nutrition).map(([k,v])=>k+': '+v).join(' · ')}</p><p>{i.ingredients} {i.notes}</p></article>)}</div><label>Review feedback<textarea maxLength={1000} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label><div className="diet-toolbar">{current.reviewStatus==='submitted'&&<><Button disabled={busy} onClick={()=>review('publish')}>Publish approved version</Button><Button disabled={busy||!feedback.trim()} onClick={()=>review('return')}>Return with feedback</Button></>}{current.hasPublished&&<Button disabled={busy} onClick={()=>review('unpublish')}>Unpublish</Button>}<Button disabled={busy} onClick={()=>setCurrent(null)}>Close</Button></div></section>}</Surface>
}

function LibraryDetails({library,busy,onSave,onCancel}){const [form,setForm]=useState({name:library.name,nutritionSource:library.nutritionSource,description:library.description||'',tags:(library.tags||[]).join(', ')});return <form onSubmit={e=>{e.preventDefault();onSave({...form,tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean)})}}><fieldset className="diet-form-grid" disabled={busy}>{['name','description','tags'].map(k=><label key={k}>{k}<input required={k==='name'} maxLength={k==='description'?1000:k==='name'?100:410} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<label>Nutrition source<select value={form.nutritionSource} onChange={e=>setForm({...form,nutritionSource:e.target.value})}>{['AI estimates','Product labels','Reference source','Mixed','Existing personal meals'].map(v=><option key={v}>{v}</option>)}</select></label><div className="diet-toolbar"><Button type="submit">Save details</Button><Button type="button" onClick={onCancel}>Cancel</Button></div></fieldset></form>}
