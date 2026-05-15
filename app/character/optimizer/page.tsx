'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { getBungieImage, moveItem, equipItem } from '@/lib/bungie';

// Lazy load heavy item card component
const DestinyItemCard = dynamic(
  () => import('@/components/DestinyItemCard').then((mod) => mod.DestinyItemCard),
  { ssr: false }
);
import { BUCKETS } from '@/lib/destinyUtils';
import { useOptimizerStore } from '@/store/optimizerStore';
import { useLoadoutStore, CustomLoadout } from '@/store/loadoutStore';
import { 
    ArmorPiece, 
    ArmorStats, 
    ArmorSet, 
    StatConstraints,
    OptimizerSettings,
    ExoticFilter,
    extractArmorPiece,
    findOptimalArmorSets,
    createEmptyStats,
    getTiers,
    getWastedStats,
    getStatBreakdown,
    getExoticsBySlot,
    calculateSubclassBonus,
    getStatTier,
    STAT_NAMES,
    STAT_DESCRIPTIONS,
    STAT_COLORS,
    ALL_STAT_KEYS,
    MAX_STAT_VALUE,
    MAX_TIER,
    STAT_PER_TIER,
    SUBCLASS_FRAGMENTS,
    SUBCLASS_COLORS,
} from '@/lib/armorOptimizer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Image from 'next/image';
import { 
    Zap, 
    Settings, 
    Play, 
    ChevronDown,
    ChevronUp,
    Loader2,
    Target,
    Award,
    Sparkles,
    Info,
    AlertTriangle,
    X,
    ChevronRight,
    Gem,
    BookOpen,
    Eye,
    EyeOff,
    RotateCcw,
    Layers,
    Search,
    Save,
    Bookmark,
    Filter
} from 'lucide-react';
import { loginWithBungie } from '@/lib/bungie';
import { motion, AnimatePresence } from 'framer-motion';

// ===== Fragment Data with Hashes and Icons =====
const FRAGMENT_ICONS: Record<string, { hash: number; icon: string }> = {
    // Solar Fragments
    'Ember of Ashes': { hash: 1051276349, icon: 'https://www.bungie.net/common/destiny2_content/icons/82203cd4545f6dccc3b231d138664ecd.jpg' },
    'Ember of Beams': { hash: 362132295, icon: 'https://www.bungie.net/common/destiny2_content/icons/2f12ba3df56de7c0e2790f481cb29a52.jpg' },
    'Ember of Benevolence': { hash: 362132292, icon: 'https://www.bungie.net/common/destiny2_content/icons/0b5cf537c6ad5d80cbdd3675d0e7134d.jpg' },
    'Ember of Blistering': { hash: 362132301, icon: 'https://www.bungie.net/common/destiny2_content/icons/52dc6ef9a4b0642e36551542b3a2936e.jpg' },
    'Ember of Char': { hash: 362132291, icon: 'https://www.bungie.net/common/destiny2_content/icons/a299dde35bfcd830923458846d7a64f3.jpg' },
    'Ember of Combustion': { hash: 362132289, icon: 'https://www.bungie.net/common/destiny2_content/icons/45476d85d0e6aeded810f217a0627afb.jpg' },
    'Ember of Empyrean': { hash: 362132294, icon: 'https://www.bungie.net/common/destiny2_content/icons/be99d52c12f9359fc948b4563f74e712.jpg' },
    'Ember of Eruption': { hash: 1051276348, icon: 'https://www.bungie.net/common/destiny2_content/icons/8734774377b5e73a84ed045a78ce232c.jpg' },
    'Ember of Mercy': { hash: 4180586737, icon: 'https://www.bungie.net/common/destiny2_content/icons/5ca8c8de03f981b9c984a1f2bdea0f61.jpg' },
    'Ember of Resolve': { hash: 4180586736, icon: 'https://www.bungie.net/common/destiny2_content/icons/24b60501785856e2898417115e3b2afd.jpg' },
    'Ember of Searing': { hash: 1051276351, icon: 'https://www.bungie.net/common/destiny2_content/icons/7312346d93dc0e84d46e539a10aebb52.jpg' },
    'Ember of Singeing': { hash: 362132293, icon: 'https://www.bungie.net/common/destiny2_content/icons/c9e392abb5417ecab2dccd85fe23c00f.jpg' },
    'Ember of Solace': { hash: 362132300, icon: 'https://www.bungie.net/common/destiny2_content/icons/fb46711e0dff2bc2f55c21271e838fe2.jpg' },
    'Ember of Tempering': { hash: 362132290, icon: 'https://www.bungie.net/common/destiny2_content/icons/cddc93648f0917dc8bd6663d38d7c379.jpg' },
    'Ember of Torches': { hash: 362132288, icon: 'https://www.bungie.net/common/destiny2_content/icons/1ef2e34dad0d52c762ed96e8c932dc38.jpg' },
    'Ember of Wonder': { hash: 1051276350, icon: 'https://www.bungie.net/common/destiny2_content/icons/9de7766c9c9b56b75bde1054e3eefb1a.jpg' },
    // Void Fragments
    'Echo of Cessation': { hash: 3854948620, icon: 'https://www.bungie.net/common/destiny2_content/icons/d355e5ee66fd28b82d93a0f2dd895b2d.jpg' },
    'Echo of Dilation': { hash: 2272984656, icon: 'https://www.bungie.net/common/destiny2_content/icons/029faa3dc0d82eefef581dec7820d643.jpg' },
    'Echo of Domineering': { hash: 2272984657, icon: 'https://www.bungie.net/common/destiny2_content/icons/958ff340ae4ce16d7cf71c5268a13919.jpg' },
    'Echo of Exchange': { hash: 2272984667, icon: 'https://www.bungie.net/common/destiny2_content/icons/e5a6ac0f38df212a40dc541bb46f354f.jpg' },
    'Echo of Expulsion': { hash: 2272984665, icon: 'https://www.bungie.net/common/destiny2_content/icons/d6500235bb175f0fc3752cab0a170fd2.jpg' },
    'Echo of Harvest': { hash: 2661180601, icon: 'https://www.bungie.net/common/destiny2_content/icons/6bd23524f7129761043724acbe90c7b5.jpg' },
    'Echo of Instability': { hash: 2661180600, icon: 'https://www.bungie.net/common/destiny2_content/icons/0ad46f9c0c14535c4d5776daf48e871e.jpg' },
    'Echo of Leeching': { hash: 2272984670, icon: 'https://www.bungie.net/common/destiny2_content/icons/6aa22ca5ba309f264af5231969ec840a.jpg' },
    'Echo of Obscurity': { hash: 2661180602, icon: 'https://www.bungie.net/common/destiny2_content/icons/7d711ce4bcfb264da29c289ff70b9876.jpg' },
    'Echo of Persistence': { hash: 2272984671, icon: 'https://www.bungie.net/common/destiny2_content/icons/914309029085289921f77d8207765150.jpg' },
    'Echo of Provision': { hash: 2272984664, icon: 'https://www.bungie.net/common/destiny2_content/icons/1c16b5205d6a648b9898cce6ac3a01b3.jpg' },
    'Echo of Remnants': { hash: 2272984666, icon: 'https://www.bungie.net/common/destiny2_content/icons/ce12bd0f246e834c8f7e102079814bf9.jpg' },
    'Echo of Reprisal': { hash: 2272984669, icon: 'https://www.bungie.net/common/destiny2_content/icons/6a0118280ba432e796048648993d7765.jpg' },
    'Echo of Starvation': { hash: 2661180603, icon: 'https://www.bungie.net/common/destiny2_content/icons/19219ecd56fef82e9ead65aed8fea63a.jpg' },
    'Echo of Undermining': { hash: 2272984668, icon: 'https://www.bungie.net/common/destiny2_content/icons/b114e9d97c42a68b19ab7876a221b354.jpg' },
    'Echo of Vigilance': { hash: 3854948621, icon: 'https://www.bungie.net/common/destiny2_content/icons/91e0f86be9e41faf06994faf41d818af.jpg' },
    // Arc Fragments
    'Spark of Amplitude': { hash: 3277705906, icon: 'https://www.bungie.net/common/destiny2_content/icons/4138dfce109db20c49877c08852f13a8.jpg' },
    'Spark of Beacons': { hash: 1727069367, icon: 'https://www.bungie.net/common/destiny2_content/icons/8924af183dc3e6200536171a72c9fd77.jpg' },
    'Spark of Brilliance': { hash: 3277705905, icon: 'https://www.bungie.net/common/destiny2_content/icons/d38a4297cfe3ec89427f68ef92b076e5.jpg' },
    'Spark of Discharge': { hash: 1727069362, icon: 'https://www.bungie.net/common/destiny2_content/icons/c883bf91f42e9c4b9c9ddce1ba2d2de5.jpg' },
    'Spark of Feedback': { hash: 3277705907, icon: 'https://www.bungie.net/common/destiny2_content/icons/58a935c2948d5f20d060bc87a0ad25d2.jpg' },
    'Spark of Focus': { hash: 1727069360, icon: 'https://www.bungie.net/common/destiny2_content/icons/cfcdcc8f7d07111f6079ad8f869273c6.jpg' },
    'Spark of Frequency': { hash: 1727069361, icon: 'https://www.bungie.net/common/destiny2_content/icons/4979f2f84c3da353c19815106267beb9.jpg' },
    'Spark of Haste': { hash: 3478354817, icon: 'https://www.bungie.net/common/destiny2_content/icons/e840532ca79e23311804760b3833e6bb.jpg' },
    'Spark of Instinct': { hash: 3478354816, icon: 'https://www.bungie.net/common/destiny2_content/icons/eb9c8ec91e56b1410457aecae09ceeed.jpg' },
    'Spark of Ions': { hash: 1727069363, icon: 'https://www.bungie.net/common/destiny2_content/icons/2a7f5d325fc745877be70c443427d15b.jpg' },
    'Spark of Magnitude': { hash: 1727069374, icon: 'https://www.bungie.net/common/destiny2_content/icons/0b39167c8fc628482dea26cf43d78ec9.jpg' },
    'Spark of Momentum': { hash: 1727069365, icon: 'https://www.bungie.net/common/destiny2_content/icons/b8cfaccdc40ccdd6a3fb4f544dcb7700.jpg' },
    'Spark of Recharge': { hash: 1727069375, icon: 'https://www.bungie.net/common/destiny2_content/icons/10b793e347263d81cc0404acf91aadc7.jpg' },
    'Spark of Resistance': { hash: 1727069366, icon: 'https://www.bungie.net/common/destiny2_content/icons/d92e1a6770ebbb509ceda1c6ab545e43.jpg' },
    'Spark of Shock': { hash: 1727069364, icon: 'https://www.bungie.net/common/destiny2_content/icons/2f49889b1fe7bcf01ef12b2cdc0fb511.jpg' },
    'Spark of Volts': { hash: 3277705904, icon: 'https://www.bungie.net/common/destiny2_content/icons/bb6175746eecf3160a591efe343a3fdf.jpg' },
    // Stasis Fragments
    'Whisper of Bonds': { hash: 3469412974, icon: 'https://www.bungie.net/common/destiny2_content/icons/12b591b2720cc265d800e870484f6d5b.png' },
    'Whisper of Chains': { hash: 537774540, icon: 'https://www.bungie.net/common/destiny2_content/icons/d764e09a79be71fb5d37e612e610cf18.png' },
    'Whisper of Chill': { hash: 2368990401, icon: 'https://www.bungie.net/common/destiny2_content/icons/eda4be269ee2122f02359e12d2cd7fb7.png' },
    'Whisper of Conduction': { hash: 2483898429, icon: 'https://www.bungie.net/common/destiny2_content/icons/2d84a595d269762c434718e34d2e7d78.png' },
    'Whisper of Durance': { hash: 3469412969, icon: 'https://www.bungie.net/common/destiny2_content/icons/263713a8639fb73350c13b5b520fefa2.png' },
    'Whisper of Fissures': { hash: 3469412971, icon: 'https://www.bungie.net/common/destiny2_content/icons/9eaa93107ad40372c335ce495273c318.png' },
    'Whisper of Fractures': { hash: 537774542, icon: 'https://www.bungie.net/common/destiny2_content/icons/a28274406a8a0e7ec916a33ec830ba6f.png' },
    'Whisper of Hedrons': { hash: 3469412970, icon: 'https://www.bungie.net/common/destiny2_content/icons/70b60b70634c6e539a531d47e58e1b9f.png' },
    'Whisper of Hunger': { hash: 2483898431, icon: 'https://www.bungie.net/common/destiny2_content/icons/549368f903ac85dc177a56555ce69ae7.png' },
    'Whisper of Impetus': { hash: 537774543, icon: 'https://www.bungie.net/common/destiny2_content/icons/710c5e3aec26f0e3e468c656a2669e0d.png' },
    'Whisper of Refraction': { hash: 3469412968, icon: 'https://www.bungie.net/common/destiny2_content/icons/5c9285f7b0320f56a560ce9c0aa65043.png' },
    'Whisper of Rending': { hash: 2483898428, icon: 'https://www.bungie.net/common/destiny2_content/icons/a315a6aaba35eba7f021fbea22e5e0ba.png' },
    'Whisper of Reversal': { hash: 2368990400, icon: 'https://www.bungie.net/common/destiny2_content/icons/b49e2d59fa7cf666045c38f01655230d.png' },
    'Whisper of Rime': { hash: 2483898430, icon: 'https://www.bungie.net/common/destiny2_content/icons/0ec49820a6de05851c099cf7fb5d7554.png' },
    'Whisper of Shards': { hash: 3469412975, icon: 'https://www.bungie.net/common/destiny2_content/icons/5fa98c6e62d008621119d1b394e9cae9.png' },
    'Whisper of Torment': { hash: 537774541, icon: 'https://www.bungie.net/common/destiny2_content/icons/0f69591331f4def8ab2a4bb27c55b2aa.png' },
    // Strand Fragments
    'Thread of Ascent': { hash: 4208512216, icon: 'https://www.bungie.net/common/destiny2_content/icons/25e7ef19cf989641771175e05bcfb3c2.jpg' },
    'Thread of Binding': { hash: 3192552688, icon: 'https://www.bungie.net/common/destiny2_content/icons/73a3a289acb7b91ee236d9d9a9bdee1b.jpg' },
    'Thread of Continuity': { hash: 3192552690, icon: 'https://www.bungie.net/common/destiny2_content/icons/384da9161d140e14030e417aae613266.jpg' },
    'Thread of Evolution': { hash: 4208512211, icon: 'https://www.bungie.net/common/destiny2_content/icons/c86847f148a9e86459dac50ba36da591.jpg' },
    'Thread of Finality': { hash: 4208512217, icon: 'https://www.bungie.net/common/destiny2_content/icons/1e61bee1b4607fea83a6d3d01dfb8bce.jpg' },
    'Thread of Fury': { hash: 4208512219, icon: 'https://www.bungie.net/common/destiny2_content/icons/0e8b8974d2f17e25c085703bef8a3b53.jpg' },
    'Thread of Generation': { hash: 3192552691, icon: 'https://www.bungie.net/common/destiny2_content/icons/8cceec23c83bbbf576bd0b7eba18abe4.jpg' },
    'Thread of Isolation': { hash: 3192552689, icon: 'https://www.bungie.net/common/destiny2_content/icons/9c063a2396fe1b631d6aa2cb282df9cd.jpg' },
    'Thread of Mind': { hash: 4208512218, icon: 'https://www.bungie.net/common/destiny2_content/icons/a7a1b83217ee3fe2ee11c477705389b2.jpg' },
    'Thread of Propagation': { hash: 4208512210, icon: 'https://www.bungie.net/common/destiny2_content/icons/d42d64ff749d858b6c72c5dc4b775797.jpg' },
    'Thread of Rebirth': { hash: 4208512220, icon: 'https://www.bungie.net/common/destiny2_content/icons/6f8f98e361fb4265c885ae3447b498ef.jpg' },
    'Thread of Transmutation': { hash: 4208512221, icon: 'https://www.bungie.net/common/destiny2_content/icons/d80a220ddab3e3be2641517ad3049915.jpg' },
    'Thread of Warding': { hash: 4208512222, icon: 'https://www.bungie.net/common/destiny2_content/icons/9937046794352b7c7ce31340ac7832ba.jpg' },
    'Thread of Wisdom': { hash: 4208512223, icon: 'https://www.bungie.net/common/destiny2_content/icons/e78cbb486a636c94a46a6e6183978249.jpg' },
    // Prismatic Fragments (Facets)
    'Facet of Awakening': { hash: 124726505, icon: 'https://www.bungie.net/common/destiny2_content/icons/4b95e3952707f0da2be11f0a68de1f3b.png' },
    'Facet of Balance': { hash: 2626922114, icon: 'https://www.bungie.net/common/destiny2_content/icons/43fa2cf618e74671d0e652640c1ce4bc.png' },
    'Facet of Blessing': { hash: 124726496, icon: 'https://www.bungie.net/common/destiny2_content/icons/ba3a11d30e571278caf81e1ab4a220de.png' },
    'Facet of Bravery': { hash: 124726503, icon: 'https://www.bungie.net/common/destiny2_content/icons/7bade26040e7b26f4458062b9b3aa465.png' },
    'Facet of Command': { hash: 124726497, icon: 'https://www.bungie.net/common/destiny2_content/icons/24e6282bf3ee1c2a53717ed085cec441.png' },
    'Facet of Courage': { hash: 2626922124, icon: 'https://www.bungie.net/common/destiny2_content/icons/536765c9ed5e2f53268859591e8e9acf.png' },
    'Facet of Dawn': { hash: 2626922126, icon: 'https://www.bungie.net/common/destiny2_content/icons/684547ed1f97efdca37df4f1a5c5e699.png' },
    'Facet of Defiance': { hash: 74393640, icon: 'https://www.bungie.net/common/destiny2_content/icons/ee2901d9887ebf717331ee90bca2409b.png' },
    'Facet of Devotion': { hash: 2626922125, icon: 'https://www.bungie.net/common/destiny2_content/icons/923682dba15fcb9685f195d25eff1b95.png' },
    'Facet of Dominance': { hash: 124726504, icon: 'https://www.bungie.net/common/destiny2_content/icons/9a8bc8a614afe98844541df966a2c274.png' },
    'Facet of Generosity': { hash: 2626922127, icon: 'https://www.bungie.net/common/destiny2_content/icons/ea30d94a0fb1055e4ad70fcd8257a103.png' },
    'Facet of Grace': { hash: 2626922121, icon: 'https://www.bungie.net/common/destiny2_content/icons/8cd933c465613a7bedb9b208c362cc85.png' },
    'Facet of Honor': { hash: 124726501, icon: 'https://www.bungie.net/common/destiny2_content/icons/0381dcb3720a7eba9d3a24c0101ddfa7.png' },
    'Facet of Hope': { hash: 2626922122, icon: 'https://www.bungie.net/common/destiny2_content/icons/4be1e24b8d7073827be07dfc066b2517.png' },
    'Facet of Justice': { hash: 2626922115, icon: 'https://www.bungie.net/common/destiny2_content/icons/a4ab50f95e50d0eec1303139ab23f3fd.png' },
    'Facet of Mending': { hash: 124726500, icon: 'https://www.bungie.net/common/destiny2_content/icons/9e769fcade4b6088574826b72c0d28ea.png' },
    'Facet of Protection': { hash: 2626922120, icon: 'https://www.bungie.net/common/destiny2_content/icons/b6d90ee669fc1fef2e22ff95188be313.png' },
    'Facet of Purpose': { hash: 124726498, icon: 'https://www.bungie.net/common/destiny2_content/icons/7a6b1d98544eb4a8512c6be0b6486456.png' },
    'Facet of Ruin': { hash: 124726499, icon: 'https://www.bungie.net/common/destiny2_content/icons/058a2677d6742227811e81d8c4354270.png' },
    'Facet of Sacrifice': { hash: 124726502, icon: 'https://www.bungie.net/common/destiny2_content/icons/b1aec7c22fee7032b6a4898e3c9867ff.png' },
};

