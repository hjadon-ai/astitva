import { useEffect, useId, useState } from 'react';
import { Blocks, Database, Flame, GitBranch, Globe, Leaf, LockKeyhole, Server, ShieldCheck, Terminal } from 'lucide-react';
import { Button, LoadingState, StatusBanner } from './ui';
import './architecture.css';
const icons = { browser: Globe, firebase: Flame, render: Server, mongodb: Leaf, codex: Terminal, mcp: Blocks, github: GitBranch };
const flows = [['all', 'Full system'], ['app', 'Application'], ['chat', 'Chat'], ['mcp', 'Assistants'], ['deploy', 'Deployment']];
function Diagram({ data }) {
  const [flow, setFlow] = useState('all');
  const marker = useId().replace(/:/g, '');
  const edges = data.edges.filter(edge => flow === 'all' || edge.flow === flow);
  const active = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  return <section className="architecture-diagram" aria-label="Interactive system architecture">
    <div className="architecture-diagram-heading"><div><span className="architecture-eyebrow">THE SYSTEM AT A GLANCE</span><h3>Connected by explicit trust.</h3></div><ShieldCheck aria-hidden="true" /></div>
    <div className="architecture-flow-buttons" aria-label="Highlight an integration flow">{flows.map(([id, label]) => <Button key={id} variant="quiet" aria-pressed={flow === id} onClick={() => setFlow(id)}>{label}</Button>)}</div>
    <div className="architecture-map-scroll" tabIndex={0} aria-label="Architecture diagram; scroll horizontally on small screens">
      <svg viewBox="0 0 1010 685" role="img" aria-labelledby={`${marker}-title ${marker}-desc`}>
        <title id={`${marker}-title`}>Astitva {flows.find(([id]) => id === flow)[1]} architecture</title>
        <desc id={`${marker}-desc`}>Browser, Firebase Hosting, Render API, MongoDB Atlas, Firebase Chat, ChatGPT and Codex, MCP server and GitHub Actions. A complete text equivalent follows the diagram.</desc>
        <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="currentColor" /></marker></defs>
        <rect className="architecture-boundary" x="325" y="270" width="280" height="380" rx="26" />
        <text className="architecture-zone" x="343" y="291">RENDER · SERVER TRUST BOUNDARY</text>
        {edges.map((edge, index) => {
          const source = data.nodes.find(node => node.id === edge.source), target = data.nodes.find(node => node.id === edge.target);
          const vertical = source.x === target.x;
          const sx = source.x + 110, sy = source.y + 53, tx = target.x + 110, ty = target.y + 53;
          const direction = tx >= sx ? 1 : -1;
          const x1 = vertical ? sx : sx + direction * 110, x2 = vertical ? tx : tx - direction * 110;
          const y1 = vertical ? sy + (ty > sy ? 53 : -53) : sy, y2 = vertical ? ty + (ty > sy ? -53 : 53) : ty;
          return <g key={index} className={`architecture-edge architecture-edge-${edge.flow}`}><path d={`M${x1} ${y1} C${vertical ? x1 : (x1 + x2) / 2} ${vertical ? (y1 + y2) / 2 : y1}, ${vertical ? x2 : (x1 + x2) / 2} ${vertical ? (y1 + y2) / 2 : y2}, ${x2} ${y2}`} markerEnd={`url(#${marker})`} /><circle cx={(x1+x2)/2} cy={(y1+y2)/2} r="11" /><text x={(x1+x2)/2} y={(y1+y2)/2+4} textAnchor="middle">{data.edges.indexOf(edge)+1}</text></g>;
        })}
        {data.nodes.map(node => { const Icon = icons[node.icon] || Database; return <g key={node.id} className={`architecture-node architecture-brand-${node.icon}`} opacity={active.has(node.id) ? 1 : .3} transform={`translate(${node.x} ${node.y})`}>
          <rect width="220" height="106" rx="18" /><rect className="architecture-icon-bg" x="16" y="16" width="34" height="34" rx="10" /><Icon x="23" y="23" width="20" height="20" aria-hidden="true" /><text className="architecture-node-title" x="16" y="72">{node.title}</text><text className="architecture-node-subtitle" x="16" y="91">{node.subtitle}</text>
        </g>; })}
      </svg>
    </div>
    <ol className="architecture-connections">{edges.map(edge => <li key={`${edge.source}-${edge.target}`} value={data.edges.indexOf(edge)+1}><strong>{data.nodes.find(n => n.id === edge.source).title} → {data.nodes.find(n => n.id === edge.target).title}</strong><span>{edge.label}</span></li>)}</ol>
  </section>;
}
export default function Architecture({ apiRequest, onExpired }) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError(null);
    apiRequest('/api/admin/architecture').then(result => { if (active) setData(result); }).catch(err => {
      if (!active) return;
      if (err.status === 401) onExpired?.();
      setError({ status: err.status, message: err.status === 403 ? 'Admin access is required to view this reference.' : err.message });
    });
    return () => { active = false; };
  }, [apiRequest, onExpired, attempt]);
  if (error) return <StatusBanner tone="error" role="alert">{error.message}{![401,403].includes(error.status) && <Button onClick={() => setAttempt(attempt+1)}>Retry</Button>}</StatusBanner>;
  if (!data) return <LoadingState>Loading protected architecture reference…</LoadingState>;
  return <article className="architecture-page">
    <header className="architecture-hero"><span className="architecture-eyebrow"><LockKeyhole size={14} aria-hidden="true" /> ADMIN REFERENCE</span><h2>{data.title}</h2><p>{data.summary}</p><small>{data.basis}</small></header>
    <nav className="architecture-jump" aria-label="Architecture contents">{[['architecture-system','System map'],['architecture-security','Security boundaries'],['architecture-config','Configuration']].map(([id,label]) => <button type="button" key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'auto' })}>{label}</button>)}</nav>
    <div id="architecture-system"><Diagram data={data}/></div>
    <section className="architecture-walkthroughs" aria-label="Request walkthroughs">{data.walkthroughs.map(([title, text], index) => <div key={title}><span className="architecture-step">0{index+1}</span><h3>{title}</h3><p>{text}</p></div>)}</section>
    <section id="architecture-security"><div className="architecture-section-title"><ShieldCheck aria-hidden="true"/><div><h3>Security at every boundary</h3><p>Implemented controls, deployment checks and recommendations are labeled separately.</p></div></div>
      {data.sections.map(section => <details className="architecture-detail" key={section.id} open={section.id === 'apis'}><summary><span><strong>{section.title}</strong><small>{section.subtitle}</small></span><span className="architecture-detail-count">{section.points.length} controls</span></summary><div className="architecture-controls">{section.points.map(([status,title,text,evidence]) => <div key={title}><span className={`architecture-badge architecture-badge-${status.split(' ')[0].toLowerCase()}`}>{status}</span><h4>{title}</h4><p>{text}</p>{evidence && <small className="architecture-evidence">Repository evidence: {evidence}</small>}</div>)}</div></details>)}
    </section>
    <section id="architecture-config"><div className="architecture-section-title"><LockKeyhole aria-hidden="true"/><div><h3>Configuration & credentials</h3><p>Names and purposes only. Live environment values, tokens and private configuration are never returned by this page.</p></div></div><div className="architecture-table-scroll" tabIndex={0} aria-label="Security configuration table"><table><thead><tr><th>Where / classification</th><th>Configuration</th><th>Why it exists</th><th>What to verify or improve</th></tr></thead><tbody>{data.configuration.map(([where,name,why,next]) => <tr key={name}><td>{where}</td><th scope="row"><code>{name}</code></th><td>{why}</td><td>{next}</td></tr>)}</tbody></table></div></section>
    <footer className="architecture-footer"><strong>Keep this reference accurate</strong><p>Update it when routes, permissions or deployment topology change. Dashboard controls and released Firestore rules need independent verification. Admin access cannot prevent an authorized viewer from copying content.</p><div>{data.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div></footer>
  </article>;
}
