export type ClanMemberTag = {
  label: string;
  className: string;
};

export const SPECIAL_CLAN_MEMBER_TAGS: Record<string, ClanMemberTag[]> = {
  "RobertTheGreat#437": [
    {
      label: "Murder Cave",
      className: "bg-red-900/40 text-red-200 border-red-500/50",
    },
    {
      label: "Dev",
      className:
        "bg-destiny-gold/20 text-destiny-gold border-destiny-gold/50",
    },
  ],
  "Robert#1516": [
    {
      label: "Murder Cave",
      className: "bg-red-900/40 text-red-200 border-red-500/50",
    },
    {
      label: "Dev",
      className:
        "bg-destiny-gold/20 text-destiny-gold border-destiny-gold/50",
    },
  ],
  "Cavez#4930": [
    {
      label: "Murder Cave",
      className: "bg-red-900/40 text-red-200 border-red-500/50",
    },
    {
      label: "Saltagreppo Glazer",
      className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/50",
    },
  ],
  "Tesco Self Checkout#5687": [
    {
      label: "Murder Cave",
      className: "bg-red-900/40 text-red-200 border-red-500/50",
    },
  ],
  "Scryocat#5270": [
    {
      label: "Murder Cave",
      className: "bg-red-900/40 text-red-200 border-red-500/50",
    },
  ],
};

function normalizeBungieName(displayName: string): string {
  return displayName.trim().toLowerCase();
}

export function getClanMemberTags(displayName: string | null | undefined) {
  const normalizedDisplayName = normalizeBungieName(displayName ?? "");

  if (!normalizedDisplayName) {
    return [];
  }

  const matchingEntry = Object.entries(SPECIAL_CLAN_MEMBER_TAGS).find(
    ([bungieName]) => normalizeBungieName(bungieName) === normalizedDisplayName,
  );

  return matchingEntry?.[1] ?? [];
}

export function getClanMemberTagLabels(
  displayName: string | null | undefined,
): string[] {
  return getClanMemberTags(displayName).map((tag) => tag.label);
}

export function getClanMemberTagsDescription(
  displayName: string | null | undefined,
): string | null {
  const labels = getClanMemberTagLabels(displayName);

  if (labels.length === 0) {
    return null;
  }

  return labels.join(" · ");
}
