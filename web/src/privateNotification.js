export const notificationTitle = 'Daily Check';
export const notificationBody = 'You have a new chat message.';

export function privateNotification(data) {
  if (data?.type !== 'anonymous_chat_message' || !/^[a-f\d]{24}$/i.test(data.conversationId || '')) return null;
  // Never use incoming title/body/text/aliases or an arbitrary URL.
  return { title: notificationTitle, options: {
    body: notificationBody, icon: '/favicon.svg', tag: `astitva-chat-${data.conversationId}`,
    data: { conversationId: data.conversationId },
  }, id: /^[a-f\d]{24,64}$/i.test(data.notificationId || '') ? data.notificationId : null };
}
export function notificationTarget(data, origin) {
  const notification = privateNotification({ type: 'anonymous_chat_message', ...data });
  return notification ? `${origin}/?chat=${encodeURIComponent(notification.options.data.conversationId)}#chat` : `${origin}/#chat`;
}

export function createMessageAlerts(notify) {
  let seen = null;
  return (chatId, messages) => {
    const ids = new Set(messages.map((message) => message.id));
    if (seen) for (const message of messages) {
      if (!seen.has(message.id) && !message.self) notify({ type: 'anonymous_chat_message', conversationId: chatId, notificationId: message.id });
    }
    // Keep seen IDs across bounded listener pages; never notify history again.
    seen = new Set([...(seen || []), ...ids]);
  };
}
