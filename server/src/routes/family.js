const crypto = require('crypto');
const express = require('express');
const Session = require('../models/Session');
const User = require('../models/User');
const { Family, FamilyInvitation } = require('../models/Family');
const { Meal, Targets, fields } = require('../models/Diet');
const { FinanceAccount, FinanceTransaction, FinanceHolding } = require('../models/Finance');
const { getRuntimeConfig } = require('../config/runtime');
const { sendFamilyInvitationEmail } = require('../services/email');
const { createRateLimit } = require('../middleware/security');

const router = express.Router();
const objectId = (value) => /^[a-f0-9]{24}$/i.test(value || '');
const same = (a, b) => String(a) === String(b);
const name = (value) => typeof value === 'string' ? value.trim() : '';
const email = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const genders = ['male', 'female', 'neutral'];
const labels = {
  father: ['parent', 'male'], mother: ['parent', 'female'], parent: ['parent', 'neutral'],
  brother: ['sibling', 'male'], sister: ['sibling', 'female'], sibling: ['sibling', 'neutral'],
  husband: ['partner', 'male'], wife: ['partner', 'female'], partner: ['partner', 'neutral'],
  son: ['child', 'male'], daughter: ['child', 'female'], child: ['child', 'neutral']
};
const labelFor = (kind, gender) => ({
  parent: { male: 'Father', female: 'Mother', neutral: 'Parent' },
  sibling: { male: 'Brother', female: 'Sister', neutral: 'Sibling' },
  partner: { male: 'Husband', female: 'Wife', neutral: 'Partner' },
  child: { male: 'Son', female: 'Daughter', neutral: 'Child' }
})[kind][gender];

router.use(async (request, response, next) => {
  const token = request.cookies[getRuntimeConfig().sessionCookieName];
  if (typeof token !== 'string') return response.status(401).json({ error: 'Authentication required.' });
  const session = await Session.findOne({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() }
  }).populate('userId');
  if (!session?.userId) return response.status(401).json({ error: 'Authentication required.' });
  if (!session.userId.emailVerifiedAt) return response.status(403).json({ error: 'Email verification required.' });
  request.familyUser = session.userId;
  next();
});

const acceptedPerson = (family, userId) => family.people.find((person) =>
  person.status === 'ACCEPTED' && person.userId && same(person.userId, userId));
const canWrite = (person) => ['ADMIN', 'EDITOR'].includes(person.role);
const publicPerson = (person) => ({
  id: String(person._id), name: person.name, email: person.email,
  gender: person.gender, role: person.role, status: person.status,
  userId: person.userId ? String(person.userId) : null
});
function familyView(family, viewer) {
  const connections = family.relations.flatMap((relation) => {
    const isFrom = same(relation.from, viewer._id);
    const isTo = same(relation.to, viewer._id);
    if (!isFrom && !isTo) return [];
    const other = family.people.id(isFrom ? relation.to : relation.from);
    if (!other) return [];
    const kind = relation.type === 'parent' ? (isFrom ? 'child' : 'parent') : relation.type;
    return [{ relationId: String(relation._id), person: publicPerson(other),
      group: kind === 'parent' || kind === 'sibling' ? 'bornIn' : 'spouse',
      label: labelFor(kind, other.gender) }];
  });
  return {
    id: String(family._id), creatorId: String(family.creatorId),
    creatorName: family.people.find((person) => same(person.userId, family.creatorId))?.name || 'Family',
    self: publicPerson(viewer), connections,
    acceptedMembers: family.people.filter((person) => person.status === 'ACCEPTED' && person.userId)
      .map(publicPerson),
    myShares: family.shares.filter((share) => same(share.ownerId, viewer.userId))
      .map((share) => ({ feature: share.feature, recipientId: String(share.recipientId) })),
    sharedWithMe: family.shares.filter((share) => same(share.recipientId, viewer.userId))
      .map((share) => ({ feature: share.feature, ownerId: String(share.ownerId) }))
  };
}
async function memberFamily(request, response) {
  if (!objectId(request.params.familyId)) {
    response.status(404).json({ error: 'Family not found.' });
    return null;
  }
  const family = await Family.findById(request.params.familyId);
  const viewer = family && acceptedPerson(family, request.familyUser._id);
  if (!viewer) {
    response.status(404).json({ error: 'Family not found.' });
    return null;
  }
  return { family, viewer };
}
function reject(response, message, status = 400) { return response.status(status).json({ error: message }); }

