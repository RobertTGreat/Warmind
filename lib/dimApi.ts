const DEFAULT_DIM_API_BASE_URL = "https://api.destinyitemmanager.com";
const DIM_PROFILE_COMPONENTS = ["tags", "notes", "loadouts"] as const;

export type DimSyncAccount = {
  membershipId: string;
  membershipType?: number;
};

export type DimProfileSyncResponse = {
  syncToken?: string;
  tags?: unknown;
  notes?: unknown;
  loadouts?: unknown;
  [key: string]: unknown;
};

export type DimProfileUpdate = {
  type: string;
  payload: unknown;
};

function getDimApiBaseUrl() {
  return process.env.NEXT_PUBLIC_DIM_API_BASE_URL ?? DEFAULT_DIM_API_BASE_URL;
}

async function requestDimApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getDimApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`DIM API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getDimApiProfile(
  account: DimSyncAccount,
  syncToken?: string | null,
) {
  const params = new URLSearchParams({
    platformMembershipId: account.membershipId,
    components: DIM_PROFILE_COMPONENTS.join(","),
  });

  if (account.membershipType !== undefined) {
    params.set("membershipType", String(account.membershipType));
  }

  if (syncToken) {
    params.set("sync", syncToken);
  }

  return requestDimApi<DimProfileSyncResponse>(`/profile?${params.toString()}`);
}

export function postDimApiUpdates(
  platformMembershipId: string,
  updates: DimProfileUpdate[],
) {
  return requestDimApi<DimProfileSyncResponse>("/profile", {
    method: "POST",
    body: JSON.stringify({
      platformMembershipId,
      updates,
    }),
  });
}
