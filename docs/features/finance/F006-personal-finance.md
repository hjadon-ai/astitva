# F006: Personal finance

- **Status:** Done
- **Branch:** `feature/F006-personal-finance`
- **Pull request:** Not created

## Goal

Add a private Finance section where a logged-in, verified user can connect Plaid Sandbox institutions and see a consolidated, last-synced view of cash, investments, debt, accounts, transactions, and monthly spending. Keep Plaid behind a provider interface so another provider can be added later without changing the Finance API or page model.

## User flow

1. The user opens **Finance** from the authenticated profile navigation.
2. With no connections, the page explains that financial data is stored in local MongoDB and offers **Connect account**.
3. The server creates a short-lived connection session and the browser opens Plaid Link.
4. After the user selects an institution and accounts, the server exchanges the temporary Plaid token, stores the durable access token encrypted, and synchronizes the selected data into local MongoDB.
5. The Finance page reads the locally stored data and shows net worth, cash, investments, debt, connected accounts, recent transactions, and spending for the selected month.
6. The user can connect another institution, manually refresh all connections, or open an account to see its balance and recent activity.
7. The user can stop tracking one account while keeping its institution connected, or disconnect an institution and remove all of its locally synchronized data.
8. If Plaid is unavailable, the page continues to show the last successful local data with its sync time and error state.

## In scope

- Add **Finance** to the authenticated profile navigation.
- Require a logged-in, verified user for all Finance pages and APIs.
- Connect Plaid Sandbox bank, savings, credit-card, and investment accounts with Plaid Link.
- Put Plaid behind a server-side finance-provider interface.
- Store synchronized account, balance, holding, and transaction data in local MongoDB.
- Show current net worth, cash/bank balances, investment value, and debt/credit balances as of the last sync.
- Show connected institutions and their accounts.
- Show recent transactions.
- Show spending for one selected calendar month, grouped into basic Plaid spending categories.
- Show one account's details, balance, holdings when applicable, and recent transactions.
- Allow the user to connect another institution.
- Allow a manual refresh of all active connections.
- Allow the user to stop tracking one account locally while leaving the institution connected.
- Allow the user to disconnect an institution.
- Show loading, empty, syncing, stale-data, reauthentication-required, partial-failure, and disconnected states.
- Update OpenAPI and Postman documentation when implemented.

## Out of scope

- AI-generated financial guidance or financial advice
- Stock, fund, or cryptocurrency recommendations
- Budgets, savings plans, goals, alerts, or spending limits
- Cash-flow or net-worth forecasting
- Trading or portfolio rebalancing
- Bill discovery or bill payment
- Money transfers, deposits, withdrawals, or credit-card payments
- Credit scores, loan applications, or tax features
- Manual accounts or manually entered transactions
- Transaction editing, splitting, recategorization, or custom categories
- Historical net-worth charts
- Automatic scheduled synchronization or publicly reachable Plaid webhooks
- Real-time market prices
- Multiple currencies converted into one reporting currency
- Production deployment
- Plaid Development or Production access and real personal-account connections

## Wireframe or UI changes

Add **Finance** to the existing profile sidebar.

```text
┌──────────────┬─────────────────────────────────────────────────────────┐
│ Astitva.     │ Finance                   [ Refresh ] [ Connect account ]│
│              │ Last synced Sep 22, 10:30 AM                           │
│ Overview     │                                                         │
│ Diet         │ [ Net worth ] [ Cash ] [ Investments ] [ Debt ]        │
│ Finance      │ [ $84,500   ] [ $9,500 ] [ $78,000     ] [ $3,000 ]    │
│ Projects     │                                                         │
│ Notes        │ Accounts                                                │
│              │ Checking ··1234              $4,500           View ›   │
│              │ Fidelity brokerage            $78,000           View ›   │
│              │ Credit card ··9876             $3,000 owed      View ›   │
│              │                                                         │
│              │ Spending · ‹ August  September 2026  October ›          │
│              │                                      Total: $2,140     │
│              │ Food $620 · Shopping $480 · Transport $310 · Other $730│
│              │                                                         │
│              │ Recent transactions                                     │
│              │ Sep 21  Grocery store          Food             $82.40  │
│              │ Sep 20  Payroll                Income        +$3,200.00  │
└──────────────┴─────────────────────────────────────────────────────────┘
```

Selecting an account opens a simple detail view:

