import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import Database from "better-sqlite3";

const markerKey = "__initialized__";
const orderPrefix = "__order__:";

export class SqliteDocumentStore {
  constructor(path, initialValue, options = {}) {
    this.path = path;
    this.initialValue = initialValue;
    this.databasePath = options.databasePath || join(dirname(path), "vynodearr.db");
    this.namespace = options.namespace || basename(path, ".json");
    this.itemKeys = options.itemKeys || {};
    this.dailyBackup = options.dailyBackup === true;
    this.backupRetention = Math.max(1, Number(options.backupRetention) || 7);
    this.queue = Promise.resolve();
    this.ready = null;
    this.database = null;
  }

  async initialize() {
    if (!this.ready) this.ready = this.#initialize();
    return this.ready;
  }

  async #initialize() {
    await mkdir(dirname(this.databasePath), { recursive: true });
    const databaseExisted = await access(this.databasePath).then(
      () => true,
      () => false,
    );
    const db = new Database(this.databasePath);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    db.pragma("wal_autocheckpoint = 1000");
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_values (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        PRIMARY KEY (namespace, key)
      );
      CREATE TABLE IF NOT EXISTS document_items (
        namespace TEXT NOT NULL,
        collection TEXT NOT NULL,
        item_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        PRIMARY KEY (namespace, collection, item_key)
      );
      CREATE INDEX IF NOT EXISTS document_items_collection
        ON document_items (namespace, collection);
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    if (db.pragma("quick_check", { simple: true }) !== "ok")
      throw new Error(`SQLite integrity check failed for ${this.databasePath}`);
    this.database = db;
    const initialized = db
      .prepare(
        "SELECT 1 FROM document_values WHERE namespace = ? AND key = ?",
      )
      .get(this.namespace, markerKey);
    if (!initialized) {
      let source = structuredClone(this.initialValue);
      try {
        source = JSON.parse(await readFile(this.path, "utf8"));
        const backupDirectory = join(dirname(this.path), "backups", "legacy-json");
        await mkdir(backupDirectory, { recursive: true });
        await copyFile(
          this.path,
          join(backupDirectory, `${basename(this.path)}.pre-sqlite`),
        ).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      this.#persist(source);
      db.prepare(
        "INSERT OR REPLACE INTO schema_migrations (name, applied_at) VALUES (?, ?)",
      ).run(`json:${this.namespace}`, new Date().toISOString());
    }
    if (this.dailyBackup && databaseExisted) await this.#dailyBackup();
  }

