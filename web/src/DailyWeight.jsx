import { useEffect, useRef, useState } from 'react';
import { RotateCw, Save, Scale } from 'lucide-react';
import { Button, FormField, LoadingState, StatusBanner } from './ui';
import MeasurementInput from './MeasurementInput';
import { today, shownDate, displayNumber, toDisplayWeight, requireBodyGoalsResponse } from './bodyGoalValues';
import './bodyGoals.css';

export default function DailyWeight({ apiRequest, date, refreshVersion, onSaved }) {
  const [weight, setWeight] = useState(''), [units, setUnits] = useState('metric');
  const [entry, setEntry] = useState(null), [latest, setLatest] = useState(null), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [retry, setRetry] = useState(0);
  const dirtyRef = useRef(false);
  const dirty = weight !== '' && (entry == null || Math.abs(Number(weight) - entry.weightKg) > 0.00001);
  dirtyRef.current = dirty;
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    apiRequest(`/api/diet/body-goals/weights/${date}`).then(r => {
      requireBodyGoalsResponse(r);
      if (!active) return;
      setEntry(r.entry); setLatest(r.latestWeight); setRevision(r.revision); setReady(true);
      if (!dirtyRef.current) { setWeight(r.entry?.weightKg ?? ''); setUnits(r.latestWeight?.units || 'metric'); }
    }).catch(e => { if (active) { setError(e.message); setReady(false); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiRequest, date, refreshVersion, retry]);
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const r = await apiRequest(`/api/diet/body-goals/weights/${date}`, { method: 'PUT', body: JSON.stringify({ weightKg: Number(weight), units, expectedRevision: revision }) });
      setEntry(r.entry); setLatest(r.latestWeight); setRevision(r.revision); setWeight(r.entry.weightKg);
      setMessage('Weight recorded. Trends and body estimates are updated.');
      onSaved();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <section className="daily-weight-record" aria-label="Optional daily weight">
    <div className="daily-weight-heading"><span className="body-goals-icon"><Scale size={20} aria-hidden="true"/></span><div><h3>Weight <small>Optional</small></h3><p>{entry ? `Recorded for ${shownDate(date)}` : 'A quick check-in. Skip it whenever you like.'}</p></div></div>
    {loading ? <LoadingState>Loading weight record…</LoadingState> : <form onSubmit={save} className="daily-weight-form"><fieldset disabled={busy || !ready || date > today()}><FormField label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`}><MeasurementInput value={weight} scale={units === 'imperial' ? 0.45359237 : 1} min={25} max={350} required onChange={v => { setWeight(v); setMessage(''); }}/></FormField><FormField label="Units"><select value={units} onChange={e => setUnits(e.target.value)}><option value="metric">kg</option><option value="imperial">lb</option></select></FormField><Button type="submit" icon={Save} variant="primary" disabled={!dirty}>{busy ? 'Saving…' : entry ? 'Update weight' : 'Record weight'}</Button></fieldset></form>}
    {date > today() && <p className="body-goals-note">Weight can be recorded for today or a past date.</p>}
    {latest && !entry && <p className="body-goals-note daily-weight-latest">Latest: {displayNumber(toDisplayWeight(latest.weightKg, units))} {units === 'imperial' ? 'lb' : 'kg'} · {shownDate(latest.date)}</p>}
    {error && <StatusBanner tone="error" role="alert">{error} <Button icon={RotateCw} disabled={busy} onClick={() => setRetry(n => n+1)}>Reload</Button></StatusBanner>}
    {message && <StatusBanner tone="success" role="status">{message}</StatusBanner>}
  </section>;
}
