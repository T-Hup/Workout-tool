# SubsidieMaster

Een professionele tool voor het controleren en beheren van gemeentelijke subsidies voor woningverduurzaming.

## 🚀 Features

### 1. Subsidie Check Tool
- **Geschiktheidscontrole**: Woningeigenaren kunnen controleren of ze in aanmerking komen voor subsidies.
- **Validatie**: Checks op Gemeente, BAG ID, Bouwjaar, WOZ-waarde, Energielabel en Woningtype.
- **Direct Claimen**: Indien geschikt, kan direct een claim worden ingediend.

### 2. Admin Dashboard & Beheer
Een afgeschermd portaal voor beheerders:
- ** Financieel Overzicht**: Real-time inzicht in budgetten per gemeente en subsidiegroep.
- **SiSa Audit Log**: Volledige audit trail van alle reserveringen, toewijzingen en vrijval (SiSa-compliant).
- **Status Beheer**: Handmatig goedkeuren (Approve) of afwijzen (Reject) van aanvragen.
- **Data Reset**: Mogelijkheid om (mock) data te resetten voor demo-doeleinden.

### 3. Backend Logica
- **ReservationManager**: Singleton service die zorgt voor strikte transactieverwerking.
- **Cent-precisie**: Alle financiële berekeningen vinden plaats in centen om afrondingsfouten te voorkomen.
- **Budget Bewaking**: Automatische checks op beschikbaar budget en dubbele aanvragen.

## 🛠 Tech Stack
- **Frontend**: React (Vite), TypeScript
- **Styling**: Tailwind CSS
- **State/Storage**: LocalStorage (simulatie van database voor demo)

## 🏁 Starten

1. **Installeren**:
   ```bash
   npm install
   ```

2. **Starten (Development)**:
   ```bash
   npm run dev
   ```

3. **Openen**:
   Ga naar `http://localhost:5173`

## 🔐 Admin Toegang
De Admin Dashboard knop bevindt zich **rechtsonder** in het scherm (licht transparant). Klik hierop om naar het beheerdersportaal te gaan.
