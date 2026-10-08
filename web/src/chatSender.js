// One unresolved send per conversation. No optimistic messages or automatic retries.
export function createChatSender(apiRequest, newId = () => crypto.randomUUID()) {
  const pending = new Map();
  let busy = false;
  return {
    clear() { pending.clear(); },
    isBusy() { return busy; },
    pendingText(chatId) { return pending.get(chatId)?.text; },
    async send(chatId, draft, unlockToken) {
      if (busy) return null;
      const text = draft.trim();
      let attempt = pending.get(chatId);
      if (attempt && attempt.text !== text) throw new Error('Retry the original message before changing its text.');
      if (!attempt) {
        attempt = { text, clientMessageId: newId() };
        pending.set(chatId, attempt);
      }
      busy = true;
      try {
        const result = await apiRequest(`/api/chat/conversations/${chatId}/messages`, {
          method: 'POST', headers: { 'X-Chat-Unlock': unlockToken }, body: JSON.stringify(attempt)
        });
        if (!result?.messageSaved) throw new Error('Message persistence could not be confirmed. Retry the same message.');
        pending.delete(chatId);
        return result;
      } catch (error) {
        // Validation/conflict responses are definitive; transport/service failures
        // retain the identifier even when the server may already have committed.
        if ([400, 409].includes(error.status)) pending.delete(chatId);
        throw error;
      } finally { busy = false; }
    }
  };
}
