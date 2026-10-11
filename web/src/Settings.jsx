import { useEffect, useState } from 'react';
import { PageHeader, Surface } from './ui';
import { AppearanceSettings } from './ui/Appearance';
import ConnectedAssistants from './ConnectedAssistants';
import Admin from './Admin';
import { settingsSections, settingsSection, settingsHref } from './settingsNavigation';
import './settings.css';

export default function Settings({ user, runtime, apiRequest, onLogout, onExpired, onUserRefresh }) {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const section = settingsSection(hash, user);
  const sections = settingsSections(user);
  return <section className="settings-page" aria-label="Account settings">
    <PageHeader title="Settings" description="Your appearance, connected assistants and administration." />
    <nav className="settings-sections" aria-label="Settings sections">
      {sections.map(item => <a key={item.id} href={settingsHref(item.id, hash)} aria-current={section === item.id ? 'page' : undefined}>{item.label}</a>)}
    </nav>
    <Surface className="settings-content" aria-label={sections.find(item => item.id === section).label}>
      {section === 'appearance' ? <AppearanceSettings /> : section === 'connections' ? <ConnectedAssistants embedded apiRequest={apiRequest} /> :
        <Admin embedded user={user} runtime={runtime} apiRequest={apiRequest} onLogout={onLogout} onExpired={onExpired} onUserRefresh={onUserRefresh} />}
    </Surface>
  </section>;
}