```text
Finance / Checking ··1234

Current balance  $4,500       Available  $4,120
Institution      Sample Bank  Last synced Sep 22, 10:30 AM

[ Refresh finances ] [ Stop tracking account ]

Recent activity
Sep 21  Grocery store       Food       $82.40
Sep 19  Electric company    Utilities  $96.10
```

For an investment account, the detail view replaces available cash with total market value and shows a compact holdings list containing security name, ticker when available, quantity, price, and value.

The connected-institution area includes a **Disconnect institution** action. It must explain that all accounts under that connection will stop syncing and that their local Finance data will be removed.

## API changes

All listed endpoints require an authenticated, verified user. Provider credentials and durable provider tokens are never accepted from or returned to the browser.

### Get the Finance summary

`GET /api/finance/summary?month=2026-09`

Response `200`:

```json
{
  "asOf": "2026-09-22T17:30:00.000Z",
  "currency": "USD",
  "totals": {
    "netWorth": 84500,
    "cash": 9500,
    "investments": 78000,
    "debt": 3000
  },
  "connectionCount": 2,
  "accountCount": 4,
  "monthlySpending": {
    "month": "2026-09",
    "total": 2140,
    "categories": [
      { "name": "Food and drink", "amount": 620 }
    ]
  },
  "recentTransactions": [],
  "sync": {
    "status": "current",
    "lastSuccessfulSyncAt": "2026-09-22T17:30:00.000Z"
  }
}
```

Responses:

- `200`: Return the local summary. With no connections, totals are zero and lists are empty.
- `400`: `month` is not a valid `YYYY-MM` value.
- `401`: Authentication is required.
- `403`: Email verification is required.

### List connected institutions and accounts

`GET /api/finance/connections`

Response `200` contains each connection's ID, provider, institution display name, status, last successful sync time, and its locally tracked accounts. An account contains its ID, display name, mask, type, subtype, currency, current balance, and available balance when supplied. It never contains provider tokens or full account numbers.

Responses: `200`, `401`, `403`.

### Create a provider connection session

`POST /api/finance/connection-sessions`

Request:

```json
{
  "provider": "plaid"
}
```

Response `201`:

```json
{
  "provider": "plaid",
  "sessionToken": "temporary-link-token",
  "expiresAt": "2026-09-22T21:30:00.000Z"
}
```

The browser uses this short-lived token only to open Plaid Link and does not persist or log it.

Responses:

- `201`: Temporary provider session created.
- `400`: Provider is invalid or unavailable in the configured environment.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `502`: Plaid rejected the request; return a safe error code without provider secrets.

### Complete a provider connection

`POST /api/finance/connections`

Request:

```json
{
  "provider": "plaid",
  "exchangeToken": "temporary-public-token"
}
```

The server exchanges the temporary token for Plaid's durable access token, retrieves the institution details from Plaid rather than trusting browser-supplied names or identifiers, encrypts the access token before storage, and starts the initial local synchronization. The temporary token is not stored.

Response `201` returns only the new connection ID, institution display data, status, and sync status.

Responses:

- `201`: Connection stored and initial sync started or completed.
- `400`: The request is incomplete or invalid.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `409`: The institution connection is already linked for this user.
- `502`: Plaid token exchange or initial retrieval failed; no durable token is returned.

### Refresh Finance data

`POST /api/finance/sync`

No request body. The server synchronizes every active connection owned by the user. One failed institution does not discard successful updates from another.

Response `200` returns the overall status, per-connection result, and latest successful sync time. The first version performs this work within the request and prevents a second sync for the same user while one is running.

Responses:

- `200`: Sync attempt finished; the result may be `complete` or `partial`.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `409`: A sync is already running for the user.
- `502`: No connection could be synchronized because the provider failed.

### Get an account

`GET /api/finance/accounts/{accountId}`

Response `200` contains the local account details, current balance, last sync time, recent transactions, and holdings for investment accounts.

Responses:

- `200`: Account returned.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `404`: The account does not exist for the authenticated user.

### Stop tracking an account

`DELETE /api/finance/accounts/{accountId}`

This removes the account and its transactions and holdings from local MongoDB and records the provider account ID as excluded from later syncs. It does not revoke the institution connection at Plaid.

Responses:

- `204`: Account data removed locally.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `404`: The account does not exist for the authenticated user.

### Disconnect an institution

`DELETE /api/finance/connections/{connectionId}`

The server first asks the provider to revoke/remove the connection, then removes the connection's locally synchronized accounts, holdings, transactions, and encrypted token.

Responses:

