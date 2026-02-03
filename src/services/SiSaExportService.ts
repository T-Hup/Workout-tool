import { reservationManager, Aanvraag } from './ReservationManager';

/**
 * SiSaExportService
 * 
 * Handles the generation of CSV reports for finalized subsidy applications.
 */
export class SiSaExportService {

    /**
     * Export all applications that are awarded or paid, grouped by municipality.
     */
    public exportSiSaReports() {
        const targetAanvragen = reservationManager.getAanvragen().filter(a => a.status === 'BESCHIKKING_TOEGEKEND' || a.status === 'PAID');
        this.processExport(targetAanvragen, 'SiSa_Rapportage');
    }

    /**
     * Special export for finance to check invoices against awarded grants.
     */
    public exportAwardedForFinance() {
        const awarded = reservationManager.getAanvragen().filter(a => a.status === 'BESCHIKKING_TOEGEKEND');
        this.processExport(awarded, 'Financiele_Check_Toegekend');
    }

    private processExport(aanvragen: Aanvraag[], prefix: string) {
        if (aanvragen.length === 0) {
            alert('Geen aanvragen gevonden voor deze export.');
            return;
        }

        // Group by gemeente
        const grouped = aanvragen.reduce((acc, current) => {
            if (!acc[current.gemeente]) {
                acc[current.gemeente] = [];
            }
            acc[current.gemeente].push(current);
            return acc;
        }, {} as Record<string, Aanvraag[]>);

        // Generate files for each municipality
        Object.entries(grouped).forEach(([gemeente, list]) => {
            this.generateAndDownloadCSV(gemeente, list, prefix);
        });
    }

    private generateAndDownloadCSV(gemeente: string, aanvragen: Aanvraag[], prefix: string) {
        const headers = [
            'Aanvraag ID',
            'BAG ID',
            'Gemeente',
            'Doelgroep',
            'Status',
            'Reservering Bedrag',
            'Factuur Bedrag',
            'Definitief Subsidie',
            'Datum Beschikking',
            'Datum Uitbetaling',
            'Type Maatregel',
            'Omvang (m2)',
            'Isolatie Waarde',
            'Biobased',
            'Meldcode ISDE',
            'Datum Aanvraag'
        ];

        const rows = aanvragen.map(a => [
            a.id,
            a.bagId,
            a.gemeente,
            a.doelgroep,
            a.status,
            (a.bedrag / 100).toFixed(2),
            a.factuur_bedrag ? (a.factuur_bedrag / 100).toFixed(2) : '0.00',
            a.definitief_subsidie_bedrag ? (a.definitief_subsidie_bedrag / 100).toFixed(2) : '0.00',
            a.datum_beschikking || '-',
            a.datum_betaling || '-',
            a.type_maatregel || '-',
            a.omvang_m2 || '-',
            a.isolatie_waarde || '-',
            a.is_biobased ? 'Ja' : 'Nee',
            a.meldcode_isde || '-',
            new Date(a.created_at).toLocaleDateString('nl-NL')
        ]);

        const totalSpent = aanvragen.reduce((sum, current) => sum + (current.definitief_subsidie_bedrag || 0), 0) / 100;

        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        // Summary row
        csvContent += `\n"Totaal uitgekeerd voor ${gemeente}: €${totalSpent.toFixed(2)}"\n`;

        this.downloadFile(`${prefix}_${gemeente}_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    }

    private downloadFile(filename: string, content: string) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export const sisaExportService = new SiSaExportService();
