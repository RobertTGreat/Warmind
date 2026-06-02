import { promises as fs } from "fs";
import path from "path";
import { gunzip } from "zlib";
import { promisify } from "util";

const unzip = promisify(gunzip);

const STATIC_MANIFEST_ROOT = path.join(process.cwd(), "data", "destiny-manifest");
const STATIC_MANIFEST_FILE = path.join(STATIC_MANIFEST_ROOT, "manifest.json");
const STATIC_MANIFEST_TABLE_DIR = path.join(STATIC_MANIFEST_ROOT, "en");

type BungieApiResponse<T> = {
  Response: T;
  ErrorCode: number;
  ThrottleSeconds: number;
  ErrorStatus: string;
  Message: string;
  MessageData: Record<string, string>;
};

type DestinyManifestMetadata = {
  version: string;
  jsonWorldComponentContentPaths?: {
    en?: Record<string, string>;
  };
};

type StaticManifestTable = Record<string, any>;

const manifestResponseCache = new Map<string, Promise<BungieApiResponse<DestinyManifestMetadata>>>();
const manifestTableCache = new Map<string, Promise<StaticManifestTable>>();

function getDefinitionTablePath(definitionType: string) {
  return path.join(STATIC_MANIFEST_TABLE_DIR, `${definitionType}.json.gz`);
}

async function readManifestResponse() {
  const cachedResponse = manifestResponseCache.get(STATIC_MANIFEST_FILE);

  if (cachedResponse) {
    return cachedResponse;
  }

  const responsePromise = fs
    .readFile(STATIC_MANIFEST_FILE, "utf8")
    .then((contents) => JSON.parse(contents) as BungieApiResponse<DestinyManifestMetadata>);

  manifestResponseCache.set(STATIC_MANIFEST_FILE, responsePromise);
  return responsePromise;
}

async function readCompressedJson(filePath: string) {
  const compressedTable = await fs.readFile(filePath);
  const tableBuffer = await unzip(compressedTable);
  return JSON.parse(tableBuffer.toString("utf8")) as StaticManifestTable;
}

export async function getStaticManifestApiResponse() {
  return readManifestResponse();
}

export async function getStaticManifestMetadata() {
  const manifestResponse = await readManifestResponse();
  return manifestResponse.Response;
}

export async function getStaticManifestVersion() {
  const manifest = await getStaticManifestMetadata();
  return manifest.version;
}

export async function getStaticManifestTable(definitionType: string) {
  const manifest = await getStaticManifestMetadata();
  const tablePath = manifest.jsonWorldComponentContentPaths?.en?.[definitionType];

  if (!tablePath) {
    throw new Error("Definition table not found");
  }

  const cacheKey = `${manifest.version}:${definitionType}`;
  const cachedTable = manifestTableCache.get(cacheKey);

  if (cachedTable) {
    return {
      table: await cachedTable,
      version: manifest.version,
    };
  }

  const tablePromise = readCompressedJson(getDefinitionTablePath(definitionType));
  manifestTableCache.set(cacheKey, tablePromise);

  return {
    table: await tablePromise,
    version: manifest.version,
  };
}

export async function getStaticManifestDefinition(definitionType: string, hash: string) {
  const { table, version } = await getStaticManifestTable(definitionType);

  return {
    definition: table[hash],
    version,
  };
}
