export interface VendorProgressionState {
  progressionHash: number;
  level: number;
  stepIndex: number;
  currentProgress: number;
  progressToNextLevel: number;
  nextLevelAt: number;
  currentResetCount?: number;
  dailyProgress?: number;
  dailyLimit?: number;
  weeklyProgress?: number;
  weeklyLimit?: number;
}

export interface VendorReputationDisplay {
  icon?: string;
  rankLabel: string;
  stepLabel?: string;
  totalProgress: number;
  stepProgressLabel?: string;
  stepProgressPercent: number;
  resetProgressLabel?: string;
  resetProgressPercent?: number;
}

function getProgressionStep(progressionDefinition: any, stepIndex: number) {
  const steps = progressionDefinition?.steps;
  if (!Array.isArray(steps) || stepIndex < 0 || stepIndex >= steps.length) {
    return undefined;
  }

  return steps[stepIndex];
}

export function buildVendorReputationDisplay({
  vendorName,
  progression,
  progressionDefinition,
  factionIcon,
}: {
  vendorName: string;
  progression?: VendorProgressionState;
  progressionDefinition?: any;
  factionIcon?: string;
}): VendorReputationDisplay | null {
  if (!progression || !progressionDefinition) {
    return null;
  }

  const step = getProgressionStep(progressionDefinition, progression.stepIndex);
  const progressionName =
    progressionDefinition.displayProperties?.name?.trim() || vendorName;
  const stepLabel =
    step?.stepDisplayProperties?.name?.trim() ||
    step?.progressionDisplayProperties?.name?.trim();
  const rankLabel = `${progressionName} ${progression.level}`;
  const stepTotal = progression.nextLevelAt > 0 ? progression.nextLevelAt : 0;
  const stepEarned =
    stepTotal > 0
      ? Math.max(0, stepTotal - progression.progressToNextLevel)
      : 0;
  const stepProgressPercent =
    stepTotal > 0 ? Math.min(100, (stepEarned / stepTotal) * 100) : 0;
  const stepProgressLabel =
    stepTotal > 0 ? `${stepEarned} (${stepTotal})` : undefined;

  let resetProgressLabel: string | undefined;
  let resetProgressPercent: number | undefined;

  if (progression.dailyLimit && progression.dailyLimit > 0) {
    resetProgressLabel = `${progression.dailyProgress ?? 0} (${progression.dailyLimit})`;
    resetProgressPercent = Math.min(
      100,
      ((progression.dailyProgress ?? 0) / progression.dailyLimit) * 100
    );
  } else if (progression.weeklyLimit && progression.weeklyLimit > 0) {
    resetProgressLabel = `${progression.weeklyProgress ?? 0} (${progression.weeklyLimit})`;
    resetProgressPercent = Math.min(
      100,
      ((progression.weeklyProgress ?? 0) / progression.weeklyLimit) * 100
    );
  }

  return {
    icon:
      factionIcon ||
      progressionDefinition.displayProperties?.icon ||
      step?.progressionDisplayProperties?.icon,
    rankLabel,
    stepLabel,
    totalProgress: progression.currentProgress,
    stepProgressLabel,
    stepProgressPercent,
    resetProgressLabel,
    resetProgressPercent,
  };
}

export function collectVendorProgressionHashes(
  vendorsData?: {
    vendors?: {
      data?: Record<
        string,
        {
          progression?: {
            progressionHash?: number;
          };
        }
      >;
    };
  }
) {
  const progressionHashes = new Set<number>();

  for (const vendorComponent of Object.values(vendorsData?.vendors?.data ?? {})) {
    const progressionHash = vendorComponent.progression?.progressionHash;
    if (progressionHash) {
      progressionHashes.add(progressionHash);
    }
  }

  return [...progressionHashes];
}

export function collectVendorFactionHashes(
  vendorDefinitions: Record<number, { factionHash?: number }>
) {
  const factionHashes = new Set<number>();

  for (const vendorDefinition of Object.values(vendorDefinitions)) {
    if (vendorDefinition.factionHash) {
      factionHashes.add(vendorDefinition.factionHash);
    }
  }

  return [...factionHashes];
}
