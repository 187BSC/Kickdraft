/* ===== engine_main.js ===== */
const TEAMS = {
  home: { name:'—', str:72, defense:70, attack:74, mental:72, players:10, redCards:0 },
  away: { name:'—', shortTag:'—', str:68, defense:66, attack:70, mental:68, players:10, redCards:0 }
};

// ── KADER (Platzhalter bis zur Vereinswahl) ───────────────────
const SQUAD = [
  {id:'maier',    name:'Maier', firstName:'Thomas', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'TW', positions:['TW'],         age:29, def:78, mid:40, att:30, pace:55, mental:75, ovr:74, truePotential:75, gamesPlayed:60, seed:11, value:180000},
  {id:'reiter',   name:'Reiter', firstName:'Jonas', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'AV', positions:['AV','IV'],    age:24, def:72, mid:62, att:58, pace:78, mental:68, ovr:71, truePotential:78, gamesPlayed:40, seed:23, value:220000},
  {id:'bauer',    name:'Bauer', firstName:'Lukas', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'IV', positions:['IV','AV'],    age:27, def:80, mid:58, att:40, pace:62, mental:74, ovr:73, truePotential:74, gamesPlayed:55, seed:7,  value:260000},
  {id:'fischer',  name:'Fischer', firstName:'Felix', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,  pos:'IV', positions:['IV'],         age:31, def:79, mid:52, att:38, pace:58, mental:77, ovr:72, truePotential:72, gamesPlayed:60, seed:31, value:200000},
  {id:'gruber',   name:'Gruber', firstName:'Leon', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'AV', positions:['AV','OM'],    age:23, def:69, mid:66, att:62, pace:80, mental:65, ovr:70, truePotential:79, gamesPlayed:30, seed:14, value:240000},
  {id:'klein',    name:'Klein', firstName:'Tim', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'ZM', positions:['ZM','OM'],    age:26, def:64, mid:74, att:66, pace:70, mental:70, ovr:72, truePotential:75, gamesPlayed:50, seed:42, value:280000},
  {id:'wagner',   name:'Wagner', firstName:'Max', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'ZM', positions:['ZM','IV'],    age:28, def:66, mid:76, att:64, pace:68, mental:76, ovr:74, truePotential:75, gamesPlayed:55, seed:5,  value:320000},
  {id:'mueller',  name:'Müller', firstName:'Ben', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'OM', positions:['OM','ZM','ST'],age:25, def:55, mid:78, att:78, pace:75, mental:72, ovr:75, truePotential:80, gamesPlayed:45, seed:19, value:380000},
  {id:'huber',    name:'Huber', firstName:'Paul', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'ZM', positions:['ZM','AV'],    age:22, def:62, mid:71, att:64, pace:72, mental:64, ovr:69, truePotential:80, gamesPlayed:25, seed:28, value:190000},
  {id:'schmidt',  name:'Schmidt', firstName:'Niklas', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,  pos:'ST', positions:['ST','OM'],    age:24, def:35, mid:68, att:80, pace:79, mental:70, ovr:76, truePotential:83, gamesPlayed:40, seed:3,  value:420000},
  {id:'braun',    name:'Braun', firstName:'Jan', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'ST', positions:['ST'],         age:29, def:32, mid:60, att:77, pace:71, mental:73, ovr:73, truePotential:74, gamesPlayed:55, seed:36, value:300000},
  {id:'roth',     name:'Roth', firstName:'Elias', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,     pos:'ST', positions:['ST','OM'],    age:21, def:30, mid:62, att:71, pace:82, mental:58, ovr:67, truePotential:82, gamesPlayed:18, seed:48, value:150000},
  {id:'stark',    name:'Stark', firstName:'David', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'IV', positions:['IV'],         age:30, def:74, mid:50, att:35, pace:55, mental:71, ovr:68, truePotential:68, gamesPlayed:55, seed:9,  value:130000},
  {id:'lindner',  name:'Lindner', firstName:'Florian', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,  pos:'TW', positions:['TW'],         age:34, def:68, mid:35, att:25, pace:48, mental:69, ovr:65, truePotential:65, gamesPlayed:60, seed:50, value:60000},
  {id:'berger',   name:'Berger', firstName:'Noah', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'AV', positions:['AV','IV','ZM'],age:20, def:60, mid:58, att:55, pace:76, mental:55, ovr:64, truePotential:81, gamesPlayed:12, seed:15, value:110000},
  {id:'krause',   name:'Krause', firstName:'Stefan', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'ZM', positions:['ZM'],         age:33, def:60, mid:68, att:58, pace:54, mental:74, ovr:66, truePotential:66, gamesPlayed:60, seed:22, value:80000},
  {id:'albrecht', name:'Albrecht', firstName:'Julian', flag:'🇩🇪', country:'Deutschland', joinedSeason:1, pos:'OM', positions:['OM','ST'],    age:23, def:42, mid:69, att:69, pace:73, mental:60, ovr:68, truePotential:77, gamesPlayed:28, seed:39, value:170000},
  {id:'engel',    name:'Engel', firstName:'Moritz', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'ST', positions:['ST','OM'],    age:19, def:28, mid:58, att:65, pace:80, mental:50, ovr:63, truePotential:84, gamesPlayed:8,  seed:44, value:140000},
  {id:'vogel',    name:'Vogel', firstName:'Simon', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,    pos:'IV', positions:['IV','AV'],    age:22, def:68, mid:55, att:36, pace:64, mental:58, ovr:65, truePotential:76, gamesPlayed:20, seed:17, value:120000},
  {id:'sommer',   name:'Sommer', firstName:'Tobias', flag:'🇩🇪', country:'Deutschland', joinedSeason:1,   pos:'ZM', positions:['ZM','OM'],    age:27, def:58, mid:66, att:60, pace:66, mental:65, ovr:66, truePotential:67, gamesPlayed:50, seed:26, value:100000}
];
function getPlayer(id){ return SQUAD.find(p=>p.id===id); }

// ── FORMATIONEN (vertikales Feld, y:0=Angriff, y:100=eigenes Tor) ─
const FORMATIONS = {
  '4-4-2': [
    {id:'TW',label:'TW',group:'TW',x:50,y:90},
    {id:'LV',label:'LV',group:'AV',x:12,y:68},{id:'IV1',label:'IV',group:'IV',x:35,y:72},
    {id:'IV2',label:'IV',group:'IV',x:65,y:72},{id:'RV',label:'RV',group:'AV',x:88,y:68},
    {id:'LM',label:'LM',group:'ZM',x:12,y:42},{id:'ZM1',label:'ZM',group:'ZM',x:38,y:46},
    {id:'ZM2',label:'ZM',group:'ZM',x:62,y:46},{id:'RM',label:'RM',group:'ZM',x:88,y:42},
    {id:'ST1',label:'ST',group:'ST',x:38,y:16},{id:'ST2',label:'ST',group:'ST',x:62,y:16}
  ],
  '4-3-3': [
    {id:'TW',label:'TW',group:'TW',x:50,y:90},
    {id:'LV',label:'LV',group:'AV',x:14,y:68},{id:'IV1',label:'IV',group:'IV',x:36,y:72},
    {id:'IV2',label:'IV',group:'IV',x:64,y:72},{id:'RV',label:'RV',group:'AV',x:86,y:68},
    {id:'ZM1',label:'ZM',group:'ZM',x:30,y:48},{id:'ZM2',label:'ZM',group:'ZM',x:50,y:52},
    {id:'ZM3',label:'ZM',group:'ZM',x:70,y:48},
    {id:'LA',label:'LA',group:'ST',x:16,y:20},{id:'ST1',label:'ST',group:'ST',x:50,y:14},{id:'RA',label:'RA',group:'ST',x:84,y:20}
  ],
  '4-2-3-1': [
    {id:'TW',label:'TW',group:'TW',x:50,y:90},
    {id:'LV',label:'LV',group:'AV',x:14,y:68},{id:'IV1',label:'IV',group:'IV',x:36,y:72},
    {id:'IV2',label:'IV',group:'IV',x:64,y:72},{id:'RV',label:'RV',group:'AV',x:86,y:68},
    {id:'DM1',label:'ZM',group:'ZM',x:38,y:56},{id:'DM2',label:'ZM',group:'ZM',x:62,y:56},
    {id:'OML',label:'OM',group:'OM',x:18,y:32},{id:'OMC',label:'OM',group:'OM',x:50,y:28},{id:'OMR',label:'OM',group:'OM',x:82,y:32},
    {id:'ST1',label:'ST',group:'ST',x:50,y:12}
  ],
  '3-5-2': [
    {id:'TW',label:'TW',group:'TW',x:50,y:90},
    {id:'IV1',label:'IV',group:'IV',x:30,y:74},{id:'IV2',label:'IV',group:'IV',x:50,y:78},{id:'IV3',label:'IV',group:'IV',x:70,y:74},
    {id:'LWB',label:'LF',group:'AV',x:10,y:48},{id:'ZM1',label:'ZM',group:'ZM',x:33,y:46},{id:'ZM2',label:'ZM',group:'ZM',x:50,y:50},
    {id:'ZM3',label:'ZM',group:'ZM',x:67,y:46},{id:'RWB',label:'RF',group:'AV',x:90,y:48},
    {id:'ST1',label:'ST',group:'ST',x:38,y:16},{id:'ST2',label:'ST',group:'ST',x:62,y:16}
  ],
  '5-3-2': [
    {id:'TW',label:'TW',group:'TW',x:50,y:90},
    {id:'IV1',label:'IV',group:'IV',x:28,y:74},{id:'IV2',label:'IV',group:'IV',x:50,y:78},{id:'IV3',label:'IV',group:'IV',x:72,y:74},
    {id:'LWB',label:'LF',group:'AV',x:8,y:58},{id:'ZM1',label:'ZM',group:'ZM',x:33,y:42},{id:'ZM2',label:'ZM',group:'ZM',x:50,y:46},
    {id:'ZM3',label:'ZM',group:'ZM',x:67,y:42},{id:'RWB',label:'RF',group:'AV',x:92,y:58},
    {id:'ST1',label:'ST',group:'ST',x:38,y:16},{id:'ST2',label:'ST',group:'ST',x:62,y:16}
  ]
};

// ── VEREINS-/TAKTIK-STATE ─────────────────────────────────────
const CLUB = {
  formation:'4-4-2',
  lineup:{ TW:'maier', LV:'reiter', IV1:'bauer', IV2:'fischer', RV:'gruber', LM:'klein', ZM1:'wagner', ZM2:'mueller', RM:'huber', ST1:'schmidt', ST2:'braun' },
  tactics:{ mentality:0, pressing:50, tempo:50, width:50, passstyle:'kurz' },
  selected:null,
  budget:120000,       // Transferbudget: Käufe, Infrastruktur, Investitionen
  wageCap:25000,       // Gesamtes Wochengehaltslimit (fest, steigt durch Sponsoren/Freikauf)
  wageBudget:25000,    // Freies Gehaltsbudget = wageCap - laufende Gehälter (sinkt bei Spielerkauf)
  transferHistory:[],
  facilities:{ youth:1, training:1, scouting:1, stadium:1, merchandising:1 },
  scouts:[], scoutedPlayers:[],
  stadiumCapacity:8000,
  sponsors:{ shirt:null, stadium:null },
  ticketLevel:0,
  seasonTicketLevel:0,
  bannerSlotsSold:null,
  savings:0,
  portfolio:{},
  news:[],
  name: '',
  shortName: '',
  leagueName: 'Regionalliga Nordost'
};
function clubName()  { return CLUB.name      || '—'; }
function clubShort() { return CLUB.shortName  || '—'; }

// ── SAISON → JAHR ──────────────────────────────────────────────
// Saison 1 entspricht der Spielzeit 2026/27, Saison 2 = 2027/28, usw.
// (Eine Fußball-Saison läuft über zwei Kalenderjahre.)
const SEASON_BASE_YEAR = 2026;
function seasonStartYear(season) { return SEASON_BASE_YEAR + ((season || 1) - 1); }
// "2026/27" — übliche Manager-Schreibweise
function seasonYearLabel(season) {
  const y = seasonStartYear(season);
  return y + '/' + String((y + 1) % 100).padStart(2, '0');
}
// Für Verträge "bis 2028" (Vertragsende = Sommer des Folgejahres der Saison)
function seasonEndYear(season) { return seasonStartYear(season) + 1; }
function makeShortName(name) {
  const skip = new Set(['FC','SV','TSV','VfL','VfB','SC','SpVgg','SSV','TuS','FSV','BSC','1.','II','03','93','04','05','06','07','08','09','1860','1846','96','07']);
  const words = name.trim().split(/[\s\-\/]+/);
  const meaningful = words.filter(w => !skip.has(w) && w.length > 1 && !/^\d+$/.test(w));
  if (meaningful.length === 0) return words.map(w=>w[0]).join('').toUpperCase().slice(0,4);
  if (meaningful.length === 1) return meaningful[0].slice(0,4).toUpperCase();
  return meaningful.map(w=>w[0]).join('').toUpperCase().slice(0,4);
}
const MENTALITY_OPTS = [{v:-2,l:'Sehr def.'},{v:-1,l:'Defensiv'},{v:0,l:'Ausgegl.'},{v:1,l:'Offensiv'},{v:2,l:'Sehr off.'}];
const PASSSTYLE_OPTS = [{v:'kurz',l:'Kurzpass'},{v:'mix',l:'Gemischt'},{v:'lang',l:'Lange Bälle'}];
function mentalityLabel(v){ return (MENTALITY_OPTS.find(o=>o.v===v)||{}).l || 'Ausgeglichen'; }
function passStyleLabel(v){ return (PASSSTYLE_OPTS.find(o=>o.v===v)||{}).l || v; }

function getLineupIds(){
  // 2026-10-21 (Fehleranalyse H1/F2): nur die Plätze der aktuellen Formation – Altschlüssel anderer Formationen zählten als „in der Elf“
  const slots = (typeof FORMATIONS !== 'undefined' && CLUB && CLUB.lineup && FORMATIONS[CLUB.formation]) || null;
  if (!slots) return Object.values(CLUB.lineup || {}).filter(Boolean);
  const out = [], seen = new Set();
  slots.forEach(s => { const id = CLUB.lineup[s.id]; if (id && !seen.has(id)) { seen.add(id); out.push(id); } });
  return out;
}
function getBenchIds(){ const used = new Set(getLineupIds()); return SQUAD.filter(p=>!used.has(p.id) && !p.onLoanAt).map(p=>p.id); }
function clearFromLineup(id) { Object.keys(CLUB.lineup).forEach(slot => { if(CLUB.lineup[slot]===id) CLUB.lineup[slot]=null; }); }
function initials(name){ return name.slice(0,2).toUpperCase(); }

// ── FORMATION WECHSELN (Spieler werden nach Positionsgruppe neu zugeordnet) ─
function computeTeamRatings() {
  // Robust: Slots, die auf abgegangene Spieler zeigen (getPlayer → undefined),
  // dürfen nicht crashen und den Schnitt nicht verfälschen.
  const players = getLineupIds().map(getPlayer).filter(Boolean);
  const n = Math.max(1, players.length);
  let att=0, def=0, ment=0, ovr=0;
  players.forEach(p => { att+=(p.att||0); def+=(p.def||0); ment+=(p.mental||0); ovr+=(p.ovr||0); });
  att/=n; def/=n; ment/=n; ovr/=n;
  // Kapitäns-Bonus: steht der designierte Kapitän in der Startelf, hebt seine Führung
  // die mentale Stärke des Teams leicht an (+3 Mentalität).
  const captainInLineup = CLUB.captainId && players.some(p => p && p.id === CLUB.captainId);
  if (captainInLineup) ment += 3;
  // Hinweis: Der taktische Einfluss (Formation/Regler/Kader) läuft jetzt über das
  // Taktik-System (tactics_ui.js → momentumToProbs). Die alten 5 Regler wurden entfernt,
  // daher hier KEINE att/def-Verschiebung mehr aus CLUB.tactics.
  return {
    attack:Math.round(Math.max(30,Math.min(95,att))),
    defense:Math.round(Math.max(30,Math.min(95,def))),
    mental:Math.round(Math.max(30,Math.min(95,ment))),
    overall:Math.round(Math.max(30,Math.min(95,ovr)))
  };
}

let homeLineupPlayers = []; // echte Spieler-Objekte der aktuellen Startelf (für Tor-/Karten-Statistik)
function rebuildHomePlayerNames() {
  const xi = getLineupIds().map(getPlayer).filter(Boolean);
  const gk = xi.find(p => p.pos === 'TW') || xi[0];
  const others = xi.filter(p => p !== gk);
  homePlayers = [gk ? gk.name : '—', ...others.map(p => p.name)];
  while (homePlayers.length < 11) homePlayers.push((others[0] && others[0].name) || (gk && gk.name) || '—');
  // Reihenfolge der Objekte parallel zu homePlayers halten: Index 0 = TW, Rest = Feldspieler
  homeLineupPlayers = gk ? [gk, ...others] : [...others];
}
// Liefert das Spieler-Objekt zu einem homePlayers-Index (oder null), um Tore/Karten echten Spielern zuzuordnen.
function homePlayerObjAt(idx) {
  return (homeLineupPlayers && homeLineupPlayers[idx]) ? homeLineupPlayers[idx] : null;
}

// ── APP-NAVIGATION (Top-Level Tabs & Sub-Tabs) ─────────────────
const NAME_PREFIXES = ['FC','SV','TSV','VfL','VfB','SC','SpVgg','SSV','TuS','FSV','BSC','Sportfreunde','Viktoria','Concordia','Alemannia','Wacker','Preußen','Eintracht','Fortuna','Borussia','Arminia','Rapid','Kickers','Olympia','Germania','Teutonia'];
const NAME_PLACES = ['Lindenau','Rheinfeld','Bergstadt','Nordhafen','Talheim','Waldbrück','Hohenfels','Steinbach','Marienburg','Ostendorf','Westkamp','Grünwald','Falkenau','Sonnenberg','Birkenhain','Rosenthal','Eichenfeld','Buchholz','Kreuzberg','Lichtenau','Dornbach','Holzheim','Ahlenfeld','Brückstadt','Königswald','Mühlbach','Hartenstein','Silberberg','Wiesental','Burgdorf','Lindbach','Auenstadt','Felsbach','Tannweiler','Hügelsdorf','Rotenfeld','Schwalbach','Erlental','Moosheim','Klingenberg','Wolfsbach','Eisenhofen','Rabenstein','Quellbach','Hartwald'];
let FCM_GROUP_NAME = 'Regionalliga Nordost';
const ROUND_NAMES = ['1. Hauptrunde','2. Hauptrunde','Achtelfinale','Viertelfinale','Halbfinale','Finale'];

function rndN(n){ return Math.floor(Math.random()*n); }
function pickRnd(arr){ return arr[rndN(arr.length)]; }
function shortTagOf(name){ const parts=name.trim().split(' '); return parts[parts.length-1]; }

function generateTeamName(used) {
  let name, tries=0;
  do { name = pickRnd(NAME_PREFIXES)+' '+pickRnd(NAME_PLACES); tries++; }
  while(used.has(name) && tries<500);
  used.add(name);
  return name;
}
// makeTeam(name, ovr, id)                          -> Team mit einem Gesamtwert (Regionalliga, Pools, FCM-Platzhalter)
// makeTeam(name, {def,mid,att}, id)                -> Team mit getrennten Werten; ovr = Durchschnitt
function makeTeam(name, rating, id) {
  let def, mid, att, ovr;
  if (rating && typeof rating === 'object') {
    def = rating.def; mid = rating.mid; att = rating.att;
    ovr = Math.round((def + mid + att) / 3);
  } else {
    ovr = rating; def = rating; mid = rating; att = rating;
  }
  return { id, name, ovr, def, mid, att, pts:0, played:0, w:0, d:0, l:0, gf:0, ga:0 };
}
function makeTeamPool(n, lo, hi, idPrefix, used) {
  const arr = [];
  for(let i=0;i<n;i++){ arr.push(makeTeam(generateTeamName(used), lo+rndN(hi-lo+1), idPrefix+'_'+i)); }
  return arr;
}

function generateRoundRobin(teamIds) {
  const n = teamIds.length;
  let arr = [...teamIds];
  const half = n/2;
  const firstHalf = [];
  for(let r=0;r<n-1;r++){
    const round = [];
    for(let i=0;i<half;i++){
      const home = arr[i], away = arr[n-1-i];
      round.push(r%2===0 ? [home,away] : [away,home]);
    }
    firstHalf.push(round);
    const last = arr.pop();
    arr.splice(1,0,last);
  }
  return [...firstHalf, ...firstHalf.map(round => round.map(([h,a]) => [a,h]))];
}

function computeTable(teams) {
  return [...teams].map(t => ({...t, gd:t.gf-t.ga}))
    .sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || a.name.localeCompare(b.name));
}
function recordResult(teams, homeId, awayId, gh, ga) {
  const home = teams.find(t=>t.id===homeId), away = teams.find(t=>t.id===awayId);
  home.played++; away.played++;
  home.gf+=gh; home.ga+=ga; away.gf+=ga; away.ga+=gh;
  let hR, aR;
  if(gh>ga){ home.w++; home.pts+=3; away.l++; hR='W'; aR='L'; }
  else if(gh<ga){ away.w++; away.pts+=3; home.l++; hR='L'; aR='W'; }
  else { home.d++; away.d++; home.pts+=1; away.pts+=1; hR='D'; aR='D'; }
  // Form-Historie (letzte 5) für die Tabellen-Form-Spalte
  if(!Array.isArray(home.form)) home.form=[]; if(!Array.isArray(away.form)) away.form=[];
  home.form.push(hR); if(home.form.length>5) home.form.shift();
  away.form.push(aR); if(away.form.length>5) away.form.shift();
}
function poissonSample(lambda) {
  const L = Math.exp(-lambda); let k=0, p=1;
  do { k++; p*=Math.random(); } while(p>L);
  return k-1;
}
// Akzeptiert entweder Zahlen (OVR) oder Team-Objekte mit {def,mid,att,ovr}.
// Bei Team-Objekten fließt Heim-Angriff vs. Auswärts-Abwehr (und umgekehrt) ein,
// das Mittelfeld bestimmt die Spielkontrolle. Reine Zahlen nutzen den alten OVR-Vergleich.
function ratingsOf(x) {
  if (x && typeof x === 'object') {
    const ovr = x.ovr != null ? x.ovr : Math.round(((x.def||60)+(x.mid||60)+(x.att||60))/3);
    return { def: x.def != null ? x.def : ovr, mid: x.mid != null ? x.mid : ovr, att: x.att != null ? x.att : ovr, ovr };
  }
  return { def:x, mid:x, att:x, ovr:x };
}
function quickSimResult(home, away) {
  const H = ratingsOf(home), A = ratingsOf(away);
  // Erwartete Tore Heim: eigener Angriff gegen gegnerische Abwehr, +Heimvorteil, +Mittelfeldkontrolle
  const midEdgeH = (H.mid - A.mid) / 30;       // Mittelfeldhoheit verschiebt Chancen
  const homeAdv  = 4;                           // Heimbonus (wie zuvor in OVR-Punkten)
  const attDiffH = (H.att - A.def) + homeAdv + midEdgeH*6;
  const attDiffA = (A.att - H.def) - midEdgeH*6;
  const lambdaH = Math.max(0.25, 1.35 + attDiffH/24);
  const lambdaA = Math.max(0.20, 1.05 + attDiffA/28);
  return [poissonSample(lambdaH), poissonSample(lambdaA)];
}

// ── PYRAMIDE AUFBAUEN ───────────────────────────────────────────
// ── KALENDER ─────────────────────────────────────────────────
// Saison = 52 Kalenderwochen. KW1 = 1. Juli-Woche 2026.
// Wir rechnen mit absoluten Saisonwochen 1..52 und mappen auf einen Kalendermonat.
const SEASON_WEEKS = 52;
// Monat je Saisonwoche (Start Juli). Index 0 = Woche 1.
function calendarMonthOfWeek(week) {
  // Woche 1 = Anfang Juli; ~4.33 Wochen/Monat
  const months = ['Juli','August','September','Oktober','November','Dezember','Januar','Februar','März','April','Mai','Juni'];
  const idx = Math.min(11, Math.floor((week-1) / (SEASON_WEEKS/12)));
  return months[idx];
}
function calendarYearOfWeek(week, startYear) {
  // Juli–Dezember = startYear, Januar–Juni = startYear+1
  const monthIdx = Math.min(11, Math.floor((week-1) / (SEASON_WEEKS/12)));
  return monthIdx >= 6 ? startYear+1 : startYear;
}
function calendarLabel(week, startYear) {
  return `KW${week} · ${calendarMonthOfWeek(week)} ${calendarYearOfWeek(week, startYear)}`;
}
// Spielfreie Wochen: Sommer-Vorbereitung (ganzer Juli), Länderspielpausen verteilt, Winterpause um Jahreswechsel
function isBreakWeek(week) {
  // Sommer-Vorbereitung: Woche 1-5 (ganzer Juli, vor Ligastart in der 1. Augustwoche),
  // Winterpause: Woche 26-27 (~Jahreswechsel), Länderspielpausen: Woche 10, 18, 34, 42
  return [1,2,3,4,5,26,27,10,18,34,42].includes(week);
}
// Transferfenster: Sommer = Wochen 1-9 (bis Ende August, Deadline = letzte Augustwoche),
// Winter = ganzer Januar (Wochen 27-30), Deadline = jeweils letzte Fensterwoche.
function transferWindowInfo(week) {
  if (week >= 1 && week <= 9)  return { open:true, type:'Sommer', deadline: week===9,  weeksLeft: 9-week,  firstWeek: week===1 };
  if (week >= 27 && week <= 30) return { open:true, type:'Winter', deadline: week===30, weeksLeft: 30-week, firstWeek: week===27 };
  return { open:false, type:null, deadline:false, weeksLeft:0, firstWeek:false };
}
// Verteilt Spieltage auf Nicht-Pausen-Wochen. Start ab Woche 6 = 1. Augustwoche
// (Juli, Wochen 1-5, bleibt für Transfers und Vorbereitungs-Testspiele frei).
function buildMatchWeeks(numMatchdays) {
  const weeks = [];
  for (let w=6; w<=SEASON_WEEKS && weeks.length<numMatchdays; w++) {
    if (!isBreakWeek(w)) weeks.push(w);
  }
  return weeks;
}
// Geburtstag (Kalenderwoche) für Spieler vergeben, falls noch keiner.
// Leitet zusätzlich einen fiktiven, zur birthWeek passenden Geburtstag (Tag + Kalendermonat) ab,
// sodass der angezeigte Monat exakt mit der Woche übereinstimmt, in der der Geburtstag gefeiert wird.
function assignBirthday(p) {
  if (!p.birthWeek) p.birthWeek = 1 + rndN(SEASON_WEEKS);
  if (!p.birthMonth || !p.birthDay) {
    // Saison-Monatsindex (0=Juli ... 11=Juni) → echter Kalendermonat (1=Januar ... 12=Dezember)
    const seasonMonthIdx = Math.min(11, Math.floor((p.birthWeek - 1) / (SEASON_WEEKS / 12)));
    const calMonth = ((seasonMonthIdx + 6) % 12) + 1; // Juli(0)→7, ..., Dezember(5)→12, Januar(6)→1, ..., Juni(11)→6
    const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31][calMonth - 1];
    // Tag deterministisch, aber gestreut aus seed/birthWeek (1..daysInMonth)
    const daySeed = ((p.seed != null ? Math.floor(p.seed * 1000) : 0) + p.birthWeek * 7) % daysInMonth;
    p.birthMonth = calMonth;
    p.birthDay = daySeed + 1;
  }
  return p.birthWeek;
}
const MONTH_NAMES_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
// ── SPIELER-STATISTIK (pro Saison) ────────────────────────────────
// Jeder Spieler trägt p.stats = { season, goals, assists, apps, yellow, red } für die laufende Saison
// sowie p.statsHistory = [{season, ...}] für vergangene Saisons.
function ensurePlayerStats(p, season) {
  if (!p.stats || p.stats.season !== season) {
    if (p.stats && p.stats.season !== season) {
      if (!p.statsHistory) p.statsHistory = [];
      // nur archivieren, wenn überhaupt etwas passiert ist
      if (p.stats.apps || p.stats.goals || p.stats.assists) p.statsHistory.push(Object.assign({}, p.stats, { ovr: p.ovr }));
    }
    p.stats = { season, goals:0, assists:0, apps:0, yellow:0, red:0 };
  }
  return p.stats;
}
function addPlayerGoal(p, season)  { if(!p) return; ensurePlayerStats(p, season).goals++; }
function addPlayerAssist(p, season){ if(!p) return; ensurePlayerStats(p, season).assists++; }
function addPlayerApp(p, season)   { if(!p) return; ensurePlayerStats(p, season).apps++; }
function addPlayerYellow(p, season){ if(!p) return; ensurePlayerStats(p, season).yellow++; }
function addPlayerRed(p, season)   { if(!p) return; ensurePlayerStats(p, season).red++; }

// ── SPERREN ───────────────────────────────────────────────────────
// p.suspendedGames = Anzahl der noch zu absolvierenden Sperrspiele (Pflichtspiele).
// p.yellowAccum    = über die Saison gesammelte Gelbe Karten für die Gelbsperre (5 = 1 Spiel).
const YELLOW_SUSPENSION_THRESHOLD = 5; // 5 Gelbe Karten → 1 Spiel Sperre
// Wertet die Karten EINES Spiels für die eigenen Spieler aus und verhängt Sperren.
// cards = G.cards (Liste mit {type, playerId, team}). Gibt eine Liste neuer Sperren zurück (für News).
function applyCardSuspensions(cards) {
  const newSuspensions = [];
  const ownCards = (cards||[]).filter(c => c.team === 'home' && c.playerId);
  // Pro Spieler: Gelbe zählen und Rot prüfen
  const perPlayer = {};
  for (const c of ownCards) {
    if (!perPlayer[c.playerId]) perPlayer[c.playerId] = { yellow:0, red:0 };
    if (c.type === 'yellow') perPlayer[c.playerId].yellow++;
    if (c.type === 'red') perPlayer[c.playerId].red++;
  }
  for (const pid in perPlayer) {
    const p = SQUAD.find(x => x.id === pid);
    if (!p) continue;
    const info = perPlayer[pid];
    // Gelb-Rot: zwei Gelbe in einem Spiel → 1 Spiel Sperre
    if (info.yellow >= 2) {
      p.suspendedGames = (p.suspendedGames||0) + 1;
      newSuspensions.push({ name: displayName(p), reason: 'Gelb-Rote Karte', games: 1 });
    }
    // Glatt Rot → 2 Spiele Sperre
    if (info.red > 0) {
      p.suspendedGames = (p.suspendedGames||0) + 2;
      newSuspensions.push({ name: displayName(p), reason: 'Rote Karte', games: 2 });
    }
    // Einzelne Gelbe in die Saison-Sammlung (nur wenn nicht ohnehin Gelb-Rot)
    if (info.yellow === 1 && info.red === 0) {
      p.yellowAccum = (p.yellowAccum||0) + 1;
      if (p.yellowAccum >= YELLOW_SUSPENSION_THRESHOLD) {
        p.suspendedGames = (p.suspendedGames||0) + 1;
        p.yellowAccum = 0; // Zähler nach Sammelsperre zurücksetzen
        newSuspensions.push({ name: displayName(p), reason: `${YELLOW_SUSPENSION_THRESHOLD}. Gelbe Karte`, games: 1 });
      }
    }
  }
  return newSuspensions;
}
// Reduziert die Sperrdauer aller gesperrten Spieler nach einem Pflichtspiel um 1.
// Gibt die Liste der Spieler zurück, deren Sperre damit ABGELAUFEN ist (für News).
function decrementSuspensions() {
  const freed = [];
  for (const p of SQUAD) {
    if (p.suspendedGames && p.suspendedGames > 0) {
      p.suspendedGames--;
      if (p.suspendedGames === 0) freed.push(displayName(p));
    }
  }
  return freed;
}
function isSuspended(p) { return !!(p && p.suspendedGames && p.suspendedGames > 0); }

