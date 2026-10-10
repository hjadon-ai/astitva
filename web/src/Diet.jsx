import { createPortal } from 'react-dom';
import BodyGoals from './BodyGoals';
import DailyWeight from './DailyWeight';
import WeightTrends from './WeightTrends';
import MealLibraryDrawer from './MealLibraryDrawer';
import DietHistory from './DietHistory';
import QuickMealLog from './QuickMealLog';
import {updateWaterIntake} from './waterIntake';
import NamedMealLibraries from './NamedMealLibraries';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Droplets, Library, Pencil,
  Plus, RotateCw, Save, Search, Scale, Target, ChartNoAxesCombined, Trash2, Upload, Utensils, Sunrise, Sun, Moon, Coffee
} from 'lucide-react';
import {
  Badge, Button, IconButton, ConfirmDialog, EmptyState, LoadingState, PageHeader,
  SectionHeader, StatusBanner, Surface
} from './ui';

const nutrients = [['calories', 'Calories', 'kcal'], ['proteinGrams', 'Protein', 'g'],
  ['carbohydrateGrams', 'Carbohydrates', 'g'], ['fatGrams', 'Fat', 'g'], ['fiberGrams', 'Fiber', 'g']];
const types = ['breakfast', 'lunch', 'dinner', 'snack'];
const blankNutrition = () => Object.fromEntries(nutrients.map(([key]) => [key, '']));
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const label = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const rounded = (value, places = 1) => Math.round(value * (10 ** places)) / (10 ** places);

function requireCurrentDietResponse(result) {
  if (!result || !Array.isArray(result.meals) || !result.totals ||
      !result.water || !Array.isArray(result.water.entries)) {
    throw new Error('Diet needs the current server version. Restart or deploy the server from this release, then retry.');
  }
  return result;
}

function calculateMacroCalories(targets) {
  const protein = Number(targets?.proteinGrams) * 4;
  const carbohydrates = Number(targets?.carbohydrateGrams) * 4;
  const fat = Number(targets?.fatGrams) * 9;
  const calorieTarget = Number(targets?.calories);
  if (![protein, carbohydrates, fat, calorieTarget].every(Number.isFinite)) return null;
  const total = rounded(protein + carbohydrates + fat);
  return { protein: rounded(protein), carbohydrates: rounded(carbohydrates), fat: rounded(fat), total,
    differenceFromCalorieTarget: rounded(total - calorieTarget) };
}

function scaledNutrition(meal, quantity) {
  return Object.fromEntries(nutrients.map(([key]) => [key, key === 'calories'
    ? Math.round(meal.nutrition[key] * quantity)
    : rounded(meal.nutrition[key] * quantity)]));
}

export default function Diet({ apiRequest, readOnly = false, loadDay }) {
  const [date, setDate] = useState(localDate);
  return <DietDay key={date} date={date} setDate={setDate} apiRequest={apiRequest} readOnly={readOnly} loadDay={loadDay} />;
}

