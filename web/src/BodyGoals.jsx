import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Check, RotateCw, Save, Scale, Target } from 'lucide-react';
import { Button, ConfirmDialog, FormField, LoadingState, SectionHeader, StatCard, StatusBanner } from './ui';
import './bodyGoals.css';

import MeasurementInput from './MeasurementInput';
import { defaults, today, shownDate, displayNumber, toDisplayWeight, bodyInput, editable, requireBodyGoalsResponse } from './bodyGoalValues';

export default function BodyGoals({ apiRequest, onTargetApplied, onSaved, onShowTrends, onLogWeight, refreshVersion = 0 }) {
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState(null);
  const [revision, setRevision] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const dirtyRef = useRef(false);
  const lastVersion = useRef(refreshVersion);
  const [estimate, setEstimate] = useState(null);
  const [previewKey, setPreviewKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [reload, setReload] = useState(0);
  const input = bodyInput(form);
  const formKey = JSON.stringify(input);
  const savedKey = saved ? JSON.stringify(bodyInput(editable(saved))) : '';
  const dirty = formKey !== savedKey;
  const stale = previewKey !== formKey;
  dirtyRef.current = dirty;
  const units = form.units;
  const weightUnit = units === 'imperial' ? 'lb' : 'kg';
  useEffect(() => {
    const changed = lastVersion.current !== refreshVersion;
    lastVersion.current = refreshVersion;
    if (changed && dirtyRef.current) { setError('Weight records changed. Reload saved data before saving this draft.'); setReady(false); return; }
    let active = true;
    setLoading(true); setReady(false); setError('');
    apiRequest('/api/diet/body-goals').then(result => {
      requireBodyGoalsResponse(result);
      if (!active) return;
      const next = result.profile ? editable(result.profile) : { ...defaults(), ...(result.latestWeight ? { weightKg: result.latestWeight.weightKg, measuredOn: result.latestWeight.date, units: result.latestWeight.units } : {}) };
      setRevision(result.revision ?? result.profile?.revision ?? 0);
      setForm(next); setSaved(result.profile); setEstimate(result.estimate); setPreviewKey(JSON.stringify(bodyInput(next))); setReady(true);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiRequest, reload, refreshVersion]);
  function change(key, value) { setForm(current => ({ ...current, [key]: value })); setMessage(''); setError(''); setFieldErrors({}); }
  async function calculate(save) {
    if (!ready || !formRef.current?.reportValidity()) return;
    setBusy(true); setError(''); setMessage(''); setFieldErrors({});
    try {
      const result = await apiRequest('/api/diet/body-goals' + (save ? '' : '/preview'), { method: save ? 'PUT' : 'POST', body: JSON.stringify({ ...input, ...(save ? { expectedRevision: revision } : {}) }) });
      if (save) requireBodyGoalsResponse(result);
      setEstimate(result.estimate); setPreviewKey(formKey);
      if (save) { setRevision(result.revision ?? result.profile.revision); setSaved(result.profile); const next = editable(result.profile); setForm(next); setPreviewKey(JSON.stringify(bodyInput(next))); }
      if (save) onSaved?.();
      setMessage(save ? 'Body measurements and goal saved.' : 'Preview ready. Save when this plan works for you.');
    } catch (e) { setError(e.message); setFieldErrors(e.details?.fields || {}); }
    finally { setBusy(false); }
  }
  async function applyTarget() {
    setBusy(true); setError(''); setMessage(''); setFieldErrors({});
    try {
      const result = await apiRequest('/api/diet/body-goals/apply-target', { method: 'POST', body: JSON.stringify({ expectedRevision: saved.revision }) });
      setRevision(result.revision ?? result.profile.revision); setSaved(result.profile); setConfirm(false);
      setMessage(`Daily target applied: ${result.appliedCalories} kcal. Macro proportions retained.`);
      onSaved?.();
      await onTargetApplied();
    } catch (e) { setError(e.message); setConfirm(false); }
    finally { setBusy(false); }
  }
  return <section className="body-goals-card" aria-label="Body and Goals">
    <SectionHeader title="Body & Goals" description="Set your starting measurements and choose a direction. Log ongoing weights in Daily Record." action={<span className="body-goals-icon"><Scale size={21} aria-hidden="true"/></span>} />
    {loading ? <LoadingState>Loading body measurements…</LoadingState> : <>
      {error && <StatusBanner tone="error" role="alert">{error} <Button icon={RotateCw} disabled={busy} onClick={() => setReload(n => n + 1)}>Reload saved data</Button></StatusBanner>}
      {message && <StatusBanner tone="success" role="status">{message}</StatusBanner>}
      <div className="body-goals-layout">
        <form ref={formRef} className="body-goals-form" onSubmit={e => { e.preventDefault(); calculate(true); }}>
          <fieldset disabled={busy || !ready}>
            <legend><span>1</span> Your measurements</legend>
            <div className="body-goals-fields">
              <FormField label="Units"><select value={units} onChange={e => change('units', e.target.value)}><option value="metric">Metric · cm / kg</option><option value="imperial">Imperial · in / lb</option></select></FormField>
              <FormField label="Measured on" error={fieldErrors.measuredOn}><input type="date" required max={today()} min={saved?.measuredOn} value={form.measuredOn} onChange={e => change('measuredOn', e.target.value)}/></FormField>
              <FormField error={fieldErrors.heightCm} label={`Height (${units === 'imperial' ? 'inches' : 'cm'})`}><MeasurementInput required min={100} max={250} value={form.heightCm} scale={units === 'imperial' ? 2.54 : 1} onChange={v => change('heightCm', v)}/></FormField>
              <FormField error={fieldErrors.weightKg} label={`Current weight (${weightUnit})`}><MeasurementInput required min={25} max={350} value={form.weightKg} scale={units === 'imperial' ? 0.45359237 : 1} onChange={v => change('weightKg', v)}/></FormField>
            </div>
          </fieldset>
          <fieldset className="body-goals-optional" disabled={busy || !ready}>
            <legend><span>2</span> Calorie estimate <small>Optional</small></legend>
              <div className="body-goals-fields">
                <FormField label="Age (years)" error={fieldErrors.age}><input type="number" min="1" max="120" step="1" value={form.age} onChange={e => change('age', e.target.value)}/></FormField>
                <FormField error={fieldErrors.sex} label="Sex used by calculation" hint="The equation uses these two coefficients."><select value={form.sex} onChange={e => change('sex', e.target.value)}><option value="">Choose / skip</option><option value="female">Female</option><option value="male">Male</option></select></FormField>
                <FormField error={fieldErrors.activity} label="Usual activity" hint="Include work, movement and exercise."><select value={form.activity} onChange={e => change('activity', e.target.value)}><option value="">Choose / skip</option><option value="sedentary">Mostly seated · little exercise</option><option value="light">Light · exercise 1–3 days/week</option><option value="moderate">Moderate · exercise 3–5 days/week</option><option value="active">Active · exercise 6–7 days/week</option></select></FormField>
              </div>
          </fieldset>
          <fieldset disabled={busy || !ready}>
            <legend><span>3</span> Your goal</legend>
            <div className="body-goals-choices" role="group" aria-label="Weight goal">{[['lose', 'Lose weight'], ['maintain', 'Maintain'], ['gain', 'Gain weight']].map(([key, title]) => <button key={key} type="button" aria-pressed={form.goal === key} onClick={() => change('goal', key)}>{title}</button>)}</div>
            {form.goal !== 'maintain' && <div className="body-goals-fields">
              <FormField error={fieldErrors.targetWeightKg} label={`Target weight (${weightUnit})`}><MeasurementInput required min={25} max={350} value={form.targetWeightKg} scale={units === 'imperial' ? 0.45359237 : 1} onChange={v => change('targetWeightKg', v)}/></FormField>
              <FormField label="Plan by"><select value={form.planMode} onChange={e => change('planMode', e.target.value)}><option value="pace">Weekly pace</option><option value="date">Target date</option></select></FormField>
              {form.planMode === 'pace' ? <FormField error={fieldErrors.paceKgWeek} label={`Weekly pace (${weightUnit}/week)`} hint={`Supported range: ${displayNumber(toDisplayWeight(0.1, units))}–${displayNumber(toDisplayWeight(0.5, units))} ${weightUnit}/week.`}><MeasurementInput required min={0.1} max={0.5} value={form.paceKgWeek} scale={units === 'imperial' ? 0.45359237 : 1} onChange={v => change('paceKgWeek', v)}/></FormField> : <FormField label="Target date" error={fieldErrors.targetDate}><input type="date" required min={saved?.planMode === 'date' && form.targetDate === saved.targetDate ? saved.baseline?.date || form.measuredOn : form.measuredOn} value={form.targetDate || ''} onChange={e => change('targetDate', e.target.value)}/></FormField>}
            </div>}
            <label className="body-goals-eligibility"><input type="checkbox" checked={form.eligible} onChange={e => change('eligible', e.target.checked)}/> <span>I am 18 or older and am not pregnant or breastfeeding. Enable adult estimates.</span></label>
          </fieldset>
          <div className="body-goals-actions"><Button type="button" icon={Activity} disabled={busy || !ready} onClick={() => calculate(false)}>Preview</Button><Button type="submit" variant="primary" icon={Save} disabled={busy || !ready || !dirty}>{busy ? 'Saving…' : 'Save plan'}</Button></div>
          {saved && <p className="body-goals-note">Latest weight: {displayNumber(toDisplayWeight(saved.weightKg, units))} {weightUnit} · {shownDate(saved.measuredOn)}. <button type="button" className="text-action" onClick={onLogWeight}>Record a daily weight</button></p>}
        </form>
        <div className="body-goals-results" aria-live="polite">
          <div className="body-goals-result-heading"><Target size={18} aria-hidden="true"/><h3>{dirty ? 'Explore your plan' : 'Your saved plan'}</h3></div>
          {estimate && stale && <StatusBanner>Measurements or goal changed. Preview to refresh these results.</StatusBanner>}
          {!estimate ? <div className="body-goals-placeholder"><Scale size={34} aria-hidden="true"/><h3>Your estimate will appear here</h3><p>Enter height and weight, then preview your BMI. Add optional answers when you want calorie estimates.</p></div> : <>
            <div className="body-goals-stats">
              <StatCard label="BMI" value={estimate.bmi} helper="Screening measure; not a diagnosis." icon={Scale}/>
              <StatCard label="Estimated maintenance" value={estimate.maintenanceCalories ? `${estimate.maintenanceCalories} kcal` : '—'} helper="Estimated daily calorie needs." icon={Activity}/>
              <StatCard label="Proposed daily target" value={estimate.proposedCalories ? `${estimate.proposedCalories} kcal` : '—'} helper={estimate.proposedCalories ? `${estimate.adjustmentPercent === 0 ? 'Maintenance' : `${Math.abs(estimate.adjustmentPercent)}% ${estimate.adjustmentPercent < 0 ? 'below' : 'above'} maintenance`}` : 'Complete optional answers to estimate.'} icon={Target}/>
            </div>
            {estimate.reason && <StatusBanner>{estimate.reason}</StatusBanner>}
            {estimate.prediction && <div className="body-goals-plan-summary"><h3>{estimate.goalReached ? 'Goal reached' : form.goal === 'maintain' ? 'Maintain your weight' : `Target: ${displayNumber(toDisplayWeight(form.targetWeightKg, units))} ${weightUnit}`}</h3><p>{estimate.goalReached ? 'Review your plan or switch to maintenance.' : form.goal === 'maintain' ? 'A steady-weight scenario.' : `Estimated arrival: ${shownDate(estimate.prediction.targetDate)} · about ${estimate.prediction.weeks} weeks from the latest weight.`}</p><Button type="button" disabled={dirty || stale} onClick={onShowTrends}>View weight prediction in Trends</Button>{dirty && <small>Save this plan to see its prediction in Trends.</small>}</div>}
            {estimate.proposedCalories && <Button icon={Check} disabled={busy || dirty || stale || !saved} onClick={() => setConfirm(true)}>Apply to daily targets</Button>}
            {dirty && estimate.proposedCalories && <p className="body-goals-note">Save this plan before applying its calorie target.</p>}
            <details className="body-goals-assumptions"><summary>How these estimates work</summary><p>Calories use the <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Mifflin–St Jeor equation</a>{estimate.activityFactor ? ` and an activity factor of ${estimate.activityFactor}` : ''}. Activity and individual needs vary. Adult estimates exclude pregnancy and breastfeeding.</p><p>The weight path assumes your selected weekly pace continues. The shaded band varies that pace by ±25%; it is illustrative, not a confidence interval. The calorie target does not guarantee this pace. Saved measurements update calorie estimates; changing a goal starts a new planned path.</p></details>
          </>}
        </div>
      </div>
    </>}
    {confirm && createPortal(<ConfirmDialog open={confirm} title="Apply this calorie estimate?" description={`Set daily calories to approximately ${estimate?.proposedCalories ?? ''} kcal and scale your current protein, carbohydrate and fat targets in proportion. Your fiber and water targets stay as configured. Existing daily targets must be set first.`} confirmLabel="Apply daily target" busy={busy} onCancel={() => setConfirm(false)} onConfirm={applyTarget}/>, document.body)}
  </section>;
}