// ── VERLETZUNGEN ──────────────────────────────────────────────────
// p.injuryWeeks = Anzahl Wochen, die der Spieler noch ausfällt. p.injuryType = Beschreibung.
// ERWEITERT: vorher sechs Typen mit maximal 9 Wochen — eine Saison-Aus-
// Verletzung gab es gar nicht. Jetzt reicht die Spanne von der Prellung bis zum
// Kreuzbandriss. Die Gewichte sind so gesetzt, dass die schweren Fälle selten
// bleiben: unter allen Verletzungen entfallen rund 70 % auf höchstens vier
// Wochen, gut 5 % auf zwei Monate und mehr, und der Kreuzbandriss trifft mit
// 1,5 % etwa alle zehn Spielzeiten einmal.
const INJURY_TYPES = [
  { name:'Prellung',            minW:1,  maxW:2,  w:26 },
  { name:'Muskelzerrung',       minW:2,  maxW:4,  w:20 },
  { name:'Gehirnerschütterung', minW:1,  maxW:3,  w:6  },
  { name:'Bänderdehnung',       minW:3,  maxW:5,  w:13 },
  { name:'Knöchelverletzung',   minW:3,  maxW:6,  w:10 },
  { name:'Adduktorenzerrung',   minW:3,  maxW:6,  w:8  },
  { name:'Muskelfaserriss',     minW:4,  maxW:7,  w:7  },
  { name:'Knieverletzung',      minW:5,  maxW:9,  w:4  },
  { name:'Schambeinentzündung', minW:6,  maxW:11, w:2.4 },
  { name:'Zehenbruch',          minW:7,  maxW:10, w:1.8 },
  { name:'Mittelfußbruch',      minW:8,  maxW:14, w:1.2 },
  { name:'Syndesmosebandriss',  minW:39, maxW:52, w:0.6 },   // 2026-10-22 (Nutzer): 9–12 Monate
  { name:'Achillessehnenriss',  minW:30, maxW:39, w:0.4 },   // 2026-10-22 (Nutzer): 7–9 Monate mit Reha
  { name:'Kreuzbandriss',       minW:39, maxW:52, w:1.6 }    // 2026-10-22 (Nutzer): 9–12 Monate
];
// Ab wie vielen Wochen gilt eine Verletzung als schwer (eigene Meldung)
const SCHWERE_VERLETZUNG_AB = 10;
// Wie viele Spieler dürfen gleichzeitig ausfallen, bevor das Schicksal Gnade
// zeigt? Fünf Verletzte auf einmal sind rechnerisch möglich, fühlen sich aber
// wie eine Schikane an — ab drei sinkt das Risiko deutlich, ab sechs ist Schluss.
const VERLETZUNGS_DECKEL = { weichAb: 3, hartAb: 6, daempfung: 0.45 };
function verletzteImKader() {
  try { return SQUAD.filter(p => typeof isInjured === 'function' && isInjured(p)).length; }
  catch (e) { return 0; }
}
// Faktor auf jedes Verletzungsrisiko: Lazarett-Deckel und Fitness zusammen.
// Ein müder Spieler verletzt sich eher — dadurch bekommt die Fitnessleiste
// Bedeutung: Wer sie ignoriert, zahlt dafür.
function verletzungsRisikoFaktor(p) {
  const offen = verletzteImKader();
  if (offen >= VERLETZUNGS_DECKEL.hartAb) return 0;
  let f = 1;
  if (offen >= VERLETZUNGS_DECKEL.weichAb) {
    f *= Math.pow(VERLETZUNGS_DECKEL.daempfung, offen - VERLETZUNGS_DECKEL.weichAb + 1);
  }
  const fit = (p && typeof p.fitness === 'number') ? p.fitness : 95;
  if (fit < 80) f *= 1 + (80 - fit) * 0.018;        // bei Fitness 40 rund 1,7×
  if (typeof window.traitVerletzungsFaktor === 'function') f *= window.traitVerletzungsFaktor(p);
  return f;
}
// Verletzt einen Spieler zufällig (Schwere gewichtet zu leichteren Verletzungen). Gibt Infos zurück.
function injurePlayer(p) {
  if (!p) return null;
  // Gewichtung über die Tabelle — so lässt sich ein Typ ergänzen, ohne die
  // Schwellen von Hand nachzurechnen.
  const gesamt = INJURY_TYPES.reduce((s2, t) => s2 + t.w, 0);
  let r = Math.random() * gesamt;
  let type = INJURY_TYPES[0];
  for (const t of INJURY_TYPES) { r -= t.w; if (r <= 0) { type = t; break; } }
  const heilF = (typeof window.traitHeilFaktor === 'function') ? window.traitHeilFaktor(p) : 1;
  const weeks = Math.max(1, Math.round((type.minW + rndN(type.maxW - type.minW + 1)) * heilF));
  p.injuryWeeks = weeks;
  p.injuryType = type.name;
  // Verletzungsanfälligkeit zeigt sich erst, wenn es zum zweiten Mal passiert.
  p._verletzungen = (p._verletzungen || 0) + 1;
  if (p._verletzungen >= 2 && typeof window.traitAufdecken === 'function') {
    window.traitAufdecken(p, 'verletzungsanfaellig',
      'Schon die ' + p._verletzungen + '. Verletzung — das ist kein Zufall mehr.');
  }
  // Nach einer langen Pause ist niemand sofort wieder bei Kräften.
  if (weeks >= SCHWERE_VERLETZUNG_AB && typeof p.fitness === 'number') {
    p.fitness = Math.min(p.fitness, 55);
  }
  return { name: displayName(p), type: type.name, weeks, schwer: weeks >= SCHWERE_VERLETZUNG_AB };
}
// Heilt alle verletzten Spieler um eine Woche. Gibt die Liste der wieder fitten Spieler zurück.
function healInjuriesOneWeek() {
  const recovered = [];
  for (const p of SQUAD) {
    if (p.injuryWeeks && p.injuryWeeks > 0) {
      p.injuryWeeks--;
      if (p.injuryWeeks === 0) { recovered.push(displayName(p)); p.injuryType = null; }
    }
  }
  return recovered;
}
function isInjured(p) { return !!(p && p.injuryWeeks && p.injuryWeeks > 0); }
// Verfügbarkeit: nicht aufstellbar, wenn verletzt oder gesperrt.
function isAvailable(p) { return !isInjured(p) && !isSuspended(p); }

// ── LIGAWEITE TORSCHÜTZENLISTE ────────────────────────────────────
// Eigene Spieler steuern ihre echten Tore bei. KI-Vereine haben keine echten Spieler,
// daher werden pro KI-Verein der eigenen Gruppe stabile fiktive Topscorer erzeugt, deren
// Torzahl proportional zum Saisonfortschritt (gespielte Spieltage) wächst.
function ensureAiScorers(league) {
  const grp = findFcmGroup(league);
  if (!grp) return;
  if (!league.aiScorers || league.aiScorersSeason !== league.season) {
    league.aiScorers = [];
    league.aiScorersSeason = league.season;
    grp.group.teams.forEach(t => {
      if (t.id === 'fcm') return;
      // je Verein 1-2 „Stürmer" mit einer Saison-Torquote, die zur Teamstärke passt
      const n = 1 + rndN(2);
      for (let i=0;i<n;i++) {
        const strength = (t.str || 65);
        // erwartete Saisontore: stärkere Teams haben bessere Torjäger (ca. 6-22)
        const expected = Math.max(5, Math.round((strength - 55) * 0.7) + 6 + rndN(6));
        league.aiScorers.push({
          name: generateScorerName(),
          teamName: t.name,
          teamId: t.id,
          expectedGoals: expected,
          seed: Math.random()
        });
      }
    });
  }
}
function generateScorerName() {
  const first = ['Luca','Finn','Noah','Elias','Jonas','Leon','Max','Tim','Paul','Ben','Niklas','Felix','Tom','Jan','David','Moritz','Simon','Florian','Julian','Marco','Kevin','Dennis','Robin','Nico'];
  const last  = ['Wagner','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Neumann','Schwarz','Zimmermann','Braun','Krüger','Hofmann','Hartmann','Lange','Werner','Schmitt','Köhler','Maier','Fuchs','Lehmann','Jung','Vogel','Friedrich'];
  return pickRnd(first) + ' ' + pickRnd(last);
}
// Baut die aktuelle Torschützenliste (Top N). Eigene Spieler mit echten Toren + KI-Scorer (hochgerechnet).
function buildTopScorers(league, limit) {
  ensureAiScorers(league);
  const matchdaysPlayed = league.matchday || 0;
  const totalMatchdays = maxMatchday(league) || 34;
  const progress = totalMatchdays > 0 ? Math.min(1, matchdaysPlayed / totalMatchdays) : 0;
  const list = [];
  // Eigene Spieler (echte Tore dieser Saison)
  SQUAD.forEach(p => {
    const g = (p.stats && p.stats.season === league.season) ? p.stats.goals : 0;
    const a = (p.stats && p.stats.season === league.season) ? p.stats.assists : 0;
    if (g > 0 || a > 0) list.push({ name: displayName(p), teamName: clubName(), goals: g, assists: a, own: true });
  });
  // KI-Scorer: hochgerechnet auf den Saisonfortschritt, mit etwas Streuung
  (league.aiScorers||[]).forEach(s => {
    const wobble = 1 + (s.seed - 0.5) * 0.3;
    const goals = Math.max(0, Math.round(s.expectedGoals * progress * wobble));
    if (goals > 0) list.push({ name: s.name, teamName: s.teamName, goals, assists: Math.round(goals * 0.4), own: false });
  });
  list.sort((a,b) => b.goals - a.goals || b.assists - a.assists);
  return limit ? list.slice(0, limit) : list;
}
// Geburtsjahr aus Alter und aktuellem Saisonjahr ableiten.
// Juli–Dezember (Monat 7-12) gehören zum Startjahr, Januar–Juni (1-6) zum Folgejahr.
function birthYearOf(p, league) {
  if (!league) return null;
  const startYear = league.startYear || 2026;
  const calYearOfMonth = (p.birthMonth >= 7) ? startYear : startYear + 1;
  return calYearOfMonth - (p.age || 0);
}
// Formatierter Geburtstag „14. März 2002" (Jahr nur wenn league bekannt).
function birthdayLabel(p, league) {
  if (!p || !p.birthMonth || !p.birthDay) return '—';
  const monthName = MONTH_NAMES_DE[p.birthMonth - 1];
  const year = birthYearOf(p, league);
  return year != null ? `${p.birthDay}. ${monthName} ${year}` : `${p.birthDay}. ${monthName}`;
}

function buildNewPyramid() {
  const used = new Set();

  function rlTeam(name, ovr, id) { const t = makeTeam(name, ovr, id); used.add(name); return t; }

  const rlNord = [
    rlTeam('VfB Lübeck',64,'rl_n_0'), rlTeam('TSV Havelse',62,'rl_n_1'), rlTeam('SV Meppen',63,'rl_n_2'),
    rlTeam('Hannover 96 II',61,'rl_n_3'), rlTeam('Werder Bremen II',60,'rl_n_4'), rlTeam('Hamburg SV II',59,'rl_n_5'),
    rlTeam('FC St. Pauli II',58,'rl_n_6'), rlTeam('Holstein Kiel II',57,'rl_n_7'), rlTeam('Altona 93',55,'rl_n_8'),
    rlTeam('FC Eintracht Norderstedt',54,'rl_n_9'), rlTeam('HSC Hannover',53,'rl_n_10'), rlTeam('SV Drochtersen/Assel',53,'rl_n_11'),
    rlTeam('TuS Dassendorf',52,'rl_n_12'), rlTeam('SC Weiche Flensburg',51,'rl_n_13'), rlTeam('Heider SV',51,'rl_n_14'),
    rlTeam('FSV Schöningen',50,'rl_n_15'), rlTeam('Phönix Lübeck',50,'rl_n_16'),
    rlTeam('Eintracht Braunschweig II',52,'rl_n_17'),
  ];
  const rlNordost = [
    rlTeam('1. FC Lokomotive Leipzig',67,'rl_no_0'), rlTeam('FC Carl Zeiss Jena',65,'rl_no_1'), rlTeam('FC Rot-Weiß Erfurt',64,'rl_no_2'),
    rlTeam('Hallescher FC',63,'rl_no_3'), rlTeam('BFC Dynamo',61,'rl_no_4'), rlTeam('VSG Altglienicke',59,'rl_no_5'),
    rlTeam('Greifswalder FC',58,'rl_no_6'), rlTeam('Hertha BSC II',57,'rl_no_7'), rlTeam('SV Babelsberg 03',56,'rl_no_8'),
    rlTeam('1. FC Magdeburg II',55,'rl_no_9'), rlTeam('FC Energie Cottbus II',54,'rl_no_10'), rlTeam('Chemie Leipzig',53,'rl_no_11'),
    rlTeam('BFC Preussen',53,'rl_no_12'), rlTeam('FC Eilenburg',51,'rl_no_13'), rlTeam('FSV Luckenwalde',51,'rl_no_14'),
    rlTeam('ZFC Meuselwitz',50,'rl_no_15'), rlTeam('Hertha 03 Zehlendorf',50,'rl_no_16'),
    rlTeam('SV Tasmania Berlin',52,'rl_no_17'),
  ];
  const rlWest = [
    rlTeam('Rot-Weiss Essen',66,'rl_w_0'), rlTeam('Borussia Dortmund II',65,'rl_w_1'), rlTeam('Wuppertaler SV',63,'rl_w_2'),
    rlTeam('SC Fortuna Köln',62,'rl_w_3'), rlTeam('FC Schalke 04 II',60,'rl_w_4'), rlTeam('1. FC Köln II',59,'rl_w_5'),
    rlTeam('SC Preußen Münster II',59,'rl_w_6'), rlTeam('SV Rödinghausen',57,'rl_w_7'), rlTeam('Fortuna Düsseldorf II',58,'rl_w_8'),
    rlTeam('VfL Bochum II',56,'rl_w_9'), rlTeam('Bonner SC',55,'rl_w_10'), rlTeam('SC Wiedenbrück',54,'rl_w_11'),
    rlTeam('FC Gütersloh',53,'rl_w_12'), rlTeam('Sportfreunde Siegen',53,'rl_w_13'), rlTeam('SV Lippstadt 08',52,'rl_w_14'),
    rlTeam('SSVg Velbert',51,'rl_w_15'), rlTeam('TuS Haltern',50,'rl_w_16'),
    rlTeam('1. FC Bocholt',52,'rl_w_17'),
  ];
  const rlSuedwest = [
    rlTeam('SGV Freiberg',66,'rl_sw_0'), rlTeam('SV Sandhausen',65,'rl_sw_1'), rlTeam('SG Sonnenhof Großaspach',64,'rl_sw_2'),
    rlTeam('TSV Steinbach Haiger',63,'rl_sw_3'), rlTeam('FSV Frankfurt',62,'rl_sw_4'), rlTeam('Stuttgarter Kickers',61,'rl_sw_5'),
    rlTeam('FC Homburg',60,'rl_sw_6'), rlTeam('KSV Hessen Kassel',58,'rl_sw_7'), rlTeam('1. FC Saarbrücken II',57,'rl_sw_8'),
    rlTeam('FC Astoria Walldorf',55,'rl_sw_9'), rlTeam('VfR Wormatia Worms',56,'rl_sw_10'), rlTeam('SV Waldhof Mannheim II',54,'rl_sw_11'),
    rlTeam('FV Illertissen',53,'rl_sw_12'), rlTeam('TSG Balingen',51,'rl_sw_13'), rlTeam('FC Bayern Alzenau',51,'rl_sw_14'),
    rlTeam('TSV Schott Mainz',50,'rl_sw_15'), rlTeam('Bahlinger SC',50,'rl_sw_16'),
    rlTeam('Kickers Offenbach',54,'rl_sw_17'),
  ];
  const rlBayern = [
    rlTeam('Würzburger Kickers',66,'rl_b_0'), rlTeam('FC Bayern München II',65,'rl_b_1'), rlTeam('SpVgg Unterhaching',64,'rl_b_2'),
    rlTeam('Wacker Burghausen',62,'rl_b_3'), rlTeam('1. FC Nürnberg II',62,'rl_b_4'), rlTeam('FC Augsburg II',58,'rl_b_5'),
    rlTeam('SpVgg Greuther Fürth II',57,'rl_b_6'), rlTeam('TSV 1860 München II',59,'rl_b_7'), rlTeam('FC Ingolstadt 04 II',56,'rl_b_8'),
    rlTeam('VfB Eichstätt',54,'rl_b_9'), rlTeam('FC Memmingen',53,'rl_b_10'), rlTeam('Viktoria Aschaffenburg',52,'rl_b_11'),
    rlTeam('SpVgg Hankofen-Hailing',51,'rl_b_12'), rlTeam('ASV Cham',51,'rl_b_13'), rlTeam('SV Schalding-Heining',50,'rl_b_14'),
    rlTeam('FC Pipinsried',50,'rl_b_15'), rlTeam('SV Wacker Burghausen',59,'rl_b_16'),
    rlTeam('TSV Aubstadt',52,'rl_b_17'),
  ];

  const rlGroupData = {
    'Regionalliga Nord':     rlNord,
    'Regionalliga Nordost':  rlNordost,
    'Regionalliga West':     rlWest,
    'Regionalliga Südwest':  rlSuedwest,
    'Regionalliga Bayern':   rlBayern,
  };

  const rlGroups = Object.entries(rlGroupData).map(([name, teams]) => {
    return { name, teams };
  });

  function blTeam(name, rating, id) { const t = makeTeam(name, rating, id); used.add(name); return t; }

  // ── BUNDESLIGA 2026/27 ──────────────────────────────────────
  // Werte je Verein: {def=VER, mid=MIT, att=ANG}; ovr = Durchschnitt
  const blTeams = [
    blTeam('FC Bayern München',          {def:85,mid:88,att:92},'bl_0'),
    blTeam('Borussia Dortmund',          {def:82,mid:84,att:82},'bl_1'),
    blTeam('RB Leipzig',                 {def:80,mid:79,att:87},'bl_2'),
    blTeam('VfB Stuttgart',              {def:80,mid:81,att:84},'bl_3'),
    blTeam('TSG 1899 Hoffenheim',        {def:79,mid:82,att:81},'bl_4'),
    blTeam('Bayer 04 Leverkusen',        {def:81,mid:83,att:82},'bl_5'),
    blTeam('SC Freiburg',                {def:78,mid:77,att:77},'bl_6'),
    blTeam('Eintracht Frankfurt',        {def:75,mid:77,att:82},'bl_7'),
    blTeam('FC Augsburg',                {def:78,mid:76,att:75},'bl_8'),
    blTeam('1. FSV Mainz 05',            {def:75,mid:80,att:77},'bl_9'),
    blTeam('1. FC Union Berlin',         {def:74,mid:76,att:75},'bl_10'),
    blTeam('Borussia Mönchengladbach',   {def:77,mid:76,att:75},'bl_11'),
    blTeam('Hamburger SV',               {def:74,mid:72,att:73},'bl_12'),
    blTeam('1. FC Köln',                 {def:72,mid:74,att:77},'bl_13'),
    blTeam('SV Werder Bremen',           {def:71,mid:72,att:73},'bl_14'),
    blTeam('FC Schalke 04',              {def:70,mid:71,att:72},'bl_15'),
    blTeam('SV Elversberg',              {def:69,mid:68,att:72},'bl_16'),
    blTeam('SC Paderborn 07',            {def:67,mid:66,att:66},'bl_17'),
  ];
  // ── 2. BUNDESLIGA 2026/27 ───────────────────────────────────
  const bl2Teams = [
    blTeam('VfL Wolfsburg',              {def:76,mid:75,att:78},'bl2_0'),
    blTeam('1. FC Heidenheim',           {def:73,mid:72,att:71},'bl2_1'),
    blTeam('FC St. Pauli',               {def:72,mid:71,att:71},'bl2_2'),
    blTeam('Hannover 96',                {def:70,mid:70,att:69},'bl2_3'),
    blTeam('Hertha BSC',                 {def:68,mid:69,att:70},'bl2_4'),
    blTeam('SV Darmstadt 98',            {def:68,mid:69,att:69},'bl2_5'),
    blTeam('1. FC Nürnberg',             {def:68,mid:68,att:69},'bl2_6'),
    blTeam('VfL Bochum 1848',            {def:69,mid:68,att:68},'bl2_7'),
    blTeam('Karlsruher SC',              {def:67,mid:68,att:68},'bl2_8'),
    blTeam('Holstein Kiel',              {def:67,mid:67,att:66},'bl2_9'),
    blTeam('1. FC Kaiserslautern',       {def:66,mid:68,att:67},'bl2_10'),
    blTeam('Dynamo Dresden',             {def:66,mid:66,att:67},'bl2_11'),
    blTeam('Arminia Bielefeld',          {def:65,mid:66,att:66},'bl2_12'),
    blTeam('1. FC Magdeburg',            {def:65,mid:65,att:66},'bl2_13'),
    blTeam('SpVgg Greuther Fürth',       {def:64,mid:64,att:65},'bl2_14'),
    blTeam('Eintracht Braunschweig',     {def:64,mid:65,att:64},'bl2_15'),
    blTeam('VfL Osnabrück',              {def:63,mid:63,att:64},'bl2_16'),
    blTeam('FC Energie Cottbus',         {def:62,mid:62,att:63},'bl2_17'),
  ];
  // ── 3. LIGA 2026/27 ─────────────────────────────────────────
  const l3Teams = [
    blTeam('Fortuna Düsseldorf',         {def:63,mid:63,att:64},'l3_0'),
    blTeam('SC Preußen Münster',         {def:62,mid:62,att:63},'l3_1'),
    blTeam('Jahn Regensburg',            {def:61,mid:61,att:61},'l3_2'),
    blTeam('1. FC Saarbrücken',          {def:60,mid:61,att:61},'l3_3'),
    blTeam('Erzgebirge Aue',             {def:59,mid:60,att:60},'l3_4'),
    blTeam('Hansa Rostock',              {def:59,mid:59,att:59},'l3_5'),
    blTeam('MSV Duisburg',               {def:58,mid:59,att:59},'l3_6'),
    blTeam('SV Waldhof Mannheim',        {def:58,mid:58,att:58},'l3_7'),
    blTeam('SV Wehen Wiesbaden',         {def:58,mid:58,att:58},'l3_8'),
    blTeam('Alemannia Aachen',           {def:57,mid:58,att:58},'l3_9'),
    blTeam('FC Ingolstadt 04',           {def:57,mid:58,att:58},'l3_10'),
    blTeam('FC Viktoria Köln',           {def:57,mid:57,att:58},'l3_11'),
    blTeam('TSG 1899 Hoffenheim II',     {def:56,mid:57,att:57},'l3_12'),
    blTeam('VfB Stuttgart II',           {def:56,mid:56,att:56},'l3_13'),
    blTeam('SC Verl',                    {def:54,mid:54,att:54},'l3_14'),
    blTeam('Chemnitzer FC',              {def:54,mid:54,att:54},'l3_15'),
    blTeam('Rot-Weiß Oberhausen',        {def:54,mid:54,att:53},'l3_16'),
    blTeam('VfB Oldenburg',              {def:53,mid:54,att:54},'l3_17'),
    blTeam('Sportfreunde Lotte',         {def:53,mid:53,att:53},'l3_18'),
    blTeam('SpVgg Bayreuth',             {def:52,mid:53,att:53},'l3_19'),
  ];

  // ── EIGENEN VEREIN IN DIE GEWÄHLTE LIGA EINSETZEN ───────────────
  // Der Verein ersetzt den schwächsten Verein seiner Wunschliga (Größe bleibt gleich:
  // 18 in BL/2./3. Liga und in jeder Regionalliga). Funktioniert für ALLE Ligen.
  (function placeOwnClub() {
    const leagueName = CLUB.leagueName || FCM_GROUP_NAME || 'Regionalliga Nordost';
    const clubOvr = (CLUB.ownClubOvr != null) ? CLUB.ownClubOvr : 72;
    // Welche Gruppe gehört zum gewählten Liga-Namen?
    let targetTeams = null;
    if (leagueName === 'Bundesliga')        targetTeams = blTeams;
    else if (leagueName === '2. Bundesliga') targetTeams = bl2Teams;
    else if (leagueName === '3. Liga')       targetTeams = l3Teams;
    else { const rl = rlGroupData[leagueName]; targetTeams = rl || rlNordost; }
    // Existiert der gewählte Verein bereits in dieser Liga? Dann GENAU DIESEN ersetzen
    // (sonst stünde er doppelt drin — einmal als eigener Verein, einmal als Original).
    const ownName = clubName();
    let replaceIdx = targetTeams.findIndex(t => t.name === ownName);
    if (replaceIdx === -1) {
      // Erfundener Verein: schwächsten der Liga ersetzen, Ligagröße bleibt gleich.
      replaceIdx = 0;
      for (let i = 1; i < targetTeams.length; i++) {
        if (targetTeams[i].ovr < targetTeams[replaceIdx].ovr) replaceIdx = i;
      }
    }
    // Stärke: gewählten echten Verein behält seine Originalwerte, erfundener bekommt clubOvr.
    const existing = targetTeams[replaceIdx];
    const rating = (existing && existing.name === ownName)
      ? { def: existing.def, mid: existing.mid, att: existing.att }
      : clubOvr;
    targetTeams[replaceIdx] = makeTeam(ownName, rating, 'fcm');
  })();

  return {
    season: 1, matchday: 0,
    week: 1, startYear: 2026, matchWeeks: [],
    tiers: {
      bundesliga:  { name:'Bundesliga',    groups:[{ name:'Bundesliga',    teams: blTeams }] },
      bundesliga2: { name:'2. Bundesliga', groups:[{ name:'2. Bundesliga', teams: bl2Teams }] },
      liga3:       { name:'3. Liga',       groups:[{ name:'3. Liga',       teams: l3Teams }] },
      regionalliga:{ name:'Regionalliga',  groups: rlGroups }
    },
    fixtures: {}, usedNames: [...used]
  };
}
function allGroups(league) {
  const out = [];
  Object.entries(league.tiers).forEach(([tierKey, tier]) => tier.groups.forEach(group => out.push({ tierKey, tierName:tier.name, group, key: tierKey+'::'+group.name })));
  return out;
}
// Repariert geladene Spielstände mit doppelten Vereinsnamen. Zwei Fälle:
//  (a) Derselbe Verein in zwei Ligen (z.B. „Rot-Weiss Essen" einst in RL West UND 3. Liga).
//  (b) Der eigene Verein (fcm) trägt denselben Namen wie ein anderer Verein in derselben Liga
//      (alter Bug: man wählt einen bestehenden Verein, das Original blieb zusätzlich stehen).
// Der eigene Verein (fcm) wird NIE umbenannt; jeder andere Verein mit kollidierendem Namen
// bekommt ein eindeutiges Liga-Kürzel angehängt. Gibt die Anzahl der Korrekturen zurück.
function dedupePyramidNames(league) {
  const seen = new Map(); // name → true
  let fixed = 0;
  // 1. Durchlauf: ALLE fcm-Namen zuerst reservieren, damit sie unabhängig von der
  //    Reihenfolge Vorrang haben und jeder gleichnamige Nicht-fcm-Verein umbenannt wird.
  for (const { group } of allGroups(league)) {
    for (const t of group.teams) {
      if (t && t.name && t.id === 'fcm') seen.set(t.name, true);
    }
  }
  // 2. Durchlauf: alle Nicht-fcm-Vereine eindeutig machen.
  for (const { group, tierName } of allGroups(league)) {
    for (const t of group.teams) {
      if (!t || !t.name || t.id === 'fcm') continue;
      if (seen.has(t.name)) {
        const tag = (tierName || group.name || '').replace(/[^A-Za-zÄÖÜäöü0-9]/g,'').slice(0,4) || 'X';
        let newName = `${t.name} (${tag})`;
        let n = 2;
        while (seen.has(newName)) { newName = `${t.name} (${tag}${n})`; n++; }
        t.name = newName;
        seen.set(newName, true);
        fixed++;
      } else {
        seen.set(t.name, true);
      }
    }
  }
  return fixed;
}

// ── DATEN-IMPORT (clubs.json + players.json) ────────────────────
// GAME_DATA wird (falls vorhanden) von der App vor dem Spielstart gesetzt:
//   GAME_DATA = { clubs:[...], players:[...] }
// Ist es gesetzt, baut die Pyramide aus echten Vereinen; sonst greift buildNewPyramid().
let GAME_DATA = null;

// Regionalliga als schlanker Unterbau: je 10 Vereine (Nutzer 2026-10-15), Vierfachrunde = 36 Spieltage (generateAllFixtures)
const LEAGUE_SIZES = { 'Bundesliga':18, '2. Bundesliga':18, '3. Liga':20,
  'Regionalliga Nord':10, 'Regionalliga Nordost':10, 'Regionalliga West':10,
  'Regionalliga Südwest':10, 'Regionalliga Bayern':10 };
// Heimat-Regionalliga der Vereine aus Erster bis Dritter Liga (Bundesland) – dorthin geht ein Drittliga-Absteiger
const RL_HEIMAT = {
  'Regionalliga Nord':    ['hamburg','stpauli','bremen','hannover','kiel','braunschweig','wolfsburg','osnabrueck','sv_meppen','tsv_havelse'],
  'Regionalliga Nordost': ['union','hertha','leipzig','dresden','magdeburg','cottbus','hansa_rostock','1_fc_lokomotive_leipzig','fc_carl_zeiss_jena'],
  'Regionalliga West':    ['dortmund','schalke','leverkusen','koeln','gladbach','bochum','bielefeld','paderborn','fortuna_duesseldorf',
                           'preussen_muenster','msv_duisburg','rot_weiss_essen','alemannia_aachen','sc_verl','viktoria_koeln','fortuna_koeln'],
  'Regionalliga Südwest': ['stuttgart','frankfurt','hoffenheim','freiburg','mainz','elversberg','heidenheim','darmstadt','karlsruhe',
                           'kaiserslautern','waldhof_mannheim','fc_saarbruecken','wehen_wiesbaden','sonnenhof_grossaspach'],
  'Regionalliga Bayern':  ['bayern','augsburg','nuernberg','fuerth','jahn_regensburg','fc_ingolstadt','wuerzburger_kickers']
};
const TIER_KEY_BY_LEAGUE = { 'Bundesliga':'bundesliga', '2. Bundesliga':'bundesliga2', '3. Liga':'liga3',
  'Regionalliga Nord':'regionalliga', 'Regionalliga Nordost':'regionalliga', 'Regionalliga West':'regionalliga',
  'Regionalliga Südwest':'regionalliga', 'Regionalliga Bayern':'regionalliga' };
function slugifyId(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || ('club_'+Math.random().toString(36).slice(2,7)); }

// Validiert die Rohdaten und liefert { ok, errors:[], clubs:[], playersByClub:{} }.
function validateGameData(data){
  const errors = [];
  if (!data || typeof data!=='object') return { ok:false, errors:['Keine Daten übergeben.'], clubs:[], playersByClub:{} };
  const clubs = Array.isArray(data.clubs) ? data.clubs : [];
  const players = Array.isArray(data.players) ? data.players : [];
  if (!clubs.length) errors.push('clubs.json enthält keine Vereine.');
  const seenIds = new Set();
  const validLeagues = Object.keys(LEAGUE_SIZES);
  const cleanClubs = [];
  // Spieleranzahl je Vereins-ID (um bei Duplikaten die Instanz MIT Kader zu behalten)
  const playerCount = {};
  players.forEach(p => { const cid = p && p.clubId; if (cid) playerCount[cid] = (playerCount[cid]||0)+1; });
  clubs.forEach((c,i)=>{
    if (!c || !c.name){ errors.push(`Verein #${i}: "name" fehlt.`); return; }
    let id = c.id ? slugifyId(c.id) : slugifyId(c.name);
    if (seenIds.has(id)){
      // Duplikat: NICHT umbenennen (erzeugt Geistervereine in zwei Ligen),
      // sondern verwerfen. Falls die neue Instanz die Liga mit Spielerdaten ist
      // (z.B. 3. Liga statt Regionalliga), ersetzt sie den früheren Eintrag.
      const prevIdx = cleanClubs.findIndex(x => x.id === id);
      const hasPlayers = (playerCount[id]||0) > 0;
      const prevLeagueRank = { 'Bundesliga':4, '2. Bundesliga':3, '3. Liga':2 };
      const rank = (l)=>prevLeagueRank[l]||1;
      if (prevIdx >= 0 && hasPlayers && rank(c.league) > rank(cleanClubs[prevIdx].league)) {
        errors.push(`Doppelte Vereins-ID "${id}" (${c.name}) — behalte ${c.league}-Instanz, verwerfe ${cleanClubs[prevIdx].league}.`);
        cleanClubs.splice(prevIdx, 1);
      } else {
        errors.push(`Doppelte Vereins-ID "${id}" (${c.name}) — zweite Instanz (${c.league}) verworfen.`);
        return;
      }
    }
    seenIds.add(id);
    if (!validLeagues.includes(c.league)){ errors.push(`Verein "${c.name}": ungültige Liga "${c.league}".`); return; }
    const def=+c.def||+c.ovr||55, mid=+c.mid||+c.ovr||55, att=+c.att||+c.ovr||55;
    cleanClubs.push({ id, name:c.name, league:c.league, def, mid, att,
      stadium:c.stadium||null, capacity:+c.capacity||null,
      isReserve: (c.isReserve===true) || /\bII$/.test(String(c.name).trim()) });
  });
  // Spieler den Vereinen zuordnen
  const playersByClub = {};
  cleanClubs.forEach(c=>playersByClub[c.id]=[]);
  let orphan = 0;
  players.forEach((p,i)=>{
    if (!p || !p.name) return;
    let cid = p.clubId ? slugifyId(p.clubId) : null;
    if (!cid || !playersByClub[cid]){ orphan++; return; }
    playersByClub[cid].push(p);
  });
  if (orphan>0) errors.push(`${orphan} Spieler konnten keinem Verein zugeordnet werden (clubId prüfen).`);
  return { ok: cleanClubs.length>0, errors, clubs:cleanClubs, playersByClub };
}

// Baut die Pyramide aus echten Daten. Füllt fehlende Liga-Plätze mit generierten Vereinen auf
// und ersetzt – wie im Original – den schwächsten Verein der Wunschliga durch den eigenen Klub.
function buildPyramidFromData(data){
  const v = validateGameData(data);
  if (!v.ok) { console.warn('Daten ungültig, nutze Standard-Pyramide:', v.errors); return buildNewPyramid(); }
  const used = new Set();
  // Vereine nach Liga gruppieren
  const byLeague = {}; Object.keys(LEAGUE_SIZES).forEach(l=>byLeague[l]=[]);
  v.clubs.forEach(c=>{ byLeague[c.league].push(makeTeamFromClub(c, used)); });

  // Pro Liga auf Sollgröße auffüllen (oder kürzen)
  Object.keys(LEAGUE_SIZES).forEach(league=>{
    const target = LEAGUE_SIZES[league];
    const arr = byLeague[league];
    const prefix = TIER_KEY_BY_LEAGUE[league] + '_fill';
    let fi=0;
    while (arr.length < target){
      const t = makeTeam(generateTeamName(used), fillOvrForLeague(league), prefix+'_'+(fi++));
      used.add(t.name); arr.push(t);
    }
    if (arr.length > target) arr.length = target; // Überzählige abschneiden
  });

  // Eigenen Verein einsetzen (schwächsten der Wunschliga ersetzen)
  (function placeOwnClub(){
    const leagueName = CLUB.leagueName || FCM_GROUP_NAME || 'Regionalliga Nordost';
    const clubOvr = (CLUB.ownClubOvr != null) ? CLUB.ownClubOvr : 72;
    const arr = byLeague[leagueName] || byLeague['Regionalliga Nordost'];
    let weakest = 0;
    for (let i=1;i<arr.length;i++) if (arr[i].ovr < arr[weakest].ovr) weakest = i;
    // Falls der eigene Verein als echter Datenverein existiert, diesen zum Spieler-Klub machen
    const existingIdx = arr.findIndex(t => t.dataId && CLUB.dataClubId && t.dataId === CLUB.dataClubId);
    const idx = existingIdx !== -1 ? existingIdx : weakest;
    const keepName = existingIdx !== -1 ? arr[idx].name : clubName();
    const keepRating = existingIdx !== -1 ? {def:arr[idx].def,mid:arr[idx].mid,att:arr[idx].att} : clubOvr;
    arr[idx] = makeTeam(keepName, keepRating, 'fcm');
  })();

  const rlGroups = ['Regionalliga Nord','Regionalliga Nordost','Regionalliga West','Regionalliga Südwest','Regionalliga Bayern']
    .map(name => ({ name, teams: byLeague[name] }));

  // Spielerdaten global ablegen, damit der Squad-Import darauf zugreifen kann
  GAME_PLAYER_DATA = v.playersByClub;
  GAME_CLUB_DATA = {}; v.clubs.forEach(c=>GAME_CLUB_DATA[c.id]=c);

  return {
    season:1, matchday:0, week:1, startYear:2026, matchWeeks:[],
    tiers:{
      bundesliga:{ name:'Bundesliga', groups:[{name:'Bundesliga', teams:byLeague['Bundesliga']}] },
      bundesliga2:{ name:'2. Bundesliga', groups:[{name:'2. Bundesliga', teams:byLeague['2. Bundesliga']}] },
      liga3:{ name:'3. Liga', groups:[{name:'3. Liga', teams:byLeague['3. Liga']}] },
      regionalliga:{ name:'Regionalliga', groups:rlGroups }
    },
    fixtures:{}, usedNames:[...used]
  };
}
let GAME_PLAYER_DATA = null;  // { clubId: [rohe Spielerobjekte] }
let GAME_CLUB_DATA = null;    // { clubId: cleanClub }
function makeTeamFromClub(c, used){
  const t = makeTeam(c.name, {def:c.def,mid:c.mid,att:c.att}, 'club_'+c.id);
  t.dataId = c.id; t.stadium = c.stadium; t.capacity = c.capacity; t.isReserve = c.isReserve;
  used.add(c.name); return t;
}
function fillOvrForLeague(league){
  const r = { 'Bundesliga':[70,84], '2. Bundesliga':[62,76], '3. Liga':[52,66],
    'Regionalliga Nord':[48,62],'Regionalliga Nordost':[48,62],'Regionalliga West':[48,62],
    'Regionalliga Südwest':[48,62],'Regionalliga Bayern':[48,62] }[league] || [50,62];
  return { def:r[0]+rndN(r[1]-r[0]+1), mid:r[0]+rndN(r[1]-r[0]+1), att:r[0]+rndN(r[1]-r[0]+1) };
}

