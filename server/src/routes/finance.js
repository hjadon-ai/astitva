const crypto = require('crypto');
const express = require('express');
const Session = require('../models/Session');
const {
  FinanceAccount,
  FinanceConnection,
  FinanceHolding,
  FinanceTransaction
} = require('../models/Finance');
const { financeProvider } = require('../services/finance');
const { FinanceProviderError } = require('../services/finance/PlaidFinanceProvider');
const { encryptToken, decryptToken } = require('../services/finance/tokenEncryption');
const { getRuntimeConfig } = require('../config/runtime');
const { sessionToken } = require('../middleware/sessionToken');
const { requireFeature } = require('../middleware/featureAccess');
const {
  calculateSpending,
  calculateTotals,
  removeAccountData,
  removeConnectionData,
  synchronizeConnection
} = require('../services/finance/syncFinance');

const router = express.Router();
const syncingUsers = new Set();
const objectId = (value) => /^[a-f0-9]{24}$/i.test(value);
const monthValid = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const currentMonth = () => new Date().toISOString().slice(0, 7);

router.use((request, response, next) => {
  if (!getRuntimeConfig().financeEnabled) {
    return response.status(503).json({
      error: 'Finance is not enabled in this environment.',
      code: 'FINANCE_DISABLED'
    });
  }
  next();
});

function providerResponse(response, error) {
  if (error instanceof FinanceProviderError && error.code === 'PROVIDER_NOT_CONFIGURED') {
    return response.status(503).json({ error: error.message, code: error.code });
  }
  return response.status(502).json({
    error: `Plaid ${getRuntimeConfig().plaidEnvironment} could not complete the request.`,
    code: error instanceof FinanceProviderError ? error.code : 'PROVIDER_ERROR'
  });
}

function publicAccount(account) {
  return {
    id: String(account._id),
    connectionId: String(account.connectionId),
    name: account.name,
    officialName: account.officialName,
    mask: account.mask,
    type: account.type,
    subtype: account.subtype,
    assetClass: account.assetClass,
    currency: account.currency,
    currentBalance: account.currentBalance,
    availableBalance: account.availableBalance,
    creditLimit: account.creditLimit,
    balanceAsOf: account.balanceAsOf
  };
}

function publicTransaction(transaction) {
  return {
    id: String(transaction._id),
    accountId: String(transaction.accountId),
    date: transaction.date,
    authorizedDate: transaction.authorizedDate,
    name: transaction.name,
    merchantName: transaction.merchantName,
    amount: transaction.amount,
    currency: transaction.currency,
    direction: transaction.direction,
    category: transaction.category,
    categoryDetail: transaction.categoryDetail,
    pending: transaction.pending
  };
}

router.use(async (request, response, next) => {
  const token = sessionToken(request);
  if (typeof token !== 'string') return response.status(401).json({ error: 'Authentication required.' });
  const session = await Session.findOne({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() }
  }).populate('userId');
  if (!session?.userId) return response.status(401).json({ error: 'Authentication required.' });
  if (!session.userId.emailVerifiedAt) return response.status(403).json({ error: 'Email verification required.' });
  request.featureUser = session.userId;
  request.financeUserId = session.userId._id;
  next();
});
router.use(requireFeature('finance'));

