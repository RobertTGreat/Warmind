import { getManifestDefinitions } from "@/lib/manifestRepository";

type DefinitionHash = number | string;

export async function fetchManifestDefinitions<T = any>(
  definitionType: string,
  hashes: DefinitionHash[],
  view?: string
) {
  return getManifestDefinitions<T>(definitionType, hashes, { view });
}
