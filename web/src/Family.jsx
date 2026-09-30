import { useEffect, useState } from 'react';
import { MailPlus, Plus, UsersRound } from 'lucide-react';
import { Badge, Button, EmptyState, FormField, LoadingState, PageHeader, SectionHeader, Surface } from './ui';

const relationshipOptions = [
  ['father', 'Father'], ['mother', 'Mother'], ['parent', 'Parent'],
  ['brother', 'Brother'], ['sister', 'Sister'], ['sibling', 'Sibling'],
  ['husband', 'Husband'], ['wife', 'Wife'], ['partner', 'Partner'],
  ['son', 'Son'], ['daughter', 'Daughter'], ['child', 'Child']
];
const initialPerson = { name: '', email: '', relationship: 'father' };

export default function Family({ apiRequest }) {
  const [families, setFamilies] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState(initialPerson);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(null);
  const [sharedDate, setSharedDate] = useState(new Date().toISOString().slice(0, 10));
  const [sharedMonth, setSharedMonth] = useState(new Date().toISOString().slice(0, 7));
  const family = families?.find((item) => item.id === selected) || families?.[0];
  const canEdit = family && ['ADMIN', 'EDITOR'].includes(family.self.role);
  const canAdmin = family?.self.role === 'ADMIN';
  const isCreator = family?.self.userId === family?.creatorId;

  useEffect(() => {
    Promise.all([apiRequest('/api/family'), apiRequest('/api/family/invitations')]).then(([result, pending]) => {
      setFamilies(result.families);
      setInvitations(pending.invitations);
      setSelected(result.families[0]?.id || '');
    }).catch((error) => setMessage(error.message));
  }, [apiRequest]);

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

  async function showShared(ownerId, feature) {
    const query = feature === 'diet' ? `date=${sharedDate}` : `month=${sharedMonth}`;
    setBusy(true);
    setMessage('');
    try {
      setShared(await apiRequest(`/api/family/${family.id}/shared/${ownerId}/${feature}?${query}`));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const groups = [
    { id: 'bornIn', title: 'Born in family', description: 'Parents and siblings' },
    { id: 'spouse', title: 'Spouse family', description: 'Partner and children' }
  ];

  return <section className="family-page">
    <PageHeader eyebrow="Workspace / Family" title="Family" description="Keep one family view that follows each accepted member's perspective." />
    {message && <p className="form-message" role="status">{message}</p>}
    {families === null && !message && <LoadingState>Loading family…</LoadingState>}
    {invitations.length > 0 && <Surface className="family-invitations">
      <SectionHeader title="Invitations for you" description="Accept to connect your verified account to the existing family. Your Diet and Finance information stays private." />
      {invitations.map((invitation) => <div className="family-member" key={invitation.id}>
        <div><strong>{invitation.from}'s family</strong><span>You were invited as {invitation.personName}.</span></div>
        <Button variant="primary" type="button" disabled={busy} onClick={() => acceptInvitation(invitation)}>{busy ? 'Accepting…' : 'Accept invitation'}</Button>
      </div>)}
    </Surface>}
    {families?.length === 0 && invitations.length === 0 && <Surface>
      <EmptyState icon={UsersRound} title="Start your family" description="Add yourself first, then add parents, siblings, a partner, or children. Sharing stays off until you choose recipients." />
      <Button variant="primary" icon={Plus} disabled={busy} onClick={() => run(() => apiRequest('/api/family', { method: 'POST', body: JSON.stringify({}) }), 'Family created.')}>Create family</Button>
    </Surface>}
    {family && <>
      {families.length > 1 && <FormField label="Family view"><select value={family.id} onChange={(event) => { setSelected(event.target.value); setShared(null); }}>
        {families.map((item) => <option key={item.id} value={item.id}>{item.self.userId === item.creatorId ? 'My family' : `${item.creatorName}'s family`} · {item.acceptedMembers.length} accepted members</option>)}
      </select></FormField>}
      <Surface className="family-self">
        <div><p className="eyebrow">Self</p><h2>{family.self.name}</h2><p>{family.self.email}</p></div>
        <div><Badge tone="success">{family.self.role}</Badge>
          <FormField label="Your relationship labels"><select value={family.self.gender} disabled={busy} onChange={(event) => run(() => apiRequest(`/api/family/${family.id}/self`, { method: 'PATCH', body: JSON.stringify({ gender: event.target.value }) }), 'Labels updated.')}>
            <option value="neutral">Neutral</option><option value="male">Male</option><option value="female">Female</option>
          </select></FormField>
        </div>
      </Surface>
      {groups.map((group) => <Surface key={group.id} className="family-group">
        <SectionHeader title={group.title} description={group.description} />
        {family.connections.filter((connection) => connection.group === group.id).length === 0 ? <p>No members added yet.</p> :
          <div className="family-list">{family.connections.filter((connection) => connection.group === group.id).map((connection) => <article key={connection.relationId} className="family-member">
            <div><strong>{connection.person.name}</strong><span>{connection.label} · {connection.person.status === 'ACCEPTED' ? connection.person.role : connection.person.status === 'PENDING' ? 'Invitation pending' : 'No account linked'}</span>
              {connection.person.email && <small>{connection.person.email}</small>}</div>
            <div className="family-actions">
              {canEdit && <Button type="button" disabled={busy} onClick={() => updatePerson(connection.person)}>Edit</Button>}
              {canAdmin && connection.person.status !== 'ACCEPTED' && connection.person.email && <Button icon={MailPlus} type="button" disabled={busy} onClick={() => run(() => apiRequest(`/api/family/${family.id}/people/${connection.person.id}/invite`, { method: 'POST' }), 'Invitation sent.')}>Invite</Button>}
              {isCreator && <select aria-label={`Role for ${connection.person.name}`} value={connection.person.role} disabled={busy} onChange={(event) => run(() => apiRequest(`/api/family/${family.id}/people/${connection.person.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }), 'Role updated.')}>
                <option value="READONLY">READONLY</option><option value="EDITOR">EDITOR</option><option value="ADMIN">ADMIN</option>
              </select>}
              {canAdmin && <Button variant="danger" type="button" disabled={busy} onClick={() => removeRelation(connection)}>Remove</Button>}
            </div>
          </article>)}</div>}
      </Surface>)}
      {canEdit && <Surface className="family-add"><SectionHeader title="Add a family member" description="People without an account can be invited later." />
        <form onSubmit={addPerson} className="family-form">
          <FormField label="Name"><input required maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="Relationship"><select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })}>{relationshipOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Email (optional)"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField>
          <Button variant="primary" icon={Plus} type="submit" disabled={busy}>Add member</Button>
        </form>
      </Surface>}
      <Surface className="family-sharing"><SectionHeader title="Share your information" description="Choose accepted members separately for Diet and Finance. They can only view what you share." />
        {family.acceptedMembers.filter((member) => member.id !== family.self.id).length === 0 ? <p>Accepted family members will appear here.</p> :
          <div className="family-list">{family.acceptedMembers.filter((member) => member.id !== family.self.id).map((member) => <div key={member.id} className="family-share-row"><strong>{member.name}</strong>
            {['diet', 'finance'].map((feature) => {
              const enabled = family.myShares.some((share) => share.feature === feature && share.recipientId === member.userId);
              return <label key={feature}><input type="checkbox" checked={enabled} disabled={busy} onChange={() => run(() => apiRequest(`/api/family/${family.id}/shares/${feature}/${member.userId}`, { method: enabled ? 'DELETE' : 'PUT' }), `${feature === 'diet' ? 'Diet' : 'Finance'} sharing ${enabled ? 'stopped' : 'enabled'}.`)} /> {feature === 'diet' ? 'Diet' : 'Finance'}</label>;
            })}</div>)}</div>}
      </Surface>
      <Surface className="family-shared"><SectionHeader title="Shared with you" description="Read only access to information each member chose to share." />
        {family.sharedWithMe.length === 0 ? <p>No Diet or Finance information has been shared with you.</p> : <>
          <div className="family-filters"><FormField label="Diet date"><input type="date" value={sharedDate} onChange={(event) => setSharedDate(event.target.value)} /></FormField>
            <FormField label="Finance month"><input type="month" value={sharedMonth} onChange={(event) => setSharedMonth(event.target.value)} /></FormField></div>
          <div className="family-actions">{family.sharedWithMe.map((share) => <Button key={`${share.ownerId}-${share.feature}`} disabled={busy} onClick={() => showShared(share.ownerId, share.feature)}>{family.acceptedMembers.find((person) => person.userId === share.ownerId)?.name || 'Member'} · {share.feature}</Button>)}</div>
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
  </section>;
}
