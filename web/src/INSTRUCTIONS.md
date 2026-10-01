# React source

This folder contains the React interface. Keep call sites pointed at `/api` paths. The shared request helper leaves them relative for the local Vite proxy and prepends the public `VITE_API_BASE_URL` for Production. Read safe runtime metadata from `/api/health`; never put Plaid credentials or environment switching in the browser.

Use the semantic CSS variables in `styles.css` and shared presentation components in `ui/`. Feature components keep their API calls and business state. Use Lucide as the only icon source, pair important action icons with visible text, and preserve keyboard focus and responsive behavior.

Daily Priorities sends the browser's IANA timezone with each request and keeps date navigation, drafts, mutation refreshes, and stale-response protection inside its feature component.

Diet supports JSON and multipart requests. Let the browser set the multipart boundary for `FormData`; use the shared request helper so structured F008 API errors are displayed consistently.
