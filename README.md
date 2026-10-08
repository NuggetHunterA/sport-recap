# Sport Recap

Spoilerfreie Übersicht der Spiele von letzter Nacht (MLB, NBA, NFL) als Web-App für das Handy.
Hervorgegangen aus einer Home-Assistant-Automation.

- **Letzte Nacht:** jedes beendete Spiel bekommt eine Spannung von 1 bis 5 und einen Grund, der nichts verrät. Für Spannendes (ab 4 Balken), Rivalitäten, Playoffs und Topduelle gibt es je mehrere Labels; kein Label verrät Comeback, Führungswechsel, Extra Innings oder Overtime. Pro Spiel bleibt das Label immer gleich. Preseason-Spiele bekommen höchstens 3. Unter „Top-Tipps“ stehen höchstens 2 Spiele, 3 wenn das „Spiel der Nacht“ von einem Lieblingsteam ist; weitere sehenswerte Spiele stehen unter „Weitere Spiele“. Ohne Ligafilter wird ein NFL-Spiel nie zum „Spiel der Nacht“ und nur mit Lieblingsteam zum Top-Tipp, sonst steht es unter „Weitere Spiele“. Die Spannung kommt aus der Spannungskurve: Für jeden Moment (MLB zu Beginn jedes Halbinnings, NBA/NFL alle 30 Sekunden) wird berechnet, wie offen das Spiel war, also wie groß der Abstand im Verhältnis zur Restzeit ist. In der MLB verringern Runner des zurückliegenden Teams auf Base den Abstand (aus den Play-by-Play-Daten von ESPN). Daraus zählen die Schlussphase (50 %), der Verlauf (30 %), Wendungen oder eine späte Aufholjagd (20 %) und eine Aufholjagd extra (5 %). Playoffs (+5), Rivalität (+3) und Topduell (+3) geben zusammen höchstens 8 Punkte, aber nur bei Spielen, die ohnehin mindestens 3 Balken haben. Die Balken kommen aus festen Grenzen je Liga, kalibriert an der Saison 2025/26, sodass etwa 4 Spiele pro Woche 5 Balken bekommen. Ohne Spielverlauf zählt nur der Endabstand. Als historisch zählen No-Hitter und besondere Einzelleistungen, in der MLB auch 14 Strikeouts, 3 Home Runs, 7 RBI oder 5 Hits; sie geben mindestens 3 Balken. Lieblingsteams ohne Spiel stehen gesammelt in einer kleinen Kachel. Das Ergebnis erscheint erst nach Tippen auf „Aufdecken“, beim „Spiel der Nacht“ auch per Tipp auf den verschwommenen Kreis. Nach dem Aufdecken öffnet ein Tipp auf das Spiel (oder auf „Boxscore“) den Boxscore: bei der NBA Minuten, Punkte, Rebounds und Assists pro Spieler, bei MLB Linescore, Batter und Pitcher, bei der NFL Touchdowns, Quarterback, die besten Rusher und Receiver sowie Sacks und Interceptions. Die Kennzahlen oben folgen dem Ligafilter, ein Tipp auf „Sehenswert“ zeigt nur die sehenswerten Spiele. Mit den Pfeilen geht es zu früheren Nächten.
- **Heute Abend:** alle Spiele der nächsten 24 Stunden mit deutscher Uhrzeit, sortiert nach Lieblingsteams, Top-Matchups, Rivalitäten und dem Rest. Laufende Spiele stehen oben unter „Läuft gerade“, ohne Spielstand und ab der Schlussphase ohne genaue Periode, damit nichts verraten wird.
- **Meine Teams:** alle Teams aus MLB, NBA und NFL. Ein Tipp auf den Stern macht ein Team zum Lieblingsteam. Lieblingsteams stehen in den anderen Tabs immer ganz oben. Die Auswahl wird im Browser des Geräts gespeichert und lässt sich auf die Standardteams zurücksetzen.
- **Benachrichtigungen:** morgens um 8 Uhr die Spiele der Lieblingsteams mit Balken und ein Top-Tipp ohne Lieblingsteam und ohne NFL, nachmittags um 15 Uhr nur, wenn ein Lieblingsteam oder ein Top-Matchup (ohne NFL) vor 23 Uhr startet. Nie mit Ergebnis. Gesendet wird vom Workflow `.github/workflows/notify.yml` (Skript `scripts/notify.ts`, Texte in `src/notify.ts`). Einrichten: in „Meine Teams“ auf „Benachrichtigungen einrichten“ tippen und den kopierten Code im Repo unter Settings → Secrets and variables → Actions als Secret `PUSH_CONFIG` speichern. Nach Änderungen an den Lieblingsteams den Code neu kopieren. GitHub startet geplante Läufe teils mit Verspätung.

Daten kommen direkt im Browser von der inoffiziellen ESPN-API. Spielpläne werden höchstens alle 5 Minuten neu geladen, Spielverläufe beendeter Spiele einmal am Tag.

## Wo was steht

- `src/curve.ts`: Spannungskurve (Offenheit je Moment und Kennzahlen)
- `src/rating.ts`: Bewertung (Kontext, Grenzen je Liga, spoilerfreie Gründe)
- `src/boxscore.ts`, `src/BoxSheet.tsx`: Boxscore aus der ESPN-Spielzusammenfassung und die Ansicht dazu
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
