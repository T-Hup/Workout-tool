/**
 * Subsidy Calculator Module
 * 
 * This module provides functionality to determine subsidy eligibility
 * for houses based on municipality-specific criteria.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * House data required for subsidy eligibility check
 */
export interface HouseData {
  gemeente: string;
  bag_id: string;
  bouwjaar: number;
  woz_waarde: number;
  energielabel: string;      // e.g., "A", "C", "G", or "ONBEKEND"
  woningtype: string;        // e.g., "Tussenwoning" or "Appartement"
  heeft_reeds_subsidie: boolean; // From database check
}

/**
 * Subsidy amount information for a single route
 */
export interface SubsidieRoute {
  type: 'ZOISO' | 'Voucher' | 'Geen';
  bedrag: number; // Amount in euros
  beschrijving?: string; // Optional description
}

/**
 * Configuration for a specific target group (doelgroep)
 */
export interface DoelgroepConfig {
  actief: boolean;
  max_bouwjaar?: number | null;
  max_woz?: number | null;
  toegestane_labels?: string[];
  subsidie_routes?: SubsidieRoute[]; // Multiple subsidy routes for this target group
}

/**
 * Municipality-specific configuration with three target groups
 */
export interface GemeenteConfig {
  doelgroep_1: DoelgroepConfig;
  doelgroep_2: DoelgroepConfig;
  doelgroep_3: DoelgroepConfig;
}

/**
 * Subsidy details for a specific route
 */
export interface SubsidieDetail {
  doelgroep: string;
  route: string; // ZOISO or Voucher
  bedrag: number;
  beschrijving?: string;
}

/**
 * Result of subsidy eligibility check
 */
export interface SubsidieResultaat {
  status?: "AFGEWEZEN";
  reden?: string;
  toegewezen_doelgroepen?: string[];
  subsidie_details?: SubsidieDetail[]; // Details of available subsidies
  warnings?: string[];
  afwijs_redenen?: Record<string, string>;
}

// ============================================================================
// CONFIGURATION DATA
// ============================================================================

/**
 * Subsidy configuration per municipality
 * Contains rules for three target groups per municipality
 */
/**
 * Subsidy configuration per municipality
 * Contains rules for three target groups per municipality
 */
export const DEFAULT_SUBSIDIE_CONFIG: {
  gemeenten: Record<string, GemeenteConfig>;
} = {
  gemeenten: {
    Bernheze: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1400 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    Boekel: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1460 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    Maashorst: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1250 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    Meierijstad: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1900 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G"],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    Boxtel: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1400 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    "Sint-Michielsgestel": {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1500 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    "s-Hertogenbosch": {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1983,
        max_woz: 498200,
        toegestane_labels: ["C", "D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1400 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1983,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    Oss: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1000 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["D", "E", "F", "G"],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
    Vught: {
      doelgroep_1: { actief: false }, // Not active in MVP
      doelgroep_2: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: 498200,
        toegestane_labels: ["D", "E", "F", "G", "ONBEKEND"],
        subsidie_routes: [
          { type: 'ZOISO', bedrag: 1500 },
          { type: 'Voucher', bedrag: 1250 },
        ],
      },
      doelgroep_3: {
        actief: true,
        max_bouwjaar: 1995,
        max_woz: null,
        toegestane_labels: [],
        subsidie_routes: [{ type: 'Geen', bedrag: 0 }],
      },
    },
  },
};

// ============================================================================
// CONSTANTS
// ============================================================================

const DOELGROEP_KEYS = ["doelgroep_1", "doelgroep_2", "doelgroep_3"] as const;
const INCOME_CHECK_WARNING = "Let op: Inkomenscheck niet uitgevoerd (MVP).";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes energy label to uppercase for consistent comparison
 */
function normalizeEnergyLabel(label: string): string {
  return label.trim().toUpperCase();
}

/**
 * Checks if a house type is an apartment
 */
function isAppartement(woningtype: string): boolean {
  return /appartement/i.test(woningtype.trim());
}

/**
 * Validates if building year meets the requirement
 * Building year must be strictly less than max_bouwjaar
 */
