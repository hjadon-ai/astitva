import './chat.css';
import { chatScrollAction, chatViewportSize, sameChatViewport, syncChatViewport } from './chatScroll';
import { createMessageAlerts } from './privateNotification';
import { enableWebNotifications, disableWebNotifications, notificationsWanted, showWebNotification, browserNotificationStatus } from './webNotifications';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, FormField, Surface } from './ui';
import { createChatSender } from './chatSender';
import { closeFirestoreChat, loadOlderFirestoreMessages, openFirestoreChat } from './firestoreChat';

export default function Chat({ apiRequest, webNotificationsEnabled }) {
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
  const [notificationState, setNotificationState] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(notificationsWanted);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const atBottom = useRef(true);
  const readPosition = useRef('');
  const reading = useRef(false);
  const [readRevision, setReadRevision] = useState(0);
  const [connection, setConnection] = useState('Locked');
  const page = useRef(null);
  const threadTitle = useRef(null);
  const conversationList = useRef(null);
  const [availableHeight, setAvailableHeight] = useState(null);
  const listener = useRef(null);
  const messageBoard = useRef(null);
  const messageContent = useRef(null);
  const boardSize = useRef(null);
  const acknowledgeLatest = useRef(null);
  const previousBoard = useRef(null);
  const sender = useRef(null);
  if (!sender.current) sender.current = createChatSender(apiRequest);
  const viewGeneration = useRef(0);
  const refreshGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    const update = () => browserNotificationStatus().then((value) => {
      if (active) { setNotificationState(value); setNotificationsEnabled(notificationsWanted()); }
    });
    update();
    window.addEventListener('astitva:notification-status', update);
    window.addEventListener('focus', update);
    return () => { active = false; window.removeEventListener('astitva:notification-status', update); window.removeEventListener('focus', update); };
  }, [webNotificationsEnabled]);
  useEffect(() => {
    const resize = () => {
      if (page.current) setAvailableHeight(Math.max(240, (window.visualViewport?.height || window.innerHeight) - page.current.getBoundingClientRect().top - 12));
    };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 859px)').matches || !selected) return;
    if (mobileThread) threadTitle.current?.focus();
    else conversationList.current?.querySelector('[aria-current="true"]')?.focus();
  }, [mobileThread, selected?.id]);

  useLayoutEffect(() => {
    const board = messageBoard.current;
    if (!board) {
      previousBoard.current = null;
      return;
    }
    const firstId = messages[0]?.id;
    const lastId = messages.at(-1)?.id;
    const previous = previousBoard.current;
    const scrollAction = chatScrollAction(previous, { chatId: selected?.id, firstId, lastId, self: messages.at(-1)?.self }, atBottom.current);
    if (scrollAction === 'bottom') {
      board.scrollTop = board.scrollHeight;
      atBottom.current = true;
      setNewMessages(false);
    } else if (scrollAction === 'preserve') {
      board.scrollTop += board.scrollHeight - previous.height;
    } else if (scrollAction === 'notify') {
      setNewMessages(true);
    }
    boardSize.current = chatViewportSize(board);
    previousBoard.current = { chatId: selected?.id, firstId, lastId, height: board.scrollHeight };
  }, [messages, selected?.id, Boolean(selected && unlocks[selected.id])]);
  useLayoutEffect(() => {
    const board = messageBoard.current;
    if (!board) return;
    // Banners, wrapping, composer resizing and the mobile keyboard can change
    // the viewport after messages render. Keep a pinned reader at the actual end.
    const observer = new ResizeObserver(() => {
      boardSize.current = syncChatViewport(board, atBottom.current);
      if (previousBoard.current) previousBoard.current.height = board.scrollHeight;
      if (atBottom.current && board.clientHeight > 0) acknowledgeLatest.current?.();
    });
    observer.observe(board);
    if (messageContent.current) observer.observe(messageContent.current);
    return () => observer.disconnect();
  }, [selected?.id, Boolean(selected && unlocks[selected.id])]);
  const inviteToken = window.location.pathname === '/chat-invite'
    ? new URLSearchParams(window.location.search).get('token') : null;

  async function refresh() {
    const generation = ++refreshGeneration.current;
    const [chats, pending] = await Promise.all([
      apiRequest('/api/chat/conversations'), apiRequest('/api/chat/invitations')
    ]);
    if (generation !== refreshGeneration.current) return;
    setConversations(chats.conversations);
    setInvitations(pending.invitations);
    setSelected((current) => {
      if (current) return chats.conversations.find((chat) => chat.id === current.id) || null;
      const requested = new URLSearchParams(window.location.search).get('chat');
      const target = chats.conversations.find((chat) => chat.id === requested);
      if (target) setMobileThread(true);
      return target || null;
    });
  }

  useEffect(() => {
    refresh().catch((error) => setNotice(error.message));
    const poll = setInterval(() => { if (document.visibilityState === 'visible') refresh().catch((error) => setNotice(error.message)); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') refresh().catch((error) => setNotice(error.message)); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(poll); refreshGeneration.current++; document.removeEventListener('visibilitychange', visible); viewGeneration.current++; sender.current.clear(); listener.current?.(); closeFirestoreChat().catch(() => {}); };
  }, []);

  async function startListener(chat, customToken) {
    const generation = viewGeneration.current;
    const alertMessages = createMessageAlerts((payload) => showWebNotification(payload).catch(() => {}));
    listener.current?.();
    setConnection('Connecting');
    const unsubscribe = await openFirestoreChat(customToken, chat.id, (latest) => {
      if (generation !== viewGeneration.current) return;
      alertMessages(chat.id, latest);
      setLoaded(true);
      setMessages((current) => {
        const latestIds = new Set(latest.map((message) => message.id));
        const cutoff = latest[0]?.createdAt;
        const older = current.filter((message) => !latestIds.has(message.id) && cutoff && message.createdAt < cutoff);
        return [...older, ...latest];
      });
    }, (error) => {
      if (generation !== viewGeneration.current) return;
      setConnection('Disconnected'); setNotice(error.message);
    });
    if (generation !== viewGeneration.current) { unsubscribe(); return; }
    listener.current = unsubscribe;
    setConnection('Live');
  }
  async function reconnect() {
    if (!selected || !unlocks[selected.id]?.customToken) return;
    await action(async () => {
      await startListener(selected, unlocks[selected.id].customToken);
      setNotice('Chat reconnected.');
    }, false);
  }
  async function action(work, refreshAfter = true) {
    setBusy(true);
    setNotice('');
    try { await work(); if (refreshAfter) await refresh(); } catch (error) {
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
      if (accepted) { setSelected(result.conversation); setMobileThread(true); }
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
      const firebase = await apiRequest('/api/chat/firebase-session', { method: 'POST',
        headers: { 'X-Chat-Unlock': result.token }, body: JSON.stringify({ conversationId: selected.id }) });
      await startListener(selected, firebase.customToken);
      setUnlocks({ [selected.id]: { token: result.token, grantId: firebase.grantId, customToken: firebase.customToken } });
      setPin('');
    });
  }
  async function load(chat) {
    viewGeneration.current++;
    listener.current?.(); listener.current = null;
    await closeFirestoreChat();
    setUnlocks({});
    setMessage(sender.current.pendingText(chat.id) || '');
    setSelected(chat);
    setMobileThread(true); setLoaded(false); setNewMessages(false);
    atBottom.current = true; previousBoard.current = null; readPosition.current = '';
    setAlias(chat.aliases.find((entry) => entry.self)?.alias || '');
    setMessages([]);
    setPin('');
    setNotice('');
    setConnection('Locked');
    setBusy(false);
  }
  async function send(event) {
    event.preventDefault();
    if (!selected || !unlocks[selected.id] || busy || sender.current.isBusy()) return;
    const generation = viewGeneration.current;
    const chatId = selected.id;
    setBusy(true); setNotice('');
    try {
      const result = await sender.current.send(chatId, message, unlocks[chatId].token);
      if (result && generation === viewGeneration.current) {
        setMessage('');
        setNotice(result.warning || '');
      }
    } catch (error) {
      if (generation === viewGeneration.current) setNotice(error.message);
    } finally { if (generation === viewGeneration.current) setBusy(false); }
  }
  async function loadOlder() {
    if (!selected || !unlocks[selected.id]) return;
    await action(async () => {
      const older = await loadOlderFirestoreMessages(selected.id);
      setMessages((current) => [...older, ...current.filter((message) =>
        !older.some((entry) => entry.id === message.id))]);
      setNotice(older.length ? `Loaded ${older.length} older messages.` : 'No older messages.');
    }, false);
  }
  async function lockChat(chatId) {
    viewGeneration.current++;
    await action(async () => {
      await apiRequest(`/api/chat/conversations/${chatId}/lock`, { method: 'POST' });
      listener.current?.(); listener.current = null;
      await closeFirestoreChat();
      setUnlocks((current) => ({ ...current, [chatId]: null }));
      if (selected?.id === chatId) {
        setMessages([]);
        setPin('');
      }
      setConnection('Locked');
      setNotice('Chat locked. Enter your PIN to open it again.');
    });
  }
  async function changeAlias(event) {
    event.preventDefault();
    await action(async () => {
      await apiRequest(`/api/chat/conversations/${selected.id}/alias`, { method: 'PATCH',
        headers: { 'X-Chat-Unlock': unlocks[selected.id].token }, body: JSON.stringify({ alias }) });
      setNotice('Alias updated.');
    });
  }
  async function remove(all) {
    const prompt = all ? 'Delete all your anonymous chats for both participants?' :
      'Delete this chat for both participants?';
    if (!window.confirm(`${prompt} Messages cannot be recovered. A minimal deletion record remains for 30 days.`)) return;
    await action(async () => {
      await apiRequest(all ? '/api/chat/conversations' : `/api/chat/conversations/${selected.id}`, {
        method: 'DELETE'
      });
      viewGeneration.current++; sender.current.clear();
      setSelected(null); setMessages([]); setUnlocks({}); setMessage('');
      listener.current?.(); listener.current = null; await closeFirestoreChat(); setConnection('Locked');
      setNotice('Chat data deleted for both participants.');
    });
  }
  const activeToken = selected && unlocks[selected.id];
  async function acknowledge() {
    if (!activeToken || !loaded || !atBottom.current || !messageBoard.current ||
        messageBoard.current.scrollHeight - messageBoard.current.scrollTop - messageBoard.current.clientHeight > 2 || reading.current || document.visibilityState !== 'visible' ||
        (!mobileThread && window.matchMedia('(max-width: 859px)').matches)) return;
    const latest = messages.findLast((entry) => !entry.self);
    if (!latest || readPosition.current === `${selected.id}:${latest.id}`) return;
    const generation = viewGeneration.current;
    reading.current = true;
    try {
      await apiRequest(`/api/chat/conversations/${selected.id}/read`, { method: 'POST',
        headers: { 'X-Chat-Unlock': activeToken.token }, body: JSON.stringify({ messageId: latest.id }) });
      if (generation === viewGeneration.current) {
        readPosition.current = `${selected.id}:${latest.id}`;
        await refresh();
        setReadRevision((value) => value + 1);
      }
    } catch (error) { if (generation === viewGeneration.current) setNotice(error.message); }
    finally { reading.current = false; }
  }
  acknowledgeLatest.current = acknowledge;
  useEffect(() => {
    acknowledge();
    const visible = () => acknowledge();
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [messages, loaded, activeToken, mobileThread, readRevision]);
  function jumpToLatest() {
    const board = messageBoard.current;
    if (board) board.scrollTop = board.scrollHeight;
    atBottom.current = true; setNewMessages(false); acknowledge();
  }
  const notificationControls = <div className="chat-notification-settings">
    <h3>Browser notifications</h3>
    {notificationState && <p role="status"><strong>{notificationState.title}</strong><br/>{notificationState.detail}</p>}
    <p>Private “Daily Check” alerts. Opening one still requires login and your PIN.</p>
    {!webNotificationsEnabled ? <p>Disabled by the administrator.</p> :
      <Button disabled={busy} onClick={() => action(async () => {
        if (notificationsEnabled) {
          await disableWebNotifications(apiRequest); setNotificationsEnabled(false);
          setNotice('Web notifications disabled for this browser.');
        } else {
          const mode = await enableWebNotifications(apiRequest); setNotificationsEnabled(true);
          setNotice(mode === 'background' ? 'Web notifications enabled, including when the page is closed.' : 'Notifications enabled for open chats. Background delivery needs the Firebase Web Push public key.');
        }
      }, false)}>{notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}</Button>}
    {webNotificationsEnabled && notificationsEnabled && <Button disabled={busy} onClick={() => action(async () => {
      const mode = await enableWebNotifications(apiRequest);
      setNotice(mode === 'background' ? 'Background notifications connected for this browser.' : 'Open-chat alerts enabled. Background push is not configured.');
    }, false)}>Reconnect notifications</Button>}
  </div>;
  return <main ref={page} style={availableHeight ? { height: availableHeight } : undefined} className={`chat-page chat-redesign ${mobileThread && selected ? 'chat-show-thread' : ''}`}>
    <header className="chat-page-heading"><h1>Anonymous chat</h1>
      <Button variant="primary" disabled={busy} onClick={() => { setInviteOpen(true); setInviteUrl(''); }}>New conversation</Button>
      <details className="chat-privacy"><summary>About privacy</summary><p>Aliases hide your account identity from the other participant. Each participant uses their own PIN. A forgotten PIN cannot be reset.</p></details>
    </header>
    {notice && <p className="form-message" role="status">{notice}</p>}
    {inviteToken && <Surface className="chat-incoming-invite"><h2>Chat invitation</h2>
      <p>A signed-in account can claim this link once. Your account identity will not appear in the conversation.</p>
      <FormField label="Your alias"><input value={alias} maxLength="40" onChange={(event) => setAlias(event.target.value)} /></FormField>
      <div className="chat-actions"><Button variant="primary" disabled={busy || !alias.trim()} onClick={() => respond(true)}>Accept invitation</Button><Button disabled={busy} onClick={() => respond(false)}>Decline</Button></div>
    </Surface>}
    {inviteOpen && !inviteToken && <Surface className="chat-invite-flow" role="region" aria-label="New conversation">
      <div className="chat-heading"><h2>{inviteUrl ? 'Share your invitation' : 'Choose your alias'}</h2><Button onClick={() => setInviteOpen(false)}>Close</Button></div>
      {!inviteUrl ? <form onSubmit={createInvite} className="chat-inline-form"><FormField label="Your alias"><input autoFocus value={alias} maxLength="40" required onChange={(event) => setAlias(event.target.value)} /></FormField><Button type="submit" variant="primary" disabled={busy}>Create invite link</Button></form> : <>
        <FormField label="Copy and share privately"><input autoFocus readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /></FormField>
        <Button onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); setNotice('Invitation link copied.'); } catch { setNotice('Select the link and copy it manually.'); } }}>Copy link</Button></>}
      <p>The link expires in 24 hours. Any signed-in person with it can claim it once. The app sends no email.</p>
    </Surface>}
    <Surface className="chat-workspace">
      <aside className="chat-conversations" aria-label="Conversations"><h2>Conversations</h2>
        {!conversations.length && <p>No conversations yet. Create an invitation to start.</p>}
        <div className="chat-list" ref={conversationList}>{conversations.map((chat) => <button key={chat.id} type="button" aria-current={selected?.id === chat.id ? 'true' : undefined} className={selected?.id === chat.id ? 'active' : ''} disabled={busy} onClick={() => load(chat)}>
          <span className="chat-contact-name">{chat.aliases.find((entry) => !entry.self)?.alias || 'Anonymous'}</span>
          <small>{unlocks[chat.id] ? 'Unlocked' : chat.pinSet ? 'Locked' : 'PIN required'}</small>
          {chat.unreadCount == null && <small>Unread count unavailable</small>}
          {chat.unreadCount > 0 && <span className="chat-unread" aria-label={`${chat.unreadCount} unread messages`}>{chat.unreadCount} unread</span>}
        </button>)}</div>
        <details className="chat-pending"><summary>Pending invitations · {invitations.length}</summary>{invitations.map((invite) => <p key={invite.id}>Expires {new Date(invite.expiresAt).toLocaleString()}</p>)}{!invitations.length && <p>No pending invitations.</p>}</details>
        <details className="chat-management"><summary>Manage conversations</summary>{notificationControls}<Button variant="danger" disabled={busy || !conversations.length} onClick={() => remove(true)}>Delete all my anonymous chats</Button></details>
      </aside>
      {!selected ? <section className="chat-thread chat-empty"><h2>{conversations.length ? 'Choose a conversation' : 'Start a private conversation'}</h2><p>{conversations.length ? 'Select a conversation and enter your PIN to read messages.' : 'Create an invitation and share it privately to chat using aliases.'}</p><Button variant="primary" onClick={() => { setInviteOpen(true); setInviteUrl(''); }}>New conversation</Button></section> :
      <section className="chat-thread" aria-label="Selected conversation">
        <header className="chat-heading"><Button className="chat-back" onClick={() => setMobileThread(false)}>Back to conversations</Button><h2 ref={threadTitle} tabIndex={-1}>{selected.aliases.find((entry) => !entry.self)?.alias || 'Anonymous'}</h2>
          <div className="chat-actions"><small className={`chat-connection chat-connection-${(activeToken ? connection : 'Locked').toLowerCase()}`}>{activeToken ? connection : selected.pinSet ? 'Locked' : 'PIN required'}</small>
          {activeToken && <>{connection === 'Disconnected' && <Button disabled={busy} onClick={reconnect}>Reconnect</Button>}<Button disabled={busy} onClick={() => lockChat(selected.id)}>Lock</Button></>}
          <details className="chat-options" key={selected.id}><summary>Options</summary><div className="chat-options-content">
            {activeToken && <form onSubmit={changeAlias}><FormField label="Your alias"><input value={alias} maxLength="40" required onChange={(event) => setAlias(event.target.value)} /></FormField><Button type="submit" disabled={busy}>Save alias</Button></form>}
            {notificationControls}<hr/><Button variant="danger" disabled={busy} onClick={() => remove(false)}>Delete this chat</Button></div></details>
          </div>
        </header>
        {!selected.pinSet ? <form className="chat-pin-gate" onSubmit={setConversationPin}><h3>Protect your conversation</h3><p>Set your own six-digit PIN. It cannot be reset.</p><FormField label="New PIN"><input inputMode="numeric" type="password" pattern="[0-9]{6}" maxLength="6" value={pin} onChange={(event) => setPin(event.target.value)} required /></FormField><Button variant="primary" type="submit" disabled={busy}>Set PIN</Button></form> : !activeToken ?
        <form className="chat-pin-gate" onSubmit={unlock}><h3>Unlock this conversation</h3>{selected.unreadCount > 0 && <p>{selected.unreadCount} unread messages. Enter your PIN to read them.</p>}<FormField label="Conversation PIN"><input inputMode="numeric" type="password" pattern="[0-9]{6}" maxLength="6" value={pin} onChange={(event) => setPin(event.target.value)} required /></FormField><Button variant="primary" type="submit" disabled={busy}>Unlock chat</Button><p>Forgot the PIN? Delete the conversation and start again. Deletion removes messages for both participants.</p></form> : <>
          <div className="chat-messages" role="region" aria-label="Messages" tabIndex={0} ref={messageBoard} onScroll={() => { const board = messageBoard.current; if (!sameChatViewport(board, boardSize.current)) return; atBottom.current = board.scrollHeight - board.scrollTop - board.clientHeight < 48; if (atBottom.current) { setNewMessages(false); acknowledge(); } }}>
            <div className="chat-message-content" ref={messageContent}>
            <Button className="chat-history-button" disabled={busy || !loaded} onClick={loadOlder}>Load older messages</Button>
            {!loaded ? <p role="status">Loading messages…</p> : !messages.length && <p>No messages yet. Say hello.</p>}
            {messages.map((entry, index) => { const previous = messages[index - 1]; const date = new Date(entry.createdAt).toLocaleDateString(); const newDay = !previous || new Date(previous.createdAt).toLocaleDateString() !== date; const grouped = !newDay && previous.self === entry.self && previous.alias === entry.alias; return <div className="chat-message-group" key={entry.id}>{newDay && <p className="chat-date">{date}</p>}<article className={`${entry.self ? 'chat-message-sent' : 'chat-message-received'} ${grouped ? 'chat-message-continuation' : ''}`}>{!grouped && <strong>{entry.alias}{entry.self ? ' (you)' : ''}</strong>}<p>{entry.text}</p><time dateTime={new Date(entry.createdAt).toISOString()} title={new Date(entry.createdAt).toLocaleString()}>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></article></div>; })}
            </div>
          </div>
          {newMessages && <Button className="chat-new-messages" onClick={jumpToLatest}>New messages ↓</Button>}
          <form onSubmit={send} className="chat-inline-form chat-composer"><FormField label="Message"><textarea rows="2" value={message} disabled={busy || sender.current.pendingText(selected.id) !== undefined} maxLength="2000" onChange={(event) => setMessage(event.target.value)} required /></FormField><Button variant="primary" type="submit" disabled={busy || !message.trim() || !loaded}>Send</Button></form>
        </>}
      </section>}
    </Surface>
  </main>;
}
