# RAUMSUITE – Raum- & Zimmerverwaltung

RAUMSUITE ist eine bewusst sehr einfach bedienbare Raum- und Zimmerverwaltung: öffnen, verstehen, benutzen – ohne Schulung.

## Aktuell nutzbar

- Dashboard mit Tagesübersicht
- Monatskalender und Buchungsliste
- Buchungen anlegen, bearbeiten, stornieren und löschen
- automatische Prüfung auf Doppelbelegung und Sperrzeiten
- Räume und Zimmer anlegen und bearbeiten
- Gäste und Kunden verwalten
- Reinigungsstatus plus echte Reinigungsplanung
- automatische Reinigungsjobs nach Buchungsende
- Aufgabenverwaltung
- Einsatzplanung
- Vermietungs- und Sperrzeiträume
- Vertragsmanagement mit Druck/PDF
- Rechnungsverwaltung mit offen/bezahlt und Druck/PDF
- XRechnung-XML
- öffentliche Online-Buchungsanfragen mit Verfügbarkeitsprüfung
- Buchungsbestätigung druckbar / als PDF speicherbar
- CSV-Export und Datensicherung
- responsive Bedienung für Desktop und Smartphone
- zentrale Mehrbenutzer-Architektur mit Cloudflare Workers + D1
- Login mit sicheren Sessions
- Rollen: Administrator, Leitung, Mitarbeiter, Reinigung und Nur lesen
- Versionsschutz bei parallelen Änderungen

## Verhalten ohne Backend

Solange kein Cloudflare-Backend eingerichtet ist, läuft die Web-App automatisch im lokalen Browsermodus. Dadurch bleibt der Prototyp jederzeit nutzbar.

## Cloud-Backend lokal einrichten

Voraussetzung: Node.js und ein Cloudflare-Konto.

```bash
npm install
npx wrangler login
npx wrangler d1 create raumwerk-db --location=weur
```

Die ausgegebene `database_id` anschließend in `wrangler.jsonc` bei `REPLACE_WITH_D1_DATABASE_ID` eintragen.

Datenbanktabellen anlegen:

```bash
npx wrangler d1 execute raumwerk-db --remote --file=./schema.sql
```

Danach deployen:

```bash
npm run deploy
```

Beim ersten Öffnen der bereitgestellten RAUMSUITE-Adresse erscheint automatisch die Ersteinrichtung. Der erste Zugang wird Administrator; vorhandene lokale Daten können direkt in den zentralen Datenstand übernommen werden.

> Hinweis: Bestehende technische Bezeichner wie `raumwerk-db` bleiben vorerst aus Kompatibilitätsgründen bestehen. Sie sind für Nutzer nicht sichtbar und haben keinen Einfluss auf die Produktmarke RAUMSUITE.

## Produktionsdeployment über GitHub Actions

Der bestehende Cloudflare-Workflow kann manuell gestartet werden. Dafür werden in den GitHub Actions Secrets drei Werte benötigt:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `RAUMWERK_D1_DATABASE_ID`

Der Workflow erzeugt daraus nur für den Lauf eine Deployment-Konfiguration, spielt `schema.sql` sicher mit `CREATE TABLE IF NOT EXISTS` ein und deployt danach Worker und Frontend. Die D1-Datenbank-ID muss deshalb nicht fest ins Repository geschrieben werden.

Auch der bestehende Secret-Name `RAUMWERK_D1_DATABASE_ID` wird vorerst als technischer Legacy-Bezeichner beibehalten, damit das Deployment nicht durch die Umbenennung beschädigt wird.

## XRechnung

Der produktiv geladene XRechnung-Generator erzeugt UBL 2.1 für XRechnung 3.0.x. Eine von diesem Generator erzeugte Musterrechnung wird in GitHub Actions automatisch mit dem offiziellen KoSIT-Validator und der XRechnung-Konfiguration `v2026-01-31` geprüft.

Der Test verwendet aktuell KoSIT Validator 1.6.2 und die XRechnung-3.0.2-Validator-Konfiguration 2026-01-31. Ein Merge sollte nur erfolgen, wenn der KoSIT-Report die Musterrechnung akzeptiert.

## Rollen

- **Administrator:** Vollzugriff inklusive Benutzerverwaltung
- **Leitung:** Vollzugriff auf die operative Verwaltung
- **Mitarbeiter:** Buchungen, Gäste, Aufgaben und Reinigung
- **Reinigung:** auf den Reinigungsbereich beschränkter Arbeitszugang
- **Nur lesen:** Einsicht ohne Schreibrechte

## Technik

Frontend: HTML/CSS/JavaScript ohne Framework-Zwang. Backend: Cloudflare Worker. Zentrale Datenhaltung: D1. Session-Cookies sind `HttpOnly`, `Secure` und `SameSite=Lax`; parallele Schreibvorgänge werden per Versionsprüfung gegen unbemerktes Überschreiben geschützt.
