/**
 * ClickUp Auto Coder PRO MAX — IndexedDB Engine (lib/db.js)
 * High-scale storage: 5000+ files, projects, settings.
 */
class CodeDB {
  constructor() {
    this.dbName = 'ClickUpAutoCoderMAX';
    this.version = 2;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          const s = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
          s.createIndex('hash',      'hash',      { unique: true  });
          s.createIndex('project',   'project',   { unique: false });
          s.createIndex('language',  'language',  { unique: false });
          s.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('responses')) {
          const r = db.createObjectStore('responses', { keyPath: 'id', autoIncrement: true });
          r.createIndex('hash',      'hash',      { unique: true  });
          r.createIndex('source',    'source',    { unique: false });
          r.createIndex('topic',     'topic',     { unique: false });
          r.createIndex('selected',  'selected',  { unique: false });
          r.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const s  = Array.isArray(store) ? null : tx.objectStore(store);
      const stores = Array.isArray(store)
        ? store.reduce((o, n) => { o[n] = tx.objectStore(n); return o; }, {})
        : null;
      const req = fn(s || stores, tx);
      if (req && req.onsuccess !== undefined) {
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      } else {
        tx.oncomplete = () => resolve(req);
        tx.onerror    = () => reject(tx.error);
      }
    });
  }

  async addFile(file) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction('files', 'readwrite');
      const s   = tx.objectStore('files');
      const req = s.add({ ...file, createdAt: file.createdAt || Date.now(), updatedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => {
        if (e.target.error?.name === 'ConstraintError') resolve(null);
        else reject(req.error);
      };
    });
  }

  async updateFile(id, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('files', 'readwrite');
      const s  = tx.objectStore('files');
      const g  = s.get(id);
      g.onsuccess = () => {
        if (!g.result) return reject(new Error('Not found'));
        const p = s.put({ ...g.result, ...data, updatedAt: Date.now() });
        p.onsuccess = () => resolve(p.result);
        p.onerror   = () => reject(p.error);
      };
      g.onerror = () => reject(g.error);
    });
  }

  async getFile(id) {
    await this.init();
    return this._tx('files', 'readonly', s => s.get(id));
  }

  async getFileByHash(hash) {
    await this.init();
    return this._tx('files', 'readonly', s => s.index('hash').get(hash));
  }

  async getAllFiles() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('files', 'readonly');
      const r  = tx.objectStore('files').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror   = () => reject(r.error);
    });
  }

  async getFilesByProject(project) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('files', 'readonly');
      const r  = tx.objectStore('files').index('project').getAll(project);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror   = () => reject(r.error);
    });
  }

  async deleteFile(id) {
    await this.init();
    return this._tx('files', 'readwrite', s => s.delete(id));
  }

  async clearAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['files','projects'], 'readwrite');
      tx.objectStore('files').clear();
      tx.objectStore('projects').clear();
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async addProject(name) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readwrite');
      const r  = tx.objectStore('projects').put({ name, createdAt: Date.now() });
      r.onsuccess = () => resolve();
      r.onerror   = () => reject(r.error);
    });
  }

  async getProjects() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readonly');
      const r  = tx.objectStore('projects').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror   = () => reject(r.error);
    });
  }

  async deleteProject(name) {
    await this.init();
    const files = await this.getFilesByProject(name);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['files','projects'], 'readwrite');
      files.forEach(f => tx.objectStore('files').delete(f.id));
      tx.objectStore('projects').delete(name);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async setSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const r  = tx.objectStore('settings').put({ key, value });
      r.onsuccess = () => resolve();
      r.onerror   = () => reject(r.error);
    });
  }

  async getSetting(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const r  = tx.objectStore('settings').get(key);
      r.onsuccess = () => resolve(r.result?.value);
      r.onerror   = () => reject(r.error);
    });
  }

  async getAllSettings() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const r  = tx.objectStore('settings').getAll();
      r.onsuccess = () => {
        const map = {};
        (r.result || []).forEach(i => { map[i.key] = i.value; });
        resolve(map);
      };
      r.onerror = () => reject(r.error);
    });
  }

  async addResponse(response) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction('responses', 'readwrite');
      const s   = tx.objectStore('responses');
      const row = {
        ...response,
        selected: response.selected !== false,
        createdAt: response.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      const req = s.add(row);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => {
        if (e.target.error?.name === 'ConstraintError') resolve(null);
        else reject(req.error);
      };
    });
  }

  async getAllResponses() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('responses', 'readonly');
      const r  = tx.objectStore('responses').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror   = () => reject(r.error);
    });
  }

  async getResponseByHash(hash) {
    await this.init();
    return this._tx('responses', 'readonly', s => s.index('hash').get(hash));
  }

  async updateResponse(id, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('responses', 'readwrite');
      const s  = tx.objectStore('responses');
      const g  = s.get(id);
      g.onsuccess = () => {
        if (!g.result) return reject(new Error('Response not found'));
        const p = s.put({ ...g.result, ...data, updatedAt: Date.now() });
        p.onsuccess = () => resolve(p.result);
        p.onerror   = () => reject(p.error);
      };
      g.onerror = () => reject(g.error);
    });
  }

  async deleteResponse(id) {
    await this.init();
    return this._tx('responses', 'readwrite', s => s.delete(id));
  }

  async clearResponses() {
    await this.init();
    return this._tx('responses', 'readwrite', s => s.clear());
  }

  async setAllResponsesSelected(selected) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('responses', 'readwrite');
      const s = tx.objectStore('responses');
      const req = s.openCursor();
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const fail = (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      };
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          done();
          return;
        }
        cursor.update({ ...cursor.value, selected: Boolean(selected), updatedAt: Date.now() });
        cursor.continue();
      };
      req.onerror = () => fail(req.error);
      tx.oncomplete = () => done();
      tx.onerror = () => fail(tx.error);
    });
  }
}

if (typeof window !== 'undefined') window.CodeDB = CodeDB;
else if (typeof self !== 'undefined') self.CodeDB = CodeDB;