function DietDay({ date, setDate, apiRequest, readOnly, loadDay }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [waterBusy,setWaterBusy] = useState(false);
  const [waterError,setWaterError] = useState('');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [view,setView]=useState('track');
  const [historyVisited,setHistoryVisited]=useState(false);
  const [planState, setPlanState] = useState(null);
  const planLoaded = useCallback(profile => setPlanState({ profile }), []);
  const [bodyVersion, setBodyVersion] = useState(0);
  const [trendView, setTrendView] = useState('nutrition');
  const bodySaved = () => setBodyVersion(n => n + 1);
  const showWeightTrends = () => { setTrendView('weight'); selectWorkspace('trends'); };
  const [workspaceFlip, setWorkspaceFlip] = useState(null);
  function selectWorkspace(nextView) {
    if (nextView !== view) {
      const order = ['track', 'trends', 'body-goals'];
      setWorkspaceFlip(order.indexOf(nextView) > order.indexOf(view) ? 'forward' : 'backward');
      setView(nextView);
    }
    if (nextView === 'trends') setHistoryVisited(true);
    document.getElementById('diet-tab-' + nextView)?.focus();
    setEditor(current => current?.kind === 'targets' ? null : current);
  }
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryVisited,setLibraryVisited]=useState(false);
  const openLibraries=()=>{setLibraryVisited(true);setLibraryOpen(true)};
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    (readOnly ? loadDay(date) : apiRequest(`/api/diet/days/${date}`)).then((result) => {
      if (active) { setData(readOnly ? result : requireCurrentDietResponse(result)); setError(''); }
    }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [date, version, apiRequest, readOnly, loadDay]);

  function moveDate(amount) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + amount);
    setDate(localDate(next));
  }

  async function mutate(path, method, body, success = method === 'DELETE' ? 'Deleted.' : 'Saved.') {
    setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      setEditor(null); setDeleting(null); setMessage(success); setData(null); setVersion((value) => value + 1);
      return true;
    } catch (requestError) { setError(requestError.message); return false; }
    finally { setBusy(false); }
  }

  async function mutateWater(path,method,body,deletedId) {
    setWaterBusy(true);setWaterError('');
    try {
      const result=await apiRequest(path,{method,...(body?{body:JSON.stringify(body)}:{})});
      setData(current=>current?{...current,water:updateWaterIntake(current.water,deletedId?{deletedId}:{entry:result.entry})}:current);
      return true;
    } catch(requestError){setWaterError(requestError.message);return false;}
    finally{setWaterBusy(false);}
  }

  const deletingMeal = data?.meals.find((meal) => meal.id === deleting);
  const startMeal = () => setEditor({ kind: 'meal', date, name: '', mealType: 'breakfast', servingDescription: '', nutrition: blankNutrition() });
  const startTargets = () => setEditor({ kind: 'targets', targets: {
    ...Object.fromEntries(nutrients.map(([key]) => [key, data.targets?.[key] ?? ''])),
    waterMilliliters: data.targets?.waterMilliliters ?? ''
  } });

  return <section className="profile-content diet-page">
    <PageHeader eyebrow={readOnly ? "Shared / Diet · Read only" : "Personal / Diet"} title="Daily diet" description={readOnly ? "Authorized shared meals and daily nutrition." : "Track meals, water, and daily nutrition in one place."} />
    <nav hidden={!readOnly && view !== 'track'} className="diet-date-navigation" aria-label="Diet day navigation">
      <div className="diet-date-controls">
        <Button className="diet-day-arrow" icon={ChevronLeft} aria-label="Previous day" title="Previous day" disabled={busy} onClick={() => moveDate(-1)} />
        <label className="diet-date"><CalendarDays size={18} aria-hidden="true" /><span className="sr-only">Date</span><input aria-label="Diet date" type="date" value={date} disabled={busy}
          onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></label>
        <Button className="diet-day-arrow" icon={ChevronRight} aria-label="Next day" title="Next day" disabled={busy} onClick={() => moveDate(1)} />
      </div>
      <Button className="diet-today-button" disabled={busy} onClick={() => setDate(localDate())}>Today</Button>
    </nav>
    {error && <StatusBanner tone="error" role="alert">{error} <button className="text-action" onClick={() => setVersion((value) => value + 1)}><RotateCw size={15} aria-hidden="true" /> Retry</button></StatusBanner>}
    {message && <StatusBanner tone="success" role="status">{message}</StatusBanner>}
    {!data && !error && <LoadingState>Loading diet record…</LoadingState>}
    {data && <>
      {!readOnly && planState && !planState.profile && view === 'track' && <section className="diet-plan-entry" aria-label="Your Diet plan">
        <div><h2>{planState.profile ? 'Your plan' : 'Set up your Diet plan'}</h2><p>{planState.profile ? `${label(planState.profile.goal)} weight · starting details and daily targets in one place.` : 'Start with your measurements, explore your goal, then choose daily targets. You can record meals without completing setup.'}</p></div>
        <Button icon={Scale} onClick={() => selectWorkspace('body-goals')}>{planState.profile ? 'Review plan' : 'Get started'}</Button>
      </section>}
      <section className="diet-intake-panel nutrition-dashboard diet-workspace-card" aria-label="Daily Diet workspace">
        <SectionHeader eyebrow={readOnly?"Shared day":"Your day"} title={readOnly ? 'Daily workspace' : view === 'track' ? 'Daily Record' : view === 'trends' ? 'Trends' : 'Your Plan'} description={view === 'trends' ? 'Review your progress and adjust your plan when needed.' : view === 'body-goals' ? 'Your starting point, goal and daily targets.' : 'Record your intake and see today’s progress.'} action={!readOnly&&<Button icon={Library} disabled={busy} onClick={openLibraries}>Manage Library</Button>}/>
        {!readOnly&&<div className="diet-workspace-tabs" role="tablist" aria-label="Diet workspace view">{[['track','Daily Record',Utensils],['trends','Trends',ChartNoAxesCombined],['body-goals','Your Plan',Scale]].map(([id,name,Icon],index,all)=><button type="button" role="tab" key={id} id={'diet-tab-'+id} aria-selected={view===id} aria-controls={'diet-panel-'+id} tabIndex={view===id?0:-1} onClick={()=>selectWorkspace(id)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%all.length:event.key==='ArrowLeft'?(index+all.length-1)%all.length:event.key==='Home'?0:event.key==='End'?all.length-1:null;if(next===null)return;event.preventDefault();const nextId=all[next][0];selectWorkspace(nextId);event.currentTarget.parentElement.children[next].focus();}}><Icon size={17} aria-hidden="true"/>{name}</button>)}</div>}
        <div className={`diet-dashboard-panels${workspaceFlip ? ' has-flipped' : ''}`} data-flip-direction={workspaceFlip}>
          {!readOnly&&<div className={`dashboard-panel ${view==='track'?'is-active':''}`} id="diet-panel-track" role="tabpanel" aria-labelledby="diet-tab-track" aria-hidden={view!=='track'} inert={view!=='track'}>
      {!readOnly && <div className="tracker-entry-grid"><section className="daily-summary-card" aria-label="Daily Summary"><h3>Daily Summary</h3><div className="daily-summary-content"><WaterTracker water={data.water} date={date} busy={busy||waterBusy} error={waterError} onAdd={(amountMilliliters) => mutateWater('/api/diet/water-entries', 'POST', { date, amountMilliliters })} onDelete={(id) => mutateWater(`/api/diet/water-entries/${id}`, 'DELETE', null, id)} /><NutritionSummary data={data}/></div>{data.macroCalories && <MacroSummary macro={data.macroCalories}/>}</section>
        <QuickMealLog apiRequest={apiRequest} date={date} libraryOpen={libraryOpen} onManual={startMeal} onLibraries={openLibraries} onAdded={async()=>{const fresh=requireCurrentDietResponse(await apiRequest(`/api/diet/days/${date}`));setData(current=>({...fresh,water:current.water}));}} /></div>}

            <DailyWeight apiRequest={apiRequest} date={date} refreshVersion={bodyVersion} onSaved={bodySaved}/>
          </div>}
          {readOnly && <div className="dashboard-panel is-active" role="region" aria-label="Shared nutrition"><NutritionSummary data={data}/></div>}
          {!readOnly&&<div className={`dashboard-panel diet-trends-panel ${view==='trends'?'is-active':''}`} id="diet-panel-trends" role="tabpanel" aria-labelledby="diet-tab-trends" aria-hidden={view!=='trends'} inert={view!=='trends'}>{historyVisited && <><div className="diet-trend-switch" role="group" aria-label="Trend type"><button type="button" aria-pressed={trendView === 'nutrition'} onClick={() => setTrendView('nutrition')}>Nutrition</button><button type="button" aria-pressed={trendView === 'weight'} onClick={() => setTrendView('weight')}>Weight & prediction</button></div><div hidden={trendView !== 'nutrition'}><DietHistory apiRequest={apiRequest} refreshVersion={JSON.stringify([data.totals, data.water.consumedMilliliters, data.targets])} onPlan={() => selectWorkspace('body-goals')} onRecord={() => selectWorkspace('track')}/></div><div hidden={trendView !== 'weight'}><WeightTrends apiRequest={apiRequest} refreshVersion={bodyVersion} onSetup={() => selectWorkspace('body-goals')} onRecord={() => selectWorkspace('track')}/></div></>}</div>}
          {!readOnly && <div className={`dashboard-panel ${view === 'body-goals' ? 'is-active' : ''}`} id="diet-panel-body-goals" role="tabpanel" aria-labelledby="diet-tab-body-goals" aria-hidden={view !== 'body-goals'} inert={view !== 'body-goals'}>
            <BodyGoals onLoaded={planLoaded} apiRequest={apiRequest} refreshVersion={bodyVersion} onSaved={bodySaved} onShowTrends={showWeightTrends} onLogWeight={() => selectWorkspace('track')} onTargetApplied={async () => {
        const fresh = requireCurrentDietResponse(await apiRequest(`/api/diet/days/${date}`));
        setData(current => ({ ...fresh, water: { ...fresh.water, entries: current.water.entries,
          consumedMilliliters: current.water.consumedMilliliters,
          remainingMilliliters: fresh.water.targetMilliliters === null ? null : Math.max(0, fresh.water.targetMilliliters - current.water.consumedMilliliters),
          overTargetMilliliters: fresh.water.targetMilliliters === null ? null : Math.max(0, current.water.consumedMilliliters - fresh.water.targetMilliliters) } }));
      }} />
            <section className="diet-plan-targets" aria-label="Daily targets"><SectionHeader title="Daily targets" description="These are your active targets. Saving a body plan does not change them." action={<Button icon={Target} disabled={busy} onClick={startTargets}>Edit daily targets</Button>}/><div className="diet-plan-target-values">{[...nutrients, ['waterMilliliters', 'Water', 'ml']].map(([key, name, unit]) => <div key={key}><span>{name}</span><strong>{data.targets?.[key] ?? '—'} <small>{unit}</small></strong></div>)}</div>{editor?.kind === 'targets' && <DietForm initial={editor} busy={busy} onCancel={() => setEditor(null)} onSave={async values => {
              setBusy(true); setError('');
              try {
                await apiRequest('/api/diet/targets', { method: 'PUT', body: JSON.stringify(values) });
                const fresh = requireCurrentDietResponse(await apiRequest(`/api/diet/days/${date}`));
                setData(current => ({ ...fresh, water: { ...current.water, targetMilliliters: fresh.water.targetMilliliters,
                  remainingMilliliters: fresh.water.targetMilliliters === null ? null : Math.max(0, fresh.water.targetMilliliters - current.water.consumedMilliliters),
                  overTargetMilliliters: fresh.water.targetMilliliters === null ? null : Math.max(0, current.water.consumedMilliliters - fresh.water.targetMilliliters) } }));
                setEditor(null); setMessage('Daily targets saved.');
              } catch (requestError) { setError(requestError.message); }
              finally { setBusy(false); }
            }}/>}</section>
          </div>}
        </div>
      </section>
      <section hidden={!readOnly && view !== 'track'} className="diet-intake-panel diet-timeline-card" aria-label="Meal timeline">
      <div className="daily-meal-workspace">
        <div className="daily-meal-history-heading"><h2>Meal timeline</h2><span>{data.meals.length} {data.meals.length===1?'entry':'entries'}</span></div>
        <section className="daily-meals" aria-label="Meals for selected day">
        {!data.meals.length && <EmptyState icon={Utensils} title="No meals yet" description={readOnly ? "No shared meals for this date." : "Search above to log your first meal, or enter one manually."} />}
        {types.map((type) => {
          const meals = data.meals.filter((meal) => meal.mealType === type);
          const MealIcon = {breakfast:Sunrise,lunch:Sun,dinner:Moon,snack:Coffee}[type];
          return meals.length > 0 && <section className="diet-meal-group" key={type}><h4 className="diet-meal-group-title"><MealIcon size={17} aria-hidden="true" />{label(type)}<span>{meals.reduce((sum,meal)=>sum+meal.nutrition.calories,0)} kcal</span></h4>
            {meals.map((meal) => <Surface as="article" className="diet-meal" key={meal.id}>
              <span className="diet-meal-marker" aria-hidden="true"><MealIcon size={20}/></span><div className="diet-meal-content"><div className="meal-title"><h3>{meal.name}</h3>{meal.source === 'library' && <Badge tone="neutral">Library · {meal.quantity}×</Badge>}</div>
                {meal.servingDescription && <p>{meal.servingDescription}</p>}
                <div className="diet-meal-nutrients">{nutrients.map(([key, nutrientLabel, unit]) => <span key={key} className={`meal-nutrient nutrition-${key}`}><span>{nutrientLabel}</span><strong>{meal.nutrition[key]} {unit}</strong></span>)}</div></div>
              {!readOnly && <div className="diet-toolbar"><IconButton icon={Pencil} label={`Edit ${meal.name}`} disabled={busy} onClick={() => setEditor({ ...meal, kind: 'meal' })} />
                <IconButton icon={Trash2} label={`Delete ${meal.name}`} disabled={busy} onClick={() => setDeleting(meal.id)} /></div>}
            </Surface>)}</section>;
        })}
        </section>
      </div>
      </section>
      {!readOnly&&<MealLibraryDrawer open={libraryOpen} onClose={()=>setLibraryOpen(false)}>{libraryVisited&&<NamedMealLibraries apiRequest={apiRequest} selectedDate={date} onAdded={async addedDate=>{setMessage(`Library meal added to ${addedDate}.`);if(addedDate===date){const fresh=requireCurrentDietResponse(await apiRequest(`/api/diet/days/${date}`));setData(current=>({...fresh,water:current.water}));}}}/>}</MealLibraryDrawer>}


    </>}

    {!readOnly && editor && editor.kind !== 'targets' && <DietForm key={`${editor.kind}-${editor.id || 'new'}`} initial={editor} busy={busy} onCancel={() => setEditor(null)} onSave={(values) => {
      if (editor.kind === 'targets') return mutate('/api/diet/targets', 'PUT', values, 'Daily targets saved.');
      return mutate(`/api/diet/meals${editor.id ? `/${editor.id}` : ''}`, editor.id ? 'PATCH' : 'POST', values, 'Meal saved.');
    }} />}
    <ConfirmDialog open={!readOnly && Boolean(deletingMeal)} title="Delete meal?" description={deletingMeal ? `${deletingMeal.name} will be removed from this daily record.` : ''} confirmLabel="Delete meal" busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => mutate(`/api/diet/meals/${deletingMeal.id}`, 'DELETE', null, 'Meal deleted.')} />
  </section>;
}