router.get('/summary', async (request, response) => {
  const month = request.query.month || currentMonth();
  if (!monthValid(month)) return response.status(400).json({ error: 'Use a valid YYYY-MM month.' });
  const nextMonthDate = new Date(`${month}-01T00:00:00.000Z`);
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  const nextMonth = nextMonthDate.toISOString().slice(0, 7);

  const [accounts, connections, monthlyTransactions, recentTransactions] = await Promise.all([
    FinanceAccount.find({ userId: request.financeUserId }).lean(),
    FinanceConnection.find({ userId: request.financeUserId }).lean(),
    FinanceTransaction.find({
      userId: request.financeUserId,
      date: { $gte: `${month}-01`, $lt: `${nextMonth}-01` },
      currency: 'USD',
      direction: 'expense',
      pending: false
    }).lean(),
    FinanceTransaction.find({ userId: request.financeUserId }).sort({ date: -1, createdAt: -1 }).limit(10).lean()
  ]);

  const summaryTotals = calculateTotals(accounts);
  const spending = calculateSpending(monthlyTransactions);
  const lastSuccessfulSyncAt = connections.reduce((latest, connection) => {
    const value = connection.lastSuccessfulSyncAt?.getTime?.() || 0;
    return value > latest ? value : latest;
  }, 0);
  const stale = connections.some((connection) => connection.status !== 'active');

  return response.json({
    asOf: lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt) : null,
    currency: 'USD',
    totals: summaryTotals.totals,
    connectionCount: connections.length,
    accountCount: accounts.length,
    excludedCurrencyAccountCount: summaryTotals.excludedCurrencyAccountCount,
    monthlySpending: {
      month,
      total: spending.total,
      categories: spending.categories
    },
    recentTransactions: recentTransactions.map(publicTransaction),
    sync: {
      status: connections.length === 0 ? 'empty' : stale ? 'stale' : 'current',
      lastSuccessfulSyncAt: lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt) : null
    }
  });
});

router.get('/connections', async (request, response) => {
  const [connections, accounts] = await Promise.all([
    FinanceConnection.find({ userId: request.financeUserId }).sort({ createdAt: 1 }).lean(),
    FinanceAccount.find({ userId: request.financeUserId }).sort({ name: 1 }).lean()
  ]);
  return response.json({ connections: connections.map((connection) => ({
    id: String(connection._id),
    provider: connection.provider,
    providerEnvironment: connection.providerEnvironment,
    institutionId: connection.institutionId,
    institutionName: connection.institutionName,
    status: connection.status,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    lastSyncErrorCode: connection.lastSyncErrorCode,
    accounts: accounts.filter((account) => String(account.connectionId) === String(connection._id)).map(publicAccount)
  })) });
});

router.post('/connection-sessions', async (request, response) => {
  if (request.body?.provider !== 'plaid' || Object.keys(request.body || {}).some((key) => key !== 'provider')) {
    return response.status(400).json({ error: 'Provider must be plaid.' });
  }
  const provider = financeProvider('plaid');
  try {
    const session = await provider.createConnectionSession(request.financeUserId);
    return response.status(201).json({ provider: 'plaid', ...session });
  } catch (error) {
    return providerResponse(response, error);
  }
});

router.post('/connections', async (request, response) => {
  const exchangeToken = typeof request.body?.exchangeToken === 'string' ? request.body.exchangeToken.trim() : '';
  if (request.body?.provider !== 'plaid' || !exchangeToken ||
      Object.keys(request.body || {}).some((key) => !['provider', 'exchangeToken'].includes(key))) {
    return response.status(400).json({ error: 'Provider and exchange token are required.' });
  }
  const provider = financeProvider('plaid');
  const providerEnvironment = getRuntimeConfig().plaidEnvironment;
  let completed;
  let connection;
  try {
    completed = await provider.completeConnection(exchangeToken);
    const duplicate = await FinanceConnection.exists({
      userId: request.financeUserId,
      provider: 'plaid',
      providerEnvironment,
      providerItemId: completed.providerItemId
    });
    if (duplicate) {
      await provider.disconnect(completed.accessToken);
      return response.status(409).json({ error: 'This Plaid connection is already linked.' });
    }
    connection = await FinanceConnection.create({
      userId: request.financeUserId,
      provider: 'plaid',
      providerEnvironment,
      providerItemId: completed.providerItemId,
      encryptedAccessToken: encryptToken(completed.accessToken),
      institutionId: completed.institutionId,
      institutionName: completed.institutionName
    });
    const sync = await synchronizeConnection(connection, provider);
    return response.status(201).json({ connection: {
      id: String(connection._id),
      provider: connection.provider,
      providerEnvironment: connection.providerEnvironment,
      institutionId: connection.institutionId,
      institutionName: connection.institutionName,
      status: connection.status,
      sync
    } });
  } catch (error) {
    if (completed?.accessToken) {
      try {
        await provider.disconnect(completed.accessToken);
      } catch (_) {
        // Local cleanup still removes an unusable initial connection.
      }
    }
    if (connection) await removeConnectionData(connection);
    return providerResponse(response, error);
  }
});

