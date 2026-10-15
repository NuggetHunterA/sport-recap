# Sport Recap

Spoilerfreie Übersicht der Spiele von letzter Nacht (MLB, NBA, NFL) als Web-App für das Handy.
Hervorgegangen aus einer Home-Assistant-Automation.

Dieses README ist die Spezifikation der App. Wer eine Regel im Code ändert, ändert sie hier mit.

## Letzte Nacht

**Was gezeigt wird**

- Alle Spiele, deren Start zwischen 12 Uhr am Vortag und 12 Uhr am gewählten Tag (Berliner Zeit) liegt und die beendet sind.
- Oben die Kennzahlen Spiele, Sehenswert und Verzichtbar; sie folgen dem Ligafilter. Ein Tipp auf „Sehenswert“ zeigt nur noch die sehenswerten Spiele.
- Darunter in dieser Reihenfolge: Spiel der Nacht, Meine Teams, Top-Tipps, Weitere Spiele (eingeklappt).
- Jedes Spiel mit Balken (1 bis 5, siehe [Bewertung](#bewertung)) und einem Label, das nichts verrät.
- Mit den Pfeilen geht es zu früheren Nächten.
- Bei MLB und NBA öffnet der runde Play-Knopf oben rechts ein Menü mit „Highlights“ (Video auf YouTube bei @MLB oder @NBA) und „Ganzes Spiel“ (MLB.TV oder NBA League Pass), siehe [Ansehen](#ansehen).

**Nach welchen Regeln** (umgesetzt in `arrangeNight` in `src/nights.ts`, geprüft in `src/nights.test.ts`)

- *Spiel der Nacht:* das sehenswerte Spiel (ab 3 Balken) mit dem höchsten Spannungswert, egal wie viele Balken. Es kann von einem Lieblingsteam sein und steht dann zusätzlich unter „Meine Teams“.
- *Meine Teams:* je Lieblingsteam sein Spiel. Lieblingsteams ohne Spiel stehen gesammelt in einer kleinen Kachel.
- *Top-Tipps:* die sehenswerten Spiele ohne Lieblingsteam, meiste Balken zuerst, bei Gleichstand Playoffs und höhere Spannung. Höchstens 2, oder 3, wenn das Spiel der Nacht von einem Lieblingsteam ist.
- *Weitere Spiele:* zuerst die übrigen sehenswerten Spiele, dann alle anderen ohne Lieblingsteam.
- *NFL:* Ohne Ligafilter wird ein NFL-Spiel weder Spiel der Nacht noch Top-Tipp und steht unter „Weitere Spiele“ (oder unter „Meine Teams“). Mit NFL-Filter gelten die normalen Regeln.
- Spiele, die beim Laden noch laufen, fehlen; ein Hinweis nennt nur ihre Anzahl. Sobald sie beendet sind, erscheinen sie beim nächsten Laden.

**Was nie verraten wird**

- Das Ergebnis erscheint erst nach Tippen auf „Aufdecken“, beim Spiel der Nacht auch per Tipp auf den verschwommenen Kreis. Die App merkt sich, welche Spiele aufgedeckt sind.
- Kein Label verrät Comeback, Führungswechsel, Extra Innings oder Overtime. Pro Spiel bleibt das Label immer gleich.
- Eine historische Einzelleistung erscheint mit Spieler erst nach dem Aufdecken als goldenes Band, beim Aufdecken mit einer kurzen Animation.
- Den Boxscore gibt es erst nach dem Aufdecken, per Tipp auf das Spiel oder auf „Boxscore“: bei der NBA Minuten, Punkte, Rebounds und Assists pro Spieler, bei der MLB Linescore, Batter und Pitcher, bei der NFL Touchdowns, Quarterback, die besten Rusher und Receiver sowie Sacks und Interceptions.

## Heute Abend

**Was gezeigt wird**

- Alle Spiele der nächsten 24 Stunden mit deutscher Uhrzeit.
- Laufende Spiele oben unter „Läuft gerade“. Bei MLB und NBA ist das rote Live-Feld ein Link zum Stream (MLB.TV oder League Pass).
- Kennzahlen Spiele, Highlights und Erstes Spiel, nach dem Ligafilter.

**Nach welchen Regeln**

- Gruppiert nach Lieblingsteams, Top-Matchups (Playoffs oder beide Teams mit mindestens 55 % Siegen nach 4 Spielen), Rivalitäten und dem Rest, innerhalb der Gruppe nach Uhrzeit.

**Was nie verraten wird**

- Laufende Spiele ohne Spielstand und ab der Schlussphase (9. Inning, 4. Viertel) ohne genaue Periode, weil Verlängerung und Extra Innings ein enges Spiel verraten.

## Ansehen

Umgesetzt in `src/watch.ts` (Zuordnung, geprüft in `src/watch.test.ts`) und `src/WatchMenu.tsx` (Knopf und Menü). Nur MLB und NBA.

- *Highlights:* Suche über die YouTube-API im offiziellen Kanal, bis 20 Stunden nach Anwurf, damit bei Serien nicht das nächste Spiel derselben Teams erscheint. Beide Teams und „Highlights“ müssen im Titel stehen; Zusammenfassungen des ganzen Spiels gehen vor. Der API-Schlüssel kommt beim Build aus dem GitHub-Secret `YT_KEY` (`VITE_YT_KEY`); ohne Schlüssel gibt es keinen Highlights-Link.
- *MLB.TV:* Spiel über Datum und Teams im Spielplan der MLB-API, Link direkt in den Heim-Feed, bei einem Lieblingsteam auswärts in dessen Feed.
- *NBA:* Spiel über Teams und Anwurf im Spielplan von nba.com, Link auf die Spielseite mit Player. Spoilerschutz dort über „Hide Scores“ im NBA-Konto.
- Gesucht wird erst beim Öffnen des Menüs; gefundene Links merkt sich der Browser zwei Wochen. Was nicht gefunden wird, fehlt im Menü und wird beim nächsten Öffnen erneut gesucht.
- Das Menü liegt über einem Schleier. Ein Tipp daneben schließt nur das Menü und deckt kein Ergebnis auf. Die Links stehen auch auf verdeckten Karten.

## Tabellen

**Was gezeigt wird**

- Die Tabellen von MLB, NBA und NFL, eine Liga auf einmal, beim Öffnen immer die MLB.
- MLB und NFL nach Divisionen, dazu je Liga bzw. Conference eine Wild-Card-Tabelle (ohne Divisionssieger, Linie nach Platz 3, Abstand zum letzten Wild-Card-Platz).
- NBA nach Conference mit Linien nach Platz 6 (Playoffs) und 10 (Play-In).
- Markierungen von ESPN: x Playoffs sicher, y Division gewonnen, z bester Platz, e ausgeschieden. Lieblingsteams sind hervorgehoben.
- Nach Ende der regulären Saison steht dort der Endstand.

**Was nie verraten wird**

- Beim Öffnen des Tabs ist alles außer den Überschriften verschwommen und die Teamfarben sind grau; „Aufdecken“ macht die gewählte Liga lesbar.

## Meine Teams

- Alle Teams aus MLB, NBA und NFL. Ein Tipp auf den Stern macht ein Team zum Lieblingsteam.
- Lieblingsteams stehen in den anderen Tabs immer ganz oben.
- Die Auswahl wird im Browser des Geräts gespeichert. Ein neues Gerät startet mit den Standardteams aus `src/config.ts`.
- Hier werden auch die Benachrichtigungen eingerichtet.

## Benachrichtigungen

- Morgens um 8 Uhr die Spiele der Lieblingsteams mit Balken und ein Top-Tipp ohne Lieblingsteam und ohne NFL.
- Nachmittags um 15 Uhr nur, wenn ein Lieblingsteam oder ein Top-Matchup (ohne NFL) vor 23 Uhr startet. Ein Tipp öffnet „Heute Abend“.
- Nie mit Ergebnis.
- Gesendet wird vom Workflow `.github/workflows/notify.yml` (Skript `scripts/notify.ts`, Texte in `src/notify.ts`). GitHub startet geplante Läufe teils mit Verspätung.
- Einrichten: in „Meine Teams“ auf „Benachrichtigungen einrichten“ tippen und den kopierten Code im Repo unter Settings → Secrets and variables → Actions als Secret `PUSH_CONFIG` speichern. Nach Änderungen an den Lieblingsteams den Code neu kopieren.

## Bewertung

Jedes beendete Spiel bekommt eine Spannung von 0 bis 100 und daraus 1 bis 5 Balken (`src/curve.ts`, `src/rating.ts`).

**Spannungskurve**

- Für jeden Moment (MLB zu Beginn jedes Halbinnings, NBA/NFL alle 30 Sekunden) wird berechnet, wie offen das Spiel war, also wie groß der Abstand im Verhältnis zur Restzeit ist.
- In der MLB verringern Runner des zurückliegenden Teams auf Base den Abstand (aus den Play-by-Play-Daten von ESPN).
- Ohne Spielverlauf zählt nur der Endabstand.

**Gewichte**

- Schlussphase 50 %
- Verlauf 30 %
- Wendungen oder eine späte Aufholjagd 20 %; ein Gleichstand ganz am Ende (z. B. ab dem 9. Inning) zählt als halbe Wendung
- Aufholjagd extra 5 %

**Kontext**

- Playoffs +5, historische Einzelleistung +5, Rivalität +3, Topduell +3.
- Zusammen höchstens 8 Punkte, und nur bei Spielen, die ohnehin mindestens 3 Balken haben.
- Als historisch zählen No-Hitter und besondere Einzelleistungen, in der MLB auch 14 Strikeouts, 3 Home Runs, 7 RBI oder 5 Hits. Sie geben mindestens 3 Balken.

**Grenzen**

- Die Balken kommen aus festen Grenzen je Liga, kalibriert an der Saison 2025/26, sodass etwa 4 Spiele pro Woche 5 Balken bekommen.
- Sehenswert ist ein Spiel ab 3 Balken.
- Preseason-Spiele bekommen höchstens 3 Balken.
- Für Spannendes (ab 4 Balken), Rivalitäten, Playoffs und Topduelle gibt es je mehrere Labels.

Herleitung, Backtests und verworfene Varianten stehen im Projektordner unter `docs/` (vor allem `backtest-spannungskurve.md` und `backtest-aufholjagd.md`; `bewertung.md` beschreibt noch die ältere Logik vom 8. Oktober 2026).

## Daten und Aktualität

- Daten kommen direkt im Browser von der inoffiziellen ESPN-API. Für die Links zum Ansehen zusätzlich vom Spielplan der MLB-API und von nba.com sowie von der YouTube-API.
- Spielpläne werden höchstens alle 5 Minuten neu geladen, Spielverläufe beendeter Spiele einmal am Tag, Tabellen höchstens alle 30 Minuten.
- Beim Zurückkehren in die App wird neu geladen. Stand man auf der aktuellen Nacht, springt die Ansicht auf die neue; ein geöffnetes Archiv bleibt stehen.
- Herunterziehen am Seitenanfang lädt ebenfalls neu, mit demselben 5-Minuten-Zwischenspeicher.
- Fertige Nächte werden im Browser gespeichert, höchstens die letzten 14.

## Wo was steht

- `src/nights.ts`: Zeitfenster, Laden der Nächte, Aufteilung von „Letzte Nacht“ (`arrangeNight`) und Gruppen von „Heute Abend“
- `src/curve.ts`: Spannungskurve (Offenheit je Moment und Kennzahlen)
- `src/rating.ts`: Bewertung (Kontext, Grenzen je Liga, spoilerfreie Gründe)
- `src/boxscore.ts`, `src/BoxSheet.tsx`: Boxscore aus der ESPN-Spielzusammenfassung und die Ansicht dazu
- `src/standings.ts`, `src/StandingsView.tsx`: Tabellen von ESPN, Wild Card und die Ansicht dazu
- `src/config.ts`: Standard-Lieblingsteams, Rivalitäten, Grenze für Top-Matchups
- `src/teams.ts`: feste Teamliste für „Meine Teams“
- `src/favorites.ts`: Lieblingsteams laden, speichern und Spielen zuordnen
- `src/watch.ts`, `src/WatchMenu.tsx`: Links zu Highlights und zum ganzen Spiel, Play-Knopf mit Menü

## Entwicklung

```sh
npm install
npm run dev     # lokal starten
npm test        # Logik prüfen
npm run build   # nach dist/ bauen
```

Jeder Push auf `main` wird über GitHub Actions auf GitHub Pages veröffentlicht.