function NutritionSummary({ data }) {
  return <div className="compact-nutrition-summary" aria-label="Daily nutrition progress">{nutrients.map(([key, name, unit]) => {
    const consumed = data.totals[key];
    const target = data.targets?.[key];
    const hasTarget = Number.isFinite(target) && target > 0;
    const percent = hasTarget ? Math.min(100, Math.max(0, consumed / target * 100)) : 0;
    const exceeded = hasTarget && consumed > target;
    return <article key={key} className={`compact-nutrient nutrition-${key}${exceeded ? ' over-target' : ''}`}>
      <div className="compact-nutrient-heading"><span>{name}</span><strong>{consumed} <small>{hasTarget ? `/ ${target} ` : ''}{unit}</small></strong></div>
      <div className="compact-nutrient-track" role={hasTarget ? 'progressbar' : undefined} aria-label={`${name} toward target`} aria-valuemin={hasTarget ? 0 : undefined} aria-valuemax={hasTarget ? target : undefined} aria-valuenow={hasTarget ? Math.min(consumed, target) : undefined} aria-valuetext={hasTarget ? `${consumed} of ${target} ${unit}${exceeded ? ', over target' : ''}` : undefined}><span style={{width:`${percent}%`}}/></div>
      <small className="compact-nutrient-status">{!hasTarget ? 'No target set' : `${rounded(Math.abs(target - consumed))} ${unit} ${exceeded ? 'over target' : 'remaining'}`}</small>
    </article>;
  })}</div>;
}

