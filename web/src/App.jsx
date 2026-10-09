import { readApiJson } from './apiResponse';
import { useSharedWorkspace } from './SharedWorkspace.jsx';
import SignedInHome, { PublicHomeIntro, PublicHomeSections } from './HomeContent';
import { disableWebNotifications, setWebNotificationsAllowed } from './webNotifications';
import { useEffect, useState } from 'react';
import { ArrowLeft, LogIn, Mail, UserPlus } from 'lucide-react';
import Diet from './Diet';
import Priorities from './Priorities';
import Finance from './Finance';
import Family from './Family';
import Chat from './Chat';
import Admin from './Admin';
import { AppShell, Button, EnvironmentBanner, FormField, LoadingState } from './ui';
import { version as webVersion } from '../package.json';

const emptyForm = { name: '', email: '', password: '' };
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const sessionKey = `astitva_session_token:${apiBaseUrl}`;
let activeSessionToken;
try { activeSessionToken = window.sessionStorage.getItem(sessionKey); } catch { activeSessionToken = null; }

function setSessionToken(token) {
  activeSessionToken = token || null;
  try {
    if (activeSessionToken) window.sessionStorage.setItem(sessionKey, activeSessionToken);
    else window.sessionStorage.removeItem(sessionKey);
  } catch { /* The current tab can continue while browser storage is unavailable. */ }
}

async function apiRequest(path, options = {}) {
  const formData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !formData ? { 'Content-Type': 'application/json' } : {}),
      ...(activeSessionToken && path !== '/api/auth/login' ? { Authorization: `Bearer ${activeSessionToken}` } : {}),
      ...options.headers
    }
  });

  if (response.status === 204) return null;
  if (response.ok && options.responseType === 'blob') return response.blob();
  const body = await readApiJson(response, path);
  if (!response.ok) {
    const details = body.error;
    const error = new Error(typeof details === 'string' ? details : details?.message || 'Something went wrong.');
    error.status = response.status;
    error.code = body.code;
    error.details = body;
    if (body.retryAt) error.retryAt = body.retryAt;
    if (details && typeof details === 'object') Object.assign(error, { code: details.code, details });
    throw error;
  }
  return body;
}

function AuthPanel({ mode, onModeChange, onAuthenticated, onForgotPassword }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const body = isSignup
        ? { ...form, ...(window.location.pathname === '/family-invite' ? { familyInviteToken: new URLSearchParams(window.location.search).get('token') } : {}) }
        : { email: form.email, password: form.password };
      const result = await apiRequest(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (isSignup) {
        setMessage(result.message);
        setForm({ ...emptyForm, email: form.email });
        onModeChange('login');
      } else {
        if (result.sessionToken) setSessionToken(result.sessionToken);
        onAuthenticated(result.user);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-tabs" aria-label="Account options">
        <button
          className={!isSignup ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('login')}
        >
          Login
        </button>
        <button
          className={isSignup ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('signup')}
        >
          Sign up
        </button>
      </div>

      <p className="eyebrow">Private account</p>
      <h2 id="auth-title">{isSignup ? 'Create your profile.' : 'Welcome back.'}</h2>
      <form onSubmit={submit}>
        {isSignup && (
          <FormField label="Name">
            <input name="name" value={form.name} onChange={updateField} required maxLength="80" />
          </FormField>
        )}
        <FormField label="Email">
          <input name="email" type="email" value={form.email} onChange={updateField} required />
        </FormField>
        <FormField label="Password">
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            required
            minLength="8"
          />
        </FormField>
        {!isSignup && (
          <button className="text-action" type="button" onClick={onForgotPassword}>
            Forgot password?
          </button>
        )}
        <Button variant="primary" icon={isSignup ? UserPlus : LogIn} type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Login'}
        </Button>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
    </aside>
  );
}

function ForgotPasswordPanel({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="auth-panel" aria-labelledby="forgot-password-title">
      <button className="text-action back-action" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to login</button>
      <p className="eyebrow">Account recovery</p>
      <h2 id="forgot-password-title">Reset your password.</h2>
      <p className="panel-copy">Enter your verified email address. If it is eligible, check your email for a reset link.</p>
      <form onSubmit={submit}>
        <FormField label="Email">
          <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </FormField>
        <Button variant="primary" icon={Mail} type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
    </aside>
  );
}

function VerificationResult({ token }) {
  const [state, setState] = useState({ status: 'loading', message: 'Checking your verification link…' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'This verification link is missing its token.' });
      return;
    }

    apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
      .then((result) => setState({ status: 'success', message: result.message }))
      .catch((error) => setState({ status: 'error', message: error.message }));
  }, [token]);

  return (
    <main className="verification-shell">
      <section className="verification-card">
        <p className="eyebrow">Email verification</p>
        <h1>{state.status === 'success' ? 'Email verified.' : state.status === 'error' ? 'Link not accepted.' : 'One moment.'}</h1>
        <p>{state.message}</p>
        {state.status !== 'loading' && (
          <a className="button primary link-button" href="/">Continue</a>
        )}
      </section>
    </main>
  );
}

