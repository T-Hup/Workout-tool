/**
 * ReservationManager
 * 
 * Manages subsidy budgets, reservations, and reporting (SiSa).
 * Implements strict state management and audit logging.
 * Uses integer math (cents) for all monetary values.
 */

import { DEFAULT_SUBSIDIE_CONFIG, GemeenteConfig } from '../utils/subsidyCalculator';

export type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BESCHIKKING_TOEGEKEND' | 'PAID' | 'RELEASED' | 'EXPIRED';

export interface BudgetState {
    gemeente: string;
    doelgroep: 1 | 2;
    totaal_budget: number; // in cents
    gereserveerd: number;  // in cents
    uitgegeven: number;    // in cents
    beschikbaar: number;   // in cents
}

export interface Aanvraag {
    id: string; // uuid
    bagId: string;
    gemeente: string;
    doelgroep: 1 | 2 | 3;
    bedrag: number; // in cents
    status: Status;
    created_at: number; // timestamp
    expires_at: number; // timestamp
    mutations: AuditLogEntry[];

    // SiSa Fields - Financial
    factuur_bedrag?: number; // in cents
    definitief_subsidie_bedrag?: number; // in cents
    datum_beschikking?: string; // ISO date
    datum_betaling?: string; // ISO date

    // SiSa Fields - Technical
    type_maatregel?: string;
    omvang_m2?: number;
    isolatie_waarde?: string;
    is_biobased?: boolean;
    meldcode_isde?: string;

    // SiSa Fields - Evidence (URLs)
    factuur_pdf?: string;
    betaalbewijs_pdf?: string;
    fotos_uitvoering_urls?: string[];
}

export interface SiSaData {
    factuur_bedrag: number;
    definitief_subsidie_bedrag: number;
    datum_beschikking: string;
    datum_betaling: string;
    type_maatregel: string;
    omvang_m2: number;
    isolatie_waarde: string;
    is_biobased: boolean;
    meldcode_isde: string;
    factuur_pdf: string;
    betaalbewijs_pdf: string;
    fotos_uitvoering_urls: string[];
}

export interface AuditLogEntry {
    timestamp: number;
    bagId: string;
    actie: string;
    bedrag: number;
    saldo_na_mutatie: number; // beschikbaar budget
    details?: string;
}

const STORAGE_KEYS = {
    STATE: 'reservation_manager_state',
    LOGS: 'reservation_manager_logs',
};

// Initial Budget Configuration (in Euros, converted to cents in init)
const INITIAL_BUDGETS_CONFIG = [
    // Subsidiegroep 1
    { gemeente: 'Maashorst', doelgroep: 1, bedrag: 1224000 },
    { gemeente: "'s-Hertogenbosch", doelgroep: 1, bedrag: 124200 },
    { gemeente: 'Oss', doelgroep: 1, bedrag: 540000 },

    // Subsidiegroep 2
    { gemeente: 'Bernheze', doelgroep: 2, bedrag: 853991 },
    { gemeente: 'Boekel', doelgroep: 2, bedrag: 462445 },
    { gemeente: 'Maashorst', doelgroep: 2, bedrag: 1467904 },
    { gemeente: 'Meierijstad', doelgroep: 2, bedrag: 3855946 },
    { gemeente: 'Boxtel', doelgroep: 2, bedrag: 1294740 },
    { gemeente: 'Sint-Michielsgestel', doelgroep: 2, bedrag: 1380126 },
    { gemeente: "'s-Hertogenbosch", doelgroep: 2, bedrag: 5207519 },
    { gemeente: 'Oss', doelgroep: 2, bedrag: 2178885 },
    { gemeente: 'Vught', doelgroep: 2, bedrag: 1006715 },
];

export class ReservationManager {
    private budgets: BudgetState[] = [];
    private aanvragen: Aanvraag[] = [];
    private auditLogs: AuditLogEntry[] = [];
    private config: { gemeenten: Record<string, GemeenteConfig> } = DEFAULT_SUBSIDIE_CONFIG;

    constructor() {
        this.loadState();
    }

    private loadState() {
        const storedState = localStorage.getItem(STORAGE_KEYS.STATE);
        if (storedState) {
            const data = JSON.parse(storedState);
            this.budgets = data.budgets;
            this.aanvragen = data.aanvragen;
            this.auditLogs = data.auditLogs || [];
            this.config = data.config || DEFAULT_SUBSIDIE_CONFIG;
        } else {
            this.initializeBudgets();
        }
    }

