export interface ClarityDescription {
  hash: number;
  name: string;
  type?: string;
  lines: string[];
}

interface ClarityLineContent {
  text?: string;
}

interface ClarityDescriptionBlock {
  classNames?: string[];
  linesContent?: ClarityLineContent[];
}

export interface ClarityDatabaseEntry {
  hash?: number;
  name?: string;
  type?: string;
  descriptions?: {
    en?: string | ClarityDescriptionBlock[];
  };
}

export type ClarityDatabase = Record<string, ClarityDatabaseEntry>;

function getBlockText(block: ClarityDescriptionBlock): string {
  if (block.classNames?.includes("spacer")) {
    return "";
  }

  return (block.linesContent ?? [])
    .map((lineContent) => lineContent.text ?? "")
    .join("")
    .trim();
}

function getDescriptionLines(entry: ClarityDatabaseEntry): string[] {
  const englishDescription = entry.descriptions?.en;

  if (typeof englishDescription === "string") {
    return englishDescription ? [englishDescription] : [];
  }

  if (!Array.isArray(englishDescription)) {
    return [];
  }

  return englishDescription
    .map(getBlockText)
    .filter((line, index, lines) => line || Boolean(lines[index - 1]));
}

export function parseClarityDescription(
  entry: ClarityDatabaseEntry | undefined
): ClarityDescription | null {
  if (!entry?.hash || !entry.name) {
    return null;
  }

  const lines = getDescriptionLines(entry);

  if (lines.length === 0) {
    return null;
  }

  return {
    hash: entry.hash,
    name: entry.name,
    type: entry.type,
    lines,
  };
}

export function getClarityDescriptionsForHashes(
  clarityDatabase: ClarityDatabase,
  hashes: number[]
): Record<number, ClarityDescription> {
  const descriptions: Record<number, ClarityDescription> = {};

  for (const hash of hashes) {
    const description = parseClarityDescription(clarityDatabase[String(hash)]);

    if (description) {
      descriptions[hash] = description;
    }
  }

  return descriptions;
}
