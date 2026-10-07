// Feste Teamliste für „Meine Teams“, damit die Auswahl ohne Netzabfrage funktioniert.
import type { League } from './types';

export interface TeamInfo {
  league: League;
  name: string;
  /** Spitzname, über den das Team in ESPN-Daten gefunden wird */
  short: string;
  abbr: string;
  color: string;
  logo: string;
}

// [Name, Spitzname, ESPN-Kürzel, Farbe]
type Row = [string, string, string, string];

const MLB: Row[] = [
  ['Arizona Diamondbacks', 'Diamondbacks', 'ari', '#A71930'], ['Athletics', 'Athletics', 'ath', '#003831'],
  ['Atlanta Braves', 'Braves', 'atl', '#CE1141'], ['Baltimore Orioles', 'Orioles', 'bal', '#DF4601'],
  ['Boston Red Sox', 'Red Sox', 'bos', '#BD3039'], ['Chicago Cubs', 'Cubs', 'chc', '#0E3386'],
  ['Chicago White Sox', 'White Sox', 'chw', '#27251F'], ['Cincinnati Reds', 'Reds', 'cin', '#C6011F'],
  ['Cleveland Guardians', 'Guardians', 'cle', '#00385D'], ['Colorado Rockies', 'Rockies', 'col', '#333366'],
  ['Detroit Tigers', 'Tigers', 'det', '#0C2340'], ['Houston Astros', 'Astros', 'hou', '#002D62'],
  ['Kansas City Royals', 'Royals', 'kc', '#004687'], ['Los Angeles Angels', 'Angels', 'laa', '#BA0021'],
  ['Los Angeles Dodgers', 'Dodgers', 'lad', '#005A9C'], ['Miami Marlins', 'Marlins', 'mia', '#00A3E0'],
  ['Milwaukee Brewers', 'Brewers', 'mil', '#12284B'], ['Minnesota Twins', 'Twins', 'min', '#002B5C'],
  ['New York Mets', 'Mets', 'nym', '#002D72'], ['New York Yankees', 'Yankees', 'nyy', '#132448'],
  ['Philadelphia Phillies', 'Phillies', 'phi', '#E81828'], ['Pittsburgh Pirates', 'Pirates', 'pit', '#27251F'],
  ['San Diego Padres', 'Padres', 'sd', '#2F241D'], ['San Francisco Giants', 'Giants', 'sf', '#FD5A1E'],
  ['Seattle Mariners', 'Mariners', 'sea', '#0C2C56'], ['St. Louis Cardinals', 'Cardinals', 'stl', '#C41E3A'],
  ['Tampa Bay Rays', 'Rays', 'tb', '#092C5C'], ['Texas Rangers', 'Rangers', 'tex', '#003278'],
  ['Toronto Blue Jays', 'Blue Jays', 'tor', '#134A8E'], ['Washington Nationals', 'Nationals', 'wsh', '#AB0003'],
];

const NBA: Row[] = [
  ['Atlanta Hawks', 'Hawks', 'atl', '#C8102E'], ['Boston Celtics', 'Celtics', 'bos', '#007A33'],
  ['Brooklyn Nets', 'Nets', 'bkn', '#000000'], ['Charlotte Hornets', 'Hornets', 'cha', '#1D1160'],
  ['Chicago Bulls', 'Bulls', 'chi', '#CE1141'], ['Cleveland Cavaliers', 'Cavaliers', 'cle', '#860038'],
  ['Dallas Mavericks', 'Mavericks', 'dal', '#00538C'], ['Denver Nuggets', 'Nuggets', 'den', '#0E2240'],
  ['Detroit Pistons', 'Pistons', 'det', '#C8102E'], ['Golden State Warriors', 'Warriors', 'gs', '#1D428A'],
  ['Houston Rockets', 'Rockets', 'hou', '#CE1141'], ['Indiana Pacers', 'Pacers', 'ind', '#002D62'],
  ['LA Clippers', 'Clippers', 'lac', '#C8102E'], ['Los Angeles Lakers', 'Lakers', 'lal', '#552583'],
  ['Memphis Grizzlies', 'Grizzlies', 'mem', '#5D76A9'], ['Miami Heat', 'Heat', 'mia', '#98002E'],
  ['Milwaukee Bucks', 'Bucks', 'mil', '#00471B'], ['Minnesota Timberwolves', 'Timberwolves', 'min', '#0C2340'],
  ['New Orleans Pelicans', 'Pelicans', 'no', '#0C2340'], ['New York Knicks', 'Knicks', 'ny', '#006BB6'],
  ['Oklahoma City Thunder', 'Thunder', 'okc', '#007AC1'], ['Orlando Magic', 'Magic', 'orl', '#0077C0'],
  ['Philadelphia 76ers', '76ers', 'phi', '#006BB6'], ['Phoenix Suns', 'Suns', 'phx', '#1D1160'],
  ['Portland Trail Blazers', 'Trail Blazers', 'por', '#E03A3E'], ['Sacramento Kings', 'Kings', 'sac', '#5A2D81'],
  ['San Antonio Spurs', 'Spurs', 'sa', '#1D1D1D'], ['Toronto Raptors', 'Raptors', 'tor', '#CE1141'],
  ['Utah Jazz', 'Jazz', 'utah', '#002B5C'], ['Washington Wizards', 'Wizards', 'wsh', '#002B5C'],
];

