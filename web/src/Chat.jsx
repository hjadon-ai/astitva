import { useEffect, useState } from 'react';
import { Button, FormField, PageHeader, Surface } from './ui';

export default function Chat({ apiRequest }) {
  const [conversations, setConversations] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [alias, setAlias] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [unlocks, setUnlocks] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const inviteToken = window.location.pathname === '/chat-invite'
    ? new URLSearchParams(window.location.search).get('token') : null;

  async function refresh() {
    const [chats, pending] = await Promise.all([
      apiRequest('/api/chat/conversations'), apiRequest('/api/chat/invitations')
    ]);
    setConversations(chats.conversations);
    setInvitations(pending.invitations);
    if (selected) setSelected(chats.conversations.find((chat) => chat.id === selected.id) || null);
  }
  useEffect(() => { refresh().catch((error) => setNotice(error.message)); }, []);
  async function action(work) {
    setBusy(true);
    setNotice('');
    try { await work(); await refresh(); } catch (error) {
      if (selected && error.message === 'Unlock this conversation first.') {
        setUnlocks((current) => ({ ...current, [selected.id]: null }));
        setMessages([]);
      }
      setNotice(error.status === 429 ? `${error.message}${error.retryAt ? ` Try after ${new Date(error.retryAt).toLocaleString()}.` : ''}` : error.message);
    } finally { setBusy(false); }
  }
  async function createInvite(event) {
    event.preventDefault();
    await action(async () => {
      const result = await apiRequest('/api/chat/invitations', { method: 'POST', body: JSON.stringify({ alias }) });
      setInviteUrl(`${window.location.origin}/chat-invite?token=${result.token}`);
      setNotice(`Invite expires ${new Date(result.expiresAt).toLocaleString()}. Share this link privately.`);
    });
  }
  async function respond(accepted) {
    await action(async () => {
      const result = await apiRequest(`/api/chat/invitations/${inviteToken}/${accepted ? 'accept' : 'decline'}`, {
        method: 'POST', body: JSON.stringify(accepted ? { alias } : {})
      });
      window.history.replaceState({}, '', '/#chat');
      if (accepted) setSelected(result.conversation);
      setNotice(accepted ? 'Invitation accepted. Set a PIN to open this chat.' : 'Invitation declined.');
    });
  }
  async function setConversationPin(event) {
    event.preventDefault();
    await action(async () => {
      await apiRequest(`/api/chat/conversations/${selected.id}/pin`, { method: 'POST', body: JSON.stringify({ pin }) });
      setPin(''); setNotice('PIN set. Enter it again to unlock. A forgotten PIN cannot be reset.');
    });
  }
  async function unlock(event) {
    event.preventDefault();
    await action(async () => {
      const result = await apiRequest(`/api/chat/conversations/${selected.id}/unlock`, {
        method: 'POST', body: JSON.stringify({ pin })
      });
      setUnlocks((current) => ({ ...current, [selected.id]: result.token }));
      setPin('');
      const history = await apiRequest(`/api/chat/conversations/${selected.id}/messages`, {
        headers: { 'X-Chat-Unlock': result.token }
      });
      setMessages(history.messages);
    });
  }
  async function load(chat) {
    setSelected(chat);
    setAlias(chat.aliases.find((entry) => entry.self)?.alias || '');
    setMessages([]);
    setPin('');
    setNotice('');
    if (!unlocks[chat.id]) return;
    try {
      const result = await apiRequest(`/api/chat/conversations/${chat.id}/messages`, {
        headers: { 'X-Chat-Unlock': unlocks[chat.id] }
      });
      setMessages(result.messages);
    } catch {
      setUnlocks((current) => ({ ...current, [chat.id]: null }));
    }
  }
  async function send(event) {
    event.preventDefault();
    await action(async () => {
      await apiRequest(`/api/chat/conversations/${selected.id}/messages`, { method: 'POST',
        headers: { 'X-Chat-Unlock': unlocks[selected.id] }, body: JSON.stringify({ text: message }) });
      setMessage('');
      const result = await apiRequest(`/api/chat/conversations/${selected.id}/messages`, {
        headers: { 'X-Chat-Unlock': unlocks[selected.id] }
      });
      setMessages(result.messages);
    });
  }
  async function refreshMessages() {
    if (!selected || !unlocks[selected.id]) return;
    await action(async () => {
      const result = await apiRequest(`/api/chat/conversations/${selected.id}/messages`, {
        headers: { 'X-Chat-Unlock': unlocks[selected.id] }
      });
      setMessages(result.messages);
      setNotice('Messages refreshed.');
    });
  }
  async function lockChat(chatId) {
    await action(async () => {
      await apiRequest(`/api/chat/conversations/${chatId}/lock`, { method: 'POST' });
      setUnlocks((current) => ({ ...current, [chatId]: null }));
      if (selected?.id === chatId) {
        setMessages([]);
        setPin('');
      }
      setNotice('Chat locked. Enter your PIN to open it again.');
    });
  }
  async function changeAlias(event) {
    event.preventDefault();
    await action(async () => {
      await apiRequest(`/api/chat/conversations/${selected.id}/alias`, { method: 'PATCH',
        headers: { 'X-Chat-Unlock': unlocks[selected.id] }, body: JSON.stringify({ alias }) });
      setNotice('Alias updated.');
    });
  }
  async function remove(all) {
    const prompt = all ? 'Delete all your anonymous chats for both participants?' :
      'Delete this chat for both participants?';
    if (!window.confirm(`${prompt} Messages cannot be recovered. A minimal deletion record remains for 30 days.`)) return;
    await action(async () => {
      await apiRequest(all ? '/api/chat/conversations' : `/api/chat/conversations/${selected.id}`, {
        method: 'DELETE', headers: all ? {} : { 'X-Chat-Unlock': unlocks[selected.id] }
      });
      setSelected(null); setMessages([]); setUnlocks({});
      setNotice('Chat data deleted for both participants.');
    });
  }
  const activeToken = selected && unlocks[selected.id];
  return <main className="chat-page">
    <PageHeader eyebrow="Workspace / Chat" title="Anonymous chat" description="Share a private link manually. Your alias appears in chat; your account remains authenticated." />
    {notice && <p className="form-message" role="status">{notice}</p>}
    {inviteToken && <Surface>
      <h2>Chat invitation</h2><p>A signed-in account can claim this link once. Your account identity will not appear in the conversation.</p>
      <FormField label="Your alias"><input value={alias} maxLength="40" onChange={(event) => setAlias(event.target.value)} /></FormField>
      <div className="chat-actions"><Button type="button" variant="primary" disabled={busy || !alias.trim()} onClick={() => respond(true)}>Accept invitation</Button>
        <Button type="button" disabled={busy} onClick={() => respond(false)}>Decline</Button></div>
    </Surface>}
    {!inviteToken && <Surface>
      <h2>Create invite link</h2><p>The link expires in 24 hours. Anyone with it can claim it while signed in. The app sends no email.</p>
      <form onSubmit={createInvite} className="chat-inline-form"><FormField label="Your alias"><input value={alias} maxLength="40" required onChange={(event) => setAlias(event.target.value)} /></FormField>
        <Button type="submit" variant="primary" disabled={busy}>Create invite link</Button></form>
      {inviteUrl && <FormField label="Copy and share privately"><input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /></FormField>}
      {invitations.length > 0 && <p>{invitations.length} pending invite{invitations.length === 1 ? '' : 's'}. Each link can be claimed only once.</p>}
    </Surface>}
    <Surface><div className="chat-heading"><h2>Conversations</h2><Button variant="danger" type="button" disabled={busy || !conversations.length} onClick={() => remove(true)}>Delete all my anonymous chats</Button></div>
      {!conversations.length && <p>No active chats yet.</p>}
      <div className="chat-list">{conversations.map((chat) => <div className="chat-list-item" key={chat.id}>
        <button type="button" className={selected?.id === chat.id ? 'active' : ''} onClick={() => load(chat)}>
          {chat.aliases.find((entry) => !entry.self)?.alias || 'Anonymous'} <small>· {chat.messageCount} messages</small></button>
        {unlocks[chat.id] && <Button type="button" disabled={busy} onClick={() => lockChat(chat.id)}>Lock</Button>}
      </div>)}</div>
    </Surface>
    {selected && <Surface><div className="chat-heading"><h2>{selected.aliases.find((entry) => !entry.self)?.alias || 'Anonymous'}</h2>
      <div className="chat-actions">{activeToken && <><Button type="button" disabled={busy} onClick={refreshMessages}>Refresh messages</Button>
        <Button type="button" disabled={busy} onClick={() => lockChat(selected.id)}>Lock</Button></>}
        <Button variant="danger" type="button" disabled={busy} onClick={() => remove(false)}>Delete this chat</Button></div></div>
      {!selected.pinSet ? <form onSubmit={setConversationPin}><p>Set a six-digit PIN for this conversation. It cannot be reset.</p>
        <FormField label="New PIN"><input inputMode="numeric" type="password" pattern="[0-9]{6}" maxLength="6" value={pin} onChange={(event) => setPin(event.target.value)} required /></FormField>
        <Button variant="primary" type="submit" disabled={busy}>Set PIN</Button></form> : !activeToken ?
        <form onSubmit={unlock}><FormField label="Conversation PIN"><input inputMode="numeric" type="password" pattern="[0-9]{6}" maxLength="6" value={pin} onChange={(event) => setPin(event.target.value)} required /></FormField>
          <Button variant="primary" type="submit" disabled={busy}>Unlock chat</Button><p>Forgot the PIN? You can delete all chats or ask the other participant to delete this one, then start again.</p></form> :
        <><form onSubmit={changeAlias} className="chat-inline-form"><FormField label="Your alias"><input value={alias} maxLength="40" required onChange={(event) => setAlias(event.target.value)} /></FormField>
          <Button type="submit" disabled={busy}>Save alias</Button></form>
          <div className="chat-messages">{!messages.length && <p>No messages yet.</p>}{messages.map((entry) => <article key={entry.id}><strong>{entry.alias}{entry.self ? ' (you)' : ''}</strong><p>{entry.text}</p><small>{new Date(entry.createdAt).toLocaleString()}</small></article>)}</div>
          <form onSubmit={send} className="chat-inline-form"><FormField label="Message"><input value={message} maxLength="2000" onChange={(event) => setMessage(event.target.value)} required /></FormField>
            <Button variant="primary" type="submit" disabled={busy}>Send</Button></form></>}
    </Surface>}
  </main>;
}