  #itemKey(collection, item, index, used) {
    const configured = this.itemKeys[collection];
    let value = configured
      ? configured(item)
      : item && typeof item === "object" && item.id != null
        ? String(item.id)
        : `content:${createHash("sha256")
            .update(JSON.stringify(item))
            .digest("hex")}`;
    value = String(value);
    const count = used.get(value) || 0;
    used.set(value, count + 1);
    return count ? `${value}#${count}` : value || `index:${index}`;
  }

  #persist(value) {
    const db = this.database;
    const existingValues = new Map(
      db
        .prepare("SELECT key, value_json FROM document_values WHERE namespace = ?")
        .all(this.namespace)
        .map((row) => [row.key, row.value_json]),
    );
    const existingCollections = new Set(
      db
        .prepare("SELECT DISTINCT collection FROM document_items WHERE namespace = ?")
        .all(this.namespace)
        .map((row) => row.collection),
    );
    const desiredValues = new Map([[markerKey, "true"]]);
    const desiredCollections = new Map();
    for (const [key, current] of Object.entries(value || {})) {
      if (!Array.isArray(current)) {
        desiredValues.set(key, JSON.stringify(current));
        continue;
      }
      const used = new Map(),
        items = new Map(),
        order = [];
      current.forEach((item, index) => {
        const itemKey = this.#itemKey(key, item, index, used);
        items.set(itemKey, JSON.stringify(item));
        order.push(itemKey);
      });
      desiredCollections.set(key, items);
      desiredValues.set(`${orderPrefix}${key}`, JSON.stringify(order));
    }
    const upsertValue = db.prepare(
        "INSERT INTO document_values (namespace, key, value_json) VALUES (?, ?, ?) ON CONFLICT(namespace, key) DO UPDATE SET value_json = excluded.value_json",
      ),
      deleteValue = db.prepare(
        "DELETE FROM document_values WHERE namespace = ? AND key = ?",
      ),
      upsertItem = db.prepare(
        "INSERT INTO document_items (namespace, collection, item_key, value_json) VALUES (?, ?, ?, ?) ON CONFLICT(namespace, collection, item_key) DO UPDATE SET value_json = excluded.value_json",
      ),
      deleteItem = db.prepare(
        "DELETE FROM document_items WHERE namespace = ? AND collection = ? AND item_key = ?",
      ),
      deleteCollection = db.prepare(
        "DELETE FROM document_items WHERE namespace = ? AND collection = ?",
      );
    db.transaction(() => {
      for (const [key, serialized] of desiredValues)
        if (existingValues.get(key) !== serialized)
          upsertValue.run(this.namespace, key, serialized);
      for (const key of existingValues.keys())
        if (!desiredValues.has(key)) deleteValue.run(this.namespace, key);
      for (const [collection, items] of desiredCollections) {
        existingCollections.delete(collection);
        const existing = new Map(
          db
            .prepare(
              "SELECT item_key, value_json FROM document_items WHERE namespace = ? AND collection = ?",
            )
            .all(this.namespace, collection)
            .map((row) => [row.item_key, row.value_json]),
        );
        for (const [itemKey, serialized] of items)
          if (existing.get(itemKey) !== serialized)
            upsertItem.run(this.namespace, collection, itemKey, serialized);
        for (const itemKey of existing.keys())
          if (!items.has(itemKey))
            deleteItem.run(this.namespace, collection, itemKey);
      }
      for (const collection of existingCollections)
        deleteCollection.run(this.namespace, collection);
    })();
  }

  #read() {
    const values = this.database
      .prepare("SELECT key, value_json FROM document_values WHERE namespace = ?")
      .all(this.namespace);
    const result = {};
    for (const row of values)
      if (row.key !== markerKey && !row.key.startsWith(orderPrefix))
        result[row.key] = JSON.parse(row.value_json);
    for (const row of values.filter((item) => item.key.startsWith(orderPrefix))) {
      const collection = row.key.slice(orderPrefix.length),
        order = JSON.parse(row.value_json),
        items = new Map(
          this.database
            .prepare(
              "SELECT item_key, value_json FROM document_items WHERE namespace = ? AND collection = ?",
            )
            .all(this.namespace, collection)
            .map((item) => [item.item_key, JSON.parse(item.value_json)]),
        );
      result[collection] = order
        .map((key) => items.get(key))
        .filter((item) => item !== undefined);
    }
    return result;
  }

  async read() {
    await this.initialize();
    await this.queue.catch(() => {});
    return this.#read();
  }

  async write(value) {
    await this.initialize();
    const operation = this.queue.catch(() => {}).then(() => {
      const before = JSON.stringify(this.#read());
      const after = JSON.stringify(value);
      if (before === after) return false;
      this.#persist(value);
      return true;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async update(mutator) {
    await this.initialize();
    let result;
    const operation = this.queue.catch(() => {}).then(async () => {
      const current = this.#read(),
        before = JSON.stringify(current);
      result = await mutator(current);
      if (JSON.stringify(current) !== before) this.#persist(current);
    });
    this.queue = operation.catch(() => {});
    await operation;
    return result;
  }

  async checkpoint(mode = "PASSIVE") {
    await this.initialize();
    await this.queue.catch(() => {});
    const selected = ["PASSIVE", "FULL", "RESTART", "TRUNCATE"].includes(mode)
      ? mode
      : "PASSIVE";
    this.database.pragma(`wal_checkpoint(${selected})`);
  }

  close() {
    if (this.database?.open) this.database.close();
  }

  async #dailyBackup() {
    const directory = join(dirname(this.databasePath), "backups", "sqlite"),
      day = new Date().toISOString().slice(0, 10),
      destination = join(directory, `vynodearr-${day}.db`);
    await mkdir(directory, { recursive: true });
    const exists = await access(destination).then(
      () => true,
      () => false,
    );
    if (!exists) await this.database.backup(destination);
    const names = (await readdir(directory))
      .filter((name) => /^vynodearr-\d{4}-\d{2}-\d{2}\.db$/.test(name))
      .sort()
      .reverse();
    await Promise.all(
      names.slice(this.backupRetention).map((name) => unlink(join(directory, name))),
    );
  }
}
