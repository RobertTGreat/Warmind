import {
  db,
  isDatabaseAvailable,
  type ManifestDefinitionCacheEntry,
  type ManifestIndex,
} from "@/lib/db";

type DefinitionHash = number | string;
type ManifestDefinitionTable<T> = Record<string, T>;

const DEFAULT_LANGUAGE = "en";
const DEFAULT_VIEW = "full";
const DEFAULT_SCHEMA_VERSION = "v2";
const INVENTORY_DEFINITION_TYPE = "DestinyInventoryItemDefinition";
const CHUNK_SIZE = 1000;

function normalizeView(view?: string) {
  return view || DEFAULT_VIEW;
}

function normalizeHash(hash: DefinitionHash) {
  return Number(hash);
}

function buildMetaKey(definitionType: string, view: string, language: string) {
  return `${definitionType}:${language}:${view}`;
}

function buildManifestTableUrl(definitionType: string, view?: string) {
  const params = new URLSearchParams();

  if (view) {
    params.set("view", view);
  }

  const query = params.toString();
  return `/api/manifest-table/${definitionType}${query ? `?${query}` : ""}`;
}

function getStore(view: string) {
  return view === "card" ? db.manifestCards : db.manifestDefinitions;
}

async function fetchManifestTable<T>(
  definitionType: string,
  view?: string
): Promise<{ definitions: ManifestDefinitionTable<T>; manifestVersion: string }> {
  const response = await fetch(buildManifestTableUrl(definitionType, view));

  if (!response.ok) {
    throw new Error(`Failed to fetch ${definitionType}`);
  }

  return {
    definitions: (await response.json()) as ManifestDefinitionTable<T>,
    manifestVersion: response.headers.get("X-Warmind-Manifest-Version") ?? "",
  };
}