- `204`: Provider connection and local data removed.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `404`: The connection does not exist for the authenticated user.
- `502`: Provider revocation failed. Keep the local connection marked `disconnect_failed` so the user can retry safely.

## MongoDB changes

### `financeConnections`

Store one document per user and provider institution connection:

- `userId`: owner reference used in every query.
- `provider`: initially `plaid`.
- `providerItemId`: provider connection identifier.
- `encryptedAccessToken`: durable Plaid token encrypted by the server.
- `institutionId`: provider institution identifier.
- `institutionName`: display name captured at connection time.
- `status`: `active`, `login_required`, `sync_error`, or `disconnect_failed`.
- `excludedProviderAccountIds`: provider account IDs intentionally removed from local tracking.
- `transactionCursor`: cursor used for incremental transaction synchronization.
- `lastSyncStartedAt`: latest attempt time.
- `lastSuccessfulSyncAt`: latest completed sync time.
- `lastSyncErrorCode`: safe application/provider code without secret response data.
- `createdAt`, `updatedAt`.

Create a unique index on `userId`, `provider`, and `providerItemId`, plus an index on `userId` and `status`.

### `financeAccounts`

Store the current local view of each tracked account:

- `userId`, `connectionId`: ownership and connection references.
- `providerAccountId`: provider account identifier.
- `name`, `officialName`, `mask`: safe display fields; do not store full account or routing numbers.
- `type`, `subtype`: normalized account classification.
- `assetClass`: `cash`, `investment`, or `debt` for summary calculations.
- `currency`: ISO currency code supplied by the provider.
- `currentBalance`, `availableBalance`, `creditLimit`: nullable provider balance values.
- `balanceAsOf`: time of the data used for the balance.
- `createdAt`, `updatedAt`.

Create a unique index on `userId`, `providerAccountId`, and an index on `userId`, `assetClass`.

### `financeTransactions`

Store synchronized transaction activity:

- `userId`, `connectionId`, `accountId`: ownership and parent references.
- `providerTransactionId`: stable provider identifier.
- `date`, `authorizedDate`: provider dates when available.
- `name`, `merchantName`: display values.
- `amount`, `currency`: signed local display amount and currency.
- `direction`: `expense`, `income`, or `other`.
- `category`, `categoryDetail`: normalized Plaid personal-finance categories.
- `pending`: provider pending state.
- `createdAt`, `updatedAt`.

Create a unique index on `userId`, `providerTransactionId`, plus indexes on `userId`, `date` and `accountId`, `date`.

### `financeHoldings`

Store the latest synchronized investment holdings:

- `userId`, `connectionId`, `accountId`: ownership and parent references.
- `providerSecurityId`: provider security identifier.
- `name`, `tickerSymbol`, `securityType`: display fields when supplied.
- `quantity`, `price`, `marketValue`, `currency`: latest synchronized values.
- `priceAsOf`: provider price timestamp or date when supplied.
- `createdAt`, `updatedAt`.

Create a unique index on `accountId`, `providerSecurityId` and an index on `userId`, `accountId`.

No raw Plaid response bodies, bank credentials, full account numbers, or routing numbers are stored. Current summary values are calculated from the local collections rather than stored in a separate summary collection.

## Architecture decisions

These decisions were approved by the project owner:

- Define a server-side `FinanceProvider` interface with operations for creating a connection session, completing a connection, synchronizing data, and disconnecting. Implement `PlaidFinanceProvider` as the first adapter. Routes and MongoDB models use normalized Astitva objects rather than Plaid response objects.
- Use Plaid Link's supported flow: the server creates a short-lived Link token, the browser opens Link and receives a short-lived public token, and the server exchanges that token for the durable access token. Plaid client ID, secret, and durable access tokens remain server-only. Temporary browser tokens are kept only in memory and are never logged or persisted.
- Read Finance pages from local MongoDB. Contact Plaid only during connect, reconnect, manual sync, or disconnect. Display the last successful sync time so locally cached data is not presented as live data.
- Encrypt each durable Plaid access token before storing it in MongoDB using authenticated encryption. Keep the encryption key and Plaid credentials in uncommitted server environment variables. Never return or log decrypted tokens.
- Configure Plaid Sandbox only for the first implementation. Keep the provider environment configurable so Development or Production access can be reviewed as a later feature.
- Start with Plaid Accounts, Transactions, and Investments data. Use incremental transaction sync and store its cursor. The first version does not expose Plaid Auth data and does not request or store account/routing numbers.
- Calculate net worth as cash plus investment value minus debt. Do not count an investment balance twice when its holdings already supply the displayed market value.
- Treat positive outflow transactions as spending and exclude income, account transfers, credit-card payments, investment transactions, and refunds from monthly spending when Plaid's normalized category identifies them. Group included transactions by Plaid's primary personal-finance category.
- Use USD for consolidated totals in the first version. Show the original currency on non-USD accounts but exclude those values from consolidated totals and identify that exclusion in the UI rather than silently converting them.
- Treat a Plaid Item as an institution connection. **Disconnect institution** calls Plaid's item-removal operation and then deletes its local data. **Stop tracking account** is a local action because removing one Plaid Item would disconnect every account under that institution.
- Use manual synchronous refresh for the first local version. Webhooks and a background job can be a later feature if the application gains a reachable environment.
- Exclude pending transactions from monthly spending until Plaid marks them complete, preventing a pending and posted version from being counted together.
- Query and mutate every Finance record by both resource ID and authenticated user ID. Return `404` for another user's resource to avoid revealing its existence.
- Sanitize provider failures into stable application error codes. Never send Plaid response bodies, request IDs containing sensitive context, credentials, or tokens to the browser.