function MacroSummary({ macro }) {
  const difference = macro.differenceFromCalorieTarget;
  return <details className="macro-summary macro-disclosure"><summary><span>Macro target</span><strong>{macro.total} kcal</strong><span className="macro-disclosure-hint">How it is calculated</span></summary><div className="macro-disclosure-content">
    <div><strong>Macro target</strong><span>Protein {macro.protein} + Carbs {macro.carbohydrates} + Fat {macro.fat} = {macro.total} kcal</span></div>
    <Badge tone={difference === 0 ? 'success' : 'neutral'}>{difference === 0 ? 'Matches calorie target' : `${Math.abs(difference)} kcal ${difference < 0 ? 'below' : 'above'} calorie target`}</Badge>
    <small>Protein and carbohydrates use 4 kcal/g; fat uses 9 kcal/g. Fiber is shown separately. Food-label calories may differ because of rounding and other nutrients.</small></div>
  </details>;
}

function WaterTracker({ water, date, busy, error, onAdd, onDelete }) {
  const [custom, setCustom] = useState('');
  const [deleting, setDeleting] = useState(null);
  const target = water.targetMilliliters;
  const submitCustom = async (event) => {
    event.preventDefault();
    const amount = Number(custom);
    if (Number.isInteger(amount) && amount > 0 && amount <= 5000 && await onAdd(amount)) setCustom('');
  };
  const hasTarget = Number.isFinite(target) && target > 0;
  const fill = hasTarget ? Math.min(100, Math.max(0, water.consumedMilliliters / target * 100)) : 0;
  return <Surface className="water-card water-jug-card">
    <div className="water-jug-overview">
      <div className="water-jug" role={hasTarget ? 'progressbar' : 'img'} aria-label="Daily water intake"
        aria-valuemin={hasTarget ? 0 : undefined} aria-valuemax={hasTarget ? target : undefined}
        aria-valuenow={hasTarget ? Math.min(water.consumedMilliliters, target) : undefined}
        aria-valuetext={hasTarget ? `${water.consumedMilliliters} of ${target} ml` : undefined}>
        <span className="water-jug-handle" aria-hidden="true" />
        <div className="water-jug-vessel" aria-hidden="true"><div className="water-jug-fill" style={{height:`${fill}%`}} /></div>
      </div>
      <div className="water-jug-copy"><h2>Daily water</h2><strong className="water-intake-total">{water.consumedMilliliters}<span> / {hasTarget ? target : '—'} ml</span></strong>
      <p>{!hasTarget ? 'Set a water target to see progress.' : water.overTargetMilliliters > 0 ? `${water.overTargetMilliliters} ml over target` : `${water.remainingMilliliters} ml remaining`}</p></div>
    </div>
    {error&&<StatusBanner tone="error" role="alert">{error}</StatusBanner>}
    <div className="water-actions">
      <Button icon={Droplets} disabled={busy} onClick={() => onAdd(250)}>+250 ml</Button>
      <Button icon={Droplets} disabled={busy} onClick={() => onAdd(500)}>+500 ml</Button>
      <details className="water-custom"><summary>Custom amount</summary><form onSubmit={submitCustom}><input aria-label="Custom water amount in milliliters" type="number" min="1" max="5000" step="1" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Custom ml" /><Button type="submit" disabled={busy || !custom}>Add</Button></form></details>
    </div>
    {water.entries.length > 0 && <details className="water-history"><summary>Entries ({water.entries.length})</summary><div className="water-entries" aria-label={`Water entries for ${date}`}>{water.entries.map((entry) => <span key={entry.id}><Droplets size={14} aria-hidden="true" /> {entry.amountMilliliters} ml <button type="button" aria-label={`Delete ${entry.amountMilliliters} ml water entry`} title="Delete water entry" onClick={() => setDeleting(entry)}><Trash2 size={14} aria-hidden="true" /></button></span>)}</div></details>}
    {deleting && createPortal(<ConfirmDialog open title="Delete water entry?" description={deleting ? `${deleting.amountMilliliters} ml will be removed from this day.` : ''} confirmLabel="Delete entry" busy={busy} onCancel={() => setDeleting(null)} onConfirm={async () => { const entry = deleting; setDeleting(null); await onDelete(entry.id); }} />, document.body)}
  </Surface>;
}

