import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Droplets, Library, Pencil,
  Plus, RotateCw, Save, Search, Target, Trash2, Upload, Utensils
} from 'lucide-react';
import {
  Badge, Button, ConfirmDialog, EmptyState, LoadingState, PageHeader,
  SectionHeader, StatusBanner, Surface
} from './ui';

const nutrients = [['calories', 'Calories', 'kcal'], ['proteinGrams', 'Protein', 'g'],
  ['carbohydrateGrams', 'Carbohydrates', 'g'], ['fatGrams', 'Fat', 'g'], ['fiberGrams', 'Fiber', 'g']];
const types = ['breakfast', 'lunch', 'dinner', 'snack'];
const blankNutrition = () => Object.fromEntries(nutrients.map(([key]) => [key, '']));
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const label = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const rounded = (value, places = 1) => Math.round(value * (10 ** places)) / (10 ** places);

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

export default function Diet({ apiRequest }) {
  const [date, setDate] = useState(localDate);
  return <DietDay key={date} date={date} setDate={setDate} apiRequest={apiRequest} />;
}

function DietDay({ date, setDate, apiRequest }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    apiRequest(`/api/diet/days/${date}`).then((result) => {
      if (active) { setData(result); setError(''); }
    }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [date, version, apiRequest]);

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

  const deletingMeal = data?.meals.find((meal) => meal.id === deleting);
  const startMeal = () => setEditor({ kind: 'meal', date, name: '', mealType: 'breakfast', servingDescription: '', nutrition: blankNutrition() });
  const startTargets = () => setEditor({ kind: 'targets', targets: {
    ...Object.fromEntries(nutrients.map(([key]) => [key, data.targets?.[key] ?? ''])),
    waterMilliliters: data.targets?.waterMilliliters ?? ''
  } });

  return <section className="profile-content diet-page">
    <PageHeader eyebrow="Personal / Diet" title="Daily diet" description="Track meals, water, and daily nutrition in one place." />
    <div className="diet-toolbar">
      <Button icon={ChevronLeft} disabled={busy} onClick={() => moveDate(-1)}>Previous</Button>
      <label className="diet-date"><CalendarDays size={18} aria-hidden="true" /><span>Date</span><input aria-label="Diet date" type="date" value={date} disabled={busy}
        onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></label>
      <Button disabled={busy} onClick={() => setDate(localDate())}>Today</Button>
      <Button icon={ChevronRight} disabled={busy} onClick={() => moveDate(1)}>Next</Button>
    </div>
    {error && <StatusBanner tone="error" role="alert">{error} <button className="text-action" onClick={() => setVersion((value) => value + 1)}><RotateCw size={15} aria-hidden="true" /> Retry</button></StatusBanner>}
    {message && <StatusBanner tone="success" role="status">{message}</StatusBanner>}
    {!data && !error && <LoadingState>Loading diet record…</LoadingState>}
    {data && <>
      <section className="diet-target-section">
        <SectionHeader eyebrow="Daily targets" title="Nutrition" action={<Button icon={Target} disabled={busy} onClick={startTargets}>Edit targets</Button>} />
        <div className="diet-summary">{nutrients.map(([key, nutrientLabel, unit]) =>
          <Surface as="article" key={key} className={data.overTarget?.[key] > 0 ? 'over-target' : ''}>
            <p className="eyebrow">{nutrientLabel}</p><strong>{data.totals[key]} <small>{unit}</small></strong>
            <p>{data.targets ? `Target ${data.targets[key]} ${unit}` : 'No target set'}</p>
            {data.targets && <progress aria-label={`${nutrientLabel} toward target`} value={Math.min(data.totals[key], data.targets[key])} max={data.targets[key]} />}
            {data.overTarget?.[key] > 0 && <span>{data.overTarget[key]} {unit} over target</span>}
          </Surface>)}</div>
        {data.macroCalories ? <MacroSummary macro={data.macroCalories} /> : <StatusBanner>Set your six daily targets to compare macros, calories, and water.</StatusBanner>}
      </section>

      <WaterTracker water={data.water} date={date} busy={busy} onAdd={(amountMilliliters) => mutate('/api/diet/water-entries', 'POST', { date, amountMilliliters }, `${amountMilliliters} ml added.`)} onDelete={(id) => mutate(`/api/diet/water-entries/${id}`, 'DELETE', null, 'Water entry deleted.')} />

      <div className="diet-toolbar diet-actions">
        <Button variant="primary" icon={Plus} disabled={busy} onClick={startMeal}>Add meal</Button>
        <Button icon={Library} disabled={busy} onClick={() => setLibraryOpen((open) => !open)}>{libraryOpen ? 'Hide Meal Library' : 'Meal Library'}</Button>
      </div>

      {libraryOpen && <MealLibrary apiRequest={apiRequest} selectedDate={date} onAdded={(addedDate) => {
        setMessage(`Library meal added to ${addedDate}.`);
        if (addedDate === date) setVersion((value) => value + 1);
      }} />}

      <section className="daily-meals">
        <SectionHeader eyebrow="Selected day" title="Meals" />
        {!data.meals.length && <EmptyState icon={Utensils} title="No meals yet" description="Add a one-off meal or choose one from your Meal Library." action={<Button variant="primary" icon={Plus} onClick={startMeal}>Add meal</Button>} />}
        {types.map((type) => {
          const meals = data.meals.filter((meal) => meal.mealType === type);
          return meals.length > 0 && <section className="diet-meal-group" key={type}><h2>{label(type)}</h2>
            {meals.map((meal) => <Surface as="article" className="diet-meal" key={meal.id}>
              <div><div className="meal-title"><h3>{meal.name}</h3>{meal.source === 'library' && <Badge tone="neutral">Library · {meal.quantity}×</Badge>}</div>
                {meal.servingDescription && <p>{meal.servingDescription}</p>}
                <p className="diet-nutrition">{nutrients.map(([key, nutrientLabel, unit]) => `${nutrientLabel}: ${meal.nutrition[key]} ${unit}`).join(' · ')}</p></div>
              <div className="diet-toolbar"><Button icon={Pencil} disabled={busy} onClick={() => setEditor({ ...meal, kind: 'meal' })}>Edit</Button>
                <Button variant="danger" icon={Trash2} disabled={busy} onClick={() => setDeleting(meal.id)}>Delete</Button></div>
            </Surface>)}</section>;
        })}
      </section>
    </>}

    {editor && <DietForm key={`${editor.kind}-${editor.id || 'new'}`} initial={editor} busy={busy} onCancel={() => setEditor(null)} onSave={(values) => {
      if (editor.kind === 'targets') return mutate('/api/diet/targets', 'PUT', values, 'Daily targets saved.');
      return mutate(`/api/diet/meals${editor.id ? `/${editor.id}` : ''}`, editor.id ? 'PATCH' : 'POST', values, 'Meal saved.');
    }} />}
    <ConfirmDialog open={Boolean(deletingMeal)} title="Delete meal?" description={deletingMeal ? `${deletingMeal.name} will be removed from this daily record.` : ''} confirmLabel="Delete meal" busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => mutate(`/api/diet/meals/${deletingMeal.id}`, 'DELETE', null, 'Meal deleted.')} />
  </section>;
}

