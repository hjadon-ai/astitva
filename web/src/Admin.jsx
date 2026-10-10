import {AdminMealLibraries} from './NamedMealLibraries';
import { useRef, useState } from 'react';
import { AppShell, Button, ConfirmDialog, FormField, LoadingState, PageHeader, StatusBanner, Surface } from './ui';

const defaults = { priorities: false, diet: false, finance: false, family: true, chat: false, mcp: false };
const labels = { priorities: 'Daily Priorities', diet: 'Diet', finance: 'Finance', family: 'Family', chat: 'Anonymous Chat', mcp: 'MCP access (requires Diet)' };

function FeatureFields({ value, onChange, disabled }) {
  return <fieldset className="admin-features" disabled={disabled}><legend>Feature access</legend>
    {Object.keys(defaults).map((key) => <label key={key}><input type="checkbox" checked={Boolean(value[key])}
      onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />{labels[key]}</label>)}
  </fieldset>;
}

function FeatureEditor({ record, run, onSaved, user = false }) {
  const [draft, setDraft] = useState(record.features);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const changed = Object.keys(defaults).filter((key) => draft[key] !== record.features[key]);
  async function save() {
    setBusy(true);
    const result = await run(`/api/admin/${user ? 'users' : 'invitees'}/${record.id}`, {
      method: 'PATCH', body: JSON.stringify({ features: draft, expectedVersion: record.expectedVersion })
    }, 'Feature access saved.');
    if (result) onSaved(result[user ? 'user' : 'invitee']);
    setConfirm(false);
    setBusy(false);
  }
  return <form onSubmit={(event) => { event.preventDefault(); setConfirm(true); }}>
    <FeatureFields value={draft} onChange={setDraft} disabled={busy} />
    <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Review feature access'}</Button>
    <ConfirmDialog open={confirm} title="Save feature access?" busy={busy} confirmLabel="Save access"
      description={changed.length ? changed.map((key) => `${labels[key]}: ${record.features[key] ? 'enabled' : 'disabled'} → ${draft[key] ? 'enabled' : 'disabled'}`).join('; ') : 'No flags changed. Saving will also retry cleanup of disabled Chat sessions.'}
      onCancel={() => setConfirm(false)} onConfirm={save} />
  </form>;
}

function UserEditor({ record, run, onSaved, reload }) {
  return <Surface className="admin-editor">
    <h2>Edit {record.name}</h2><p>{record.email}</p>
    <p>{record.emailVerified ? 'Email verified' : 'Email not verified'} · Created {new Date(record.createdAt).toLocaleDateString()}</p>
    <FeatureEditor key={record.expectedVersion.invitee || 'new'} record={record} user run={run} onSaved={onSaved} />
    <p className="admin-help">Name, email and verification state are read-only.</p>
    <Button type="button" variant="quiet" onClick={reload}>Reload record (discard drafts)</Button>
  </Surface>;
}

function NotificationSettings({ settings, run, onSaved, reload }) {
  const [enabled, setEnabled] = useState(settings.webEnabled);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await run('/api/admin/notifications', { method: 'PATCH', body: JSON.stringify({
      webEnabled: enabled, expectedVersion: settings.expectedVersion
    }) }, 'Web notification configuration saved.');
    if (result) onSaved(result.settings);
    setBusy(false); setConfirm(false);
  }
  return <Surface><h2>Notification configuration</h2>
    <label><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} /> Enable web notifications globally</label>
    <p>When off, the server stops submitting browser pushes. Each browser also needs the person’s permission. iOS notifications are unaffected.</p>
    <Button disabled={busy || enabled === settings.webEnabled} onClick={() => setConfirm(true)}>Review change</Button>
    <Button variant="quiet" disabled={busy} onClick={reload}>Reload configuration</Button>
    <ConfirmDialog open={confirm} title="Change web notifications?" description={`${settings.webEnabled ? 'Enabled' : 'Disabled'} → ${enabled ? 'Enabled' : 'Disabled'}`}
      busy={busy} confirmLabel="Save configuration" onConfirm={save} onCancel={() => setConfirm(false)} />
  </Surface>;
}

