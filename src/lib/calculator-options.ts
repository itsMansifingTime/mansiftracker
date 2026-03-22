export type CalculatorOptions = {
  includeUltimateWise: boolean;
  includeVampirism: boolean;
  includeSharpness: boolean;
  includeExperience: boolean;
  includeGiantKiller: boolean;
  includeEnderSlayer: boolean;
  includeVenomous: boolean;
  gemsUnlocked: boolean;
  useFlawlessSapphire: boolean;
  usePerfectSapphire: boolean;
  includeWitherShield: boolean;
  includeShadowWarp: boolean;
  includeImplosion: boolean;
};

export const DEFAULT_CALCULATOR_OPTIONS: CalculatorOptions = {
  includeUltimateWise: true,
  includeVampirism: true,
  includeSharpness: true,
  includeExperience: true,
  includeGiantKiller: true,
  includeEnderSlayer: true,
  includeVenomous: true,
  gemsUnlocked: true,
  useFlawlessSapphire: true,
  usePerfectSapphire: false,
  includeWitherShield: true,
  includeShadowWarp: true,
  includeImplosion: true,
};

/** Full build used for snapshot when logging sales. */
export const TRACKER_SNAPSHOT_OPTIONS: CalculatorOptions = {
  includeUltimateWise: true,
  includeVampirism: true,
  includeSharpness: true,
  includeExperience: true,
  includeGiantKiller: true,
  includeEnderSlayer: true,
  includeVenomous: true,
  gemsUnlocked: true,
  useFlawlessSapphire: false,
  usePerfectSapphire: true,
  includeWitherShield: true,
  includeShadowWarp: true,
  includeImplosion: true,
};
