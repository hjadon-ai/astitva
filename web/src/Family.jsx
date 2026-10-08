import FamilySocial from './FamilySocial';
import FamilyUnits from './FamilyUnits';
import { useEffect, useState } from 'react';
import { familyAge } from './familyAge';
import { MailPlus, Plus, UsersRound } from 'lucide-react';
import { Badge, Button, EmptyState, FormField, LoadingState, PageHeader, SectionHeader, Surface } from './ui';

const relationshipOptions = [
  ['father', 'Father'], ['mother', 'Mother'], ['parent', 'Parent'],
  ['brother', 'Brother'], ['sister', 'Sister'], ['sibling', 'Sibling'],
  ['husband', 'Husband'], ['wife', 'Wife'], ['partner', 'Partner'],
  ['son', 'Son'], ['daughter', 'Daughter'], ['child', 'Child']
];
const initialPerson = { name: '', email: '', relationship: 'father' };

export default function Family({ apiRequest, features = { family: true } }) {
  const [families, setFamilies] = useState(null);
  const [normalizedUnits, setNormalizedUnits] = useState(null);
  const legacyFamilies = normalizedUnits === null ? [] : (families || []).filter(item => !normalizedUnits.some(unit => unit.id === item.id));
  const [invitations, setInvitations] = useState([]);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState(initialPerson);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(null);
  const [sharedDate, setSharedDate] = useState(new Date().toISOString().slice(0, 10));
  const [sharedMonth, setSharedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(null);
  const [sharingError, setSharingError] = useState('');
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityVersion, setActivityVersion] = useState(0);
  const family = legacyFamilies.find((item) => item.id === selected) || legacyFamilies[0];
  const [familyPage, setFamilyPage] = useState('members');
  const [details, setDetails] = useState(null);
  const canEdit = family && ['ADMIN', 'EDITOR'].includes(family.self.role);
  const canAdmin = family?.self.role === 'ADMIN';
  const isCreator = family?.self.userId === family?.creatorId;
  const enabledDataFeatures = ['diet', 'finance', 'family'].filter((feature) => features[feature]);
  const accessibleShares = family?.sharedWithMe.filter((share) => features[share.feature]) || [];

  useEffect(() => {
    Promise.all([apiRequest('/api/family'), apiRequest('/api/family/invitations')]).then(([result, pending]) => {
      setFamilies(result.families);
      setInvitations(pending.invitations);
      setSelected(result.families[0]?.id || '');
    }).catch((error) => setMessage(error.message));
  }, [apiRequest]);

  useEffect(() => {
    if (!families?.length) { setSharing(null); return; }
    let active = true;
    apiRequest('/api/family/sharing/summary').then((result) => {
      if (active) { setSharing(result.features); setSharingError(''); }
    }).catch((error) => { if (active) setSharingError(error.message); });
    return () => { active = false; };
  }, [apiRequest, families]);

  useEffect(() => {
    if (!family) { setActivity(null); return; }
    let active = true;
    setActivity(null);
    apiRequest(`/api/family/${family.id}/activity?limit=5`).then((result) => {
      if (active) { setActivity(result); setActivityError(''); }
    }).catch((error) => { if (active) setActivityError(error.message); });
    return () => { active = false; };
  }, [apiRequest, family?.id, activityVersion]);

  useEffect(() => { setDetails(null); }, [family?.id]);

  async function acceptInvitation(invitation) {
    setBusy(true);
    setMessage('');
    try {
      const accepted = await apiRequest(`/api/family/invitations/${invitation.id}/accept`, { method: 'POST' });
      const [result, pending] = await Promise.all([
        apiRequest('/api/family'), apiRequest('/api/family/invitations')
      ]);
      setFamilies(result.families);
      setInvitations(pending.invitations);
      setSelected(accepted.family.id);
      setMessage('Invitation accepted. Your shared family is shown below.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function run(action, success) {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (result?.family) {
        setFamilies((current) => [...(current || []).filter((item) => item.id !== result.family.id), result.family]);
        setSelected(result.family.id);
      }
      setActivityVersion((value) => value + 1);
      if (success) setMessage(success);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addPerson(event) {
    event.preventDefault();
    const ok = await run(() => apiRequest(`/api/family/${family.id}/people`, {
      method: 'POST', body: JSON.stringify(form)
    }), 'Family member added.');
    if (ok) setForm(initialPerson);
  }

  function editDetails(person) {
    setDetails({ id: person.id, name: person.name, preferredName: person.preferredName || '', birthDate: person.birthDate || '', note: person.note || '' });
  }
  async function saveDetails(event) {
    event.preventDefault();
    await run(async () => {
      const result = await apiRequest(`/api/family/${family.id}/people/${details.id}/details`, { method: 'PATCH', body: JSON.stringify({ preferredName: details.preferredName || null, birthDate: details.birthDate || null, note: details.note || null }) });
      setDetails(null);
      return result;
    }, 'Family details saved.');
  }
  function profileDetails(person) {
    const age = familyAge(person.birthDate);
    return <>{person.preferredName && <small>Preferred name: {person.preferredName}</small>}{person.birthDate && <small>Birth date: {person.birthDate}{age !== null ? ` · Age ${age}` : ''}</small>}{person.note && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{person.note}</p>}</>;
  }

  async function updatePerson(person) {
    const name = person.status === 'ACCEPTED' ? null : window.prompt('Name', person.name);
    if (name === null && person.status !== 'ACCEPTED') return;
    const email = person.status === 'ACCEPTED' ? null : window.prompt('Invitation email (optional)', person.email || '');
    if (email === null && person.status !== 'ACCEPTED') return;
    const gender = window.prompt('Relationship labels: male, female, or neutral', person.gender);
    if (gender === null) return;
    await run(() => apiRequest(`/api/family/${family.id}/people/${person.id}`, {
      method: 'PATCH', body: JSON.stringify({ ...(person.status === 'ACCEPTED' ? {} : { name, email }), gender })
    }), 'Family member updated.');
  }

  async function removeRelation(connection) {
    if (!window.confirm(`Remove your ${connection.label.toLowerCase()} relationship with ${connection.person.name}?`)) return;
    await run(() => apiRequest(`/api/family/${family.id}/relations/${connection.relationId}`, {
      method: 'DELETE'
    }), 'Relationship removed.');
  }

  async function showShared(familyId, ownerId, feature) {
    const query = feature === 'diet' ? `date=${sharedDate}` : `month=${sharedMonth}`;
    setBusy(true);
    setMessage('');
    try {
      setShared(await apiRequest(`/api/family/${familyId}/shared/${ownerId}/${feature}?${query}`));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const groups = [
    { id: 'bornIn', title: 'Family Roots', description: 'Parents and siblings' },
    { id: 'spouse', title: 'Family Blossoms', description: 'Partner and children' }
  ];
  const searchTerm = search.trim().toLocaleLowerCase();
  const connections = family?.connections.filter((connection) =>
    !searchTerm || connection.person.name.toLocaleLowerCase().includes(searchTerm) ||
    connection.label.toLocaleLowerCase().includes(searchTerm)) || [];

  async function moreActivity() {
    if (!family || !activity?.nextCursor || activityLoading) return;
    setActivityLoading(true); setActivityError('');
    try {
      const result = await apiRequest(`/api/family/${family.id}/activity?limit=20&before=${encodeURIComponent(activity.nextCursor)}`);
      setActivity((current) => ({ events: [...current.events, ...result.events], nextCursor: result.nextCursor }));
    } catch (error) { setActivityError(error.message); }
    finally { setActivityLoading(false); }
  }

  async function stopSharing(entry, feature) {
    setBusy(true); setMessage('');
    try {
      const result = await apiRequest(`/api/family/${entry.familyId}/shares/${feature}/${entry.person.userId}`, { method: 'DELETE' });
      setFamilies((current) => current.map((item) => item.id === result.family.id ? result.family : item));
      setActivityVersion((value) => value + 1);
      setShared(null);
      setMessage(`${feature === 'diet' ? 'Diet' : feature === 'family' ? 'Family' : 'Finance'} sharing stopped.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <section className="family-page">
    <PageHeader eyebrow="Workspace / Family" title="Family" description="Your people, shared moments and permissions — all in one place." />
    <FamilyUnits apiRequest={apiRequest} features={features} existingFamilies={families || []} onUnitsLoaded={setNormalizedUnits} />
    {(legacyFamilies.length > 0 || invitations.length > 0) && <details className="family-existing"><summary>Existing family records & invitations{invitations.length ? ` (${invitations.length} invitations)` : ''}</summary>
    {message && <p className="form-message" role="status">{message}</p>}
    {families === null && !message && <LoadingState>Loading family…</LoadingState>}
    {invitations.length > 0 && <Surface className="family-invitations">
      <SectionHeader title="Invitations for you" description="Accept to connect your verified account to the existing family. Your Diet and Finance information stays private." />
      {invitations.map((invitation) => <div className="family-member" key={invitation.id}>
        <div><strong>{invitation.from}'s family</strong><span>You were invited as {invitation.personName}.</span></div>
        <Button variant="primary" type="button" disabled={busy} onClick={() => acceptInvitation(invitation)}>{busy ? 'Accepting…' : 'Accept invitation'}</Button>
      </div>)}
    </Surface>}
    {family && <>
      {legacyFamilies.length > 1 && <FormField label="Family view"><select value={family.id} onChange={(event) => { setSelected(event.target.value); setShared(null); }}>
        {legacyFamilies.map((item) => <option key={item.id} value={item.id}>{item.self.userId === item.creatorId ? 'My family' : `${item.creatorName}'s family`} · {item.acceptedMembers.length} accepted members</option>)}
      </select></FormField>}
      <div className="family-actions" aria-label="Family views"><Button type="button" aria-pressed={familyPage==='members'} onClick={()=>setFamilyPage('members')}>Members</Button><Button type="button" aria-pressed={familyPage==='social'} onClick={()=>setFamilyPage('social')}>Social</Button></div>
      {familyPage==='social' ? <FamilySocial key={family.id} family={family} apiRequest={apiRequest}/> : <>
      <Surface className="family-self">
        <div><p className="eyebrow">Self</p><h2>{family.self.name}</h2><p>{family.self.email}</p></div>
        <div><Badge tone="success">{family.self.role}</Badge>
          <FormField label="Your relationship labels"><select value={family.self.gender} disabled={busy} onChange={(event) => run(() => apiRequest(`/api/family/${family.id}/self`, { method: 'PATCH', body: JSON.stringify({ gender: event.target.value }) }), 'Labels updated.')}>
            <option value="neutral">Neutral</option><option value="male">Male</option><option value="female">Female</option>
          </select></FormField>
        </div>
      </Surface>
      <Surface className="family-search">
        <FormField label="Find family member"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or relationship" /></FormField>
        {searchTerm && <p role="status">{connections.length} matching family member{connections.length === 1 ? '' : 's'}.</p>}
        {searchTerm && connections.length === 0 && <p>No matching family members.</p>}
      </Surface>
      {groups.map((group) => <Surface key={group.id} className={`family-group family-tone-${group.id==='bornIn'?'bornIn':'formed'}`}>
        <SectionHeader title={group.title} description={group.description} />
        {connections.filter((connection) => connection.group === group.id).length === 0 ? <p>{searchTerm ? 'No matches in this group.' : 'No members added yet.'}</p> :
          <div className="family-list">{connections.filter((connection) => connection.group === group.id).map((connection) => <article key={connection.relationId} className="family-member">
            <div><strong>{connection.person.name}</strong><span>{connection.label} · {connection.person.status === 'ACCEPTED' ? connection.person.role : connection.person.status === 'PENDING' ? 'Invitation pending' : 'No account linked'}</span>
              {profileDetails(connection.person)}
              {connection.person.email && <small>{connection.person.email}</small>}</div>
            <div className="family-actions">
              {canEdit && <Button type="button" disabled={busy} onClick={() => editDetails(connection.person)}>Edit details</Button>}
              {canEdit && <Button type="button" disabled={busy} onClick={() => updatePerson(connection.person)}>Edit</Button>}
              {canAdmin && connection.person.status !== 'ACCEPTED' && connection.person.email && <Button icon={MailPlus} type="button" disabled={busy} onClick={() => run(() => apiRequest(`/api/family/${family.id}/people/${connection.person.id}/invite`, { method: 'POST' }), 'Invitation sent.')}>Invite</Button>}
              {isCreator && <select aria-label={`Role for ${connection.person.name}`} value={connection.person.role} disabled={busy} onChange={(event) => run(() => apiRequest(`/api/family/${family.id}/people/${connection.person.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }), 'Role updated.')}>
                <option value="READONLY">READONLY</option><option value="EDITOR">EDITOR</option><option value="ADMIN">ADMIN</option>
              </select>}
              {canAdmin && <Button variant="danger" type="button" disabled={busy} onClick={() => removeRelation(connection)}>Remove</Button>}
            </div>
          </article>)}</div>}
      </Surface>)}
      <Surface><SectionHeader title="My family details" description="Shared family information is separate from your account profile." />
        {profileDetails(family.self)}
        {canEdit && <Button type="button" disabled={busy} onClick={() => editDetails(family.self)}>Edit my family details</Button>}
      </Surface>
      {details && <Surface><SectionHeader title={`Family details for ${details.name}`} description="Visible in family views to accepted members. This does not change account details or sharing permissions." />
        <form className="family-form" onSubmit={saveDetails}>
          <FormField label="Preferred name"><input maxLength={80} value={details.preferredName} onChange={e => setDetails({ ...details, preferredName: e.target.value })} /></FormField>
          <FormField label="Birth date"><input type="date" value={details.birthDate} onChange={e => setDetails({ ...details, birthDate: e.target.value })} /></FormField>
          <FormField label="Family note"><textarea maxLength={1000} value={details.note} onChange={e => setDetails({ ...details, note: e.target.value })} /></FormField>
          <Button type="submit" disabled={busy}>Save details</Button><Button type="button" disabled={busy} onClick={() => setDetails(null)}>Cancel</Button>
        </form>
      </Surface>}
      {canEdit && <Surface className="family-add"><SectionHeader title="Add a family member" description="People without an account can be invited later." />
        <form onSubmit={addPerson} className="family-form">
          <FormField label="Name"><input required maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="Relationship"><select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })}>{relationshipOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Email (optional)"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField>
          <Button variant="primary" icon={Plus} type="submit" disabled={busy}>Add member</Button>
        </form>
      </Surface>}
      {enabledDataFeatures.length > 0 && <><Surface className="family-sharing-overview">
        <SectionHeader title="Sharing" description="Your feature permissions, separate from family roles." />
        {sharingError && <p role="alert">{sharingError}</p>}
        {!sharing && !sharingError && <LoadingState>Loading sharing…</LoadingState>}
        {sharing && <div className="family-overview-grid">{enabledDataFeatures.map((feature) => <section key={feature}>
          <h3>{feature === 'diet' ? 'Diet' : feature === 'family' ? 'Family' : 'Finance'}</h3>
          <h4>Shared with</h4>
          {sharing[feature].sharedWith.length ? sharing[feature].sharedWith.map((entry) => <div className="family-overview-row" key={`${entry.familyId}-${entry.person.id}`}>
            <span>{entry.person.name}</span><Button type="button" disabled={busy} onClick={() => stopSharing(entry, feature)}>Stop sharing</Button>
          </div>) : <p>Not shared.</p>}
          <h4>Shared by</h4>
          {sharing[feature].sharedBy.length ? sharing[feature].sharedBy.map((entry) => <div className="family-overview-row" key={`${entry.familyId}-${entry.person.id}`}>
            <span>{entry.person.name}</span><Button type="button" disabled={busy} onClick={() => feature==='family' ? setMessage('Select this member from the member dropdown at the top right of Family to view shared Family information.') : showShared(entry.familyId, entry.person.userId, feature)}>View read only</Button>
          </div>) : <p>Not shared with you.</p>}
        </section>)}</div>}
        {family.connections.some((connection) => connection.person.status !== 'ACCEPTED') && <p className="family-share-ineligible">Not eligible for sharing yet: {family.connections.filter((connection) => connection.person.status !== 'ACCEPTED').map((connection) => `${connection.person.name} (${connection.person.status === 'PENDING' ? 'invitation pending' : 'no account linked'})`).join(', ')}.</p>}
      </Surface>
      <Surface className="family-sharing"><SectionHeader title="Share your information" description="Choose accepted members separately for each feature. They can only view what you share." />
        {family.acceptedMembers.filter((member) => member.id !== family.self.id).length === 0 ? <p>Accepted family members will appear here.</p> :
          <div className="family-list">{family.acceptedMembers.filter((member) => member.id !== family.self.id).map((member) => <div key={member.id} className="family-share-row"><strong>{member.name}</strong>
            {enabledDataFeatures.map((feature) => {
              const enabled = family.myShares.some((share) => share.feature === feature && share.recipientId === member.userId);
              return <label key={feature}><input type="checkbox" checked={enabled} disabled={busy} onChange={() => run(() => apiRequest(`/api/family/${family.id}/shares/${feature}/${member.userId}`, { method: enabled ? 'DELETE' : 'PUT' }), `${feature === 'diet' ? 'Diet' : feature === 'family' ? 'Family' : 'Finance'} sharing ${enabled ? 'stopped' : 'enabled'}.`)} /> {feature === 'diet' ? 'Diet' : feature === 'family' ? 'Family' : 'Finance'}</label>;
            })}</div>)}</div>}
      </Surface>
      <Surface className="family-shared"><SectionHeader title="Shared with you" description="Read only access to information each member chose to share." />
        {accessibleShares.length === 0 ? <p>No available information has been shared with you.</p> : <>
          <p>Select a member from the member dropdown at the top right of Family to open their shared modules.</p>
          <div className="family-filters">{features.diet && <FormField label="Diet date"><input type="date" value={sharedDate} onChange={(event) => setSharedDate(event.target.value)} /></FormField>}
            {features.finance && <FormField label="Finance month"><input type="month" value={sharedMonth} onChange={(event) => setSharedMonth(event.target.value)} /></FormField>}</div>
          <div className="family-actions">{accessibleShares.filter(s=>s.feature!=='family').map((share) => <Button key={`${share.ownerId}-${share.feature}`} disabled={busy} onClick={() => showShared(family.id, share.ownerId, share.feature)}>{family.acceptedMembers.find((person) => person.userId === share.ownerId)?.name || 'Member'} · {share.feature}</Button>)}</div>
        </>}
        {shared && <div className="family-shared-data"><h3>{shared.owner.name}'s {shared.feature}</h3>
          {shared.feature === 'diet' ? <><p>{shared.date} · Targets: {shared.targets ? `${shared.targets.calories} calories` : 'not set'}</p>
            {shared.meals.length ? <ul>{shared.meals.map((meal, index) => <li key={index}>{meal.name} · {meal.mealType} · {meal.nutrition.calories} calories</li>)}</ul> : <p>No meals on this day.</p>}</> : <>
            <p>{shared.month}</p><h4>Accounts</h4>{shared.accounts.length ? <ul>{shared.accounts.map((account) => <li key={account._id}>{account.name} · {account.currentBalance ?? '—'} {account.currency}</li>)}</ul> : <p>No accounts.</p>}
            <h4>Transactions</h4>{shared.transactions.length ? <ul>{shared.transactions.map((transaction) => <li key={transaction._id}>{transaction.date} · {transaction.name} · {transaction.amount} {transaction.currency}</li>)}</ul> : <p>No transactions this month.</p>}
            <h4>Holdings</h4>{shared.holdings.length ? <ul>{shared.holdings.map((holding) => <li key={holding._id}>{holding.name} · {holding.marketValue} {holding.currency}</li>)}</ul> : <p>No holdings.</p>}
          </>}
        </div>}
      </Surface>
      </>}
      <Surface className="family-activity">
        <SectionHeader title="Family activity" description="Changes from the past week, newest first." />
        {activityError && <p role="alert">{activityError}</p>}
        {!activity && !activityError && <LoadingState>Loading family activity…</LoadingState>}
        {activity && (activity.events.length ? <ol className="family-activity-list">{activity.events.map((event) => <li key={event.id}>
          <div><strong>{event.actorName}</strong><span>{event.summary}</span></div>
          <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
        </li>)}</ol> : <p>No family changes yet.</p>)}
        {activity?.nextCursor && <Button type="button" disabled={activityLoading} onClick={moreActivity}>{activityLoading ? 'Loading…' : 'View more'}</Button>}
      </Surface>
      </>}
    </>}
    </details>}
    {message && !legacyFamilies.length && !invitations.length && <p role="alert">{message}</p>}
  </section>;
}