async function pruneDisconnected(family) {
  const creator = acceptedPerson(family, family.creatorId);
  const connected = new Set([String(creator._id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of family.relations) {
      const from = String(edge.from);
      const to = String(edge.to);
      if (connected.has(from) && !connected.has(to)) { connected.add(to); changed = true; }
      if (connected.has(to) && !connected.has(from)) { connected.add(from); changed = true; }
    }
  }
  const removed = family.people.filter((person) => !connected.has(String(person._id)));
  if (!removed.length) return;
  const removedUsers = new Set(removed.filter((person) => person.userId).map((person) => String(person.userId)));
  await FamilyInvitation.deleteMany({ familyId: family._id, personId: { $in: removed.map((person) => person._id) } });
  family.people = family.people.filter((person) => connected.has(String(person._id)));
  family.relations = family.relations.filter((edge) => connected.has(String(edge.from)) && connected.has(String(edge.to)));
  family.shares = family.shares.filter((share) => !removedUsers.has(String(share.ownerId)) &&
    !removedUsers.has(String(share.recipientId)));
}

router.get('/', async (request, response) => {
  const families = await Family.find({ 'people.userId': request.familyUser._id });
  response.json({ families: families.map((family) => familyView(family, acceptedPerson(family, request.familyUser._id)))
    .sort((a, b) => b.connections.length - a.connections.length) });
});

router.get('/invitations', async (request, response) => {
  const invitations = await FamilyInvitation.find({ email: request.familyUser.email,
    expiresAt: { $gt: new Date() } }).lean();
  const families = await Family.find({ _id: { $in: invitations.map((invitation) => invitation.familyId) } });
  const byId = new Map(families.map((family) => [String(family._id), family]));
  response.json({ invitations: invitations.flatMap((invitation) => {
    const family = byId.get(String(invitation.familyId));
    const person = family?.people.id(invitation.personId);
    const creator = family?.people.find((entry) => same(entry.userId, family.creatorId));
    if (!person || person.status !== 'PENDING' || person.userId || person.email !== request.familyUser.email ||
        family.people.some((entry) => entry.userId && same(entry.userId, request.familyUser._id))) return [];
    return [{ id: String(invitation._id), from: creator?.name || 'A family member',
      personName: person.name, expiresAt: invitation.expiresAt }];
  }) });
});

router.post('/', async (request, response) => {
  const existing = await Family.exists({ 'people.userId': request.familyUser._id });
  if (existing) return reject(response, 'Use your existing family to add relatives.', 409);
  const gender = request.body?.gender || 'neutral';
  if (!genders.includes(gender)) return reject(response, 'Choose male, female, or neutral.');
  const family = await Family.create({
    creatorId: request.familyUser._id,
    people: [{ name: request.familyUser.name, email: request.familyUser.email,
      userId: request.familyUser._id, status: 'ACCEPTED', role: 'ADMIN', gender }]
  });
  response.status(201).json({ family: familyView(family, family.people[0]) });
});

router.get('/:familyId', async (request, response) => {
  const context = await memberFamily(request, response);
  if (context) response.json({ family: familyView(context.family, context.viewer) });
});

router.patch('/:familyId/self', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  if (!genders.includes(request.body?.gender)) return reject(response, 'Choose male, female, or neutral.');
  context.viewer.gender = request.body.gender;
  await context.family.save();
  response.json({ family: familyView(context.family, context.viewer) });
});

