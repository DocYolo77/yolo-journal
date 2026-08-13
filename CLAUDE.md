# CLAUDE.md — yolo-journal

## Rolle

Du arbeitest am Repository **`DocYolo77/yolo-journal`** und sollst die Web-App ab jetzt technisch weiterentwickeln.

Arbeite **inkrementell, testbar und konservativ**. Ziel ist nicht, möglichst viel auf einmal zu bauen, sondern eine stabile V1, die nach jedem größeren Schritt weiterhin läuft.

---

## Aktueller Stand

Das Projekt wurde bereits vorbereitet:

- Repository: `DocYolo77/yolo-journal`
- Supabase-Projekt existiert und läuft in der Region Frankfurt.
- Supabase CLI ist lokal eingerichtet und mit dem Projekt verlinkt.
- Next.js liegt unter `web/`.
- Next.js Version beim letzten Test: **16.3.0**
- Node.js wurde auf eine aktuelle LTS-Version aktualisiert.
- Installiert:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Lokale Secrets liegen in `web/.env.local`.
- Die `.env.local` darf **niemals committed** werden.
- Serverseitiger Supabase-Client:
  - `web/src/lib/supabase/server.ts`
- Health-Route:
  - `web/src/app/api/health/route.ts`
- Letzter erfolgreicher Test:
  - `GET /api/health`
  - Antwort: `{"ok":true,"trades":0}`

Die Verbindung **Next.js → Supabase funktioniert damit nachweislich**.

---

## Bestehende Supabase-Migrationen

Migrationen liegen unter:

`supabase/migrations/`

Bestehend:

1. `20260813164800_initial_schema.sql`
2. `20260813164801_grant_service_role.sql`

### Bestehende Tabellen

Das Schema enthält bereits:

- `accounts`
- `strategies`
- `trades`
- `executions`
- `trade_metrics`
- `tags`
- `trade_tags`
- `journal_days`
- `attachments`

RLS ist aktiviert.

Für die aktuelle V1 wird serverseitig mit dem Supabase **Secret Key** gearbeitet.

---

# WICHTIGE REGELN

## 1. Bestehendes Schema respektieren

**Keine bestehende Migration verändern oder löschen.**

Wenn das Schema erweitert werden muss:

1. neue Migration erstellen,
2. sinnvollen Zeitstempel verwenden,
3. zuerst Dry Run,
4. erst danach anwenden.

Keine manuellen Schemaänderungen im Supabase Dashboard, wenn sie als Migration abbildbar sind.

---

## 2. Keine Secrets exponieren

Niemals:

- `SUPABASE_SECRET_KEY` in Client Components verwenden,
- Secret Keys mit `NEXT_PUBLIC_` prefixen,
- `.env.local` committen,
- Secrets loggen,
- Secret Keys in Responses oder Browser-JavaScript ausgeben.

Der Admin-/Secret-Key-Client darf ausschließlich serverseitig importiert werden.

---

## 3. Noch KEIN User-Auth-System bauen

V1 ist zunächst **Single User**.

Das Schema ist bereits auf spätere Multi-User-Nutzung vorbereitet, aber:

- noch keine Login-Seite,
- noch kein Signup,
- noch keine Userverwaltung,
- noch keine Auth-Komplexität hinzufügen.

Auth kommt später als eigene Phase.

---

## 4. Nicht alles auf einmal umbauen

Vor jeder größeren Änderung:

```bash
git status
```

Bestehende Dateien zuerst lesen.

Nach jeder Phase mindestens:

```bash
npm run lint
npm run build
```

Falls ein Fehler entsteht, zuerst diesen beheben und nicht mehrere weitere Änderungen darüber stapeln.

---

# Ziel der V1

Eine schnelle, saubere und funktionale **Trading-Journal-Web-App**.

Priorität:

1. Trades erfassen
2. Trades ansehen und bearbeiten
3. Executions / Teilverkäufe erfassen
4. Strategien und Accounts verwalten
5. Tagesjournal führen
6. Grundlegende Trading-Statistiken anzeigen
7. Screenshots später sauber ergänzen

Keine unnötige Enterprise-Architektur.

---

# Gewünschte App-Struktur

## Navigation

Eine einfache Desktop-Navigation mit mindestens:

- **Dashboard**
- **Trades**
- **Journal**
- **Strategies**
- **Accounts**

Optisch modern, reduziert und trading-orientiert.

Dark Mode darf Standard sein.

---

# Phase 1 — Technisches Fundament prüfen

Bevor neue Features gebaut werden:

1. Repository und Working Tree vollständig inspizieren.
2. Prüfen, ob `web/.env.local` durch `.gitignore` ausgeschlossen ist.
3. Bestehenden Supabase-Serverclient prüfen.
4. Health Route testen.
5. `npm run lint`
6. `npm run build`

Wenn alles grün ist, erst dann Phase 2 beginnen.

Keine unnötigen Dependency-Upgrades durchführen.

---

# Phase 2 — App Shell

Baue zunächst nur:

- globales Layout
- Sidebar / Navigation
- Header
- responsive Grundstruktur
- Dashboard-Platzhalter

Keine komplexen Charts in dieser Phase.

Die App soll danach bereits sauber und professionell aussehen.

---

# Phase 3 — Trades

## Trades-Liste

Route:

`/trades`

Darstellen:

