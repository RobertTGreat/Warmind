type DefinitionHash = number | string;

function buildManifestTableUrl(definitionType: string, view?: string) {
  const params = new URLSearchParams();

  if (view) {
    params.set("view", view);
  }

  const query = params.toString();
  return `/api/manifest-table/${definitionType}${query ? `?${query}` : ""}`;
}

export async function fetchManifestDefinitions<T = any>(
  definitionType: string,
  hashes: DefinitionHash[],
  view?: string
) {
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

  return response.json() as Promise<Record<string, T>>;
}