function VerificationRequired({ user, onLogout, runtime }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setMessage('');
    try {
      const result = await apiRequest('/api/auth/resend-verification', { method: 'POST' });
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (<>
    <EnvironmentBanner runtime={runtime} />
    <main className="verification-shell verification-with-banner">
      <section className="verification-card">
        <p className="eyebrow">Verification required</p>
        <h1>Check your email, {user.name}.</h1>
        <p>
          We sent a verification link to <strong>{user.email}</strong>. Verifying confirms that
          you own this address and helps protect account recovery. Your profile will open after
          verification.
        </p>
        <div className="verification-actions">
          <Button variant="primary" icon={Mail} type="button" onClick={resend} disabled={busy}>
            {busy ? 'Sending…' : 'Resend verification email'}
          </Button>
          <Button variant="quiet" type="button" onClick={onLogout}>Log out</Button>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </section>
    </main>
  </>);
}

function ResetPassword({ token }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState({ status: 'form', message: '' });
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!token) {
      setState({ status: 'error', message: 'This reset link is missing its token.' });
      return;
    }
    if (password !== confirmation) {
      setState({ status: 'error', message: 'The passwords do not match.' });
      return;
    }

    setBusy(true);
    setState({ status: 'form', message: '' });
    try {
      const result = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      setState({ status: 'success', message: result.message });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="verification-shell">
      <section className="verification-card">
        <p className="eyebrow">Password reset</p>
        <h1>{state.status === 'success' ? 'Password changed.' : 'Choose a new password.'}</h1>
        {state.status === 'success' ? (
          <>
            <p>{state.message}</p>
            <a className="button primary link-button" href="/">Return to login</a>
          </>
        ) : (
          <form className="reset-form" onSubmit={submit}>
            <FormField label="New password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required />
            </FormField>
            <FormField label="Confirm new password">
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength="8" required />
            </FormField>
            <Button variant="primary" type="submit" disabled={busy || !token}>
              {busy ? 'Changing…' : 'Change password'}
            </Button>
            {state.message && <p className="form-message" role="status">{state.message}</p>}
          </form>
        )}
      </section>
    </main>
  );
}

function FamilyInvitation({ token, user, onAuthenticated, onLogout, runtime }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return <PublicHome onAuthenticated={onAuthenticated} runtime={runtime} />;
  if (!user.emailVerified) return <VerificationRequired user={user} onLogout={onLogout} runtime={runtime} />;
  async function accept() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/api/family/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) });
      window.location.href = '/#family';
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }
  return <main className="verification-shell"><section className="verification-card">
    <p className="eyebrow">Family invitation</p><h1>Join your family view.</h1>
    <p>Signed in as {user.email}. Accepting links your account to the invited family person. Your Diet and Finance information stays private until you choose to share it.</p>
    <div className="verification-actions"><Button variant="primary" type="button" disabled={busy || !token} onClick={accept}>{busy ? 'Accepting…' : 'Accept invitation'}</Button>
      <Button variant="quiet" type="button" onClick={onLogout}>Use another account</Button></div>
    {message && <p className="form-message" role="status">{message}</p>}
  </section></main>;
}

function PublicHome({ onAuthenticated, runtime }) {
  const [mode, setMode] = useState('login');

  return (
    <>
      <header className="site-header shell">
        <a className="brand" href="#top">Astitva<span>.</span></a>
        <nav aria-label="Main navigation">
          <a href="#families">About families</a>
          <a href="#privacy">Privacy</a>
          <Button variant="quiet" type="button" onClick={() => setMode('login')}>Login</Button>
        </nav>
      </header>

      <main id="top" className="shell">
        <section className="hero">
          <div>
            <PublicHomeIntro />
          </div>
          {mode === 'forgot-password' ? (
            <ForgotPasswordPanel onBack={() => setMode('login')} />
          ) : (
            <AuthPanel
              mode={mode}
              onModeChange={setMode}
              onAuthenticated={onAuthenticated}
              onForgotPassword={() => setMode('forgot-password')}
            />
          )}
        </section>

        <PublicHomeSections runtime={runtime} />
      </main>
      <footer className="site-footer shell" aria-label="Application versions">
        <span>Web v{webVersion}</span>
        {runtime?.version && <span>Server v{runtime.version}</span>}
      </footer>
    </>
  );
}