function MacroSummary({ macro }) {
  const difference = macro.differenceFromCalorieTarget;
  return <Surface className="macro-summary">
    <div><strong>Macro target</strong><span>Protein {macro.protein} + Carbs {macro.carbohydrates} + Fat {macro.fat} = {macro.total} kcal</span></div>
    <Badge tone={difference === 0 ? 'success' : 'neutral'}>{difference === 0 ? 'Matches calorie target' : `${Math.abs(difference)} kcal ${difference < 0 ? 'below' : 'above'} calorie target`}</Badge>
    <small>Protein and carbohydrates use 4 kcal/g; fat uses 9 kcal/g. Fiber is shown separately. Food-label calories may differ because of rounding and other nutrients.</small>
  </Surface>;
}

function WaterTracker({ water, date, busy, onAdd, onDelete }) {
  const [custom, setCustom] = useState('');
  const [deleting, setDeleting] = useState(null);
  const target = water.targetMilliliters;
  const submitCustom = async (event) => {
    event.preventDefault();
    const amount = Number(custom);
    if (Number.isInteger(amount) && amount > 0 && amount <= 5000 && await onAdd(amount)) setCustom('');
  };
  return <Surface className="water-card">
    <SectionHeader eyebrow="Daily intake" title="Water" action={<strong>{water.consumedMilliliters} / {target ?? '—'} ml</strong>} />
    {target !== null && <progress aria-label="Water toward target" value={Math.min(water.consumedMilliliters, target)} max={target} />}
    <p>{target === null ? 'Add a water target to see progress.' : water.overTargetMilliliters > 0 ? `${water.overTargetMilliliters} ml over target` : `${water.remainingMilliliters} ml remaining`}</p>
    <div className="water-actions">
      <Button icon={Droplets} disabled={busy} onClick={() => onAdd(250)}>+250 ml</Button>
      <Button icon={Droplets} disabled={busy} onClick={() => onAdd(500)}>+500 ml</Button>
      <form onSubmit={submitCustom}><input aria-label="Custom water amount in milliliters" type="number" min="1" max="5000" step="1" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Custom ml" /><Button type="submit" disabled={busy || !custom}>Add</Button></form>
    </div>
    {water.entries.length > 0 && <div className="water-entries" aria-label={`Water entries for ${date}`}>{water.entries.map((entry) => <span key={entry.id}><Droplets size={14} aria-hidden="true" /> {entry.amountMilliliters} ml <button type="button" aria-label={`Delete ${entry.amountMilliliters} ml water entry`} title="Delete water entry" onClick={() => setDeleting(entry)}><Trash2 size={14} aria-hidden="true" /></button></span>)}</div>}
    <ConfirmDialog open={Boolean(deleting)} title="Delete water entry?" description={deleting ? `${deleting.amountMilliliters} ml will be removed from this day.` : ''} confirmLabel="Delete entry" busy={busy} onCancel={() => setDeleting(null)} onConfirm={async () => { const entry = deleting; setDeleting(null); await onDelete(entry.id); }} />
  </Surface>;
}