router.post('/:familyId/people', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  if (!canWrite(viewer)) return reject(response, 'Editor access is required.', 403);
  const personName = name(request.body?.name);
  const relationship = labels[request.body?.relationship];
  const personEmail = email(request.body?.email);
  if (!personName || personName.length > 80 || !relationship ||
      (personEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personEmail))) {
    return reject(response, 'Enter a name, allowed relationship, and valid optional email.');
  }
  if (personEmail && family.people.some((person) => person.email === personEmail)) {
    return reject(response, 'That email already belongs to a person in this family.', 409);
  }
  if (relationship[0] === 'partner' && family.relations.some((relation) =>
    relation.type === 'partner' && (same(relation.from, viewer._id) || same(relation.to, viewer._id)))) {
    return reject(response, 'A person can have only one partner.', 409);
  }
  const person = family.people.create({ name: personName, email: personEmail || null,
    gender: relationship[1], status: 'NON_USER', role: 'READONLY' });
  family.people.push(person);
  const parent = relationship[0] === 'parent';
  family.relations.push({ from: parent ? person._id : viewer._id,
    to: parent ? viewer._id : person._id,
    type: relationship[0] === 'child' ? 'parent' : relationship[0] });
  if (relationship[0] === 'child') {
    const partner = family.relations.find((relation) => relation.type === 'partner' &&
      (same(relation.from, viewer._id) || same(relation.to, viewer._id)));
    if (partner) family.relations.push({ from: same(partner.from, viewer._id) ? partner.to : partner.from,
      to: person._id, type: 'parent' });
  }
  if (relationship[0] === 'partner') {
    for (const relation of [...family.relations]) {
      if (relation.type === 'parent' && same(relation.from, viewer._id)) {
        family.relations.push({ from: person._id, to: relation.to, type: 'parent' });
      }
    }
  }
  await family.save();
  response.status(201).json({ family: familyView(family, viewer) });
});

router.patch('/:familyId/people/:personId', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  if (!canWrite(viewer)) return reject(response, 'Editor access is required.', 403);
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body) ||
      !Object.keys(request.body).length || Object.keys(request.body).some((key) => !['name', 'email', 'gender'].includes(key))) {
    return reject(response, 'Choose a name, email, or relationship label to update.');
  }
  const person = objectId(request.params.personId) && family.people.id(request.params.personId);
  if (!person || same(person._id, viewer._id)) return reject(response, 'Family person not found.', 404);
  if (person.status === 'ACCEPTED' && ('email' in request.body || 'name' in request.body)) {
    return reject(response, 'An accepted member manages their own account name and email.', 409);
  }
  if ('name' in request.body) {
    const value = name(request.body.name);
    if (!value || value.length > 80) return reject(response, 'Enter a name of up to 80 characters.');
    person.name = value;
  }
  if ('gender' in request.body) {
    if (!genders.includes(request.body.gender)) return reject(response, 'Choose male, female, or neutral.');
    person.gender = request.body.gender;
  }
  if ('email' in request.body) {
    const value = email(request.body.email);
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return reject(response, 'Enter a valid email.');
    if (value && family.people.some((other) => !same(other._id, person._id) && other.email === value)) {
      return reject(response, 'That email already belongs to a person in this family.', 409);
    }
    if (value !== person.email) {
      await FamilyInvitation.deleteMany({ familyId: family._id, personId: person._id });
      person.status = 'NON_USER';
    }
    person.email = value || null;
  }
  await family.save();
  response.json({ family: familyView(family, viewer) });
});

router.patch('/:familyId/people/:personId/role', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  if (!same(family.creatorId, request.familyUser._id)) return reject(response, 'Only the family creator can change roles.', 403);
  const person = objectId(request.params.personId) && family.people.id(request.params.personId);
  if (!person || same(person._id, viewer._id)) return reject(response, 'Family person not found.', 404);
  if (!['ADMIN', 'EDITOR', 'READONLY'].includes(request.body?.role)) return reject(response, 'Choose an allowed role.');
  person.role = request.body.role;
  await family.save();
  response.json({ family: familyView(family, viewer) });
});

