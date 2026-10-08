const objectId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const same = (a,b) => String(a) === String(b);
const accepted = (family, userId) => family.people.some(p => p.status === 'ACCEPTED' && p.userId && same(p.userId,userId));
const canSee = (post,userId) => !post.deleted && (post.audience === 'family' || same(post.authorId,userId) || post.recipientIds.some(id => same(id,userId)));
function audienceFilter(userId) { return { $or: [{ audience: 'family' }, { authorId: userId }, { recipientIds: userId }] }; }
function parsePost(body,family,userId) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['text','type','audience','recipientIds'].includes(k))) return null;
  if (typeof body.text !== 'string' || body.text.length > 2000 || !['update','milestone','announcement'].includes(body.type) || !['family','selected'].includes(body.audience)) return null;
  const ids = body.recipientIds ?? [];
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !objectId(id) || !accepted(family,id)) || new Set(ids.map(id => id.toLowerCase())).size !== ids.length) return null;
  if (body.audience === 'selected' && !ids.filter(id => !same(id,userId)).length) return null;
  if (body.audience === 'family' && ids.length) return null;
  return { text: body.text.trim(), type: body.type, audience: body.audience, recipientIds: ids };
}
function validPhoto(file) {
  if (!file || file.size > 2*1024*1024 || !Buffer.isBuffer(file.buffer)) return false;
  const b=file.buffer;
  if (file.mimetype === 'image/png') return b.length >= 20 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.subarray(-12,-8).equals(Buffer.alloc(4)) && b.subarray(-8,-4).toString() === 'IEND';
  return file.mimetype === 'image/jpeg' && b.length >= 4 && b[0]===255 && b[1]===216 && b[b.length-2]===255 && b[b.length-1]===217;
}
function pagination(query) {
  if (Object.keys(query).some(k => !['limit','before'].includes(k))) return null;
  const limit = query.limit === undefined ? 20 : typeof query.limit === 'string' && /^\d+$/.test(query.limit) ? Number(query.limit) : 0;
  if (limit < 1 || limit > 50) return null;
  let filter={};
  if (query.before !== undefined) {
    if (typeof query.before !== 'string') return null;
    try {
      const [time,id] = JSON.parse(Buffer.from(query.before,'base64url').toString());
      if (typeof time !== 'string' || !Number.isFinite(Date.parse(time)) || !objectId(id)) return null;
      filter={$or:[{createdAt:{$lt:new Date(time)}},{createdAt:new Date(time),_id:{$lt:id}}]};
    } catch { return null; }
  }
  return {limit,filter};
}
const cursor = row => Buffer.from(JSON.stringify([row.createdAt.toISOString(),String(row._id)])).toString('base64url');
module.exports={objectId,same,accepted,canSee,audienceFilter,parsePost,validPhoto,pagination,cursor};