async function fetchManifestDefinitionsFromApi<T>(
  definitionType: string,
  hashes: DefinitionHash[],
  view?: string
): Promise<{ definitions: ManifestDefinitionTable<T>; manifestVersion: string }> {
  const response = await fetch(buildManifestTableUrl(definitionType, view), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hashes }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${definitionType}`);
  }

  return {
    definitions: (await response.json()) as ManifestDefinitionTable<T>,
    manifestVersion: response.headers.get("X-Warmind-Manifest-Version") ?? "",
  };
}

function collectInventoryItemSearchText(definition: any) {
  const searchableValues = [
    definition?.displayProperties?.name,
    definition?.displayProperties?.description,
    definition?.itemTypeDisplayName,
    definition?.inventory?.tierTypeName,
    ...(definition?.itemCategoryHashes ?? []),
    ...(definition?.sockets?.socketEntries ?? []).map((socketEntry: any) =>
      socketEntry?.singleInitialItemHash
    ),
    ...(definition?.perks ?? []).map((perk: any) => perk?.perkHash),
    ...(definition?.investmentStats ?? []).map((stat: any) => stat?.statTypeHash),
  ];

  return searchableValues
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
}

function buildManifestIndexEntry(
  hash: number,
  definition: any,
  manifestVersion: string
): ManifestIndex | null {
  const name = definition?.displayProperties?.name;

  if (!name) {
    return null;
  }

  const socketEntries = definition?.sockets?.socketEntries ?? [];
  const perkHashes = (definition?.perks ?? [])
    .map((perk: any) => Number(perk?.perkHash))
    .filter(Number.isFinite);
  const socketPlugHashes = socketEntries
    .map((socketEntry: any) => Number(socketEntry?.singleInitialItemHash))
    .filter(Number.isFinite);
  const statHashes = (definition?.investmentStats ?? [])
    .map((stat: any) => Number(stat?.statTypeHash))
    .filter(Number.isFinite);

  return {
    hash,
    name,
    nameLower: name.toLowerCase(),
    searchableText: collectInventoryItemSearchText(definition),
    itemType: definition?.itemType ?? 0,
    itemSubType: definition?.itemSubType ?? 0,
    tierType: definition?.inventory?.tierType ?? 0,
    tierTypeName: definition?.inventory?.tierTypeName,
    bucketTypeHash: definition?.inventory?.bucketTypeHash ?? 0,
    classType: definition?.classType ?? 3,
    ammoType: definition?.equippingBlock?.ammoType,
    damageType: definition?.defaultDamageTypeHash,
    defaultDamageTypeHash: definition?.defaultDamageTypeHash,
    itemCategoryHashes: definition?.itemCategoryHashes ?? [],
    perkHashes: Array.from(new Set<number>([...perkHashes, ...socketPlugHashes])),
    statHashes: Array.from(new Set<number>(statHashes)),
    equippable: definition?.equippable ?? false,
    nonTransferrable: definition?.nonTransferrable ?? false,
    iconPath: definition?.displayProperties?.icon,
    watermarkPath: definition?.iconWatermark || definition?.iconWatermarkShelved,
    manifestVersion,
  };
}

async function writeManifestDefinitions<T>({
  definitionType,
  definitions,
  manifestVersion,
  view,
  language,
  schemaVersion,
  isFullTable = false,
}: {
  definitionType: string;
  definitions: ManifestDefinitionTable<T>;
  manifestVersion: string;
  view: string;
  language: string;
  schemaVersion: string;
  isFullTable?: boolean;
}) {
  if (!isDatabaseAvailable() || !manifestVersion) {
    return;
  }

  const store = getStore(view);
  const updatedAt = Date.now();
  const entries: ManifestDefinitionCacheEntry[] = Object.entries(definitions)
    .map(([hash, definition]) => ({
      definitionType,
      language,
      view,
      hash: Number(hash),
      manifestVersion,
      schemaVersion,
      definition,
      updatedAt,
    }))
    .filter((entry) => Number.isFinite(entry.hash));

  await db.transaction("rw", db.manifestMeta, store, db.manifestIndex, async () => {
    const metaKey = buildMetaKey(definitionType, view, language);
    const currentMeta = await db.manifestMeta.get(metaKey);

    if (
      currentMeta &&
      (currentMeta.manifestVersion !== manifestVersion || currentMeta.schemaVersion !== schemaVersion)
    ) {
      await store.where("definitionType").equals(definitionType).delete();

      if (definitionType === INVENTORY_DEFINITION_TYPE) {
        await db.manifestIndex.clear();
      }
    }

    for (let index = 0; index < entries.length; index += CHUNK_SIZE) {
      await store.bulkPut(entries.slice(index, index + CHUNK_SIZE));
    }

    if (definitionType === INVENTORY_DEFINITION_TYPE) {
      const indexEntries = entries
        .map((entry) =>
          buildManifestIndexEntry(entry.hash, entry.definition, manifestVersion)
        )
        .filter((entry): entry is ManifestIndex => entry !== null);

      for (let index = 0; index < indexEntries.length; index += CHUNK_SIZE) {
        await db.manifestIndex.bulkPut(indexEntries.slice(index, index + CHUNK_SIZE));
      }
    }

    await db.manifestMeta.put({
      key: metaKey,
      definitionType,
      language,
      view,
      manifestVersion,
      schemaVersion,
      isFullTable: isFullTable || (
        currentMeta?.manifestVersion === manifestVersion &&
        currentMeta.schemaVersion === schemaVersion &&
        Boolean(currentMeta.isFullTable)
      ),
      rowCount: isFullTable
        ? entries.length
        : currentMeta?.manifestVersion === manifestVersion && currentMeta.schemaVersion === schemaVersion
          ? currentMeta.rowCount
          : undefined,
      updatedAt,
    });
  });
}

async function readCachedManifestDefinitions<T>(
  definitionType: string,
  hashes: number[],
  view: string
): Promise<ManifestDefinitionTable<T>> {
  if (!isDatabaseAvailable() || hashes.length === 0) {
    return {};
  }

  const store = getStore(view);
  const rows = await store.bulkGet(
    hashes.map((hash) => [definitionType, view, hash] as [string, string, number])
  );

  return rows.reduce<ManifestDefinitionTable<T>>((definitions, row) => {
    if (row?.definition) {
      definitions[String(row.hash)] = row.definition as T;
    }

    return definitions;
  }, {});
}

export async function getManifestDefinitions<T = any>(
  definitionType: string,
  hashes: DefinitionHash[],
  options?: {
    view?: string;
    language?: string;
    schemaVersion?: string;
  }
): Promise<ManifestDefinitionTable<T>> {
  const view = normalizeView(options?.view);
  const language = options?.language ?? DEFAULT_LANGUAGE;
  const schemaVersion = options?.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  const uniqueHashes = Array.from(new Set(hashes.map(normalizeHash))).filter(
    Number.isFinite
  );

  if (uniqueHashes.length === 0) {
    return {};
  }

  const cachedDefinitions = await readCachedManifestDefinitions<T>(
    definitionType,
    uniqueHashes,
    view
  );
  const missingHashes = uniqueHashes.filter(
    (hash) => cachedDefinitions[String(hash)] === undefined
  );

  if (missingHashes.length === 0) {
    return cachedDefinitions;
  }

  const { definitions: fetchedDefinitions, manifestVersion } =
    await fetchManifestDefinitionsFromApi<T>(definitionType, missingHashes, options?.view);

  await writeManifestDefinitions({
    definitionType,
    definitions: fetchedDefinitions,
    manifestVersion,
    view,
    language,
    schemaVersion,
  });

  return {
    ...cachedDefinitions,
    ...fetchedDefinitions,
  };
}

export async function getManifestTable<T = any>(
  definitionType: string,
  options?: {
    view?: string;
    language?: string;
    schemaVersion?: string;
  }
): Promise<ManifestDefinitionTable<T>> {
  const view = normalizeView(options?.view);
  const language = options?.language ?? DEFAULT_LANGUAGE;
  const schemaVersion = options?.schemaVersion ?? DEFAULT_SCHEMA_VERSION;

  if (isDatabaseAvailable()) {
    const store = getStore(view);
    const metaKey = buildMetaKey(definitionType, view, language);
    const cachedMeta = await db.manifestMeta.get(metaKey);
    const cachedRows = await store
      .where("definitionType")
      .equals(definitionType)
      .and((row) => row.view === view)
      .toArray();

    const hasCompleteCachedTable =
      Boolean(cachedMeta?.isFullTable) &&
      cachedMeta?.schemaVersion === schemaVersion &&
      cachedRows.length > 0 &&
      (!cachedMeta?.rowCount || cachedRows.length >= cachedMeta.rowCount);

    if (hasCompleteCachedTable) {
      return cachedRows.reduce<ManifestDefinitionTable<T>>((definitions, row) => {
        definitions[String(row.hash)] = row.definition as T;
        return definitions;
      }, {});
    }
  }

  const { definitions, manifestVersion } = await fetchManifestTable<T>(
    definitionType,
    options?.view
  );

  await writeManifestDefinitions({
    definitionType,
    definitions,
    manifestVersion,
    view,
    language,
    schemaVersion,
    isFullTable: true,
  });

  return definitions;
}

export async function clearStaleManifestDefinitions(
  definitionType: string,
  manifestVersion: string
) {
  if (!isDatabaseAvailable()) {
    return;
  }

  await db.transaction("rw", db.manifestDefinitions, db.manifestCards, async () => {
    await db.manifestDefinitions
      .where("definitionType")
      .equals(definitionType)
      .and((row) => row.manifestVersion !== manifestVersion)
      .delete();
    await db.manifestCards
      .where("definitionType")
      .equals(definitionType)
      .and((row) => row.manifestVersion !== manifestVersion)
      .delete();
  });
}

export async function ensureInventoryItemSearchIndex() {
  if (!isDatabaseAvailable()) {
    return { itemCount: 0, fromCache: false };
  }

  const itemCount = await db.manifestIndex.count();

  if (itemCount > 0) {
    return { itemCount, fromCache: true };
  }

  const definitions = await getManifestTable(INVENTORY_DEFINITION_TYPE);

  return {
    itemCount: Object.keys(definitions).length,
    fromCache: false,
  };
}
