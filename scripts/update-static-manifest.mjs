import { createWriteStream } from "node:fs";
import { mkdir, rm, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const BUNGIE_BASE_URL = "https://www.bungie.net";
const MANIFEST_URL = `${BUNGIE_BASE_URL}/Platform/Destiny2/Manifest/`;
const OUTPUT_ROOT = path.join(process.cwd(), "data", "destiny-manifest");
const TABLE_DIR = path.join(OUTPUT_ROOT, "en");
const TEMP_TABLE_DIR = path.join(OUTPUT_ROOT, ".tmp-en");
const MANIFEST_FILE = path.join(OUTPUT_ROOT, "manifest.json");
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shouldRetryStatus(status) {
  return status === 429 || status >= 500;
}

async function fetchWithRetry(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    let response;

    try {
      response = await fetch(url);
    } catch (error) {
      lastError = error;
    }

    if (response?.ok) {
      return response;
    }

    if (response) {
      const message = `Failed to fetch ${label}: ${response.status} ${response.statusText}`;
      lastError = new Error(message);

      if (!shouldRetryStatus(response.status)) {
        throw lastError;
      }
    }

    if (attempt < MAX_FETCH_ATTEMPTS) {
      console.warn(`Retrying ${label} after fetch failure (${attempt}/${MAX_FETCH_ATTEMPTS})`);
      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${label}`);
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, url);

  return response.json();
}

function getEnglishTableEntries(manifest) {
  const englishTables = manifest?.jsonWorldComponentContentPaths?.en;

  if (!englishTables) {
    throw new Error("Manifest did not include English JSON world component paths");
  }

  return Object.entries(englishTables).sort(([leftName], [rightName]) =>
    leftName.localeCompare(rightName)
  );
}

async function downloadCompressedTable(definitionType, tablePath) {
  const tableUrl = `${BUNGIE_BASE_URL}${tablePath}`;
  const response = await fetchWithRetry(tableUrl, definitionType);

  if (!response.body) {
    throw new Error(`Failed to fetch ${definitionType}: response body was empty`);
  }

  const outputPath = path.join(TEMP_TABLE_DIR, `${definitionType}.json.gz`);
  await pipeline(
    Readable.fromWeb(response.body),
    createGzip({ level: 9, mtime: 0 }),
    createWriteStream(outputPath)
  );
}

async function replaceStaticTables() {
  await rm(TABLE_DIR, { recursive: true, force: true });
  await rename(TEMP_TABLE_DIR, TABLE_DIR);
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await rm(TEMP_TABLE_DIR, { recursive: true, force: true });
  await mkdir(TEMP_TABLE_DIR, { recursive: true });

  const manifestResponse = await fetchJson(MANIFEST_URL);
  const manifest = manifestResponse.Response;
  const tableEntries = getEnglishTableEntries(manifest);

  console.log(`Downloading Destiny manifest ${manifest.version}`);
  console.log(`Found ${tableEntries.length} English definition tables`);

  for (const [definitionType, tablePath] of tableEntries) {
    console.log(`Downloading ${definitionType}`);
    await downloadCompressedTable(definitionType, tablePath);
  }

  await replaceStaticTables();
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifestResponse, null, 2)}\n`, "utf8");

  console.log(`Stored ${tableEntries.length} tables in ${TABLE_DIR}`);
}

main().catch(async (error) => {
  await rm(TEMP_TABLE_DIR, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
