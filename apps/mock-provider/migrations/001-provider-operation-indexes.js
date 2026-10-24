import { ProviderOperation } from "../src/modules/operations/provider-operation.model.js";

const OBSOLETE_INDEXES = new Map([
  ["providerOperationId_1", { providerOperationId: 1 }],
]);

function keysMatch(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export async function migrateProviderOperationIndexes(logger) {
  const indexes = await ProviderOperation.collection.indexes();

  for (const [name, expectedKey] of OBSOLETE_INDEXES) {
    const index = indexes.find((candidate) => candidate.name === name);
    if (!index) continue;

    if (!keysMatch(index.key, expectedKey)) {
      throw new Error(
        `Refusing to drop unexpected index ${name}: key does not match migration`,
      );
    }

    await ProviderOperation.collection.dropIndex(name);
    logger?.info?.(
      { event: "provider.migration.index_dropped", index: name },
      "Dropped obsolete provider operation index",
    );
  }

  await ProviderOperation.createIndexes();
}
