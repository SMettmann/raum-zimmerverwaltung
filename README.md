# RAUMWERK – Raum- & Zimmerverwaltung

RAUMWERK ist eine bewusst sehr einfach bedienbare Raum- und Zimmerverwaltung: öffnen, verstehen, benutzen – ohne Schulung.

## Aktuell nutzbar

- Dashboard mit Tagesübersicht
- Monatskalender und Buchungsliste
- Buchungen anlegen, bearbeiten, stornieren und löschen
- automatische Prüfung auf Doppelbelegung
- Räume und Zimmer anlegen und bearbeiten
- Gäste und Kunden verwalten
- Reinigungsstatus pro Raum
- Aufgabenverwaltung
- Buchungsbestätigung druckbar / als PDF speicherbar
- CSV-Export und Datensicherung
- responsive Bedienung für Desktop und Smartphone
- zentrale Mehrbenutzer-Architektur mit Cloudflare Workers + D1
- Login mit sicheren Sessions
- Rollen: Administrator, Leitung, Mitarbeiter, Reinigung und Nur lesen
- Versionsschutz bei parallelen Änderungen

## Verhalten ohne Backend

Solange kein Cloudflare-Backend eingerichtet ist, läuft die Web-App wie bisher automatisch im lokalen Browsermodus. Dadurch bleibt der bestehende Prototyp jederzeit nutzbar.

## Cloud-Backend einrichten

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

Beim ersten Öffnen der bereitgestellten RAUMWERK-Adresse erscheint automatisch die Ersteinrichtung. Der erste Zugang wird Administrator; vorhandene lokale Räume und Buchungen können dabei direkt in den zentralen Datenstand übernommen werden.

## Rollen

- **Administrator:** Vollzugriff inklusive Benutzerverwaltung
- **Leitung:** Vollzugriff auf die operative Verwaltung
- **Mitarbeiter:** Buchungen, Gäste, Aufgaben und Reinigung
- **Reinigung:** auf den Reinigungsbereich beschränkter Arbeitszugang
- **Nur lesen:** Einsicht ohne Schreibrechte

## Technik

Frontend: HTML/CSS/JavaScript ohne Framework-Zwang. Backend: Cloudflare Worker. Zentrale Datenhaltung: D1. Session-Cookies sind `HttpOnly`, `Secure` und `SameSite=Lax`; parallele Schreibvorgänge werden per Versionsprüfung gegen unbemerktes Überschreiben geschützt.
