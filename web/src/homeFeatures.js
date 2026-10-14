export function homeFeatures(features, runtime) {
  const grants = features || {};
  return {
    family: grants.family === true,
    tools: [
      { id: 'diet', title: 'Diet', description: 'Keep your meals and daily targets together.' },
      { id: 'finance', title: 'Finance', description: 'Review your connected accounts in your private workspace.' }
    ].filter(tool => grants[tool.id] === true).map(tool => ({ ...tool, available: tool.id !== 'finance' || runtime?.financeProvider?.enabled === true }))
  };
}