const NFL: Row[] = [
  ['Arizona Cardinals', 'Cardinals', 'ari', '#97233F'], ['Atlanta Falcons', 'Falcons', 'atl', '#A71930'],
  ['Baltimore Ravens', 'Ravens', 'bal', '#241773'], ['Buffalo Bills', 'Bills', 'buf', '#00338D'],
  ['Carolina Panthers', 'Panthers', 'car', '#0085CA'], ['Chicago Bears', 'Bears', 'chi', '#0B162A'],
  ['Cincinnati Bengals', 'Bengals', 'cin', '#FB4F14'], ['Cleveland Browns', 'Browns', 'cle', '#311D00'],
  ['Dallas Cowboys', 'Cowboys', 'dal', '#041E42'], ['Denver Broncos', 'Broncos', 'den', '#FB4F14'],
  ['Detroit Lions', 'Lions', 'det', '#0076B6'], ['Green Bay Packers', 'Packers', 'gb', '#203731'],
  ['Houston Texans', 'Texans', 'hou', '#03202F'], ['Indianapolis Colts', 'Colts', 'ind', '#002C5F'],
  ['Jacksonville Jaguars', 'Jaguars', 'jax', '#006778'], ['Kansas City Chiefs', 'Chiefs', 'kc', '#E31837'],
  ['Las Vegas Raiders', 'Raiders', 'lv', '#000000'], ['Los Angeles Chargers', 'Chargers', 'lac', '#0080C6'],
  ['Los Angeles Rams', 'Rams', 'lar', '#003594'], ['Miami Dolphins', 'Dolphins', 'mia', '#008E97'],
  ['Minnesota Vikings', 'Vikings', 'min', '#4F2683'], ['New England Patriots', 'Patriots', 'ne', '#002244'],
  ['New Orleans Saints', 'Saints', 'no', '#101820'], ['New York Giants', 'Giants', 'nyg', '#0B2265'],
  ['New York Jets', 'Jets', 'nyj', '#125740'], ['Philadelphia Eagles', 'Eagles', 'phi', '#004C54'],
  ['Pittsburgh Steelers', 'Steelers', 'pit', '#101820'], ['San Francisco 49ers', '49ers', 'sf', '#AA0000'],
  ['Seattle Seahawks', 'Seahawks', 'sea', '#002244'], ['Tampa Bay Buccaneers', 'Buccaneers', 'tb', '#D50A0A'],
  ['Tennessee Titans', 'Titans', 'ten', '#0C2340'], ['Washington Commanders', 'Commanders', 'wsh', '#5A1414'],
];

function build(league: League, rows: Row[]): TeamInfo[] {
  const path = league.toLowerCase();
  return rows.map(([name, short, abbr, color]) => ({
    league, name, short, abbr: abbr.toUpperCase(), color,
    logo: `https://a.espncdn.com/i/teamlogos/${path}/500/${abbr}.png`,
  }));
}

export const TEAMS: TeamInfo[] = [...build('MLB', MLB), ...build('NBA', NBA), ...build('NFL', NFL)];
