// In-memory Firestore fake for isolated service/HTTP tests; no SDK network access.
class FakeChatFirestore {
  constructor() { this.documents = new Map(); this.queue = Promise.resolve(); this.writes = []; this.failStatus = false; }
  doc(path) {
    const db = this;
    return { path, collection: (name) => db.collection(`${path}/${name}`),
      async update(value) {
        if (db.failStatus || !db.documents.has(path)) throw new Error('Status write failed');
        db.documents.set(path, { ...db.documents.get(path), ...value });
      } };
  }
  collection(path, filters = [], max = Infinity) {
    const db = this;
    return {
      doc: (id) => db.doc(`${path}/${id}`),
      where: (field, operator, value) => db.collection(path, [...filters, [field, value]], max),
      limit: (value) => db.collection(path, filters, value),
      async get() {
        const docs = [...db.documents].filter(([key, data]) => key.startsWith(`${path}/`) &&
          key.slice(path.length + 1).indexOf('/') < 0 && filters.every(([field, value]) => data[field] === value))
          .slice(0, max).map(([key, data]) => ({ id: key.split('/').at(-1), ref: db.doc(key), data: () => data }));
        return { docs, size: docs.length, empty: !docs.length, forEach: (work) => docs.forEach(work) };
      }
    };
  }
  batch() {
    const operations = [];
    return { delete: (ref) => operations.push(() => this.documents.delete(ref.path)),
      set: (ref, value) => operations.push(() => this.documents.set(ref.path, value)),
      commit: async () => operations.forEach((work) => work()) };
  }
  async recursiveDelete(ref) {
    for (const path of this.documents.keys()) if (path === ref.path || path.startsWith(`${ref.path}/`)) this.documents.delete(path);
  }
  async runTransaction(work) {
    const previous = this.queue;
    let release;
    this.queue = new Promise((resolve) => { release = resolve; });
    await previous;
    const operations = [];
    const transaction = {
      get: async (ref) => ({ exists: this.documents.has(ref.path), data: () => this.documents.get(ref.path) }),
      create: (ref, value) => operations.push(['create', ref.path, value]),
      update: (ref, value) => operations.push(['update', ref.path, value])
    };
    try {
      const result = await work(transaction);
      for (const [kind, path] of operations) {
        if ((kind === 'create') === this.documents.has(path)) throw new Error('Conditional write failed');
      }
      for (const [kind, path, value] of operations) {
        this.documents.set(path, kind === 'update' ? { ...this.documents.get(path), ...value } : value);
        this.writes.push({ kind, path, value });
      }
      return result;
    } finally { release(); }
  }
}
module.exports = { FakeChatFirestore };