router.delete('/:familyId/relations/:relationId', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  if (viewer.role !== 'ADMIN') return reject(response, 'Admin access is required.', 403);
  const relation = objectId(request.params.relationId) && family.relations.id(request.params.relationId);
  if (!relation || (!same(relation.from, viewer._id) && !same(relation.to, viewer._id))) {
    return reject(response, 'Relationship not found.', 404);
  }
  const otherId = same(relation.from, viewer._id) ? relation.to : relation.from;
  const isPartner = relation.type === 'partner';
  const parentId = relation.type === 'parent' ? relation.from : null;
  const childId = relation.type === 'parent' ? relation.to : null;
  relation.deleteOne();
  if (parentId) {
    const partner = family.relations.find((edge) => edge.type === 'partner' &&
      (same(edge.from, parentId) || same(edge.to, parentId)));
    const partnerId = partner && (same(partner.from, parentId) ? partner.to : partner.from);
    const sharedChildEdge = partnerId && family.relations.find((edge) => edge.type === 'parent' &&
      same(edge.from, partnerId) && same(edge.to, childId));
    sharedChildEdge?.deleteOne();
  }
  if (isPartner) {
    // The former partner no longer inherits this viewer's child relationships.
    for (const edge of [...family.relations]) {
      if (edge.type === 'parent' && same(edge.from, otherId) &&
          family.relations.some((candidate) => candidate.type === 'parent' &&
            same(candidate.from, viewer._id) && same(candidate.to, edge.to))) edge.deleteOne();
    }
  }
  await pruneDisconnected(family);
  await family.save();
  response.json({ family: familyView(family, viewer) });
});

router.post('/:familyId/people/:personId/invite', createRateLimit({ max: 10, windowMs: 60 * 60 * 1000 }), async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  if (viewer.role !== 'ADMIN') return reject(response, 'Admin access is required.', 403);
  const person = objectId(request.params.personId) && family.people.id(request.params.personId);
  if (!person || !person.email || person.status === 'ACCEPTED') return reject(response, 'Add an email to an unlinked family person first.');
  if (family.people.filter((other) => other.email === person.email).length !== 1) {
    return reject(response, 'The email matches more than one family person.', 409);
  }
  const matchingUsers = await User.find({ email: person.email }).limit(2).select('_id');
  if (matchingUsers.length > 1) return reject(response, 'Multiple accounts match this email. Resolve the duplicate before inviting.', 409);
  const token = crypto.randomBytes(32).toString('hex');
  await FamilyInvitation.deleteMany({ familyId: family._id, personId: person._id });
  const invitation = await FamilyInvitation.create({ familyId: family._id, personId: person._id,
    email: person.email, tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  try {
    await sendFamilyInvitationEmail(request.familyUser, person, token);
  } catch (error) {
    await invitation.deleteOne();
    console.error('Unable to send family invitation:', error.message);
    return reject(response, 'The invitation email could not be sent. Try again later.', 503);
  }
  person.status = 'PENDING';
  await family.save();
  response.status(202).json({ family: familyView(family, viewer), message: 'Invitation sent.' });
});

async function acceptInvitation(request, response, invitation) {
  if (!invitation) return reject(response, 'This invitation is expired or already used.', 410);
  if (invitation.email !== request.familyUser.email) return reject(response, 'Sign in with the invited, verified email address.', 403);
  const matchingUsers = await User.find({ email: invitation.email }).limit(2).select('_id');
  if (matchingUsers.length !== 1 || !same(matchingUsers[0]._id, request.familyUser._id)) {
    return reject(response, 'The invited email does not identify one verified account.', 409);
  }
  const family = await Family.findById(invitation.familyId);
  const person = family?.people.id(invitation.personId);
  if (!person || person.email !== invitation.email || person.status !== 'PENDING' || person.userId ||
      family.people.some((other) => other.userId && same(other.userId, request.familyUser._id))) {
    return reject(response, 'This family person cannot accept the invitation.', 409);
  }
  person.userId = request.familyUser._id;
  person.status = 'ACCEPTED';
  await family.save();
  await invitation.deleteOne();
  const emptyOwnFamily = await Family.findOne({ creatorId: request.familyUser._id });
  if (emptyOwnFamily && !same(emptyOwnFamily._id, family._id) &&
      emptyOwnFamily.people.length === 1 && emptyOwnFamily.relations.length === 0 && emptyOwnFamily.shares.length === 0) {
    await Family.deleteOne({ _id: emptyOwnFamily._id, creatorId: request.familyUser._id,
      'people.1': { $exists: false }, 'relations.0': { $exists: false }, 'shares.0': { $exists: false } });
  }
  response.json({ family: familyView(family, person) });
}

router.post('/invitations/accept', async (request, response) => {
  const token = request.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return reject(response, 'A valid invitation token is required.');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invitation = await FamilyInvitation.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  return acceptInvitation(request, response, invitation);
});

router.post('/invitations/:invitationId/accept', async (request, response) => {
  if (!objectId(request.params.invitationId)) return reject(response, 'Invitation not found.', 404);
  const invitation = await FamilyInvitation.findOne({ _id: request.params.invitationId,
    expiresAt: { $gt: new Date() } });
  return acceptInvitation(request, response, invitation);
});

router.put('/:familyId/shares/:feature/:recipientId', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  if (!['diet', 'finance'].includes(request.params.feature)) return reject(response, 'Unknown feature.', 404);
  const recipient = objectId(request.params.recipientId) && acceptedPerson(family, request.params.recipientId);
  if (!recipient || same(recipient.userId, viewer.userId)) return reject(response, 'Choose an accepted family member.', 400);
  if (!family.shares.some((share) => share.feature === request.params.feature &&
      same(share.ownerId, viewer.userId) && same(share.recipientId, recipient.userId))) {
    family.shares.push({ ownerId: viewer.userId, recipientId: recipient.userId, feature: request.params.feature });
    await family.save();
  }
  response.json({ family: familyView(family, viewer) });
});

