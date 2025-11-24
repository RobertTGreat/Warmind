export enum StatHashes {
  Accuracy = 1591432999,
  AimAssistance = 1345609583,
  AirborneEffectiveness = 2714457168,
  AmmoCapacity = 925767036,
  AmmoGeneration = 1931675084,
  AnyEnergyTypeCost = 3578062600,
  ArcCost = 3779394102,
  ArcDamageResistance = 1546607978,
  ArmorEnergyCapacity_16120457 = 16120457,
  ArmorEnergyCapacity_2018193158 = 2018193158,
  ArmorEnergyCapacity_2441327376 = 2441327376,
  ArmorEnergyCapacity_3625423501 = 3625423501,
  ArmorEnergyCapacity_3950461274 = 3950461274,
  AspectEnergyCapacity = 2223994109,
  Attack = 1480404414,
  BlastRadius = 3614673599,
  Boost = 3017642079,
  ChargeRate = 3022301683,
  ChargeTime = 2961396640,
  Class = 1943323491,
  ClassDupe = 2135857333,
  Defense = 3897883278,
  DrawTime = 447667954,
  Durability = 360359141,
  FragmentCost = 119204074,
  GhostEnergyCapacity = 237763788,
  Grenade = 1735777505,
  GuardEfficiency = 2762071195,
  GuardEndurance = 3736848092,
  GuardResistance = 209426660,
  Handicap = 2341766298,
  Handling = 943549884,
  Health = 392767087,
  HeroicResistance = 1546607977,
  Impact = 4043523819,
  Magazine = 3871231066,
  Melee = 4244567218,
  MeleeDupe = 3493869314,
  ModCost = 514071887,
  MoveSpeed = 3907551967,
  Persistence = 3085395333,
  Power = 1935470627,
  PowerBonus = 3289069874,
  PrecisionDamage = 3597844532,
  Range = 1240592695,
  RecoilDirection = 2715839340,
  ReloadSpeed = 4188031367,
  RoundsPerMinute = 4284893193,
  ScoreMultiplier = 2733264856,
  ShieldDuration = 1842278586,
  SolarCost = 3344745325,
  SolarDamageResistance = 1546607979,
  Speed = 1501155019,
  Stability = 155624089,
  StasisCost = 998798867,
  Super = 144602215,
  SwingSpeed = 2837207746,
  TimeToAimDownSights = 3988418950,
  Velocity = 2523465841,
  VoidCost = 2399985800,
  VoidDamageResistance = 1546607980,
  Weapons = 2996146975,
  Zoom = 3555269338,
}

export const STAT_NAMES_BY_HASH: Record<number, string> = {};

// Populate the reverse mapping
for (const [key, value] of Object.entries(StatHashes)) {
  if (typeof value === 'number') {
    // Insert spaces before capital letters for nicer display (e.g. "AimAssistance" -> "Aim Assistance")
    STAT_NAMES_BY_HASH[value] = key.replace(/([A-Z])/g, ' $1').trim();
  }
}

// Manual overrides for cleaner names
STAT_NAMES_BY_HASH[StatHashes.AimAssistance] = "Aim Assistance";
STAT_NAMES_BY_HASH[StatHashes.AirborneEffectiveness] = "Airborne Effectiveness";
STAT_NAMES_BY_HASH[StatHashes.RoundsPerMinute] = "RPM";
STAT_NAMES_BY_HASH[StatHashes.ReloadSpeed] = "Reload Speed";
STAT_NAMES_BY_HASH[StatHashes.ChargeTime] = "Charge Time";
STAT_NAMES_BY_HASH[StatHashes.DrawTime] = "Draw Time";
STAT_NAMES_BY_HASH[StatHashes.RecoilDirection] = "Recoil Direction";
STAT_NAMES_BY_HASH[StatHashes.BlastRadius] = "Blast Radius";
STAT_NAMES_BY_HASH[StatHashes.ShieldDuration] = "Shield Duration";
STAT_NAMES_BY_HASH[StatHashes.GuardEfficiency] = "Guard Efficiency";
STAT_NAMES_BY_HASH[StatHashes.GuardEndurance] = "Guard Endurance";
STAT_NAMES_BY_HASH[StatHashes.GuardResistance] = "Guard Resistance";
STAT_NAMES_BY_HASH[StatHashes.SwingSpeed] = "Swing Speed";
STAT_NAMES_BY_HASH[StatHashes.ChargeRate] = "Charge Rate";
STAT_NAMES_BY_HASH[StatHashes.TimeToAimDownSights] = "ADS Speed";

