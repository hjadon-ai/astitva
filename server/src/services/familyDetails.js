const validBirthDate = value => {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};
function parseDetails(body) {
  const fields = ['preferredName', 'birthDate', 'note'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(k => !fields.includes(k))) return null;
  const result = {};
  for (const key of Object.keys(body)) {
    const value = body[key];
    if (value !== null && typeof value !== 'string') return null;
    if (key === 'birthDate') {
      if (!validBirthDate(value)) return null;
      result[key] = value;
    } else {
      const text = value === null ? null : key === 'preferredName' ? value.trim() : value;
      if (text && text.length > (key === 'note' ? 1000 : 80)) return null;
      if (key === 'preferredName' && text && /[\r\n]/.test(text)) return null;
      result[key] = text || null;
    }
  }
  return result;
}
module.exports = { validBirthDate, parseDetails };
