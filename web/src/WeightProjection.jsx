import { shownDate, displayNumber, toDisplayWeight } from './bodyGoalValues';
import './bodyGoals.css';

export default function WeightProjection({ projection, weights, units }) {
  const points = projection?.points || [];
  const actual = weights;
  if (!points.length && !actual.length) return <p>No weight records yet.</p>;
  const values = [...points.flatMap(p => [p.lowKg, p.highKg]), ...actual.map(p => p.weightKg)];
  const low = Math.min(...values) - 1, high = Math.max(...values) + 1;
  const start = Math.min(...points.map(p => Date.parse(p.date)), ...actual.map(p => Date.parse(p.date))), end = Math.max(points.length ? Date.parse(points.at(-1).date) : start, ...actual.map(p => Date.parse(p.date)));
  const x = d => 45 + (Date.parse(d) - start) / Math.max(86400000, end - start) * 430;
  const y = w => 175 - (w - low) / (high - low) * 135;
  const path = (rows, key) => rows.map((p, i) => `${i ? 'L' : 'M'}${x(p.date)},${y(p[key])}`).join(' ');
  const band = points.map(p => `${x(p.date)},${y(p.lowKg)}`).concat([...points].reverse().map(p => `${x(p.date)},${y(p.highKg)}`)).join(' ');
  const unit = units === 'imperial' ? 'lb' : 'kg';
  return <div className="body-goals-projection">
    <h3>{!projection ? 'Weight history' : projection?.paceKgWeek === 0 ? 'Maintain your direction' : 'Your projected path'}</h3>
    <p>{!projection ? 'Recorded weights over time.' : projection?.paceKgWeek === 0 ? 'A steady-weight scenario over the next 12 weeks.' : `About ${projection?.weeks} weeks · target around ${shownDate(projection?.targetDate)}`}</p>
    <svg viewBox="0 0 510 215" role="img" aria-label="Illustrative weight projection with recorded weights; exact values in the table below.">
      {[low + 1, (low + high)/2, high - 1].map((v, i) => <g key={i}><line x1="45" x2="475" y1={y(v)} y2={y(v)} className="body-goals-gridline"/><text x="38" y={y(v)+4} textAnchor="end">{displayNumber(toDisplayWeight(v, units))}</text></g>)}
      {points.length > 0 && <><polygon points={band} className="body-goals-band"/><path d={path(points, 'weightKg')} className="body-goals-plan-line"/></>}
      {actual.length > 1 && <path d={path(actual, 'weightKg')} className="body-goals-actual-line"/>}
      {actual.map(p => <circle key={p.date} cx={x(p.date)} cy={y(p.weightKg)} r="4" className="body-goals-actual-dot"><title>{shownDate(p.date)}: {displayNumber(toDisplayWeight(p.weightKg, units))} {unit}</title></circle>)}
      <text x="45" y="200">{shownDate(new Date(start).toISOString().slice(0,10))}</text><text x="475" y="200" textAnchor="end">{shownDate(new Date(end).toISOString().slice(0,10))}</text>
    </svg>
    <div className="body-goals-chart-key">{projection && <span>— Predicted path</span>}<span>● Recorded weight</span>{projection && <span>Shaded: pace scenario range</span>}</div>
    {projection?.earliestDate && <p className="body-goals-note">Illustrative arrival window: {shownDate(projection.earliestDate)}–{shownDate(projection.latestDate)}.</p>}
    <details><summary>View exact values & weight records</summary><div className="body-goals-table-scroll">{points.length > 0 && <table><caption>Predicted weight ({unit})</caption><thead><tr><th>Date</th><th>Planned</th><th>Scenario range</th></tr></thead><tbody>{points.map((p, i) => <tr key={i}><td>{shownDate(p.date)}</td><td>{displayNumber(toDisplayWeight(p.weightKg, units))}</td><td>{displayNumber(toDisplayWeight(p.lowKg, units))}–{displayNumber(toDisplayWeight(p.highKg, units))}</td></tr>)}</tbody></table>}
      {weights.length > 0 && <table><caption>Recorded weights ({unit})</caption><thead><tr><th>Date</th><th>Weight</th></tr></thead><tbody>{weights.map(w => <tr key={w.date}><td>{shownDate(w.date)}</td><td>{displayNumber(toDisplayWeight(w.weightKg, units))}</td></tr>)}</tbody></table>}</div></details>
  </div>;
}