function Profile({ user, onLogout, runtime }) {
  const pageFromHash = () => {
    const requested = window.location.pathname === '/chat-invite' ? 'chat' : window.location.hash.slice(1).split('?')[0];
    return (user.features || { family: true })[requested] ? requested : 'profile';
  };
  const [page, setPage] = useState(pageFromHash);
  useEffect(() => {
    const change = () => setPage(pageFromHash());
    change();
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [user.features]);
  const shared = useSharedWorkspace({apiRequest,user,page});
  return (
    <AppShell page={shared.page} user={user} runtime={runtime} onLogout={onLogout} sharedModules={shared.selected ? shared.modules : undefined} workspaceControls={shared.controls}>
      {shared.notice}
      {shared.selected ? shared.content : <>
      {page === 'priorities' ? <Priorities apiRequest={apiRequest} /> : page === 'diet' ? <Diet apiRequest={apiRequest} /> : page === 'finance' ? <Finance apiRequest={apiRequest} runtime={runtime} /> : page === 'family' ? <Family apiRequest={apiRequest} features={user.features} /> : page === 'chat' ? <Chat apiRequest={apiRequest} webNotificationsEnabled={user.webNotificationsEnabled} /> : <SignedInHome user={user} runtime={runtime} />}
      </>}
    </AppShell>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([apiRequest('/api/health'), apiRequest('/api/auth/me')])
      .then(([health, authentication]) => {
        if (health.status === 'fulfilled') setRuntime(health.value);
        setUser(authentication.status === 'fulfilled' ? authentication.value.user : null);
      })
      .finally(() => setLoading(false));
  }, []);

  function expireSession() {
    disableWebNotifications(apiRequest).catch(() => {});
    setSessionToken(null);
    setUser(null);
  }

  async function refreshUser() {
    try { setUser((await apiRequest('/api/auth/me')).user); }
    catch (error) { if (error.status === 401) expireSession(); }
  }

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const result = await apiRequest('/api/auth/me');
        if (active) setUser(result.user);
      } catch (error) { if (active && error.status === 401) expireSession(); }
    };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [user?.id]);

  useEffect(() => {
    const allowed = Boolean(user?.emailVerified && user?.features?.chat && user?.webNotificationsEnabled);
    setWebNotificationsAllowed(allowed, apiRequest).catch(() => {});
    const foreground = () => { if (allowed) setWebNotificationsAllowed(true, apiRequest).catch(() => {}); };
    window.addEventListener('focus', foreground);
    return () => window.removeEventListener('focus', foreground);
  }, [user?.id, user?.emailVerified, user?.features?.chat, user?.webNotificationsEnabled]);

  async function logout() {
    await disableWebNotifications(apiRequest).catch(() => {});
    try { await apiRequest('/api/auth/logout', { method: 'POST' }); }
    finally { setSessionToken(null); setUser(null); }
  }

  const location = new URL(window.location.href);
  if (location.pathname === '/verify-email') {
    return <VerificationResult token={location.searchParams.get('token')} />;
  }
  if (location.pathname === '/reset-password') {
    return <ResetPassword token={location.searchParams.get('token')} />;
  }

  if (loading) return <div className="loading"><LoadingState>Loading Astitva…</LoadingState></div>;
  if (location.pathname === '/family-invite') {
    return <FamilyInvitation token={location.searchParams.get('token')} user={user} onAuthenticated={setUser} onLogout={logout} runtime={runtime} />;
  }
  if (!user) return <PublicHome onAuthenticated={setUser} runtime={runtime} />;
  if (!user.emailVerified) return <VerificationRequired user={user} onLogout={logout} runtime={runtime} />;
  if (location.pathname === '/admin') return <Admin user={user} runtime={runtime} onLogout={logout}
    apiRequest={apiRequest} onExpired={expireSession} onUserRefresh={refreshUser} />;
  return <Profile user={user} onLogout={logout} runtime={runtime} />;
}