function meetsYearRequirement(
  bouwjaar: number,
  max_bouwjaar: number | null | undefined
): boolean {
  if (max_bouwjaar === null || max_bouwjaar === undefined) {
    return true;
  }
  return bouwjaar < max_bouwjaar;
}

/**
 * Validates if WOZ value meets the requirement
 * WOZ value must be less than or equal to max_woz
 */
function meetsWozRequirement(
  woz_waarde: number,
  max_woz: number | null | undefined
): boolean {
  if (max_woz === null || max_woz === undefined) {
    return true;
  }
  return woz_waarde <= max_woz;
}

/**
 * Validates if energy label is allowed
 * Empty list means all labels are allowed
 */
function meetsLabelRequirement(
  label: string,
  toegestane_labels: string[] | undefined
): boolean {
  if (!toegestane_labels || toegestane_labels.length === 0) {
    return true;
  }

  const normalizedLabel = normalizeEnergyLabel(label);
  return toegestane_labels.some(
    (allowed) => normalizeEnergyLabel(allowed) === normalizedLabel
  );
}

/**
 * Evaluates a single target group (doelgroep) for eligibility
 */
function evaluateDoelgroep(
  houseData: HouseData,
  dgConfig: DoelgroepConfig
): { eligible: boolean; reason?: string } {
  // Skip inactive target groups
  if (!dgConfig.actief) {
    return { eligible: false };
  }

  // Check building year requirement
  if (!meetsYearRequirement(houseData.bouwjaar, dgConfig.max_bouwjaar)) {
    const maxYear = dgConfig.max_bouwjaar! - 1;
    return {
      eligible: false,
      reason: `Bouwjaar ${houseData.bouwjaar} > ${maxYear}`,
    };
  }

  // Check WOZ value requirement
  if (!meetsWozRequirement(houseData.woz_waarde, dgConfig.max_woz)) {
    return {
      eligible: false,
      reason: `WOZ-waarde ${houseData.woz_waarde} > ${dgConfig.max_woz}`,
    };
  }

  // Check energy label requirement
  if (!meetsLabelRequirement(houseData.energielabel, dgConfig.toegestane_labels)) {
    const normalizedLabel = normalizeEnergyLabel(houseData.energielabel);
    return {
      eligible: false,
      reason: `Energielabel ${normalizedLabel} niet toegestaan`,
    };
  }

  return { eligible: true };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Determines subsidy eligibility based on house data.
 * Follows MVP rules from configuration.
 *
 * @param houseData - House and owner data
 * @returns SubsidieResultaat with rejection or assigned target groups
 * @throws Error if municipality is not supported
 * 
 * @example
 * ```typescript
 * const result = checkSubsidyEligibility({
 *   gemeente: "Boxtel",
 *   bag_id: "12345",
 *   bouwjaar: 1990,
 *   woz_waarde: 400000,
 *   energielabel: "D",
 *   woningtype: "Tussenwoning",
 *   heeft_reeds_subsidie: false
 * });
 * ```
 */
export function checkSubsidyEligibility(
  houseData: HouseData,
  configOverride?: { gemeenten: Record<string, GemeenteConfig> }
): SubsidieResultaat {
  const config = configOverride || DEFAULT_SUBSIDIE_CONFIG;
  // ========================================================================
  // BLOCKER 1: Duplicate Application Check
  // ========================================================================
  if (houseData.heeft_reeds_subsidie) {
    return {
      status: "AFGEWEZEN",
      reden: "BAG_ID reeds bekend: subsidie al verstrekt.",
    };
  }

  // ========================================================================
  // BLOCKER 2: Housing Type Check
  // ========================================================================
  if (isAppartement(houseData.woningtype)) {
    return {
      status: "AFGEWEZEN",
      reden: "Woningtype niet toegestaan: Appartementen uitgesloten.",
    };
  }

  // ========================================================================
  // Load Municipality Configuration
  // ========================================================================
  const gemeenteConfig = config.gemeenten[houseData.gemeente];
  if (!gemeenteConfig) {
    throw new Error(`Gemeente "${houseData.gemeente}" niet ondersteund`);
  }

  // ========================================================================
  // Evaluate All Target Groups
  // ========================================================================

  // Track eligible target groups before applying business rules
  const eligible_doelgroepen: string[] = [];
  const afwijs_redenen: Record<string, string> = {};

  for (const doelgroepKey of DOELGROEP_KEYS) {
    const dgConfig = gemeenteConfig[doelgroepKey];
    const evaluation = evaluateDoelgroep(houseData, dgConfig);

    if (evaluation.eligible) {
      eligible_doelgroepen.push(doelgroepKey);
    } else if (evaluation.reason) {
      afwijs_redenen[doelgroepKey] = evaluation.reason;
    }
  }

  // ========================================================================
  // Apply Business Rules
  // ========================================================================

  // Rule 1: If Doelgroep 2 is eligible, exclude Doelgroep 3
  // (Doelgroep 2 and 3 are mutually exclusive, Doelgroep 2 takes precedence)
  const hasDoelgroep2 = eligible_doelgroepen.includes('doelgroep_2');
  const hasDoelgroep3 = eligible_doelgroepen.includes('doelgroep_3');

  if (hasDoelgroep2 && hasDoelgroep3) {
    // Remove Doelgroep 3 from eligible list
    const index = eligible_doelgroepen.indexOf('doelgroep_3');
    if (index > -1) {
      eligible_doelgroepen.splice(index, 1);
    }
    afwijs_redenen['doelgroep_3'] = 'Niet van toepassing omdat Doelgroep 2 beschikbaar is.';
  }

  // Rule 2: Filter out Doelgroep 1 in MVP (income check not implemented)
  const finalEligibleDoelgroepen = eligible_doelgroepen.filter(
    (dg) => dg !== 'doelgroep_1'
  );

  // ========================================================================
  // Build Subsidy Details for Final Eligible Doelgroepen
  // ========================================================================
  const toegewezen_doelgroepen: string[] = [];
  const subsidie_details: SubsidieDetail[] = [];

  for (const doelgroepKey of finalEligibleDoelgroepen) {
    toegewezen_doelgroepen.push(doelgroepKey);

    const dgConfig = gemeenteConfig[doelgroepKey as keyof GemeenteConfig];
    // Add subsidy details for all routes if available
    if (dgConfig.subsidie_routes) {
      for (const route of dgConfig.subsidie_routes) {
        subsidie_details.push({
          doelgroep: doelgroepKey,
          route: route.type,
          bedrag: route.bedrag,
          beschrijving: route.beschrijving,
        });
      }
    }
  }

  // ========================================================================
  // Return Result
  // ========================================================================
  return {
    toegewezen_doelgroepen,
    subsidie_details,
    warnings: [INCOME_CHECK_WARNING],
    afwijs_redenen,
  };
}

// ============================================================================
// UTILITY EXPORTS (for testing and external use)
// ============================================================================

/**
 * Get list of supported municipalities
 */
export function getSupportedMunicipalities(configOverride?: { gemeenten: Record<string, GemeenteConfig> }): string[] {
  const config = configOverride || DEFAULT_SUBSIDIE_CONFIG;
  return Object.keys(config.gemeenten);
}

/**
 * Check if a municipality is supported
 */
export function isMunicipalitySupported(gemeente: string, configOverride?: { gemeenten: Record<string, GemeenteConfig> }): boolean {
  const config = configOverride || DEFAULT_SUBSIDIE_CONFIG;
  return gemeente in config.gemeenten;
}

/**
 * Get configuration for a specific municipality
 * @throws Error if municipality is not supported
 */
export function getMunicipalityConfig(gemeente: string, configOverride?: { gemeenten: Record<string, GemeenteConfig> }): GemeenteConfig {
  const config = configOverride || DEFAULT_SUBSIDIE_CONFIG;
  const c = config.gemeenten[gemeente];
  if (!c) {
    throw new Error(`Gemeente "${gemeente}" niet ondersteund`);
  }
  return c;
}