// Fragment descriptions (stored separately as Bungie API doesn't include them in plug definitions)
const FRAGMENT_DESCRIPTIONS: Record<string, string> = {
    // Solar Fragments
    'Ember of Ashes': 'Your abilities apply more scorch stacks to targets.',
    'Ember of Beams': 'Your Solar Super projectiles have stronger target acquisition.',
    'Ember of Benevolence': 'Applying restoration, cure, or radiant to allies grants increased grenade, melee, and class ability regeneration for a short duration.',
    'Ember of Blistering': 'Defeating targets with Solar ignitions grants grenade energy.',
    'Ember of Char': 'Your Solar ignitions spread scorch to affected targets.',
    'Ember of Combustion': 'Final blows with your Solar Super cause targets to ignite.',
    'Ember of Empyrean': 'Solar weapon or ability final blows extend the duration of restoration and radiant effects applied to you.',
    'Ember of Eruption': 'Your Solar ignitions have increased area of effect.',
    'Ember of Mercy': 'When you revive an ally, you and other nearby allies gain restoration.',
    'Ember of Resolve': 'Solar grenade final blows cure you.',
    'Ember of Searing': 'Defeating scorched targets grants melee energy.',
    'Ember of Singeing': 'Your class ability recharges faster when you scorch targets.',
    'Ember of Solace': 'Radiant and restoration effects applied to you have increased duration.',
    'Ember of Tempering': 'Solar weapon final blows grant you and your allies increased recovery for a short duration.',
    'Ember of Torches': 'Powered melee attacks against combatants make you and nearby allies radiant.',
    'Ember of Wonder': 'Rapidly defeating multiple targets with Solar ignitions generates an Orb of Power.',
    // Void Fragments
    'Echo of Cessation': 'Finishers create a Void explosion that causes nearby combatants to become volatile.',
    'Echo of Dilation': 'While crouched, you sneak faster and gain enhanced radar resolution.',
    'Echo of Domineering': 'After suppressing a target, you gain greatly increased mobility for a short duration and your equipped weapon is reloaded from reserves.',
    'Echo of Exchange': 'Melee final blows grant grenade energy.',
    'Echo of Expulsion': 'Void ability kills cause targets to explode.',
    'Echo of Harvest': 'Defeating weakened targets with precision final blows will create an Orb of Power.',
    'Echo of Instability': 'Defeating targets with grenades grants Volatile Rounds to your Void weapons.',
    'Echo of Leeching': 'Melee final blows start health regeneration for you and nearby allies.',
    'Echo of Obscurity': 'Finisher final blows grant Invisibility.',
    'Echo of Persistence': 'Void buffs applied to you have increased duration.',
    'Echo of Provision': 'Damaging targets with grenades grants melee energy.',
    'Echo of Remnants': 'Your lingering grenade effects have increased duration.',
    'Echo of Reprisal': 'Final blows when surrounded by combatants grant Super energy.',
    'Echo of Starvation': 'Picking up an Orb of Power grants Devour.',
    'Echo of Undermining': 'Your Void grenades weaken targets.',
    'Echo of Vigilance': 'Defeating a target grants you a Void overshield.',
    // Arc Fragments
    'Spark of Amplitude': 'Rapidly defeating targets while you are amplified creates an Orb of Power.',
    'Spark of Beacons': 'While you are amplified, your Arc Special weapon final blows create a blinding explosion.',
    'Spark of Brilliance': 'Defeating a blinded target with precision damage creates a blinding explosion.',
    'Spark of Discharge': 'Arc weapon final blows have a chance to create an Ionic Trace.',
    'Spark of Feedback': 'Taking melee damage briefly increases your outgoing melee damage.',
    'Spark of Focus': 'After sprinting for a short time, your class ability regeneration is increased.',
    'Spark of Frequency': 'Melee hits greatly increase your reload speed for a short duration.',
    'Spark of Haste': 'You have greatly increased resilience, recovery, and mobility while sprinting.',
    'Spark of Instinct': 'When critically wounded, taking damage from nearby combatants emits a damaging Arc burst.',
    'Spark of Ions': 'Defeating a jolted target creates an Ionic Trace.',
    'Spark of Magnitude': 'Your lingering Arc grenades have extended duration.',
    'Spark of Momentum': 'Sliding over ammo reloads your weapon and grants a small amount of melee energy.',
    'Spark of Recharge': 'While critically wounded, your melee and grenade energy regenerate more quickly.',
    'Spark of Resistance': 'While surrounded by combatants, you are more resistant to incoming damage.',
    'Spark of Shock': 'Your Arc grenades jolt targets.',
    'Spark of Volts': 'Finishers make you amplified.',
    // Stasis Fragments
    'Whisper of Bonds': 'Defeating frozen targets grants you Super energy.',
    'Whisper of Chains': 'While you are near frozen targets or a friendly Stasis crystal, you take reduced damage from targets.',
    'Whisper of Chill': 'Defeating enemies with Stasis abilities adds more stacks of slow to nearby combatants.',
    'Whisper of Conduction': 'Nearby Stasis shards track to your position.',
    'Whisper of Durance': 'Slow from your abilities lasts longer. For those abilities that linger, their duration will also increase.',
    'Whisper of Fissures': 'Increases the damage and size of the burst of Stasis when you destroy a Stasis crystal or defeat a frozen target.',
    'Whisper of Fractures': 'Your melee recharges faster when you are near two or more targets.',
    'Whisper of Hedrons': 'Dramatically increases weapon stability after freezing a target.',
    'Whisper of Hunger': 'Increases the melee energy gained from picking up Stasis shards.',
    'Whisper of Impetus': 'Damaging targets with a Stasis melee reloads your stowed weapons and grants you a temporary boost to weapon ready speed.',
    'Whisper of Refraction': 'Defeating slowed or frozen targets grants you class ability energy.',
    'Whisper of Rending': 'Kinetic weapons do increased damage to Stasis crystals and frozen targets.',
    'Whisper of Reversal': 'Melee hits while you are encased by Stasis grant melee energy.',
    'Whisper of Rime': 'Collecting a Stasis shard grants a small amount of overshield, which falls off after 10 seconds.',
    'Whisper of Shards': 'Shattering a Stasis crystal temporarily boosts your grenade recharge rate.',
    'Whisper of Torment': 'You gain grenade energy each time you take damage.',
    // Strand Fragments
    'Thread of Ascent': 'Activating your grenade ability reloads your equipped weapon and grants increased airborne effectiveness and handling for a short duration.',
    'Thread of Binding': 'Super final blows emit a suspending burst from the target.',
    'Thread of Continuity': 'Suspend, unravel, and sever effects applied to targets have increased duration.',
    'Thread of Evolution': 'Threadlings travel farther and deal additional damage.',
    'Thread of Finality': 'Finishers generate Threadlings.',
    'Thread of Fury': 'Damaging targets with a Tangle grants melee energy.',
    'Thread of Generation': 'Dealing damage generates grenade energy.',
    'Thread of Isolation': 'Landing rapid precision hits emits a severing burst from the target.',
    'Thread of Mind': 'Defeating suspended targets grants class ability energy.',
    'Thread of Propagation': 'Powered melee final blows grant your Strand weapons Unraveling Rounds.',
    'Thread of Rebirth': 'Strand weapon final blows have a chance to create a Threadling.',
    'Thread of Transmutation': 'While you have Woven Mail, weapon final blows create a Tangle.',
    'Thread of Warding': 'Picking up an Orb of Power grants Woven Mail.',
    'Thread of Wisdom': 'Defeating suspended targets with precision final blows generates an Orb of Power.',
    // Prismatic Fragments (Facets)
    'Facet of Awakening': 'Rapidly defeating targets or dealing damage with abilities generates an elemental pickup from your subclass.',
    'Facet of Balance': 'Rapidly defeating targets with Light damage grants melee energy. Rapidly defeating targets with Dark damage grants grenade energy.',
    'Facet of Blessing': 'Gain a bonus to weapon damage when picking up an Orb of Power based on the type of damage you deal.',
    'Facet of Bravery': 'Defeating targets with Grenade final blows grants Volatile Rounds to your Void weapons and Unraveling Rounds to your Strand weapons.',
    'Facet of Command': 'Freezing or suppressing a target reloads your equipped weapon and creates a Stasis shard or Void breach.',
    'Facet of Courage': 'Your Arc, Solar, and Void abilities deal increased damage to targets afflicted with Darkness debuffs.',
    'Facet of Dawn': 'Powered melee hits make you Radiant. Powered melee hits against Frozen targets make you Radiant and Amplified.',
    'Facet of Defiance': 'Finishers create a detonation that either jolts, ignites, or makes volatile.',
    'Facet of Devotion': 'Defeating targets afflicted with any Stasis or Strand status effect grants bonus Light Transcendence energy.',
    'Facet of Dominance': 'Your Void grenades weaken targets, and your Arc grenades jolt targets.',
    'Facet of Generosity': 'Defeating targets with abilities while Transcendent creates Orbs of Power.',
    'Facet of Grace': 'Damaging targets with Kinetic weapons grants bonus Transcendence energy. Damaging targets with your Super grants bonus Transcendence energy.',
    'Facet of Honor': 'Collecting an elemental pickup or destroying a Tangle grants Transcendence energy of the same type.',
    'Facet of Hope': 'While you have an elemental buff, your class ability regenerates more quickly.',
    'Facet of Justice': 'While Transcendent, your ability final blows explode.',
    'Facet of Mending': 'Grenade final blows cure you.',
    'Facet of Protection': 'While surrounded by combatants, you are more resistant to incoming damage.',
    'Facet of Purpose': 'Picking up an Orb of Power grants either Amplified, Radiant, Frost Armor, or Woven Mail.',
    'Facet of Ruin': 'Increases the size and damage of the burst when you shatter a Stasis crystal or a frozen target, and increases the damage of Solar ignitions.',
    'Facet of Sacrifice': 'While you have an elemental buff, your melee and grenade ability regenerate more quickly.',
};

