import { forwardRef, useEffect, useRef, useState } from 'react';
import { ListChecks, Home, LogOut, Menu, UsersRound, Utensils, WalletCards, X } from 'lucide-react';

const classes = (...values) => values.filter(Boolean).join(' ');

export const Button = forwardRef(function Button({ variant = 'secondary', icon: Icon, className, children, ...props }, ref) {
  return (
    <button ref={ref} className={classes('button', `button-${variant}`, className)} {...props}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ label, icon: Icon, className, ...props }, ref) {
  return (
    <button ref={ref} className={classes('icon-button', className)} aria-label={label} title={label} {...props}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
});

export function Surface({ as: Element = 'section', className, children, ...props }) {
  return <Element className={classes('surface', className)} {...props}>{children}</Element>;
}

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={classes('page-header', className)}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, helper, icon: Icon, accent = 'blue', className }) {
  return (
    <Surface className={classes('stat-card', `accent-${accent}`, className)}>
      <div className="stat-card-top">
        <span>{label}</span>
        {Icon && <span className="stat-icon"><Icon size={20} aria-hidden="true" /></span>}
      </div>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </Surface>
  );
}

export function FormField({ label, hint, error, children }) {
  return (
    <label className={classes('form-field', error && 'has-error')}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={classes('badge', `badge-${tone}`)}>{children}</span>;
}

export function StatusBanner({ tone = 'info', children, role }) {
  return <div className={classes('status-banner', `status-${tone}`)} role={role}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <span className="empty-icon"><Icon size={24} aria-hidden="true" /></span>}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ children = 'Loading…' }) {
  return <div className="loading-state" role="status"><span aria-hidden="true" />{children}</div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel, busy, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    cancelRef.current?.focus();
    return () => previousFocus.current?.focus?.();
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <div ref={dialogRef} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="dialog-actions">
          <Button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="danger" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function EnvironmentBanner({ runtime }) {
  if (!runtime) return null;
  const production = runtime.environment === 'production';
  const stage = runtime.environment === 'stage';
  return (
    <div className={classes('environment-banner', production ? 'production' : stage ? 'stage' : 'dev')} role="status">
      {production ? 'PRODUCTION · CLOUD DATA · PLAID PRODUCTION' : stage ? 'STAGE · PLAID PRODUCTION · REAL FINANCIAL DATA' : 'DEV · PLAID SANDBOX · FAKE FINANCIAL DATA'}
    </div>
  );
}

const navigation = [
  { id: 'profile', label: 'Overview', icon: Home },
  { id: 'priorities', label: 'Daily Priorities', icon: ListChecks },
  { id: 'diet', label: 'Diet', icon: Utensils },
  { id: 'finance', label: 'Finance', icon: WalletCards },
  { id: 'family', label: 'Family', icon: UsersRound }
];

export function AppShell({ page, user, runtime, onLogout, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);
  const closeRef = useRef(null);
  const closeDrawer = () => {
    setDrawerOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  };

  useEffect(() => {
    if (!drawerOpen) return undefined;
    closeRef.current?.focus();
    const close = (event) => { if (event.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawerOpen]);

  const nav = (
    <>
      <div className="sidebar-heading">Workspace</div>
      <nav aria-label="Workspace navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <a key={id} className={page === id ? 'active' : ''} href={`#${id}`} aria-current={page === id ? 'page' : undefined} onClick={() => { if (drawerOpen) closeDrawer(); }}>
            <Icon size={19} aria-hidden="true" /><span>{label}</span>
          </a>
        ))}
      </nav>
    </>
  );

  return (
    <div className="app-frame">
      <EnvironmentBanner runtime={runtime} />
      <header className="mobile-header">
        <a className="brand" href="#profile">Astitva<span>.</span></a>
        <span>{navigation.find((item) => item.id === page)?.label}</span>
        <IconButton ref={menuRef} label="Open navigation" icon={Menu} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} />
      </header>
      <aside className="app-sidebar">
        <a className="brand" href="#profile">Astitva<span>.</span></a>
        {nav}
        <div className="sidebar-account">
          <span className="avatar avatar-small" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>Local account</small></div>
        </div>
        <Button variant="quiet" icon={LogOut} className="sidebar-logout" type="button" onClick={onLogout}>Log out</Button>
      </aside>
      {drawerOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
        <aside className="mobile-drawer" aria-label="Mobile navigation">
          <div className="drawer-header"><a className="brand" href="#profile" onClick={closeDrawer}>Astitva<span>.</span></a><IconButton ref={closeRef} label="Close navigation" icon={X} onClick={closeDrawer} /></div>
          {nav}
          <div className="sidebar-account"><span className="avatar avatar-small" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><small>Local account</small></div></div>
          <Button variant="quiet" icon={LogOut} className="sidebar-logout" type="button" onClick={onLogout}>Log out</Button>
        </aside>
      </div>}
      <main className="app-main">{children}</main>
    </div>
  );
}
