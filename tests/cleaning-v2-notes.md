# Reinigung V2 – Prüffälle

- Ein Raum mit manuell gesetztem Reinigungsbedarf erhält automatisch einen Reinigungsauftrag und kann nicht mehr oben offen sein, während er unten fehlt.
- Eine bestätigte Buchung erzeugt genau einen automatischen Reinigungsauftrag zum Buchungsende.
- Wird Buchungsraum oder Buchungsende geändert, folgt ein noch nicht gestarteter automatischer Reinigungsauftrag der Änderung.
- Wird eine Buchung storniert, wird ein noch nicht gestarteter automatischer Reinigungsauftrag entfernt.
- Fällige und überfällige Reinigungen erscheinen in „Heute zu erledigen“.
- Zukünftige Reinigungen erscheinen ausschließlich in „Kommende Reinigungen“.
- Statusfolge in der Oberfläche: Zu reinigen → Reinigung läuft → Sauber.
- Pro offenem Auftrag wird nur die nächste sinnvolle Aktion angeboten.
- Nach „Fertig“ verschwindet der Auftrag aus der Arbeitsliste und der Raum erscheint bei „Saubere Räume“.