// Baut den Startkader des eigenen Vereins aus echten Spielerdaten (falls vorhanden),
// füllt auf mind. 18 Spieler mit passenden Positionen auf.
function buildSquadFromData(ownClubDataId, fallbackOvr){
  const out = [];
  const raw = (GAME_PLAYER_DATA && ownClubDataId && GAME_PLAYER_DATA[ownClubDataId]) ? GAME_PLAYER_DATA[ownClubDataId] : [];
  const usedNames = new Set();
  raw.forEach((p,i)=>{
    const player = makePlayerFromData(p, i);
    if (player){ out.push(player); usedNames.add(player.name); }
  });
  // 2026-10-22 (Nutzer: „bei Jena zum Start 39 Spieler, was vieeeel zu viel ist … bitte anpassen auf 22 maximal“):
  // die Kaderdaten bringen bis zu 40 Spieler mit (U23/Leihen) – Startkader höchstens 22, die Besten je Position zuerst
  // Positionsbedarf prüfen und auffüllen (mind. 2 TW, je genug Feldspieler, gesamt >=18)
  ensureSquadComplete(out, fallbackOvr);
  startKaderKappen(out, START_KADER_MAX);
  // 2026-10-21 (Fehleranalyse F10, Nutzer „Startverträge streuen“): gleichmäßig 1–5 Jahre, Leistungsträger länger –
  // aus den Daten liefen bis zu 13 von 33 Verträgen schon nach Saison 1 aus
  out.slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).forEach((p, i, arr) => {
    const anteil = i / Math.max(1, arr.length);
    const satz = anteil < 1 / 3 ? [3, 4, 5] : anteil < 2 / 3 ? [2, 3, 4] : [1, 2, 3];   // Leistungsträger 3–5, Mitte 2–4, Ergänzung 1–3 Jahre
    p.contractUntil = 1 + satz[i % 3];
  });
  return out;
}
const START_KADER_MAX = 22;
// Kürzt den Startkader auf max Spieler: erst die Besten je Position bis zum Grundbedarf (2 TW, 3 IV, je 2 LV/RV,
// 4 im Mittelfeld, 3 Angreifer), dann nach Stärke auffüllen; höchstens 3 Torhüter
function startKaderKappen(squad, max){
  if (squad.length <= max) return squad;
  const gruppe = p => { const k = p.pos === 'OM' ? 'ZOM' : p.pos;
    return k === 'TW' ? 'TW' : k === 'IV' ? 'IV' : (k === 'LV' || k === 'AV') ? 'LV' : k === 'RV' ? 'RV' : ['ZDM','ZM','LM','RM','ZOM','AM'].includes(k) ? 'MF' : 'ANG'; };
  const bedarf = { TW:2, IV:3, LV:2, RV:2, MF:4, ANG:3 };
  const nachStaerke = squad.slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0) || (a.age || 0) - (b.age || 0));
  const wahl = new Set(), zahl = {};
  nachStaerke.forEach(p => { const g = gruppe(p); if ((zahl[g] || 0) < (bedarf[g] || 0)) { zahl[g] = (zahl[g] || 0) + 1; wahl.add(p); } });
  for (const p of nachStaerke) {
    if (wahl.size >= max) break;
    if (wahl.has(p) || (gruppe(p) === 'TW' && (zahl.TW || 0) >= 3)) continue;
    wahl.add(p); zahl[gruppe(p)] = (zahl[gruppe(p)] || 0) + 1;
  }
  const behalten = squad.filter(p => wahl.has(p));
  squad.length = 0; behalten.forEach(p => squad.push(p));
  return squad;
}
function makePlayerFromData(p, i){
  if (!p || !p.name) return null;
  const positions = Array.isArray(p.positions) && p.positions.length ? p.positions.map(x=>x==='OM'?'ZOM':x).filter(x=>POS_LIST.includes(x)||POS_OHNE_SEITE.includes(x)) : null;
  const mainPos = (positions && positions[0]) || pickRnd(['IV','LV','RV','ZM','ZOM','ST']);
  const pos = positions ? mainPos : mainPos;
  const def = +p.def, mid = +p.mid, att = +p.att;
  const hasAreas = !isNaN(def) && !isNaN(mid) && !isNaN(att);
  const areas = hasAreas ? {def,mid,att} : areasForPos(mainPos, +p.ovr||60);
  const ovr = computeOvrFromAreas({pos:mainPos, ...areas});
  const age = +p.age || (18 + rndN(15));
  const tp = +p.truePotential || estimatePotential(ovr, age);
  const player = {
    id: 'sq_data_'+i+'_'+slugifyId(p.name),
    name: p.name, firstName: p.firstName||'', flag: p.flag||'', country: p.country||'',
    joinedSeason: 1, pos: mainPos, positions: positions || generatePositions(mainPos),
    age, ovr, truePotential: tp,
    def: areas.def, mid: areas.mid, att: areas.att,
    pace: +p.pace || paceForPos(mainPos, ovr), mental: +p.mental || (ovr - 3 + rndN(7)),
    gamesPlayed: 0, seed: Math.random(),
    value: 0, wage: 0, contractUntil: 1 + 1 + rndN(4)
  };
  player.value = computeMarketValue(player);
  player.wage = (+p.wage>0) ? roundWage(+p.wage) : weeklyWageFor(player);
  if (+p.contractUntil > 0) player.contractUntil = +p.contractUntil;
  return player;
}
function areasForPos(pos, ovr){
  // grobe Verteilung um den OVR herum je nach Position
  const o = ovr||60;
  switch(pos){
    case 'TW': return { def:o, mid:Math.max(20,o-40), att:Math.max(20,o-50) };
    case 'IV': return { def:o, mid:Math.max(20,o-22), att:Math.max(20,o-42) };
    case 'AV': return { def:o, mid:Math.max(20,o-10), att:Math.max(20,o-25) };
    case 'ZM': return { def:Math.max(20,o-12), mid:o, att:Math.max(20,o-15) };
    case 'OM': return { def:Math.max(20,o-30), mid:o, att:Math.max(20,o-8) };
    case 'ST': return { def:Math.max(20,o-45), mid:Math.max(20,o-20), att:o };
    default:   return { def:o, mid:o, att:o };
  }
}
function paceForPos(pos, ovr){ const base = {TW:45,IV:62,AV:78,ZM:70,OM:76,ST:80}[pos]||70; return clamp2(base - 5 + rndN(11), 30, 99); }
function estimatePotential(ovr, age){
  if (age<=20) return clamp2(ovr + 6 + rndN(8), ovr, 95);
  if (age<=23) return clamp2(ovr + 3 + rndN(6), ovr, 92);
  if (age<=27) return clamp2(ovr + rndN(3), ovr, 90);
  return ovr;
}
// Füllt einen Kader auf gültige Mindestbesetzung auf (>=2 TW, >=18 gesamt, alle Positionen vertreten)
function ensureSquadComplete(squad, fallbackOvr){
  const ovrBase = fallbackOvr || 60;
  // Positionen mit Seite (2026-10-18): je Seite ein Außenverteidiger mindestens doppelt; Altbestand AV zählt für beide
  const need = { TW:2, IV:4, LV:2, RV:2, ZM:4, ZOM:1, ST:3 }; // Mindestbedarf je Position
  const have = {}; POS_LIST.forEach(p=>have[p]=0);
  squad.forEach(p=>{ const k = p.pos==='OM' ? 'ZOM' : p.pos; if (k==='AV') { have.LV+=0.5; have.RV+=0.5; } else have[k]=(have[k]||0)+1; });
  let gi = 0;
  POS_LIST.forEach(pos=>{
    while ((have[pos]||0) < need[pos]){
      squad.push(makeGeneratedPlayer(pos, ovrBase, gi++));
      have[pos]++;
    }
  });
  while (squad.length < 18){ squad.push(makeGeneratedPlayer(pickRnd(['IV','ZM','LV','RV','ST']), ovrBase, gi++)); }
}
function makeGeneratedPlayer(pos, ovrBase, i){
  const ovr = clamp2(ovrBase - 6 + rndN(10), 40, 90);
  const areas = areasForPos(pos, ovr);
  const age = 18 + rndN(15);
  const p = {
    id: 'sq_fill_'+pos+'_'+i+'_'+Math.random().toString(36).slice(2,6),
    name: pickRnd(TRANSFER_SURNAMES), firstName: pickRnd(GERMAN_FIRST), flag:'', country:'',
    joinedSeason:1, pos, positions: generatePositions(pos),
    age, ovr: computeOvrFromAreas({pos, ...areas}), truePotential: estimatePotential(ovr, age),
    def:areas.def, mid:areas.mid, att:areas.att,
    pace: paceForPos(pos, ovr), mental: ovr-3+rndN(7),
    gamesPlayed:0, seed:Math.random(), value:0, wage:0, contractUntil: 1+1+rndN(4)
  };
  p.value = computeMarketValue(p); p.wage = weeklyWageFor(p);
  return p;
}
function generateAllFixtures(league) {
  allGroups(league).forEach(({ group, key, tierKey }) => {
    const ids = group.teams.map(t=>t.id);
    let f = generateRoundRobin(ids);
    // Kleine Regionalliga (≤ 10): Vierfachrunde, damit sie ungefähr so lange spielt wie die Dritte Liga (36 statt 18 Spieltage)
    if ((tierKey === 'regionalliga' || /^Regionalliga/.test(group.name || '')) && ids.length <= 10) {
      const zweite = generateRoundRobin([...ids].sort(() => Math.random() - 0.5));
      f = f.concat(zweite);
    }
    league.fixtures[key] = f;
  });
  league.matchWeeks = buildMatchWeeks(maxMatchday(league));
  generateFriendlies(league);
  // allen Spielern Geburtstage geben
  SQUAD.forEach(assignBirthday);
}

// ── VORBEREITUNG / TESTSPIELE ────────────────────────────────
// In welchen Kalenderwochen die 3 Testspiele stattfinden (Juli, vor Ligastart).
const FRIENDLY_WEEKS = [2, 3, 4];
// Erzeugt 3 Testspiele gegen zufällige Vereine aus ANDEREN Ligen als der eigenen
// Gruppe (also nie Liga-Gegner). Heim/Auswärts gemischt. Speichert sie in league.friendlies.
function generateFriendlies(league) {
  const fcmG = findFcmGroup(league);
  // Pool: alle Vereine der Pyramide, die NICHT in der eigenen Gruppe sind und nicht FCM selbst
  const pool = allGroups(league)
    .filter(g => g.key !== fcmG.key)
    .flatMap(g => g.group.teams)
    .filter(t => t.id !== 'fcm');
  // 3 verschiedene Gegner ziehen
  const chosen = [];
  const tmp = [...pool];
  for (let i = 0; i < FRIENDLY_WEEKS.length && tmp.length > 0; i++) {
    chosen.push(tmp.splice(rndN(tmp.length), 1)[0]);
  }
  league.friendlies = chosen.map((t, i) => ({
    week: FRIENDLY_WEEKS[i],
    opponentId: t.id,
    opponentName: t.name,
    opponentOvr: t.ovr,
    isHome: Math.random() < 0.5,
    played: false,
    gh: null, ga: null
  }));
}
// Liefert das fällige Testspiel der aktuellen Woche (noch nicht gespielt) oder null.
function fcmFriendlyThisWeek(league) {
  if (!league.friendlies) return null;
  return league.friendlies.find(f => f.week === league.week && !f.played) || null;
}
// Sucht das Team-Objekt eines Testspielgegners in der gesamten Pyramide.
function friendlyOpponentTeam(league, opponentId) {
  for (const g of allGroups(league)) {
    const t = g.group.teams.find(x => x.id === opponentId);
    if (t) return t;
  }
  return null;
}
// Steht in dieser Woche ein (noch nicht gespieltes) Testspiel an?
function friendlyDueThisWeek(league) { return !!fcmFriendlyThisWeek(league); }
// Ist in der aktuellen Woche ein Ligaspieltag fällig?
function matchdayDueThisWeek(league) {
  const idx = league.matchWeeks.indexOf(league.week);
  return idx === -1 ? -1 : idx; // -1 = spielfrei, sonst Spieltag-Index
}
// Eine Kalenderwoche weiter: Geburtstage, Fenster-Status; Rückgabe = Events fürs UI
function advanceWeek(league) {
  const events = [];
  if (league.week >= SEASON_WEEKS) return { events, seasonEnd:true };
  league.week++;
  // Geburtstage in dieser Woche
  SQUAD.forEach(p => {
    if (p.birthWeek === league.week) {
      p.age = (p.age||20) + 1;
      events.push({ type:'birthday', name:p.name, age:p.age });
    }
  });
  const win = transferWindowInfo(league.week);
  if (win.open && win.firstWeek) events.push({ type:'window_open', windowType:win.type });
  if (win.deadline) events.push({ type:'deadline_day', windowType:win.type });
  // Verletzungen heilen (eine Woche weniger); wieder fitte Spieler melden
  const recovered = healInjuriesOneWeek();
  recovered.forEach(name => events.push({ type:'recovered', name }));
  return { events, dueMatchdayIdx: matchdayDueThisWeek(league), break: isBreakWeek(league.week), window: win, recovered };
}
function findFcmGroup(league) { return allGroups(league).find(g => g.group.teams.some(t=>t.id==='fcm')); }

function advanceMatchday(league, fcmResult) {
  const n = league.matchday;
  allGroups(league).forEach(({ group, key }) => {
    const fixturesForGroup = league.fixtures[key];
    if (n >= fixturesForGroup.length) return;
    fixturesForGroup[n].forEach(([homeId, awayId]) => {
      if (homeId === 'fcm' || awayId === 'fcm') {
        if (fcmResult) {
          const fcmIsHomeInPair = homeId === 'fcm';
          const gh = fcmIsHomeInPair ? fcmResult.gh : fcmResult.ga;
          const ga = fcmIsHomeInPair ? fcmResult.ga : fcmResult.gh;
          recordResult(group.teams, homeId, awayId, gh, ga);
        }
        return;
      }
      const home = group.teams.find(t=>t.id===homeId), away = group.teams.find(t=>t.id===awayId);
      const [gh, ga] = quickSimResult(home, away);
      recordResult(group.teams, homeId, awayId, gh, ga);
    });
  });
  league.matchday++;
}
function fcmNextFixture(league) {
  const fcmG = findFcmGroup(league);
  const fixturesForGroup = league.fixtures[fcmG.key];
  const n = league.matchday;
  if (n >= fixturesForGroup.length) return null;
  const pair = fixturesForGroup[n].find(([h,a]) => h==='fcm' || a==='fcm');
  const isHome = pair[0]==='fcm';
  return { opponentId: isHome ? pair[1] : pair[0], isHome, matchday: n+1 };
}
function maxMatchday(league) { return Math.max(...allGroups(league).map(({key}) => league.fixtures[key].length)); }
function seasonFullyComplete(league) { return league.matchday >= maxMatchday(league); }

function runEndOfSeason(league) {
  const bl = league.tiers.bundesliga.groups[0].teams, bl2 = league.tiers.bundesliga2.groups[0].teams, l3 = league.tiers.liga3.groups[0].teams;
  const rl = league.tiers.regionalliga.groups;
  const tblBl = computeTable(bl), tblBl2 = computeTable(bl2), tblL3 = computeTable(l3);
  const blDown = tblBl.slice(-2).map(t=>t.id);
  const bl2Up = tblBl2.slice(0,2).map(t=>t.id), bl2Down = tblBl2.slice(-2).map(t=>t.id);
  const l3Up = tblL3.slice(0,2).map(t=>t.id), l3Down = tblL3.slice(-4).map(t=>t.id);
  const log = [];
  let fcmWasChampion = false;
  function moveTeam(fromArr, toArr, id) {
    const idx = fromArr.findIndex(t=>t.id===id);
    const [team] = fromArr.splice(idx,1);
    team.pts=0; team.played=0; team.w=0; team.d=0; team.l=0; team.gf=0; team.ga=0;
    toArr.push(team);
    return team;
  }
  blDown.forEach(id => { const t=moveTeam(bl, bl2, id); log.push(`${t.name} steigt aus der Bundesliga ab → 2. Bundesliga`); });
  bl2Up.forEach(id => { const t=moveTeam(bl2, bl, id); log.push(`${t.name} steigt in die Bundesliga auf!`); });
  bl2Down.forEach(id => { const t=moveTeam(bl2, l3, id); log.push(`${t.name} steigt aus der 2. Bundesliga ab → 3. Liga`); });
  l3Up.forEach(id => { const t=moveTeam(l3, bl2, id); log.push(`${t.name} steigt in die 2. Bundesliga auf!`); });
  const l3DownTeams = l3Down.map(id => l3.find(t=>t.id===id));
  l3DownTeams.forEach(t => { const idx=l3.findIndex(x=>x.id===t.id); l3.splice(idx,1); t.pts=0;t.played=0;t.w=0;t.d=0;t.l=0;t.gf=0;t.ga=0; });
  // Regionalliga (Nutzer 2026-10-15) – Aufstieg „wie in echt“: West und Südwest steigen immer auf, von Nord, Nordost und
  // Bayern nur zwei – eine direkt im jährlichen Wechsel, die anderen beiden spielen eine Relegation (Hin- und Rückspiel).
  // Wer aus einer Regionalliga hochgeht, ist zufällig; spielt der eigene Verein dort, ist es der Meister.
  // Die 4 Absteiger gehen in ihre Heimat-Regionalliga (RL_HEIMAT, dann team.rlGruppe); ist die voll (10), in eine
  // Regionalliga, die einen Aufsteiger abgegeben hat – so bleiben alle bei gleicher Größe.
  const rlNamed = n => rl.find(g => g.name === n);
  const vertreter = grp => {
    if (grp.teams.some(t => t.id === 'fcm')) return computeTable(grp.teams)[0];
    const k = grp.teams.filter(t => t.id !== 'fcm');
    return k[rndN(k.length)];
  };
  const aufGruppen = ['Regionalliga West', 'Regionalliga Südwest'].map(rlNamed).filter(Boolean);
  const rotation = ['Regionalliga Nordost', 'Regionalliga Bayern', 'Regionalliga Nord'];
  const direkt = rlNamed(rotation[(league.season || 1) % 3]);
  if (direkt) { aufGruppen.push(direkt); log.push(`${direkt.name}: Direktaufstieg in dieser Saison (Wechsel)`); }
  const [ra, rb] = rotation.filter(n => !direkt || n !== direkt.name).map(rlNamed);
  const vorab = new Map();
  if (ra && rb) {
    const A = vertreter(ra), B = vertreter(rb);
    vorab.set(ra, A); vorab.set(rb, B);
    const [h1, a1] = quickSimResult(A, B), [h2, a2] = quickSimResult(B, A);
    const ta = h1 + a2, tb = a1 + h2;
    const sieger = ta > tb ? ra : tb > ta ? rb : (Math.random() < 0.5 ? ra : rb);
    log.push(`Relegation zur 3. Liga: ${A.name} – ${B.name} ${h1}:${a1} und ${h2}:${a2}${ta === tb ? ' (Elfmeterschießen)' : ''} → ${vorab.get(sieger).name} steigt auf`);
    aufGruppen.push(sieger);
  } else if (ra || rb) aufGruppen.push(ra || rb);
  // Aufsteiger hoch (höchstens so viele wie Absteiger, damit die Ligen gleich groß bleiben)
  aufGruppen.slice(0, l3DownTeams.length).forEach(grp => {
    const auf = vorab.get(grp) || vertreter(grp);
    const upTeam = moveTeam(grp.teams, l3, auf.id);
    upTeam.rlGruppe = grp.name;
    if (upTeam.id === 'fcm') { fcmWasChampion = true; log.push(`${upTeam.name} (Meister ${grp.name}) steigt in die 3. Liga auf!`); }
    else log.push(`${upTeam.name} (${grp.name}) steigt in die 3. Liga auf!`);
  });
  // Absteiger in die Heimat-Regionalliga (oder in eine mit freiem Platz)
  const soll = Math.max(...rl.map(g => g.teams.length)) ;
  const heimatVon = t => {
    if (t.rlGruppe && rlNamed(t.rlGruppe)) return t.rlGruppe;
    const did = t.id === 'fcm' ? (typeof CLUB !== 'undefined' && CLUB && CLUB.dataClubId) : (t.dataId || String(t.id).replace(/^club_/, ''));
    for (const g of Object.keys(RL_HEIMAT)) if (did && RL_HEIMAT[g].includes(did) && rlNamed(g)) return g;
    return null;
  };
  // eigener Verein zuerst, damit er sicher in seiner Heimat-Regionalliga landet
  [...l3DownTeams].sort((x, y) => (y.id === 'fcm') - (x.id === 'fcm')).forEach(incoming => {
    let grp = rlNamed(heimatVon(incoming));
    if (!grp || grp.teams.length >= soll) grp = [...rl].sort((a, b) => a.teams.length - b.teams.length || Math.random() - 0.5)[0];
    incoming.rlGruppe = grp.name;
    grp.teams.push(incoming);
    log.push(`${incoming.name} steigt aus der 3. Liga ab → ${grp.name}`);
  });
  // ── Tabellen-Reset für ALLE Teams (nicht nur Auf-/Absteiger) ──
  // Muss NACH den Auf-/Abstiegsentscheidungen laufen, damit die Abschlusstabelle
  // noch korrekt war. Ohne diesen Reset schleppen bleibende Teams ihre Punkte mit.
  (function resetAllStandings() {
    const allTiers = league.tiers;
    Object.keys(allTiers).forEach(tierKey => {
      (allTiers[tierKey].groups || []).forEach(grp => {
        (grp.teams || []).forEach(t => {
          t.pts = 0; t.played = 0; t.w = 0; t.d = 0; t.l = 0; t.gf = 0; t.ga = 0;
          t.form = [];   // Form-Spalte (letzte 5: S/U/N) jede Saison zurücksetzen
        });
      });
    });
  })();
  league.season++; league.matchday = 0; league.fixtures = {};
  league.week = 1; league.startYear = (league.startYear||2026) + 1;
  generateAllFixtures(league);
  // Liga-Namen des eigenen Vereins nach Auf-/Abstieg aktualisieren
  try {
    const fg = findFcmGroup(league);
    if (fg) { CLUB.leagueName = fg.group.name; FCM_GROUP_NAME = fg.group.name; }
  } catch(e) { /* Verein nicht gefunden – sollte nicht passieren */ }
  return { log, fcmWasChampion };
}

// ── DFB-POKAL ────────────────────────────────────────────────
function buildCup(league) {
  const bl = league.tiers.bundesliga.groups[0].teams, bl2 = league.tiers.bundesliga2.groups[0].teams, l3 = league.tiers.liga3.groups[0].teams;
  const allRl = league.tiers.regionalliga.groups.flatMap(g => g.teams);
  const fixed = [...bl, ...bl2, ...l3].map(t => ({ id:t.id, name:t.name, ovr:t.ovr, def:t.def, mid:t.mid, att:t.att }));
  const rlPool = [...allRl];
  const drawn = [];
  for (let i=0;i<8 && rlPool.length>0;i++) { const idx=rndN(rlPool.length); const t=rlPool.splice(idx,1)[0]; drawn.push({id:t.id,name:t.name,ovr:t.ovr,def:t.def,mid:t.mid,att:t.att}); }
  const entrants = [...fixed, ...drawn];
  return {
    season: league.season, roundIndex: 0, teamsRemaining: entrants.map(t=>t.id),
    teamLookup: Object.fromEntries(entrants.map(t=>[t.id,t])), currentPairings: null,
    fcmDrawn: drawn.some(t=>t.id==='fcm'), fcmEliminatedRound: null, winnerId: null, log: []
  };
}
function pairRandomly(ids) {
  const pool = [...ids]; const pairs = [];
  // Bei ungerader Anzahl bekommt ein zufälliges Team ein Freilos (zieht direkt weiter).
  let bye = null;
  if (pool.length % 2 === 1) bye = pool.splice(rndN(pool.length), 1)[0];
  while (pool.length > 1) {
    const a = pool.splice(rndN(pool.length),1)[0], b = pool.splice(rndN(pool.length),1)[0];
    pairs.push(Math.random()<0.5 ? [a,b] : [b,a]);
  }
  // Freilos als Selbst-Paarung markieren (h===a → resolveCupRound behandelt das als automatischen Aufstieg)
  if (bye != null) pairs._bye = bye;
  return pairs;
}
function ensureRoundPairings(cup) { if (!cup.winnerId && !cup.currentPairings) cup.currentPairings = pairRandomly(cup.teamsRemaining); return cup; }
function fcmCupFixture(cup) {
  if (cup.winnerId || !cup.teamsRemaining.includes('fcm')) return null;
  ensureRoundPairings(cup);
  const pair = cup.currentPairings.find(([h,a]) => h==='fcm' || a==='fcm');
  if (!pair) return null;
  const isHome = pair[0]==='fcm', oppId = isHome ? pair[1] : pair[0];
  return { opponentId: oppId, opponent: cup.teamLookup[oppId], isHome, roundName: ROUND_NAMES[cup.roundIndex] };
}
function resolveCupRound(cup, fcmResult) {
  ensureRoundPairings(cup);
  const winners = [];
  cup.currentPairings.forEach(([h,a]) => {
    let gh, ga;
    if ((h==='fcm'||a==='fcm') && fcmResult) {
      const isHome = h==='fcm';
      gh = isHome ? fcmResult.gh : fcmResult.ga; ga = isHome ? fcmResult.ga : fcmResult.gh;
    } else { [gh, ga] = quickSimResult(cup.teamLookup[h], cup.teamLookup[a]); }
    let winner;
    if (gh === ga) {
      winner = Math.random()<0.5 ? h : a;
      cup.log.unshift(`${ROUND_NAMES[cup.roundIndex]}: ${cup.teamLookup[h].name} ${gh}:${ga} ${cup.teamLookup[a].name} (n.E. für ${cup.teamLookup[winner].name})`);
    } else {
      winner = gh>ga ? h : a;
      cup.log.unshift(`${ROUND_NAMES[cup.roundIndex]}: ${cup.teamLookup[h].name} ${gh}:${ga} ${cup.teamLookup[a].name}`);
    }
    if ((h==='fcm'||a==='fcm') && winner!=='fcm') cup.fcmEliminatedRound = ROUND_NAMES[cup.roundIndex];
    winners.push(winner);
  });
  cup.teamsRemaining = winners; 
  // Freilos-Team (bei ungerader Teamzahl) zieht ohne Spiel weiter
  if (cup.currentPairings._bye != null) {
    cup.teamsRemaining.push(cup.currentPairings._bye);
    cup.log.unshift(`${ROUND_NAMES[cup.roundIndex]}: ${cup.teamLookup[cup.currentPairings._bye].name} (Freilos)`);
  }
  cup.currentPairings = null;
  if (cup.teamsRemaining.length === 1) cup.winnerId = cup.teamsRemaining[0]; else cup.roundIndex++;
  return cup;
}
function autoResolveCupRemaining(cup) { let guard=0; while(!cup.winnerId && guard<10){ resolveCupRound(cup, null); guard++; } return cup; }

// Ist der eigene Verein raus, spielt jede übrige Runde in ihrer Kalenderwoche (2026-10-21; vorher sofort alle auf einmal).
// Läuft auch für alte Stände, in denen der Pokal schon fertig ist (dann nichts zu tun).
function cupNachholen() {
  if (typeof CUP === 'undefined' || !CUP || CUP.winnerId || (CUP.teamsRemaining || []).includes('fcm') || typeof LEAGUE === 'undefined' || !LEAGUE) return;
  let guard = 0;
  while (!CUP.winnerId && guard++ < 10 && LEAGUE.week >= cupWeekFor(CUP.roundIndex)) {
    const vorher = CUP.roundIndex; resolveCupRound(CUP, null);
    if (CUP.winnerId) addNews('cup', 'Pokalsieger: ' + CUP.teamLookup[CUP.winnerId].name, `${CUP.teamLookup[CUP.winnerId].name} gewinnt das Finale.`);
    else if (CUP.roundIndex === vorher) break;
  }
}
// Feste Kalenderwochen je Pokalrunde (realistische DFB-Pokal-Termine; fallen bis
// zum Finale mit Liga-Spieltagen zusammen → Doppelbelastungswoche mit 2 Spielen).
// Index = cup.roundIndex (0 = 1. Hauptrunde … 5 = Finale).
const CUP_ROUND_WEEKS = [8, 17, 24, 32, 40, 47];
function cupWeekFor(roundIndex) {
  return (roundIndex >= 0 && roundIndex < CUP_ROUND_WEEKS.length) ? CUP_ROUND_WEEKS[roundIndex] : (SEASON_WEEKS + 1 + roundIndex);
}
// Ist FCM (noch) im Pokal — unabhängig von der Woche (für Saisonende-Prüfung)?
function fcmInCup() { return !!(typeof CUP !== 'undefined' && CUP && fcmCupFixture(CUP)); }
// Steht das FCM-Pokalspiel GENAU DIESE Kalenderwoche an? Nur dann laden/blocken.
function cupDueThisWeek() {
  if (typeof LEAGUE === 'undefined' || !LEAGUE || !fcmInCup()) return false;
  return LEAGUE.week === cupWeekFor(CUP.roundIndex);
}

// ── ZUSTAND, PERSISTENZ, MATCH-ANBINDUNG ────────────────────────
let LEAGUE = null, CUP = null, CURRENT_FIXTURE = null, FCM_IS_HOME = true, FCM_ACHIEVEMENTS = { europaLeagueSeasons: [] };

// ═══ SPIELSTAND-VERWALTUNG (mehrere benannte Slots) ═══════════════
// Jeder Spielstand ist ein „Slot" mit eigener ID und Namen. Die vier Datenblöcke
// (Liga, Pokal, Verein, Markt) werden pro Slot gespeichert. Ein Index hält die
// Liste aller Slots und den aktiven Slot fest. Alte Einzel-Spielstände (globale
// Schlüssel) werden beim ersten Start automatisch in einen Slot migriert.
const SAVES_INDEX_KEY = 'fcm-saves-index';
let ACTIVE_SLOT_ID = null;

