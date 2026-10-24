
import { ProviderOperation } from "../src/modules/operations/provider-operation.model.js";

const OBSOLETE_INDEXES = new Map([
  ["providerOperationId_1", { providerOperationId: 1 }],
  ["operationId_1", { operationId: 1 }],
]);

const LEGACY_SHARED_COLLECTION_INDEXES = new Map([
  ["operation_id_unique", { operationId: 1 }],
]);

function keysMatch(actual, expected) {
  const actualEntries = Object.entries(actual ?? {});
  const expectedEntries = Object.entries(expected);

  return (
    actualEntries.length === expectedEntries.length &&
    expectedEntries.every(
      ([key, value], index) =>
        actualEntries[index]?.[0] === key &&
        actualEntries[index]?.[1] === value,
    )
  );
}

export async function migrateProviderOperationIndexes(logger) {
  const collection = ProviderOperation.collection;
  const indexes = await collection.indexes();

  for (const [name, expectedKey] of OBSOLETE_INDEXES) {
    const existing = indexes.find((index) => index.name === name);

    if (!existing) continue;

    if (!keysMatch(existing.key, expectedKey)) {
      throw new Error(
        `Index migration aborted: "${name}" has an unexpected key definition.`,
      );
    }

    await collection.dropIndex(name);

    logger?.info?.(
      {
        event: "provider.migration.index_dropped",
        index: name,
      },
      "Dropped obsolete provider operation index",
    );
  }

  const database = collection.conn.db;
  const legacyCollectionExists = await database
    .listCollections({ name: "provideroperations" }, { nameOnly: true })
    .hasNext();

  if (legacyCollectionExists) {
    const legacyCollection = database.collection("provideroperations");
    const legacyIndexes = await legacyCollection.indexes();

    for (const [name, expectedKey] of LEGACY_SHARED_COLLECTION_INDEXES) {
      const existing = legacyIndexes.find((index) => index.name === name);
      if (!existing) continue;

      if (!keysMatch(existing.key, expectedKey) || existing.unique !== true) {
        throw new Error(
          `Index migration aborted: legacy shared index "${name}" has an unexpected definition.`,
        );
      }

      await legacyCollection.dropIndex(name);
      logger?.info?.(
        {
          event: "provider.migration.legacy_shared_index_dropped",
          index: name,
        },
        "Dropped conflicting mock-provider index from API collection",
      );
    }
  }

  await ProviderOperation.createIndexes();

  logger?.info?.(
    {
      event: "provider.migration.completed",
    },
    "Provider operation indexes migrated successfully",
  );
}