// Stat Mod Item Hashes (for showing actual mod icons)
const STAT_MOD_HASHES: Record<keyof ArmorStats, { plus10: number; plus5: number }> = {
    weapons: { plus10: 3961599962, plus5: 204137529 },   // Mobility Mod
    health: { plus10: 2850583378, plus5: 3682186345 },   // Resilience Mod  
    class: { plus10: 2645858828, plus5: 555005975 },     // Recovery Mod
    grenade: { plus10: 4048838440, plus5: 1435557120 },  // Discipline Mod
    super: { plus10: 3355995799, plus5: 2623485440 },    // Intellect Mod
    melee: { plus10: 3253038666, plus5: 3699676109 },    // Strength Mod
};

// Fragment data with stat bonuses (map from SUBCLASS_FRAGMENTS)
const FRAGMENT_STAT_DATA: Record<string, { subclass: string; bonuses: { stat: keyof ArmorStats; value: number }[] }> = {
    // Solar
    'Ember of Benevolence': { subclass: 'solar', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Ember of Beams': { subclass: 'solar', bonuses: [{ stat: 'super', value: 10 }] },
    'Ember of Combustion': { subclass: 'solar', bonuses: [{ stat: 'melee', value: 10 }] },
    'Ember of Char': { subclass: 'solar', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Ember of Eruption': { subclass: 'solar', bonuses: [{ stat: 'melee', value: -10 }] },
    'Ember of Searing': { subclass: 'solar', bonuses: [{ stat: 'class', value: -10 }] },
    'Ember of Singeing': { subclass: 'solar', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Ember of Solace': { subclass: 'solar', bonuses: [{ stat: 'health', value: 10 }] },
    'Ember of Wonder': { subclass: 'solar', bonuses: [{ stat: 'health', value: 10 }] },
    'Ember of Torches': { subclass: 'solar', bonuses: [] },
    'Ember of Ashes': { subclass: 'solar', bonuses: [] },
    'Ember of Blistering': { subclass: 'solar', bonuses: [] },
    'Ember of Empyrean': { subclass: 'solar', bonuses: [] },
    'Ember of Mercy': { subclass: 'solar', bonuses: [] },
    'Ember of Resolve': { subclass: 'solar', bonuses: [] },
    'Ember of Tempering': { subclass: 'solar', bonuses: [] },
    // Void
    'Echo of Cessation': { subclass: 'void', bonuses: [{ stat: 'class', value: 10 }] },
    'Echo of Dilation': { subclass: 'void', bonuses: [{ stat: 'weapons', value: 10 }, { stat: 'super', value: 10 }] },
    'Echo of Domineering': { subclass: 'void', bonuses: [{ stat: 'grenade', value: 10 }] },
    'Echo of Exchange': { subclass: 'void', bonuses: [{ stat: 'super', value: -10 }] },
    'Echo of Expulsion': { subclass: 'void', bonuses: [{ stat: 'super', value: -10 }] },
    'Echo of Harvest': { subclass: 'void', bonuses: [{ stat: 'super', value: -10 }] },
    'Echo of Instability': { subclass: 'void', bonuses: [{ stat: 'melee', value: 10 }] },
    'Echo of Leeching': { subclass: 'void', bonuses: [{ stat: 'health', value: -10 }] },
    'Echo of Obscurity': { subclass: 'void', bonuses: [{ stat: 'class', value: 10 }] },
    'Echo of Persistence': { subclass: 'void', bonuses: [{ stat: 'weapons', value: -10 }] },
    'Echo of Provision': { subclass: 'void', bonuses: [{ stat: 'melee', value: -10 }] },
    'Echo of Remnants': { subclass: 'void', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Echo of Reprisal': { subclass: 'void', bonuses: [{ stat: 'weapons', value: 10 }] },
    'Echo of Starvation': { subclass: 'void', bonuses: [{ stat: 'class', value: -10 }] },
    'Echo of Undermining': { subclass: 'void', bonuses: [{ stat: 'grenade', value: -20 }] },
    'Echo of Vigilance': { subclass: 'void', bonuses: [] },
    // Arc
    'Spark of Beacons': { subclass: 'arc', bonuses: [{ stat: 'health', value: -10 }] },
    'Spark of Brilliance': { subclass: 'arc', bonuses: [{ stat: 'super', value: -10 }] },
    'Spark of Discharge': { subclass: 'arc', bonuses: [{ stat: 'melee', value: 10 }] },
    'Spark of Focus': { subclass: 'arc', bonuses: [{ stat: 'health', value: -10 }] },
    'Spark of Frequency': { subclass: 'arc', bonuses: [{ stat: 'health', value: -10 }] },
    'Spark of Haste': { subclass: 'arc', bonuses: [{ stat: 'class', value: -10 }] },
    'Spark of Instinct': { subclass: 'arc', bonuses: [{ stat: 'melee', value: 10 }] },
    'Spark of Magnitude': { subclass: 'arc', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Spark of Momentum': { subclass: 'arc', bonuses: [{ stat: 'melee', value: -10 }] },
    'Spark of Recharge': { subclass: 'arc', bonuses: [{ stat: 'melee', value: -10 }] },
    'Spark of Resistance': { subclass: 'arc', bonuses: [{ stat: 'melee', value: -10 }] },
    'Spark of Shock': { subclass: 'arc', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Spark of Volts': { subclass: 'arc', bonuses: [{ stat: 'class', value: 10 }] },
    'Spark of Amplitude': { subclass: 'arc', bonuses: [] },
    'Spark of Feedback': { subclass: 'arc', bonuses: [] },
    'Spark of Ions': { subclass: 'arc', bonuses: [] },
    // Stasis
    'Whisper of Bonds': { subclass: 'stasis', bonuses: [{ stat: 'super', value: -10 }, { stat: 'grenade', value: -10 }] },
    'Whisper of Chains': { subclass: 'stasis', bonuses: [{ stat: 'class', value: -10 }] },
    'Whisper of Conduction': { subclass: 'stasis', bonuses: [{ stat: 'health', value: 10 }, { stat: 'super', value: 10 }] },
    'Whisper of Durance': { subclass: 'stasis', bonuses: [{ stat: 'melee', value: 10 }] },
    'Whisper of Fissures': { subclass: 'stasis', bonuses: [{ stat: 'super', value: -10 }] },
    'Whisper of Fractures': { subclass: 'stasis', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Whisper of Hedrons': { subclass: 'stasis', bonuses: [{ stat: 'melee', value: -10 }] },
    'Whisper of Hunger': { subclass: 'stasis', bonuses: [{ stat: 'weapons', value: -10 }, { stat: 'class', value: -10 }] },
    'Whisper of Impetus': { subclass: 'stasis', bonuses: [{ stat: 'health', value: -10 }] },
    'Whisper of Refraction': { subclass: 'stasis', bonuses: [{ stat: 'health', value: -10 }] },
    'Whisper of Rending': { subclass: 'stasis', bonuses: [{ stat: 'weapons', value: -10 }] },
    'Whisper of Rime': { subclass: 'stasis', bonuses: [{ stat: 'health', value: 10 }, { stat: 'melee', value: 10 }] },
    'Whisper of Shards': { subclass: 'stasis', bonuses: [{ stat: 'health', value: 10 }] },
    'Whisper of Torment': { subclass: 'stasis', bonuses: [{ stat: 'grenade', value: 10 }] },
    'Whisper of Chill': { subclass: 'stasis', bonuses: [] },
    'Whisper of Reversal': { subclass: 'stasis', bonuses: [] },
    // Strand
    'Thread of Ascent': { subclass: 'strand', bonuses: [{ stat: 'weapons', value: 10 }] },
    'Thread of Binding': { subclass: 'strand', bonuses: [{ stat: 'health', value: 10 }] },
    'Thread of Continuity': { subclass: 'strand', bonuses: [{ stat: 'melee', value: 10 }] },
    'Thread of Evolution': { subclass: 'strand', bonuses: [{ stat: 'super', value: 10 }] },
    'Thread of Finality': { subclass: 'strand', bonuses: [{ stat: 'class', value: 10 }] },
    'Thread of Fury': { subclass: 'strand', bonuses: [{ stat: 'melee', value: -10 }] },
    'Thread of Generation': { subclass: 'strand', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Thread of Isolation': { subclass: 'strand', bonuses: [{ stat: 'grenade', value: 10 }] },
    'Thread of Mind': { subclass: 'strand', bonuses: [{ stat: 'weapons', value: -10 }] },
    'Thread of Propagation': { subclass: 'strand', bonuses: [{ stat: 'melee', value: -10 }] },
    'Thread of Rebirth': { subclass: 'strand', bonuses: [{ stat: 'health', value: -10 }] },
    'Thread of Transmutation': { subclass: 'strand', bonuses: [{ stat: 'melee', value: 10 }] },
    'Thread of Warding': { subclass: 'strand', bonuses: [{ stat: 'class', value: -10 }] },
    'Thread of Wisdom': { subclass: 'strand', bonuses: [{ stat: 'grenade', value: 10 }] },
    // Prismatic Facets
    'Facet of Awakening': { subclass: 'prismatic', bonuses: [] },
    'Facet of Balance': { subclass: 'prismatic', bonuses: [] },
    'Facet of Blessing': { subclass: 'prismatic', bonuses: [] },
    'Facet of Bravery': { subclass: 'prismatic', bonuses: [{ stat: 'super', value: 10 }] },
    'Facet of Command': { subclass: 'prismatic', bonuses: [{ stat: 'grenade', value: -10 }] },
    'Facet of Courage': { subclass: 'prismatic', bonuses: [] },
    'Facet of Dawn': { subclass: 'prismatic', bonuses: [{ stat: 'melee', value: 10 }] },
    'Facet of Defiance': { subclass: 'prismatic', bonuses: [] },
    'Facet of Devotion': { subclass: 'prismatic', bonuses: [] },
    'Facet of Dominance': { subclass: 'prismatic', bonuses: [{ stat: 'grenade', value: 10 }] },
    'Facet of Generosity': { subclass: 'prismatic', bonuses: [] },
    'Facet of Grace': { subclass: 'prismatic', bonuses: [] },
    'Facet of Honor': { subclass: 'prismatic', bonuses: [] },
    'Facet of Hope': { subclass: 'prismatic', bonuses: [{ stat: 'class', value: 10 }] },
    'Facet of Justice': { subclass: 'prismatic', bonuses: [] },
    'Facet of Mending': { subclass: 'prismatic', bonuses: [] },
    'Facet of Protection': { subclass: 'prismatic', bonuses: [] },
    'Facet of Purpose': { subclass: 'prismatic', bonuses: [{ stat: 'class', value: -10 }] },
    'Facet of Ruin': { subclass: 'prismatic', bonuses: [] },
    'Facet of Sacrifice': { subclass: 'prismatic', bonuses: [{ stat: 'grenade', value: -10 }] },
};

// Subclass filter options with official Bungie API icons
const SUBCLASS_OPTIONS = [
    { 
        key: 'prismatic', 
        name: 'Prismatic', 
        color: 'text-fuchsia-400',
        icon: null, // Use letter instead
        letter: 'P'
    },
    { 
        key: 'solar', 
        name: 'Solar', 
        color: 'text-orange-400', 
        prefix: 'Ember',
        icon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png'
    },
    { 
        key: 'void', 
        name: 'Void', 
        color: 'text-purple-400', 
        prefix: 'Echo',
        icon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png'
    },
    { 
        key: 'arc', 
        name: 'Arc', 
        color: 'text-blue-400', 
        prefix: 'Spark',
        icon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png'
    },
    { 
        key: 'stasis', 
        name: 'Stasis', 
        color: 'text-cyan-300', 
        prefix: 'Whisper',
        icon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png'
    },
    { 
        key: 'strand', 
        name: 'Strand', 
        color: 'text-green-400', 
        prefix: 'Thread',
        icon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png'
    },
];

const CLASS_NAMES = ['Titan', 'Hunter', 'Warlock'];
const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg',
    1: '/class-hunter.svg',
    2: '/class-warlock.svg',
};

// ===== Stat Number Input Component =====

interface StatInputProps {
    stat: keyof ArmorStats;
    value: number;
    fragmentBonus?: number;
    maxAchievable?: number; // Physical limit based on user's armor
    onChange: (value: number) => void;
}

function StatInput({ stat, value, fragmentBonus = 0, maxAchievable = MAX_STAT_VALUE, onChange }: StatInputProps) {
    const colors = STAT_COLORS[stat];
    const tier = getStatTier(value);
    // Calculate percentage against the achievable max for display, but cap at 100%
    const effectiveMax = Math.min(maxAchievable, MAX_STAT_VALUE);
    const percentage = (value / MAX_STAT_VALUE) * 100;
    const maxPercentage = (effectiveMax / MAX_STAT_VALUE) * 100;
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const labelRef = useRef<HTMLDivElement>(null);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value) || 0;
        // Limit to achievable max
        onChange(Math.max(0, Math.min(effectiveMax, newValue)));
    };
    
    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
        // Granular selection - round to nearest 5
        let newValue = Math.round((pct / 100) * MAX_STAT_VALUE / 5) * 5;
        // Cap at achievable max
        newValue = Math.min(newValue, effectiveMax);
        onChange(newValue);
    };
    
    const handleBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        
        const updateValue = (clientX: number) => {
            const x = clientX - rect.left;
            const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
            // Granular selection - round to nearest 5
            let newValue = Math.round((pct / 100) * MAX_STAT_VALUE / 5) * 5;
            // Cap at achievable max
            newValue = Math.min(newValue, effectiveMax);
            onChange(newValue);
        };
        
        updateValue(e.clientX);
        
        const moveHandler = (moveEvent: MouseEvent) => {
            updateValue(moveEvent.clientX);
        };
        
        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    };
    
    const handleMouseEnter = () => {
        if (labelRef.current) {
            const rect = labelRef.current.getBoundingClientRect();
            setTooltipPos({ x: rect.left, y: rect.bottom + 8 });
        }
        setShowTooltip(true);
    };
    
    // Simple stat icons as colored squares
    const statIcons: Record<keyof ArmorStats, string> = {
        health: '🛡',
        melee: '👊',
        grenade: '💥',
        super: '⚡',
        class: '◆',
        weapons: '⚔',
    };
    
    const maxTier = getStatTier(effectiveMax);
    
    // Render tooltip via portal
    const tooltipContent = showTooltip && typeof document !== 'undefined' ? createPortal(
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-9999 w-56 p-3 bg-slate-900 border border-white/20 shadow-2xl pointer-events-none"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-6 h-6 rounded flex items-center justify-center text-sm", colors.bg)}>
                    <span>{statIcons[stat]}</span>
                </div>
                <span className={cn("font-bold", colors.text)}>{STAT_NAMES[stat]}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{STAT_DESCRIPTIONS[stat]}</p>
            <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                    <span>Target Value:</span>
                    <span className="text-white font-bold">{value}</span>
                </div>
                <div className="flex justify-between">
                    <span>Target Tier:</span>
                    <span className={cn("font-bold", tier >= 10 ? "text-destiny-gold" : "text-white")}>T{tier}</span>
                </div>
                <div className="flex justify-between">
                    <span>Max Achievable:</span>
                    <span className="text-amber-400 font-bold">{effectiveMax} (T{maxTier})</span>
                </div>
                {fragmentBonus !== 0 && (
                    <div className="flex justify-between">
                        <span>Fragment Bonus:</span>
                        <span className={cn("font-bold", fragmentBonus > 0 ? "text-green-400" : "text-red-400")}>
                            {fragmentBonus > 0 ? '+' : ''}{fragmentBonus}
                        </span>
                    </div>
                )}
            </div>
        </motion.div>,
        document.body
    ) : null;
    
    return (
        <div className="flex items-center gap-3 py-1.5">
            {/* Stat Icon & Name with Tooltip */}
            <div 
                ref={labelRef}
                className="w-24 flex items-center gap-2 cursor-help"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <div className={cn("w-5 h-5 rounded flex items-center justify-center text-xs", colors.bg)}>
                    <span>{statIcons[stat]}</span>
                </div>
                <div className="flex flex-col">
                    <span className={cn("text-xs font-bold", colors.text)}>{STAT_NAMES[stat]}</span>
                    {fragmentBonus !== 0 && (
                        <span className={cn(
                            "text-[9px]",
                            fragmentBonus > 0 ? "text-green-400" : "text-red-400"
                        )}>
                            {fragmentBonus > 0 ? '+' : ''}{fragmentBonus}
                        </span>
                    )}
                </div>
                
                {/* Tooltip rendered via portal */}
                <AnimatePresence>
                    {tooltipContent}
                </AnimatePresence>
            </div>
            
            {/* Stat Bar with Limit Indicator */}
            <div className="flex-1 relative group">
                <div 
                    className="relative h-5 bg-slate-900 border border-white/10 cursor-pointer overflow-hidden"
                    onClick={handleBarClick}
                    onMouseDown={handleBarMouseDown}
                >
                    {/* Unreachable zone (grayed out with stripes) */}
                    {maxPercentage < 100 && (
                        <div 
                            className="absolute inset-y-0 right-0 bg-slate-800/80 border-l border-red-500/40"
                            style={{ 
                                width: `${100 - maxPercentage}%`,
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(239,68,68,0.1) 3px, rgba(239,68,68,0.1) 6px)'
                            }}
                        />
                    )}
                    
                    {/* Background grid showing tiers */}
                    <div className="absolute inset-0 flex">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div 
                                key={i} 
                                className={cn(
                                    "flex-1 border-r border-white/5",
                                    i === 4 && "border-r-white/15" // T5 marker
                                )}
                            />
                        ))}
                    </div>
                    
                    {/* Fill bar */}
                    <div 
                        className={cn("absolute inset-y-0 left-0 transition-all duration-100", colors.fill, "opacity-70")}
                        style={{ width: `${Math.min(percentage, maxPercentage)}%` }}
                    />
                    
                    {/* Max achievable marker */}
                    {maxPercentage < 100 && (
                        <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]"
                            style={{ left: `${maxPercentage}%` }}
                        />
                    )}
                    
                    {/* Current value marker */}
                    {value > 0 && (
                        <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.5)]"
                            style={{ left: `${percentage}%` }}
                        />
                    )}
                </div>
                
                {/* Tier labels */}
                <div className="flex justify-between mt-0.5 text-[8px] text-slate-600 px-0.5">
                    <span>0</span>
                    <span className={cn(
                        "transition-colors",
                        maxTier < 10 ? "text-amber-500/70" : "text-slate-500"
                    )}>
                        {maxTier < 20 ? `Cap: T${maxTier}` : ''}
                    </span>
                    <span>T20</span>
                </div>
            </div>
            
            {/* Numeric Input */}
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min={0}
                    max={effectiveMax}
                    step={5}
                    value={value}
                    onChange={handleInputChange}
                    className={cn(
                        "w-12 h-7 text-center text-xs font-bold bg-slate-900 border rounded-none focus:outline-none transition-colors",
                        tier >= 10 ? `${colors.border} ${colors.text}` : "border-white/10 text-white"
                    )}
                />
                <span className={cn(
                    "text-[10px] font-bold w-6",
                    tier >= 10 ? colors.text : "text-slate-500"
                )}>
                    T{tier}
                </span>
            </div>
        </div>
    );
}

