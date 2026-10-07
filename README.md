# Sport Recap

Spoilerfreie Übersicht der Spiele von letzter Nacht (MLB, NBA, NFL) als Web-App für das Handy.
Hervorgegangen aus einer Home-Assistant-Automation.

- **Letzte Nacht:** jedes beendete Spiel bekommt eine Spannung von 1 bis 5 und einen Grund, der nichts verrät. Preseason-Spiele bekommen höchstens 3. Lieblingsteams ohne Spiel stehen gesammelt in einer kleinen Kachel. Das Ergebnis erscheint erst nach Tippen auf „Aufdecken“. Mit den Pfeilen geht es zu früheren Nächten.
- **Heute Abend:** alle Spiele der nächsten 24 Stunden mit deutscher Uhrzeit, sortiert nach Lieblingsteams, Top-Matchups, Rivalitäten und dem Rest.
- **Meine Teams:** alle Teams aus MLB, NBA und NFL. Ein Tipp auf den Stern macht ein Team zum Lieblingsteam. Lieblingsteams stehen in den anderen Tabs immer ganz oben. Die Auswahl wird im Browser des Geräts gespeichert und lässt sich auf die Standardteams zurücksetzen.

Daten kommen direkt im Browser von der inoffiziellen ESPN-API. Spielpläne werden höchstens alle 5 Minuten neu geladen, Spielverläufe beendeter Spiele einmal am Tag.

## Wo was steht

- `src/rating.ts`: Bewertungsregeln (Spannung, spoilerfreie Gründe)
- `src/config.ts`: Standard-Lieblingsteams, Rivalitäten, Grenze für Top-Matchups
- `src/teams.ts`: feste Teamliste für „Meine Teams“
- `src/favorites.ts`: Lieblingsteams laden, speichern und Spielen zuordnen

## Entwicklung

```sh
npm install
npm run dev     # lokal starten
npm test        # Bewertungslogik prüfen
npm run build   # nach dist/ bauen
```

Jeder Push auf `main` wird über GitHub Actions auf GitHub Pages veröffentlicht.