router.post('/sync', async (request, response) => {
  if (Object.keys(request.body || {}).length) return response.status(400).json({ error: 'This request does not accept a body.' });
  const userKey = String(request.financeUserId);
  if (syncingUsers.has(userKey)) return response.status(409).json({ error: 'A Finance sync is already running.' });
  syncingUsers.add(userKey);
  try {
    const connections = await FinanceConnection.find({ userId: request.financeUserId });
    const results = [];
    for (const connection of connections) {
      try {
        results.push(await synchronizeConnection(connection, financeProvider(connection.provider)));
      } catch (error) {
        results.push({ connectionId: String(connection._id), status: 'failed', code: error.code || 'SYNC_FAILED' });
      }
    }
    const failed = results.filter((result) => result.status === 'failed').length;
    if (connections.length > 0 && failed === connections.length) {
      return response.status(502).json({ error: 'No Finance connection could be synchronized.', results });
    }
    return response.json({ status: failed ? 'partial' : 'complete', results });
  } finally {
    syncingUsers.delete(userKey);
  }
});

router.get('/accounts/:accountId', async (request, response) => {
  if (!objectId(request.params.accountId)) return response.status(404).json({ error: 'Finance account not found.' });
  const account = await FinanceAccount.findOne({ _id: request.params.accountId, userId: request.financeUserId }).lean();
  if (!account) return response.status(404).json({ error: 'Finance account not found.' });
  const [connection, transactions, holdings] = await Promise.all([
    FinanceConnection.findOne({ _id: account.connectionId, userId: request.financeUserId }).lean(),
    FinanceTransaction.find({ accountId: account._id, userId: request.financeUserId }).sort({ date: -1, createdAt: -1 }).limit(30).lean(),
    FinanceHolding.find({ accountId: account._id, userId: request.financeUserId }).sort({ marketValue: -1 }).lean()
  ]);
  return response.json({
    account: {
      ...publicAccount(account),
      institutionName: connection?.institutionName || 'Connected institution',
      lastSuccessfulSyncAt: connection?.lastSuccessfulSyncAt || null
    },
    recentTransactions: transactions.map(publicTransaction),
    holdings: holdings.map((holding) => ({
      id: String(holding._id),
      name: holding.name,
      tickerSymbol: holding.tickerSymbol,
      securityType: holding.securityType,
      quantity: holding.quantity,
      price: holding.price,
      marketValue: holding.marketValue,
      currency: holding.currency,
      priceAsOf: holding.priceAsOf
    }))
  });
});

router.delete('/accounts/:accountId', async (request, response) => {
  if (!objectId(request.params.accountId)) return response.status(404).json({ error: 'Finance account not found.' });
  const account = await FinanceAccount.findOne({ _id: request.params.accountId, userId: request.financeUserId });
  if (!account) return response.status(404).json({ error: 'Finance account not found.' });
  await FinanceConnection.updateOne(
    { _id: account.connectionId, userId: request.financeUserId },
    { $addToSet: { excludedProviderAccountIds: account.providerAccountId } }
  );
  await removeAccountData([account._id]);
  return response.status(204).end();
});

router.delete('/connections/:connectionId', async (request, response) => {
  if (!objectId(request.params.connectionId)) return response.status(404).json({ error: 'Finance connection not found.' });
  const connection = await FinanceConnection.findOne({ _id: request.params.connectionId, userId: request.financeUserId });
  if (!connection) return response.status(404).json({ error: 'Finance connection not found.' });
  if (connection.providerEnvironment !== getRuntimeConfig().plaidEnvironment) {
    return response.status(409).json({
      error: 'This Finance connection belongs to a different provider environment.',
      code: 'PROVIDER_ENVIRONMENT_MISMATCH'
    });
  }
  try {
    await financeProvider(connection.provider).disconnect(decryptToken(connection.encryptedAccessToken));
  } catch (error) {
    connection.status = 'disconnect_failed';
    connection.lastSyncErrorCode = error.code || 'DISCONNECT_FAILED';
    await connection.save();
    return providerResponse(response, error);
  }
  await removeConnectionData(connection);
  return response.status(204).end();
});

module.exports = router;