function slotKey(id, part) { return `fcm-save-${id}-${part}`; }
function newSlotId() { return 's_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

// Index laden: { slots:[{id,name,club,season,savedAt}], activeId }
async function loadSavesIndex() {
  try {
    const raw = await window.storage.get(SAVES_INDEX_KEY);
    if (raw && raw.value) { const idx = JSON.parse(raw.value); if (idx && Array.isArray(idx.slots)) return idx; }
  } catch(e) { /* kein Index vorhanden */ }
  return { slots: [], activeId: null };
}
async function saveSavesIndex(idx) {
  try { await window.storage.set(SAVES_INDEX_KEY, JSON.stringify(idx)); } catch(e) { console.warn('Index speichern fehlgeschlagen', e); }
}
// Metadaten des aktuellen Spielzustands für die Slot-Liste
function currentSlotMeta() {
  return {
    club: (CLUB && CLUB.name) ? CLUB.name : '—',
    season: (LEAGUE && LEAGUE.season) ? LEAGUE.season : 1,
    savedAt: Date.now()
  };
}

// Migriert einen alten Einzel-Spielstand (globale Schlüssel) in einen neuen Slot.
async function migrateLegacySaveIfAny() {
  try {
    const l = await window.storage.get('fcm-league-state');
    if (!l || !l.value) return null; // kein alter Stand
    const c  = await window.storage.get('fcm-cup-state');
    const cl = await window.storage.get('fcm-club-state');
    const mk = await window.storage.get('fcm-market-state');
    const id = newSlotId();
    let name = 'Mein Spielstand';
    try { const parsed = cl && JSON.parse(cl.value); if (parsed && parsed.club && parsed.club.name) name = parsed.club.name; } catch(e) {}
    if (l)  await window.storage.set(slotKey(id,'league'), l.value);
    if (c)  await window.storage.set(slotKey(id,'cup'), c.value);
    if (cl) await window.storage.set(slotKey(id,'club'), cl.value);
    if (mk) await window.storage.set(slotKey(id,'market'), mk.value);
    // alte globale Schlüssel entfernen, damit nicht doppelt migriert wird
    for (const k of ['fcm-league-state','fcm-cup-state','fcm-club-state','fcm-market-state']) {
      try { await window.storage.delete(k); } catch(e) {}
    }
    return { id, name };
  } catch(e) { console.warn('Migration fehlgeschlagen', e); return null; }
}

// Speichert den aktuellen Spielzustand in den aktiven Slot.
async function saveGameState() {
  try {
    // 2026-10-16: ohne laufendes Spiel nichts speichern – beim Start (vor der Vereinswahl) entstand sonst ein leerer
    // „—“-Spielstand, der einen der Plätze belegte
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return;
    if (!ACTIVE_SLOT_ID) ACTIVE_SLOT_ID = newSlotId(); // Fallback: Slot anlegen
    // Transferhistorie großzügig begrenzen, damit der Spielstand über viele
    // Saisons nicht unbegrenzt wächst (die letzten 80 Einträge reichen als Verlauf).
    if (CLUB.transferHistory && CLUB.transferHistory.length > 80) {
      CLUB.transferHistory.length = 80;
    }
    const id = ACTIVE_SLOT_ID;
    // 2026-10-21 (Fehleranalyse M5): unveränderte Teile nicht neu packen – das LZ-Packen des 2-MB-Standes kostete je Speichern 0,5–1,3 s,
    // und im Transferfenster wird mehrmals je Minute gespeichert
    if (!window._saveZuletzt || window._saveZuletzt.id !== id) window._saveZuletzt = { id };
    const Z = window._saveZuletzt;
    const teil = async (part, text) => { if (Z[part] === text) return; await window.storage.set(slotKey(id, part), text); Z[part] = text; };
    await teil('league', JSON.stringify(LEAGUE));
    await teil('cup',    JSON.stringify(CUP));
    await teil('club',   JSON.stringify({ club:CLUB, achievements:FCM_ACHIEVEMENTS, squad:SQUAD }));
    await teil('market', JSON.stringify(MARKET));
    // Index-Metadaten aktualisieren
    const idx = await loadSavesIndex();
    let slot = idx.slots.find(s => s.id === id);
    const meta = currentSlotMeta();
    if (slot) { slot.club = meta.club; slot.season = meta.season; slot.savedAt = meta.savedAt; }
    else { idx.slots.push({ id, name: meta.club || 'Spielstand', ...meta }); }
    idx.activeId = id;
    await saveSavesIndex(idx);
  } catch(e) { console.warn('Speichern fehlgeschlagen', e); }
}

// Lädt einen bestimmten Slot in den Spielzustand. Gibt true bei Erfolg.
async function loadSlot(id) {
  try {
    const l  = await window.storage.get(slotKey(id,'league'));
    const c  = await window.storage.get(slotKey(id,'cup'));
    const cl = await window.storage.get(slotKey(id,'club'));
    const mk = await window.storage.get(slotKey(id,'market'));
    if (!l || !c) return false;
    ACTIVE_SLOT_ID = id;
    applyLoadedState(JSON.parse(l.value), JSON.parse(c.value), cl ? JSON.parse(cl.value) : null, mk ? JSON.parse(mk.value) : null);
    const idx = await loadSavesIndex();
    idx.activeId = id;
    await saveSavesIndex(idx);
    return true;
  } catch(e) { console.warn('Slot laden fehlgeschlagen', e); return false; }
}

// Löscht einen Slot samt Daten.
async function deleteSlot(id) {
  for (const part of ['league','cup','club','market']) {
    try { await window.storage.delete(slotKey(id,part)); } catch(e) {}
  }
  const idx = await loadSavesIndex();
  idx.slots = idx.slots.filter(s => s.id !== id);
  if (idx.activeId === id) idx.activeId = null;
  if (ACTIVE_SLOT_ID === id) ACTIVE_SLOT_ID = null;
  await saveSavesIndex(idx);
}

// Benennt einen Slot um.
async function renameSlot(id, newName) {
  const idx = await loadSavesIndex();
  const slot = idx.slots.find(s => s.id === id);
  if (slot) { slot.name = newName; await saveSavesIndex(idx); }
}

// Legt einen neuen, leeren Slot an und macht ihn aktiv (für ein neues Spiel).
async function createNewSlot(name) {
  const id = newSlotId();
  ACTIVE_SLOT_ID = id;
  const idx = await loadSavesIndex();
  idx.slots.push({ id, name: name || 'Neuer Spielstand', club:'—', season:1, savedAt: Date.now() });
  idx.activeId = id;
  await saveSavesIndex(idx);
  return id;
}

// Serialisiert den AKTUELLEN Spielstand als ein einziges JSON-Objekt (für Export).
function exportCurrentSaveObject() {
  return {
    fcmSave: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    name: (CLUB && CLUB.name) ? CLUB.name : 'Spielstand',
    league: LEAGUE,
    cup: CUP,
    club: { club: CLUB, achievements: FCM_ACHIEVEMENTS, squad: SQUAD },
    market: MARKET
  };
}

// Importiert ein JSON-Save-Objekt als NEUEN Slot. Gibt die neue Slot-ID zurück (oder null).
async function importSaveObject(obj, suggestedName) {
  if (!obj || !obj.league || !obj.cup) { console.warn('Ungültige Spielstand-Datei'); return null; }
  // Sicherheit (2026-10-18): fremde Dateien können Namen mit HTML enthalten, die das Spiel per innerHTML zeigt –
  // alle Texte des Spielstands ohne < > und ohne Anführungszeichen übernehmen (Namen enthalten diese Zeichen nie)
  (function saeubern(o, tiefe) {
    if (!o || typeof o !== 'object' || tiefe > 40) return;
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'string') { if (/[<>"`]/.test(v)) o[k] = v.replace(/[<>"`]/g, ''); }
      else if (v && typeof v === 'object') saeubern(v, tiefe + 1);
    }
  })(obj, 0);
  const id = newSlotId();
  try {
    await window.storage.set(slotKey(id,'league'), JSON.stringify(obj.league));
    await window.storage.set(slotKey(id,'cup'),    JSON.stringify(obj.cup));
    if (obj.club)   await window.storage.set(slotKey(id,'club'),   JSON.stringify(obj.club));
    if (obj.market) await window.storage.set(slotKey(id,'market'), JSON.stringify(obj.market));
    // Sicherheit (2026-10-18): Namen aus fremden Dateien ohne HTML-Zeichen übernehmen – sie landen in Listen (innerHTML)
    const sauber = t => String(t == null ? '' : t).replace(/[<>"'`&]/g, '').slice(0, 80);
    const name = sauber(suggestedName || obj.name || (obj.club && obj.club.club && obj.club.club.name) || 'Importierter Spielstand');
    const season = (obj.league && obj.league.season) ? obj.league.season : 1;
    const club = (obj.club && obj.club.club && obj.club.club.name) ? sauber(obj.club.club.name) : '—';
    const idx = await loadSavesIndex();
    idx.slots.push({ id, name, club, season, savedAt: Date.now() });
    await saveSavesIndex(idx);
    return id;
  } catch(e) { console.warn('Import fehlgeschlagen', e); return null; }
}

// Löscht den kompletten aktiven Spielstand (für „Neu starten")
async function resetGameStorage() {
  if (ACTIVE_SLOT_ID) {
    await deleteSlot(ACTIVE_SLOT_ID);
  } else {
    // Fallback: evtl. noch alte globale Schlüssel entfernen
    for (const k of ['fcm-league-state','fcm-cup-state','fcm-club-state','fcm-market-state']) {
      try { await window.storage.delete(k); } catch(e) {}
    }
  }
}

// Wendet geladene Datenblöcke auf den globalen Spielzustand an (gemeinsam genutzt von
// loadSlot und dem alten loadGameState-Pfad). Enthält alle Backfills für alte Stände.
function applyLoadedState(leagueObj, cupObj, clubObj, marketObj) {
  LEAGUE = leagueObj; CUP = cupObj;
  if (clubObj) {
    Object.assign(CLUB, clubObj.club);
    FCM_ACHIEVEMENTS = clubObj.achievements || FCM_ACHIEVEMENTS;
    if (clubObj.squad && clubObj.squad.length) { SQUAD.length = 0; clubObj.squad.forEach(p => SQUAD.push(p)); }
  }
  if (CLUB.leagueName) FCM_GROUP_NAME = CLUB.leagueName;
  if (CLUB.name) TEAMS.home.name = CLUB.name;
  MARKET = marketObj || { players: generateMarketPool(40, LEAGUE.season) };
  if (CLUB.budget === undefined || CLUB.budget === null) CLUB.budget = defaultBudgetForTier(findFcmGroup(LEAGUE).tierKey);
  // Migration: wageCap nachrüsten; wageBudget = freie Kapazität (Cap minus laufende Gehälter).
  // Alte Spielstände hatten wageBudget evtl. als Geldtopf — hier konsequent neu als freie Kapazität.
  if (!CLUB.wageCap) CLUB.wageCap = defaultWageBudgetForTier(findFcmGroup(LEAGUE).tierKey);
  CLUB.wageBudget = Math.max(0, CLUB.wageCap - totalWeeklyWages(SQUAD));
  if (!CLUB.transferHistory) CLUB.transferHistory = [];
  if (!CLUB.facilities) CLUB.facilities = { youth:1, training:1, scouting:1, stadium:1, merchandising:1 };
  if (!CLUB.scouts) CLUB.scouts = [];
  if (!CLUB.scoutedPlayers) CLUB.scoutedPlayers = [];
  if (!CLUB.youthProspects) CLUB.youthProspects = [];
  if (CLUB.facilities.scouting === undefined) CLUB.facilities.scouting = 1;
  if (CLUB.facilities.merchandising === undefined) CLUB.facilities.merchandising = 1;   // ältere Karrieren ohne Stufe („€NaN“)
  if (!CLUB.stadiumCapacity) CLUB.stadiumCapacity = stadiumCapacityForLevel(CLUB.facilities.stadium);
  if (!CLUB.sponsors) CLUB.sponsors = { shirt:null, sleeve:null, stadium:null };
  if (!('sleeve' in CLUB.sponsors)) CLUB.sponsors.sleeve = null;   // Migration: Ärmel-Slot nachrüsten
  if (CLUB.ticketLevel === undefined || CLUB.ticketLevel === null) CLUB.ticketLevel = 0;
  if (CLUB.seasonTicketLevel === undefined || CLUB.seasonTicketLevel === null) CLUB.seasonTicketLevel = 0;
  if (CLUB.bannerSlotsSold === undefined) CLUB.bannerSlotsSold = null;
  if (CLUB.savings === undefined || CLUB.savings === null) CLUB.savings = 0;
  if (!CLUB.portfolio) CLUB.portfolio = {};
  delete CLUB.casinoStats; delete CLUB.blackjack;   // Casino entfernt (2026-10-15) – Reste alter Spielstände
  EXP.ensureState();
  ensureMarketStocks();
  if (!CLUB.sponsorOffers) refreshSponsorOffers();
  if (!CLUB.news) CLUB.news = [];
  if (!CLUB.transferBids) CLUB.transferBids = [];
  if (LEAGUE.week === undefined) LEAGUE.week = 1;
  if (LEAGUE.startYear === undefined) LEAGUE.startYear = 2026;
  if (!LEAGUE.matchWeeks || !LEAGUE.matchWeeks.length) LEAGUE.matchWeeks = buildMatchWeeks(maxMatchday(LEAGUE));
  const dupFixed = dedupePyramidNames(LEAGUE);
  if (dupFixed > 0) console.info(`Pyramide bereinigt: ${dupFixed} doppelte Vereinsnamen korrigiert.`);
  if (!LEAGUE.friendlies && LEAGUE.week <= Math.max(...FRIENDLY_WEEKS)) generateFriendlies(LEAGUE);
  if (!LEAGUE.friendlies) LEAGUE.friendlies = [];
  SQUAD.forEach(assignBirthday);
  if (CLUB.youthProspects) CLUB.youthProspects.forEach(assignBirthday);
  if (CLUB.scoutedPlayers) CLUB.scoutedPlayers.forEach(assignBirthday);
  if (MARKET && MARKET.players) MARKET.players.forEach(assignBirthday);
  assignShirtNumbers(); // fehlende Trikotnummern nachvergeben (alte Stände)
  ensureCaptain();      // Kapitän sicherstellen (alte Stände ohne captainId)
}

// Lädt den zuletzt aktiven Spielstand (oder migriert einen alten Einzel-Stand).
// Gibt true zurück, wenn ein Spielstand geladen wurde.
async function loadGameState() {
  try {
    const idx = await loadSavesIndex();
    // Alten Einzel-Stand migrieren, falls vorhanden und noch keine Slots existieren
    if (idx.slots.length === 0) {
      const migrated = await migrateLegacySaveIfAny();
      if (migrated) {
        const id2 = migrated.id;
        const idx2 = await loadSavesIndex();
        const meta = { id:id2, name:migrated.name, club:migrated.name, season:1, savedAt:Date.now() };
        idx2.slots.push(meta); idx2.activeId = id2;
        await saveSavesIndex(idx2);
        return await loadSlot(id2);
      }
      return false; // keine Spielstände vorhanden → Onboarding
    }
    // Aktiven Slot laden (oder den zuletzt gespeicherten)
    const targetId = idx.activeId || idx.slots[idx.slots.length-1].id;
    return await loadSlot(targetId);
  } catch(e) { console.warn('Kein Spielstand gefunden, starte neu.', e); }
  return false;
}
async function startNewGameState(chosenTeam) {
  if (chosenTeam) {
    CLUB.name      = chosenTeam.name;
    CLUB.shortName = chosenTeam.shortName || makeShortName(chosenTeam.name);
    CLUB.leagueName = chosenTeam.leagueName || 'Regionalliga Nordost';
    FCM_GROUP_NAME  = CLUB.leagueName;
    TEAMS.home.name = CLUB.name;
    CLUB.ownClubOvr = chosenTeam.ovr || 65;
    CLUB.dataClubId = chosenTeam.dataClubId || null; // falls aus echten Daten gewählt
    if (chosenTeam.ovr) {
      const o = chosenTeam.ovr;
      TEAMS.home.str = o; TEAMS.home.attack = o; TEAMS.home.defense = o; TEAMS.home.mental = o;
    }
  }
  // Pyramide aus echten Daten bauen, falls GAME_DATA gesetzt – sonst Standard
  LEAGUE = GAME_DATA ? buildPyramidFromData(GAME_DATA) : buildNewPyramid();
  generateAllFixtures(LEAGUE);
  CUP = buildCup(LEAGUE);
  CLUB.budget = defaultBudgetForTier(findFcmGroup(LEAGUE).tierKey);
  CLUB.wageCap = defaultWageBudgetForTier(findFcmGroup(LEAGUE).tierKey); // vorläufig, wird nach Squad-Aufbau auf laufende Kosten gesetzt
  CLUB.wageBudget = CLUB.wageCap; // wird nach Squad-Aufbau korrigiert
  // ── Startkader: aus echten Daten (falls vorhanden) oder zufällig erzeugen ──
  const targetOvr = (chosenTeam && chosenTeam.ovr) ? chosenTeam.ovr
                  : ({ bundesliga:78, bundesliga2:68, liga3:58, regionalliga:60 })[findFcmGroup(LEAGUE).tierKey] || 60;
  let newSquad;
  if (GAME_DATA && GAME_PLAYER_DATA && CLUB.dataClubId && GAME_PLAYER_DATA[CLUB.dataClubId] && GAME_PLAYER_DATA[CLUB.dataClubId].length) {
    newSquad = buildSquadFromData(CLUB.dataClubId, targetOvr);
  } else {
    newSquad = generateStartingSquad(targetOvr);
  }
  SQUAD.length = 0; newSquad.forEach(p => SQUAD.push(p));
  SQUAD.forEach(assignBirthday);
  assignShirtNumbers();  // Trikotnummern automatisch vergeben
  ensureCaptain();       // Kapitän bestimmen (stärkster Feldspieler nach Mentalität)
  autoFillLineup();
  // Wochenbudget-Limit am Spielstart = laufende Gehaltskosten des Startkaders plus 8 % Luft (2026-10-21, Nutzer: „etwas
  // Gehaltsluft zum Start“ – vorher stand bei allen Testvereinen „Gehalt frei 0 €“, ohne Verkauf ging kein Kauf). Ab der
  // zweiten Saison gilt wieder der Deckel aus den Einnahmen (bundle_economy.js, wageShareOfIncome).
  CLUB.wageCap = Math.round(totalWeeklyWages(SQUAD) * 1.08);
  CLUB.wageBudget = Math.max(0, CLUB.wageCap - totalWeeklyWages(SQUAD));
  MARKET = { players: generateMarketPool(40, LEAGUE.season) };
  ensureMarketStocks();
  CLUB.youthProspects = [];  // Akademie zum Spielstart leeren → wird mit 3 Talenten (Stufe 1) gefüllt
  generateYouthProspects();
  refreshSponsorOffers();
  EXP.ensureState();        // Erwartungs-System initialisieren
  EXP.hookSeasonStart();    // erste Philosophie ziehen, Ziele & Sponsorenauswahl setzen
  // Neue Karriere = leeres Postfach. Ohne das erbte ein frisches Spiel die
  // Meldungen des alten Spielstands — beim Start in Saison 1 standen Meldungen
  // aus Saison 4 und 5 im Postfach („Sieg: FCM 3:0 Chemie Leipzig").
  CLUB.news = [];
  addNews('season', `Willkommen bei ${clubName()}!`, `Eine neue Ära beginnt in der ${FCM_GROUP_NAME}. Im Juli stehen zunächst 3 Testspiele zur Vorbereitung an — Zeit, den Kader auf dem Transfermarkt zu verstärken. Der Ligastart folgt in der ersten Augustwoche. Führe ${clubShort()} bis in die Bundesliga und gewinne den DFB-Pokal!`);
  await saveGameState();
}

function tierLabelOf(tierKey) { return ({bundesliga:'Bundesliga (1. Liga)', bundesliga2:'2. Bundesliga', liga3:'3. Liga', regionalliga:'Regionalliga (4. Liga)'})[tierKey] || tierKey; }

function trySimulateRestOfLeagueSeason() {
  let guard=0;
  while (!seasonFullyComplete(LEAGUE) && !fcmNextFixture(LEAGUE) && guard<60) { advanceMatchday(LEAGUE, null); guard++; }
}
function clamp2(v,lo,hi){ return Math.max(lo,Math.min(hi,Math.round(v))); }
function ageFactor(age) {
  if (age <= 20) return 1.15;
  if (age <= 23) return 1.10;
  if (age <= 27) return 1.00;
  if (age <= 29) return 0.85;
  if (age <= 31) return 0.65;
  if (age <= 33) return 0.45;
  return 0.25;
}
// Marktwert-Faktor je Hauptposition. Erweitert um die neuen Positionen (AM/FL/ZDM/ZOM).
// Offensive Außen (FL) und Zehner (ZOM) sind teuer, defensives Mittelfeld (ZDM) etwas günstiger.
const POS_VALUE_FACTOR = { TW:0.55, IV:0.75, AV:0.85, LV:0.85, RV:0.85, ZDM:0.90, ZM:0.95, AM:1.05, LM:1.05, RM:1.05, OM:1.15, ZOM:1.18, FL:1.20, LF:1.20, RF:1.20, ST:1.25 };
function roundMarketValue(v) {
  if (v < 50000) return Math.round(v/2500)*2500;
  if (v < 250000) return Math.round(v/10000)*10000;
  if (v < 1000000) return Math.round(v/25000)*25000;
  if (v < 10000000) return Math.round(v/250000)*250000;
  return Math.round(v/1000000)*1000000;
}
function baseValueFromOvr(ovr) { return 700 * Math.pow(1.225, ovr - 40); }
// ── PREIS-TUNING (Marktwert) ────────────────────────────────────
// Zentrale Stellschrauben für die Bewertung. Hier anpassen.
const PRICING = {
  potential: {
    perPointBonus: 0.045,   // Aufschlag je Punkt ungenutztem Potenzial (truePotential − ovr)
    maxAge: 28,             // bis zu diesem Alter wirkt der Potenzial-Aufschlag
    youngAgeRef: 28, youngAgeSpan: 11, minYouthMultiplier: 0.3,
    wonderkid:     { potentialGap: 12, maxAge: 21, extraMultiplier: 1.45 }, // echtes Juwel
    highPotential: { potentialGap: 8,  maxAge: 23, extraMultiplier: 1.20 }  // starkes Talent
  },
  // Spieler in Bestform (Mitte 20) sind die wertvollsten "fertigen" Spieler.
  // Greift NUR, wenn kein Talent-Aufschlag kassiert wurde (kein Stapeln).
  primeBoost: [
    { minAge: 24, maxAge: 26, multiplier: 1.60 },
    { minAge: 27, maxAge: 28, multiplier: 1.45 },
    { minAge: 22, maxAge: 23, multiplier: 1.20 }
  ],
  // Zenit/Auslauf: ältere Spieler oder Spieler ohne Entwicklung werden günstiger.
  peakDiscount: {
    noPotentialMaxGap: 2, noPotentialMultiplier: 0.90,
    ageDiscounts: [
      { minAge: 30, maxAge: 31, multiplier: 0.85 },
      { minAge: 32, maxAge: 33, multiplier: 0.72 },
      { minAge: 34, maxAge: 99, multiplier: 0.55 }
    ]
  }
};
function computeMarketValue(player) {
  const base = baseValueFromOvr(player.ovr);
  const mainPos = (player.positions && player.positions[0]) || player.pos;
  let v = base * ageFactor(player.age) * (POS_VALUE_FACTOR[mainPos] || 0.9);
  // Polyvalenz: jede zusätzliche Position erhöht den Wert (vielseitige Spieler sind teurer)
  const posCount = (player.positions && player.positions.length) || 1;
  v *= (1 + (posCount-1) * 0.12); // +12% pro Zusatzposition

  const tp = player.truePotential || player.ovr;
  const gap = tp - player.ovr;
  const age = player.age || 24;
  const P = PRICING.potential;

  // Potenzial-Aufschlag: ungenutztes Potenzial erhöht den Wert, v.a. bei jungen Spielern
  if (gap > 0 && age <= P.maxAge) {
    const youthScale = Math.max(P.minYouthMultiplier, (P.youngAgeRef - age) / P.youngAgeSpan);
    v *= (1 + gap * P.perPointBonus * youthScale);
  }
  // Wonderkid / High-Potential Extra-Multiplikatoren (Talente sind teuer)
  let gotTalentBonus = false;
  if (gap >= P.wonderkid.potentialGap && age <= P.wonderkid.maxAge) {
    v *= P.wonderkid.extraMultiplier; gotTalentBonus = true;
  } else if (gap >= P.highPotential.potentialGap && age <= P.highPotential.maxAge) {
    v *= P.highPotential.extraMultiplier; gotTalentBonus = true;
  }
  // Prime-Boost: Bestform-Spieler — nur ohne Talent-Aufschlag (kein Stapeln)
  if (!gotTalentBonus) {
    for (const b of PRICING.primeBoost) {
      if (age >= b.minAge && age <= b.maxAge) { v *= b.multiplier; break; }
    }
  }
  // Zenit-/Auslauf-Rabatte
  const PD = PRICING.peakDiscount;
  if (gap <= PD.noPotentialMaxGap) v *= PD.noPotentialMultiplier; // (fast) kein Potenzial mehr
  for (const d of PD.ageDiscounts) {
    if (age >= d.minAge && age <= d.maxAge) { v *= d.multiplier; break; }
  }
  return roundMarketValue(Math.max(2500, v));
}
function formatEuro(v) {
  const neg = v < 0; v = Math.abs(v);
  let s;
  if (v >= 1000000) s = '€' + (v/1000000).toFixed(v%1000000===0?0:2) + 'M';
  else if (v >= 1000) s = '€' + Math.round(v/1000) + 'k';
  else s = '€' + v;
  return neg ? '-' + s : s;
}

// ── VERTRÄGE & GEHALT ──────────────────────────────────────────
const MAX_CONTRACT_YEARS = 5;
// Wöchentliches Basisgehalt eines Spielers, abhängig von Stärke (ovr), Alter/Form und Potenzial.
// Faustregel: ~0,35% des Marktwerts pro Woche, mit Mindestgehalt.
// Liga-Stufe grob aus dem OVR ableiten (Marktspieler haben keine feste Liga).
// Liefert ein realistisches Wochen-Sockelgehalt je nach Spielstärke.
function wageTierFromOvr(ovr) {
  // Stützpunkte (OVR -> Sockelgehalt/Woche), dazwischen linear interpoliert
  //  ~50 Regionalliga · ~58 3. Liga · ~68 2. Bundesliga · ~78 Bundesliga · ~88 Topstar
  const pts = [
    [45,   400],   // unterste Regionalliga
    [50,   700],   // Regionalliga normal
    [55,  1200],   // Regionalliga Top / 3. Liga unten
    [60,  2500],   // 3. Liga normal
    [65,  5000],   // 3. Liga Top / 2. Liga unten
    [70, 10000],   // 2. Bundesliga normal
    [75, 24000],   // 2. Liga Top / Bundesliga unten
    [80, 55000],   // Bundesliga normal
    [85, 120000],  // Bundesliga Top
    [90, 250000],  // Weltklasse
  ];
  if (ovr <= pts[0][0]) return pts[0][1];
  if (ovr >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for (let i=0; i<pts.length-1; i++) {
    const [o1,w1] = pts[i], [o2,w2] = pts[i+1];
    if (ovr >= o1 && ovr <= o2) {
      const t = (ovr - o1) / (o2 - o1);
      return w1 + (w2 - w1) * t;
    }
  }
  return pts[pts.length-1][1];
}
// In 3. und 4. Liga (Regionalliga) hängt das Gehalt enger und gleichmäßiger vom
// OVR ab als die allgemeine Bundesliga-Kurve — dort ist die Spreizung sonst zu
// steil/sprunghaft (z.B. 1200€ bei OVR55 vs. 10000€ bei OVR70, das 8-Fache für
// nur +15 OVR). Diese Ligen bekommen eine eigene, sanft-proportionale Kurve.
function wageTierFromOvrLowerLeague(ovr, tierKey) {
  // Basiswert linear an den OVR gekoppelt (kein harter Sprung), plus leichte
  // Progression für überdurchschnittliche Spieler ihrer Liga. Kalibriert, damit
  // ein typischer Kader ~70-80% des ligaüblichen Wagebudgets ausschöpft
  // (defaultWageBudgetForTier: liga3=120k/Wo, regionalliga=45k/Wo).
  if (tierKey === 'regionalliga') {
    // NACHKALIBRIERT 2026-08-07: die alte Kurve (200 + (ovr−38)²·6) verfehlte ihr
    // eigenes Ziel deutlich — ein typischer Kader kam auf 66.000 €/Woche statt der
    // angepeilten ~70–80 % von 45.000 €. Dadurch überstiegen die Personalkosten
    // dauerhaft die Einnahmen und das Transferbudget war ab Saison 2 immer 0.
    // OVR 45 → 208€, OVR 52 → 481€, OVR 58 → 895€, OVR 67 → 1827€
    const base = Math.max(0, ovr - 40);
    return 150 + base * base * 2.3;
  }
  if (tierKey === 'liga3') {
    // OVR 50 → 640€, OVR 58 → 1860€, OVR 65 → 4075€, OVR 72 → 7180€
    const base = Math.max(0, ovr - 46);
    return 400 + base * base * 11;
  }
  return wageTierFromOvr(ovr);
}
function weeklyWageFor(player) {
  // Liga bestimmen (für ligagestaffelte Gehaltskurve in 3./4. Liga)
  let tierKey = null;
  try { tierKey = (typeof LEAGUE !== 'undefined' && LEAGUE && typeof findFcmGroup === 'function') ? findFcmGroup(LEAGUE).tierKey : null; } catch (e) {}

  // Sockelgehalt nach Spielstärke — in 3./4. Liga enger an den OVR gekoppelt
  let wage = (tierKey === 'liga3' || tierKey === 'regionalliga')
    ? wageTierFromOvrLowerLeague(player.ovr, tierKey)
    : wageTierFromOvr(player.ovr);
  // Positionsfaktor: Offensive etwas teurer, Torwart etwas günstiger (inkl. neuer Positionen)
  const mainPos = (player.positions && player.positions[0]) || player.pos;
  const posF = { TW:0.85, IV:0.95, AV:1.0, LV:1.0, RV:1.0, ZDM:0.98, ZM:1.0, AM:1.05, LM:1.05, RM:1.05, OM:1.1, ZOM:1.12, FL:1.15, LF:1.15, RF:1.15, ST:1.15 }[mainPos] || 1.0;
  wage *= posF;
  // Top-Talente (Potenzial über OVR) wollen mehr (bis +50%)
  const tp = player.truePotential || player.ovr;
  if (tp > player.ovr) wage *= (1 + Math.min(0.5, (tp - player.ovr) * 0.035));
  // Alters-/Formfaktor: Bestform 24-29 Aufschlag; ältere Routiniers (30+/33+) verlangen MEHR Gehalt
  if (player.age <= 20) wage *= 0.85;
  else if (player.age <= 23) wage *= 1.0;
  else if (player.age <= 29) wage *= 1.10;   // Bestform
  else if (player.age <= 32) wage *= 1.10;   // 30-32: Routinier-Aufschlag
  else wage *= 1.20;                          // 33+: deutlicher Routinier-Aufschlag
  // Kein harter Deckel mehr in der Regionalliga — die eigene Kurve hält die
  // Gehälter bereits im plausiblen Rahmen, proportional zur Spielerstärke.
  return roundWage(Math.max(250, wage));
}
function roundWage(v) {
  if (v < 2000)   return Math.round(v/50)*50;
  if (v < 10000)  return Math.round(v/100)*100;
  if (v < 50000)  return Math.round(v/500)*500;
  return Math.round(v/1000)*1000;
}
// Mindestgehalt, das ein Spieler bei Verpflichtung/Verlängerung fordert:
// nie weniger als sein aktuelles Gehalt, plus Aufschlag nach Stärke/Form.
function minWageDemand(player) {
  const fair = weeklyWageFor(player);
  const current = player.wage || 0;
  return roundWage(Math.max(fair, current * 1.05));
}
// Ablöse-Aufschlag nach Vertragslänge: längerer Vertrag = teurer.
// 1 Jahr = Basiswert, danach +12% pro zusätzlichem Jahr.
function transferFeeForYears(baseValue, years) {
  years = Math.max(1, Math.min(MAX_CONTRACT_YEARS, years|0));
  return roundMarketValue(baseValue * (1 + (years - 1) * 0.12));
}
// Gesamtes wöchentliches Gehalt aller Kaderspieler (Leihspieler zahlt der Stammverein nicht voll –
// vereinfachend zahlen wir für reine Leihspieler kein Gehalt).
function totalWeeklyWages(squad) {
  return (squad||[]).reduce((sum,p) => sum + (p.onLoanFrom ? 0 : (p.wage||0)), 0);
}
// Stellt sicher, dass ein Spieler Vertragsfelder hat (für Altstände/Migration).
function ensureContract(player, currentSeason) {
  if (player.wage == null) player.wage = weeklyWageFor(player);
  if (player.contractUntil == null) {
    // zufällige Restlaufzeit 1–4 Jahre für bestehende Spieler
    player.contractUntil = currentSeason + 1 + rndN(3);
  }
  return player;
}

// ── POSITIONS-SYSTEM: sinnvolle Kombinationen ───────────────────
// POS_INFO: Nachbarn bestimmen welche Zweitpositionen generatePositions vergeben kann.
// AM, ZDM und FL sind jetzt vollwertige Hauptpositionen (in POS_LIST) und als
// Nachbarn der angrenzenden Positionen eingetragen, damit sie organisch entstehen.
const POS_INFO = {
  TW:  { area:'DEF', neighbors:[] },
  IV:  { area:'DEF', neighbors:['LV','RV','ZDM','ZM'] },
  ZDM: { area:'MID', neighbors:['IV','LV','RV','ZM'] },
  ZM:  { area:'MID', neighbors:['IV','ZDM','LM','RM','ZOM'] },
  ZOM: { area:'MID', neighbors:['ZM','ST','LF','RF'] },
  // Altbestand ohne Seite: Nebenpositionen ebenfalls ohne Seite (bekommen beim Kehren dieselbe Seite wie die Stammposition)
  AV:  { area:'DEF', neighbors:['IV','ZDM','AM'] },
  AM:  { area:'MID', neighbors:['ZM','ZOM','FL'] },
  OM:  { area:'MID', neighbors:['ZM','ZOM','ST'] },
  FL:  { area:'ATT', neighbors:['AM','ZOM','ST'] },
  ST:  { area:'ATT', neighbors:['ZOM','LF','RF'] },
  // Positionen mit Seite (2026-10-18): Nebenpositionen bleiben auf derselben Seite
  LV:  { area:'DEF', neighbors:['IV','LM','ZDM'] },
  RV:  { area:'DEF', neighbors:['IV','RM','ZDM'] },
  LM:  { area:'MID', neighbors:['LV','ZM','LF'] },
  RM:  { area:'MID', neighbors:['RV','ZM','RF'] },
  LF:  { area:'ATT', neighbors:['LM','ZOM','ST'] },
  RF:  { area:'ATT', neighbors:['RM','ZOM','ST'] }
};
function generatePositions(mainPos) {
  if (mainPos === 'TW') return ['TW'];
  const positions = [mainPos];
  const maxExtra = rndN(100) < 35 ? 0 : (rndN(100) < 70 ? 1 : (rndN(100) < 85 ? 2 : 3));
  const candidates = [...POS_INFO[mainPos].neighbors];
  for (let i=0; i<maxExtra && candidates.length>0; i++) {
    const idx = rndN(candidates.length);
    const p = candidates.splice(idx,1)[0];
    if (!positions.includes(p)) positions.push(p);
    POS_INFO[p].neighbors.forEach(n => { if(!positions.includes(n) && !candidates.includes(n)) candidates.push(n); });
  }
  return positions.slice(0,4);
}
// Bereichswerte (DEF/MID/ATT) aus Positionen + Grundstärke
function generateAreaRatings(positions, baseOvr) {
  const n = () => (Math.random()-0.5)*8;
  const areas = new Set(positions.map(p => POS_INFO[p].area));
  function ratingFor(area) {
    if (areas.has(area)) return clamp2(baseOvr + n(), 20, 99);
    return clamp2(baseOvr - 18 + n(), 15, 90);
  }
  return { def: ratingFor('DEF'), mid: ratingFor('MID'), att: ratingFor('ATT') };
}
function computeOvrFromAreas(player) {
  const mainPos = (player.positions && player.positions[0]) || player.pos;
  const area = POS_INFO[mainPos] ? POS_INFO[mainPos].area : 'MID';
  const primary = area==='DEF'?player.def : area==='MID'?player.mid : player.att;
  const avg = (player.def + player.mid + player.att)/3;
  return clamp2(primary*0.7 + avg*0.3, 20, 99);
}
// ── POTENZIAL ───────────────────────────────────────────────────
function computeTruePotential(ovr, age) {
  const youthRoom = Math.max(0, 26 - age);
  const ceiling = Math.min(95, ovr + Math.round(youthRoom * (0.5 + Math.random()*0.8)) + rndN(4));
  return Math.max(ovr, ceiling);
}
function potentialUncertainty(age, gamesPlayed, scoutLevel) {
  const ageFactor2 = Math.max(0, 25 - age);
  const scoutFactor = (10 - scoutLevel) * 0.4;
  const gamesFactor = Math.max(0, 25 - (gamesPlayed||0)) / 25;
  let halfWidth = 1 + ageFactor2*0.45*(0.5+gamesFactor*0.5) + scoutFactor;
  if (age >= 27 || (gamesPlayed||0) >= 50) halfWidth = Math.min(halfWidth, 1.5);
  return Math.max(0, Math.min(12, Math.round(halfWidth)));
}
function potentialRange(player, scoutLevel) {
  const tp = player.truePotential || player.ovr;
  const half = potentialUncertainty(player.age, player.gamesPlayed||0, scoutLevel || (CLUB.facilities?CLUB.facilities.scouting:1));
  if (half === 0) return { lo: tp, hi: tp, exact:true };
  const seed = (player.seed || 0);
  const bias = ((seed % 7) - 3);
  let lo = clamp2(tp - half + bias, player.ovr, 99);
  let hi = clamp2(tp + half + bias, player.ovr, 99);
  if (lo > hi) { const t=lo; lo=hi; hi=t; }
  return { lo, hi, exact:false };
}
// Anzeige-Helfer: "64 (78-86)" oder "64 (84)" wenn exakt bekannt
function potentialDisplay(player, scoutLevel) {
  const r = potentialRange(player, scoutLevel);
  if (r.exact || r.lo === r.hi) return `${player.ovr} (${r.lo})`;
  return `${player.ovr} (${r.lo}-${r.hi})`;
}
function positionsDisplay(player) {
  return (player.positions && player.positions.length ? player.positions : [player.pos]).join('/');
}
function displayName(p) {
  return (p.firstName ? p.firstName.charAt(0)+'. ' : '') + p.name;
}
function fullName(p) {
  return (p.firstName ? p.firstName+' ' : '') + p.name;
}

// Erweitert 2026-10-15 (Nutzer: „Namensliste deutlich erweitern“): 40 → 200 Nachnamen, 25 → 100 Vornamen – gängige
// deutsche Namen, keine Kombinationen bekannter Profis. Genutzt für Nachwuchs, Markt, NPC-Lücken und Kunst-Gegner.
const TRANSFER_SURNAMES = ['Hoffmann','Krüger','Vogt','Sauer','Lange','Brandt','Keller','Frank','Busch','Pohl','Sander','Beck','Voss','Lorenz','Graf','Winkler','Kraus','Martin','Schreiber','Albers','Thiel','Petersen','Jung','Berg','Wolf','Horn','Pfeifer','Otto','Seidel','Kuhn','Rapp','Linke','Maurer','Decker','Reuter','Brand','Götz','Simon','Ziegler','Haupt',
  'Ahrens','Arnold','Bartels','Baumann','Beyer','Bischoff','Böttcher','Brinkmann','Bruns','Buchholz','Dietrich','Dittmann','Döring','Ebert','Eckert','Engel','Ernst','Fiedler','Förster','Franke','Friedrich','Fritz','Gerlach','Gärtner','Geiger','Gehrke','Haas','Hahn','Hansen','Heinrich','Heinz','Held','Hermann','Hesse','Hinz','Hofer','Holz','Hübner','Jäger','Jansen','Janssen','Kaiser','Kessler','Kirchner','Kluge','Knorr','Kolb','Konrad','Kopp','Korn','Kramer','Kunze','Kurz','Lindemann','Ludwig','Lutz','Marx','Matthes','Menzel','Merz','Metz','Michel','Mohr','Moser','Nagel','Naumann','Nolte','Oswald','Paul','Pape','Pietsch','Plath','Preuß','Quast','Rademacher','Reich','Reimann','Rieger','Ritter','Rösler','Rose','Rudolph','Runge','Sachs','Schade','Schilling','Schlegel','Schmitz','Scholl','Schreiner','Schütte','Seeger','Siebert','Sommer','Specht','Stahl','Stein','Stolz','Strauß','Teichmann','Thiele','Ulrich','Vetter','Vollmer','Walther','Weidner','Wendt','Wenzel','Wiese','Wilke','Witt','Wolff','Wulf','Zander','Zeller','Zimmer','Ackermann','Brenner','Dreyer','Eggert','Fleischer','Gebhardt','Hartwig','Imhof','Jacobi','Kröger','Lammers','Mertens','Nowak','Ostermann','Prinz','Reinhardt','Seifert','Tietz','Uhlig','Voigt','Wegner','Wichmann','Ziemer','Abel','Bock','Clausen','Dorn','Eichler','Fink','Grote','Heller','Jahn','Kling','Lux','Mann','Nies','Oertel'];
const GERMAN_FIRST = ['Lukas','Maximilian','Felix','Leon','Ben','Jonas','Noah','Elias','Julian','Tim','Paul','Luca','Finn','Max','Niklas','Jan','Moritz','David','Tobias','Simon','Florian','Marco','Kevin','Philipp','Dennis',
  'Alexander','Andreas','Anton','Arne','Bastian','Benedikt','Benjamin','Björn','Carl','Christian','Christopher','Daniel','Dominik','Emil','Erik','Fabian','Frederik','Georg','Gregor','Hannes','Hendrik','Henrik','Jakob','Jannik','Jannis','Johannes','Jona','Jonathan','Julius','Kai','Karl','Kilian','Konstantin','Lars','Lasse','Lennard','Lennart','Leo','Leonard','Levin','Linus','Lorenz','Louis','Magnus','Malte','Marc','Marius','Marlon','Martin','Marvin','Mathis','Matthias','Mats','Michael','Mika','Milan','Nico','Nils','Ole','Oliver','Oskar','Pascal','Patrick','Quentin','Rafael','Robin','Ruben','Sebastian','Stefan','Theo','Till','Valentin','Vincent'];
// Zwölf Positionen mit Seite wie Kickdraft (2026-10-18, kickstil_positionen.js); AV/AM/FL ohne Seite nur noch Altbestand
const POS_LIST = ['TW','IV','LV','RV','ZDM','ZM','LM','RM','ZOM','LF','RF','ST'];
const POS_OHNE_SEITE = ['AV','AM','FL'];
// Alte Attribut-Funktion (für pace/mental noch genutzt)
function genAttributes(pos, ovr) {
  const n = () => (Math.random()-0.5)*12;
  if(pos==='TW') return { att:clamp2(ovr-32+n(),15,60), def:clamp2(ovr+5+n(),30,99), pace:clamp2(ovr-15+n(),20,80), mental:clamp2(ovr+3+n(),30,99) };
  if(pos==='IV') return { att:clamp2(ovr-25+n(),20,75), def:clamp2(ovr+8+n(),30,99), pace:clamp2(ovr-8+n(),25,90), mental:clamp2(ovr+2+n(),30,99) };
  if(pos==='AV') return { att:clamp2(ovr-10+n(),25,85), def:clamp2(ovr+2+n(),25,95), pace:clamp2(ovr+6+n(),35,99), mental:clamp2(ovr-2+n(),25,95) };
  if(pos==='ZM') return { att:clamp2(ovr-3+n(),25,90), def:clamp2(ovr-3+n(),25,90), pace:clamp2(ovr-2+n(),30,95), mental:clamp2(ovr+4+n(),30,99) };
  if(pos==='OM') return { att:clamp2(ovr+8+n(),35,99), def:clamp2(ovr-15+n(),15,75), pace:clamp2(ovr+4+n(),35,99), mental:clamp2(ovr+2+n(),30,95) };
  return { att:clamp2(ovr+10+n(),35,99), def:clamp2(ovr-25+n(),10,65), pace:clamp2(ovr+6+n(),35,99), mental:clamp2(ovr-2+n(),25,90) };
}
// ── INTERNATIONALE SPIELER & SCOUTING ──────────────────────────
const INTL_NAMES = {
  '🇪🇸': ['García','Martínez','López','Sánchez','Fernández','Torres','Romero','Navarro'],
  '🇫🇷': ['Martin','Bernard','Dubois','Laurent','Lefèvre','Moreau','Girard','Mercier'],
  '🇮🇹': ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Greco','Conti'],
  '🇧🇷': ['Silva','Santos','Oliveira','Souza','Costa','Pereira','Almeida','Ribeiro'],
  '🇦🇷': ['González','Rodríguez','Fernández','Díaz','Gómez','Acosta','Benítez','Sosa'],
  '🇳🇱': ['de Jong','van Dijk','Bakker','Visser','Smit','Meijer','de Boer','Mulder'],
  '🇵🇹': ['Silva','Santos','Ferreira','Pereira','Costa','Carvalho','Gomes','Lopes'],
  '🇬🇧': ['Smith','Jones','Williams','Taylor','Brown','Wilson','Walker','Roberts'],
  '🇭🇷': ['Horvat','Kovačević','Babić','Marić','Jurić','Novak','Knežević','Petrović'],
  '🇷🇸': ['Jovanović','Petrović','Nikolić','Marković','Đorđević','Stojanović','Ilić','Pavlović'],
  '🇸🇳': ['Diop','Ndiaye','Sarr','Fall','Gueye','Mbaye','Sow','Diallo'],
  '🇯🇵': ['Tanaka','Suzuki','Takahashi','Watanabe','Ito','Yamamoto','Nakamura','Kobayashi']
};
const INTL_FLAGS = Object.keys(INTL_NAMES);

// Scouting-Reichweite: höheres Level = stärkere Spieler, höheres Potenzial, mehr Internationale
function scoutingReach(level) {
  return {
    maxOvr: Math.min(92, 70 + level*2),          // Lvl1:72 ... Lvl10:90+
    maxPot: Math.min(95, 72 + level*2),           // erreichbares Potenzial
    intlPct: Math.min(75, level*7),               // Anteil internationaler Spieler
    eliteChance: Math.max(0, (level-4)*0.04)      // ab Lvl5 echte Top-Talente
  };
}
// JUWELEN: Die normale Kurve endet je nach Scouting bei 74 bis 95, erreicht die
// Spitze aber praktisch nie — Potenzial 90 kam so gut wie nicht vor. Ein echtes
// Jahrhunderttalent ist selten, aber es existiert, und es ist unbezahlbar.
// Auffindbar nur mit ordentlichem Scouting: Wer nicht sucht, findet keins.
const JUWEL = {
  abStufe: 5,            // erst ab Scouting-Stufe 5 überhaupt auffindbar
  chanceProStufe: 0.005, // je Stufe darüber
  maxChance: 0.028,
  maxAlter: 20,
  potMin: 85, potMax: 95
};
function juwelChance(scoutLevel) {
  if ((scoutLevel || 1) < JUWEL.abStufe) return 0;
  return Math.min(JUWEL.maxChance, (scoutLevel - JUWEL.abStufe + 1) * JUWEL.chanceProStufe);
}
function computePotential(ovr, age, scoutLevel) {
  // Jüngere Spieler haben mehr Luft nach oben; Scouting deckt höheres Potenzial auf
  const reach = scoutingReach(scoutLevel);
  const youthBonus = Math.max(0, 24 - age);
  let pot = ovr + Math.round(youthBonus * (0.4 + scoutLevel*0.05)) + rndN(3);
  pot = Math.min(reach.maxPot, Math.max(ovr, pot));
  // Der seltene Glücksfall — unabhängig von der Reichweite des Scoutings.
  if (age <= JUWEL.maxAlter && Math.random() < juwelChance(scoutLevel)) {
    pot = Math.max(pot, JUWEL.potMin + rndN(JUWEL.potMax - JUWEL.potMin + 1));
  }
  return pot;
}
// Vereine je Land — europäische aus der echten Klubdatenbank, außereuropäische
// aus kurzen Listen. Ganz junge Spieler stehen eher beim Nachwuchsteam.
const NICHT_EURO_KLUBS = {
  'Brasilien':      ['SE Palmeiras','CR Flamengo','São Paulo FC','SC Corinthians','Grêmio','Fluminense','Athletico Paranaense','Santos FC','Cruzeiro','Internacional'],
  'Argentinien':    ['River Plate','Boca Juniors','Racing Club','Independiente','Vélez Sarsfield','Estudiantes','Talleres','Argentinos Juniors'],
  'Kolumbien':      ['Atlético Nacional','Millonarios FC','Deportivo Cali','Independiente Medellín','Junior Barranquilla','América de Cali'],
  'Uruguay':        ['Club Nacional','Peñarol','Defensor Sporting','Danubio FC','Liverpool Montevideo'],
  'Elfenbeinküste': ['ASEC Mimosas','Africa Sports','Stade d Abidjan','SOA Abidjan'],
  'Senegal':        ['Casa Sports','Génération Foot','Diambars FC','Jaraaf Dakar','Teungueth FC'],
  'Nigeria':        ['Enyimba FC','Rivers United','Kano Pillars','Remo Stars','Plateau United'],
  'Japan':          ['Kawasaki Frontale','Urawa Red Diamonds','Yokohama F. Marinos','Vissel Kobe','Kashima Antlers','Gamba Osaka','FC Tokyo'],
  'Südkorea':       ['Jeonbuk Hyundai','Ulsan HD','FC Seoul','Pohang Steelers','Daegu FC'],
  'Marokko':        ['Raja Casablanca','Wydad AC','FAR Rabat','RS Berkane'],
  'Ghana':          ['Asante Kotoko','Hearts of Oak','Medeama SC','Aduana Stars'],
  'Mexiko':         ['Club América','CD Guadalajara','Cruz Azul','Tigres UANL','CF Monterrey','Pachuca'],
  'USA':            ['LAFC','Seattle Sounders','Atlanta United','FC Cincinnati','Philadelphia Union'],
  'Australien':     ['Melbourne City','Sydney FC','Western Sydney','Adelaide United']
};
function herkunftsverein(country, player) {
  const jung = (player && player.age <= 20);
  try {
    if (window.EURO_CLUBS && window.EURO_CLUBS.length) {
      let passend = window.EURO_CLUBS.filter(c => c.country === country);
      // KLASSE PASST ZUM VEREIN: Vorher wurde blind gezogen — ein 78er konnte
      // bei Brøndby stehen und ein 55er bei Real Madrid. Jetzt wird der Verein
      // zur Stärke des Spielers gesucht; für Nachwuchsspieler großzügiger, weil
      // Talente auch bei Spitzenklubs im Nachwuchs stehen.
      // Die Klubdatenbank reicht von OVR 57 bis 90. Ein Spieler muss in diese
      // Spanne passen: Wer deutlich zu schwach ist, stand nicht bei einem
      // gelisteten Verein — er kommt dann aus einem namenlosen Klub. Nachwuchs
      // darf weiter nach oben greifen, weil Talente in großen Akademien stehen.
      const ovr = (player && player.ovr) || 62;
      const untergrenze = ovr - (jung ? 4 : 7);
      const obergrenze  = ovr + (jung ? 22 : 10);
      passend = passend.filter(c => c.ovr >= untergrenze && c.ovr <= obergrenze);
      if (passend.length) {
        const c = pickRnd(passend);
        if (player) {
          // Für Ablöse, Gehalt und Anzeige: der abgebende Verein ist im Ausland.
          player.auslandsklub = { name: c.name, land: c.country, flagge: c.flag,
                                  coeff: c.coeff || 6, ovr: c.ovr };
        }
        return jung ? c.name + ' U19' : c.name;
      }
    }
  } catch (e) {}
  const liste = NICHT_EURO_KLUBS[country];
  if (liste && liste.length) {
    const n = pickRnd(liste);
    return jung ? n + ' Sub-20' : n;
  }
  return pickRnd(['FC Lindenau','SV Rheinfeld','TuS Hohenfels','VfL Steinbach','SC Marienburg',
                  'Borussia Falkenau','SpVgg Birkenhain','1. FC Eichenfeld','TSV Almenrode','FC Waldbach']);
}

// ── EUROPAPOKAL ALS ARGUMENT ───────────────────────────────────────────────
// An vier Stellen im Spiel wird die Teilnahme am Europapokal bereits abgefragt
// — in der Niveau-Sperre, im Vertragsgespräch, in der Kaufverhandlung und beim
// Gehalt der Ablösefreien. Alle vier prüfen `typeof europaStufe === 'function'`
// und liefen deshalb bisher ins Leere: Die Funktion gab es nie, der Bonus war
// überall 0. Hier ist sie.
//   0 = keine Teilnahme · 1 = Conference League · 2 = Europa League
//   3 = Champions League
function europaStufe() {
  try {
    const c = CLUB && CLUB.euro && CLUB.euro.fcmComp;
    return c === 'cl' ? 3 : c === 'el' ? 2 : c === 'co' ? 1 : 0;
  } catch (e) { return 0; }
}
function europaLabel() {
  return ['', 'Conference League', 'Europa League', 'Champions League'][europaStufe()] || '';
}
window.europaStufe = europaStufe;
window.europaLabel = europaLabel;

function generateMarketPlayer(used, idPrefix, i, scoutLevel) {
  scoutLevel = scoutLevel || 1;
  const reach = scoutingReach(scoutLevel);
  const roll = Math.random();
  let ovr;
  if (roll < 0.50) ovr = 45 + rndN(21);
  else if (roll < 0.85) ovr = 62 + rndN(14);
  else ovr = 74 + rndN(Math.max(1, reach.maxOvr-74+1)); // Spitzenspieler nur mit gutem Scouting
  ovr = Math.min(reach.maxOvr, ovr);
  // Elite-Talent-Chance (junge Spieler mit Top-Potenzial)
  const isElite = Math.random() < reach.eliteChance;
  const age = isElite ? 17 + rndN(4) : 17 + rndN(19);
  const pos = pickRnd(POS_LIST);
  // Name & Nationalität aus der reichhaltigen Scouting-Länderdatenbank
  // (window.SCOUTING_COUNTRIES, 19 Länder mit je 20 Vor-/20 Nachnamen). Fällt auf
  // die alten Listen zurück, falls das Scouting-Modul (noch) nicht geladen ist.
  let name, flag = '', firstName = '', country = 'Deutschland';
  const SC = (typeof window !== 'undefined' && window.SCOUTING_COUNTRIES) ? window.SCOUTING_COUNTRIES : null;
  const intlChance = reach.intlPct / 100;

  if (SC) {
    const countries = Object.keys(SC);
    // "Deutschland" bevorzugt, wenn NICHT international gewürfelt wird; sonst
    // ein zufälliges anderes Land (gewichtet leicht nach Erreichbarkeit).
    let chosen;
    // TOP-TALENTE KOMMEN AUS ALLER WELT: Wer als Elite-Talent gewürfelt wurde,
    // ist fast immer Ausländer — sonst stammt das größte Talent der Welt in acht
    // von zehn Fällen aus Niedersachsen. Sonst gilt weiter die Scouting-Reichweite.
    const auslandP = isElite ? Math.max(0.85, intlChance) : intlChance;
    if (Math.random() < auslandP) {
      const foreign = countries.filter(c => c !== 'Deutschland');
      chosen = pickRnd(foreign);
    } else {
      chosen = 'Deutschland';
    }
    const d = SC[chosen];
    firstName = pickRnd(d.first);
    name = pickRnd(d.last);
    flag = d.flag;
    country = chosen;
  } else {
    // Fallback: alte Listen
    const INTL_COUNTRY = {'🇪🇸':'Spanien','🇫🇷':'Frankreich','🇮🇹':'Italien','🇧🇷':'Brasilien','🇦🇷':'Argentinien','🇳🇱':'Niederlande','🇵🇹':'Portugal','🇬🇧':'England','🇭🇷':'Kroatien','🇷🇸':'Serbien','🇸🇳':'Senegal','🇯🇵':'Japan'};
    if (Math.random() < intlChance) {
      flag = pickRnd(INTL_FLAGS);
      name = pickRnd(INTL_NAMES[flag]);
      country = INTL_COUNTRY[flag] || 'Ausland';
      firstName = '';
    } else {
      name = pickRnd(TRANSFER_SURNAMES);
      firstName = pickRnd(GERMAN_FIRST);
      flag = '🇩🇪';
    }
  }
  let tries=0;
  while(used.has(idPrefix+flag+firstName+name) && tries<200){
    tries++;
    if (SC && SC[country]) { firstName = pickRnd(SC[country].first); name = pickRnd(SC[country].last); }
    else if(country!=='Deutschland'){ name=pickRnd(INTL_NAMES[flag]); }
    else { name=pickRnd(TRANSFER_SURNAMES); }
  }
  used.add(idPrefix+flag+firstName+name);
  // Neues Modell: sinnvolle Positionen, Bereichswerte, OVR aus Bereichen, echtes Potenzial
  const positions = generatePositions(pos);
  const areas = generateAreaRatings(positions, ovr);
  const paceMental = genAttributes(pos, ovr);
  const player = { id:idPrefix+'_'+i, name, firstName, flag, country, age, pos, positions, def:areas.def, mid:areas.mid, att:areas.att, pace:paceMental.pace, mental:paceMental.mental, gamesPlayed:0, seed: rndN(100) };
  player.ovr = computeOvrFromAreas(player);
  // truePotential durch Scouting-Reichweite gedeckelt; Elite-Talente höher
  let tp = computeTruePotential(player.ovr, age);
  tp = Math.min(reach.maxPot, tp);
  if (isElite) tp = Math.min(95, Math.max(tp, player.ovr + 8 + rndN(6)));
  player.truePotential = Math.max(player.ovr, tp);
  player.value = computeMarketValue(player);
  player.wage = weeklyWageFor(player);
  player.loanFee = Math.max(2500, roundMarketValue(Math.max(1000, player.value * 0.10)));
  // HERKUNFT: früher sieben erfundene Namen für die ganze Welt („Ajax B",
  // „Santos U23"). Jetzt echte Vereine — passend zum Land des Spielers, wenn es
  // dort welche gibt. Wer aus Brasilien kommt, spielt auch in Brasilien.
  player.fromClub = herkunftsverein(country, player);
  assignBirthday(player);
  return player;
}
function generateMarketPool(count, seasonSeed) {
  const used = new Set();
  const scoutLevel = (CLUB.facilities && CLUB.facilities.scouting) ? CLUB.facilities.scouting : 1;
  const players = [];
  for (let i=0;i<count;i++) players.push(generateMarketPlayer(used, 'mkt'+seasonSeed+'_'+scoutLevel, i, scoutLevel));
  return players;
}
// ── ZUFÄLLIGER STARTKADER ───────────────────────────────────────
// Erzeugt einen ausgewogenen Kader (garantierte Positionsverteilung), dessen
// Stärke sich an targetOvr (Gesamtstärke des gewählten Vereins) orientiert.
function generateStartingSquadPlayer(used, i, mainPos, targetOvr) {
  const spread = (Math.random()-0.5) * 14;            // ±7 um die Vereinsstärke
  let base = clamp2(Math.round(targetOvr + spread), 38, 92);
  const ageRoll = Math.random();
  const age = ageRoll < 0.25 ? 18 + rndN(4)           // junge Talente
            : ageRoll < 0.80 ? 22 + rndN(7)           // Prime 22–28
            : 29 + rndN(7);                           // erfahren 29–35
  let name, firstName = '', flag = '🇩🇪', country = 'Deutschland';
  const INTL_COUNTRY = {'🇪🇸':'Spanien','🇫🇷':'Frankreich','🇮🇹':'Italien','🇧🇷':'Brasilien','🇦🇷':'Argentinien','🇳🇱':'Niederlande','🇵🇹':'Portugal','🇬🇧':'England','🇭🇷':'Kroatien','🇷🇸':'Serbien','🇸🇳':'Senegal','🇯🇵':'Japan'};
  const intlPct = Math.max(8, Math.min(45, (targetOvr-50))); // stärkere Vereine internationaler
  if (Math.random() < intlPct/100) {
    flag = pickRnd(INTL_FLAGS); name = pickRnd(INTL_NAMES[flag]); country = INTL_COUNTRY[flag] || 'Ausland'; firstName = '';
  } else {
    name = pickRnd(TRANSFER_SURNAMES); firstName = pickRnd(GERMAN_FIRST); flag = '🇩🇪';
  }
  let tries=0;
  while (used.has(flag+name) && tries<200) { tries++; name = (country!=='Deutschland') ? pickRnd(INTL_NAMES[flag]) : pickRnd(TRANSFER_SURNAMES); }
  used.add(flag+name);

  const positions = generatePositions(mainPos);
  const areas = generateAreaRatings(positions, base);
  const pm = genAttributes(mainPos, base);
  const player = {
    id:'fcm_p'+i, name, firstName, flag, country, joinedSeason: 1,
    pos: mainPos, positions,
    def: areas.def, mid: areas.mid, att: areas.att,
    pace: pm.pace, mental: pm.mental,
    gamesPlayed: 0, seed: rndN(100)
  };
  player.ovr = computeOvrFromAreas(player);
  player.truePotential = Math.max(player.ovr, computeTruePotential(player.ovr, age));
  player.age = age;
  player.value = computeMarketValue(player);
  player.wage = weeklyWageFor(player);
  player.contractUntil = 1 + 1 + rndN(4); // Vertrag bis Saison 2–5
  return player;
}
// Liefert ein Array von 18 Spielern mit fester Positionsstruktur (3 TW, 6 ABW, 6 MIT, 3 STU)
function generateStartingSquad(targetOvr) {
  targetOvr = clamp2(targetOvr || 60, 42, 88);
  const used = new Set();
  const plan = ['TW','TW','TW',
                'IV','IV','IV','LV','RV','LV',
                'ZM','ZM','ZDM','ZOM','LF','RF',
                'ST','ST','ST'];
  return plan.map((pos, i) => { const p = generateStartingSquadPlayer(used, i, pos, targetOvr); assignBirthday(p); return p; });
}
// Stellt automatisch die stärkste Startelf für die aktuelle Formation auf
function autoFillLineup() {
  const slots = FORMATIONS[CLUB.formation] || FORMATIONS['4-4-2'];
  // Verfügbare Spieler bevorzugen; nicht verfügbare (verletzt/gesperrt) nur als Notnagel,
  // falls sonst zu wenige übrig wären.
  const available = SQUAD.filter(p => !p.onLoanAt && isAvailable(p)).sort((a,b)=>b.ovr-a.ovr);
  const fallback  = SQUAD.filter(p => !p.onLoanAt && !isAvailable(p)).sort((a,b)=>b.ovr-a.ovr);
  const pool = [...available, ...fallback]; // verfügbare zuerst
  const taken = new Set();
  const lineup = {};
  slots.forEach(slot => {
    let pick = pool.find(p => !taken.has(p.id) && (p.positions||[p.pos]).includes(slot.group));
    if (pick) { lineup[slot.id] = pick.id; taken.add(pick.id); }
  });
  slots.forEach(slot => {
    if (lineup[slot.id]) return;
    const pick = pool.find(p => !taken.has(p.id));
    if (pick) { lineup[slot.id] = pick.id; taken.add(pick.id); }
  });
  CLUB.lineup = lineup;
}

// ── TRIKOTNUMMERN & KAPITÄN ───────────────────────────────────────
// Bevorzugte Nummern je Position (klassische Vergabe). Wird der Reihe nach probiert.
const PREFERRED_NUMBERS = {
  TW: [1, 12, 22],
  IV: [4, 5, 3, 15, 23],
  AV: [2, 3, 16, 24, 18], LV: [3, 2, 16, 24, 18], RV: [2, 3, 16, 24, 18],
  ZDM: [6, 8, 14, 20, 28], ZM: [6, 8, 14, 20, 28], LM: [7, 11, 17, 21], RM: [7, 11, 17, 21],
  OM: [10, 7, 11, 17, 21], ZOM: [10, 7, 11, 17, 21], LF: [11, 7, 17, 21], RF: [7, 11, 17, 21], FL: [7, 11, 17, 21],
  ST: [9, 11, 7, 19, 25]
};
// Vergibt allen Spielern ohne Nummer eine eindeutige Trikotnummer (1-99).
// Bereits gesetzte Nummern bleiben erhalten; Konflikte werden vermieden.
function assignShirtNumbers(force) {
  if (force) SQUAD.forEach(p => { p.number = null; });
  const used = new Set(SQUAD.filter(p => p.number).map(p => p.number));
  // Spieler ohne Nummer in sinnvoller Reihenfolge (TW, IV, AV, ZM, OM, ST) bedienen
  const order = ['TW','IV','LV','RV','AV','ZDM','ZM','LM','RM','ZOM','OM','LF','RF','FL','ST'];
  const without = SQUAD.filter(p => !p.number)
    .sort((a,b) => order.indexOf(a.pos) - order.indexOf(b.pos));
  for (const p of without) {
    let num = null;
    const prefs = PREFERRED_NUMBERS[p.pos] || [];
    for (const cand of prefs) { if (!used.has(cand)) { num = cand; break; } }
    if (num === null) { // keine bevorzugte frei → nächste freie Nummer ab 2
      for (let i = 2; i <= 99; i++) { if (!used.has(i)) { num = i; break; } }
    }
    if (num === null) num = 99;
    p.number = num;
    used.add(num);
  }
}
// Ändert die Trikotnummer eines Spielers. Gibt false zurück, wenn die Nummer schon vergeben ist.
function setShirtNumber(playerId, number) {
  number = parseInt(number, 10);
  if (isNaN(number) || number < 1 || number > 99) return { ok:false, reason:'Bitte eine Zahl zwischen 1 und 99 eingeben.' };
  const conflict = SQUAD.find(p => p.number === number && p.id !== playerId);
  if (conflict) return { ok:false, reason:`Nummer ${number} ist bereits an ${displayName(conflict)} vergeben.` };
  const p = SQUAD.find(x => x.id === playerId);
  if (!p) return { ok:false, reason:'Spieler nicht gefunden.' };
  p.number = number;
  return { ok:true };
}
// Setzt den Kapitän. Übergibt man die bereits gesetzte ID, wird die Binde abgenommen.
function setCaptain(playerId) {
  if (CLUB.captainId === playerId) { CLUB.captainId = null; return; }
  CLUB.captainId = playerId;
}
function isCaptain(p) { return !!(p && CLUB.captainId && p.id === CLUB.captainId); }
// Stellt sicher, dass ein Kapitän gesetzt ist (bester verfügbarer Feldspieler nach Mentalität).
function ensureCaptain() {
  if (CLUB.captainId && SQUAD.some(p => p.id === CLUB.captainId)) return;
  const pool = SQUAD.filter(p => !p.onLoanAt && p.pos !== 'TW');
  const cand = (pool.length ? pool : SQUAD).slice().sort((a,b) => (b.mental||0) - (a.mental||0))[0];
  CLUB.captainId = cand ? cand.id : null;
}

// Beim Scouting-Ausbau: einen Teil des Marktes mit der neuen Reichweite auffrischen
function refreshMarketForScouting() {
  if (!MARKET) return;
  const scoutLevel = CLUB.facilities.scouting;
  const used = new Set(MARKET.players.map(p=>p.id));
  // die schwächere Hälfte durch neue (potenziell bessere) Spieler ersetzen
  MARKET.players.sort((a,b)=>a.ovr-b.ovr);
  const replaceCount = Math.ceil(MARKET.players.length * 0.4);
  for (let i=0;i<replaceCount;i++) {
    MARKET.players[i] = generateMarketPlayer(used, 'mktscout'+LEAGUE.season+'_'+scoutLevel+'_'+Date.now(), i, scoutLevel);
  }
}

let MARKET = null;
function defaultBudgetForTier(tierKey) { return ({ bundesliga:5000000, bundesliga2:1500000, liga3:400000, regionalliga:120000 })[tierKey] || 120000; }
// Hinweis: Das finale Wochen-Gehaltslimit setzt budget_system_patch.js
// (computeSeasonBudget → wageCapByTier). Diese Defaults dienen nur als Fallback
// und sind bewusst auf dieselbe Größenordnung gebracht, um Widersprüche zu vermeiden.
function defaultWageBudgetForTier(tierKey) { return ({ bundesliga:1400000, bundesliga2:320000, liga3:120000, regionalliga:45000 })[tierKey] || 45000; }

// ── TV-GELDER ───────────────────────────────────────────────────
// Modell: jeder Verein bekommt einen festen Sockelbetrag (Gleichverteilung) plus
// einen Leistungsbonus nach Punkten. Aufteilung des Liga-Topfs: TV_SPLIT Sockel / Rest Leistung.
// Zweitvertretungen ("... II") sind in der 3. Liga von TV-Geldern ausgeschlossen.
const TV_POOLS = {
  // tierKey: { pool: Gesamttopf/Saison, split: Anteil Sockel (Rest = Leistung) }
  bundesliga:   { pool: 630000000, split: 0.50 }, // ~Schnitt 35 Mio/Verein, Spanne ~20–55 Mio
  bundesliga2:  { pool: 130000000, split: 0.50 }, // ~Schnitt 7,2 Mio/Verein
  liga3:        { pool: 26000000,  split: 0.90 }, // fast reine Gleichverteilung (~1,3 Mio fix)
  regionalliga: { pool: 5400000,  split: 0.50 }, // kleiner Betrag, ~150k Sockel + Leistung
};
function isReserveTeam(team) { return /\bII$/.test((team.name||'').trim()); }
// Liefert für alle Vereine einer Gruppe das TV-Geld als { id: betrag }.
function computeTvMoneyForGroup(teams, tierKey) {
  const cfg = TV_POOLS[tierKey];
  const out = {};
  if (!cfg) { teams.forEach(t => out[t.id] = 0); return out; }
  // In der 3. Liga sind Zweitvertretungen ausgeschlossen; sonst zählen alle.
  const eligible = (tierKey === 'liga3') ? teams.filter(t => !isReserveTeam(t)) : teams.slice();
  const nElig = Math.max(1, eligible.length);
  const baseTotal = cfg.pool * cfg.split;            // Sockel-Topf
  const perfTotal = cfg.pool * (1 - cfg.split);      // Leistungs-Topf
  const basePerClub = baseTotal / nElig;
  const totalPts = eligible.reduce((s,t) => s + (t.pts||0), 0);
  teams.forEach(t => {
    if (tierKey === 'liga3' && isReserveTeam(t)) { out[t.id] = 0; return; }
    const perfShare = totalPts > 0 ? (t.pts||0) / totalPts : 1 / nElig;
    out[t.id] = roundMarketValue(basePerClub + perfTotal * perfShare);
  });
  return out;
}
// TV-Geld speziell für den eigenen Verein in seiner aktuellen Liga (vor dem Saisonwechsel aufrufen!)
function computeFcmTvMoney(league) {
  const fg = findFcmGroup(league);
  if (!fg) return { amount: 0, tierKey: null, rankInfo: null };
  const money = computeTvMoneyForGroup(fg.group.teams, fg.tierKey);
  const table = computeTable(fg.group.teams);
  const rank = table.findIndex(t => t.id === 'fcm') + 1;
  const fcm = table.find(t => t.id === 'fcm');
  return { amount: money['fcm'] || 0, tierKey: fg.tierKey, rank, pts: fcm ? fcm.pts : 0, teamsCount: table.length };
}

// ── GEBOTE ANDERER VEREINE (Idee 4) ─────────────────────────────
function isTransferWindowOpen() { return LEAGUE ? transferWindowInfo(LEAGUE.week).open : false; }
function currentWindowInfo() { return LEAGUE ? transferWindowInfo(LEAGUE.week) : { open:false, type:null, deadline:false, weeksLeft:0 }; }
const BIDDER_CLUBS = ['VfL Steinbach','SC Marienburg','1. FC Eichenfeld','Borussia Falkenau','SV Rheinfeld','TuS Hohenfels','Olympique B','AC Verona','Ajax B'];
// Pro offener Transferwoche evtl. ein Gebot für einen wertvollen Spieler
function maybeGenerateTransferBid() {
  if (!LEAGUE || !isTransferWindowOpen()) return null;
  if (!CLUB.transferBids) CLUB.transferBids = [];
  if (CLUB.transferBids.length >= 3) return null;          // max 3 offene Gebote
  if (Math.random() > 0.5) return null;                    // nicht jede Woche
  const sellable = SQUAD.filter(p => !p.onLoanFrom && !p.onLoanAt && computeMarketValue(p) > 60000
    && (typeof window.canSellPlayer !== 'function' || window.canSellPlayer(p)));
  if (sellable.length < 13) return null;                   // Kader nicht zu klein machen
  const target = pickRnd(sellable);
  if (CLUB.transferBids.some(b => b.playerId === target.id)) return null;
  const mv = computeMarketValue(target);
  const offer = roundMarketValue(mv * (0.9 + Math.random()*0.5)); // 90%-140% des Marktwerts
  const bid = { id:'bid_'+Date.now(), playerId:target.id, playerName:target.name, club:pickRnd(BIDDER_CLUBS), amount:offer, week:LEAGUE.week };
  CLUB.transferBids.push(bid);
  return bid;
}
function acceptTransferBid(bidId) {
  if (!CLUB.transferBids) return null;
  const idx = CLUB.transferBids.findIndex(b=>b.id===bidId); if(idx===-1) return null;
  const bid = CLUB.transferBids[idx];
  const pIdx = SQUAD.findIndex(p=>p.id===bid.playerId);
  if (pIdx===-1) { CLUB.transferBids.splice(idx,1); return null; }
  const p = SQUAD[pIdx];
  clearFromLineup(p.id);
  // Der Spieler geht nicht ins Nichts, sondern in den Kader des Käufers.
  try { if (typeof window.euroSpielerAufnehmen === 'function') window.euroSpielerAufnehmen(bid.club, p); } catch (e) {}
  SQUAD.splice(pIdx,1);
  CLUB.budget += bid.amount;
  CLUB.transferHistory.unshift({ type:'sell', name:p.name, amount:bid.amount, season:LEAGUE.season });
  CLUB.transferBids.splice(idx,1);
  return { name:p.name, club:bid.club, amount:bid.amount };
}
function declineTransferBid(bidId) {
  if (!CLUB.transferBids) return;
  const idx = CLUB.transferBids.findIndex(b=>b.id===bidId);
  if (idx!==-1) CLUB.transferBids.splice(idx,1);
}
// Gebote am Fensterende / Saisonende verfallen lassen
function clearTransferBids() { CLUB.transferBids = []; }
// Wöchentlicher Marktwechsel solange Fenster offen: kompletter neuer Pool (kein manuelles Reroll).
// Am Deadline Day: mehr & bessere Last-Minute-Optionen.
function refreshMarketForWeek() {
  if (!LEAGUE) return;
  const win = transferWindowInfo(LEAGUE.week);
  if (!win.open) return;
  const count = win.deadline ? 55 : 40;
  const keepStocks = MARKET ? MARKET.stocks : null;
  MARKET = { players: generateMarketPool(count, LEAGUE.season+'_w'+LEAGUE.week), stocks: keepStocks };
  if (win.deadline) {
    // Deadline Day: ein paar besonders attraktive Spieler (höhere OVR, Schnäppchenpreis)
    const scoutLevel = (CLUB.facilities && CLUB.facilities.scouting) ? CLUB.facilities.scouting : 1;
    const used = new Set(MARKET.players.map(p=>p.id));
    for (let i=0;i<6;i++) {
      const p = generateMarketPlayer(used, 'deadline'+LEAGUE.season+'_'+i, i, Math.min(10, scoutLevel+3));
      p.value = roundMarketValue(p.value * 0.8); // Deadline-Schnäppchen
      p.loanFee = Math.max(2500, roundMarketValue(p.value*0.10));
      MARKET.players.push(p);
    }
  }
}

// ── KAUF / VERKAUF / LEIHE ──────────────────────────────────────
function recallLoanedPlayer(squadId) {
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Leihen können nur im Sommer (Wochen 1–9) und im Winter (Januar) abgebrochen werden.'); return; }
  const p = SQUAD.find(x=>x.id===squadId); if(!p) return;
  delete p.onLoanAt;
  delete p.loanClubStrength;
  renderAll(); renderTransferTab(); saveGameState();
}

// ── SAISONÜBERGANG: ALTERN, RÜCKKEHR VON LEIHEN, NEUER MARKT ────
// ── ALTERUNG NACH POSITION ────────────────────────────────────────────────
// Ab wann der Abbau einsetzt und wie schnell er läuft. Ein Flügelstürmer lebt
// vom Antritt und verliert ihn früh; ein Innenverteidiger oder Torhüter lebt von
// Stellungsspiel und hält deutlich länger durch.
const ALTERUNG = {
  TW: { ab: 34, tempo: 0.45 },
  IV: { ab: 33, tempo: 0.70 },
  ZDM:{ ab: 32, tempo: 0.85 },
  ZM: { ab: 32, tempo: 0.90 },
  ZOM:{ ab: 31, tempo: 1.00 },
  OM: { ab: 31, tempo: 1.05 },
  AM: { ab: 30, tempo: 1.15 },
  AV: { ab: 30, tempo: 1.20 },
  FL: { ab: 30, tempo: 1.25 },
  LV: { ab: 30, tempo: 1.20 }, RV: { ab: 30, tempo: 1.20 },
  LM: { ab: 30, tempo: 1.15 }, RM: { ab: 30, tempo: 1.15 },
  LF: { ab: 30, tempo: 1.25 }, RF: { ab: 30, tempo: 1.25 },
  ST: { ab: 31, tempo: 1.05 }
};
function ALTERUNG_CFG(p) {
  const pos = (p && (p.pos || (p.positions && p.positions[0]))) || 'ZM';
  return ALTERUNG[pos] || { ab: 31, tempo: 1.0 };
}
function ALTERUNG_AB(p) {
  const v = (typeof window.traitAlterungsVerschiebung === 'function')
    ? window.traitAlterungsVerschiebung(p) : 0;
  return ALTERUNG_CFG(p).ab + v;
}
function ALTERUNG_TEMPO(p) { return ALTERUNG_CFG(p).tempo; }

function applyEndOfSeasonClubEffects(tierBefore, tierAfter) {
  // Neue KI-Torschützen für die kommende Saison erzwingen (werden bei Bedarf neu erzeugt)
  if (LEAGUE) { LEAGUE.aiScorers = null; }
  SQUAD.forEach(p => {
    // Saison-Statistik archivieren und für die neue Saison zurücksetzen
    if (p.stats && (p.stats.apps || p.stats.goals || p.stats.assists || p.stats.yellow || p.stats.red)) {
      if (!p.statsHistory) p.statsHistory = [];
      p.statsHistory.push(Object.assign({}, p.stats, { ovr: p.ovr }));
    }
    p.stats = { season: (LEAGUE?LEAGUE.season:1) + 1, goals:0, assists:0, apps:0, yellow:0, red:0 };
    // Gelb-Sammlung und Sperren enden mit der Saison; Verletzungen werden in der Pause auskuriert
    p.yellowAccum = 0;
    p.suspendedGames = 0;
    p.injuryWeeks = 0;
    p.injuryType = null;
    // Hinweis: Das Alter wird NICHT mehr hier erhöht — die Alterung läuft über die
    // Geburtswoche jedes Spielers (siehe advanceWeek). Hier nur Entwicklung/Verfall.
    const trainBonus = (CLUB.facilities && CLUB.facilities.training ? CLUB.facilities.training : 1) * 0.05;
    const pot = p.truePotential || (p.ovr + 4);
    // Junge Spieler entwickeln sich Richtung Potenzial; mehr Luft nach oben + mehr Spielzeit = schneller
    const playBonus = Math.min(0.25, (p.gamesPlayed||0) * 0.005);
    // Einsatz & Ø-Note der abgelaufenen Saison (matchRatings ist hier noch nicht zurückgesetzt)
    // Hinweis: runEndOfSeason hat LEAGUE.season bereits hochgezählt, die Ratings der
    // abgelaufenen Saison stehen aber noch (season-1). Beides zulassen.
    const _mr = (p.matchRatings && Array.isArray(p.matchRatings.list) && p.matchRatings.season >= LEAGUE.season - 1) ? p.matchRatings.list : [];
    const _gp = _mr.length, _avgR = _gp ? (_mr.reduce((a,b)=>a+b,0)/_gp) : 0;
    if (p.age >= 16 && p.age <= 20 && p.ovr < pot) {
      // GARANTIERTE Talent-Entwicklung: Basis +1 pro Saison, geboostet durch Spielzeit & gute Noten.
      let tgain = 1;
      if (_gp >= 12) tgain += 1; else if (_gp >= 5 && Math.random() < 0.6) tgain += 1;
      if (_avgR >= 7.2) tgain += 1; else if (_avgR >= 6.7 && _gp >= 5 && Math.random() < 0.5) tgain += 1;
      tgain = Math.max(1, Math.min(tgain, pot - p.ovr));
      // Gleichmäßig auf alle Kernbereiche, damit die OVR sauber um ~tgain steigt
      // (OVR = Primärbereich×0,7 + Ø(def,mid,att)×0,3).
      p.def = clamp2(p.def + tgain, 20, 99);
      p.mid = clamp2(p.mid + tgain, 20, 99);
      p.att = clamp2(p.att + tgain, 20, 99);
      p.mental = clamp2(p.mental + 1, 20, 99);
      p.ovr = Math.min(pot, computeOvrFromAreas(p));
    } else if (p.age <= 23 && p.ovr < pot && Math.random() < 0.25 + trainBonus + playBonus + (pot-p.ovr)*0.025) {
      const gain = (pot - p.ovr >= 4 && Math.random() < 0.35) ? 2 : 1;
      // die zwei stärksten Bereiche wachsen (passend zur Spielausrichtung)
      const areas = [['def',p.def],['mid',p.mid],['att',p.att]].sort((a,b)=>b[1]-a[1]);
      p[areas[0][0]] = clamp2(p[areas[0][0]] + gain, 20, 99);
      p[areas[1][0]] = clamp2(p[areas[1][0]] + Math.ceil(gain/2), 20, 99);
      p.mental = clamp2(p.mental + 1, 20, 99);
      p.ovr = computeOvrFromAreas(p);
    } else if (p.age >= 24 && p.age < ALTERUNG_AB(p) && p.ovr < pot && _gp >= 8) {
      // NEU: Zwischen 24 und 30 passierte am Saisonende gar nichts — wer in
      // dieser Spanne eine starke Saison spielte, stand danach exakt da, wo er
      // vorher stand. Jetzt zahlt sich Leistung auch im besten Alter aus:
      // die Chance hängt allein an Ø-Note und Einsatz.
      let ch = 0;
      if (_avgR >= 7.6) ch = 0.55;
      else if (_avgR >= 7.2) ch = 0.38;
      else if (_avgR >= 6.9) ch = 0.20;
      ch *= (0.6 + 0.4 * Math.min(1, _gp / 22));
      ch += Math.min(0.12, (pot - p.ovr) * 0.02);        // Luft nach oben hilft
      if (Math.random() < ch) {
        // Reifen statt Sprinten: Erfahrung wächst, Tempo nicht mehr.
        const areas = [['def',p.def],['mid',p.mid],['att',p.att]].sort((a,b)=>b[1]-a[1]);
        p[areas[0][0]] = clamp2(p[areas[0][0]] + 1, 20, 99);
        p.mental = clamp2(p.mental + 1, 20, 99);
        p.ovr = Math.min(pot, computeOvrFromAreas(p));
      }
    } else if (p.age >= ALTERUNG_AB(p)) {
      // Der Abbau war eine feste 45-%-Münze für alle ab 31 — unabhängig von
      // Leistung UND Position. In Wirklichkeit altern Flügelspieler und
      // Außenverteidiger früh und hart, Torhüter und Innenverteidiger spät und
      // milde. Jetzt entscheidet beides mit.
      // 2026-10-15 (Nutzer: „alte Spieler wirklich auch schnell runtergehen“): Kurve wie in echt aus kickstil_alterskurve.js
      if (window.Alterskurve) { window.Alterskurve.eigen(p, _gp, _avgR); return; }
      let ch = 0.45 * ALTERUNG_TEMPO(p);
      if (_gp >= 8) ch = clamp2(ch + (6.9 - _avgR) * 0.14, 0.10, 0.80);
      if (Math.random() < ch) {
        const areas = [['def',p.def],['mid',p.mid],['att',p.att]].sort((a,b)=>b[1]-a[1]);
        p[areas[0][0]] = clamp2(p[areas[0][0]] - 1, 15, 99);
        // Tempo geht bei tempoabhängigen Positionen zuerst und doppelt.
        p.pace = clamp2(p.pace - (ALTERUNG_TEMPO(p) >= 1.15 ? 2 : 1), 15, 99);
        p.ovr = computeOvrFromAreas(p);
      } else if (_gp >= 12 && _avgR >= 7.8 && p.ovr < pot && Math.random() < 0.30) {
        // Die Ausnahme: der Oldie, der noch einmal zulegt. Nur über den Kopf.
        p.mental = clamp2(p.mental + 1, 20, 99);
        p.mid = clamp2(p.mid + 1, 20, 99);
        p.ovr = Math.min(pot, computeOvrFromAreas(p));
      }
    }
  });
  for (let i=SQUAD.length-1;i>=0;i--) {
    if (SQUAD[i].onLoanFrom) { clearFromLineup(SQUAD[i].id); SQUAD.splice(i,1); }
  }
  SQUAD.forEach(p => { if(p.onLoanAt) delete p.onLoanAt; });
  // Verträge: alle sicherstellen, dann auslaufende markieren (Spieler entscheidet manuell)
  SQUAD.forEach(p => ensureContract(p, LEAGUE.season));
  SQUAD.forEach(p => { p.expiring = (p.contractUntil != null && p.contractUntil < LEAGUE.season); });

  // ABLÖSEFREIE ABGÄNGE. Bisher wurden auslaufende Verträge nur markiert — ohne
  // jede Konsequenz: über drei Saisons blieben Spieler ohne gültigen Vertrag
  // einfach im Kader, der Kader veränderte sich nie und alterte nur. Jetzt gilt:
  // erste Saison ohne Vertrag = Warnung, zweite = der Spieler geht ablösefrei.
  // Sicherheitsnetz: der Kader fällt nie unter 14 Spieler.
  const weg = [];
  // Erst markieren, dann gezielt abgeben. Das Kontingent MUSS vorab feststehen —
  // eine Prüfung „SQUAD.length <= 14" mitten in der Schleife hielt nicht, weil
  // parallel auch Leihrückkehrer den Kader verkleinern (gemessen: Kader fiel auf
  // 10 Spieler, damit ließ sich keine Elf mehr aufstellen).
  SQUAD.forEach(p => {
    if (!p.expiring) delete p._ohneVertragSeit;
    else if (p._ohneVertragSeit == null) p._ohneVertragSeit = LEAGUE.season;
  });
  const KADER_MIN = 16;
  let darfGehen = Math.max(0, SQUAD.length - KADER_MIN);
  if (darfGehen > 0) {
    // Die schwächsten zuerst gehen lassen — der Verein hält seine Leistungsträger
    const kandidaten = SQUAD.filter(p => p.expiring && p._ohneVertragSeit != null &&
                                         p._ohneVertragSeit < LEAGUE.season)
                            .sort((a, b) => (a.ovr || 0) - (b.ovr || 0));
    for (const p of kandidaten) {
      if (darfGehen <= 0) break;
      const i = SQUAD.indexOf(p);
      if (i < 0) continue;
      clearFromLineup(p.id);
      SQUAD.splice(i, 1);
      weg.push(p.name);
      darfGehen--;
    }
  }
  if (weg.length) {
    addNews('club', `${weg.length} Spieler ablösefrei abgegeben`,
      `${weg.join(', ')} ${weg.length === 1 ? 'hatte' : 'hatten'} seit zwei Saisons keinen gültigen Vertrag mehr und ${weg.length === 1 ? 'hat' : 'haben'} den Verein ablösefrei verlassen. Verlängere Verträge rechtzeitig im Verein-Tab.`);
  }

  // 2026-10-21 (Fehleranalyse F4): Wer nur wegen des Kader-Minimums bleibt, bekommt vom Vorstand ein Jahr zum alten Gehalt –
  // vorher standen Spieler über Saisons mit „Vertrag abgelaufen“ im Kader
  const notvertrag = SQUAD.filter(p => p.expiring && p._ohneVertragSeit != null && p._ohneVertragSeit < LEAGUE.season);
  notvertrag.forEach(p => { p.contractUntil = LEAGUE.season; delete p.expiring; delete p._ohneVertragSeit; });
  if (notvertrag.length) addNews('club', `${notvertrag.length} Notvertr${notvertrag.length === 1 ? 'ag' : 'äge'}`,
    `Der Kader darf nicht unter ${KADER_MIN} Spieler fallen – der Vorstand hat ${notvertrag.map(p => p.name).join(', ')} um ein Jahr zum alten Gehalt verlängert.`);
  const expCount = SQUAD.filter(p=>p.expiring).length;
  if (expCount > 0) addNews('club', `${expCount} ${expCount===1?'Vertrag läuft':'Verträge laufen'} aus`, `${expCount} Spieler ${expCount===1?'hat':'haben'} keinen Vertrag mehr. Kader → Verträge.`);
  if (tierBefore !== tierAfter) {
    const before = defaultBudgetForTier(tierBefore), after = defaultBudgetForTier(tierAfter);
    if (after > before) CLUB.budget += Math.round((after-before)*0.4);
    else CLUB.budget = Math.max(Math.round(CLUB.budget*0.7), Math.round(after*0.5));
    // Gehaltsbudget-Limit beim Auf-/Abstieg anpassen
    CLUB.wageCap = defaultWageBudgetForTier(tierAfter);
    addNews('club', '💰 Gehaltsbudget angepasst', `Nach dem ${tierAfter > tierBefore ? 'Aufstieg' : 'Abstieg'} beträgt das neue Gehaltsbudget-Limit ${formatEuro(CLUB.wageCap)}/Woche.`);
  }
  CLUB.wageBudget = Math.max(0, (CLUB.wageCap||0) - totalWeeklyWages(SQUAD));
  const newTalents = generateYouthProspects();
  if (newTalents > 0) {
    addNews('club', 'Neue Talente aus der Jugendakademie', `${newTalents} neue${newTalents===1?'s':''} Nachwuchstalent${newTalents===1?'':'e'} ${newTalents===1?'ist':'sind'} in die Akademie gekommen. Schau im Tab „Nachwuchs & Scouting" vorbei.`);
  } else {
    addNews('club', 'Akademie voll', `Es sind keine neuen Nachwuchstalente nachgerückt — die Akademie ist voll. Ziehe Talente hoch oder entlasse welche, um Platz zu schaffen.`);
  }
  // Aufstieg für Sponsor-Boni markieren (Top-3/Pokal wurden in startNewSeason vor
  // runEndOfSeason erfasst, solange Abschlusstabelle/Cup noch standen).
  if (CLUB._seasonAchievements) {
    const _to = ['regionalliga','liga3','bundesliga2','bundesliga'];
    CLUB._seasonAchievements.promotion = _to.indexOf(tierAfter) > _to.indexOf(tierBefore);
  }
  processSponsorsEndOfSeason();
  // Bannerwerbung: jährliche Einnahme je verkauftem Bannerplatz
  const bannerIncome = bannerIncomePerSeason();
  if (bannerIncome > 0) {
    // NICHT mehr aufs Budget buchen: die Bannereinnahmen stehen bereits in der
    // Saisonplanung des Vorstands (fixIncome). Sie hier ein zweites Mal
    // gutzuschreiben hat dasselbe Geld doppelt gezählt — ein Regionalligist
    // stand mit 1,7 Mio da, wo der Vorstand 120k geplant hatte.
    addNews('club', 'Bannerwerbung abgerechnet', `${bannerSlotsSold()} Bannerplätze brachten ${formatEuro(bannerIncome)} — eingeplant im Saisonbudget.`);
  }
  refreshSponsorOffers();
  MARKET = { players: generateMarketPool(40, LEAGUE.season), stocks: MARKET ? MARKET.stocks : null };
  EXP.hookSeasonStart();   // Erwartungs-System: alte Saison abrechnen, neue Philosophie + Sponsorenauswahl
}

// ── RENDERING: TRANSFERMARKT ─────────────────────────────────────
let TR_FILTER = 'ALL';
const NEWS_ICONS = { match:'<i class="ti ti-ball-football"></i>', transfer:'<i class="ti ti-cash"></i>', cup:'<i class="ti ti-trophy"></i>', season:'<i class="ti ti-calendar"></i>', club:'<i class="ti ti-building"></i>' };
function addNews(category, title, text) {
  if (!CLUB.news) CLUB.news = [];
  CLUB.news.unshift({ category, title, text, season: LEAGUE ? LEAGUE.season : 1, matchday: LEAGUE ? LEAGUE.matchday : 0, ts: Date.now() });
  if (CLUB.news.length > 60) CLUB.news.length = 60;
}
const FACILITY_DEFS = {
  youth: {
    name:'Jugendakademie', icon:'🌱', iconClass:'youth', maxLevel:10,
    desc:'Mehr Nachwuchsplätze (3 bis 7) und stärkere Talente.',
    levelDesc:['Bolzplatz','Kreisliga-Niveau','Lokale Jugendarbeit','Solide Jugendarbeit','Regionales Leistungszentrum','Anerkanntes NLZ','Modernes NLZ','Elite-Nachwuchszentrum','Top-Talentschmiede','Weltklasse-Akademie'],
    cost:[0, 40000, 90000, 180000, 460000, 1010000, 2480000, 5200000, 9780000, 17600000]
  },
  training: {
    name:'Trainingsgelände', icon:'🏃', iconClass:'training', maxLevel:10,
    desc:'Schnellere Entwicklung der Spieler unter 24.',
    levelDesc:['Einfacher Bolzplatz','Vereinsanlage','Erweiterte Anlage','Modernes Zentrum','Leistungszentrum','Profi-Anlage','Profi-Leistungszentrum','High-Tech-Campus','Spitzen-Trainingscampus','Weltklasse-Campus'],
    cost:[0, 40000, 80000, 160000, 400000, 900000, 2160000, 4550000, 8500000, 15400000]
  },
  scouting: {
    name:'Scouting-Abteilung', icon:'🔭', iconClass:'scouting', maxLevel:10,
    desc:'Stärkere und internationalere Spieler auf dem Markt.',
    levelDesc:['Ein Regionalscout','Kleines Scoutteam','Nationales Netzwerk','Erweitertes Netzwerk','Europäische Kontakte','Internationales Team','Globales Netzwerk','Datengestütztes Scouting','KI-Analyse-Abteilung','Weltweites Elite-Scouting'],
    cost:[0, 40000, 100000, 210000, 520000, 1120000, 2700000, 5660000, 10620000, 19250000]
  },
  stadium: {
    name:'Stadion', icon:'🏟️', iconClass:'stadium', maxLevel:10,
    desc:'Mehr Plätze, mehr Zuschauereinnahmen.',
    levelDesc:['6.000 Plätze','9.000 Plätze','13.000 Plätze','18.000 Plätze','25.000 Plätze','33.000 Plätze','42.000 Plätze','52.000 Plätze','62.000 Plätze','75.000 Plätze'],
    cost:[0, 120000, 310000, 650000, 1700000, 3920000, 9900000, 21450000, 40800000, 74800000],
    capacity:[6000, 9000, 13000, 18000, 25000, 33000, 42000, 52000, 62000, 75000]
  },
  merchandising: {
    name:'Merchandising', icon:'🛍️', iconClass:'merch', maxLevel:10,
    desc:'Mehr Einnahmen aus Trikots und Fanartikeln.',
    levelDesc:['Kleiner Fanshop','Vereinsshop','Online-Shop','Regionale Vermarktung','Professioneller Vertrieb','Überregionale Marke','Nationale Vermarktung','Internationaler Handel','Globale Marke','Weltmarke'],
    cost:[0, 90000, 240000, 560000, 1300000, 3100000, 7200000, 15800000, 30500000, 56000000]
  }
};
function stadiumCapacityForLevel(lvl) { return FACILITY_DEFS.stadium.capacity[lvl-1] || 6000; }
// Nachwuchsplätze je Akademie-Stufe: Stufe 1 = 3 Plätze, Ausbau bis max. 7 Plätze (Stufe 9-10).
function youthCapacityForLevel(lvl) {
  const caps = [3, 3, 4, 4, 5, 5, 6, 6, 7, 7]; // Index 0 = Stufe 1
  return caps[Math.max(1, Math.min(10, lvl || 1)) - 1];
}

// ── TICKET- & DAUERKARTENPREISE ───────────────────────────────
// Pro Liga ein Durchschnittspreis (Stufe 0) plus je 2 Abstufungen nach oben/unten.
// CLUB.ticketLevel und CLUB.seasonTicketLevel laufen jeweils von -2 bis +2.
const TICKET_PRICING = {
  bundesliga:  { ticket:[27,33,40,50,62],  season:[420,520,620,780,950] },
  bundesliga2: { ticket:[18,22,27,34,42],  season:[280,350,420,520,640] },
  liga3:       { ticket:[12,15,18,23,28],  season:[190,240,280,350,430] },
  regionalliga:{ ticket:[7,9,11,14,17],    season:[110,135,170,210,260] }
};
// Anteil der Kapazität, der als Dauerkarten verkauft wird — bei mittlerem Preis.
const SEASON_TICKET_SHARE = 0.45;
// Der DAUERKARTENPREIS hatte bisher keinerlei Wirkung außer auf den Preis selbst:
// die verkaufte Menge lag fest bei 45 % der Kapazität, egal ob man 110 € oder
// 260 € verlangte. Damit war die höchste Stufe immer die beste Wahl und der
// Regler sinnlos. Jetzt entscheidet der Preis über die ABNEHMER:
// Stufe −2 (billig) 58 % · −1 52 % · 0 45 % · +1 37 % · +2 28 %.
// Teurer bringt also mehr je Karte, aber deutlich weniger Karten — und die
// Treuen im Stadion sind der Block, der auch bei Misserfolg kommt.
const SEASON_TICKET_SHARE_BY_LEVEL = [0.58, 0.52, 0.45, 0.37, 0.28];
function dauerkartenAnteil() {
  return SEASON_TICKET_SHARE_BY_LEVEL[ticketLevelIndex(CLUB.seasonTicketLevel)] || SEASON_TICKET_SHARE;
}
const HOME_MATCHDAYS_PER_SEASON = 17; // grobe Heimspielzahl für die Dauerkarten-Umlage

function tierKeyOf() {
  try { return findFcmGroup(LEAGUE).tierKey; } catch(e) { return 'regionalliga'; }
}
function ticketPricingForTier(tierKey) { return TICKET_PRICING[tierKey] || TICKET_PRICING.regionalliga; }
function ticketLevelIndex(level) { return Math.max(0, Math.min(4, (level||0) + 2)); } // -2..2 → 0..4
function currentTicketPrice() {
  const pr = ticketPricingForTier(tierKeyOf());
  return pr.ticket[ticketLevelIndex(CLUB.ticketLevel)];
}
function currentSeasonTicketPrice() {
  const pr = ticketPricingForTier(tierKeyOf());
  return pr.season[ticketLevelIndex(CLUB.seasonTicketLevel)];
}

// Erfolg des FCM: Tabellenplatz (oben = besser) + jüngste Form, normiert auf 0..1
function fcmSuccessFactor() {
  try {
    const fg = findFcmGroup(LEAGUE);
    const tbl = computeTable(fg.group.teams);
    const n = tbl.length;
    const pos = tbl.findIndex(t => t.id === 'fcm') + 1;
    if (pos < 1) return 0.5;
    // Platz 1 → 1.0, letzter Platz → 0.0
    const posScore = (n - pos) / Math.max(1, n - 1);
    // Punkteschnitt als Formindikator (0 bis 3 Pkt/Spiel → 0..1)
    const fcm = tbl.find(t => t.id === 'fcm');
    const ppg = fcm && fcm.played ? fcm.pts / fcm.played : 1.2;
    const formScore = Math.max(0, Math.min(1, ppg / 3));
    return Math.max(0, Math.min(1, posScore * 0.6 + formScore * 0.4));
  } catch(e) { return 0.5 }
}

// Auslastung (0..1) für das nächste/aktuelle Heimspiel.
// Erfolg zieht stark nach oben, Preis dämpft nur schwach-moderat.
// opponentOvr (optional) gibt einen kleinen Topspiel-Bonus.
function stadiumFillRate(opponentOvr) {
  const base = 0.55;
  const success = fcmSuccessFactor();          // 0..1
  const successBonus = success * 0.42;          // bis +42% durch sportlichen Erfolg
  // Preis-Dämpfung: Tageskarte stark, Dauerkarte halb so stark — wer teure
  // Dauerkarten verlangt, hat weniger Abonnenten (siehe dauerkartenAnteil), und
  // das drückt zusätzlich die Grundauslastung.
  // Gemessen war die alte Dämpfung (0,05 je Stufe, nur Tageskarte) viel zu
  // schwach: die teuerste Einstellung brachte 1,64 Mio gegen 576k bei der
  // billigsten und kostete nur 8 % Zuschauer. Damit war der Regler eine
  // Scheinentscheidung. Jetzt kostet Preistreiberei spürbar Publikum.
  const priceLevel = (CLUB.ticketLevel || 0);   // -2..2
  const seasonLevel = (CLUB.seasonTicketLevel || 0);
  const pricePenalty = priceLevel * 0.09 + seasonLevel * 0.05;
  // Topspiel-Bonus: starker Gegner lockt zusätzlich
  let oppBonus = 0;
  if (typeof opponentOvr === 'number') oppBonus = Math.max(0, Math.min(0.08, (opponentOvr - 65) / 250));
  // Stadionkomfort: bessere Arena zieht minimal mehr (Stufe 1..10)
  const comfort = ((CLUB.facilities.stadium||1) - 1) * 0.006;
  let fill = base + successBonus - pricePenalty + oppBonus + comfort;
  // Bei sehr gutem Lauf bleibt das Stadion praktisch voll, egal was das Ticket kostet
  if (success > 0.72) fill = Math.max(fill, 0.90 + (success - 0.72) * 0.4);
  return Math.max(0.30, Math.min(1, fill));
}

// Zuschauereinnahmen eines Heimspiels = Tageskarten + anteilige Dauerkarten-Umlage
function matchAttendanceIncome(opponentOvr) {
  const cap = stadiumCapacityForLevel(CLUB.facilities.stadium);
  const fill = stadiumFillRate(opponentOvr);
  const attendance = Math.round(cap * fill);
  const seasonBlock = Math.round(cap * dauerkartenAnteil());          // Dauerkartenplätze (immer "da")
  const dayTickets = Math.max(0, attendance - seasonBlock);           // restliche Plätze als Tageskarten
  const dayIncome = dayTickets * currentTicketPrice();
  // Dauerkarten zahlen einmal pro Saison → pro Heimspiel anteilig umgelegt
  const seasonIncome = Math.round(seasonBlock * currentSeasonTicketPrice() / HOME_MATCHDAYS_PER_SEASON);
  // ── Erwartungs-System: Fan-Zufriedenheit beeinflusst die Einnahmen ──
  // Hohe Zufriedenheit → ausverkauftes Haus & Aufschlag (bis +25%),
  // niedrige → Zuschauerschwund (bis -20%).
  const satMult = (typeof EXP !== 'undefined') ? EXP.ticketSatisfactionMult() : 1;
  const adjAtt = Math.round(attendance * Math.min(1, satMult)); // Zuschauerzahl sinkt bei Unzufriedenheit, nicht über Kapazität
  const dayIncomeAdj = Math.round(dayIncome * satMult);
  const seasonIncomeAdj = Math.round(seasonIncome * satMult);
  return { attendance: adjAtt, dayTickets, seasonBlock, dayIncome: dayIncomeAdj, seasonIncome: seasonIncomeAdj, total: dayIncomeAdj + seasonIncomeAdj, fill: fill * Math.min(1, satMult), satMult };
}

// ── BANNERWERBUNG ─────────────────────────────────────────────
// Mehr Bannerplätze je größer das Stadion; Wert pro Banner steigt mit der Liga.
const BANNER_VALUE_PER_TIER = {
  bundesliga: 120000, bundesliga2: 45000, liga3: 16000, regionalliga: 5000
};
function bannerSlotsForStadium(lvl) { return (lvl||1) * 2; }       // Stufe 1 → 2 Plätze, Stufe 10 → 20 Plätze
function bannerValuePerSlot() { return BANNER_VALUE_PER_TIER[tierKeyOf()] || 5000; }
// Wie viele Bannerplätze tatsächlich verkauft sind (vom Spieler gesetzt, gedeckelt auf Maximum)
function bannerSlotsSold() {
  const max = bannerSlotsForStadium(CLUB.facilities.stadium);
  if (CLUB.bannerSlotsSold === undefined || CLUB.bannerSlotsSold === null) return max; // default: alle verkauft
  return Math.max(0, Math.min(max, CLUB.bannerSlotsSold));
}
function bannerIncomePerSeason() { return bannerSlotsSold() * bannerValuePerSlot(); }

// Rückwärtskompatibler Name: einige Stellen rufen noch ticketIncomePerMatch().
// Liefert jetzt die erwarteten Zuschauereinnahmen eines durchschnittlichen Heimspiels.
function ticketIncomePerMatch() { return matchAttendanceIncome().total; }

function facilityTier(level) { return Math.min(3, Math.floor((level-1)/3)); }

// ── SVG-ILLUSTRATIONEN: werden mit jedem Tier (alle 3 Stufen) moderner ──
function facilityImage(key, level) {
  const tier = facilityTier(level); // 0,1,2,3
  const sky = ['#1a2433','#1a2c40','#16304a','#0f3a5a'][tier];
  const ground = ['#2a3a22','#2e4226','#27482a','#1a4a3a'][tier];
  if (key === 'stadium') {
    // wächst von offener Tribüne zu überdachter Arena mit Flutlicht
    const standH = [18,26,34,42][tier];
    const roof = tier>=1;
    const lights = tier>=2;
    const screen = tier>=3;
    return `<svg viewBox="0 0 200 90" class="fc-img" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="90" fill="${sky}"/>
      ${lights?'<line x1="30" y1="8" x2="30" y2="30" stroke="#444" stroke-width="2"/><circle cx="30" cy="8" r="5" fill="#fff7cc"/><line x1="170" y1="8" x2="170" y2="30" stroke="#444" stroke-width="2"/><circle cx="170" cy="8" r="5" fill="#fff7cc"/>':''}
      <ellipse cx="100" cy="78" rx="92" ry="20" fill="${ground}"/>
      <ellipse cx="100" cy="78" rx="55" ry="11" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
      <rect x="96" y="68" width="8" height="20" fill="rgba(255,255,255,0.15)"/>
      <path d="M20 ${68-standH} Q15 ${66-standH} 14 72 L186 72 Q185 ${66-standH} 180 ${68-standH} Z" fill="#3a4452"/>
      <path d="M20 ${68-standH} L180 ${68-standH} L180 ${64-standH} L20 ${64-standH} Z" fill="#4a5566"/>
      ${roof?`<path d="M10 ${62-standH} L190 ${62-standH} L185 ${56-standH} L15 ${56-standH} Z" fill="#5a6577"/>`:''}
      ${screen?'<rect x="84" y="14" width="32" height="18" rx="2" fill="#0a0a0a" stroke="#666"/><rect x="86" y="16" width="28" height="14" fill="#1a3a5a"/>':''}
      ${Array.from({length:tier+2},(_,i)=>`<circle cx="${40+i*30}" cy="${66-standH+6}" r="1.5" fill="rgba(255,255,255,0.5)"/>`).join('')}
    </svg>`;
  }
  if (key === 'youth') {
    const building = [30,40,52,64][tier];
    const floors = tier+1;
    const winCount = tier>=3?4:3;
    const winSpacing = tier>=3?20:18;
    const buildingW = tier>=3?90:70;
    const winColor = tier>=2?'#7ab8f5':'#5a6577';
    const treeX = tier>=3?150:120;
    const treeRectX = tier>=3?147:117;
    let windows = '';
    for (let f=0; f<floors; f++) {
      for (let w=0; w<winCount; w++) {
        windows += `<rect x="${28+w*winSpacing}" y="${(88-building)+8+f*16}" width="10" height="9" fill="${winColor}"/>`;
      }
    }
    return `<svg viewBox="0 0 200 90" class="fc-img" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="90" fill="${sky}"/>
      <rect y="62" width="200" height="28" fill="${ground}"/>
      ${tier>=2?'<rect x="120" y="50" width="70" height="40" fill="#2e3a30"/><rect x="124" y="40" width="62" height="12" fill="#3a4a3c"/>':''}
      <rect x="20" y="${88-building}" width="${buildingW}" height="${building}" fill="#3a4452"/>
      ${windows}
      <circle cx="${treeX}" cy="74" r="7" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <rect x="${treeRectX}" y="62" width="6" height="6" fill="rgba(255,255,255,0.3)"/>
      ${tier>=1?'<path d="M95 88 L95 70 L110 70 L110 88" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>':''}
    </svg>`;
  }
  if (key === 'training') {
    const fields = tier+1;
    return `<svg viewBox="0 0 200 90" class="fc-img" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="90" fill="${sky}"/>
      <rect y="40" width="200" height="50" fill="${ground}"/>
      ${tier>=2?'<rect x="140" y="28" width="55" height="34" fill="#3a4452"/><rect x="144" y="32" width="47" height="10" fill="#5a6577"/>':''}
      ${Array.from({length:fields},(_,i)=>`<rect x="${12+i*48}" y="${50+i*0}" width="42" height="26" rx="2" fill="${tier>=1?'#2e6b3a':'#3a5a2a'}" stroke="rgba(255,255,255,0.3)"/><line x1="${33+i*48}" y1="50" x2="${33+i*48}" y2="76" stroke="rgba(255,255,255,0.25)"/>`).join('')}
      ${tier>=3?'<circle cx="100" cy="20" r="6" fill="#fff7cc"/><line x1="100" y1="6" x2="100" y2="14" stroke="#444" stroke-width="2"/>':''}
      ${tier>=1?'<circle cx="30" cy="30" r="2" fill="#fff"/><circle cx="50" cy="34" r="2" fill="#fff"/>':''}
    </svg>`;
  }
  if (key === 'scouting') {
    // vom einzelnen Scout mit Fernglas zum globalen Netzwerk mit Weltkarte
    return `<svg viewBox="0 0 200 90" class="fc-img" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="90" fill="${sky}"/>
      ${tier>=2?`<circle cx="100" cy="45" r="34" fill="none" stroke="rgba(122,184,245,0.3)" stroke-width="1"/><ellipse cx="100" cy="45" rx="34" ry="14" fill="none" stroke="rgba(122,184,245,0.3)"/><ellipse cx="100" cy="45" rx="14" ry="34" fill="none" stroke="rgba(122,184,245,0.3)"/><line x1="66" y1="45" x2="134" y2="45" stroke="rgba(122,184,245,0.3)"/>`:''}
      ${tier>=3?Array.from({length:7},(_,i)=>`<circle cx="${40+i*20}" cy="${30+(i%3)*18}" r="2.5" fill="#7ab8f5"/><line x1="100" y1="45" x2="${40+i*20}" y2="${30+(i%3)*18}" stroke="rgba(122,184,245,0.4)" stroke-width="0.7"/>`).join(''):''}
      ${tier===1?'<circle cx="60" cy="40" r="3" fill="#7ab8f5"/><circle cx="140" cy="55" r="3" fill="#7ab8f5"/><line x1="60" y1="40" x2="140" y2="55" stroke="rgba(122,184,245,0.4)"/>':''}
      ${tier===0?'<g transform="translate(85,35)"><circle cx="8" cy="10" r="8" fill="#3a4452"/><circle cx="24" cy="10" r="8" fill="#3a4452"/><rect x="14" y="7" width="4" height="3" fill="#3a4452"/><circle cx="8" cy="10" r="4" fill="#7ab8f5"/><circle cx="24" cy="10" r="4" fill="#7ab8f5"/></g>':'<g transform="translate(88,62) scale(0.7)"><circle cx="8" cy="10" r="8" fill="#5a6577"/><circle cx="24" cy="10" r="8" fill="#5a6577"/><rect x="14" y="7" width="4" height="3" fill="#5a6577"/><circle cx="8" cy="10" r="4" fill="#7ab8f5"/><circle cx="24" cy="10" r="4" fill="#7ab8f5"/></g>'}
    </svg>`;
  }
  return '';
}
function levelBar(level, max) {
  let html = '<div class="level-pips">';
  for (let i=1;i<=max;i++) {
    html += `<span class="pip ${i<=level?'on':''}"></span>`;
  }
  html += `</div>`;
  return html;
}
const TIER_SPONSOR_BASE = {
  bundesliga:   { shirt: 12000000, sleeve: 2400000, stadium: 6000000 },
  bundesliga2:  { shirt: 3500000,  sleeve: 700000,  stadium: 2000000 },
  liga3:        { shirt: 900000,   sleeve: 180000,  stadium: 500000 },
  regionalliga: { shirt: 220000,   sleeve: 45000,   stadium: 120000 }
};
const SHIRT_SPONSOR_NAMES = ['TechNova','Brauerei Adler','AutoWelt','SolarVolt','FrischMarkt','BauStark GmbH','NordBank','PixelSoft','VitalPharma','SpeedLogistik'];
const SLEEVE_SPONSOR_NAMES = ['FlixMobil','GreenPower','SnackTime','CloudNet','KfzMeister','FitClub','BioFresh','TurboReifen','WohnBau','MediCare'];
const STADIUM_NAMER_NAMES = ['TechNova','EnergiePlus','AutoWelt','NordBank','SkyTel','FrischMarkt','BauStark','VitalPharma'];
function roundMoney(v){ if(v<100000) return Math.round(v/5000)*5000; if(v<1000000) return Math.round(v/25000)*25000; return Math.round(v/100000)*100000; }
// Stadionsponsor (Namensrechte) erst ab dieser Stadionstufe verfügbar
const STADIUM_SPONSOR_MIN_LEVEL = 4;
function stadiumSponsorUnlocked() { return (CLUB.facilities && CLUB.facilities.stadium || 1) >= STADIUM_SPONSOR_MIN_LEVEL; }
function generateSponsorOffers(tierKey, type) {
  let base = TIER_SPONSOR_BASE[tierKey][type];
  // Namensrechte werden mit der Stadiongröße wertvoller: ab Stufe 4 startet der Bonus,
  // jede weitere Stufe legt ~12% drauf (Stufe 10 ≈ +72%).
  if (type === 'stadium') {
    const lvl = (CLUB.facilities && CLUB.facilities.stadium) || 1;
    base = base * (1 + Math.max(0, lvl - STADIUM_SPONSOR_MIN_LEVEL) * 0.12);
  }
  const names = type==='shirt' ? SHIRT_SPONSOR_NAMES : type==='sleeve' ? SLEEVE_SPONSOR_NAMES : STADIUM_NAMER_NAMES;
  // Drei Angebotsprofile: viel Fixgeld ↔ hohe Erfolgsboni (Wette auf die Saison).
  // Boni sind Anteile des Jahresbetrags und werden am Saisonende bei Erfolg gezahlt.
  const PROFILES = [
    { key:'solide',       label:'Solide',       perYearFactor:1.15, dur:4, bonus:{ promotion:0.20, top3:0.10, cup:0.00 } },
    { key:'ausgewogen',   label:'Ausgewogen',   perYearFactor:1.00, dur:3, bonus:{ promotion:0.50, top3:0.25, cup:0.18 } },
    { key:'ambitioniert', label:'Ambitioniert', perYearFactor:0.82, dur:3, bonus:{ promotion:1.40, top3:0.70, cup:0.45 } }
  ];
  const offers = [];
  const usedNames = new Set();
  PROFILES.forEach((pr, i) => {
    const variance = 0.9 + Math.random()*0.2;
    const perYear = roundMoney(base * pr.perYearFactor * variance);
    const bonuses = {
      promotion: roundMoney(perYear * pr.bonus.promotion),
      top3:      roundMoney(perYear * pr.bonus.top3),
      cup:       pr.bonus.cup ? roundMoney(perYear * pr.bonus.cup) : 0
    };
    let name, tries=0; do { name = pickRnd(names); tries++; } while(usedNames.has(name) && tries<30);
    usedNames.add(name);
    offers.push({ id:type+'_'+i, name, perYear, duration:pr.dur, total: perYear*pr.dur, profile:pr.key, profileLabel:pr.label, bonuses });
  });
  return offers;
}
function refreshSponsorOffers() {
  const tierKey = findFcmGroup(LEAGUE).tierKey;
  if (!('sleeve' in CLUB.sponsors)) CLUB.sponsors.sleeve = null;
  CLUB.sponsorOffers = {
    shirt: CLUB.sponsors.shirt ? null : generateSponsorOffers(tierKey, 'shirt'),
    sleeve: CLUB.sponsors.sleeve ? null : generateSponsorOffers(tierKey, 'sleeve'),
    stadium: (CLUB.sponsors.stadium || !stadiumSponsorUnlocked()) ? null : generateSponsorOffers(tierKey, 'stadium')
  };
}
function stadiumName() {
  // 1) Stadionsponsor (Naming Rights) hat Vorrang
  if (CLUB.sponsors && CLUB.sponsors.stadium) return `${CLUB.sponsors.stadium.name}-Arena`;
  // 2) Fester Stadionname aus der Vereinsliste (falls künftig vorhanden)
  if (CLUB.stadiumName) return CLUB.stadiumName;
  // 3) Aus dem Vereinsnamen abgeleitet, sonst generisch
  return CLUB.name ? `${CLUB.name}-Stadion` : 'Stadion';
}

// ── FANBASE & MERCHANDISE ─────────────────────────────────────
// Die Fanbase wächst mit der Liga (Reichweite), dem sportlichen Erfolg und
// der Stadiongröße. Merchandise-Einnahmen pro Heimspiel = Fans × Pro-Kopf-Umsatz.
const TIER_FANBASE_BASE = {
  bundesliga: 900000, bundesliga2: 320000, liga3: 120000, regionalliga: 35000
};
const MERCH_PER_FAN = 0.55; // € pro Fan und Heimspiel (Schals, Trikots, Becher ...)
function fanbaseSize() {
  const base = TIER_FANBASE_BASE[tierKeyOf()] || 35000;
  const success = fcmSuccessFactor();                 // 0..1
  const successMult = 0.7 + success * 0.8;             // erfolglos 0.7×, Topklub bis 1.5×
  const capacity = stadiumCapacityForLevel(CLUB.facilities.stadium);
  const stadiumMult = 0.8 + Math.min(0.6, capacity / 75000 * 0.6); // großes Stadion zieht mehr Fans
  return Math.round(base * successMult * stadiumMult);
}
function merchIncomePerMatch() {
  const lvl = (CLUB.facilities && CLUB.facilities.merchandising) ? CLUB.facilities.merchandising : 1;
  // Merchandising-Stufe steigert auch die Spieltags-Einnahmen (Stufe 1 = ×1.0, Stufe 10 ≈ ×2.8)
  const lvlMul = 1 + (lvl - 1) * 0.2;
  return Math.round(fanbaseSize() * MERCH_PER_FAN * lvlMul);
}

function sponsorLabel(type) { return type==='shirt' ? 'Trikotsponsor' : type==='sleeve' ? 'Ärmelsponsor' : 'Stadionnamensrechte'; }
// Jährliche Auszahlung + Erfolgsboni + Vertragsablauf am Saisonende.
// Boni aus CLUB._seasonAchievements (wird in startNewSeason/applyEndOfSeasonClubEffects gesetzt).
function processSponsorsEndOfSeason() {
  const ach = CLUB._seasonAchievements || {};
  ['shirt','sleeve','stadium'].forEach(type => {
    const s = CLUB.sponsors[type];
    if (!s) return;
    if (s.yearsLeft > 0) {
      // Die Grundzahlung steht schon in der Saisonplanung (fixIncome liest die
      // echten Verträge) — hier NICHT noch einmal buchen. Die Erfolgsboni unten
      // sind dagegen ungeplant und werden weiterhin gutgeschrieben.
      // Erfolgsboni: Aufstieg ODER (falls kein Aufstieg) Top-3, dazu Pokal-Halbfinale.
      if (s.bonuses) {
        let bonus = 0; const reasons = [];
        if (ach.promotion && s.bonuses.promotion) { bonus += s.bonuses.promotion; reasons.push('Aufstieg'); }
        else if (ach.top3 && s.bonuses.top3) { bonus += s.bonuses.top3; reasons.push('Top-3-Platzierung'); }
        if (ach.cupSemi && s.bonuses.cup) { bonus += s.bonuses.cup; reasons.push('Pokal-Halbfinale'); }
        if (bonus > 0) {
          CLUB.budget += bonus;
          addNews('club', `💰 Sponsor-Bonus: ${s.name}`, `${sponsorLabel(type)} ${s.name} zahlt ${formatEuro(bonus)} Erfolgsprämie (${reasons.join(', ')}).`);
        }
      }
      s.yearsLeft--;
      if (s.yearsLeft === 0) {
        addNews('club', `${sponsorLabel(type)}-Vertrag mit ${s.name} ausgelaufen`, 'Neue Angebote liegen im Verein-Tab bereit.');   // Nutzer 2026-10-22: überflüssiger Text raus („Der Vertrag mit X ist beendet.“, Name steht jetzt in der Überschrift)
        CLUB.sponsors[type] = null;
      }
    }
  });
}

// (Scouting-System jetzt in js/scouting_patch.js)

// ═══════════════════════════════════════════════════════════════
// FINANZANLAGEN: TAGESGELD, AKTIEN/ETFS
// ═══════════════════════════════════════════════════════════════

// ── TAGESGELD / ZINSEN ────────────────────────────────────────
// Sicheres Parken von Geld. Verzinsung wird wöchentlich gutgeschrieben.
const SAVINGS_WEEKLY_RATE = 0.0006; // ~3,2% p.a. (52 Wochen)
function savingsAnnualRatePct() { return (Math.pow(1 + SAVINGS_WEEKLY_RATE, SEASON_WEEKS) - 1) * 100; }
function depositSavings(amount) {
  amount = Math.max(0, Math.floor(amount));
  if (amount <= 0 || amount > CLUB.budget) return false;
  CLUB.budget -= amount; CLUB.savings += amount;
  return true;
}
function withdrawSavings(amount) {
  amount = Math.max(0, Math.floor(amount));
  if (amount <= 0 || amount > CLUB.savings) return false;
  CLUB.savings -= amount; CLUB.budget += amount;
  return true;
}
function applyWeeklySavingsInterest() {
  if (!CLUB.savings || CLUB.savings <= 0) return 0;
  const interest = Math.round(CLUB.savings * SAVINGS_WEEKLY_RATE);
  CLUB.savings += interest;
  return interest;
}

// ── AKTIEN / ETFS ─────────────────────────────────────────────
// Mehrere fiktive Wertpapiere mit unterschiedlichem Risikoprofil.
// drift = erwarteter Wochentrend, vol = Schwankungsbreite pro Woche.
const STOCK_DEFS = [
  { id:'idx',  name:'GlobalIndex ETF',   ticker:'GLX', drift:0.0022, vol:0.025, start:100 },
  { id:'div',  name:'DividendenWerte AG', ticker:'DVD', drift:0.0015, vol:0.038, start:75  },
  { id:'tech', name:'NovaTech',           ticker:'NVT', drift:0.0040, vol:0.085, start:60  },
  { id:'green',name:'GreenEnergy',        ticker:'GRN', drift:0.0030, vol:0.110, start:42  }
];
function ensureMarketStocks() {
  if (!MARKET) MARKET = {};
  if (!MARKET.stocks) {
    MARKET.stocks = STOCK_DEFS.map(s => ({
      id:s.id, name:s.name, ticker:s.ticker, drift:s.drift, vol:s.vol,
      price: s.start, prevPrice: s.start,
      history: [s.start]
    }));
  }
  return MARKET.stocks;
}
function getStock(id) { return ensureMarketStocks().find(s => s.id === id); }
// Wochenkurs-Update: geometrische Zufallsbewegung mit Drift (gedeckelt nach unten)
function advanceStockPrices() {
  ensureMarketStocks().forEach(s => {
    s.prevPrice = s.price;
    // normalverteilter Schock (Box-Muller, grob)
    const u1 = Math.random() || 1e-9, u2 = Math.random();
    const z = Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2);
    const change = s.drift + s.vol * z;
    s.price = Math.max(3, +(s.price * (1 + change)).toFixed(2));
    s.history.push(s.price);
    if (s.history.length > 40) s.history.shift();
  });
}
function stockWeekChangePct(s) {
  if (!s.prevPrice) return 0;
  return (s.price - s.prevPrice) / s.prevPrice * 100;
}
function portfolioShares(id) { return (CLUB.portfolio && CLUB.portfolio[id]) || 0; }
function portfolioValue() {
  return ensureMarketStocks().reduce((sum, s) => sum + portfolioShares(s.id) * s.price, 0);
}
function buyStock(id, shares) {
  shares = Math.max(0, Math.floor(shares));
  const s = getStock(id); if (!s || shares <= 0) return false;
  const cost = Math.ceil(s.price * shares);
  if (cost > CLUB.budget) return false;
  CLUB.budget -= cost;
  if (!CLUB.portfolio) CLUB.portfolio = {};
  CLUB.portfolio[id] = portfolioShares(id) + shares;
  return cost;
}
function sellStock(id, shares) {
  shares = Math.max(0, Math.floor(shares));
  const s = getStock(id); if (!s || shares <= 0) return false;
  const have = portfolioShares(id);
  if (shares > have) shares = have;
  if (shares <= 0) return false;
  const proceeds = Math.floor(s.price * shares);
  CLUB.budget += proceeds;
  CLUB.portfolio[id] = have - shares;
  return proceeds;
}

// Casino (Roulette, Slots, Blackjack) am 2026-10-15 entfernt – Glücksspiel verhindert die Store-Freigabe.

const G = {
  min:0, homeGoals:0, awayGoals:0,
  momentum:52,        // 0=away dominates, 100=home dominates
  riskLevel:0,        // -2 (sehr defensiv) .. +2 (volles Risiko) — von Trainer-Entscheidungen gesetzt
  shots:[0,0], poss:[50,50], fouls:[0,0], corners:[0,0],
  passAtt:[0,0], passComp:[0,0],   // Pässe versucht / angekommen
  passAcc:[78,78],                 // Passgenauigkeit % (rollend, glatt animiert)
  duelsWon:[0,0],                  // gewonnene Zweikämpfe
  duelQuote:[50,50],                // Zweikampfquote % (gewonnene Zweikämpfe / gesamt)
  cards:[], interval:null, running:false,
  halfDone:false, ended:false, paused:false,
  decisions:[],       // log of decisions made
  goalLog:[],         // {min, team, momentumAtTime}
  momentumLog:[],     // {min, value} sampled every 5min
  chanceRates:[0,0],  // chances per minute
  chanceCounts:[0,0],
  upsets:0,           // goals against momentum
  playerStatus:{}     // player name → status string
};

// ── MOMENTUM ENGINE ──────────────────────────────────────────
function momentumToProbs() {
  const m = G.momentum; // 0-100, higher=home better
  const risk = G.riskLevel || 0; // -2..2, von Trainer-Entscheidungen gesetzt
  // Base shot probability per minute from momentum + eigenes Risiko-Level
  const homeChance = 0.04 + (m / 100) * 0.09 + risk * 0.009;   // mehr Risiko = mehr eigene Abschlüsse
  // Risiko geht in beide Richtungen: volles Risiko öffnet Räume für gegnerische Konter,
  // sehr defensiv schließt diese Räume (weniger Konter-Chancen für den Gegner)
  const awayChance = 0.04 + ((100-m) / 100) * 0.09 + Math.max(0,risk) * 0.013 - Math.max(0,-risk) * 0.006;
  // Shot-on-goal conversion (base + team attack factor)
  const homeConv = 0.18 + (TEAMS.home.attack - 60) / 200;
  const awayConv = 0.18 + (TEAMS.away.attack - 60) / 200 + Math.max(0,risk) * 0.015; // offene Räume = leichtere Konter-Abschlüsse
  // BUT: underdog can always score — minimum 30% of favourite chance
  const finalHome = Math.max(0.02, homeChance, awayChance * 0.30);
  const finalAway = Math.max(0.02, awayChance, homeChance * 0.30);
  return { homeChance:finalHome, awayChance:finalAway, homeConv, awayConv };
}

function driftMomentum() {
  // Natural drift toward team strength advantage
  const strAdv = (TEAMS.home.str - TEAMS.away.str) / 100 * 3;
  const noise = (Math.random()-0.48) * 6;
  const redPenalty = (TEAMS.home.redCards - TEAMS.away.redCards) * 8;
  // Pass- und Zweikampfwerte fließen leicht in den Momentum-Trend ein:
  // wer präziser passt und mehr Zweikämpfe gewinnt, hält den Ball besser
  // und drückt das Momentum langsam zu seinen Gunsten.
  const passDiff = (G.passAcc[0] - G.passAcc[1]) / 100 * 1.6;
  const duelDiff = (G.duelQuote[0] - G.duelQuote[1]) / 100 * 1.4;
  G.momentum = Math.max(5, Math.min(95, G.momentum + strAdv + noise - redPenalty + passDiff + duelDiff));
  // Possession follows momentum with lag
  const targetPoss = Math.round(35 + G.momentum * 0.30);
  G.poss[0] = Math.round(G.poss[0] * 0.85 + targetPoss * 0.15);
  G.poss[1] = 100 - G.poss[0];
}

// ── PÄSSE & ZWEIKÄMPFE ────────────────────────────────────────
function simulatePassesAndDuels() {
  // Pässe: Anzahl der Versuche orientiert sich am Ballbesitz, die Quote
  // an der mentalen Stärke des Teams und am aktuellen Momentum-Druck.
  [0,1].forEach(t => {
    const team = t===0 ? TEAMS.home : TEAMS.away;
    const possShare = G.poss[t] / 100;
    const attempts = Math.max(2, Math.round(4 + possShare * 9 + (Math.random()*3 - 1)));
    const pressureFactor = t===0 ? (G.momentum-50)/600 : ((100-G.momentum)-50)/600;
    const redPenalty = team.redCards * 0.04;
    const chance = Math.min(0.94, Math.max(0.52, 0.74 + (team.mental-65)/260 + pressureFactor - redPenalty));
    const completed = Math.round(attempts * chance);
    G.passAtt[t] += attempts;
    G.passComp[t] += completed;
  });
  G.passAcc[0] = Math.round(G.passComp[0] / Math.max(1, G.passAtt[0]) * 100);
  G.passAcc[1] = Math.round(G.passComp[1] / Math.max(1, G.passAtt[1]) * 100);

  // Zweikämpfe: pro Minute werden 1-3 Duelle ausgetragen, deren Ausgang
  // von Team-Stärke und Momentum abhängt (wer dominiert, gewinnt öfter).
  const duelCount = 1 + Math.floor(Math.random()*3);
  for(let i=0;i<duelCount;i++) {
    const homeWinChance = 0.5 + (TEAMS.home.str - TEAMS.away.str)/250 + (G.momentum-50)/400;
    if(Math.random() < Math.min(0.85, Math.max(0.15, homeWinChance))) G.duelsWon[0]++;
    else G.duelsWon[1]++;
  }
  const totalDuels = Math.max(1, G.duelsWon[0] + G.duelsWon[1]);
  G.duelQuote[0] = Math.round(G.duelsWon[0] / totalDuels * 100);
  G.duelQuote[1] = 100 - G.duelQuote[0];
}

function getMomColor(m) {
  if(m > 65) return '#388bfd';
  if(m < 35) return '#da3633';
  return '#d29922';
}

function getMomLabel(m) {
  if(m > 75) return '🔵 ' + clubShort() + ' dominant';
  if(m > 60) return '🔵 ' + clubShort() + ' leicht besser';
  if(m > 45) return '⚖️ Ausgeglichen';
  if(m > 30) return '🔴 '+TEAMS.away.shortTag+' leicht besser';
  return '🔴 '+TEAMS.away.shortTag+' dominant';
}

// ── CHANCE RATE DISPLAY ──────────────────────────────────────
function getRiskInfo(level) {
  const lv = level || 0;
  if(lv <= -2) return { text:'Sehr defensiv', color:'#388bfd' };
  if(lv === -1) return { text:'Defensiv', color:'#3fb950' };
  if(lv === 0) return { text:'Neutral', color:'var(--text2)' };
  if(lv === 1) return { text:'Offensiv', color:'var(--gold)' };
  return { text:'Volles Risiko', color:'var(--red)' };
}
const DECISION_LABELS = {
  red_defensive:'5-4-0 Defensivblock (Rote Karte)', red_hold:'Formation gehalten (Rote Karte)', red_attack:'Volles Risiko trotz Unterzahl',
  opp_red_press:'Hohes Pressing (Überzahl)', opp_red_control:'Kontrolliert (Überzahl)',
  equalizer_push:'Auf den Sieg gedrängt (nach Ausgleich)', equalizer_balanced:'Geordnet weitergespielt (nach Ausgleich)', equalizer_secure:'Punkt gesichert (nach Ausgleich)',
  sub_offensive:'Offensivwechsel', sub_defensive:'Defensiv stabilisiert', pressing:'Hohes Pressing (Schlussphase)'
};
let homePlayers = ['Maier','Schmidt','Bauer','Fischer','Wagner','Müller','Huber','Klein','Braun','Reiter','Gruber'];
const awayPlayers = ['Kraft','Lehmann','Weber','Hoffmann','Schulz','Richter','Koch','Becker','Wolff','Zimmermann','Schäfer'];
function homeChanceText() {
  const p = () => homePlayers[1 + rndN(homePlayers.length-1)];
  return pickRnd([
    `${p()} zieht ab — knapp vorbei!`,
    `${p()} mit Traumlauf — Torhüter pariert!`,
    `Eckball ${clubShort()} — Kopfball ${p()} an den Pfosten!`,
    `Freistoß ${p()} — über die Mauer, knapp am Tor vorbei!`,
    `Konter ${clubShort()} — ${p()} schießt — Torhüter lenkt über die Latte!`
  ]);
}
function awayChanceText() {
  const tag = TEAMS.away.shortTag || 'Gegner';
  return pickRnd([
    `Gegner tritt ab — ${homePlayers[0]} hält sicher!`,
    `${tag}-Angriff — ${homePlayers[1+rndN(homePlayers.length-1)]} blockt im letzten Moment!`,
    `Flanke ${tag} — Kopfball drüber!`,
    `Freistoß ${tag} — an der Mauer abgefälscht, Ecke!`,
    `Konter ${tag} — Schuss neben das Tor!`
  ]);
}


// ═══════════════════════════════════════════════════════════════════════════
// ERWARTUNGS-SYSTEM  (Vorstand · Fans · Sponsoren)
// ───────────────────────────────────────────────────────────────────────────
// Gekapseltes Subsystem. Die Engine ruft nur die EXP.hook* Funktionen auf.
// Aller State lebt unter CLUB.expectations. Pools sind Daten (siehe unten),
// damit neue Philosophien/Klauseln durch Hinzufügen EINES Objekts entstehen.
//
// ANDOCK-PUNKTE (Hooks), die die Engine aufruft:
//   EXP.hookSeasonStart()          – am Ende von runEndOfSeason(): Philosophie
//                                     ziehen, Saisonziele berechnen, 3 Sponsoren
//                                     anbieten, Saison-Tracking zurücksetzen.
//   EXP.hookMatchResult(ctx)       – in processFixtureResult(): Wochenboni +
//                                     Stil-/Erfolgs-Bewertung der Zufriedenheit.
//   EXP.hookTransfer(player, kind) – in buyPlayer()/sellPlayer(): Philosophie-
//                                     Regeln prüfen, Zufriedenheit anpassen.
//   EXP.hookWeekTick()             – in advanceCalendarWeek(): am Monatsende
//                                     Game-Over prüfen (boardSatisfaction < 20).
//   EXP.ensureState()              – in loadGameState(): Backfill alter Stände.
//
// Liefert KEINE eigene UI – die kommt in Schritt 2. Alle Effekte laufen über
// addNews() und (für Game Over) EXP._gameOver().
// ═══════════════════════════════════════════════════════════════════════════

const EXP = (() => {

  // ── BALANCING (alle Stellschrauben an einem Ort) ─────────────────────────
  const CFG = {
    startBoard: 60,
    startFan: 60,
    boardGameOverThreshold: 20,     // unter diesem Wert am Monatsende: Entlassung
    clamp: [0, 100],

    // Fan-Fraktionen: Gewichtung im Gesamt-Fanwert
    factionWeight: { ultras: 0.5, eventFans: 0.5 },

    // Match-Auswirkungen auf Zufriedenheit
    match: {
      win:        { board: +4, ultras: +2, eventFans: +3 },
      draw:       { board: 0,  ultras: 0,  eventFans: -1 },
      loss:       { board: -4, ultras: -2, eventFans: -3 },
      // Stil: "offensiv" = viele Tore + offensive Regler
      offensiveGoalsThreshold: 3,    // ab so vielen eigenen Toren gilt es als Spektakel
      eventFansLoveGoals: +2,        // pro Heimspiel-Spektakel
      dullGameUltrasOk: +1,          // 0:0 / defensiv: Ultras goutieren Solidität leicht
      dullGameEventFansHate: -3,     // Event-Fans hassen den faden Kick
      u21InLineupUltras: +2,         // Ultras lieben Jugend in der Startelf
      bigForeignSignUltras: -3,      // (wird über Transfer-Hook ausgelöst, hier Referenz)
    },

    // Ticketpreis-Aufschlag in Abhängigkeit der Fan-Zufriedenheit
    // fanSatisfaction 100 → +25 %, 50 → 0 %, 0 → -20 % (Zuschauerschwund)
    ticket: { maxBonus: 0.25, maxMalus: -0.20, neutralAt: 50 },

    // U21-Grenze
    u21MaxAge: 21,
  };

  const clampSat = v => Math.max(CFG.clamp[0], Math.min(CFG.clamp[1], Math.round(v)));

  // ── HILFEN: Spieler-Klassifikation ───────────────────────────────────────
  function isU21(p) { return p && p.age <= CFG.u21MaxAge; }
  // "Eigene Nationalität" = die des Vereins. Wir leiten sie aus dem Gründungs-
  // kader ab (häufigstes Herkunftsland der Spieler mit joinedSeason===1),
  // Fallback Deutschland.
  function clubNationality() {
    const exp = CLUB.expectations;
    if (exp && exp.clubCountry) return exp.clubCountry;
    const counts = {};
    SQUAD.forEach(p => { if (p.country) counts[p.country] = (counts[p.country]||0)+1; });
    let best = 'Deutschland', n = -1;
    Object.entries(counts).forEach(([c, k]) => { if (k > n) { n = k; best = c; } });
    if (exp) exp.clubCountry = best;
    return best;
  }
  function isForeign(p) { return p && p.country && p.country !== clubNationality(); }
  // Star = höchster Marktwert/OVR im Kader
  function squadStar() {
    let star = null;
    SQUAD.forEach(p => {
      if (p.onLoanAt) return;
      if (!star) { star = p; return; }
      const a = (p.value||0) + p.ovr*4000;
      const b = (star.value||0) + star.ovr*4000;
      if (a > b) star = p;
    });
    return star;
  }
  // Liegt OVR deutlich über dem Mannschaftsschnitt? (für "Kaufrausch"-Stars)
  function squadAvgOvr() {
    const act = SQUAD.filter(p => !p.onLoanAt);
    if (!act.length) return 60;
    return act.reduce((s,p)=>s+p.ovr,0)/act.length;
  }
  // Vorjahres-Tabellenplatz des FCM (für dynamische Ziele). Fallback: Mitte.
  function lastSeasonPosition() {
    try {
      const grp = findFcmGroup(LEAGUE).group;
      const tbl = computeTable(grp.teams);
      const idx = tbl.findIndex(t => t.id === 'fcm');
      if (idx >= 0) return { pos: idx+1, total: tbl.length };
    } catch(e) {}
    return { pos: 8, total: 16 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL 1: DIE 6 VORSTANDS-PHILOSOPHIEN
  // Jede definiert: label, flavor, computeGoals(prev) → {tablePosition, ...},
  // checkTransfer(player, kind) → null | {board, ultras?, eventFans?, msg},
  // optional matchTracking(ctx) für Sondervorgaben (z. B. Jugendminuten).
  // ═══════════════════════════════════════════════════════════════════════
  const PHILOSOPHIES = {

    jugendwahn: {
      label: 'Jugendwahn',
      flavor: 'Modell Ajax — der Nachwuchs trägt den Verein. U21-Talente müssen spielen, Ü28-Käufe sind tabu.',
      computeGoals(prev) {
        const target = Math.max(1, prev.pos - 1);
        return {
          tablePosition: target,
          minU21Starts: 17,   // Mindestzahl an Spielen mit ≥1 U21 in der Startelf
          note: `Tabellenplatz ≤ ${target} und konsequenter U21-Einsatz.`
        };
      },
      checkTransfer(p, kind) {
        if (kind === 'buy' && p.age > 28) {
          return { board: -25, msg: `${p.name} ist über 28 — schwerer Verstoß gegen die Jugend-Doktrin!` };
        }
        return null;
      },
      // jede Woche prüfen, ob U21 in der Startelf stand
      matchTracking(ctx, t) {
        if (ctx.u21InLineup) t.u21Starts++;
      },
      seasonReview(t, g) {
        if (t.u21Starts < (g.minU21Starts||0)) {
          return { board: -20, msg: `Zu selten U21 in der Startelf (${t.u21Starts}/${g.minU21Starts}). Der Vorstand ist empört.` };
        }
        return { board: +8, msg: 'Vorbildliche Nachwuchsförderung — der Vorstand ist zufrieden.' };
      }
    },

    cantera: {
      label: 'Cantera-Tradition',
      flavor: 'Modell Bilbao — regionale Identität. Im Kader sind nur Spieler der eigenen Nationalität geduldet.',
      computeGoals(prev) {
        return {
          tablePosition: Math.max(1, prev.pos),
          note: `Klassenerhalt/Stabilität — aber AUSSCHLIESSLICH mit Spielern aus ${clubNationality()}.`
        };
      },
      checkTransfer(p, kind) {
        if (kind === 'buy' && isForeign(p)) {
          return { board: -22, ultras: -15, msg: `${p.name} (${p.country}) verstößt gegen die Cantera-Regel! Vorstand UND Ultras sind außer sich.` };
        }
        return null;
      },
      seasonReview(t) {
        const foreign = SQUAD.filter(p => !p.onLoanAt && isForeign(p)).length;
        if (foreign > 0) return { board: -10, msg: `${foreign} ausländische(r) Spieler im Kader — die Tradition wurde verletzt.` };
        return { board: +10, ultras: +8, msg: 'Reiner Kader aus der Heimat — die Cantera-Idee lebt.' };
      }
    },

    kaufrausch: {
      label: 'Kaufrausch',
      flavor: 'Modell Investor — Prestige und Marktstärke. Hohe Tabellenziele, jede Saison mindestens ein Star-Transfer.',
      computeGoals(prev) {
        const target = Math.max(1, prev.pos - 3);
        return {
          tablePosition: target,
          requireStarSigning: true,
          note: `Tabellenplatz ≤ ${target} und mindestens ein Star-Neuzugang (OVR deutlich über Schnitt).`
        };
      },
      checkTransfer(p, kind) {
        // ein Star-Kauf erfüllt die Vorgabe (Tracking via flag)
        if (kind === 'buy' && p.ovr >= squadAvgOvr() + 5) {
          return { board: +12, eventFans: +8, _starSigned: true, msg: `Star-Transfer ${p.name} (OVR ${p.ovr})! Vorstand und Event-Fans feiern.` };
        }
        return null;
      },
      seasonReview(t, g) {
        if (g.requireStarSigning && !t.starSigned) {
          return { board: -18, msg: 'Kein Star verpflichtet — der Vorstand sieht die Ambition verfehlt.' };
        }
        return { board: +5, msg: 'Die Mannschaft wurde prominent verstärkt.' };
      }
    },

    sparfuchs: {
      label: 'Eiserner Sparfuchs',
      flavor: 'Wirtschaftliche Sanierung. Nur Klassenerhalt zählt — dafür ein hoher Mindest-Kontostand am Saisonende.',
      computeGoals(prev) {
        // Mindestkontostand skaliert grob mit Liga-Niveau
        const minBalance = ({ bundesliga:8000000, bundesliga2:2500000, liga3:600000, regionalliga:150000 })[tierKeyOf()] || 150000;
        return {
          tablePosition: Math.max(1, prev.total - 3), // nur nicht absteigen
          minBalance,
          note: `Klassenerhalt genügt — aber am Saisonende müssen ${formatEuro(minBalance)} auf dem Konto sein.`
        };
      },
      checkTransfer(p, kind) {
        if (kind === 'buy') {
          const fee = (p.value||0);
          if (fee > 300000) return { board: -10, msg: `Teurer Transfer (${formatEuro(fee)}) trotz Sparkurs — der Vorstand runzelt die Stirn.` };
        }
        return null;
      },
      seasonReview(t, g) {
        if (CLUB.budget < (g.minBalance||0)) {
          return { board: -20, msg: `Kontostand ${formatEuro(CLUB.budget)} unter Ziel ${formatEuro(g.minBalance)} — der Sparkurs wurde verfehlt.` };
        }
        return { board: +12, msg: 'Solide gewirtschaftet — der Vorstand ist hochzufrieden.' };
      }
    },

    traditionsbewahrer: {
      label: 'Traditions-Bewahrer',
      flavor: 'Kontinuität und Identifikationsfiguren. Urgesteine (seit Saison 1 dabei) dürfen nicht verkauft werden.',
      computeGoals(prev) {
        return {
          tablePosition: Math.max(1, prev.pos),
          note: 'Stabilität wahren — und vor allem: keine Vereinslegenden verkaufen.'
        };
      },
      checkTransfer(p, kind) {
        if (kind === 'sell' && p.joinedSeason === 1) {
          return { board: -12, ultras: -20, msg: `Verkauf von Urgestein ${p.name}! Die Ultras sind fassungslos.` };
        }
        return null;
      },
      seasonReview() { return { board: +4, msg: 'Die Vereinsseele wurde bewahrt.' }; }
    },

    minimalisten: {
      label: 'Ergebnis-Minimalisten',
      flavor: 'Effizienz und Pragmatismus. Finanzen und Jugend egal — aber das Tabellenziel ist kompromisslos, defensiv und diszipliniert.',
      computeGoals(prev) {
        const target = Math.max(1, prev.pos - 2);
        return {
          tablePosition: target,
          wantDefensive: true,
          note: `Tabellenplatz ≤ ${target} mit disziplinierter, defensiver Spielweise.`
        };
      },
      checkTransfer() { return null; },
      // mag KEINE wilden Offensiv-Spektakel die hinten Lücken reißen → bewertet im Match-Hook
      seasonReview() { return { board: +6, msg: 'Pragmatisch und effizient gearbeitet.' }; }
    }

  };

  // ═══════════════════════════════════════════════════════════════════════
  // POOL 2: DIE 6 SPONSOREN-KLAUSELN
  // Jede definiert: label, flavor, base (wöchentliches Basisgehalt, skaliert
  // per tierFactor), weeklyBonus(ctx) → €, seasonSettle(t, goalsMet) → €
  // (auch negativ für Strafen).
  // ═══════════════════════════════════════════════════════════════════════
  const tierFactor = () => ({ bundesliga: 40, bundesliga2: 12, liga3: 3, regionalliga: 1 })[tierKeyOf()] || 1;

  const SPONSOR_CLAUSES = {

    nachwuchsfoerderer: {
      label: 'Nachwuchsförderer',
      flavor: 'Solides Basisgehalt, fetter Wochenbonus wenn ein U21 aus dem eigenen NLZ in der Startelf stand.',
      base: 6000,
      weeklyBonus(ctx) { return ctx.u21InLineup ? 9000 * tierFactor() : 0; },
      seasonSettle() { return 0; }
    },

    wettanbieter: {
      label: 'Risiko-Wettanbieter',
      flavor: 'Absurd hohes Basisgehalt — aber Strafzahlung, wenn Saisonziel verfehlt oder Fairplay-Limit (zu viele Rote Karten) gerissen wird.',
      base: 18000,
      weeklyBonus() { return 0; },
      seasonSettle(t, goalsMet) {
        const tooManyReds = t.redCards > 6;
        if (!goalsMet || tooManyReds) {
          const penalty = -25000 * tierFactor();
          const why = !goalsMet ? 'Saisonziel verfehlt' : `Fairplay-Limit gerissen (${t.redCards} Rote Karten)`;
          return { amount: penalty, msg: `Wettanbieter-Strafe: ${why}. ${formatEuro(penalty)} abgebucht.` };
        }
        return 0;
      }
    },

    socialmedia: {
      label: 'Social-Media-Konzern',
      flavor: 'Sehr hohe Werbeeinnahmen — aber nur, wenn der Star (höchster Marktwert/OVR) in jedem Spiel in der Startelf steht.',
      base: 8000,
      weeklyBonus(ctx) { return ctx.starInLineup ? 11000 * tierFactor() : 0; },
      seasonSettle() { return 0; }
    },

    brauerei: {
      label: 'Traditions-Brauerei',
      flavor: 'Niedriges Basisgehalt, dafür sofortige Torprämie für jedes Tor in einem Heimspiel. Ideal für Offensivtaktik.',
      base: 3000,
      weeklyBonus(ctx) { return (ctx.wasHome ? ctx.goalsFor : 0) * 4000 * tierFactor(); },
      seasonSettle() { return 0; }
    },

    versicherung: {
      label: 'Versicherungsgruppe',
      flavor: 'Moderates Basisgehalt, das sich in jeder Woche verdoppelt, in der die Mannschaft ohne Gegentor blieb.',
      base: 7000,
      weeklyBonus(ctx) { return ctx.goalsAgainst === 0 ? 7000 * tierFactor() : 0; }, // Verdopplung = Basis nochmal
      seasonSettle() { return 0; }
    },

    mobilitaet: {
      label: 'Mobilitäts-Partner',
      flavor: 'Durchschnittliches Basisgehalt, dafür enorme Bonuszahlung am Saisonende, wenn die Philosophie zu 100 % fehlerfrei eingehalten wurde.',
      base: 9000,
      weeklyBonus() { return 0; },
      seasonSettle(t, goalsMet, philosophyClean) {
        if (philosophyClean) {
          const bonus = 200000 * tierFactor();
          return { amount: bonus, msg: `Mobilitäts-Partner: Philosophie fehlerfrei umgesetzt — Sonderbonus ${formatEuro(bonus)}!` };
        }
        return 0;
      }
    }

  };

  // ── STATE-VERWALTUNG ─────────────────────────────────────────────────────
  function freshTracking() {
    return { u21Starts: 0, redCards: 0, illegalTransfers: 0, cleanSheets: 0,
             starSigned: false, philosophyViolated: false, homeGoals: 0,
             offensiveGames: 0, dullGames: 0, weeksPaid: 0,
             goalsFor: 0, goalsAgainst: 0,          // Saison-Tore gesamt (für Ziele)
             squadOvrStart: null, squadAgeStart: null };  // Kader-Snapshot (Entwicklungsziele)
  }

  function ensureState() {
    if (!CLUB.expectations) {
      CLUB.expectations = {
        boardSatisfaction: CFG.startBoard,
        fanSatisfaction: CFG.startFan,
        fanFactions: { ultras: CFG.startFan, eventFans: CFG.startFan },
        clubCountry: null,
        philosophyId: null,
        seasonGoals: null,
        sponsorClauseId: null,
        pendingPhilosophyOffers: null, // 3 Philosophien zur Auswahl (Saisonbeginn)
        pendingSponsorOffers: null,    // wird zu Saisonbeginn gefüllt → UI bietet Auswahl
        tracking: freshTracking(),
        history: []                    // [{season, philosophy, result}]
      };
      clubNationality(); // Vereinsnationalität einmalig ableiten
    }
    const e = CLUB.expectations;
    if (e.fanFactions == null) e.fanFactions = { ultras: e.fanSatisfaction||CFG.startFan, eventFans: e.fanSatisfaction||CFG.startFan };
    if (e.tracking == null) e.tracking = freshTracking();
    if (e.history == null) e.history = [];
    if (e.pendingPhilosophyOffers === undefined) e.pendingPhilosophyOffers = null; // Migration alte Stände
    recomputeFan();
    return e;
  }

  function recomputeFan() {
    const e = CLUB.expectations; if (!e) return;
    const f = e.fanFactions;
    e.fanSatisfaction = clampSat(f.ultras * CFG.factionWeight.ultras + f.eventFans * CFG.factionWeight.eventFans);
  }

  function applyDelta(d, reason) {
    const e = CLUB.expectations; if (!e || !d) return;
    if (d.board != null)     e.boardSatisfaction = clampSat(e.boardSatisfaction + d.board);
    if (d.ultras != null)    e.fanFactions.ultras = clampSat(e.fanFactions.ultras + d.ultras);
    if (d.eventFans != null) e.fanFactions.eventFans = clampSat(e.fanFactions.eventFans + d.eventFans);
    recomputeFan();
    if (reason && (d.msg || reason)) {
      // Nachrichten nur wenn spürbar
    }
  }

  // ── ÖFFENTLICHE ABFRAGEN (für UI & Engine) ───────────────────────────────
  function philosophy() { const e = CLUB.expectations; return e && e.philosophyId ? PHILOSOPHIES[e.philosophyId] : null; }
  function sponsor()    { const e = CLUB.expectations; return e && e.sponsorClauseId ? SPONSOR_CLAUSES[e.sponsorClauseId] : null; }

  // Ticketpreis-Multiplikator aus Fan-Zufriedenheit (für Einnahmen-Hook)
  function ticketSatisfactionMult() {
    const e = ensureState();
    const f = e.fanSatisfaction;
    if (f >= CFG.ticket.neutralAt) {
      const t = (f - CFG.ticket.neutralAt) / (100 - CFG.ticket.neutralAt);
      return 1 + t * CFG.ticket.maxBonus;
    } else {
      const t = (CFG.ticket.neutralAt - f) / CFG.ticket.neutralAt;
      return 1 + t * CFG.ticket.maxMalus;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOOK 1: SAISONBEGINN  (am Ende von runEndOfSeason aufrufen)
  // ═══════════════════════════════════════════════════════════════════════
  function hookSeasonStart() {
    const e = ensureState();

    // 1) Saison-Abrechnung der ABGELAUFENEN Saison (Philosophie-Review + Sponsor-Settle)
    if (e.philosophyId && e.seasonGoals) {
      settlePreviousSeason(e);
    }

    // 2) Drei zufällige Philosophien zur Auswahl anbieten (Spieler wählt selbst)
    const ids = Object.keys(PHILOSOPHIES);
    const shuffledPhil = ids.slice().sort(()=>Math.random()-0.5).slice(0,3);
    e.pendingPhilosophyOffers = shuffledPhil;
    e.philosophyId = null;   // erst nach Spieler-Wahl gesetzt
    e.seasonGoals = null;

    // 3) Tracking zurücksetzen
    e.tracking = freshTracking();
    // Kader-Snapshot für Entwicklungsziele (OVR-Steigerung / Verjüngung)
    try {
      const act = SQUAD.filter(p => !p.onLoanAt);
      if (act.length) {
        e.tracking.squadOvrStart = act.reduce((s,p)=>s+p.ovr,0) / act.length;
        e.tracking.squadAgeStart = act.reduce((s,p)=>s+p.age,0) / act.length;
      }
    } catch (err) {}

    // 4) Drei zufällige Sponsoren zur Auswahl anbieten (nach Philosophie-Wahl)
    const sids = Object.keys(SPONSOR_CLAUSES);
    const shuffled = sids.slice().sort(()=>Math.random()-0.5).slice(0,3);
    e.pendingSponsorOffers = shuffled;
    e.sponsorClauseId = null;   // muss neu gewählt werden

    addNews('club', `🏛️ Vorstands-Richtung gesucht`,
      `Der Vorstand präsentiert 3 Philosophien — wähle im Verein-Tab, welchen Weg du einschlägst. Danach folgt die Sponsorenwahl.`);

    return { philosophyOffers: shuffledPhil, sponsorOffers: shuffled };
  }

  function settlePreviousSeason(e) {
    const phil = PHILOSOPHIES[e.philosophyId];
    const t = e.tracking;

    // sportliches Ziel erreicht?
    const finish = lastSeasonPosition();
    const goalsMet = finish.pos <= (e.seasonGoals.tablePosition || finish.total);

    // Philosophie-Review
    let philosophyClean = !t.philosophyViolated;
    if (phil.seasonReview) {
      const rev = phil.seasonReview(t, e.seasonGoals);
      if (rev) {
        applyDelta(rev);
        if (rev.board < 0 || (rev.ultras||0) < 0) philosophyClean = false;
        addNews('club', '🏛️ Vorstands-Bewertung', rev.msg);
      }
    }
    // zusätzliche harte Ziel-Checks (Kontostand etc. stecken in seasonReview)

    if (!goalsMet) {
      // ABGESTUFT statt pauschal −15. Das Ziel lautet meist „einen Platz besser
      // als im Vorjahr" — ein Verein im Tabellenmittelfeld verfehlt es dadurch
      // fast jede Saison und wurde mit dem festen Abzug reihenweise entlassen
      // (gemessen: 5 Entlassungen in 12 Saisons bei durchweg Mittelfeld).
      // Knapp daneben ist jetzt eine Ermahnung, deutlich daneben bleibt teuer.
      const daneben = finish.pos - (e.seasonGoals.tablePosition || finish.pos);
      const abzug = daneben <= 2 ? -5 : daneben <= 5 ? -12 : -20;
      const ton = daneben <= 2 ? 'Der Vorstand hätte mehr erwartet, sieht aber die Nähe zum Ziel.'
                : daneben <= 5 ? 'Der Vorstand ist enttäuscht.'
                : 'Der Vorstand ist schwer verstimmt.';
      applyDelta({ board: abzug });
      addNews('club', '🏛️ Saisonziel verfehlt', `Zielplatz ${e.seasonGoals.tablePosition}, erreicht: Platz ${finish.pos} (${daneben} Plätze daneben). ${ton}`);
    } else {
      applyDelta({ board: +8, eventFans: +4 });
    }

    // ── Zusatzziele auswerten (Tore, Gegentore, Spielerentwicklung) ──────────
    const g = e.seasonGoals;
    const missed = [];
    if (g.minGoalsFor != null && t.goalsFor < g.minGoalsFor) {
      missed.push(`nur ${t.goalsFor} statt ${g.minGoalsFor} Tore`);
      applyDelta({ board: -5, eventFans: -4 });
    }
    if (g.maxGoalsAgainst != null && t.goalsAgainst > g.maxGoalsAgainst) {
      missed.push(`${t.goalsAgainst} statt max. ${g.maxGoalsAgainst} Gegentore`);
      applyDelta({ board: -5 });
    }
    // Spielerentwicklung: aktuellen Kader-Schnitt gegen Saisonstart vergleichen
    try {
      const act = SQUAD.filter(p => !p.onLoanAt);
      if (act.length && t.squadOvrStart != null) {
        const ovrEnd = act.reduce((s,p)=>s+p.ovr,0)/act.length;
        const ageEnd = act.reduce((s,p)=>s+p.age,0)/act.length;
        if (g.wantOvrGain != null && g.wantOvrGain > 0 && (ovrEnd - t.squadOvrStart) < g.wantOvrGain) {
          missed.push(`Kader-OVR ${(ovrEnd-t.squadOvrStart>=0?'+':'')}${(ovrEnd-t.squadOvrStart).toFixed(1)} (Ziel +${g.wantOvrGain})`);
          applyDelta({ board: -4 });
        }
        if (g.wantYounger != null && (t.squadAgeStart - ageEnd) < g.wantYounger) {
          missed.push(`Kader kaum verjüngt (${(t.squadAgeStart-ageEnd>=0?'-':'+')}${Math.abs(t.squadAgeStart-ageEnd).toFixed(1)} J, Ziel −${g.wantYounger})`);
          applyDelta({ board: -4 });
        }
      }
    } catch (err) {}
    if (missed.length) {
      addNews('club', '🎯 Nebenziele verfehlt', `Der Vorstand vermisst: ${missed.join('; ')}. Das belastet die Bilanz.`);
    } else if (goalsMet) {
      addNews('club', '🎯 Alle Ziele erfüllt', 'Haupt- und Nebenziele erreicht — der Vorstand ist rundum zufrieden.');
      applyDelta({ board: +5 });
    }

    // Sponsor-Abrechnung
    const sp = SPONSOR_CLAUSES[e.sponsorClauseId];
    if (sp && sp.seasonSettle) {
      const res = sp.seasonSettle(t, goalsMet, philosophyClean);
      if (res && typeof res === 'object') {
        CLUB.budget += res.amount;
        addNews('club', res.amount >= 0 ? '💰 Sponsor-Bonus' : '⚠️ Sponsor-Strafe', res.msg);
      }
    }

    e.history.push({ season: LEAGUE ? LEAGUE.season-1 : 0, philosophy: phil.label, goalsMet, board: e.boardSatisfaction, fan: e.fanSatisfaction });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOOK 2: MATCH-ERGEBNIS  (in processFixtureResult aufrufen)
  // ctx = { goalsFor, goalsAgainst, wasHome, redCardsOwn, lineupIds, tactics }
  // ═══════════════════════════════════════════════════════════════════════
  function hookMatchResult(ctx) {
    const e = ensureState();
    const t = e.tracking;
    const m = CFG.match;

    // Startelf-Analyse
    const lineup = (ctx.lineupIds||[]).map(getPlayer).filter(Boolean);
    const u21InLineup = lineup.some(isU21);
    const star = squadStar();
    const starInLineup = star ? lineup.some(p => p.id === star.id) : false;
    ctx.u21InLineup = u21InLineup;
    ctx.starInLineup = starInLineup;

    // Ergebnis-Kategorie
    const won  = ctx.goalsFor > ctx.goalsAgainst;
    const draw = ctx.goalsFor === ctx.goalsAgainst;
    applyDelta(won ? m.win : draw ? m.draw : m.loss);

    // ── EINTRITTSPREISE → FANSTIMMUNG ──────────────────────────────────────
    // Die Preise hatten bisher KEINEN Einfluss auf die Zufriedenheit: man konnte
    // die teuerste Stufe wählen, ohne dass es jemanden störte. Bei Heimspielen
    // schlägt der Preis jetzt auf die Fans durch — die Ultras deutlich stärker
    // als die Event-Fans, denen der Preis weniger ausmacht.
    if (ctx.wasHome) {
      const tl = (CLUB.ticketLevel || 0), sl = (CLUB.seasonTicketLevel || 0);
      const stufe = tl + sl;                      // −4 (sehr billig) … +4 (sehr teuer)
      if (stufe !== 0) {
        applyDelta({ ultras: -stufe * 0.5, eventFans: -stufe * 0.25 });
      }
    }

    // Stil-Bewertung
    const tac = ctx.tactics || CLUB.tactics || {};
    const offensiveRegler = (tac.mentality||0) > 0 || (tac.tempo||50) > 60 || (tac.pressing||50) > 60;
    const spectacle = ctx.goalsFor >= m.offensiveGoalsThreshold;
    const dull = ctx.goalsFor === 0;

    if (spectacle) { applyDelta({ eventFans: m.eventFansLoveGoals }); t.offensiveGames++; }
    if (dull) {
      applyDelta({ ultras: m.dullGameUltrasOk, eventFans: m.dullGameEventFansHate });
      t.dullGames++;
    }
    if (u21InLineup) applyDelta({ ultras: m.u21InLineupUltras });

    // Philosophie-spezifisches Match-Tracking (z. B. U21-Starts zählen)
    const phil = philosophy();
    if (phil && phil.matchTracking) phil.matchTracking(ctx, t);

    // Minimalisten: mögen Offensiv-Spektakel nicht (Vorgabe defensiv)
    if (phil && e.seasonGoals && e.seasonGoals.wantDefensive) {
      if (offensiveRegler && ctx.goalsAgainst >= 2) applyDelta({ board: -3 });
      if (ctx.goalsAgainst === 0) applyDelta({ board: +2 });
    }

    // Tracking aktualisieren
    if (u21InLineup) {} // bereits in matchTracking
    t.redCards += (ctx.redCardsOwn||0);
    if (ctx.goalsAgainst === 0) t.cleanSheets++;
    if (ctx.wasHome) t.homeGoals += ctx.goalsFor;
    t.goalsFor += (ctx.goalsFor||0);           // Saison-Tore gesamt
    t.goalsAgainst += (ctx.goalsAgainst||0);   // Saison-Gegentore gesamt

    // Sponsor-Wochenbonus auszahlen
    const sp = sponsor();
    if (sp) {
      // NUR DER BONUS wird gutgeschrieben. Die Basis steht seit der Ökonomie-
      // Überarbeitung in der Saisonplanung (fixIncome.klausel) — sie hier
      // zusätzlich aufs Konto zu legen, wäre dasselbe Geld doppelt. Gemessen
      // brachte allein die Basis des Wettanbieters 612.000 € pro Regionalliga-
      // Saison (30 % des Umsatzes) an der Planung vorbei.
      const bonus = sp.weeklyBonus ? Math.round(sp.weeklyBonus(ctx)) : 0;
      t.weeksPaid++;
      if (bonus > 0) {
        CLUB.budget += bonus;
        addNews('club', `💰 Sponsorbonus (${sp.label})`, `Bonuszahlung: ${formatEuro(bonus)} — die Basis steckt bereits im Saisonbudget.`);
      }
    }

    return { boardSatisfaction: e.boardSatisfaction, fanSatisfaction: e.fanSatisfaction };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOOK 3: TRANSFER  (in buyPlayer / sellPlayer aufrufen)
  // kind = 'buy' | 'sell'
  // ═══════════════════════════════════════════════════════════════════════
  function hookTransfer(player, kind) {
    const e = ensureState();
    const phil = philosophy();
    if (!phil || !player) return;

    const res = phil.checkTransfer ? phil.checkTransfer(player, kind) : null;
    if (res) {
      applyDelta(res);
      if (res._starSigned) e.tracking.starSigned = true;
      if ((res.board||0) < 0 || (res.ultras||0) < 0) {
        e.tracking.illegalTransfers++;
        e.tracking.philosophyViolated = true;
      }
      const positive = (res.board||0) >= 0 && (res.ultras||0) >= 0;
      addNews('club', positive ? '🏛️ Vorstand erfreut' : '⚠️ Verstoß gegen die Vereins-Philosophie', res.msg);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOOK 4: WOCHEN-TICK  (in advanceCalendarWeek aufrufen)
  // Prüft am Monatsende, ob der Vorstand das Handtuch wirft.
  // ═══════════════════════════════════════════════════════════════════════
  let _lastMonth = null;
  function hookWeekTick() {
    const e = ensureState();
    if (!LEAGUE) return;
    const month = calendarMonthOfWeek(LEAGUE.week);
    if (_lastMonth === null) { _lastMonth = month; return; }
    if (month !== _lastMonth) {
      _lastMonth = month;
      // Monatswechsel → Game-Over-Prüfung
      if (e.boardSatisfaction < CFG.boardGameOverThreshold) {
        _gameOver();
      }
    }
  }

  function _gameOver() {
    const e = CLUB.expectations;
    addNews('club', '🚪 ENTLASSUNG', `Die Vorstands-Zufriedenheit ist auf ${e.boardSatisfaction}% gefallen. Der Verein trennt sich von dir. Game Over.`);
    // An die UI delegieren, falls sie eine eigene Game-Over-Behandlung hat:
    if (typeof onExpectationsGameOver === 'function') onExpectationsGameOver(e);
    else alert(`GAME OVER\n\nDie Vorstands-Zufriedenheit fiel auf ${e.boardSatisfaction}%.\nDu wurdest als ${window.KSTrainer && KSTrainer.daten() && KSTrainer.daten().geschlecht === 'w' ? 'Trainerin' : 'Trainer'} entlassen.`);
  }

  // ── ZUSATZZIELE: Tore, Gegentore, Spielerentwicklung, Mehrjahres-Erwartung ──
  // Ergänzt das von der Philosophie gelieferte Basisziel (Tabellenplatz) um
  // messbare Neben-Erwartungen, abhängig von Philosophie & Vereinsniveau.
  function augmentGoals(g, philId, prev, e) {
    if (!g) return;
    const n = (prev && prev.total) ? prev.total : 18;
    const spieltage = (n - 1) * 2;                 // Saisonspiele (Hin/Rück)
    const tierScale = ({ bundesliga:1.0, bundesliga2:0.85, liga3:0.72, regionalliga:0.6 })[tierKeyOf()] || 0.7;

    const hist = (e && e.history) ? e.history : [];
    const lastMet = hist.length ? hist[hist.length-1].goalsMet : true;
    const extras = [];

    // — Tor-/Gegentor-Ziele je nach Philosophie-Charakter —
    if (philId === 'kaufrausch' || philId === 'jugendwahn') {
      g.minGoalsFor = Math.round(spieltage * 1.35 * tierScale);
      extras.push(`mindestens ${g.minGoalsFor} eigene Tore`);
    }
    if (philId === 'minimalisten' || philId === 'sparfuchs') {
      g.maxGoalsAgainst = Math.round(spieltage * 1.15 * (2 - tierScale));
      extras.push(`höchstens ${g.maxGoalsAgainst} Gegentore`);
    }
    if (philId === 'cantera' || philId === 'traditionsbewahrer') {
      g.minGoalsFor = Math.round(spieltage * 1.1 * tierScale);
      extras.push(`mindestens ${g.minGoalsFor} eigene Tore`);
    }

    // — Spielerentwicklungs-Ziel —
    if (philId === 'jugendwahn') {
      g.wantYounger = 0.3;             // Durchschnittsalter soll um ≥0.3 sinken
      extras.push('den Kader verjüngen');
    } else if (philId === 'kaufrausch' || philId === 'minimalisten') {
      g.wantOvrGain = 0.8;            // Kader-OVR soll um ≥0.8 steigen
      extras.push('den Kader-OVR steigern');
    } else {
      g.wantOvrGain = 0.0;           // OVR mindestens halten
    }

    // — Mehrjahres-Erwartung: nach erfolgreicher Saison steigt der Druck —
    if (lastMet && hist.length >= 1) {
      g.tablePosition = Math.max(1, (g.tablePosition||n) - 1);
      g.raisedByBoard = true;
    }
    if (hist.length >= 2 && hist[hist.length-1].goalsMet && hist[hist.length-2].goalsMet) {
      extras.push('der Vorstand erwartet nach zwei guten Jahren weiteren Fortschritt');
    }

    if (extras.length) g.extraNote = 'Zusätzlich: ' + extras.join(', ') + '.';
  }

  // ── ÖFFENTLICHE API ──────────────────────────────────────────────────────
  return {
    CFG, PHILOSOPHIES, SPONSOR_CLAUSES,
    ensureState,
    hookSeasonStart, hookMatchResult, hookTransfer, hookWeekTick,
    // Abfragen für die UI:
    philosophy, sponsor, ticketSatisfactionMult,
    squadStar, clubNationality, isU21, isForeign,
    // Philosophie-Auswahl aus der UI: setzt Philosophie und berechnet Saisonziele
    choosePhilosophy(id) {
      const e = ensureState();
      if (!PHILOSOPHIES[id]) return;
      e.philosophyId = id;
      e.pendingPhilosophyOffers = null;
      const phil = PHILOSOPHIES[id];
      const prev = lastSeasonPosition();
      e.seasonGoals = phil.computeGoals(prev);
      // Kader-Snapshot sicherstellen (falls hookSeasonStart ihn nicht setzte)
      if (e.tracking && e.tracking.squadOvrStart == null) {
        try {
          const act = SQUAD.filter(p => !p.onLoanAt);
          if (act.length) {
            e.tracking.squadOvrStart = act.reduce((s,p)=>s+p.ovr,0)/act.length;
            e.tracking.squadAgeStart = act.reduce((s,p)=>s+p.age,0)/act.length;
          }
        } catch (err) {}
      }
      augmentGoals(e.seasonGoals, id, prev, e);   // Tor-/Entwicklungs-/Mehrjahresziele ergänzen
      addNews('club', `🏛️ Vereins-Philosophie: „${phil.label}“`,
        `${phil.flavor} Saisonziel: ${e.seasonGoals.note}${e.seasonGoals.extraNote ? ' ' + e.seasonGoals.extraNote : ''}`);
    },
    // Sponsor-Auswahl aus der UI:
    chooseSponsor(id) {
      const e = ensureState();
      if (SPONSOR_CLAUSES[id]) { e.sponsorClauseId = id; e.pendingSponsorOffers = null; }
    },
    state() { return ensureState(); },
    _gameOver
  };

})();