import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { SqliteDocumentStore } from "../packages/platform/src/sqlite-document-store.js";

const fixture = async (state) => {
  const directory = await mkdtemp(join(tmpdir(), "vynodearr-sqlite-store-")),
    legacyPath = join(directory, "activity.json"),
    databasePath = join(directory, "vynodearr.db");
  await writeFile(legacyPath, JSON.stringify(state, null, 2));
  const store = new SqliteDocumentStore(legacyPath, { version: 1, items: [] }, {
    databasePath,
    namespace: "activity",
  });
  return { directory, legacyPath, databasePath, store };
};

test("SqliteDocumentStore imports legacy JSON once without changing it", async () => {
  const state = { version: 1, items: [{ id: "one", status: "queued" }], dismissed: {} },
    value = await fixture(state);
  try {
    const before = await readFile(value.legacyPath, "utf8");
    assert.deepEqual(await value.store.read(), state);
    await value.store.update((current) => {
      current.items[0].status = "completed";
    });
    assert.equal(await readFile(value.legacyPath, "utf8"), before);
    assert.equal((await value.store.read()).items[0].status, "completed");
    await access(join(value.directory, "backups", "legacy-json", "activity.json.pre-sqlite"));
  } finally {
    value.store.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("SqliteDocumentStore persists collection members as individual rows", async () => {
  const value = await fixture({
    version: 1,
    items: [
      { id: "one", status: "queued" },
      { id: "two", status: "queued" },
    ],
  });
  try {
    await value.store.read();
    const database = new Database(value.databasePath, { readonly: true });
    try {
      assert.equal(
        database
          .prepare("SELECT COUNT(*) count FROM document_items WHERE namespace = ? AND collection = ?")
          .get("activity", "items").count,
        2,
      );
    } finally {
      database.close();
    }
    await value.store.update((current) => {
      current.items.unshift({ id: "zero", status: "new" });
      current.items[1].status = "completed";
    });
    assert.deepEqual(
      (await value.store.read()).items.map((item) => [item.id, item.status]),
      [
        ["zero", "new"],
        ["one", "completed"],
        ["two", "queued"],
      ],
    );
  } finally {
    value.store.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("SqliteDocumentStore does not write when an update is unchanged", async () => {
  const value = await fixture({ version: 1, items: [{ id: "one" }] });
  try {
    await value.store.read();
    await value.store.checkpoint();
    const before = await stat(value.databasePath, { bigint: true });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await value.store.update((current) => current.items[0]);
    await value.store.checkpoint();
    const after = await stat(value.databasePath, { bigint: true });
    assert.equal(after.mtimeNs, before.mtimeNs);
  } finally {
    value.store.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("SqliteDocumentStore updates one large-history row without rewriting the history", async () => {
  const items = Array.from({ length: 2000 }, (_, index) => ({
      id: `item-${index}`,
      status: "queued",
      payload: "x".repeat(1000),
    })),
    value = await fixture({ version: 1, items });
  try {
    await value.store.read();
    await value.store.checkpoint("TRUNCATE");
    await value.store.update((current) => {
      current.items[1000].status = "completed";
    });
    const wal = await stat(`${value.databasePath}-wal`);
    assert.ok(wal.size < 256 * 1024, `single-row WAL growth was ${wal.size} bytes`);
    assert.equal((await value.store.read()).items[1000].status, "completed");
  } finally {
    value.store.close();
    await rm(value.directory, { recursive: true, force: true });
  }
});
