import { useEffect, useState } from 'react';
import { RotateCw, Scale } from 'lucide-react';
import { Button, EmptyState, LoadingState, StatusBanner } from './ui';
import WeightProjection from './WeightProjection';
import { displayNumber, toDisplayWeight, shownDate, requireBodyGoalsResponse } from './bodyGoalValues';

export default function WeightTrends({ apiRequest, refreshVersion, onSetup }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0), [units, setUnits] = useState('metric');
  useEffect(() => {
    let active = true; setError('');
    apiRequest('/api/diet/body-goals').then(r => { requireBodyGoalsResponse(r); if (active) { setData(r); setUnits(r.latestWeight?.units || 'metric'); } }).catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [apiRequest, refreshVersion, retry]);
  if (error) return <StatusBanner tone="error" role="alert">{error} <Button icon={RotateCw} onClick={() => setRetry(n => n+1)}>Retry</Button></StatusBanner>;
  if (!data) return <LoadingState>Loading weight trends…</LoadingState>;
  const prediction = data.estimate?.prediction;
  const weightUnit = units === 'imperial' ? 'lb' : 'kg';
  return <section className="weight-trends" aria-label="Weight trends and prediction">
    <div className="weight-trends-header"><div><h3>Weight & prediction</h3><p>Recorded progress and an estimated path from your latest weight.</p></div><label className="weight-chart-units"><span className="sr-only">Chart weight units</span><select value={units} onChange={e => setUnits(e.target.value)}><option value="metric">kg</option><option value="imperial">lb</option></select></label></div>
    {!data.weights.length ? <EmptyState icon={Scale} title="Your weight journey starts here" description="Record an optional weight in Daily Record. Set a goal in Body & Goals to add a prediction." action={<Button onClick={onSetup}>Set up Body & Goals</Button>}/> : <>
      <div className="weight-trends-summary"><div><span>Latest weight</span><strong>{displayNumber(toDisplayWeight(data.latestWeight.weightKg, units))} <small>{weightUnit}</small></strong><small>{shownDate(data.latestWeight.date)}</small></div><div><span>Goal weight</span><strong>{data.profile ? `${displayNumber(toDisplayWeight(data.profile.targetWeightKg, units))} ${weightUnit}` : '—'}</strong><small>{data.estimate?.goalReached ? 'Goal reached' : data.profile?.goal || 'Set a goal to predict'}</small></div><div><span>Estimated arrival</span><strong>{prediction && prediction.paceKgWeek > 0 ? shownDate(prediction.targetDate) : prediction ? 'Steady weight' : '—'}</strong><small>{prediction && prediction.paceKgWeek > 0 ? `About ${prediction.weeks} weeks` : 'Based on your selected pace'}</small></div></div>
      <WeightProjection projection={prediction} weights={data.weights} units={units}/>
      {!prediction && <StatusBanner>{data.estimate?.reason || 'Set your height and weight goal, then confirm adult eligibility to add a prediction.'} <Button onClick={onSetup}>Body & Goals</Button></StatusBanner>}
      {prediction && <p className="body-goals-note">This is a pace-based estimate, not a guarantee. The shaded range varies the selected pace by ±25%. New weight records refresh the prediction; daily calorie targets change only when you apply them.</p>}
    </>}
  </section>;
}