    private saveState() {
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify({
            budgets: this.budgets,
            aanvragen: this.aanvragen,
            auditLogs: this.auditLogs,
            config: this.config
        }));
    }

    private initializeBudgets() {
        // Initialize from config
        this.budgets = INITIAL_BUDGETS_CONFIG.map(cfg => ({
            gemeente: cfg.gemeente,
            doelgroep: cfg.doelgroep as 1 | 2,
            totaal_budget: Math.round(cfg.bedrag * 100), // to cents
            gereserveerd: 0,
            uitgegeven: 0,
            beschikbaar: Math.round(cfg.bedrag * 100)
        }));
    }

    /**
     * Finds the relevant budget bucket.
     * Note: Doelgroep 3 usually doesn't have a specific pot in this list, 
     * or shares with others? Assuming checks only for 1 and 2 based on input.
     * If Doelgroep 3 has no budget limit/tracking specified in requirements, 
     * we might skip budget check or assume a default?
     * logic: The prompt only gave budgets for group 1 and 2. 
     */
    private getBudget(gemeente: string, doelgroep: number): BudgetState | undefined {
        return this.budgets.find(b => b.gemeente === gemeente && b.doelgroep === doelgroep);
    }

    public getBudgets(): BudgetState[] {
        return this.budgets;
    }

    public getAanvragen(): Aanvraag[] {
        return this.aanvragen;
    }

    public getAuditLogs(): AuditLogEntry[] {
        return this.auditLogs;
    }

    public getConfiguration() {
        return this.config;
    }

    public updateConfiguration(newConfig: { gemeenten: Record<string, GemeenteConfig> }) {
        this.config = newConfig;
        this.saveState();
    }

    private logAudit(entry: AuditLogEntry) {
        this.auditLogs.push(entry);
        // Also add to the specific aanvraag if exists? 
        // Logic handled in methods.
    }

    /**
     * Reserve subsidy for a property.
     */
    public reserveSubsidie(
        bagId: string,
        gemeente: string,
        doelgroep: 1 | 2 | 3,
        bedragEuros: number
    ): { success: boolean; message: string; aanvraagId?: string } {
        const bedragCents = Math.round(bedragEuros * 100);

        // 1. Check duplicate active reservation
        const existingRecent = this.aanvragen.find(
            a => a.bagId === bagId && ['PENDING', 'APPROVED', 'BESCHIKKING_TOEGEKEND', 'PAID'].includes(a.status)
        );

        if (existingRecent) {
            return { success: false, message: `BAG ID ${bagId} heeft al een lopende aanvraag/subsidie.` };
        }

        // 2. Normalize doelgroep for budget check
        // Assuming Doelgroep 3 doesn't deplete Group 1 or 2 pots unless specified.
        // If Logic requires matching strict group 1/2:
        let budget: BudgetState | undefined;
        if (doelgroep === 1 || doelgroep === 2) {
            budget = this.getBudget(gemeente, doelgroep);
            if (!budget) {
                // If no budget explicitly defined for this municipality+group (e.g. Bernheze group 1 is 0/undefined)
                // We check if we should allow it (maybe infinite? or 0?)
                // Based on requirements: "Subsidiegroep 1 Totaal ... Oss, Den Bosch, Maashorst". Others are implicitly 0?
                return { success: false, message: `Geen budget gevonden voor ${gemeente} Doelgroep ${doelgroep}.` };
            }

            if (bedragCents > budget.beschikbaar) {
                return { success: false, message: 'Onvoldoende budget beschikbaar.' };
            }
        }

        // 3. Create Reservation
        const now = Date.now();
        const expiresAt = now + (1000 * 60 * 60 * 24 * 30 * 6); // +6 months

        const newAanvraag: Aanvraag = {
            id: crypto.randomUUID(),
            bagId,
            gemeente,
            doelgroep,
            bedrag: bedragCents,
            status: 'PENDING',
            created_at: now,
            expires_at: expiresAt,
            mutations: []
        };

        // Update Budget
        if (budget) {
            budget.beschikbaar -= bedragCents;
            budget.gereserveerd += bedragCents;
        }

        // Log mutation
        const logEntry: AuditLogEntry = {
            timestamp: now,
            bagId,
            actie: 'RESERVERING',
            bedrag: bedragCents,
            saldo_na_mutatie: budget ? budget.beschikbaar : 0,
            details: `Aanvraag ${newAanvraag.id} gestart`
        };

        newAanvraag.mutations.push(logEntry);
        this.aanvragen.push(newAanvraag);
        this.logAudit(logEntry);
        this.saveState();

        return { success: true, message: 'Reservering succesvol.', aanvraagId: newAanvraag.id };
    }

    /**
     * Handle status updates (Demo/HubSpot webhook simulator)
     */
    public handleHubSpotUpdate(aanvraagId: string, newStatus: 'APPROVED' | 'REJECTED'): boolean {
        const aanvraag = this.aanvragen.find(a => a.id === aanvraagId);
        if (!aanvraag) return false;

        const budget = this.getBudget(aanvraag.gemeente, aanvraag.doelgroep as 1 | 2);

        const now = Date.now();

        if (aanvraag.status !== 'PENDING' && aanvraag.status !== 'BESCHIKKING_TOEGEKEND') {
            // Can only approve/reject pending or awarded requests
            if (aanvraag.status === 'RELEASED' || aanvraag.status === 'PAID') return false;
        }

        if (newStatus === 'APPROVED') {
            // Validation: Cannot finalize without complete SiSa data
            if (!this.validateSiSaCompleteness(aanvraag)) {
                // Return false or throw error? Returning false for now as per signature
                console.error(`Cannot finalize aanvraag ${aanvraagId}: Incomplete SiSa data.`);
                return false;
            }

            // Move from RESERVED to SPENT
            if (budget) {
                budget.gereserveerd -= aanvraag.bedrag;
                budget.uitgegeven += aanvraag.bedrag;
            }
            aanvraag.status = 'BESCHIKKING_TOEGEKEND';

            const log: AuditLogEntry = {
                timestamp: now,
                bagId: aanvraag.bagId,
                actie: 'TOEWIJZING',
                bedrag: aanvraag.bedrag,
                saldo_na_mutatie: budget ? budget.beschikbaar : 0,
                details: 'Definitief toegekend (HubSpot: APPROVED)'
            };
            aanvraag.mutations.push(log);
            this.logAudit(log);

        } else if (newStatus === 'REJECTED') {
            // specific logic needed here
            if (budget) {
                if (aanvraag.status === 'BESCHIKKING_TOEGEKEND') {
                    budget.uitgegeven -= aanvraag.bedrag;
                } else {
                    budget.gereserveerd -= aanvraag.bedrag;
                }
                budget.beschikbaar += aanvraag.bedrag;
            }
            aanvraag.status = 'RELEASED';

            const log: AuditLogEntry = {
                timestamp: now,
                bagId: aanvraag.bagId,
                actie: 'VRIJVAL',
                bedrag: aanvraag.bedrag,
                saldo_na_mutatie: budget ? budget.beschikbaar : 0,
                details: 'Afgewezen/Vrijgevallen'
            };
            aanvraag.mutations.push(log);
            this.logAudit(log);
        }

        this.saveState();
        return true;
    }

    /**
     * Mark an application as Paid.
     * Transitions status from FINALIZED to PAID and sets datum_betaling.
     */
    public markAsPaid(aanvraagId: string, datumBetaling?: string): { success: boolean; message: string } {
        const aanvraag = this.aanvragen.find(a => a.id === aanvraagId);
        if (!aanvraag) return { success: false, message: 'Aanvraag niet gevonden.' };

        if (aanvraag.status !== 'BESCHIKKING_TOEGEKEND') {
            return { success: false, message: 'Alleen goedgekeurde aanvragen (BESCHIKKING_TOEGEKEND) kunnen als betaald worden gemarkeerd.' };
        }

        const now = Date.now();
        aanvraag.status = 'PAID';
        // Set payment date (either passed or today)
        aanvraag.datum_betaling = datumBetaling || new Date().toISOString().split('T')[0];

        const log: AuditLogEntry = {
            timestamp: now,
            bagId: aanvraag.bagId,
            actie: 'UITBETALING',
            bedrag: aanvraag.bedrag,
            saldo_na_mutatie: this.getBudget(aanvraag.gemeente, aanvraag.doelgroep as 1 | 2)?.beschikbaar || 0,
            details: 'Subsidie uitbetaald'
        };

        aanvraag.mutations.push(log);
        this.logAudit(log);
        this.saveState();

        return { success: true, message: 'Status bijgewerkt naar Betaald.' };
    }


    /**
     * Update an existing reservation with SiSa reporting data.
     * This allows adding technical/financial details before finalization.
     */
    public updateAanvraagMetHubspotData(aanvraagId: string, data: Partial<SiSaData>): { success: boolean; message: string } {
        const aanvraag = this.aanvragen.find(a => a.id === aanvraagId);
        if (!aanvraag) {
            return { success: false, message: 'Aanvraag niet gevonden.' };
        }

        // Allow updates only if not yet finalized/expired? 
        // Or maybe allow updates even after finalization for corrections?
        // Assuming updates allowed if active or pending.
        if (aanvraag.status === 'EXPIRED') {
            return { success: false, message: 'Kan verlopen aanvraag niet bijwerken.' };
        }

        // Merge fields
        if (data.factuur_bedrag !== undefined) aanvraag.factuur_bedrag = data.factuur_bedrag;
        if (data.definitief_subsidie_bedrag !== undefined) aanvraag.definitief_subsidie_bedrag = data.definitief_subsidie_bedrag;
        if (data.datum_beschikking) aanvraag.datum_beschikking = data.datum_beschikking;
        if (data.datum_betaling) aanvraag.datum_betaling = data.datum_betaling;

        if (data.type_maatregel) aanvraag.type_maatregel = data.type_maatregel;
        if (data.omvang_m2 !== undefined) aanvraag.omvang_m2 = data.omvang_m2;
        if (data.isolatie_waarde) aanvraag.isolatie_waarde = data.isolatie_waarde;
        if (data.is_biobased !== undefined) aanvraag.is_biobased = data.is_biobased;
        if (data.meldcode_isde) aanvraag.meldcode_isde = data.meldcode_isde;

        if (data.factuur_pdf) aanvraag.factuur_pdf = data.factuur_pdf;
        if (data.betaalbewijs_pdf) aanvraag.betaalbewijs_pdf = data.betaalbewijs_pdf;
        if (data.fotos_uitvoering_urls) aanvraag.fotos_uitvoering_urls = data.fotos_uitvoering_urls;

        this.saveState();
        return { success: true, message: 'Data bijgewerkt.' };
    }

    /**
     * Validates if all required SiSa fields are present for Finalization.
     */
    private validateSiSaCompleteness(aanvraag: Aanvraag): boolean {
        // Financial
        if (aanvraag.factuur_bedrag === undefined) return false;
        if (aanvraag.definitief_subsidie_bedrag === undefined) return false;
        if (!aanvraag.datum_beschikking) return false;
        // Payout date is no longer required for BESCHIKKING_TOEGEKEND
        // if (!aanvraag.datum_betaling) return false;

        // Technical
        if (!aanvraag.type_maatregel) return false;
        if (aanvraag.omvang_m2 === undefined) return false;
        if (!aanvraag.isolatie_waarde) return false;
        if (aanvraag.is_biobased === undefined) return false;
        if (!aanvraag.meldcode_isde) return false;

        // Evidence
        if (!aanvraag.factuur_pdf) return false;
        if (!aanvraag.betaalbewijs_pdf) return false;
        if (!aanvraag.fotos_uitvoering_urls || aanvraag.fotos_uitvoering_urls.length === 0) return false;

        return true;
    }

    /**
     * Check for expired reservations
     */
    public checkExpirations() {
        const now = Date.now();
        let changed = false;

        for (const aanvraag of this.aanvragen) {
            if (aanvraag.status === 'PENDING' && now > aanvraag.expires_at) {
                const budget = this.getBudget(aanvraag.gemeente, aanvraag.doelgroep as 1 | 2);

                if (budget) {
                    budget.gereserveerd -= aanvraag.bedrag;
                    budget.beschikbaar += aanvraag.bedrag;
                }

                aanvraag.status = 'EXPIRED';

                const log: AuditLogEntry = {
                    timestamp: now,
                    bagId: aanvraag.bagId,
                    actie: 'EXPIRATIE',
                    bedrag: aanvraag.bedrag,
                    saldo_na_mutatie: budget ? budget.beschikbaar : 0,
                    details: 'Verlopen (> 6 maanden)'
                };
                aanvraag.mutations.push(log);
                this.logAudit(log);
                changed = true;
            }
        }

        if (changed) this.saveState();
    }

    // Test helper to reset everything
    public reset() {
        localStorage.removeItem(STORAGE_KEYS.STATE);
        this.loadState();
    }
}

// Export singleton instance
export const reservationManager = new ReservationManager();