function DietForm({ initial, busy, onCancel, onSave }) {
  const targets = initial.kind === 'targets';
  const [form, setForm] = useState(targets ? initial.targets : initial);
  const macro = targets ? calculateMacroCalories(form) : null;
  const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  return <Surface className="diet-editor"><h2>{targets ? 'Daily targets' : initial.id ? 'Edit meal' : 'Add meal manually'}</h2>
    {targets && <p>Targets stay independently editable. The calculator explains their relationship without changing them.</p>}
    <form onSubmit={(event) => {
      event.preventDefault();
      if (targets) return onSave(Object.fromEntries([...nutrients.map(([key]) => key), 'waterMilliliters'].map((key) => [key, Number(form[key])])));
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
        {nutrients.map(([key, nutrientLabel, unit]) => <label key={key}>{nutrientLabel} ({unit})<input required type="number" min={key === 'calories' ? 1 : .1} step={key === 'calories' ? 1 : .1} {...field(key)} /></label>)}
        <label>Water (ml)<input required type="number" min="1" step="1" {...field('waterMilliliters')} /></label>
        {macro && <div className="macro-form-preview"><strong>{macro.total} kcal from macros</strong><span>{macro.protein} protein + {macro.carbohydrates} carbs + {macro.fat} fat</span><span>{Math.abs(macro.differenceFromCalorieTarget)} kcal {macro.differenceFromCalorieTarget < 0 ? 'below' : macro.differenceFromCalorieTarget > 0 ? 'above' : 'equal to'} calorie target</span></div>}
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

function LibraryMealForm({ initial, busy, onCancel, onSave }) {
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

function AddLibraryMealForm({ meal, initialDate, selectedDate, busy, onCancel, onSave }) {
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
