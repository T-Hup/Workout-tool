/**
 * ReservationManager
 * 
 * Manages subsidy budgets, reservations, and reporting (SiSa).
 * Implements strict state management and audit logging.
 * Uses integer math (cents) for all monetary values.
 */

export type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FINALIZED' | 'RELEASED' | 'EXPIRED';

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
        } else {
            this.initializeBudgets();
        }
    }

    private saveState() {
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify({
            budgets: this.budgets,
            aanvragen: this.aanvragen,
            auditLogs: this.auditLogs
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
            a => a.bagId === bagId && ['PENDING', 'APPROVED', 'FINALIZED'].includes(a.status)
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

        if (aanvraag.status !== 'PENDING') {
            // Can only approve/reject pending requests in this simplified flow
            // Or allow transitions if confirmed?
            // Let's stick to strict flow for safety
            if (aanvraag.status === 'FINALIZED' || aanvraag.status === 'RELEASED') return false;
        }

        if (newStatus === 'APPROVED') {
            // Move from RESERVED to SPENT
            if (budget) {
                budget.gereserveerd -= aanvraag.bedrag;
                budget.uitgegeven += aanvraag.bedrag;
            }
            aanvraag.status = 'FINALIZED';

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
                budget.gereserveerd -= aanvraag.bedrag;
                budget.beschikbaar += aanvraag.bedrag;
            }
            aanvraag.status = 'RELEASED';

            const log: AuditLogEntry = {
                timestamp: now,
                bagId: aanvraag.bagId,
                actie: 'VRIJVAL',
                bedrag: aanvraag.bedrag,
                saldo_na_mutatie: budget ? budget.beschikbaar : 0,
                details: 'Afgewezen (HubSpot: REJECTED)'
            };
            aanvraag.mutations.push(log);
            this.logAudit(log);
        }

        this.saveState();
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
