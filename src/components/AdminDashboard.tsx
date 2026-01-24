import React, { useEffect, useState } from 'react';
import { reservationManager, BudgetState, Aanvraag, AuditLogEntry } from '../services/ReservationManager';

/**
 * Admin Dashboard Component
 * 
 * Displays municipality budgets and recent subsidy registrations.
 * Uses ReservationManager for strict state management (SiSa).
 */
export default function AdminDashboard({ onNavigateBack }: { onNavigateBack: () => void }) {
    const [budgets, setBudgets] = useState<BudgetState[]>([]);
    const [aanvragen, setAanvragen] = useState<Aanvraag[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');

    useEffect(() => {
        // Load data from manager
        loadData();

        // Check for expirations on load
        reservationManager.checkExpirations();
    }, []);

    const loadData = () => {
        setBudgets([...reservationManager.getBudgets()]);
        setAanvragen([...reservationManager.getAanvragen()]);
        setAuditLogs([...reservationManager.getAuditLogs()]);
        setLoading(false);
    };

    const handleStatusChange = (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
        if (confirm(`Weet u zeker dat u de status wilt wijzigen naar ${newStatus}?`)) {
            const success = reservationManager.handleHubSpotUpdate(id, newStatus);
            if (success) {
                loadData();
            } else {
                alert('Statuswijziging mislukt.');
            }
        }
    };

    // Calculate totals for dashboard summary (cents -> euros)
    const totalBudget = budgets.reduce((sum, b) => sum + b.totaal_budget, 0);
    const totalUsed = budgets.reduce((sum, b) => sum + b.uitgegeven, 0);
    const totalReserved = budgets.reduce((sum, b) => sum + b.gereserveerd, 0);
    const totalPending = aanvragen.filter(a => a.status === 'PENDING').length;

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0
        }).format(cents / 100);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('nl-NL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Laden...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {/* Top Navigation */}
            <nav className="bg-blue-900 text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <span className="text-xl font-bold tracking-tight">
                                Subsidie Beheerportaal
                            </span>
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`px-3 py-1 rounded text-sm font-medium ${activeTab === 'overview' ? 'bg-blue-800' : 'hover:bg-blue-800 opacity-70'}`}
                                >
                                    Overzicht
                                </button>
                                <button
                                    onClick={() => setActiveTab('audit')}
                                    className={`px-3 py-1 rounded text-sm font-medium ${activeTab === 'audit' ? 'bg-blue-800' : 'hover:bg-blue-800 opacity-70'}`}
                                >
                                    SiSa Audit Log
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={onNavigateBack}
                                className="bg-blue-800 hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                                ← Terug naar Tool
                            </button>
                            <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold">
                                A
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {activeTab === 'overview' ? (
                    <div className="flex flex-col lg:flex-row gap-8">

                        {/* Left Column: Summary & Sidebar */}
                        <div className="w-full lg:w-1/4 space-y-6">
                            {/* Dashboard Summary Card */}
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
                                    Financieel Overzicht
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm text-gray-500">Totaal Budget</div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatCurrency(totalBudget)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Uitgegeven (Definitief)</div>
                                        <div className="text-2xl font-bold text-green-600">
                                            {formatCurrency(totalUsed)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Gereserveerd (in aanvraag)</div>
                                        <div className="text-2xl font-bold text-orange-500">
                                            {formatCurrency(totalReserved)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Openstaande Aanvragen</div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {totalPending}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h3 className="font-bold text-gray-900 mb-3">Systeem Acties</h3>
                                <button
                                    onClick={() => {
                                        reservationManager.checkExpirations();
                                        loadData();
                                        alert('Expiratie check uitgevoerd.');
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors mb-2"
                                >
                                    🔄 Check Verlopen Aanvragen
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('Weet u zeker dat u alle data wilt wissen? Dit kan niet ongedaan worden gemaakt.')) {
                                            reservationManager.reset();
                                            window.location.reload();
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                >
                                    ⚠️ Reset Alle Data
                                </button>
                            </div>
                        </div>

                        {/* Right Column: Main Content */}
                        <div className="w-full lg:w-3/4 space-y-8">

                            {/* Municipality Budget Table */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-lg font-bold text-gray-800">
                                        Subsidiepotten per Gemeente
                                    </h3>
                                    <span className="text-xs text-gray-500">Bedragen in €</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gemeente</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Groep</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Totaal</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gereserveerd</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Beschikbaar</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {budgets.map((b) => {
                                                const totalUsedOrReserved = b.uitgegeven + b.gereserveerd;
                                                const percent = b.totaal_budget > 0 ? Math.round((totalUsedOrReserved / b.totaal_budget) * 100) : 0;
                                                return (
                                                    <tr key={`${b.gemeente}-${b.doelgroep}`} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {b.gemeente}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            SG{b.doelgroep}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                            {formatCurrency(b.totaal_budget)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-500 text-right font-medium">
                                                            {formatCurrency(b.gereserveerd)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-bold">
                                                            {formatCurrency(b.beschikbaar)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap align-middle">
                                                            <div className="w-24 mx-auto flex items-center">
                                                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                                                                    <div
                                                                        className={`h-full rounded-full ${percent > 90 ? 'bg-red-500' :
                                                                                percent > 75 ? 'bg-orange-500' : 'bg-green-500'
                                                                            }`}
                                                                        style={{ width: `${percent}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-gray-500">{percent}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Aanvragen List */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                    <h3 className="text-lg font-bold text-gray-800">
                                        Reserveringen & Aanvragen
                                    </h3>
                                </div>

                                {aanvragen.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500 italic">
                                        Nog geen aanvragen geregistreerd.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BAG ID / Gemeente</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bedrag</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acties</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {aanvragen.slice().reverse().map((req) => (
                                                    <tr key={req.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {formatDate(req.created_at)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <div className="font-mono text-gray-900">{req.bagId}</div>
                                                            <div className="text-gray-500 text-xs">{req.gemeente} (Doelgroep {req.doelgroep})</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border 
                                ${req.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    req.status === 'FINALIZED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                        req.status === 'RELEASED' ? 'bg-gray-100 text-gray-500 border-gray-300' :
                                                                            req.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' : ''
                                                                }`}>
                                                                {req.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-right">
                                                            {formatCurrency(req.bedrag)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                            {req.status === 'PENDING' && (
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleStatusChange(req.id, 'APPROVED')}
                                                                        className="text-green-600 hover:text-green-900 font-medium text-xs border border-green-200 bg-green-50 px-2 py-1 rounded"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusChange(req.id, 'REJECTED')}
                                                                        className="text-red-600 hover:text-red-900 font-medium text-xs border border-red-200 bg-red-50 px-2 py-1 rounded"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // AUDIT LOG TAB
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-800">
                                SiSa Rapportage (Audit Trail)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tijdstip</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actie</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BAG ID</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bedrag (€)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {auditLogs.slice().reverse().map((log, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(log.timestamp).toLocaleString('nl-NL')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                                                {log.actie}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                                {log.bagId}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                {formatCurrency(log.bedrag)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