export default function Admin({ user, runtime, onLogout, apiRequest, onExpired, onUserRefresh }) {
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [denied, setDenied] = useState(!user.isAdmin);
  const [tab, setTab] = useState('users');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(null);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [email, setEmail] = useState('');
  const [invitee, setInvitee] = useState(null);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [draft, setDraft] = useState(defaults);
  const [creating, setCreating] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const sequence = useRef(0);

  async function run(path, options, success) {
    setMessage(null);
    try {
      const result = await apiRequest(path, options);
      if (success) {
        setMessage({ tone: result.invitationSent === false ? 'error' : 'success', text: result.warning || (result.invitationSent && success === 'Invitee access saved.' ? `${success} Invitation email sent.` : success) });
        onUserRefresh();
      }
      return result;
    } catch (error) {
      if (error.status === 401) onExpired();
      else if (error.status === 403) setDenied(true);
      setMessage({ tone: 'error', text: error.message });
      return null;
    }
  }

  async function findUsers(event, page = 1) {
    event?.preventDefault();
    const q = event ? query.trim() : search;
    const id = ++sequence.current;
    setBusy(true);
    setResults(null);
    const result = await run(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`);
    if (id === sequence.current) { setResults(result); setSearch(q); setBusy(false); }
  }
  async function loadUser(id) {
    const result = await run(`/api/admin/users/${id}`);
    if (result) setSelected(result.user);
  }
  async function findInvitee(event) {
    event.preventDefault();
    setBusy(true); setInvitee(null); setInviteStatus(null); setCreating(false);
    try {
      const result = await apiRequest(`/api/admin/invitees?email=${encodeURIComponent(email.trim())}`);
      setInvitee(result.invitee);
    } catch (error) {
      if (error.status === 404) {
        setInviteStatus(error.details?.registered ? 'This email has a registered account but no invitee access record.' : 'This email has no registered account or invitee access record.');
        setDraft(defaults); setCreating(true); setMessage(null);
      } else {
        if (error.status === 401) onExpired();
        if (error.status === 403) setDenied(true);
        setMessage({ tone: 'error', text: error.message });
      }
    } finally { setBusy(false); }
  }
  async function createInvitee() {
    setBusy(true);
    const result = await run('/api/admin/invitees', { method: 'POST',
      body: JSON.stringify({ email: email.trim(), features: draft }) }, 'Invitee access saved.');
    if (result) { setInvitee(result.invitee); setCreating(false); setConfirmCreate(false); }
    setBusy(false);
  }
  if (denied || !user.isAdmin) return <main className="verification-shell"><section className="verification-card">
    <h1>Admin Panel</h1><p>You do not have permission to access the Admin Panel.</p>
    <div className="verification-actions"><a className="button button-primary" href="/">Return to Home</a>
      <Button onClick={onLogout}>Sign out</Button></div>
  </section></main>;

  return <AppShell page="admin" user={user} runtime={runtime} onLogout={onLogout}>
    <section className="admin-page">
      <PageHeader title="Admin Panel" description={`Signed in as ${user.email}`} actions={<a className="button button-secondary" href="/">Return to Home</a>} />
      <div className="admin-tabs" aria-label="Admin sections"><Button aria-pressed={tab === 'meal-libraries'} onClick={()=>setTab('meal-libraries')}>Meal libraries</Button>
        <Button aria-pressed={tab === 'users'} onClick={() => { setTab('users'); setMessage(null); }}>Users</Button>
        <Button aria-pressed={tab === 'invitees'} onClick={() => { setTab('invitees'); setMessage(null); }}>Invitees</Button>
        <Button aria-pressed={tab === 'notifications'} onClick={async () => {
          setTab('notifications');
          const result = await run('/api/admin/notifications');
          if (result) setNotificationSettings(result.settings);
        }}>Notifications</Button>
      </div>
      {message && <StatusBanner tone={message.tone} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</StatusBanner>}
      {tab === 'meal-libraries' ? <AdminMealLibraries apiRequest={apiRequest}/> : tab === 'notifications' ? notificationSettings && <NotificationSettings key={notificationSettings.expectedVersion || 'new'}
        settings={notificationSettings} run={run} onSaved={setNotificationSettings} reload={async () => {
          const result = await run('/api/admin/notifications'); if (result) setNotificationSettings(result.settings);
        }} /> : tab === 'users' ? <>
        <Surface className="admin-search"><form onSubmit={findUsers}>
          <FormField label="Email or name"><input required maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></FormField>
          <Button type="submit" disabled={busy}>Find users</Button>
        </form></Surface>
        {busy && <LoadingState>Finding users…</LoadingState>}
        {results && <Surface className="admin-results"><h2>Search results</h2>
          {!results.users.length && <p>No users found.</p>}
          <ul>{results.users.map((entry) => <li key={entry.id}><div><strong>{entry.name}</strong><span>{entry.email}</span>
            <small>{entry.emailVerified ? 'Verified' : 'Unverified'} · {new Date(entry.createdAt).toLocaleDateString()}</small>
            <small>Features: {Object.keys(defaults).filter((key) => entry.features[key]).map((key) => labels[key]).join(', ') || 'None'}</small></div>
            <Button onClick={() => loadUser(entry.id)}>Edit user</Button></li>)}</ul>
          <div className="admin-actions"><Button disabled={results.page <= 1 || busy} onClick={() => findUsers(null, results.page - 1)}>Previous</Button>
            <span>Page {results.page}</span><Button disabled={!results.hasMore || busy} onClick={() => findUsers(null, results.page + 1)}>Next</Button></div>
        </Surface>}
        {selected && <UserEditor key={`${selected.id}:${selected.expectedVersion.user}`} record={selected} run={run} onSaved={setSelected}
          reload={() => loadUser(selected.id)} />}
      </> : <>
        <Surface className="admin-search"><h2>Find or add an invitee</h2><form onSubmit={findInvitee}>
          <FormField label="Invitee email"><input type="email" required maxLength={254} value={email} disabled={busy}
            onChange={(event) => { setEmail(event.target.value); setInvitee(null); setCreating(false); setInviteStatus(null); }} /></FormField>
          <Button type="submit" disabled={busy}>Find email</Button>
        </form></Surface>
        {busy && <LoadingState>Working…</LoadingState>}
        {inviteStatus && <StatusBanner>{inviteStatus}</StatusBanner>}
        {creating && <Surface className="admin-editor"><h2>Add invitee access</h2><p>{email.trim().toLowerCase()}</p>
          <form onSubmit={(event) => { event.preventDefault(); setConfirmCreate(true); }}>
            <FeatureFields value={draft} onChange={setDraft} disabled={busy} /><Button type="submit" disabled={busy}>Review invitee</Button>
          </form><p className="admin-help">This grants signup eligibility and feature access. It sends an invitation email without creating an account.</p>
          <ConfirmDialog open={confirmCreate} title="Add invitee?" description={`${email.trim().toLowerCase()} · Enabled: ${Object.keys(defaults).filter((key) => draft[key]).map((key) => labels[key]).join(', ') || 'None'}`}
            confirmLabel="Save and send invitation" busy={busy} onCancel={() => setConfirmCreate(false)} onConfirm={createInvitee} />
        </Surface>}
        {invitee && <Surface className="admin-editor"><h2>{invitee.email}</h2><p>{invitee.registered ? 'Registered user' : 'Not registered yet'}</p>
          <FeatureEditor key={`${invitee.id}:${invitee.expectedVersion}`} record={invitee} run={run} onSaved={setInvitee} />
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            await run(`/api/admin/invitees/${invitee.id}/send-invitation`, { method: 'POST' }, 'Invitation email sent.');
            setBusy(false);
          }}>Send invitation email</Button>
          <Button variant="quiet" onClick={findInvitee}>Reload record (discard drafts)</Button>
        </Surface>}
      </>}
    </section>
  </AppShell>;
}