// ===== Exotic Selector Component =====

interface ExoticSelectorProps {
    exotics: Record<string, ArmorPiece[]>;
    selectedExotic: ExoticFilter;
    onSelect: (filter: ExoticFilter) => void;
    profile: any;
}

function ExoticSelector({ exotics, selectedExotic, onSelect, profile }: ExoticSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const allExotics = [
        ...exotics.helmet,
        ...exotics.gauntlets,
        ...exotics.chest,
        ...exotics.legs,
    ];
    
    const selectedItem = selectedExotic.itemHash 
        ? allExotics.find(e => e.itemHash === selectedExotic.itemHash)
        : null;
    
    const slots = [
        { key: 'helmet', name: 'Helmet', items: exotics.helmet },
        { key: 'gauntlets', name: 'Gauntlets', items: exotics.gauntlets },
        { key: 'chest', name: 'Chest', items: exotics.chest },
        { key: 'legs', name: 'Legs', items: exotics.legs },
    ];
    
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 border transition-all",
                    selectedItem 
                        ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold"
                        : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                )}
            >
                {selectedItem ? (
                    (() => {
                        // Merge instance data with stats for proper tooltip display
                        const baseInstance = profile?.itemComponents?.instances?.data?.[selectedItem.itemInstanceId];
                        const statsData = profile?.itemComponents?.stats?.data?.[selectedItem.itemInstanceId]?.stats;
                        const instanceWithStats = baseInstance ? {
                            ...baseInstance,
                            stats: statsData
                        } : undefined;
                        
                        return (
                            <>
                                <div className="w-16 h-16 relative shrink-0">
                                    <DestinyItemCard
                                        itemHash={selectedItem.itemHash}
                                        itemInstanceId={selectedItem.itemInstanceId}
                                        instanceData={instanceWithStats}
                                        socketsData={profile?.itemComponents?.sockets?.data?.[selectedItem.itemInstanceId]}
                                        className="w-full h-full"
                                        size="medium"
                                        hidePower
                                    />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-bold truncate">{selectedItem.name}</div>
                                </div>
                            </>
                        );
                    })()
                ) : (
                    <>
                        <Gem className="w-5 h-5 text-yellow-500/50" />
                        <span className="text-sm font-bold uppercase tracking-wider">
                            {selectedExotic.slot === 'none' ? 'No Exotic' : 'Any Exotic'}
                        </span>
                    </>
                )}
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto bg-slate-900 border border-white/10 shadow-xl"
                    >
                        {/* Quick options */}
                        <div className="p-2 border-b border-white/5 flex gap-2">
                            <button
                                onClick={() => { onSelect({ itemHash: null, slot: 'any' }); setIsOpen(false); }}
                                className={cn(
                                    "flex-1 px-2 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors",
                                    selectedExotic.slot === 'any' && !selectedExotic.itemHash
                                        ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold"
                                        : "border-white/10 text-slate-400 hover:text-white"
                                )}
                            >
                                Any
                            </button>
                            <button
                                onClick={() => { onSelect({ itemHash: null, slot: 'none' }); setIsOpen(false); }}
                                className={cn(
                                    "flex-1 px-2 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors",
                                    selectedExotic.slot === 'none'
                                        ? "bg-slate-600/50 border-white/20 text-white"
                                        : "border-white/10 text-slate-400 hover:text-white"
                                )}
                            >
                                None
                            </button>
                        </div>
                        
                        {/* Exotics by slot */}
                        {slots.map(slot => slot.items.length > 0 && (
                            <div key={slot.key} className="p-2 border-b border-white/5 last:border-b-0">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1">
                                    {slot.name}
                                </div>
                                <div className="grid grid-cols-5 gap-1">
                                    {slot.items.map(exotic => {
                                        // Merge instance data with stats for proper tooltip
                                        const baseInstance = profile?.itemComponents?.instances?.data?.[exotic.itemInstanceId];
                                        const statsData = profile?.itemComponents?.stats?.data?.[exotic.itemInstanceId]?.stats;
                                        const instanceWithStats = baseInstance ? {
                                            ...baseInstance,
                                            stats: statsData
                                        } : undefined;
                                        
                                        return (
                                            <button
                                                key={exotic.itemInstanceId}
                                                onClick={() => { 
                                                    onSelect({ itemHash: exotic.itemHash, slot: slot.key as any }); 
                                                    setIsOpen(false); 
                                                }}
                                                className={cn(
                                                    "w-16 h-16 border-2 transition-all hover:scale-105",
                                                    selectedExotic.itemHash === exotic.itemHash
                                                        ? "border-destiny-gold shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                                                        : "border-transparent hover:border-white/20"
                                                )}
                                            >
                                                <DestinyItemCard
                                                    itemHash={exotic.itemHash}
                                                    itemInstanceId={exotic.itemInstanceId}
                                                    instanceData={instanceWithStats}
                                                    socketsData={profile?.itemComponents?.sockets?.data?.[exotic.itemInstanceId]}
                                                    className="w-full h-full"
                                                    size="small"
                                                    hidePower
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ===== Fragment Icon with Tooltip =====

interface FragmentIconProps {
    name: string;
    isSelected: boolean;
    onClick: () => void;
}

function FragmentIcon({ name, isSelected, onClick }: FragmentIconProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    const iconData = FRAGMENT_ICONS[name];
    const statData = FRAGMENT_STAT_DATA[name];
    const subclass = statData?.subclass || 'solar';
    const bonuses = statData?.bonuses || [];
    
    // Fragment descriptions (Bungie API doesn't include these in plug definitions)
    const fragmentDescription = FRAGMENT_DESCRIPTIONS[name] || '';
    
    const subclassColors: Record<string, string> = {
        solar: 'border-orange-500 shadow-orange-500/40',
        void: 'border-purple-500 shadow-purple-500/40',
        arc: 'border-blue-400 shadow-blue-400/40',
        stasis: 'border-cyan-400 shadow-cyan-400/40',
        strand: 'border-green-400 shadow-green-400/40',
        prismatic: 'border-fuchsia-400 shadow-fuchsia-400/40',
    };

    const subclassBgColors: Record<string, string> = {
        solar: 'bg-gradient-to-b from-orange-500/20 to-orange-900/40',
        void: 'bg-gradient-to-b from-purple-500/20 to-purple-900/40',
        arc: 'bg-gradient-to-b from-blue-400/20 to-blue-900/40',
        stasis: 'bg-gradient-to-b from-cyan-400/20 to-cyan-900/40',
        strand: 'bg-gradient-to-b from-green-400/20 to-green-900/40',
        prismatic: 'bg-gradient-to-b from-fuchsia-400/20 to-fuchsia-900/40',
    };

    const subclassTextColors: Record<string, string> = {
        solar: 'text-orange-300',
        void: 'text-purple-300',
        arc: 'text-blue-300',
        stasis: 'text-cyan-200',
        strand: 'text-green-300',
        prismatic: 'text-fuchsia-300',
    };

    const handleMouseEnter = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setTooltipPos({
                x: rect.left + rect.width / 2,
                y: rect.top - 8
            });
        }
        setShowTooltip(true);
    };
    
    // Render tooltip via portal to escape overflow:hidden containers
    const tooltipContent = showTooltip && typeof document !== 'undefined' ? createPortal(
        <div 
            className="fixed w-72 pointer-events-none bg-gray-800/20 border border-white/20 shadow-2xl backdrop-blur-xl"
            style={{ 
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: 'translate(-50%, -100%)',
                zIndex: 99999
            }}
        >
            {/* Header */}
            <div className={cn("p-3", subclassBgColors[subclass])}>
                <div className="flex items-center gap-3">
                    {iconData?.icon && (
                        <div className="w-12 h-12 relative shrink-0 border border-white/20">
                            <Image src={iconData.icon} fill alt="" className="object-cover" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className={cn("font-bold text-sm leading-tight", subclassTextColors[subclass])}>
                            {name}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                            {subclass} Fragment
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Description */}
            {fragmentDescription && (
                <div className="px-3 py-2.5 border-t border-white/10">
                    <p className="text-[11px] text-slate-200 leading-relaxed">{fragmentDescription}</p>
                </div>
            )}
            
            {/* Stats */}
            {bonuses.length > 0 && (
                <div className="px-3 py-2 border-t border-white/10">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Stat Modifiers</div>
                    <div className="space-y-1">
                        {bonuses.map((bonus, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-slate-300">{STAT_NAMES[bonus.stat]}</span>
                                <span className={cn(
                                    "font-bold",
                                    bonus.value > 0 ? "text-green-400" : "text-red-400"
                                )}>
                                    {bonus.value > 0 ? '+' : ''}{bonus.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Arrow pointing down */}
            <div 
                className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-900/98"
            />
        </div>,
        document.body
    ) : null;
    
    return (
        <>
            <button
                ref={buttonRef}
                onClick={onClick}
                className={cn(
                    "w-11 h-11 relative border-2 transition-all hover:scale-110",
                    isSelected 
                        ? cn(subclassColors[subclass], "shadow-md scale-105")
                        : "border-transparent opacity-60 hover:opacity-100 hover:border-white/30"
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {iconData?.icon ? (
                    <Image 
                        src={iconData.icon} 
                        fill 
                        alt={name}
                        className="object-cover"
                    />
                ) : (
                    <div className={cn(
                        "w-full h-full flex items-center justify-center text-xs",
                        subclass === 'solar' && "bg-orange-500/30",
                        subclass === 'void' && "bg-purple-500/30",
                        subclass === 'arc' && "bg-blue-500/30",
                        subclass === 'stasis' && "bg-cyan-500/30",
                        subclass === 'strand' && "bg-green-500/30",
                        subclass === 'prismatic' && "bg-fuchsia-500/30"
                    )}>
                        ?
                    </div>
                )}
                
                {/* Selected indicator */}
                {isSelected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-destiny-gold rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-black font-bold">✓</span>
                    </div>
                )}
                
                {/* Stat indicator dots */}
                {bonuses.length > 0 && !isSelected && (
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {bonuses.map((b, i) => (
                            <div 
                                key={i} 
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    b.value > 0 ? "bg-green-400" : "bg-red-400"
                                )}
                            />
                        ))}
                    </div>
                )}
            </button>
            {tooltipContent}
        </>
    );
}

// ===== Loadout Picker Component (for importing subclass config) =====

interface LoadoutPickerProps {
    classType: number;
    onImportFragments: (fragmentNames: string[]) => void;
    profile: any;
}

function LoadoutPicker({ classType, onImportFragments, profile }: LoadoutPickerProps) {
    const { getLoadoutsWithSubclass, getLoadoutsByClass } = useLoadoutStore();
    const [isOpen, setIsOpen] = useState(false);
    
    const loadoutsWithSubclass = getLoadoutsWithSubclass(classType);
    const allClassLoadouts = getLoadoutsByClass(classType);
    
    // Extract fragment stat bonuses from loadout's subclass config
    const handleSelectLoadout = (loadout: CustomLoadout) => {
        if (loadout.subclassConfig?.fragments) {
            // Map fragment plugHashes to fragment names in SUBCLASS_FRAGMENTS
            // For now we'll try to match by name if available
            const fragmentNames: string[] = [];
            
            loadout.subclassConfig.fragments.forEach(frag => {
                if (frag.name) {
                    // Try to find matching fragment in SUBCLASS_FRAGMENTS
                    const matchingName = Object.keys(SUBCLASS_FRAGMENTS).find(
                        name => name.toLowerCase().includes(frag.name?.toLowerCase() || '')
                    );
                    if (matchingName) {
                        fragmentNames.push(matchingName);
                    }
                }
            });
            
            if (fragmentNames.length > 0) {
                onImportFragments(fragmentNames);
                toast.success(`Imported ${fragmentNames.length} fragments from "${loadout.name}"`);
            } else {
                toast.info(`No matching fragments found in "${loadout.name}"`);
            }
        } else {
            toast.info(`"${loadout.name}" has no subclass configuration`);
        }
        setIsOpen(false);
    };
    
    if (allClassLoadouts.length === 0) {
        return null;
    }
    
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 border transition-all text-sm",
                    isOpen 
                        ? "bg-blue-500/10 border-blue-500 text-blue-400"
                        : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                )}
            >
                <Layers className="w-4 h-4" />
                <span className="flex-1 text-left font-bold uppercase tracking-wider">Import from Loadout</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-800/20 backdrop-blur-md border border-white/10 overflow-hidden mt-1"
                    >
                        <div className="max-h-48 overflow-y-auto">
                            {allClassLoadouts.map((loadout) => {
                                const hasSubclass = loadout.subclassConfig || loadout.subclass;
                                const fragmentCount = loadout.subclassConfig?.fragments?.length || 0;
                                
                                return (
                                    <button
                                        key={loadout.id}
                                        onClick={() => handleSelectLoadout(loadout)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 transition-colors text-left border-b border-white/5 last:border-b-0",
                                            hasSubclass
                                                ? "hover:bg-white/5 text-white"
                                                : "hover:bg-white/5 text-slate-500"
                                        )}
                                    >
                                        <span className="text-lg">{loadout.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold truncate">{loadout.name}</div>
                                            <div className="text-[10px] text-slate-500">
                                                {fragmentCount > 0 
                                                    ? `${fragmentCount} fragments`
                                                    : hasSubclass 
                                                        ? 'Has subclass' 
                                                        : 'No subclass config'
                                                }
                                            </div>
                                        </div>
                                        <div 
                                            className="w-2 h-2 rounded-full" 
                                            style={{ backgroundColor: loadout.color }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ===== Armor Set Result Card =====

interface ArmorSetCardProps {
    set: ArmorSet;
    profile: any;
    membershipInfo: any;
    activeCharacterId: string;
    selectedFragments: string[];
}

function ArmorSetCard({ set, profile, membershipInfo, activeCharacterId, selectedFragments }: ArmorSetCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEquipping, setIsEquipping] = useState(false);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [loadoutName, setLoadoutName] = useState(`Optimized Build (T${set.tiers})`);
    const { createLoadout } = useLoadoutStore();
    const saveInputRef = useRef<HTMLInputElement>(null);
    
    const pieces = [set.helmet, set.gauntlets, set.chest, set.legs, set.classItem];
    const breakdown = getStatBreakdown(set.totalStats);
    
    // Get class type from the armor pieces
    const classType = pieces.find(p => p.classType !== 3)?.classType ?? 0;
    
    // Focus input when dialog opens
    useEffect(() => {
        if (showSaveDialog && saveInputRef.current) {
            saveInputRef.current.focus();
            saveInputRef.current.select();
        }
    }, [showSaveDialog]);
    
    const handleOpenSaveDialog = () => {
        setLoadoutName(`Optimized Build (T${set.tiers})`);
        setShowSaveDialog(true);
    };
    
    const handleSaveAsLoadout = () => {
        if (!loadoutName.trim()) return;
        
        const loadoutItems = pieces
            .filter(piece => piece.itemInstanceId)
            .map(piece => ({
                itemHash: piece.itemHash,
                itemInstanceId: piece.itemInstanceId,
                bucketHash: piece.bucketHash,
            }));
        
        const loadoutId = createLoadout({
            name: loadoutName.trim(),
            classType,
            icon: '⚡',
            color: '#e3ce62',
            items: loadoutItems,
        });
        
        toast.success(`Saved as loadout "${loadoutName.trim()}"`, {
            description: `${loadoutItems.length} armor pieces saved`
        });
        
        setShowSaveDialog(false);
    };
    
    const handleEquip = async () => {
        if (!membershipInfo || !activeCharacterId || isEquipping) return;
        
        setIsEquipping(true);
        toast.loading('Equipping armor set...', { id: 'equip-armor' });
        
        try {
            for (const piece of pieces) {
                if (!piece.itemInstanceId) continue;
                
                const allItems = [
                    ...Object.entries(profile?.characterInventories?.data || {}).flatMap(([charId, data]: [string, any]) => 
                        data.items.map((i: any) => ({ ...i, ownerId: charId }))
                    ),
                    ...Object.entries(profile?.characterEquipment?.data || {}).flatMap(([charId, data]: [string, any]) =>
                        data.items.map((i: any) => ({ ...i, ownerId: charId, isEquipped: true }))
                    ),
                    ...(profile?.profileInventory?.data?.items || []).map((i: any) => ({ ...i, ownerId: 'VAULT' })),
                ];
                
                const currentItem = allItems.find((i: any) => i.itemInstanceId === piece.itemInstanceId);
                if (!currentItem) continue;
                
                if (currentItem.ownerId !== activeCharacterId) {
                    await moveItem(
                        piece.itemInstanceId,
                        piece.itemHash,
                        currentItem.ownerId,
                        activeCharacterId,
                        membershipInfo.membershipType
                    );
                    await new Promise((r) => setTimeout(r, 200));
                }
                
                await equipItem(piece.itemInstanceId, activeCharacterId, membershipInfo.membershipType);
                await new Promise((r) => setTimeout(r, 200));
            }
            
            toast.success('Armor set equipped!', { id: 'equip-armor' });
        } catch (err) {
            console.error('Failed to equip armor set:', err);
            toast.error('Failed to equip armor set', { id: 'equip-armor' });
        } finally {
            setIsEquipping(false);
        }
    };
    
    return (
        <div className="border border-white/10 transition-all hover:border-white/20 break-inside-avoid mb-3">
            {/* Header */}
            <div className="flex items-center gap-3 p-3">
                {/* Armor Pieces */}
                <div className="flex gap-1 flex-1">
                    {pieces.map((piece, idx) => {
                        // Merge instance data with stats for proper tooltip display
                        const baseInstance = profile?.itemComponents?.instances?.data?.[piece.itemInstanceId];
                        const statsData = profile?.itemComponents?.stats?.data?.[piece.itemInstanceId]?.stats;
                        const instanceWithStats = baseInstance ? {
                            ...baseInstance,
                            stats: statsData
                        } : undefined;
                        
                        return (
                            <div key={idx} className="w-16 h-16 relative">
                                {piece.itemInstanceId ? (
                                    <DestinyItemCard
                                        itemHash={piece.itemHash}
                                        itemInstanceId={piece.itemInstanceId}
                                        instanceData={instanceWithStats}
                                        socketsData={profile?.itemComponents?.sockets?.data?.[piece.itemInstanceId]}
                                        className="w-full h-full"
                                        size="small"
                                        hidePower
                                    />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs text-slate-500">?</div>
                                )}
                                {piece.isExotic && (
                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full" />
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {/* Stats Summary - Compact stat tiers */}
                <div className="flex items-center gap-2">
                    {/* Individual stat tiers */}
                    <div className="flex gap-0.5">
                        {breakdown.slice(0, 6).map(({ stat, tier }) => {
                            const colors = STAT_COLORS[stat];
                            return (
                                <div 
                                    key={stat} 
                                    className={cn(
                                        "w-6 h-6 flex items-center justify-center text-[10px] font-bold",
                                        tier >= 10 ? colors.bg : "bg-slate-800",
                                        tier >= 10 ? colors.text : "text-slate-400"
                                    )}
                                    title={`${STAT_NAMES[stat]}: T${tier}`}
                                >
                                    {tier}
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="w-px h-6 bg-white/10" />
                    
                    {/* Total Tiers */}
                    <div className="text-center px-2">
                        <div className="text-lg font-bold text-destiny-gold">{set.tiers}</div>
                        <div className="text-[8px] text-slate-500 uppercase tracking-wider">Tiers</div>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleOpenSaveDialog}
                        className="p-1.5 hover:bg-white/10 transition-colors"
                        title="Save as Loadout"
                    >
                        <Bookmark className="w-4 h-4 text-slate-400 hover:text-destiny-gold" />
                    </button>
                    <button
                        onClick={handleEquip}
                        disabled={isEquipping}
                        className="px-3 py-1.5 bg-destiny-gold text-black font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isEquipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Equip
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-white/10 transition-colors"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                </div>
            </div>
            
            {/* Expanded Details - No animation for better performance with CSS columns */}
            {isExpanded && (
                <div className="border-t border-white/5 p-3 space-y-3 animate-in fade-in duration-150">
                    {/* Stat Breakdown - Horizontal bars (0-200 range) */}
                    <div className="space-y-1.5">
                        {breakdown.map(({ stat, value, tier, waste }) => {
                            const colors = STAT_COLORS[stat];
                            const maxForBar = 200;
                            const widthPercent = Math.min((value / maxForBar) * 100, 100);
                            
                            return (
                                <div key={stat} className="flex items-center gap-3 text-xs">
                                    {/* Stat Name */}
                                    <span className={cn("w-16 text-right font-medium", colors.text)}>{STAT_NAMES[stat]}</span>
                                    
                                    {/* Stat Bar (0-200) - simplified grid */}
                                    <div className="flex-1 h-3 bg-slate-800/60 relative overflow-hidden">
                                        {/* T5, T10, T15, T20 markers only */}
                                        <div className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: '25%' }} />
                                        <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: '50%' }} />
                                        <div className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: '75%' }} />
                                        
                                        {/* Fill bar */}
                                        <div 
                                            className={cn(
                                                "absolute inset-y-0 left-0 z-10",
                                                value >= 100 ? "bg-destiny-gold" : colors.fill
                                            )}
                                            style={{ width: `${widthPercent}%` }}
                                        />
                                    </div>
                                    
                                    {/* Value & Tier */}
                                    <div className="w-16 flex items-center justify-end gap-1">
                                        <span className={cn(
                                            "font-bold",
                                            value >= 100 ? "text-destiny-gold" : "text-white"
                                        )}>
                                            {value}
                                        </span>
                                        <span className={cn(
                                            "text-[9px] font-medium w-6 text-right",
                                            tier >= 10 ? "text-destiny-gold" : "text-slate-500"
                                        )}>
                                            T{tier}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                            
                            {/* Total Row */}
                            <div className="flex items-center gap-3 text-xs pt-1 border-t border-white/10 mt-1">
                                <span className="w-16 text-right font-bold text-slate-400">Total</span>
                                <div className="flex-1" />
                                <div className="w-16 flex items-center justify-end gap-1">
                                    <span className="font-bold text-white">
                                        {breakdown.reduce((s, b) => s + b.value, 0)}
                                    </span>
                                    <span className="text-[9px] font-bold text-destiny-gold w-6 text-right">
                                        T{breakdown.reduce((s, b) => s + b.tier, 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Individual Armor Piece Stats - Table Format */}
                        <div className="border-t border-white/5 pt-3">
                            <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-2">Armor Breakdown</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left py-2 px-2 text-slate-500 font-medium w-20">Armor</th>
                                            <th className="text-left py-2 px-2 text-slate-500 font-medium w-20">Mod</th>
                                            {ALL_STAT_KEYS.map(stat => (
                                                <th key={stat} className={cn("text-center py-2 px-2 font-bold text-xs", STAT_COLORS[stat].text)}>
                                                    {STAT_NAMES[stat]}
                                                </th>
                                            ))}
                                            <th className="text-center py-2 px-2 text-slate-400 font-bold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pieces.map((piece, idx) => {
                                            const pieceTotal = ALL_STAT_KEYS.reduce((sum, stat) => sum + (piece.baseStats[stat] || 0), 0);
                                            const pieceMod = set.modsNeeded[idx];
                                            const baseInstance = profile?.itemComponents?.instances?.data?.[piece.itemInstanceId];
                                            const statsData = profile?.itemComponents?.stats?.data?.[piece.itemInstanceId]?.stats;
                                            const instanceWithStats = baseInstance ? { ...baseInstance, stats: statsData } : undefined;
                                            const modHash = pieceMod ? (pieceMod.value >= 10 ? STAT_MOD_HASHES[pieceMod.stat].plus10 : STAT_MOD_HASHES[pieceMod.stat].plus5) : null;
                                            
                                            return (
                                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                                    {/* Armor Icon */}
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-16 h-16 relative shrink-0">
                                                                {piece.itemInstanceId ? (
                                                                    <DestinyItemCard
                                                                        itemHash={piece.itemHash}
                                                                        itemInstanceId={piece.itemInstanceId}
                                                                        instanceData={instanceWithStats}
                                                                        socketsData={profile?.itemComponents?.sockets?.data?.[piece.itemInstanceId]}
                                                                        className="w-full h-full"
                                                                        size="medium"
                                                                        hidePower
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-500 text-[8px]">?</div>
                                                                )}
                                                                {piece.isExotic && (
                                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Mod Icon */}
                                                    <td className="py-2 px-2">
                                                        {pieceMod ? (
                                                            <div 
                                                                className={cn(
                                                                    "w-16 h-16 relative flex flex-col items-center justify-center border",
                                                                    STAT_COLORS[pieceMod.stat].bg,
                                                                    STAT_COLORS[pieceMod.stat].border
                                                                )}
                                                                title={`+${pieceMod.value} ${STAT_NAMES[pieceMod.stat]}`}
                                                            >
                                                                <span className={cn("text-lg font-bold", STAT_COLORS[pieceMod.stat].text)}>
                                                                    +{pieceMod.value}
                                                                </span>
                                                                <span className="text-[8px] text-slate-400 uppercase tracking-wider">
                                                                    {STAT_NAMES[pieceMod.stat].slice(0, 3)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="w-16 h-16 flex items-center justify-center text-slate-600 bg-slate-800/50 border border-white/5">-</div>
                                                        )}
                                                    </td>
                                                    
                                                    {/* Stats */}
                                                    {ALL_STAT_KEYS.map(stat => {
                                                        const val = piece.baseStats[stat] || 0;
                                                        return (
                                                            <td key={stat} className={cn(
                                                                "text-center py-2 px-2 font-mono text-base",
                                                                val >= 20 ? "text-green-400 font-bold" :
                                                                val >= 15 ? "text-white font-semibold" :
                                                                val >= 10 ? "text-slate-300" :
                                                                val > 0 ? "text-slate-500" : "text-slate-700"
                                                            )}>
                                                                {val > 0 ? val : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    
                                                    {/* Total */}
                                                    <td className={cn(
                                                        "text-center py-2 px-2 font-bold text-base",
                                                        pieceTotal >= 68 ? "text-destiny-gold" :
                                                        pieceTotal >= 65 ? "text-green-400" :
                                                        pieceTotal >= 60 ? "text-white" : "text-slate-400"
                                                    )}>
                                                        {pieceTotal}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* Totals Row */}
                                        <tr className="border-t border-white/20 bg-white/5">
                                            <td className="py-2 px-2 font-bold text-slate-400">Sum</td>
                                            <td className="py-2 px-2"></td>
                                            {ALL_STAT_KEYS.map(stat => {
                                                const sum = pieces.reduce((s, p) => s + (p.baseStats[stat] || 0), 0);
                                                return (
                                                    <td key={stat} className="text-center py-2 px-2 font-bold text-white font-mono text-base">
                                                        {sum}
                                                    </td>
                                                );
                                            })}
                                            <td className="text-center py-2 px-2 font-bold text-destiny-gold text-lg">
                                                {pieces.reduce((s, p) => s + ALL_STAT_KEYS.reduce((ps, stat) => ps + (p.baseStats[stat] || 0), 0), 0)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        {/* Fragments/Aspects - Show selected fragments affecting this build */}
                        {selectedFragments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] uppercase text-slate-500 tracking-wider">Fragments:</span>
                                    {selectedFragments.map((fragName, idx) => {
                                        const fragData = FRAGMENT_STAT_DATA[fragName];
                                        const iconData = FRAGMENT_ICONS[fragName];
                                        if (!fragData) return null;
                                        const colors = SUBCLASS_COLORS[fragData.subclass];
                                        
                                        // Build tooltip text
                                        const tooltipText = fragData.bonuses.length > 0
                                            ? `${fragName} (${fragData.subclass})\n${fragData.bonuses.map(b => `${STAT_NAMES[b.stat]}: ${b.value > 0 ? '+' : ''}${b.value}`).join(', ')}`
                                            : `${fragName} (${fragData.subclass})\nNo stat bonuses`;
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                className={cn(
                                                    "flex items-center gap-1.5 px-1.5 py-0.5 text-[9px] cursor-default",
                                                    colors.bg, "border", colors.border
                                                )}
                                                title={tooltipText}
                                            >
                                                {/* Fragment icon */}
                                                {iconData?.icon && (
                                                    <div className="w-4 h-4 relative shrink-0">
                                                        <Image 
                                                            src={iconData.icon} 
                                                            fill 
                                                            alt="" 
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}
                                                {/* Subclass indicator dot (if no icon) */}
                                                {!iconData?.icon && (
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        fragData.subclass === 'solar' && "bg-orange-500",
                                                        fragData.subclass === 'void' && "bg-purple-500",
                                                        fragData.subclass === 'arc' && "bg-blue-400",
                                                        fragData.subclass === 'stasis' && "bg-cyan-400",
                                                        fragData.subclass === 'strand' && "bg-green-400"
                                                    )} />
                                                )}
                                                <span className={cn("font-medium", colors.text)}>{fragName}</span>
                                                {fragData.bonuses.length > 0 && (
                                                    <span className="flex gap-0.5">
                                                        {fragData.bonuses.map((f: { stat: keyof ArmorStats; value: number }, i: number) => (
                                                            <span key={i} className={cn(
                                                                "font-bold",
                                                                f.value > 0 ? "text-green-400" : "text-red-400"
                                                            )}>
                                                                {f.value > 0 ? '+' : ''}{f.value}
                                                            </span>
                                                        ))}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                </div>
            )}
            
            {/* Save Loadout Dialog */}
            {showSaveDialog && createPortal(
                <div className="fixed inset-0 z-100 flex items-center justify-center">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowSaveDialog(false)}
                    />
                    
                    {/* Dialog */}
                    <div className="relative bg-gray-800/20 border border-white/10 p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Bookmark className="w-5 h-5 text-destiny-gold" />
                            Save Loadout
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-2">
                                    Loadout Name
                                </label>
                                <input
                                    ref={saveInputRef}
                                    type="text"
                                    value={loadoutName}
                                    onChange={(e) => setLoadoutName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveAsLoadout();
                                        if (e.key === 'Escape') setShowSaveDialog(false);
                                    }}
                                    placeholder="Enter loadout name..."
                                    className="w-full px-3 py-2 bg-gray-800/20 border border-white/10 text-white placeholder:text-slate-500 focus:border-destiny-gold focus:outline-none"
                                />
                            </div>
                            
                            {/* Preview */}
                            <div className="p-3 bg-gray-800/20 border border-white/5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Preview</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1">
                                        {pieces.slice(0, 4).map((piece, idx) => (
                                            <div key={idx} className="w-8 h-8 bg-slate-700 border border-white/10">
                                                {piece.itemHash && (
                                                    <DestinyItemCard
                                                        itemHash={piece.itemHash}
                                                        className="w-full h-full"
                                                        size="small"
                                                        hidePower
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        T{set.tiers} • {set.totalStats.weapons + set.totalStats.health + set.totalStats.class + set.totalStats.grenade + set.totalStats.super + set.totalStats.melee} total
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => setShowSaveDialog(false)}
                                className="flex-1 px-4 py-2 border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAsLoadout}
                                disabled={!loadoutName.trim()}
                                className="flex-1 px-4 py-2 bg-destiny-gold text-black font-bold text-sm uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// ===== Main Page =====

export default function OptimizerPage() {
    const { profile, stats, isLoading: profileLoading, isLoggedIn, membershipInfo } = useDestinyProfileContext();
    const [selectedClass, setSelectedClass] = useState<number>(0);
    const [results, setResults] = useState<ArmorSet[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [exoticSearch, setExoticSearch] = useState('');
    const [fragmentSearch, setFragmentSearch] = useState('');
    const [fragmentSubclassFilter, setFragmentSubclassFilter] = useState('prismatic');
    const [exoticSlotFilter, setExoticSlotFilter] = useState<string>('all');
    
    const {
        constraints,
        settings,
        selectedFragments,
        setConstraint,
        resetConstraints,
        updateSettings,
        setExoticFilter,
        toggleFragment,
        clearFragments,
    } = useOptimizerStore();
    
    useEffect(() => {
        setMounted(true);
    }, []);
    
    useEffect(() => {
        if (stats?.classType !== undefined) {
            setSelectedClass(stats.classType);
        }
    }, [stats?.classType]);
    
    // Gather all armor items
    const allItems = useMemo(() => {
        if (!profile) return [];
        const charItems = Object.values(profile.characterInventories?.data || {}).flatMap((c: any) => c.items);
        const equipItems = Object.values(profile.characterEquipment?.data || {}).flatMap((c: any) => c.items);
        const vaultItems = profile.profileInventory?.data?.items || [];
        return [...charItems, ...equipItems, ...vaultItems];
    }, [profile]);
    
    const itemHashes = useMemo(() => allItems.map((i: any) => i.itemHash), [allItems]);
    const { definitions, isLoading: defsLoading } = useItemDefinitions(itemHashes);
    
    const plugHashes = useMemo(() => {
        const hashes = new Set<number>();
        if (profile?.itemComponents?.sockets?.data) {
            Object.values(profile.itemComponents.sockets.data).forEach((socketsData: any) => {
                socketsData.sockets?.forEach((socket: any) => {
                    if (socket.plugHash) hashes.add(socket.plugHash);
                });
            });
        }
        return Array.from(hashes);
    }, [profile]);
    
    const { definitions: plugDefs, isLoading: plugsLoading } = useItemDefinitions(plugHashes);
    
    const armorPieces = useMemo(() => {
        const pieces: ArmorPiece[] = [];
        
        allItems.forEach((item: any) => {
            const itemDef = definitions[item.itemHash];
            const instanceData = profile?.itemComponents?.instances?.data?.[item.itemInstanceId];
            const socketsData = profile?.itemComponents?.sockets?.data?.[item.itemInstanceId];
            
            // Stats are stored separately in itemComponents.stats.data
            const itemStats = profile?.itemComponents?.stats?.data?.[item.itemInstanceId]?.stats;
            
            // Merge instance data with stats for extractArmorPiece
            const instanceDataWithStats = instanceData ? {
                ...instanceData,
                stats: itemStats
            } : undefined;
            
            const piece = extractArmorPiece(item, itemDef, instanceDataWithStats, socketsData, plugDefs);
            if (piece && (piece.classType === selectedClass || piece.classType === 3)) {
                pieces.push(piece);
            }
        });
        
        return pieces;
    }, [allItems, definitions, profile, plugDefs, selectedClass]);
    
    const exoticsBySlot = useMemo(() => {
        return getExoticsBySlot(armorPieces, selectedClass);
    }, [armorPieces, selectedClass]);
    
    const fragmentBonus = useMemo(() => {
        return calculateSubclassBonus(selectedFragments);
    }, [selectedFragments]);
    
    // Calculate the theoretical maximum stats per slot (physical limit of armor)
    const physicalMaxStats = useMemo(() => {
        const maxStats: ArmorStats = createEmptyStats();
        
        if (armorPieces.length === 0) {
            // Default max if no armor (reasonable estimate)
            return { weapons: 100, health: 100, class: 100, grenade: 100, super: 100, melee: 100 };
        }
        
        // Group pieces by slot
        const slots = {
            helmet: armorPieces.filter(p => p.bucketHash === BUCKETS.HELMET),
            gauntlets: armorPieces.filter(p => p.bucketHash === BUCKETS.GAUNTLETS),
            chest: armorPieces.filter(p => p.bucketHash === BUCKETS.CHEST_ARMOR),
            legs: armorPieces.filter(p => p.bucketHash === BUCKETS.LEG_ARMOR),
            classItem: armorPieces.filter(p => p.bucketHash === BUCKETS.CLASS_ARMOR),
        };
        
        // For each stat, find the maximum possible by taking the best piece from each slot
        ALL_STAT_KEYS.forEach(stat => {
            let maxForStat = 0;
            
            // Find best piece for this stat in each slot
            Object.values(slots).forEach(slotPieces => {
                if (slotPieces.length === 0) return;
                const bestPiece = slotPieces.reduce((best, piece) => 
                    piece.baseStats[stat] > best.baseStats[stat] ? piece : best
                , slotPieces[0]);
                
                // Add base stat + potential masterwork bonus (+2 per piece)
                maxForStat += bestPiece.baseStats[stat] + (settings.assumeMasterwork ? 2 : 0);
            });
            
            // Add potential mod bonus (+10 per stat mod, 5 armor pieces = 50 max from mods)
            // But realistically limited to around 30-40 due to energy constraints
            maxForStat += 30;
            
            // Add fragment bonus if applicable
            maxForStat += fragmentBonus[stat] || 0;
            
            // Cap at game maximum
            maxStats[stat] = Math.min(maxForStat, MAX_STAT_VALUE);
        });
        
        return maxStats;
    }, [armorPieces, settings.assumeMasterwork, fragmentBonus]);
    
    // Calculate total stat budget available
    const totalStatBudget = useMemo(() => {
        if (armorPieces.length === 0) return 350; // Default estimate
        
        // Group pieces by slot
        const slots = {
            helmet: armorPieces.filter(p => p.bucketHash === BUCKETS.HELMET),
            gauntlets: armorPieces.filter(p => p.bucketHash === BUCKETS.GAUNTLETS),
            chest: armorPieces.filter(p => p.bucketHash === BUCKETS.CHEST_ARMOR),
            legs: armorPieces.filter(p => p.bucketHash === BUCKETS.LEG_ARMOR),
            classItem: armorPieces.filter(p => p.bucketHash === BUCKETS.CLASS_ARMOR),
        };
        
        // Calculate max total stats from best pieces (taking highest total per slot)
        let maxTotal = 0;
        Object.values(slots).forEach(slotPieces => {
            if (slotPieces.length === 0) return;
            // Find piece with highest total base stats
            const bestPiece = slotPieces.reduce((best, piece) => {
                const bestTotal = ALL_STAT_KEYS.reduce((sum, stat) => sum + best.baseStats[stat], 0);
                const pieceTotal = ALL_STAT_KEYS.reduce((sum, stat) => sum + piece.baseStats[stat], 0);
                return pieceTotal > bestTotal ? piece : best;
            }, slotPieces[0]);
            
            const pieceTotal = ALL_STAT_KEYS.reduce((sum, stat) => sum + bestPiece.baseStats[stat], 0);
            // Add masterwork bonus (+2 per stat = +12 per piece)
            maxTotal += pieceTotal + (settings.assumeMasterwork ? 12 : 0);
        });
        
        // Add mod budget (realistically ~50-60 stat points from mods across all pieces)
        maxTotal += 50;
        
        // Add net fragment bonus
        const netFragmentBonus = ALL_STAT_KEYS.reduce((sum, stat) => sum + (fragmentBonus[stat] || 0), 0);
        maxTotal += netFragmentBonus;
        
        return maxTotal;
    }, [armorPieces, settings.assumeMasterwork, fragmentBonus]);
    
    // Calculate dynamic max achievable stats based on other stat selections
    // When you set one stat high, it reduces the budget available for others
    const maxAchievableStats = useMemo(() => {
        const dynamicMax: ArmorStats = createEmptyStats();
        
        // Calculate total stats currently committed to targets
        const totalCommitted = ALL_STAT_KEYS.reduce((sum, stat) => {
            return sum + (constraints[stat]?.min ?? 0);
        }, 0);
        
        // For each stat, calculate how much budget remains if we want to max this stat
        ALL_STAT_KEYS.forEach(stat => {
            // Stats committed to OTHER stats (not this one)
            const otherStatsCommitted = totalCommitted - (constraints[stat]?.min ?? 0);
            
            // Remaining budget after other stats are satisfied
            const remainingBudget = totalStatBudget - otherStatsCommitted;
            
            // The max for this stat is the minimum of:
            // 1. Physical max from armor (per-stat limit)
            // 2. Remaining budget after other stats
            // 3. Game maximum (200)
            dynamicMax[stat] = Math.max(0, Math.min(
                physicalMaxStats[stat],
                remainingBudget,
                MAX_STAT_VALUE
            ));
        });
        
        return dynamicMax;
    }, [physicalMaxStats, totalStatBudget, constraints]);
    
    const handleOptimize = useCallback(() => {
        setIsOptimizing(true);
        
        setTimeout(() => {
            try {
                const currentSettings: OptimizerSettings = {
                    ...settings,
                    subclassConfig: selectedFragments.length > 0 ? {
                        name: 'Custom',
                        fragments: [],
                        totalBonus: fragmentBonus,
                    } : null,
                };
                
                const optimalSets = findOptimalArmorSets(
                    armorPieces,
                    selectedClass,
                    constraints,
                    currentSettings,
                    50
                );
                setResults(optimalSets);
                
                if (optimalSets.length === 0) {
                    toast.error('No armor sets found matching your criteria');
                } else {
                    toast.success(`Found ${optimalSets.length} armor combinations`);
                }
            } catch (err) {
                console.error('Optimization error:', err);
                toast.error('Failed to optimize armor');
            } finally {
                setIsOptimizing(false);
            }
        }, 100);
    }, [armorPieces, selectedClass, constraints, settings, selectedFragments, fragmentBonus]);
    
    const activeCharacterId = stats?.characterId || '';
    const isDataLoading = profileLoading || defsLoading || plugsLoading;
    
    const totalTargetTiers = ALL_STAT_KEYS.reduce((sum, stat) => 
        sum + getStatTier(constraints[stat]?.min ?? 0), 0);
    
    if (!mounted) return null;
    
    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Target className="w-16 h-16 text-slate-600" />
                <div className="text-slate-400">Please login to use the armor optimizer</div>
                <button
                    onClick={() => loginWithBungie()}
                    className="px-6 py-2 bg-destiny-gold text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
                >
                    Login
                </button>
            </div>
        );
    }
    
    return (
        <div className="space-y-6 pt-10">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* Class Tabs */}
                <div className="flex items-center gap-2">
                    <div className="flex p-1 border border-white/10">
                        {[0, 1, 2].map((classType) => (
                            <button
                                key={classType}
                                onClick={() => {
                                    setSelectedClass(classType);
                                    setResults([]);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all",
                                    selectedClass === classType
                                        ? "bg-destiny-gold text-black"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                <Image src={CLASS_ICONS[classType]} width={16} height={16} alt="" className={selectedClass !== classType ? "opacity-50 grayscale" : ""} />
                                {CLASS_NAMES[classType]}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Stats Summary */}
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-400 uppercase tracking-widest">Target Tiers</span>
                        <span className="text-2xl font-bold text-destiny-gold">{totalTargetTiers}</span>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-400 uppercase tracking-widest">Armor Pieces</span>
                        <span className="text-lg font-bold text-white">{armorPieces.length}</span>
                    </div>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="border border-white/10 min-h-[80vh]">
                <div className="flex h-[80vh]">
                    {/* Left Sidebar: Configuration */}
                    <div className="w-[550px] shrink-0 border-r border-white/10 flex flex-col overflow-y-auto">
                        {/* Top Row: Exotic Grid | Fragment Grid side by side */}
                        <div className="flex border-b border-white/5 min-h-[320px]">
                            {/* Exotic Selection (Vertical Grid) */}
                            <div className="w-1/2 p-3 border-r border-white/5 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Exotic Armor</h3>
                                    <span className="text-[9px] text-slate-600">
                                        {Object.values(exoticsBySlot).flat().length} available
                                    </span>
                                </div>
                                
                                {/* Search */}
                                <div className="relative mb-2">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search exotics..."
                                        value={exoticSearch}
                                        onChange={(e) => setExoticSearch(e.target.value)}
                                        className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-slate-900 border border-white/10 focus:border-destiny-gold/50 focus:outline-none text-white placeholder:text-slate-600"
                                    />
                                </div>
                                
                                {/* Slot Filter Tabs */}
                                <div className="flex gap-1 mb-2 flex-wrap">
                                    {['all', 'helmet', 'gauntlets', 'chest', 'legs'].map(slot => (
                                        <button
                                            key={slot}
                                            onClick={() => setExoticSlotFilter(slot)}
                                            className={cn(
                                                "px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                                                exoticSlotFilter === slot
                                                    ? "bg-destiny-gold/20 text-destiny-gold"
                                                    : "text-slate-500 hover:text-white"
                                            )}
                                        >
                                            {slot === 'all' ? 'All' : slot.charAt(0).toUpperCase() + slot.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Any/None buttons */}
                                <div className="flex gap-1 mb-2">
                                    <button
                                        onClick={() => setExoticFilter({ slot: 'any', itemHash: null })}
                                        className={cn(
                                            "flex-1 py-1.5 text-[9px] font-bold uppercase transition-colors",
                                            settings.exoticFilter.slot === 'any' && !settings.exoticFilter.itemHash
                                                ? "bg-destiny-gold text-black"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        )}
                                    >
                                        Any
                                    </button>
                                    <button
                                        onClick={() => setExoticFilter({ slot: 'none', itemHash: null })}
                                        className={cn(
                                            "flex-1 py-1.5 text-[9px] font-bold uppercase transition-colors",
                                            settings.exoticFilter.slot === 'none'
                                                ? "bg-slate-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        )}
                                    >
                                        None
                                    </button>
                                </div>
                                
                                {/* Exotic items grid - ALL exotics grouped by slot */}
                                <div className="flex-1 overflow-y-auto">
                                    {Object.entries(exoticsBySlot)
                                        .filter(([slot]) => exoticSlotFilter === 'all' || slot === exoticSlotFilter)
                                        .map(([slot, exotics]) => {
                                            const filteredExotics = exotics.filter(exotic => {
                                                if (!exoticSearch) return true;
                                                return exotic.name?.toLowerCase().includes(exoticSearch.toLowerCase());
                                            });
                                            
                                            if (filteredExotics.length === 0) return null;
                                            
                                            return (
                                                <div key={slot} className="mb-2">
                                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                                                        {slot.charAt(0).toUpperCase() + slot.slice(1)} ({filteredExotics.length})
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-1">
                                                        {filteredExotics.map((exotic) => {
                                                            // Merge instance data with stats for proper tooltip display
                                                            const baseInstance = profile?.itemComponents?.instances?.data?.[exotic.itemInstanceId || ''];
                                                            const statsData = profile?.itemComponents?.stats?.data?.[exotic.itemInstanceId || '']?.stats;
                                                            const instanceWithStats = baseInstance ? {
                                                                ...baseInstance,
                                                                stats: statsData
                                                            } : undefined;
                                                            
                                                            return (
                                                                <button
                                                                    key={exotic.itemInstanceId || exotic.itemHash}
                                                                    onClick={() => setExoticFilter({ 
                                                                        slot: slot as any, 
                                                                        itemHash: exotic.itemHash 
                                                                    })}
                                                                    className={cn(
                                                                        "w-16 h-16 relative border-2 transition-all",
                                                                        settings.exoticFilter.itemHash === exotic.itemHash
                                                                            ? "border-yellow-500 scale-105 shadow-[0_0_8px_rgba(234,179,8,0.4)]"
                                                                            : "border-transparent hover:border-white/30"
                                                                    )}
                                                                >
                                                                    <DestinyItemCard
                                                                        itemHash={exotic.itemHash}
                                                                        itemInstanceId={exotic.itemInstanceId}
                                                                        instanceData={instanceWithStats}
                                                                        socketsData={profile?.itemComponents?.sockets?.data?.[exotic.itemInstanceId || '']}
                                                                        className="w-full h-full"
                                                                        size="medium"
                                                                        hidePower
                                                                    />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                            
                            {/* Fragment Selection (Icon Grid with Tooltips) */}
                            <div className="w-1/2 p-3 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fragments</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-slate-600">{selectedFragments.length} selected</span>
                                        {selectedFragments.length > 0 && (
                                            <button
                                                onClick={clearFragments}
                                                className="text-[9px] text-red-400 hover:text-red-300"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Search */}
                                <div className="relative mb-2">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search fragments..."
                                        value={fragmentSearch}
                                        onChange={(e) => setFragmentSearch(e.target.value)}
                                        className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-slate-900 border border-white/10 focus:border-purple-500/50 focus:outline-none text-white placeholder:text-slate-600"
                                    />
                                </div>
                                
                                {/* Subclass Filter Tabs - Icons Only */}
                                <div className="flex gap-1 mb-2">
                                    {SUBCLASS_OPTIONS.map(sub => (
                                        <button
                                            key={sub.key}
                                            onClick={() => setFragmentSubclassFilter(sub.key)}
                                            className={cn(
                                                "p-1.5 transition-all rounded-sm flex items-center justify-center",
                                                fragmentSubclassFilter === sub.key
                                                    ? "bg-white/15 ring-1 ring-white/30"
                                                    : "opacity-50 hover:opacity-100 hover:bg-white/5"
                                            )}
                                            title={sub.name}
                                        >
                                            {sub.icon ? (
                                                <img 
                                                    src={sub.icon} 
                                                    alt={sub.name}
                                                    className="w-5 h-5"
                                                />
                                            ) : (
                                                <span className={cn(
                                                    "w-5 h-5 flex items-center justify-center font-black text-sm",
                                                    sub.color
                                                )}>
                                                    {sub.letter}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Fragment bonus summary */}
                                {selectedFragments.length > 0 && (
                                    <div className="mb-2 p-1.5 bg-purple-500/10 border border-purple-500/30 text-[9px] flex flex-wrap gap-1">
                                        {ALL_STAT_KEYS.map(stat => fragmentBonus[stat] !== 0 && (
                                            <span key={stat} className={cn(
                                                fragmentBonus[stat] > 0 ? "text-green-400" : "text-red-400"
                                            )}>
                                                {STAT_NAMES[stat].slice(0,3)}: {fragmentBonus[stat] > 0 ? '+' : ''}{fragmentBonus[stat]}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Fragment Icon Grid */}
                                <div className="grid grid-cols-5 gap-1.5 flex-1 overflow-y-auto content-start py-1">
                                    {Object.keys(FRAGMENT_ICONS)
                                        .filter(name => {
                                            // Subclass filter - filter by selected subclass
                                            const statData = FRAGMENT_STAT_DATA[name];
                                            if (statData?.subclass !== fragmentSubclassFilter) return false;
                                            // Search filter
                                            if (fragmentSearch) {
                                                return name.toLowerCase().includes(fragmentSearch.toLowerCase());
                                            }
                                            return true;
                                        })
                                        .map(name => (
                                            <FragmentIcon
                                                key={name}
                                                name={name}
                                                isSelected={selectedFragments.includes(name)}
                                                onClick={() => toggleFragment(name)}
                                            />
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                        
                        {/* Loadout Import */}
                        <div className="p-3 border-b border-white/5">
                            <LoadoutPicker
                                classType={selectedClass}
                                onImportFragments={(names) => {
                                    clearFragments();
                                    names.forEach(name => toggleFragment(name));
                                }}
                                profile={profile}
                            />
                        </div>
                        
                        {/* Stats Section - Full Width Rows */}
                        <div className="p-3 border-b border-white/5 flex-1">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Target Stats</h3>
                                    <span className="text-[9px] text-slate-500">Limited by your armor</span>
                                </div>
                                <button
                                    onClick={resetConstraints}
                                    className="text-[9px] text-slate-500 hover:text-white uppercase tracking-wider flex items-center gap-1"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Reset
                                </button>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex items-center gap-3 mb-2 text-[8px] text-slate-500">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-amber-500" />
                                    <span>Max achievable</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-2 bg-slate-800/80" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239,68,68,0.2) 2px, rgba(239,68,68,0.2) 4px)' }} />
                                    <span>Unreachable</span>
                                </div>
                            </div>
                            
                            <div className="space-y-0">
                                {ALL_STAT_KEYS.map((stat) => (
                                    <StatInput
                                        key={stat}
                                        stat={stat}
                                        value={constraints[stat]?.min ?? 0}
                                        fragmentBonus={fragmentBonus[stat] ?? 0}
                                        maxAchievable={maxAchievableStats[stat]}
                                        onChange={(value) => setConstraint(stat, { min: value, max: MAX_STAT_VALUE })}
                                    />
                                ))}
                            </div>
                        </div>
                        
                        {/* Settings */}
                        <div className="p-3 border-b border-white/5">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="w-full flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider"
                            >
                                <span>Settings</span>
                                <ChevronRight className={cn("w-4 h-4 transition-transform", showSettings && "rotate-90")} />
                            </button>
                            
                            <AnimatePresence>
                                {showSettings && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-2 grid grid-cols-2 gap-2"
                                    >
                                        {[
                                            { key: 'assumeMasterwork', label: 'Assume MW' },
                                            { key: 'artificeBonus', label: 'Artifice' },
                                            { key: 'minimizeWaste', label: 'Min Waste' },
                                            { key: 'onlyMasterworked', label: 'MW Only' },
                                        ].map(({ key, label }) => (
                                            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(settings as any)[key]}
                                                    onChange={(e) => updateSettings({ [key]: e.target.checked })}
                                                    className="w-3 h-3 accent-destiny-gold"
                                                />
                                                <span className="text-[10px] text-slate-400">{label}</span>
                                            </label>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        
                        {/* Optimize Button */}
                        <div className="p-3 mt-auto">
                            <button
                                onClick={handleOptimize}
                                disabled={isOptimizing || isDataLoading}
                                className="w-full py-3 bg-destiny-gold text-black font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isOptimizing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Optimizing...
                                    </>
                                ) : isDataLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        Find Optimal Armor
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {/* Right: Results - 2 Columns */}
                    <div className="flex-1 overflow-y-auto p-4 h-full">
                        {results.length > 0 ? (
                            <div>
                                <div className="py-2 border-b border-white/10 mb-4">
                                    <h2 className="text-lg font-light text-white flex items-center gap-2">
                                        <Award className="w-5 h-5 text-destiny-gold" />
                                        Results ({results.length})
                                    </h2>
                                </div>
                                
                                {/* Masonry Layout - cards fill gaps when others expand */}
                                <div className="columns-1 xl:columns-2 gap-3">
                                    {results.map((set, idx) => (
                                        <ArmorSetCard
                                            key={idx}
                                            set={set}
                                            profile={profile}
                                            membershipInfo={membershipInfo}
                                            activeCharacterId={activeCharacterId}
                                            selectedFragments={selectedFragments}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                                <Target className="w-12 h-12 opacity-20" />
                                <div className="text-center">
                                    <p className="font-medium">No results yet</p>
                                    <p className="text-sm text-slate-600 mt-1">Set your target stats and click &quot;Find Optimal Armor&quot;</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
