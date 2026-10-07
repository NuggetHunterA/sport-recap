# Sport Recap

Spoilerfreie Übersicht der Spiele von letzter Nacht (MLB, NBA, NFL) als Web-App für das Handy.
Hervorgegangen aus einer Home-Assistant-Automation.

- **Letzte Nacht:** jedes beendete Spiel bekommt eine Spannung von 1 bis 5 und einen Grund, der nichts verrät. Das Ergebnis erscheint erst nach Tippen auf „Aufdecken“. Mit den Pfeilen geht es zu früheren Nächten.
- **Heute Abend:** alle Spiele der nächsten 24 Stunden mit deutscher Uhrzeit, sortiert nach Lieblingsteams, Top-Matchups, Rivalitäten und dem Rest.

Daten kommen direkt im Browser von der inoffiziellen ESPN-API. Lieblingsteams und Rivalitäten stehen in `src/config.ts`, die Bewertungsregeln in `src/rating.ts`.

## Entwicklung

```sh
npm install
npm run dev     # lokal starten
npm test        # Bewertungslogik prüfen
npm run build   # nach dist/ bauen
```

Jeder Push auf `main` wird über GitHub Actions auf GitHub Pages veröffentlicht.