router.delete('/:familyId/shares/:feature/:recipientId', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  family.shares = family.shares.filter((share) => !(share.feature === request.params.feature &&
    same(share.ownerId, viewer.userId) && same(share.recipientId, request.params.recipientId)));
  await family.save();
  response.json({ family: familyView(family, viewer) });
});

router.get('/:familyId/shared/:ownerId/:feature', async (request, response) => {
  const context = await memberFamily(request, response);
  if (!context) return;
  const { family, viewer } = context;
  const owner = objectId(request.params.ownerId) && acceptedPerson(family, request.params.ownerId);
  const feature = request.params.feature;
  if (!owner || !['diet', 'finance'].includes(feature) ||
      !family.shares.some((share) => share.feature === feature &&
        same(share.ownerId, owner.userId) && same(share.recipientId, viewer.userId))) {
    return reject(response, 'This information is not shared with you.', 403);
  }
  if (feature === 'diet') {
    const date = request.query.date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date) return reject(response, 'Use a valid YYYY-MM-DD date.');
    const [meals, targets] = await Promise.all([
      Meal.find({ userId: owner.userId, consumedOn: date }).select('name mealType servingDescription consumedOn calories proteinGrams carbohydrateGrams fatGrams fiberGrams').lean(),
      Targets.findOne({ userId: owner.userId }).select(fields.join(' ')).lean()
    ]);
    return response.json({ owner: publicPerson(owner), feature, date,
      targets: targets ? Object.fromEntries(fields.map((field) => [field, targets[field]])) : null,
      meals: meals.map((meal) => ({ name: meal.name, mealType: meal.mealType,
        servingDescription: meal.servingDescription,
        nutrition: Object.fromEntries(fields.map((field) => [field, meal[field]])) })) });
  }
  const month = request.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reject(response, 'Use a valid YYYY-MM month.');
  const [accounts, transactions, holdings] = await Promise.all([
    FinanceAccount.find({ userId: owner.userId }).select('name mask type subtype assetClass currency currentBalance availableBalance creditLimit balanceAsOf').lean(),
    FinanceTransaction.find({ userId: owner.userId, date: { $gte: `${month}-01`, $lte: `${month}-31` } })
      .sort({ date: -1 }).limit(100).select('date name merchantName amount currency direction category pending').lean(),
    FinanceHolding.find({ userId: owner.userId }).select('name tickerSymbol securityType quantity price marketValue currency priceAsOf').lean()
  ]);
  response.json({ owner: publicPerson(owner), feature, month, accounts, transactions, holdings });
});

module.exports = router;
