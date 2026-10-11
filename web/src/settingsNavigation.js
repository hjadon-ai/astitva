export function settingsSections(user) {
  return [
    { id: 'appearance', label: 'Appearance' },
    ...(user.features?.diet && user.features?.mcp ? [{ id: 'connections', label: 'Connections' }] : []),
    ...(user.isAdmin ? [{ id: 'admin', label: 'Admin' }] : [])
  ];
}

export function settingsSection(hash, user) {
  const [destination, query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const requested = params.get('section') || (params.has('mcp_request') ? 'connections' : destination === 'admin' ? 'admin' : 'appearance');
  return settingsSections(user).some(section => section.id === requested) ? requested : 'appearance';
}

export function settingsHref(section, hash) {
  const params = new URLSearchParams(hash.split('?')[1] || '');
  params.set('section', section);
  return '/#settings?' + params.toString();
}