function DietForm({ initial, busy, onCancel, onSave }) {
  const targets = initial.kind === 'targets';
  const [form, setForm] = useState(targets ? initial.targets : initial);
  const macro = targets ? calculateMacroCalories(form) : null;
  const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  return <Surface className={`diet-editor${targets ? ' diet-target-editor' : ''}`}><h2>{targets ? 'Daily targets' : initial.id ? 'Edit meal' : 'Add meal manually'}</h2>
    {targets && <p>Set protein, carbs, fat and fiber. Calories are calculated from protein × 4 + carbs × 4 + fat × 9; fiber is tracked separately.</p>}
    <form onSubmit={(event) => {
      event.preventDefault();
      if (targets) return onSave(Object.fromEntries([...nutrients.filter(([key])=>key!=='calories').map(([key]) => key), 'waterMilliliters'].map((key) => [key, Number(form[key])])));
      const nutrition = Object.fromEntries(nutrients.map(([key]) => [key, Number(form.nutrition[key])]));
      return onSave({ date: form.date, name: form.name, mealType: form.mealType, servingDescription: form.servingDescription, nutrition });
    }}><fieldset disabled={busy} className="diet-form-grid">
      {!targets && <>
        <label>Meal name<input {...field('name')} required maxLength={120} autoFocus /></label>
        <label>Date<input type="date" {...field('date')} required /></label>
        <label>Meal type<select {...field('mealType')}>{types.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
        <label>Serving (optional)<input {...field('servingDescription')} maxLength={80} placeholder="e.g. 1 bowl" /></label>
      </>}
      {targets ? <>
        {nutrients.filter(([key])=>key!=='calories').map(([key, nutrientLabel, unit]) => <label key={key}>{nutrientLabel} ({unit})<input required type="number" min="0.1" step="0.1" {...field(key)} /></label>)}<label>Calories (automatic)<input readOnly value={macro ? `${Math.round(macro.total)} kcal` : '—'} /></label>
        <label>Water (ml)<input required type="number" min="1" step="1" {...field('waterMilliliters')} /></label>
        {macro && <div className="macro-form-preview"><span>Protein {macro.protein} + Carbs {macro.carbohydrates} + Fat {macro.fat} kcal</span></div>}
      </> : nutrients.map(([key, nutrientLabel, unit]) => <label key={key}>{nutrientLabel} ({unit})<input required type="number" min="0" step={key === 'calories' ? 1 : .1} value={form.nutrition[key]} onChange={(event) => setForm({ ...form, nutrition: { ...form.nutrition, [key]: event.target.value } })} /></label>)}
      <div className="diet-toolbar"><Button variant="primary" icon={Save} type="submit">{busy ? 'Saving…' : 'Save'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
    </fieldset></form>
  </Surface>;
}

function MealLibrary({ apiRequest, selectedDate, onAdded }) {
  const [meals, setMeals] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState(null);
  const [adding, setAdding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (category) query.set('category', category);
    apiRequest(`/api/diet/library-meals${query.size ? `?${query}` : ''}`).then((result) => {
      if (active) { setMeals(result.meals); setHasMore(result.hasMore); setError(''); }
    }).catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiRequest, search, category, version]);

  async function request(action, work, success) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await work(); setMessage(success); setVersion((value) => value + 1); action?.(); return result; }
    catch (requestError) { setError(requestError.message); return null; }
    finally { setBusy(false); }
  }

  const blankMeal = { name: '', category: 'breakfast', servingDescription: '', nutrition: blankNutrition(), ingredients: '', notes: '' };
  return <Surface className="meal-library">
    <SectionHeader eyebrow="Reusable meals" title="Meal Library" description="Each saved meal represents one defined serving." action={<div className="diet-toolbar"><Button icon={Plus} onClick={() => setEditor(blankMeal)}>Add meal</Button><Button icon={Upload} onClick={() => setImportOpen((open) => !open)}>Import CSV</Button></div>} />
    <div className="library-filters"><label><Search size={17} aria-hidden="true" /><input aria-label="Search Meal Library" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search meals" /></label><select aria-label="Filter Meal Library by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{types.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></div>
    {error && <StatusBanner tone="error" role="alert">{error}</StatusBanner>}
    {message && <StatusBanner tone="success" role="status">{message}</StatusBanner>}
    {importOpen && <CsvImport apiRequest={apiRequest} busy={busy} setBusy={setBusy} onImported={(count) => { setImportOpen(false); setMessage(`${count} meals imported.`); setVersion((value) => value + 1); }} />}
    {editor && <LibraryMealForm initial={editor} busy={busy} onCancel={() => setEditor(null)} onSave={(values) => request(() => setEditor(null), () => apiRequest(`/api/diet/library-meals${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PATCH' : 'POST', body: JSON.stringify(values) }), editor.id ? 'Library meal updated.' : 'Library meal created.')} />}
    {adding && <AddLibraryMealForm meal={adding} initialDate={localDate()} selectedDate={selectedDate} busy={busy} onCancel={() => setAdding(null)} onSave={(values) => request(() => { setAdding(null); onAdded(values.date); }, () => apiRequest(`/api/diet/library-meals/${adding.id}/add-to-day`, { method: 'POST', body: JSON.stringify(values) }), 'Meal added to daily record.')} />}
    {loading ? <LoadingState>Loading Meal Library…</LoadingState> : !meals.length ? <EmptyState icon={Library} title="No saved meals" description="Create a reusable meal or import a CSV file." action={<Button variant="primary" icon={Plus} onClick={() => setEditor(blankMeal)}>Add library meal</Button>} /> : <div className="library-list">{meals.map((meal) => <article key={meal.id} className="library-meal">
      <div className="library-meal-heading"><div><h3>{meal.name}</h3><p>{label(meal.category)} · {meal.servingDescription}</p></div><Badge>{meal.nutrition.calories} kcal</Badge></div>
      <p className="diet-nutrition">Protein {meal.nutrition.proteinGrams} g · Carbs {meal.nutrition.carbohydrateGrams} g · Fat {meal.nutrition.fatGrams} g · Fiber {meal.nutrition.fiberGrams} g</p>
      {expanded === meal.id && <div className="library-details"><p><strong>Ingredients:</strong> {meal.ingredients || 'None added'}</p><p><strong>Notes:</strong> {meal.notes || 'None added'}</p></div>}
      <div className="diet-toolbar"><Button variant="primary" icon={Plus} onClick={() => setAdding(meal)}>Add to today</Button><Button onClick={() => setExpanded(expanded === meal.id ? null : meal.id)}>{expanded === meal.id ? 'Hide details' : 'View'}</Button><Button icon={Pencil} onClick={() => setEditor(meal)}>Edit</Button><Button variant="danger" icon={Trash2} onClick={() => setDeleting(meal)}>Delete</Button></div>
    </article>)}</div>}
    {hasMore && <StatusBanner>More than 200 meals match. Refine the search or category filter.</StatusBanner>}
    <ConfirmDialog open={Boolean(deleting)} title="Delete library meal?" description={deleting ? `${deleting.name} will be removed from the library. Existing daily records will not change.` : ''} confirmLabel="Delete meal" busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => request(() => setDeleting(null), () => apiRequest(`/api/diet/library-meals/${deleting.id}`, { method: 'DELETE' }), 'Library meal deleted.')} />
  </Surface>;
}

export function LibraryMealForm({ initial, busy, onCancel, onSave }) {
  const [form, setForm] = useState({ ...initial, nutrition: { ...initial.nutrition } });
  const set = (key, value) => setForm({ ...form, [key]: value });
  return <Surface className="library-editor"><h3>{initial.id ? 'Edit library meal' : 'Add library meal'}</h3><form onSubmit={(event) => { event.preventDefault(); onSave({ name: form.name, category: form.category, servingDescription: form.servingDescription, nutrition: Object.fromEntries(nutrients.map(([key]) => [key, Number(form.nutrition[key])])), ingredients: form.ingredients, notes: form.notes }); }}><fieldset disabled={busy} className="diet-form-grid">
    <label>Name<input required maxLength="120" value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
    <label>Category<select value={form.category} onChange={(event) => set('category', event.target.value)}>{types.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
    <label>Serving description<input required maxLength="80" value={form.servingDescription} onChange={(event) => set('servingDescription', event.target.value)} placeholder="e.g. 1 bowl" /></label>
    {nutrients.map(([key, nutrientLabel, unit]) => <label key={key}>{nutrientLabel} ({unit})<input required type="number" min="0" step={key === 'calories' ? 1 : .1} value={form.nutrition[key]} onChange={(event) => setForm({ ...form, nutrition: { ...form.nutrition, [key]: event.target.value } })} /></label>)}
    <label className="wide-field">Ingredients (optional)<textarea maxLength="1000" value={form.ingredients} onChange={(event) => set('ingredients', event.target.value)} /></label>
    <label className="wide-field">Notes (optional)<textarea maxLength="1000" value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label>
    <div className="diet-toolbar"><Button variant="primary" icon={Save} type="submit">Save meal</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
  </fieldset></form></Surface>;
}

export function AddLibraryMealForm({ meal, initialDate, selectedDate, busy, onCancel, onSave }) {
  const [form, setForm] = useState({ date: initialDate, mealType: meal.category, quantity: 1 });
  const result = useMemo(() => scaledNutrition(meal, Number(form.quantity) || 0), [meal, form.quantity]);
  return <Surface className="library-editor"><h3>Add {meal.name} to a day</h3><p>One serving is {meal.servingDescription}. The form defaults to today; choose another date if needed.</p>{initialDate !== selectedDate && <button className="text-action" type="button" onClick={() => setForm({ ...form, date: selectedDate })}>Use selected date ({selectedDate})</button>}<form onSubmit={(event) => { event.preventDefault(); onSave({ date: form.date, mealType: form.mealType, quantity: Number(form.quantity) }); }}><fieldset disabled={busy} className="diet-form-grid">
    <label>Quantity<input type="number" required min="0.01" max="100" step="0.01" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
    <label>Meal type<select value={form.mealType} onChange={(event) => setForm({ ...form, mealType: event.target.value })}>{types.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
    <label>Date<input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
    <div className="scaled-result"><strong>Result</strong><span>{result.calories} kcal · P{result.proteinGrams} · C{result.carbohydrateGrams} · F{result.fatGrams} · Fiber {result.fiberGrams} g</span></div>
    <div className="diet-toolbar"><Button variant="primary" icon={Check} type="submit">Add to day</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
  </fieldset></form></Surface>;
}

function CsvImport({ apiRequest, busy, setBusy, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  async function createPreview() {
    if (!file) return;
    setBusy(true); setError(''); setPreview(null);
    try {
      const form = new FormData(); form.append('file', file);
      const result = await apiRequest('/api/diet/library-meals/import-preview', { method: 'POST', body: form });
      setPreview(result); setSelected(new Set(result.validRows.map((row) => row.sourceRowNumber)));
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function importRows() {
    const rows = preview.validRows.filter((row) => selected.has(row.sourceRowNumber));
    setBusy(true); setError('');
    try { const result = await apiRequest('/api/diet/library-meals/import', { method: 'POST', body: JSON.stringify({ rows }) }); onImported(result.importedCount); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <Surface className="csv-import"><h3>Import Meal Library CSV</h3><p>Choose a UTF-8 CSV up to 1 MB and 500 data rows. Preview never saves meals.</p><div className="csv-picker"><input aria-label="Choose Meal Library CSV" type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files[0] || null); setPreview(null); }} /><Button icon={Upload} disabled={busy || !file} onClick={createPreview}>Preview CSV</Button></div>{error && <StatusBanner tone="error" role="alert">{error}</StatusBanner>}{preview && <><StatusBanner>Nothing has been saved yet. Review and select valid rows before importing.</StatusBanner><div className="csv-preview"><section><h4>Valid rows ({preview.validRows.length})</h4>{preview.validRows.map((row) => <label key={row.sourceRowNumber}><input type="checkbox" checked={selected.has(row.sourceRowNumber)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.sourceRowNumber)) next.delete(row.sourceRowNumber); else next.add(row.sourceRowNumber); return next; })} /><span>Row {row.sourceRowNumber} · {row.name}</span></label>)}</section><section><h4>Invalid rows ({preview.invalidRows.length})</h4>{preview.invalidRows.length ? preview.invalidRows.map((row) => <article key={row.rowNumber}><strong>Row {row.rowNumber}</strong><span>{Object.entries(row.fields).map(([key, value]) => `${key}: ${value}`).join(' · ')}</span></article>) : <p>None</p>}</section></div><Button variant="primary" icon={Check} disabled={busy || selected.size === 0} onClick={importRows}>Import {selected.size} selected meal{selected.size === 1 ? '' : 's'}</Button></>}</Surface>;
}
