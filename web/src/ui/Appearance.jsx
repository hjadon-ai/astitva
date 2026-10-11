import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, X } from 'lucide-react';
import { normalizeAppearance, readAppearance, writeAppearance } from './appearancePreferences';

const AppearanceContext = createContext(null);

export function AppearanceProvider({ children }) {
  const [appearance, setAppearance] = useState(() => {
    try { return readAppearance(window.localStorage); }
    catch { return normalizeAppearance(null); }
  });
  useEffect(() => {
    try { writeAppearance(window.localStorage, appearance); }
    catch { /* Access to localStorage itself can be denied. */ }
  }, [appearance]);
  return <AppearanceContext.Provider value={{ appearance, setAppearance }}>{children}</AppearanceContext.Provider>;
}

// Activate document-level scope only while the authenticated shell is mounted.
// Portal dialogs inherit this scope without replacing any feature component.
export function useAppearanceScope() {
  const { appearance } = useContext(AppearanceContext);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = appearance.layout;
    root.dataset.immersiveTheme = appearance.theme;
    return () => {
      delete root.dataset.appearance;
      delete root.dataset.immersiveTheme;
    };
  }, [appearance.layout, appearance.theme]);
  return appearance;
}

export function AppearanceSurface({ as: Element = 'section', className = '', children, ...props }) {
  return <Element className={`appearance-surface ${className}`} {...props}>{children}</Element>;
}

function AppearanceDialog({ onClose }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      requestAnimationFrame(() => {
        // A layout switch can hide the opener. Return to a visible shell control.
        const candidates = [opener, ...document.querySelectorAll('.appearance-trigger, [data-appearance-return]')];
        candidates.find(element => element?.isConnected && element.getClientRects().length && !element.closest('[inert]'))?.focus();
      });
    };
  }, []);
  return createPortal(
    <dialog ref={ref} className="appearance-dialog appearance-surface" aria-labelledby="appearance-title"
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
      onCancel={onClose} onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <div className="appearance-heading"><h2 id="appearance-title">Appearance</h2>
        <button type="button" className="appearance-close" aria-label="Close appearance" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </div>
      <AppearanceSettings />
    </dialog>, document.body);
}

export function AppearanceControl({ compact = false }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className={`button button-quiet appearance-trigger${compact ? ' appearance-trigger-compact' : ''}`} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <Palette size={18} aria-hidden="true" /><span>Appearance</span>
    </button>
    {open && <AppearanceDialog onClose={() => setOpen(false)} />}
  </>;
}

export function AppearanceSettings() {
  const { appearance, setAppearance } = useContext(AppearanceContext);
  const change = (key, value) => setAppearance(current => ({ ...current, [key]: value }));
  return <div className="appearance-settings">
      <fieldset><legend>Layout</legend>
        {['original', 'immersive'].map(layout => <label key={layout}>
          <input type="radio" name="appearance-layout" value={layout} checked={appearance.layout === layout} onChange={() => change('layout', layout)} />
          {layout === 'original' ? 'Original' : 'Immersive'}
        </label>)}
      </fieldset>
      <fieldset disabled={appearance.layout === 'original'} aria-describedby="appearance-theme-help"><legend>Immersive theme</legend>
        {['day', 'night'].map(theme => <label key={theme}>
          <input type="radio" name="appearance-theme" value={theme} checked={appearance.theme === theme} onChange={() => change('theme', theme)} />
          {theme === 'day' ? 'Day' : 'Night'}
        </label>)}
      </fieldset>
      <p id="appearance-theme-help">{appearance.layout === 'original' ? 'Themes apply only to Immersive. Your choice is remembered.' : 'Your appearance is saved in this browser.'}</p>
      {appearance.layout === 'immersive' && <AppearanceSurface className="appearance-preview">
        <strong>{appearance.theme === 'day' ? 'Day' : 'Night'} palette</strong>
        <p>Your layout and theme apply immediately and are remembered in this browser.</p>
      </AppearanceSurface>}
  </div>;
}