- Symbol
- Long / Short
- Status
- Strategy
- Account
- Opened At
- Closed At
- initiales Risiko
- R-Multiple, falls vorhanden
- Net P&L, falls vorhanden

Ermögliche sinnvolle Sortierung nach Datum.

---

## Neuer Trade

Route:

`/trades/new`

Mindestens erfassen:

- Symbol
- Direction
- Asset Class
- Status
- Account
- Strategy
- Opened At
- Planned Entry
- Initial Stop
- Initial Risk Amount
- Initial Risk %
- Thesis
- Notes

Validierung serverseitig durchführen.

Nach erfolgreichem Speichern auf die Trade-Detailseite weiterleiten.

---

## Trade Detail

Route:

`/trades/[id]`

Darstellen:

- Stammdaten
- Thesis
- Notes
- Risiko
- Strategy
- Account
- Executions
- vorhandene Metrics
- Tags

Ermögliche Editieren der Trade-Stammdaten.

---

# Phase 4 — Executions

Ein Trade kann mehrere Ausführungen haben:

- Entry
- Add
- Partial Exit
- Final Exit

Nutze dafür die bestehende Tabelle `executions`.

Die UI soll mindestens erlauben:

- Buy / Sell
- Zeitpunkt
- Menge
- Preis
- Fees
- Notiz

Nicht versuchen, komplexe Broker-Orderlogik in V1 nachzubauen.

---

# Phase 5 — Strategies & Accounts

## `/strategies`

CRUD für:

- Name
- Description
- Active / Inactive

## `/accounts`

CRUD für:

- Name
- Broker
- Base Currency
- Active / Inactive

Keine unnötige Komplexität.

---

# Phase 6 — Daily Journal

Route:

`/journal`

Ansicht nach Datum.

Pro Tag sollen die bestehenden Felder nutzbar sein:

- Premarket Notes
- Postmarket Notes
- Lessons
- Mood
- Focus
- Discipline
- Sleep Hours

Ein Tag soll schnell angelegt und später bearbeitet werden können.

---

# Phase 7 — Dashboard

Dashboard erst auf Basis echter Daten aufbauen.

V1-Kennzahlen:

- Anzahl Trades
- offene Trades
- geschlossene Trades
- Win Rate
- Net P&L
- durchschnittliches R
- Profit Factor, sofern aus vorhandenen Daten sinnvoll berechenbar
- Avg Winner R
- Avg Loser R

Zusätzlich:

- letzte Trades
- Performance nach Strategy
- Performance nach Monat

Keine Kennzahl erfinden, wenn die benötigten Daten fehlen.

Wenn eine Berechnung nicht eindeutig ist, im Code sauber dokumentieren.

---

# Datenzugriff

Bevorzugt:

- Server Components für Reads
- Server Actions oder Route Handlers für Writes

Client Components nur dort einsetzen, wo echte Interaktivität benötigt wird.

Keine direkten Secret-Key-Abfragen aus Client Components.

---

# Supabase-Fehlerbehandlung

Jede Datenoperation muss Fehler sinnvoll behandeln.

Nicht einfach Fehler verschlucken und weitermachen.

Stattdessen:

- Fehler serverseitig loggen,
- dem User eine verständliche Fehlermeldung zeigen,
- keine sensitiven Details exponieren.

---

# Styling

Ziel:

- clean
- modern
- professionell
- datenorientiert
- nicht verspielt

Trading-Dashboard-Charakter.

Bevorzugt:

- gute Typografie
- klare Hierarchie
- kompakte Tabellen
- Cards nur dort, wo sie Informationswert haben
- wenig visuelles Rauschen

Keine gigantischen Hero Sections oder Marketing-Landingpage bauen.

---

# Codequalität

- TypeScript strikt nutzen.
- `any` möglichst vermeiden.
- Komponenten sinnvoll aufteilen.
- Keine 1000-Zeilen-Komponenten.
- Wiederverwendbare Datenzugriffe unter `src/lib/`.
- Kein Overengineering.
- Keine unnötige State-Management-Library einführen.
- Keine ORM-Schicht ergänzen, solange Supabase direkt ausreichend ist.

---

# Git-Workflow

Arbeite in kleinen, nachvollziehbaren Schritten.

Vor jedem Commit:

```bash
npm run lint
npm run build
```

Commits sollen beschreibend sein, z. B.:

```text
feat: add trading journal app shell
feat: add trade CRUD
feat: add journal day editor
fix: handle supabase trade query errors
```

Keine Secrets committen.

---

# Sicherheitsregel für Datenbankänderungen

Wenn eine neue Migration nötig ist:

```bash
npx supabase migration new <name>
```

Danach:

```bash
npx supabase db push --dry-run
```

Erst wenn der Dry Run plausibel ist:

```bash
npx supabase db push
```

Keine destruktive Migration ohne vorher klar darauf hinzuweisen.

---

# Arbeitsweise

Beginne jetzt mit **Phase 1**.

Gib vor Änderungen kurz aus:

1. was du im Repository gefunden hast,
2. ob der aktuelle Stand konsistent ist,
3. welchen kleinen nächsten Schritt du ausführst.

Dann arbeite Phase für Phase.

**Nicht sofort die gesamte V1 in einem einzigen riesigen Patch bauen.**

Der wichtigste Grundsatz dieses Projekts lautet:

> Erst funktionierend und überprüfbar, dann erweitern.
