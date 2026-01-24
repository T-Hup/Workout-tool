/**
 * Storage Service
 * 
 * Simulates a database using localStorage.
 * Handles municipality budget tracking and BAG ID registration.
 */

export interface BudgetState {
    gemeente: string;
    totaal_budget: number;
    gebruikt_budget: number;
    resterend_budget: number;
}

export interface Registratie {
    bag_id: string;
    gemeente: string;
    bedrag: number;
    route: string;
    datum: string;
}

const STORAGE_KEYS = {
    BUDGETS: 'subsidy_tool_budgets',
    REGISTRATIONS: 'subsidy_tool_registrations',
};

// Default budget configuration (Seed data)
const INITIAL_BUDGETS: BudgetState[] = [
    { gemeente: 'Bernheze', totaal_budget: 100000, gebruikt_budget: 0, resterend_budget: 100000 },
    { gemeente: 'Boekel', totaal_budget: 100000, gebruikt_budget: 0, resterend_budget: 100000 },
    { gemeente: 'Maashorst', totaal_budget: 250000, gebruikt_budget: 0, resterend_budget: 250000 },
    { gemeente: 'Meierijstad', totaal_budget: 300000, gebruikt_budget: 0, resterend_budget: 300000 },
    { gemeente: 'Boxtel', totaal_budget: 150000, gebruikt_budget: 0, resterend_budget: 150000 },
    { gemeente: 'Sint-Michielsgestel', totaal_budget: 120000, gebruikt_budget: 0, resterend_budget: 120000 },
    { gemeente: 's-Hertogenbosch', totaal_budget: 500000, gebruikt_budget: 0, resterend_budget: 500000 },
    { gemeente: 'Oss', totaal_budget: 400000, gebruikt_budget: 0, resterend_budget: 400000 },
    { gemeente: 'Vught', totaal_budget: 180000, gebruikt_budget: 0, resterend_budget: 180000 },
];

export const storageService = {
    /**
     * Initializes the storage with seed data if empty
     */
    init() {
        if (!localStorage.getItem(STORAGE_KEYS.BUDGETS)) {
            localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.REGISTRATIONS)) {
            localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([]));
        }
    },

    /**
     * Gets all municipality budgets
     */
    getBudgets(): BudgetState[] {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.BUDGETS) || '[]');
    },

    /**
     * Gets all registrations
     */
    getRegistrations(): Registratie[] {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.REGISTRATIONS) || '[]');
    },

    /**
     * Checks if a BAG ID is already registered
     */
    isBagIdRegistered(bag_id: string): boolean {
        const registrations = this.getRegistrations();
        return registrations.some(r => r.bag_id === bag_id);
    },

    /**
     * Registers a new subsidy and updates the municipality budget
     */
    registerSubsidy(registratie: Registratie): boolean {
        const budgets = this.getBudgets();
        const registrations = this.getRegistrations();

        // Check if already exists
        if (this.isBagIdRegistered(registratie.bag_id)) {
            return false;
        }

        // Find and update budget
        const budgetIndex = budgets.findIndex(b => b.gemeente === registratie.gemeente);
        if (budgetIndex === -1) return false;

        if (budgets[budgetIndex].resterend_budget < registratie.bedrag) {
            return false; // Insufficient funds (optional check)
        }

        budgets[budgetIndex].gebruikt_budget += registratie.bedrag;
        budgets[budgetIndex].resterend_budget -= registratie.bedrag;

        // Add registration
        registrations.push({
            ...registratie,
            datum: new Date().toISOString()
        });

        // Save
        localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
        localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(registrations));

        return true;
    },

    /**
     * Resets all data to initial state
     */
    resetAll() {
        localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
        localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([]));
    }
};