The Plaid flow follows the official [Link overview](https://plaid.com/docs/link/), transaction synchronization uses [`/transactions/sync`](https://plaid.com/docs/api/products/transactions/), investment holdings use [`/investments/holdings/get`](https://plaid.com/docs/investments/), and institution disconnect uses [`/item/remove`](https://plaid.com/docs/api/items/).

## Acceptance criteria

- A verified user can open **Finance** from the profile area.
- With no connected institution, the page shows zero totals, an explanation, and a **Connect account** action.
- A user can complete Plaid Link for a supported Sandbox institution and see its selected accounts after synchronization.
- A user can connect more than one institution without replacing an existing connection.
- The summary shows net worth, cash, investments, debt, account count, recent transactions, and spending for the selected month using local MongoDB data.
- The net-worth calculation adds assets and subtracts debt without double-counting investment holdings.
- The spending total equals the displayed included expense transactions and is grouped into basic categories.
- A user can open a bank, credit, or investment account and see the applicable local details.
- Manual refresh updates every active connection, shows progress, prevents a duplicate concurrent refresh, and reports partial failures.
- A provider outage leaves the last successful local data visible with its sync time and error state.
- A user can stop tracking one account without disconnecting other accounts at that institution.
- A user can disconnect an institution; Plaid access is revoked and its encrypted token and synchronized local data are removed.
- Plaid credentials and durable access tokens never appear in browser responses, browser storage, application logs, OpenAPI examples, or Postman examples.
- Tokens stored in MongoDB are encrypted and cannot be used without the separate server encryption key.
- One user cannot view, sync, stop tracking, or disconnect another user's Finance records.
- The endpoints are documented in OpenAPI and Postman.
- The feature runs locally with the existing web app, Express server, and localhost MongoDB.

## Local verification

Implementation is ready for project-owner review. Automated checks, the React production build, authenticated local API checks, and a provider-mocked MongoDB synchronization passed. A live Plaid Sandbox Link flow still requires the project owner's own Sandbox credentials.

Before manual testing, copy [`server/.env.example`](../../../server/.env.example) to `server/.env`, then set `PLAID_CLIENT_ID`, `PLAID_SECRET`, and a 32-byte `FINANCE_TOKEN_ENCRYPTION_KEY` in that ignored local file.

Manual verification should use Plaid Sandbox and cover:

1. Connect Sandbox checking, credit-card, and investment accounts and confirm their normalized local records.
2. Compare summary totals with the account and holding values to confirm debt subtraction and no investment double-counting.
3. Run manual sync twice, verify transaction updates are idempotent, and confirm concurrent sync is rejected.
4. Test spending category totals for expenses, income, transfers, credit-card payments, refunds, and pending transactions.
5. Open each account type and test recent activity and holdings.
6. Stop tracking one account, sync again, and confirm it remains excluded while sibling accounts stay connected.
7. Disconnect an institution and confirm Plaid removal plus deletion of its local token, accounts, holdings, and transactions.
8. Simulate provider and login-required errors and confirm last-synced data remains readable without exposing provider secrets.
9. Use two verified users to confirm complete data isolation; use logged-out and unverified users to confirm `401` and `403` responses.
10. Inspect browser storage, API responses, logs, MongoDB, OpenAPI, and Postman examples for accidental plaintext secrets or durable access tokens.

## Open questions

None. The approved scope and architecture decisions are implemented for review.
