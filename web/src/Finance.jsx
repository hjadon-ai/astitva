import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Landmark, Link2, RefreshCw, Trash2, TrendingUp, WalletCards } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, LoadingState, PageHeader, SectionHeader, StatCard, StatusBanner } from './ui';

let plaidScriptPromise;

function loadPlaidScript() {
  if (window.Plaid) return Promise.resolve();
  if (!plaidScriptPromise) {
    plaidScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-astitva-plaid]');
      const script = existing || document.createElement('script');
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('Plaid Link could not be loaded. Check your internet connection.')), { once: true });
      if (!existing) {
        script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
        script.async = true;
        script.dataset.astitvaPlaid = 'true';
        document.head.appendChild(script);
      }
    });
  }
  return plaidScriptPromise;
}

const thisMonth = () => new Date().toISOString().slice(0, 7);
const title = (value = '') => value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const dateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
const money = (value, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch (_) {
    return `${value || 0} ${currency}`;
  }
};

export function TransactionList({ transactions, empty = 'No synchronized transactions yet.' }) {
  if (!transactions.length) return <p className="finance-muted">{empty}</p>;
  return <div className="finance-transactions">
    {transactions.map((transaction) => {
      const displayAmount = transaction.direction === 'expense'
        ? -Math.abs(transaction.amount)
        : transaction.direction === 'income'
          ? Math.abs(transaction.amount)
          : -transaction.amount;
      return <article key={transaction.id}>
        <time dateTime={transaction.date}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${transaction.date}T12:00:00`))}</time>
        <div><strong>{transaction.merchantName || transaction.name}</strong><span>{title(transaction.category)}{transaction.pending ? ' · Pending' : ''}</span></div>
        <strong className={displayAmount > 0 ? 'finance-positive' : ''}>{displayAmount > 0 ? '+' : ''}{money(displayAmount, transaction.currency)}</strong>
      </article>;
    })}
  </div>;
}

function AccountDetail({ accountId, apiRequest, busy, reloadKey, actionError, actionMessage, onBack, onRefresh, onRemoved }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    apiRequest(`/api/finance/accounts/${accountId}`)
      .then((result) => { if (active) { setData(result); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [accountId, apiRequest, reloadKey]);

  async function stopTracking() {
    setConfirmingRemoval(false);
    await onRemoved(accountId);
  }

  return <section className="profile-content finance-page">
    <button className="text-action back-action" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to Finance</button>
    {actionError && <StatusBanner tone="error" role="alert">{actionError}</StatusBanner>}
    {actionMessage && <StatusBanner tone="success" role="status">{actionMessage}</StatusBanner>}
    {error && <StatusBanner tone="error" role="alert">{error}</StatusBanner>}
    {!data && !error && <LoadingState>Loading account…</LoadingState>}
    {data && <>
      <PageHeader eyebrow={`Finance / ${data.account.institutionName}`} title={`${data.account.name}${data.account.mask ? ` ··${data.account.mask}` : ''}`} />
      <div className="finance-detail-grid">
        <article><span>Current balance</span><strong>{money(data.account.currentBalance, data.account.currency)}</strong></article>
        <article><span>{data.account.assetClass === 'investment' ? 'Account value' : 'Available'}</span><strong>{money(data.account.assetClass === 'investment' ? data.account.currentBalance : data.account.availableBalance, data.account.currency)}</strong></article>
        <article><span>Last synced</span><strong>{dateTime(data.account.lastSuccessfulSyncAt)}</strong></article>
      </div>
      <div className="finance-actions">
        <Button icon={RefreshCw} type="button" disabled={busy} onClick={onRefresh}>{busy ? 'Refreshing…' : 'Refresh finances'}</Button>
        <Button variant="danger" icon={Trash2} type="button" disabled={busy} onClick={() => setConfirmingRemoval(true)}>Stop tracking account</Button>
      </div>
      {data.holdings.length > 0 && <section className="finance-section">
        <h2>Holdings</h2>
        <div className="finance-table">
          {data.holdings.map((holding) => <article key={holding.id}>
            <div><strong>{holding.name}</strong><span>{holding.tickerSymbol || title(holding.securityType)}</span></div>
            <span>{holding.quantity} shares</span>
            <strong>{money(holding.marketValue, holding.currency)}</strong>
          </article>)}
        </div>
      </section>}
      <section className="finance-section"><h2>Recent activity</h2><TransactionList transactions={data.recentTransactions} /></section>
    </>}
    <ConfirmDialog open={confirmingRemoval} title="Stop tracking this account?" description="Its local transactions and holdings will be deleted. The institution will remain connected." confirmLabel="Stop tracking" busy={busy} onCancel={() => setConfirmingRemoval(false)} onConfirm={stopTracking} />
  </section>;
}

export default function Finance({ apiRequest, runtime }) {
  const [month, setMonth] = useState(thisMonth);
  const [summary, setSummary] = useState(null);
  const [connections, setConnections] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const [confirmingConnection, setConfirmingConnection] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const financeDisabled = runtime?.financeProvider?.enabled === false;
  const realFinance = runtime?.financeProvider?.environment === 'production';
  const cloudData = runtime?.dataLocation === 'cloud';

  const load = useCallback(async () => {
    if (financeDisabled) {
      setSummary(null);
      setConnections([]);
      setError('');
      return;
    }
    const [summaryResult, connectionResult] = await Promise.all([
      apiRequest(`/api/finance/summary?month=${month}`),
      apiRequest('/api/finance/connections')
    ]);
    setSummary(summaryResult);
    setConnections(connectionResult.connections);
    setError('');
  }, [apiRequest, financeDisabled, month]);

  useEffect(() => {
    let active = true;
    setSummary(null);
    load().catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [load, version]);

  function shiftMonth(amount) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + amount);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  async function run(action, work, success) {
    setBusy(action); setError(''); setMessage('');
    try {
      const result = await work();
      if (result !== false) setMessage(success);
      setVersion((value) => value + 1);
      return result !== false;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusy('');
    }
  }

  async function connect() {
    if (realFinance) {
      setConfirmingConnection(true);
      return;
    }
    await openConnection();
  }

  async function openConnection() {
    setConfirmingConnection(false);
    await run('connect', async () => {
      const session = await apiRequest('/api/finance/connection-sessions', {
        method: 'POST',
        body: JSON.stringify({ provider: 'plaid' })
      });
      await loadPlaidScript();
      return new Promise((resolve, reject) => {
        const handler = window.Plaid.create({
          token: session.sessionToken,
          onSuccess: async (publicToken) => {
            try {
              await apiRequest('/api/finance/connections', {
                method: 'POST',
                body: JSON.stringify({ provider: 'plaid', exchangeToken: publicToken })
              });
              handler.destroy();
              resolve();
            } catch (requestError) {
              handler.destroy();
              reject(requestError);
            }
          },
          onExit: (plaidError) => {
            handler.destroy();
            if (plaidError) reject(new Error('Plaid Link did not complete. Please try again.'));
            else resolve(false);
          }
        });
        handler.open();
      });
    }, 'Account connection completed.');
  }

  async function refresh() {
    await run('sync', () => apiRequest('/api/finance/sync', {
      method: 'POST', body: JSON.stringify({})
    }), 'Finance data refreshed.');
  }

  async function stopTracking(id) {
    const removed = await run('remove-account', () => apiRequest(`/api/finance/accounts/${id}`, { method: 'DELETE' }), 'Account removed from local Finance tracking.');
    if (removed) setAccountId(null);
  }

  async function disconnect(connection) {
    setDisconnecting(null);
    await run('disconnect', () => apiRequest(`/api/finance/connections/${connection.id}`, { method: 'DELETE' }), 'Institution disconnected and local data deleted.');
  }

  if (financeDisabled) return <section className="profile-content finance-page">
    <PageHeader eyebrow="Personal / Finance" title="Finance" description="Finance is available after Plaid is enabled for Production." />
    <StatusBanner tone="warning" role="status">Finance is disabled during the initial Production rollout. No Plaid connection or synchronization will be attempted.</StatusBanner>
  </section>;

  if (accountId) return <AccountDetail accountId={accountId} apiRequest={apiRequest} busy={Boolean(busy)} reloadKey={version}
    actionError={error} actionMessage={message}
    onBack={() => setAccountId(null)} onRefresh={refresh} onRemoved={stopTracking} />;

  return <section className="profile-content finance-page">
    <PageHeader eyebrow="Personal / Finance" title="Finance" description={`A consolidated view from ${cloudData ? 'securely synchronized cloud' : 'locally synchronized'} financial data.`} actions={<><Button icon={RefreshCw} type="button" disabled={Boolean(busy)} onClick={refresh}>{busy === 'sync' ? 'Refreshing…' : 'Refresh'}</Button><Button variant="primary" icon={Link2} type="button" disabled={Boolean(busy)} onClick={connect}>{busy === 'connect' ? 'Opening Plaid…' : realFinance ? 'Connect real account' : 'Connect account'}</Button></>} />
    {error && <StatusBanner tone="error" role="alert">{error}</StatusBanner>}
    {message && <StatusBanner tone="success" role="status">{message}</StatusBanner>}
    {!summary && !error && <LoadingState>Loading finances…</LoadingState>}
    {summary && <>
      <p className="finance-sync">{summary.asOf ? `Last synced ${dateTime(summary.asOf)}` : 'No financial data has been synchronized yet.'}</p>
      {summary.sync.status === 'stale' && <StatusBanner tone="warning">Some connections need attention. Your last successful local data remains available.</StatusBanner>}
      {summary.excludedCurrencyAccountCount > 0 && <StatusBanner tone="warning">{summary.excludedCurrencyAccountCount} non-USD account value is excluded from consolidated totals.</StatusBanner>}
      <div className="finance-summary">
        <StatCard label="Net worth" value={money(summary.totals.netWorth)} icon={WalletCards} accent="blue" />
        <StatCard label="Cash" value={money(summary.totals.cash)} icon={Landmark} accent="blue" />
        <StatCard label="Investments" value={money(summary.totals.investments)} icon={TrendingUp} accent="purple" />
        <StatCard label="Debt" value={money(summary.totals.debt)} icon={WalletCards} accent="pink" />
      </div>

      <section className="finance-section">
        <SectionHeader eyebrow={cloudData ? 'Connected securely' : 'Connected locally'} title="Accounts" action={<span>{summary.accountCount} accounts · {summary.connectionCount} institutions</span>} />
        {!connections.length && <EmptyState icon={Landmark} title="No accounts connected" description={`${realFinance ? `Connect a real institution through Plaid Production. Synchronized values stay in the ${cloudData ? 'Production Atlas database' : 'separate local Stage database'}.` : 'Connect a Plaid Sandbox institution to create your local view with fake financial data.'} Plaid credentials and durable access tokens stay on the server.`} action={<Button variant="primary" icon={Link2} onClick={connect} disabled={Boolean(busy)}>{realFinance ? 'Connect real account' : 'Connect account'}</Button>} />}
        {connections.map((connection) => <article className="finance-connection" key={connection.id}>
          <header><div><h3>{connection.institutionName}</h3><p>{title(connection.status)} · Last synced {dateTime(connection.lastSuccessfulSyncAt)}</p></div>
            <button className="text-action destructive" disabled={Boolean(busy)} onClick={() => setDisconnecting(connection)}><Trash2 size={15} aria-hidden="true" /> Disconnect institution</button></header>
          {connection.lastSyncErrorCode && <StatusBanner tone="warning">Sync issue: {title(connection.lastSyncErrorCode)}</StatusBanner>}
          <div className="finance-account-list">{connection.accounts.map((account) => <button type="button" key={account.id} onClick={() => setAccountId(account.id)}>
            <span><strong>{account.name}{account.mask ? ` ··${account.mask}` : ''}</strong><small>{title(account.subtype || account.type)}</small></span>
            <strong>{money(account.currentBalance, account.currency)} <i>View ›</i></strong>
          </button>)}</div>
        </article>)}
      </section>

      <section className="finance-section">
        <div className="finance-section-heading"><div><p className="eyebrow">Monthly view</p><h2>Spending</h2></div>
          <div className="finance-month"><button className="text-action" onClick={() => shiftMonth(-1)}>‹ Previous</button><strong>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))}</strong><button className="text-action" onClick={() => shiftMonth(1)}>Next ›</button></div></div>
        <p className="finance-spending-total">{money(summary.monthlySpending.total)}</p>
        <div className="finance-categories">{summary.monthlySpending.categories.length
          ? summary.monthlySpending.categories.map((category) => <article key={category.name}><span>{title(category.name)}</span><strong>{money(category.amount)}</strong></article>)
          : <p className="finance-muted">No completed USD expenses for this month.</p>}</div>
      </section>

      <section className="finance-section"><p className="eyebrow">Last ten</p><h2>Recent transactions</h2><TransactionList transactions={summary.recentTransactions} /></section>
    </>}
    <ConfirmDialog open={confirmingConnection} title="Connect a real financial account?" description={`Plaid Production will connect to the selected institution. Astitva will store synchronized values in the ${cloudData ? 'Production Atlas database' : 'local Stage database'}.`} confirmLabel="Continue to Plaid" busy={Boolean(busy)} onCancel={() => setConfirmingConnection(false)} onConfirm={openConnection} />
    <ConfirmDialog open={Boolean(disconnecting)} title="Disconnect institution?" description={disconnecting ? `${disconnecting.institutionName} and all of its locally synchronized Finance data will be deleted.` : ''} confirmLabel="Disconnect institution" busy={Boolean(busy)} onCancel={() => setDisconnecting(null)} onConfirm={() => disconnect(disconnecting)} />
  </section>;
}
