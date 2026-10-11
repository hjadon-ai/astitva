import {useEffect,useState} from 'react';
import {Button,StatusBanner,PageHeader,Surface} from './ui';
import './connectedAssistants.css';
export default function ConnectedAssistants({apiRequest,embedded=false}) {
 const [data,setData]=useState(null),[consent,setConsent]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const readTicket=()=>new URLSearchParams(window.location.hash.split('?')[1]||'').get('mcp_request');
 const [ticket,setTicket]=useState(readTicket);
 useEffect(()=>{const changed=()=>setTicket(readTicket());window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed)},[]);
 useEffect(()=>{let active=true;setData(null);setConsent(null);setError('');
  Promise.all([apiRequest('/api/mcp/connections'),ticket?apiRequest('/api/mcp/consent/'+encodeURIComponent(ticket)):Promise.resolve(null)])
   .then(([connections,request])=>{if(active){setData(connections);setConsent(request)}}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[apiRequest,ticket]);
 async function decide(allow){setBusy(true);setError('');try{const result=await apiRequest('/api/mcp/consent/'+encodeURIComponent(ticket),{method:'POST',body:JSON.stringify({allow})});window.location.assign(result.redirectUrl)}catch(e){setError(e.message);setBusy(false)}}
 async function disconnect(id){setBusy(true);setError('');try{await apiRequest('/api/mcp/connections/'+id,{method:'DELETE'});setData(await apiRequest('/api/mcp/connections'))}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="profile-content connected-assistants">{!embedded&&<PageHeader eyebrow="Settings" title="Connected assistants" description="Give an assistant read-only access to your personal Diet records. Disconnecting removes its access and keeps your records."/>}
  {error&&<StatusBanner tone="error" role="alert">{error}</StatusBanner>}
  {!data&&!error&&<p role="status">Loading connections…</p>}
  {consent&&<Surface aria-label="Authorize assistant"><h3>Connect {consent.clientName}?</h3><p>Client name is supplied by the assistant and is not verified.</p><p>Account: <strong>{consent.account}</strong></p><p>Access: Diet read-only — meals, nutrition totals, targets, water, history, recent meals, and your own libraries.</p><p>Callback: <code style={{overflowWrap:'anywhere'}}>{consent.redirectUri}</code></p><p>Shared and managed workspaces are excluded. This connection cannot change your records.</p><div className="connected-assistant-actions"><Button variant="primary" disabled={busy} onClick={()=>decide(true)}>Allow read-only access</Button> <Button disabled={busy} onClick={()=>decide(false)}>Deny</Button></div></Surface>}
  {data&&!data.enabled&&<p>MCP connections are not enabled on this server.</p>}
  {data?.enabled&&<p>Server endpoint: <code style={{overflowWrap:'anywhere'}}>{data.endpoint}</code></p>}
  {data&&data.connections.length===0&&<p>No connected assistants.</p>}
  {data?.hasMore&&<p>Showing the newest 100 connections. Disconnect entries and reload to see older connections.</p>}
  {data?.connections.map(connection=><Surface key={connection.id}><h3>{connection.clientName}</h3><p>Access: {connection.scope}</p><p>Connected {new Date(connection.createdAt).toLocaleString()} · Expires {new Date(connection.expiresAt).toLocaleString()}</p><Button disabled={busy} onClick={()=>disconnect(connection.id)}>Disconnect</Button></Surface>)}
 </section>;
}
