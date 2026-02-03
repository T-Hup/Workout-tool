import { useEffect, useState } from 'react';
import { reservationManager, BudgetState, Aanvraag, AuditLogEntry } from '../services/ReservationManager';
import { sisaExportService } from '../services/SiSaExportService';

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
    const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'config'>('overview');
    // Config state
    const [config, setConfig] = useState(reservationManager.getConfiguration());
    const [selectedGemeente, setSelectedGemeente] = useState<string>(Object.keys(config.gemeenten)[0]);
    const [selectedAanvraagId, setSelectedAanvraagId] = useState<string | null>(null);
    const paymentDate = new Date().toISOString().split('T')[0];

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return 'Gereserveerd';
            case 'BESCHIKKING_TOEGEKEND': return 'Goedgekeurd';
            case 'PAID': return 'Uitbetaald';
            case 'RELEASED': return 'Vrijgevallen';
            case 'REJECTED': return 'Afgewezen';
            case 'EXPIRED': return 'Verlopen';
            default: return status;
        }
    };

    // Mock Data Generator
    const generateMockSiSaData = () => {
        const measures = ['Spouwmuurisolatie', 'Vloerisolatie', 'HR++ Glas', 'Dakisolatie', 'Hybride Warmtepomp'];
        const randomMeasure = measures[Math.floor(Math.random() * measures.length)];
        const m2 = Math.floor(Math.random() * 50) + 20;

        return {
            factuur_bedrag: Math.floor(Math.random() * 200000) + 50000, // 500-2500 eur
            definitief_subsidie_bedrag: Math.floor(Math.random() * 80000) + 20000, // 200-1000 eur
            datum_beschikking: new Date().toISOString().split('T')[0],
            type_maatregel: randomMeasure,
            omvang_m2: m2,
            isolatie_waarde: `Rd ${Math.floor(Math.random() * 30) / 10 + 3.5}`,
            is_biobased: Math.random() > 0.8,
            meldcode_isde: `KA${Math.floor(Math.random() * 10000)}`,
            factuur_pdf: 'https://example.com/factuur.pdf',
            betaalbewijs_pdf: 'https://example.com/betaalbewijs.pdf',
            fotos_uitvoering_urls: ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg']
        };
    };

    const handleFillMockData = (id: string) => {
        const mockData = generateMockSiSaData();
        const result = reservationManager.updateAanvraagMetHubspotData(id, mockData);
        if (result.success) {
            alert('Mock SiSa data succesvol toegevoegd! U kunt de aanvraag nu goedkeuren.');
            loadData();
        } else {
            alert('Fout bij toevoegen data: ' + result.message);
        }
    };

    const handleBulkDemoData = async () => {
        const gemeenten = ['Meierijstad', 'Bernheze', 'Boxtel', 'Oss', 'Maashorst', 'Boekel'];
        const doelgroepen: (1 | 2 | 3)[] = [1, 2, 2, 2, 1, 3];

        setLoading(true);
        for (let i = 0; i < 10; i++) {
            const bagId = `0000${Math.floor(10000000 + Math.random() * 90000000)}`;
            const gemeente = gemeenten[Math.floor(Math.random() * gemeenten.length)];
            const doelgroep = doelgroepen[Math.floor(Math.random() * doelgroepen.length)];
            const bedrag = Math.floor(Math.random() * 1500) + 500;

            const res = reservationManager.reserveSubsidie(bagId, gemeente, doelgroep, bedrag);
            if (res.success && res.aanvraagId) {
                const mockData = generateMockSiSaData();
                reservationManager.updateAanvraagMetHubspotData(res.aanvraagId, mockData);
                reservationManager.handleHubSpotUpdate(res.aanvraagId, 'APPROVED');
            }
        }
        loadData();
        alert('10 afgeronde demo aanvragen gegenereerd!');
    };

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

    const handleMarkAsPaid = (id: string) => {
        const aanvraag = aanvragen.find(a => a.id === id);
        if (!aanvraag) return;

        const date = prompt('Datum uitbetaling (JJJJ-MM-DD):', paymentDate);
        if (date === null) return; // Cancelled

        const result = reservationManager.markAsPaid(id, date);
        if (result.success) {
            loadData();
        } else {
            alert(result.message);
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
                                    className={`px-4 py-2 border-b-2 font-medium text-sm ${activeTab === 'audit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                >
                                    Audit Trail
                                </button>
                                <button
                                    onClick={() => setActiveTab('config')}
                                    className={`px-4 py-2 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                >
                                    ⚙️ Configuratie
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
                                    onClick={() => sisaExportService.exportSiSaReports()}
                                    className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 rounded-md font-bold transition-colors mb-2"
                                >
                                    📥 Download SiSa Rapportages
                                </button>
                                <button
                                    onClick={() => sisaExportService.exportAwardedForFinance()}
                                    className="w-full text-left px-4 py-2 text-sm text-cyan-700 hover:bg-cyan-50 rounded-md font-bold transition-colors mb-2"
                                    title="Export voor financiële afdeling (Toegekende beschikkingen)"
                                >
                                    💰 Export Financiele Check
                                </button>
                                <button
                                    onClick={handleBulkDemoData}
                                    className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-md font-bold transition-colors mb-2"
                                >
                                    🚀 Vul Demo Data (10 stuks)
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
                                                                    req.status === 'BESCHIKKING_TOEGEKEND' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                        req.status === 'PAID' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                            req.status === 'RELEASED' ? 'bg-gray-100 text-gray-500 border-gray-300' :
                                                                                req.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' : ''
                                                                }`}>
                                                                {getStatusLabel(req.status)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-right">
                                                            {formatCurrency(req.bedrag)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                            {req.status === 'PENDING' && (
                                                                <>
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            onClick={() => handleFillMockData(req.id)}
                                                                            className="text-blue-600 hover:text-blue-900 font-medium text-xs border border-blue-200 bg-blue-50 px-2 py-1 rounded"
                                                                            title="Vul technische/financiële data (HubSpot sim)"
                                                                        >
                                                                            📝 Mock Data
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex justify-end gap-2 mt-1">
                                                                        <button
                                                                            onClick={() => handleStatusChange(req.id, 'APPROVED')}
                                                                            className="text-green-600 hover:text-green-900 font-medium text-xs border border-green-200 bg-green-50 px-2 py-1 rounded"
                                                                        >
                                                                            Goedkeuren
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleStatusChange(req.id, 'REJECTED')}
                                                                            className="text-red-600 hover:text-red-900 font-medium text-xs border border-red-200 bg-red-50 px-2 py-1 rounded"
                                                                        >
                                                                            Afwijzen
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {req.status === 'BESCHIKKING_TOEGEKEND' && (
                                                                <div className="flex justify-end gap-2 mb-1">
                                                                    <button
                                                                        onClick={() => handleMarkAsPaid(req.id)}
                                                                        className="text-blue-600 hover:text-blue-900 font-medium text-xs border border-blue-200 bg-blue-50 px-2 py-1 rounded"
                                                                        title="Markeer als uitbetaald"
                                                                    >
                                                                        💰 Betaald
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusChange(req.id, 'REJECTED')}
                                                                        className="text-red-600 hover:text-red-900 font-medium text-xs border border-red-200 bg-red-50 px-2 py-1 rounded"
                                                                        title="Subsidie intrekken/vrijvallen"
                                                                    >
                                                                        Afwijzen
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-end mt-1">
                                                                <button
                                                                    onClick={() => setSelectedAanvraagId(req.id)}
                                                                    className="text-gray-600 hover:text-gray-900 text-xs underline"
                                                                >
                                                                    👁️ Details
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div >
                ) : activeTab === 'audit' ? (
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
                ) : (
                    // CONFIG TAB
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Configuratie Beheer</h2>
                            <button
                                onClick={() => {
                                    reservationManager.updateConfiguration(config);
                                    alert('Configuratie opgeslagen!');
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
                            >
                                💾 Opslaan
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Selecteer Gemeente</label>
                            <select
                                value={selectedGemeente}
                                onChange={(e) => setSelectedGemeente(e.target.value)}
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            >
                                {Object.keys(config.gemeenten).map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-8">
                            {['doelgroep_2', 'doelgroep_3'].map((dgKey) => {
                                const currentDg = config.gemeenten[selectedGemeente][dgKey as 'doelgroep_2' | 'doelgroep_3'];
                                // Simple edit fields
                                return (
                                    <div key={dgKey} className="border border-gray-200 rounded p-4 bg-gray-50">
                                        <h3 className="text-lg font-bold mb-4 text-blue-800 uppercase">{dgKey.replace('_', ' ')}</h3>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase">Max Bouwjaar</label>
                                                <input
                                                    type="number"
                                                    value={currentDg.max_bouwjaar || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                                        setConfig(prev => ({
                                                            ...prev,
                                                            gemeenten: {
                                                                ...prev.gemeenten,
                                                                [selectedGemeente]: {
                                                                    ...prev.gemeenten[selectedGemeente],
                                                                    [dgKey]: { ...currentDg, max_bouwjaar: val }
                                                                }
                                                            }
                                                        }));
                                                    }}
                                                    className="w-full border rounded p-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase">Max WOZ</label>
                                                <input
                                                    type="number"
                                                    value={currentDg.max_woz || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                                        setConfig(prev => ({
                                                            ...prev,
                                                            gemeenten: {
                                                                ...prev.gemeenten,
                                                                [selectedGemeente]: {
                                                                    ...prev.gemeenten[selectedGemeente],
                                                                    [dgKey]: { ...currentDg, max_woz: val }
                                                                }
                                                            }
                                                        }));
                                                    }}
                                                    className="w-full border rounded p-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase">Labels (komma gescheiden)</label>
                                                <input
                                                    type="text"
                                                    value={currentDg.toegestane_labels?.join(',') || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                                        setConfig(prev => ({
                                                            ...prev,
                                                            gemeenten: {
                                                                ...prev.gemeenten,
                                                                [selectedGemeente]: {
                                                                    ...prev.gemeenten[selectedGemeente],
                                                                    [dgKey]: { ...currentDg, toegestane_labels: val }
                                                                }
                                                            }
                                                        }));
                                                    }}
                                                    className="w-full border rounded p-1"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 border rounded shadow-sm">
                                            <h4 className="text-sm font-bold text-gray-700 mb-2">Subsidie Routes (Bedragen)</h4>
                                            {currentDg.subsidie_routes?.map((route, idx) => (
                                                <div key={idx} className="flex gap-4 items-center mb-2">
                                                    <span className="w-24 font-mono text-sm">{route.type}</span>
                                                    <input
                                                        type="number"
                                                        value={route.bedrag}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newRoutes = [...(currentDg.subsidie_routes || [])];
                                                            newRoutes[idx] = { ...newRoutes[idx], bedrag: val };

                                                            setConfig(prev => ({
                                                                ...prev,
                                                                gemeenten: {
                                                                    ...prev.gemeenten,
                                                                    [selectedGemeente]: {
                                                                        ...prev.gemeenten[selectedGemeente],
                                                                        [dgKey]: { ...currentDg, subsidie_routes: newRoutes }
                                                                    }
                                                                }
                                                            }));
                                                        }}
                                                        className="border rounded p-1 w-32 text-right"
                                                    />
                                                    <span className="text-gray-500">€</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
                }
            </main >


            {/* Details Modal */}
            {
                selectedAanvraagId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            {(() => {
                                const req = aanvragen.find(a => a.id === selectedAanvraagId);
                                if (!req) return null;
                                return (
                                    <>
                                        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white">
                                            <h3 className="text-xl font-bold text-gray-900">
                                                Aanvraag Details
                                            </h3>
                                            <button
                                                onClick={() => setSelectedAanvraagId(null)}
                                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-6">
                                            {/* Status Badge */}
                                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                                                <div>
                                                    <div className="text-sm text-gray-500">Aanvraag ID</div>
                                                    <div className="font-mono text-sm">{req.id}</div>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-sm font-bold 
                                                 ${req.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                                                        req.status === 'BESCHIKKING_TOEGEKEND' ? 'bg-green-100 text-green-800' :
                                                            req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {getStatusLabel(req.status)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Left Column: Algemeen */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-900 border-b pb-2">Algemeen</h4>
                                                    <DetailRow label="Gemeente" value={req.gemeente} />
                                                    <DetailRow label="Doelgroep" value={req.doelgroep.toString()} />
                                                    <DetailRow label="BAG ID" value={req.bagId} />
                                                    <DetailRow label="Datum Aanvraag" value={formatDate(req.created_at)} />
                                                </div>

                                                {/* Right Column: Financieel */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-900 border-b pb-2">Financieel (SiSa)</h4>
                                                    <DetailRow label="Gereserveerd" value={formatCurrency(req.bedrag)} />
                                                    <DetailRow label="Factuurbedrag" value={req.factuur_bedrag ? formatCurrency(req.factuur_bedrag) : '-'} />
                                                    <DetailRow label="Definitief Subsidie" value={req.definitief_subsidie_bedrag ? formatCurrency(req.definitief_subsidie_bedrag) : '-'} />
                                                    <DetailRow label="Datum Beschikking" value={req.datum_beschikking || '-'} />
                                                    <DetailRow label="Datum Uitbetaling" value={req.datum_betaling || '-'} />
                                                </div>
                                            </div>

                                            {/* Technisch */}
                                            <div className="space-y-4">
                                                <h4 className="font-bold text-gray-900 border-b pb-2">Technisch & Uitvoering</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <DetailRow label="Type Maatregel" value={req.type_maatregel || '-'} />
                                                    <DetailRow label="Omvang" value={req.omvang_m2 ? `${req.omvang_m2} m²` : '-'} />
                                                    <DetailRow label="Isolatie Waarde" value={req.isolatie_waarde || '-'} />
                                                    <DetailRow label="Meldcode ISDE" value={req.meldcode_isde || '-'} />
                                                    <DetailRow label="Biobased" value={req.is_biobased !== undefined ? (req.is_biobased ? 'Ja' : 'Nee') : '-'} />
                                                </div>
                                            </div>

                                            {/* Bewijslast */}
                                            <div className="space-y-2">
                                                <h4 className="font-bold text-gray-900 border-b pb-2">Bewijslast (Links)</h4>
                                                {req.factuur_pdf ? (
                                                    <a href={req.factuur_pdf} target="_blank" rel="noreferrer" className="block text-blue-600 hover:underline text-sm">📄 Factuur PDF</a>
                                                ) : <div className="text-sm text-gray-400">Geen factuur</div>}

                                                {req.betaalbewijs_pdf ? (
                                                    <a href={req.betaalbewijs_pdf} target="_blank" rel="noreferrer" className="block text-blue-600 hover:underline text-sm">💳 Betaalbewijs PDF</a>
                                                ) : <div className="text-sm text-gray-400">Geen betaalbewijs</div>}

                                                {req.fotos_uitvoering_urls && req.fotos_uitvoering_urls.length > 0 ? (
                                                    <div className="flex gap-2 mt-2">
                                                        {req.fotos_uitvoering_urls.map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">
                                                                📷 Foto {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : <div className="text-sm text-gray-400">Geen foto's</div>}
                                            </div>

                                        </div>
                                        <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end">
                                            <button
                                                onClick={() => setSelectedAanvraagId(null)}
                                                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                Sluiten
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

        </div >
    );
}

function DetailRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex justify-between">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-900">{value}</span>
        </div>
    );
}
