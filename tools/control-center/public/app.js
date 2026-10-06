const elements = {
  categories: document.querySelector('#categories'),
  categoryCount: document.querySelector('#category-count'),
  panel: document.querySelector('#category-panel'),
  features: document.querySelector('#features'),
  featureHeading: document.querySelector('#feature-heading'),
  featureCount: document.querySelector('#feature-count'),
  running: document.querySelector('#running'),
  notice: document.querySelector('#notice'),
  dialog: document.querySelector('#review-dialog'),
  reviewId: document.querySelector('#review-id'),
  reviewTitle: document.querySelector('#review-title'),
  reviewMeta: document.querySelector('#review-meta'),
  reviewContent: document.querySelector('#review-content'),
  reviewStatus: document.querySelector('#review-status'),
  approvalFields: document.querySelector('#approval-fields'),
  reviewQuestions: document.querySelector('#review-questions'),
  approvalComment: document.querySelector('#approval-comment'),
  recommend: document.querySelector('#recommend'),
  approve: document.querySelector('#approve'),
};
let state;
let selectedCategory = 'development';
let developmentData;
let developmentFilter = 'All';
let developmentHistory = { evaluations: [], nextCursor: null };
let evaluationBusy = false;
let selectedFeature = null;

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function statusClass(status) {
  return `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function notify(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle('error', isError);
  elements.notice.hidden = false;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state?.token ? { 'X-Control-Token': state.token } : {}), ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

async function refresh() {
  [state, developmentData] = await Promise.all([request('/api/state'), request('/api/development/state')]);
  if (selectedCategory !== 'development' && !state.categories.some((category) => category.slug === selectedCategory)) selectedCategory = state.categories[0]?.slug;
  if (selectedCategory === 'development') {
    try { developmentHistory = await request('/api/development/evaluations'); }
    catch { developmentHistory = { evaluations: [], nextCursor: null }; }
  }
  render();
}

function render() {
  elements.running.textContent = state.runningJob ? `Generating: ${state.runningJob}` : `${state.categories.filter((item) => item.enabled).length} active scheduler(s)`;
  elements.categoryCount.textContent = String(state.categories.length);
  elements.categories.replaceChildren();
  for (const category of state.categories) {
    const button = node('button', `category ${category.slug === selectedCategory ? 'active' : ''}`);
    button.type = 'button';
    button.append(node('span', '', category.name), node('small', '', String(category.features.length)));
    button.addEventListener('click', () => { selectedCategory = category.slug; render(); });
    elements.categories.append(button);
  }
  document.querySelector('#development-nav').classList.toggle('active', selectedCategory === 'development');
  if (selectedCategory === 'development') document.querySelector('#development-nav').setAttribute('aria-current', 'page');
  else document.querySelector('#development-nav').removeAttribute('aria-current');
  if (selectedCategory === 'development') { renderDevelopment(); return; }
  const category = state.categories.find((item) => item.slug === selectedCategory);
  if (!category) return;
  renderCategory(category);
  renderFeatures(category);
}

function renderCategory(category) {
  elements.panel.replaceChildren();
  const head = node('div', 'panel-head');
  const title = node('div');
  title.append(node('p', 'eyebrow', 'CATEGORY SCHEDULER'), node('h2', '', category.name), node('p', 'muted', `Proposals are saved in docs/features/${category.slug}/.`));
  head.append(title, node('span', `badge ${category.enabled ? 'active' : ''}`, category.enabled ? 'Scheduled' : 'Paused'));
  const fields = node('div', 'schedule-fields');
  const intervalLabel = node('label', '', 'Every (minutes)');
  const interval = node('input'); interval.type = 'number'; interval.min = '5'; interval.max = '1440'; interval.value = String(category.intervalMinutes);
  intervalLabel.append(interval);
  const countLabel = node('label', '', 'Features per run');
  const count = node('input'); count.type = 'number'; count.min = '1'; count.max = '5'; count.value = String(category.featuresPerRun);
  countLabel.append(count);
  fields.append(intervalLabel, countLabel);
  const actions = node('div', 'schedule-actions');
  const start = node('button', category.enabled ? 'danger' : '', category.enabled ? 'Pause schedule' : 'Start schedule');
  start.type = 'button';
  start.addEventListener('click', async () => {
    try {
      await request(`/api/categories/${category.slug}/schedule`, { method: 'POST', body: JSON.stringify({ action: category.enabled ? 'pause' : 'start', intervalMinutes: Number(interval.value), featuresPerRun: Number(count.value) }) });
      notify(category.enabled ? `${category.name} schedule paused.` : `${category.name} schedule started.`);
      await refresh();
    } catch (cause) { notify(cause.message, true); }
  });
  const run = node('button', 'secondary', 'Run now');
  run.type = 'button'; run.disabled = Boolean(state.runningJob);
  run.addEventListener('click', async () => {
    try { await request(`/api/categories/${category.slug}/run`, { method: 'POST', body: '{}' }); notify(`Generating ${category.name} proposals. Refresh to see progress.`); await refresh(); }
    catch (cause) { notify(cause.message, true); }
  });
  actions.append(start, run);
  const meta = node('div', 'schedule-meta');
  meta.append(node('div', '', `Next run: ${category.nextRunAt ? new Date(category.nextRunAt).toLocaleString() : 'Not scheduled'}`));
  meta.append(node('div', '', `Last result: ${category.lastStatus || 'No runs from this control center yet'}`));
  if (category.lastOutput && category.lastStatus?.startsWith('Failed')) meta.append(node('pre', '', category.lastOutput));
  elements.panel.append(head, fields, actions, meta);
}

function renderFeatures(category) {
  elements.featureHeading.textContent = `${category.name} features`;
  elements.featureCount.textContent = `${category.features.length} feature(s)`;
  elements.features.replaceChildren();
  if (!category.features.length) { elements.features.append(node('div', 'empty', 'No feature documents in this category yet.')); return; }
  for (const feature of [...category.features].sort((a, b) => b.id.localeCompare(a.id))) {
    const card = node('article', 'feature-card');
    const details = node('div');
    const top = node('div', 'feature-top');
    top.append(node('strong', '', feature.id), node('h3', '', feature.title), node('span', `badge ${statusClass(feature.status)}`, feature.status));
    details.append(top, node('p', '', feature.path));
    const review = node('button', 'secondary', 'Review');
    review.type = 'button'; review.addEventListener('click', () => openFeature(feature.id));
    card.append(details, review);
    elements.features.append(card);
  }
}

async function openFeature(id, readOnly = false) {
  try {
    const feature = await request(`/api/features/${id}`);
    selectedFeature = feature;
    elements.reviewId.textContent = feature.id;
    elements.reviewTitle.textContent = feature.title;
    elements.reviewMeta.textContent = feature.path;
    elements.reviewContent.textContent = feature.content;
    elements.reviewStatus.textContent = feature.status;
    elements.reviewStatus.className = `badge ${statusClass(feature.status)}`;
    const canApprove = !readOnly && feature.status === 'Proposed' && feature.documentStatus === 'Proposed';
    elements.approvalFields.hidden = !canApprove;
    elements.recommend.hidden = !canApprove;
    elements.approve.hidden = !canApprove;
    elements.reviewQuestions.replaceChildren();
    elements.approvalComment.value = '';
    if (canApprove && feature.openQuestions.length) {
      elements.reviewQuestions.append(node('h3', '', 'Answer open questions'));
      feature.openQuestions.forEach((question, index) => {
        const label = node('label', '', `${index + 1}. ${question}`);
        const input = node('textarea', 'question-answer');
        input.rows = 3;
        input.maxLength = 1500;
        input.required = true;
        label.append(input);
        elements.reviewQuestions.append(label);
      });
    }
    elements.dialog.showModal();
  } catch (cause) { notify(cause.message, true); }
}

document.querySelector('#development-nav').addEventListener('click', () => { selectedCategory = 'development'; refresh().catch(cause => notify(cause.message, true)); });

document.querySelector('#close-review').addEventListener('click', () => elements.dialog.close());
document.querySelector('#refresh').addEventListener('click', () => refresh().catch((cause) => notify(cause.message, true)));
document.querySelector('#new-category').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#category-name');
  try {
    const result = await request('/api/categories', { method: 'POST', body: JSON.stringify({ name: input.value }) });
    selectedCategory = result.slug;
    input.value = '';
    notify(`Category ${result.slug} created.`);
    await refresh();
  } catch (cause) { notify(cause.message, true); }
});
elements.approve.addEventListener('click', async () => {
  if (!selectedFeature) return;
  const inputs = [...elements.reviewQuestions.querySelectorAll('textarea')];
  const missing = inputs.find((input) => !input.value.trim());
  if (missing) { missing.focus(); notify('Answer every open question before approval.', true); return; }
  if (!window.confirm(`Approve ${selectedFeature.id}: ${selectedFeature.title}?`)) return;
  try {
    await request(`/api/features/${selectedFeature.id}/approve`, { method: 'POST', body: JSON.stringify({ answers: inputs.map((input) => input.value.trim()), comment: elements.approvalComment.value.trim() }) });
    elements.dialog.close();
    notify(`${selectedFeature.id} approved. Document and feature index updated.`);
    await refresh();
  } catch (cause) { notify(cause.message, true); }
});

elements.recommend.addEventListener('click', async () => {
  if (!selectedFeature) return;
  const feedback = elements.approvalComment.value.trim();
  if (!feedback) { elements.approvalComment.focus(); notify('Add feedback for the new proposal.', true); return; }
  if (!window.confirm(`Recommend a new proposal instead of approving ${selectedFeature.id}?`)) return;
  try {
    await request(`/api/features/${selectedFeature.id}/recommend`, { method: 'POST', body: JSON.stringify({ feedback }) });
    elements.dialog.close();
    notify(`${selectedFeature.id} sent back with feedback. The next proposal run can use it.`);
    await refresh();
  } catch (cause) { notify(cause.message, true); }
});

refresh().catch((cause) => notify(cause.message, true));
setInterval(() => {
  const scheduleActive = state?.runningJob || state?.categories.some((category) => category.enabled);
  const editing = document.activeElement?.tagName === 'INPUT';
  if (!elements.dialog.open && !editing && scheduleActive) refresh().catch(() => {});
}, 10000);


function localTime(value) {
  if (value && !Number.isFinite(Date.parse(value))) return 'Invalid timestamp';
  return value ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' Pacific' : 'Never evaluated';
}

function actionText(action) {
  return ({ would_start: 'Would start', would_resume: 'Would resume', blocked: 'Human action required', none: 'No eligible work' })[action] || 'Not evaluated';
}

function reasonText(reason) {
  return `${reason.forFeatureId || reason.featureId || ''} ${reason.message}${reason.file ? ` (${reason.file}:${reason.line || ''})` : ''}${reason.rule ? ` — ${reason.rule}` : ''}`.trim();
}

function renderDevelopment() {
  const data = developmentData;
  const plan = data.currentPlan;
  const last = data.lastEvaluation;
  const decision = last?.decision;
  elements.running.textContent = 'Dry run only • Execution disabled';
  elements.panel.replaceChildren();
  const head = node('div', 'panel-head');
  const title = node('div');
  title.append(node('p', 'eyebrow', 'MANUAL PLANNING'), node('h2', '', 'Development'), node('p', 'muted', 'Evaluate a plan. No AI, tests, implementation or Git actions run.'));
  const evaluate = node('button', '', evaluationBusy ? 'Evaluating…' : 'Evaluate dry run');
  evaluate.type = 'button'; evaluate.disabled = evaluationBusy || Boolean(state.runningJob) || data.health.status === 'degraded';
  evaluate.addEventListener('click', async () => {
    evaluationBusy = true; evaluate.disabled = true; evaluate.textContent = 'Evaluating…';
    try { const result = await request('/api/development/evaluations', { method: 'POST', body: '{}' }); notify(`${actionText(result.decision.action)}. Dry-run result recorded; nothing executed.`); }
    catch (cause) { notify(cause.message, true); }
    finally { evaluationBusy = false; await refresh().catch(cause => notify(cause.message, true)); if (selectedCategory === 'development') elements.panel.querySelector('button')?.focus(); }
  });
  head.append(title, evaluate);
  const health = node('p', `development-health ${data.health.status === 'healthy' ? '' : 'warning'}`, `Planning ${data.health.status} • Last evaluation: ${localTime(last?.evaluatedAt)}`);
  if (data.stale) health.append(node('span', '', ' • Evaluate again: source changed, result is older than one day, or no evaluation exists.'));
  const questions = node('div', 'development-questions');
  function question(label, answer, details) {
    const card = node('section', 'development-question');
    card.append(node('h3', '', label), node('p', 'development-answer', answer));
    if (details) card.append(node('p', 'muted', details));
    questions.append(card);
  }
  const chosen = plan.features.find(f => f.id === decision?.featureId);
  question('What would AI work on next?', decision ? `${actionText(decision.action)}${decision.featureId ? `: ${decision.featureId}${chosen ? ` — ${chosen.title}` : ''}` : ''}` : 'Evaluate to see a recorded decision', plan.resumeFeatureId ? `${plan.resumeFeatureId} is In Progress. It must be resumed or reconciled before another feature starts.` : 'Only explicitly Approved, eligible features can be selected.');
  question('Why was that feature selected?', decision?.explanation || 'No evaluation recorded.', data.stale && last ? 'This is the previous recorded decision. Evaluate again before relying on it.' : null);
  question('When is the next planned automation window?', localTime(data.schedule.nextImplementationAt), 'Planned only; scheduling and execution are disabled.');
  const blocked = plan.features.filter(f => f.eligibility === 'blocked');
  question('What is blocked and why?', `${blocked.length} feature(s); ${plan.requiredHumanActions.filter(a => a.code.startsWith('workflow_')).length} workflow issue(s)`, 'Reasons appear below. A blocked plan does not change feature status.');
  const actions = node('section', 'development-actions');
  actions.append(node('h3', '', 'What requires my action?'));
  const list = node('ul');
  for (const action of data.requiredHumanActions) list.append(node('li', '', reasonText(action)));
  if (!data.requiredHumanActions.length) list.append(node('li', '', 'No required human actions.'));
  actions.append(list);
  const times = node('div', 'schedule-meta');
  times.append(node('div', '', 'Implementation planned: 12:00 AM, 4:00 AM, 12:00 PM, 4:00 PM Pacific'), node('div', '', `Previous planned window: ${localTime(data.schedule.previousImplementationAt)}`), node('div', '', `Quality planned: 8:00 AM Pacific — next ${localTime(data.schedule.nextQualityAt)}`), node('div', '', 'Agent activity: Not run • Tests: Not run • Scheduling: Disabled'));
  elements.panel.append(head, health, questions, actions, times);
  elements.featureHeading.textContent = 'Feature readiness';
  elements.featureCount.textContent = `${plan.features.length} feature(s)`;
  elements.features.replaceChildren();
  const filters = node('div', 'development-filters');
  for (const label of ['All', 'Approved', 'In Progress', 'Blocked', 'Review', 'Other']) {
    const button = node('button', 'secondary', label); button.type = 'button'; button.setAttribute('aria-pressed', String(developmentFilter === label));
    button.addEventListener('click', () => { developmentFilter = label; renderDevelopment(); [...elements.features.querySelectorAll('.development-filters button')].find(b => b.textContent === label)?.focus(); }); filters.append(button);
  }
  elements.features.append(filters);
  const shown = plan.features.filter(f => developmentFilter === 'All' || (developmentFilter === 'Blocked' ? f.status === 'Blocked' || f.eligibility === 'blocked' : developmentFilter === 'Other' ? !['Approved', 'In Progress', 'Blocked', 'Review'].includes(f.status) : f.status === developmentFilter));
  for (const feature of shown) {
    const card = node('article', 'feature-card development-feature');
    const details = node('div');
    const top = node('div', 'feature-top'); top.append(node('strong', '', feature.id), node('h3', '', feature.title), node('span', `badge ${statusClass(feature.status)}`, feature.status));
    details.append(top, node('p', '', `Priority: ${feature.priority || 'Missing'} • Approved: ${feature.approvedAt ? localTime(feature.approvedAt) : 'Missing'} • Dependencies: ${feature.dependsOn === null ? 'Missing / invalid' : feature.dependsOn.join(', ') || 'None'}`), node('p', '', `Planning: ${feature.eligibility}`));
    for (const reason of feature.reasons) details.append(node('p', 'development-blocker', reasonText(reason)));
    const review = node('button', 'secondary', 'View document'); review.type = 'button'; review.addEventListener('click', () => openFeature(feature.id, true));
    card.append(details, review); elements.features.append(card);
  }
  if (!shown.length) elements.features.append(node('div', 'empty', 'No features in this view.'));
  const history = node('section', 'development-history'); history.append(node('h3', '', 'Recent dry-run evaluations'));
  if (!developmentHistory.evaluations.length) history.append(node('p', 'muted', 'No retained evaluations.'));
  for (const run of developmentHistory.evaluations) {
    const entry = node('div', 'development-history-row');
    entry.append(node('span', '', `${localTime(run.evaluatedAt)} • ${actionText(run.decision.action)} ${run.decision.featureId || ''}`));
    const button = node('button', 'secondary', 'View evaluation'); button.type = 'button';
    button.addEventListener('click', async () => {
      try {
        const detail = await request(`/api/development/evaluations/${run.runId}`);
        const dialog = document.querySelector('#evaluation-dialog');
        document.querySelector('#evaluation-detail').textContent = JSON.stringify(detail, null, 2);
        dialog.showModal(); document.querySelector('#close-evaluation').focus();
      } catch (cause) { notify(cause.message, true); }
    }); entry.append(button); history.append(entry);
  }
  if (developmentHistory.nextCursor) {
    const more = node('button', 'secondary', 'Load older evaluations'); more.type = 'button';
    more.addEventListener('click', async () => { more.disabled = true; try { const page = await request(`/api/development/evaluations?before=${encodeURIComponent(developmentHistory.nextCursor)}`); developmentHistory = { evaluations: [...developmentHistory.evaluations, ...page.evaluations], nextCursor: page.nextCursor }; renderDevelopment(); } catch (cause) { more.disabled = false; notify(cause.message, true); } }); history.append(more);
  }
  elements.features.append(history);
}

document.querySelector('#close-evaluation').addEventListener('click', () => document.querySelector('#evaluation-dialog').close());
