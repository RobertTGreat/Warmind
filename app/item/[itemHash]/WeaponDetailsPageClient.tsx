"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { usePlugSetDefinitions } from "@/hooks/usePlugSetDefinitions";
import { getBungieImage } from "@/lib/bungie";
import {
  buildWeaponSocketGroups,
  collectWeaponPlugHashes,
  getMasterworkPlugInfo,
  getWeaponPlugSetHashes,
  isFunctionalWeaponPerk,
  type WeaponPlugOption,
  type WeaponSocketGroup,
} from "@/lib/weaponPlugAnalysis";
import { cn } from "@/lib/utils";

interface WeaponDetailsPageClientProps {
  itemHash: number;
}

interface OwnedWeaponCopy {
  itemHash: number;
  itemInstanceId: string;
  ownerId: string;
  ownerName: string;
  locationName: string;
}

const weaponStatHashes = [
  4043523819, // Impact
  1240592695, // Range
  155624089, // Stability
  943549884, // Handling
  4188031367, // Reload Speed
  4284893193, // Rounds Per Minute
  3871231066, // Magazine
];

function getCharacterOwnerName(profile: any, characterId: string): string {
  const character = profile?.characters?.data?.[characterId];
  const classNames: Record<number, string> = {
    0: "Titan",
    1: "Hunter",
    2: "Warlock",
  };

  return character ? classNames[character.classType] ?? "Character" : "Character";
}

function getOwnedWeaponCopies(profile: any, itemHash: number): OwnedWeaponCopy[] {
  const copies: OwnedWeaponCopy[] = [];
  const addCopy = (item: any, ownerId: string, locationName: string) => {
    if (item?.itemHash !== itemHash || !item?.itemInstanceId) return;

    copies.push({
      itemHash: item.itemHash,
      itemInstanceId: item.itemInstanceId,
      ownerId,
      ownerName:
        ownerId === "VAULT" ? "Vault" : getCharacterOwnerName(profile, ownerId),
      locationName,
    });
  };

  for (const [characterId, inventory] of Object.entries(
    profile?.characterInventories?.data ?? {}
  )) {
    for (const item of (inventory as any)?.items ?? []) {
      addCopy(item, characterId, "Inventory");
    }
  }

  for (const [characterId, equipment] of Object.entries(
    profile?.characterEquipment?.data ?? {}
  )) {
    for (const item of (equipment as any)?.items ?? []) {
      addCopy(item, characterId, "Equipped");
    }
  }

  for (const item of profile?.profileInventory?.data?.items ?? []) {
    addCopy(item, "VAULT", "Vault");
  }

  return copies;
}

function getSocketColumnTitle(socketGroup: WeaponSocketGroup): string {
  const activePlug = socketGroup.activePlugDefinition;
  const typeName = activePlug?.itemTypeDisplayName;
  const category = socketGroup.categoryIdentifier;

  if (socketGroup.isIntrinsic) return "Intrinsic";
  if (socketGroup.isMasterworkColumn) return "Masterwork";
  if (socketGroup.isOriginColumn) return "Origin Trait";
  if (typeName) return typeName;
  if (category.includes("barrels")) return "Barrel";
  if (category.includes("magazines")) return "Magazine";

  return `Column ${socketGroup.socketIndex + 1}`;
}

function getOptionIcon(option: WeaponPlugOption): string | null {
  const icon = option.definition?.displayProperties?.icon;
  return icon ? getBungieImage(icon) : null;
}

function getDefinitionStatValue(itemDefinition: any, statHash: number): number | null {
  const stat = itemDefinition?.stats?.stats?.[statHash];
  const investmentStat = itemDefinition?.investmentStats?.find(
    (candidate: any) => candidate.statTypeHash === statHash
  );

  return stat?.value ?? investmentStat?.value ?? null;
}

