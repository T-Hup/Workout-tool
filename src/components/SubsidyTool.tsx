import React, { useState, FormEvent, useEffect } from 'react';
import {
    checkSubsidyEligibility,
    HouseData,
    SubsidieResultaat,
    getSupportedMunicipalities,
} from '../utils/subsidyCalculator';
import { reservationManager } from '../services/ReservationManager';

/**
 * SubsidyTool Component
 * 
 * A professional form interface for testing subsidy eligibility
 * based on house characteristics and municipality rules.
 */
export default function SubsidyTool() {
    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    const [formData, setFormData] = useState<HouseData>({
        gemeente: '',
        bag_id: '',
        bouwjaar: 0,
        woz_waarde: 0,
        energielabel: '',
        woningtype: '',
        heeft_reeds_subsidie: false,
    });

    const [result, setResult] = useState<SubsidieResultaat | null>(null);
    const [error, setError] = useState<string>('');
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

    // Initialize manager on mount (loads state)
    useEffect(() => {
        // No explicit init needed as constructor handles it, but good for side effects if any
    }, []);

    // ... configuration ...
    const gemeenten = getSupportedMunicipalities();
    const energielabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'ONBEKEND'];
    const woningtypes = ['Tussenwoning', 'Hoekwoning', 'Vrijstaand', '2-onder-1-kap', 'Appartement'];

    // ... handlers ...

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const validateForm = (): boolean => {
        // ... (existing validation logic) ...
        if (!formData.gemeente) { setError('Selecteer een gemeente'); return false; }
        if (!formData.bag_id.trim()) { setError('Voer een BAG ID in'); return false; }
        if (formData.bouwjaar < 1000 || formData.bouwjaar > new Date().getFullYear()) { setError('Voer een geldig bouwjaar in'); return false; }
        if (formData.woz_waarde <= 0) { setError('Voer een geldige WOZ-waarde in'); return false; }
        if (!formData.energielabel) { setError('Selecteer een energielabel'); return false; }
        if (!formData.woningtype) { setError('Selecteer een woningtype'); return false; }
        setError('');
        return true;
    };

    const handleClaim = (detail: any) => {
        if (!confirm(`Wilt u de subsidie "${detail.route}" van ${formatCurrency(detail.bedrag)} claimen?`)) {
            return;
        }

        // Determine doelgroep based on detail or form?
        // Detail object in subsidyCalculator usually has 'doelgroep' string like "doelgroep_2"
        const doelgroepNum = parseInt(detail.doelgroep.replace('doelgroep_', ''));

        const result = reservationManager.reserveSubsidie(
            formData.bag_id,
            formData.gemeente,
            doelgroepNum as 1 | 2 | 3,
            detail.bedrag
        );

        if (result.success) {
            alert(`✅ ${result.message}\nReferentie: ${result.aanvraagId}`);
            window.location.reload();
        } else {
            alert(`⚠️ Fout bij claimen: ${result.message}`);
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitted(true);

        // Use Manager to check existing reservations
        const existing = reservationManager.getAanvragen().find(
            a => a.bagId === formData.bag_id && ['PENDING', 'APPROVED', 'FINALIZED'].includes(a.status)
        );

        if (existing) {
            setResult({
                status: 'AFGEWEZEN',
                reden: `Dit BAG ID heeft al een lopende status: ${existing.status}`
            });
            setError('');
            return;
        }

        if (!validateForm()) {
            setResult(null);
            return;
        }

        try {
            const subsidieResult = checkSubsidyEligibility(formData);
            setResult(subsidieResult);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
            setResult(null);
        }
    };

    const handleReset = () => {
        setFormData({
            gemeente: '',
            bag_id: '',
            bouwjaar: 0,
            woz_waarde: 0,
            energielabel: '',
            woningtype: '',
            heeft_reeds_subsidie: false,
        });
        setResult(null);
        setError('');
        setIsSubmitted(false);
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatDoelgroepName = (key: string): string => {
        return key.replace('doelgroep_', 'Doelgroep ');
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="bg-white shadow-sm rounded-lg mb-6 p-6 border-l-4 border-blue-600">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Subsidie Geschiktheidscheck
                    </h1>
                    <p className="text-gray-600">
                        Controleer of een woning in aanmerking komt voor subsidie op basis van
                        gemeentelijke criteria.
                    </p>
                </div>

                {/* Main Form */}
                <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Gemeente */}
                        <div>
                            <label
                                htmlFor="gemeente"
                                className="block text-sm font-semibold text-gray-700 mb-2"
                            >
                                Gemeente <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="gemeente"
                                name="gemeente"
                                value={formData.gemeente}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            >
                                <option value="">-- Selecteer gemeente --</option>
                                {gemeenten.map((gemeente) => (
                                    <option key={gemeente} value={gemeente}>
                                        {gemeente}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* BAG ID */}
                        <div>
                            <label
                                htmlFor="bag_id"
                                className="block text-sm font-semibold text-gray-700 mb-2"
                            >
                                BAG ID <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="bag_id"
                                name="bag_id"
                                value={formData.bag_id}
                                onChange={handleInputChange}
                                placeholder="Bijv. 0826010000000001"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Bouwjaar & WOZ Waarde (Grid) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Bouwjaar */}
                            <div>
                                <label
                                    htmlFor="bouwjaar"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Bouwjaar <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    id="bouwjaar"
                                    name="bouwjaar"
                                    value={formData.bouwjaar || ''}
                                    onChange={handleInputChange}
                                    placeholder="Bijv. 1985"
                                    min="1000"
                                    max={new Date().getFullYear()}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                />
                            </div>

                            {/* WOZ Waarde */}
                            <div>
                                <label
                                    htmlFor="woz_waarde"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    WOZ-waarde <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-500">€</span>
                                    <input
                                        type="number"
                                        id="woz_waarde"
                                        name="woz_waarde"
                                        value={formData.woz_waarde || ''}
                                        onChange={handleInputChange}
                                        placeholder="Bijv. 350000"
                                        min="0"
                                        step="1000"
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Energielabel & Woningtype (Grid) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Energielabel */}
                            <div>
                                <label
                                    htmlFor="energielabel"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Energielabel <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="energielabel"
                                    name="energielabel"
                                    value={formData.energielabel}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                >
                                    <option value="">-- Selecteer label --</option>
                                    {energielabels.map((label) => (
                                        <option key={label} value={label}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Woningtype */}
                            <div>
                                <label
                                    htmlFor="woningtype"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Woningtype <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="woningtype"
                                    name="woningtype"
                                    value={formData.woningtype}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                >
                                    <option value="">-- Selecteer type --</option>
                                    {woningtypes.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Reeds Subsidie Checkbox */}
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <label className="flex items-start space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="heeft_reeds_subsidie"
                                    checked={formData.heeft_reeds_subsidie}
                                    onChange={handleInputChange}
                                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">
                                    <span className="font-semibold">Reeds subsidie ontvangen</span>
                                    <br />
                                    <span className="text-gray-500">
                                        Vink aan indien er al subsidie op dit BAG ID is verstrekt
                                    </span>
                                </span>
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
                            >
                                Check Subsidie
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </form>
                </div>

                {/* Error Display */}
                {error && isSubmitted && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md shadow-sm">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-semibold text-red-800">Fout</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results Display */}
                {result && isSubmitted && !error && (
                    <div className="space-y-4">
                        {/* AFGEWEZEN Status */}
                        {result.status === 'AFGEWEZEN' && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-md shadow-sm">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <svg
                                            className="h-6 w-6 text-red-400"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <h3 className="text-lg font-bold text-red-800">
                                            Subsidie Afgewezen
                                        </h3>
                                        <p className="text-red-700 mt-2">{result.reden}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUCCESS Status */}
                        {result.toegewezen_doelgroepen &&
                            result.toegewezen_doelgroepen.length > 0 && (
                                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-md shadow-sm">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                            <svg
                                                className="h-6 w-6 text-green-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <h3 className="text-lg font-bold text-green-800">
                                                Subsidie Toegekend
                                            </h3>
                                            <p className="text-green-700 mt-2 font-semibold">
                                                U kunt maar 1x subsidie krijgen. Kies één van de volgende opties:
                                            </p>

                                            {/* Subsidy Options */}
                                            {result.subsidie_details && result.subsidie_details.length > 0 && (
                                                <div className="mt-4 space-y-3">
                                                    {result.subsidie_details.map((detail) => (
                                                        <div
                                                            key={`${detail.doelgroep}-${detail.route}`}
                                                            className="bg-white border-2 border-green-200 rounded-lg p-4 hover:border-green-400 transition-colors"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                                                                            {formatDoelgroepName(detail.doelgroep)}
                                                                        </span>
                                                                        <span className="text-sm font-semibold text-gray-700">
                                                                            {detail.route}
                                                                        </span>
                                                                    </div>
                                                                    {detail.beschrijving && (
                                                                        <p className="text-sm text-gray-600 mt-1">
                                                                            {detail.beschrijving}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        {detail.bedrag > 0 ? (
                                                                            <div className="text-2xl font-bold text-green-700">
                                                                                {formatCurrency(detail.bedrag)}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-lg font-semibold text-gray-500">
                                                                                Geen subsidie
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Claim Button */}
                                                                    {detail.bedrag > 0 && (
                                                                        <button
                                                                            onClick={() => handleClaim(detail)}
                                                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-bold text-sm shadow-sm transition-colors"
                                                                        >
                                                                            Claimen
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                        {/* NO DOELGROEPEN (but not rejected) */}
                        {result.toegewezen_doelgroepen &&
                            result.toegewezen_doelgroepen.length === 0 &&
                            !result.status && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-md shadow-sm">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                            <svg
                                                className="h-6 w-6 text-yellow-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <h3 className="text-lg font-bold text-yellow-800">
                                                Geen Doelgroepen Toegewezen
                                            </h3>
                                            <p className="text-yellow-700 mt-2">
                                                Deze woning voldoet niet aan de criteria voor subsidie.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        {/* Warnings */}
                        {result.warnings && result.warnings.length > 0 && (
                            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-md shadow-sm">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <svg
                                            className="h-5 w-5 text-orange-400"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h4 className="text-sm font-semibold text-orange-800">
                                            Waarschuwingen
                                        </h4>
                                        <ul className="mt-2 text-sm text-orange-700 space-y-1">
                                            {result.warnings.map((warning, idx) => (
                                                <li key={idx}>• {warning}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rejection Reasons per Doelgroep */}
                        {result.afwijs_redenen &&
                            Object.keys(result.afwijs_redenen).length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 p-6 rounded-md shadow-sm">
                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                        <svg
                                            className="h-5 w-5 mr-2 text-gray-500"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        Details per Doelgroep
                                    </h4>
                                    <div className="space-y-2">
                                        {Object.entries(result.afwijs_redenen).map(([key, reason]) => (
                                            <div
                                                key={key}
                                                className="flex items-start bg-white p-3 rounded border border-gray-200"
                                            >
                                                <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded mr-3">
                                                    {formatDoelgroepName(key)}
                                                </span>
                                                <span className="text-sm text-gray-600">{reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* Summary Card */}
                        <div className="bg-blue-50 border border-blue-200 p-6 rounded-md shadow-sm">
                            <h4 className="text-sm font-bold text-blue-900 mb-3">
                                Ingevoerde Gegevens
                            </h4>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div>
                                    <dt className="font-semibold text-blue-800">Gemeente:</dt>
                                    <dd className="text-blue-700">{formData.gemeente}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-blue-800">BAG ID:</dt>
                                    <dd className="text-blue-700">{formData.bag_id}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-blue-800">Bouwjaar:</dt>
                                    <dd className="text-blue-700">{formData.bouwjaar}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-blue-800">WOZ-waarde:</dt>
                                    <dd className="text-blue-700">
                                        {formatCurrency(formData.woz_waarde)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-blue-800">Energielabel:</dt>
                                    <dd className="text-blue-700">{formData.energielabel}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-blue-800">Woningtype:</dt>
                                    <dd className="text-blue-700">{formData.woningtype}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