function PossiblePerkOption({ option }: { option: WeaponPlugOption }) {
  const icon = getOptionIcon(option);
  const name = option.definition?.displayProperties?.name ?? String(option.plugHash);
  const description = option.definition?.displayProperties?.description;

  return (
    <div
      className={cn(
        "flex gap-3 border border-white/10 bg-slate-950/70 p-2",
        option.isActive && "border-destiny-gold/70 bg-destiny-gold/10"
      )}
    >
      <div className="relative h-10 w-10 shrink-0 bg-slate-900">
        {icon && (
          <Image
            src={icon}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-white">{name}</h4>
          {option.isEnhanced && (
            <span className="border border-cyan-300/40 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-200">
              Enhanced
            </span>
          )}
          {option.isActive && (
            <span className="border border-destiny-gold/40 bg-destiny-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destiny-gold">
              Equipped
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function SocketColumn({ socketGroup }: { socketGroup: WeaponSocketGroup }) {
  const functionalOptions = socketGroup.options.filter((option) =>
    socketGroup.isMasterworkColumn
      ? option.isMasterwork
      : isFunctionalWeaponPerk(option.definition)
  );
  const optionsToRender = functionalOptions.length > 0 ? functionalOptions : socketGroup.options;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3 border-b border-white/10 pb-2">
        <div>
          <h3 className="font-condensed text-xl font-semibold uppercase text-white">
            {getSocketColumnTitle(socketGroup)}
          </h3>
          <p className="text-xs text-slate-500">
            Socket {socketGroup.socketIndex + 1}
          </p>
        </div>
        <span className="text-xs text-slate-500">{optionsToRender.length}</span>
      </div>

      <div className="space-y-2">
        {optionsToRender.map((option) => (
          <PossiblePerkOption key={option.plugHash} option={option} />
        ))}
      </div>
    </section>
  );
}

export function WeaponDetailsPageClient({ itemHash }: WeaponDetailsPageClientProps) {
  const searchParams = useSearchParams();
  const requestedInstanceId = searchParams.get("instanceId") ?? undefined;
  const { profile, isLoggedIn } = useDestinyProfileContext();
  const { definitions } = useItemDefinitions(Number.isFinite(itemHash) ? [itemHash] : []);
  const itemDefinition = definitions[itemHash];
  const ownedCopies = useMemo(
    () => getOwnedWeaponCopies(profile, itemHash),
    [profile, itemHash]
  );
  const selectedCopy = useMemo(() => {
    if (!requestedInstanceId) return undefined;

    return ownedCopies.find((copy) => copy.itemInstanceId === requestedInstanceId);
  }, [ownedCopies, requestedInstanceId]);
  const selectedInstanceId = selectedCopy?.itemInstanceId ?? requestedInstanceId;
  const instanceData = selectedInstanceId
    ? profile?.itemComponents?.instances?.data?.[selectedInstanceId]
    : undefined;
  const socketsData = selectedInstanceId
    ? profile?.itemComponents?.sockets?.data?.[selectedInstanceId]
    : undefined;
  const reusablePlugsData = selectedInstanceId
    ? profile?.itemComponents?.reusablePlugs?.data?.[selectedInstanceId]?.plugs
    : undefined;
  const plugSetHashes = useMemo(
    () => getWeaponPlugSetHashes(itemDefinition),
    [itemDefinition]
  );
  const { plugSetDefinitions } = usePlugSetDefinitions(plugSetHashes);
  const plugHashes = useMemo(
    () =>
      collectWeaponPlugHashes({
        itemDefinition,
        socketsData,
        reusablePlugsData,
        plugSetDefinitions,
      }),
    [itemDefinition, socketsData, reusablePlugsData, plugSetDefinitions]
  );
  const { definitions: plugDefinitions } = useItemDefinitions(plugHashes);
  const socketGroups = useMemo(
    () =>
      buildWeaponSocketGroups({
        itemDefinition,
        socketsData,
        reusablePlugsData,
        plugDefinitions,
        plugSetDefinitions,
      }),
    [itemDefinition, socketsData, reusablePlugsData, plugDefinitions, plugSetDefinitions]
  );
  const perkColumns = socketGroups.filter(
    (socketGroup) => socketGroup.isPerkColumn || socketGroup.isOriginColumn
  );
  const masterworkInfo = getMasterworkPlugInfo(socketGroups);
  const screenshot = itemDefinition?.screenshot
    ? getBungieImage(itemDefinition.screenshot)
    : null;
  const icon = itemDefinition?.displayProperties?.icon
    ? getBungieImage(itemDefinition.displayProperties.icon)
    : null;

  if (!Number.isFinite(itemHash)) {
    return <div className="text-red-300">Invalid item hash.</div>;
  }

  if (!itemDefinition) {
    return <div className="text-slate-400">Loading weapon details...</div>;
  }

  const isWeapon = itemDefinition.itemType === 3;
  const title = itemDefinition.displayProperties?.name ?? `Item ${itemHash}`;
  const description = itemDefinition.displayProperties?.description;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="relative min-h-[300px] overflow-hidden border border-white/10 bg-slate-950">
        {screenshot && (
          <Image
            src={screenshot}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20" />
        <div className="relative z-10 flex min-h-[300px] flex-col justify-end gap-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-end gap-5">
            {icon && (
              <div className="relative h-20 w-20 border-2 border-white/20 bg-slate-900">
                <Image src={icon} alt="" fill sizes="80px" className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-condensed text-sm font-semibold uppercase tracking-wide text-destiny-gold">
                {itemDefinition.inventory?.tierTypeName} {itemDefinition.itemTypeDisplayName}
              </p>
              <h1 className="font-condensed text-5xl font-bold uppercase leading-none text-white sm:text-6xl">
                {title}
              </h1>
              {description && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="border border-white/10 bg-black/30 px-2 py-1">
              Hash {itemHash}
            </span>
            {instanceData?.primaryStat?.value && (
              <span className="border border-destiny-gold/30 bg-destiny-gold/10 px-2 py-1 text-destiny-gold">
                Power {instanceData.primaryStat.value}
              </span>
            )}
            {selectedCopy && (
              <span className="border border-white/10 bg-black/30 px-2 py-1">
                {selectedCopy.locationName} on {selectedCopy.ownerName}
              </span>
            )}
          </div>
        </div>
      </section>

      {!isWeapon && (
        <div className="border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          This details view is optimized for weapon rolls. This item loaded, but it is
          not a weapon.
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_280px]">
        <main className="space-y-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-condensed text-3xl font-semibold uppercase text-white">
                  Possible Roll
                </h2>
                <p className="text-sm text-slate-400">
                  All socket options available from the manifest, with your selected roll highlighted when an instance is open.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {perkColumns.map((socketGroup) => (
                <SocketColumn key={socketGroup.socketIndex} socketGroup={socketGroup} />
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h2 className="font-condensed text-3xl font-semibold uppercase text-white">
                Masterwork
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Active and available masterwork plugs are read from the same live reusable plug data as user rolls.
              </p>
            </div>
            <div className="space-y-2">
              {masterworkInfo.availablePlugs.length > 0 ? (
                masterworkInfo.availablePlugs.map((option) => (
                  <PossiblePerkOption key={option.plugHash} option={option} />
                ))
              ) : (
                <div className="border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">
                  No masterwork plugs were exposed for this weapon.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-condensed text-3xl font-semibold uppercase text-white">
              Stats
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {weaponStatHashes.map((statHash) => {
                const value =
                  instanceData?.stats?.[statHash]?.value ??
                  instanceData?.stats?.[String(statHash)]?.value ??
                  getDefinitionStatValue(itemDefinition, statHash);

                if (value === null || value === undefined) return null;

                return (
                  <div key={statHash} className="border border-white/10 bg-slate-950/70 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{statHash}</span>
                      <span className="font-semibold text-white">{value}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-800">
                      <div
                        className="h-full bg-destiny-gold"
                        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="border border-white/10 bg-slate-950/70 p-4">
            <h2 className="font-condensed text-2xl font-semibold uppercase text-white">
              Your Copies
            </h2>
            <div className="mt-3 space-y-2">
              {isLoggedIn && ownedCopies.length > 0 ? (
                ownedCopies.map((copy) => (
                  <Link
                    key={copy.itemInstanceId}
                    href={`/item/${itemHash}?instanceId=${copy.itemInstanceId}&ownerId=${copy.ownerId}`}
                    className={cn(
                      "block border border-white/10 bg-black/20 p-3 text-sm text-slate-300 transition-colors hover:border-white/30 hover:text-white",
                      copy.itemInstanceId === selectedInstanceId &&
                        "border-destiny-gold/60 text-destiny-gold"
                    )}
                  >
                    <span className="block font-semibold">{copy.ownerName}</span>
                    <span className="text-xs text-slate-500">{copy.locationName}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  {isLoggedIn
                    ? "No owned copies found in the loaded profile."
                    : "Log in to compare this database roll with your own copies."}
                </p>
              )}
            </div>
          </section>

          <section className="border border-white/10 bg-slate-950/70 p-4">
            <h2 className="font-condensed text-2xl font-semibold uppercase text-white">
              Enhancements
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-3">
                <span>Enhanced options</span>
                <span className="text-cyan-200">
                  {
                    socketGroups.flatMap((socketGroup) =>
                      socketGroup.options.filter((option) => option.isEnhanced)
                    ).length
                  }
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Masterwork tier</span>
                <span className="text-destiny-gold">
                  {masterworkInfo.tier ? `Tier ${masterworkInfo.tier}` : "Unknown"}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
