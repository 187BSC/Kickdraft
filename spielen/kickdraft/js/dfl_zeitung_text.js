/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ZEITUNG – TEXTBAUKASTEN  ·  v1   (D141, 2026-10-14: „eine allgemeine Sport Zeitung und nicht für jeden eins“)
   ─────────────────────────────────────────────────────────────────────────
   Reine Logik ohne DOM und ohne Spielzustand (läuft im Spiel und im Prüflauf mit node:vm): aus Fakten einer Woche
   (Ergebnisse, Torschützen, Serien, Tabelle, Trades, Free Agency, Verletzungen, Draft, Playoffs, Meister) wählt der
   Baukasten die Geschichten, gewichtet sie und schreibt eine Ausgabe „Der Anstoß“ – eine Stimme für die ganze Liga:
   sachlich-lebendiger Sportteil, keine Boulevard-Übertreibung, kein Fachchinesisch.
     · Grammatik: Vereinsnamen sind englische Pluralformen („die Bremen Titans“, „den Köln Goats“) – jede Erwähnung
       wählt eine Form (voller Name, Spitzname, Stadt) mit Kasus und Numerus; Verben und Pronomen folgen der Form
       ({A|gewinnt|gewinnen}). Spitzname und Stadt nur, wenn sie in der Liga eindeutig sind (zwei Lions, drei Städte mit
       zwei Vereinen). Erste Erwähnung in einem Artikel immer mit vollem Namen.
     · Vorlagen: viele Varianten je Satzteil (Titel, Einstieg, Kern, Zitat, Ausblick), jede mit fester ID (Teil#Nr).
       Gedächtnis: IDs der letzten N Ausgaben sind gesperrt (gespeichert beim Aufrufer, klein), in einer Ausgabe kommt
       keine Vorlage zweimal vor.
     · Erscheinen: nur wenn eine Geschichte schwer genug wiegt (CFG.schwelle) – Derby, Serie ab 3, großer Trade,
       Playoffs, Draft, Meister, Saisonstart, großer Free-Agent-Vertrag, Hattrick, Überraschung, Rekordsieg.
   Fakten (vom Spiel, dfl_zeitung.js):
     { saison, jahr, spieltag, phase, eigen, teams: { id: { id, voll, kurz, stadt, konf, konfName, div, staerke, platz,
       platzVorher, punkte, spiele, serie: { art: 'S'|'N', n }, rivale, trainer: { name, rolle, bild } } },
       spiele: [{ h, g, th, tg, tore: { [id]: [{ voll, nach, pos, n, bild, saisontore }] } }], naechste: { id: gegnerId },
       trades: [{ an, von, spieler, gegen: [Text], gross, lage, weg }], fa: [{ team, spieler, jahre, summe, jeJahr, gross }],
       verletzungen: [{ team, spieler, wochen, art, eigen }], draft: { jahr, picks: [{ nr, team, spieler }], eigen: [...] },
       playoffs: { art: 'start'|'runde'|'meister', … }, rekordMarge }
   API: DFLZeitungText.ausgabe(fakten, gedaechtnis, opt) → { stuecke, vorlagen, gewicht } | null
        · .geschichten(fakten) · .satz(vorlage, kontext) · .formen(team) · .VORLAGEN · .CFG · .pruefeVorlagen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    schwelle: 50,           // ab diesem Gewicht erscheint eine Ausgabe
    weitere: 3,             // Meldungen neben dem Aufmacher
    weitereAb: 25,          // Mindestgewicht einer Meldung
    gedaechtnis: 4          // so viele Ausgaben bleiben die Vorlagen gesperrt
  };

  // ── Zufall mit Saat (Ausgabe reproduzierbar je Woche) ──────────────────────
  function rngAus(saat) {
    let a = (Math.floor(Math.abs(saat || 1)) >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Wörter ───────────────────────────────────────────────────────────────
  const ZAHL = ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'];
  const ORD = ['', 'erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste', 'siebte', 'achte', 'neunte', 'zehnte', 'elfte', 'zwölfte'];
  const zahlwort = n => (n >= 0 && n < ZAHL.length ? ZAHL[n] : String(n));
  const ordnung = n => (n > 0 && n < ORD.length ? ORD[n] : n + '.');
  // „dritten“ / „Dritter“ – über zwölf als Ziffer („13.“)
  const ordnungFall = (n, endung) => (n > 0 && n < ORD.length ? ORD[n] + endung : n + '.');
  const MAL = { 2: 'zweimal', 3: 'dreimal', 4: 'viermal', 5: 'fünfmal', 6: 'sechsmal' };
  const POS = { TW: 'Torhüter', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', AV: 'Außenverteidiger',
    ZDM: 'Sechser', ZM: 'Mittelfeldspieler', LM: 'Mittelfeldspieler', RM: 'Mittelfeldspieler', AM: 'Mittelfeldspieler',
    OM: 'Spielmacher', ZOM: 'Spielmacher', LF: 'Flügelstürmer', RF: 'Flügelstürmer', FL: 'Flügelstürmer', ST: 'Stürmer' };
  const RUNDE = { 1: 'Wildcard-Runde', 2: 'Divisional-Runde', 3: 'Conference-Finale', 4: 'Finale' };
  const WEITER_IN = { 1: 'in der Divisional-Runde', 2: 'im Conference-Finale', 3: 'im Finale' };
  const PICK = { 1: 'Erstrunden-Pick', 2: 'Zweitrunden-Pick', 3: 'Drittrunden-Pick', 4: 'Viertrunden-Pick' };
  // Derby-Namen je Division (sächlich: „das Nordderby“, „im Derby der Mitte“)
  const DERBY = { 'Ruhrpott': 'Revierderby', 'Rheinland': 'Rheinderby', 'Südwest': 'Südwestderby', 'Bayern & Baden': 'Südderby',
    'Nord': 'Nordderby', 'Küste & Nordost': 'Küstenderby', 'Ost': 'Ostderby', 'Zentral': 'Derby der Mitte' };
  function liste(teile) {
    const t = teile.filter(Boolean);
    if (t.length <= 1) return t[0] || '';
    return t.slice(0, -1).join(', ') + ' und ' + t[t.length - 1];
  }
  const gross = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  // Ergebnis-Zusatz in den Playoffs
  const zusatzText = art => (art === 'Verlängerung' ? ' nach Verlängerung' : art === 'Elfmeterschießen' ? ' im Elfmeterschießen' : '');
  const wochenText = n => (n === 1 ? 'eine Woche' : zahlwort(n) + ' Wochen');
  const jahreText = n => (n === 1 ? 'ein Jahr' : zahlwort(n) + ' Jahre');
  function pickText(s) {
    const m = /^(\d{4})\s*Runde\s*(\d)$/.exec(String(s || '').trim());
    return m ? `einen ${PICK[+m[2]] || m[2] + '.-Runden-Pick'} für ${m[1]}` : null;
  }

  // ── Formen eines Vereinsnamens ───────────────────────────────────────────
  // team = { id, voll: 'Bremen Titans', kurz: 'Titans' | null, stadt: 'Bremen' | null }
  function formen(t) {
    const f = {
      voll: { art: 'voll', pl: true, nom: 'die ' + t.voll, gen: 'der ' + t.voll, dat: 'den ' + t.voll, akk: 'die ' + t.voll, t: t.voll }
    };
    if (t.kurz) f.kurz = { art: 'kurz', pl: true, nom: 'die ' + t.kurz, gen: 'der ' + t.kurz, dat: 'den ' + t.kurz, akk: 'die ' + t.kurz, t: t.kurz };
    if (t.stadt) f.stadt = { art: 'stadt', pl: false, nom: t.stadt, gen: null, dat: t.stadt, akk: t.stadt, t: t.stadt };
    return f;
  }

  // ═══ Vorlagen ═════════════════════════════════════════════════════════════
  // Platzhalter: {A} {A.akk} {A.dat} {A.gen} {A.t} (Titelform ohne Artikel) {A.name} (voller Name ohne Artikel)
  //   {A|Einzahl|Mehrzahl} (folgt der gewählten Form) · Spieler {S} (erst voller Name, dann Nachname) {S.nach} {S.voll} {S.Pos}
  //   Werte in Kleinbuchstaben ({erg}, {nw}, {platz} …). Großbuchstabe A–H = Verein, P/Q/S = Spieler.
  const VORLAGEN = {
    // ── Spiel: Titel ──
    'titel.sieg': [
      '{A.t} {A|gewinnt|gewinnen} gegen {B.akk}', '{erg} für {A.akk} gegen {B.akk}', '{A.t} {A|schlägt|schlagen} {B.akk} {erg}',
      'Drei Punkte für {A.akk}', '{A.t} {A|setzt|setzen} sich gegen {B.akk} durch', 'Sieg für {A.akk} gegen {B.akk}',
      '{A.t} {A|holt|holen} den Sieg gegen {B.akk}'],
    'titel.niederlage': [
      '{A.t} {A|verliert|verlieren} gegen {B.akk}', '{erg} gegen {B.akk}: Niederlage für {A.akk}', 'Keine Punkte für {A.akk}',
      '{A.t} {A|unterliegt|unterliegen} {B.dat} {erg}', 'Nichts zu holen für {A.akk} gegen {B.akk}', '{A.t} {A|geht|gehen} leer aus'],
    'titel.remis': [
      '{A.t} und {B.t} trennen sich {erg}', 'Remis zwischen {A.dat} und {B.dat}', 'Ein Punkt für {A.akk}',
      'Punkteteilung zwischen {A.dat} und {B.dat}', '{erg} zwischen {A.dat} und {B.dat}', 'Kein Sieger zwischen {A.dat} und {B.dat}'],
    'titel.derby': [
      '{A.t} {A|gewinnt|gewinnen} das {derby}', '{derby}: {A.t} {A|behält|behalten} die Oberhand', '{erg} im {derby} für {A.akk}',
      'Derbysieg für {A.akk}', '{A.t} {A|entscheidet|entscheiden} das {derby} für sich', 'Das {derby} geht an {A.akk}',
      '{A.t} {A|jubelt|jubeln} im {derby}', '{A.t} {A|bleibt|bleiben} im {derby} vorn', 'Derbyfreude bei {A.dat}', '{derby} an {A.akk}: {erg} gegen {B.akk}'],
    'titel.derby.remis': ['{derby} ohne Sieger', 'Punkteteilung im {derby}', 'Remis im {derby}', '{erg} im {derby}',
      'Keiner gibt nach im {derby}', '{A.t} und {B.t} trennen sich im {derby}'],
    'titel.serie.s': [
      '{nterS} Sieg in Folge für {A.akk}', '{A.t} {A|siegt|siegen} weiter', '{A.t} {A|bleibt|bleiben} in der Spur',
      'Serie hält: {A.t} {A|gewinnt|gewinnen} auch gegen {B.akk}', '{A.t} {A|ist|sind} nicht zu stoppen', '{nw} Siege am Stück für {A.akk}',
      '{A.t} {A|legt|legen} nach'],
    'titel.serie.n': [
      '{nterF} Niederlage in Folge für {A.akk}', '{A.t} {A|kommt|kommen} nicht aus dem Tief', '{A.t} {A|steckt|stecken} in der Krise',
      'Wieder nichts für {A.akk}', '{A.t} {A|verliert|verlieren} auch gegen {B.akk}', '{nw} Spiele, {nw} Niederlagen für {A.akk}'],
    'titel.hattrick': ['{S.nach} trifft dreifach', 'Dreierpack von {S.nach}', 'Drei Tore, ein Name: {S.nach}',
      '{S.nach} mit drei Toren gegen {B.akk}', 'Der Abend gehört {S.nach}', 'Dreimal {S.nach}'],
    'titel.viererpack': ['{S.nach} trifft {mal}', '{S.nach} schießt {B.akk} ab', '{mal} {S.nach}', 'Ein Spieler, {tore} Tore: {S.nach}'],
    'titel.ueberraschung': ['{A.t} {A|ärgert|ärgern} {B.akk}', 'Überraschung: {A.t} {A|schlägt|schlagen} {B.akk}', '{B.t} {B|stolpert|stolpern} gegen {A.akk}',
      'Der Favorit stolpert: {B.t} {B|verliert|verlieren} {ergB}', 'Kein Durchkommen für {B.akk}', '{A.t} {A|wirft|werfen} die Papierform um'],
    'titel.kantersieg': ['{erg}: {A.t} {A|überrollt|überrollen} {B.akk}', 'Deutlicher geht es kaum: {erg} für {A.akk}', 'Klare Sache für {A.akk}',
      '{A.t} {A|feiert|feiern} ein {erg}', 'Torfestival: {A.t} {A|schlägt|schlagen} {B.akk} {erg}', '{erg} gegen {B.akk}: {A.t} in Torlaune'],
    'titel.fuehrung': ['{A.t} {A|übernimmt|übernehmen} die Spitze', 'Neuer Spitzenreiter in der {konf}', '{A.t} {A|grüßt|grüßen} von Platz eins',
      'Wechsel an der Spitze der {konf}', '{A.t} ganz oben', 'Platz eins für {A.akk}'],
    'titel.playoffplatz': ['{A.t} {A|springt|springen} auf einen Playoff-Platz', 'Playoff-Platz für {A.akk}', '{A.t} {A|klettert|klettern} in die Playoff-Ränge',
      '{A.t} {A|ist|sind} wieder im Rennen'],
    'titel.playoffraus': ['{A.t} {A|fällt|fallen} aus den Playoff-Rängen', '{A.t} {A|rutscht|rutschen} unter den Strich', 'Rückschlag für {A.akk} im Playoff-Rennen',
      '{A.t} {A|verliert|verlieren} den Playoff-Platz'],

    // ── Spiel: Einstieg ──
    'einstieg.sieg': [
      '{A} {A|gewinnt|gewinnen} {erg} gegen {B.akk}.', '{A} {A|schlägt|schlagen} {B.akk} {erg}.', 'Gegen {B.akk} {A|holt|holen} {A} einen {erg}-Sieg.',
      '{erg} heißt es am Ende für {A.akk} gegen {B.akk}.', 'Drei Punkte für {A.akk}: {erg} gegen {B.akk}.', '{A} {A|setzt|setzen} sich mit {erg} gegen {B.akk} durch.',
      '{A} {A|bezwingt|bezwingen} {B.akk} mit {erg}.'],
    'einstieg.niederlage': [
      '{A} {A|verliert|verlieren} {erg} gegen {B.akk}.', 'Gegen {B.akk} {A|steht|stehen} {A} am Ende mit leeren Händen da: {erg}.',
      '{A} {A|unterliegt|unterliegen} {B.dat} {erg}.', 'Für {A.akk} gibt es gegen {B.akk} nichts zu holen, {erg} am Ende.',
      '{B} {B|ist|sind} an diesem Spieltag zu stark für {A.akk}, {ergB} heißt es am Ende.', '{erg} gegen {B.akk}: {A} {A|kassiert|kassieren} eine Niederlage.'],
    'einstieg.remis': [
      '{A} und {B} trennen sich {erg}.', 'Zwischen {A.dat} und {B.dat} gibt es keinen Sieger: {erg}.', '{erg} endet das Spiel zwischen {A.dat} und {B.dat}.',
      'Ein Punkt für jeden: {A} und {B} spielen {erg}.', '{A} {A|kommt|kommen} gegen {B.akk} nicht über ein {erg} hinaus.', 'Unentschieden zwischen {A.dat} und {B.dat}: {erg}.'],
    'einstieg.derby': [
      '{A} {A|hat|haben} das {derby} gegen {B.akk} mit {erg} gewonnen.', 'Im {derby} {A|setzt|setzen} sich {A} mit {erg} gegen {B.akk} durch.',
      'Das {derby} geht an {A.akk}: {erg} gegen {B.akk}.', '{A} {A|bleibt|bleiben} im {derby} vorn und {A|schlägt|schlagen} {B.akk} {erg}.',
      'Am Ende {A|jubelt|jubeln} {A}: {erg} im {derby} gegen {B.akk}.', 'Es war ein {derby} mit allem, was dazugehört, und am Ende {A|steht|stehen} {A} als Sieger da: {erg} gegen {B.akk}.',
      '{erg} im {derby}: {A} {A|behält|behalten} gegen {B.akk} die Oberhand.'],
    'einstieg.derby.remis': [
      'Das {derby} zwischen {A.dat} und {B.dat} endet {erg}.', 'Keiner gibt nach: {A} und {B} trennen sich im {derby} {erg}.',
      '{erg} im {derby}: {A} und {B} teilen die Punkte.', 'Im {derby} gibt es keinen Sieger, {A} und {B} spielen {erg}.',
      'Viel Einsatz, kein Sieger: Das {derby} zwischen {A.dat} und {B.dat} endet {erg}.'],
    'einstieg.serie.s': [
      '{A} {A|hat|haben} auch das {nter} Spiel in Folge gewonnen, diesmal {erg} gegen {B.akk}.',
      'Der Lauf geht weiter: {A} {A|schlägt|schlagen} {B.akk} {erg} und {A|feiert|feiern} den {ntern} Sieg in Folge.',
      'Mit dem {erg} gegen {B.akk} {A|baut|bauen} {A} {A|seine|ihre} Serie auf {nw} Siege aus.',
      '{nw} Spiele, {nw} Siege: {A} {A|gewinnt|gewinnen} auch gegen {B.akk}, {erg} heißt es am Ende.',
      'Auch {B} {B|kann|können} {A.akk} nicht bremsen: {erg}, der {nter} Sieg in Folge.',
      '{A} {A|bleibt|bleiben} in Form und {A|gewinnt|gewinnen} {erg} gegen {B.akk}. Es ist der {nter} Sieg am Stück.'],
    'einstieg.serie.n': [
      '{A} {A|verliert|verlieren} auch gegen {B.akk}, diesmal {erg}.', 'Die Talfahrt geht weiter: {A} {A|unterliegt|unterliegen} {B.dat} {erg}.',
      'Es ist die {nter} Niederlage in Folge für {A.akk}: {erg} gegen {B.akk}.', 'Auch gegen {B.akk} reicht es für {A.akk} nicht, {erg} am Ende.',
      '{nw} Spiele, {nw} Niederlagen: {A} {A|verliert|verlieren} {erg} gegen {B.akk}.', 'Für {A.akk} wird die Lage ernster. Gegen {B.akk} setzt es ein {erg}.'],
    'einstieg.hattrick': [
      '{S} hat beim {erg} {A.gen} gegen {B.akk} dreimal getroffen.', 'Ein Spieler prägt das {erg} {A.gen} gegen {B.akk}: {S} trifft dreimal.',
      '{A} {A|spielt|spielen} {erg} gegen {B.akk}, und {S} trifft dreimal.', 'Drei Tore in einem Spiel: {S} gelingt gegen {B.akk} ein Dreierpack.',
      'Gegen {B.akk} trifft {S.Pos} {S} gleich dreimal, am Ende steht es {erg}.'],
    'einstieg.viererpack': ['{S} trifft beim {erg} {A.gen} gegen {B.akk} {mal}.', 'Gegen {B.akk} ist {S} nicht zu halten: {tore} Tore beim {erg}.',
      '{tore} Tore von {S}: {A} {A|gewinnt|gewinnen} {erg} gegen {B.akk}.'],
    'einstieg.ueberraschung': [
      'Mit diesem Ergebnis hatte kaum jemand gerechnet: {A} {A|schlägt|schlagen} {B.akk} {erg}.',
      '{B} {B|geht|gehen} als Favorit ins Spiel und {B|verliert|verlieren} {ergB} gegen {A.akk}.',
      'Auf dem Papier {A|ist|sind} {A} deutlich schwächer besetzt. Auf dem Platz merkt man davon nichts: {erg} gegen {B.akk}.',
      '{A} {A|sorgt|sorgen} für die Überraschung des Spieltags und {A|gewinnt|gewinnen} {erg} gegen {B.akk}.',
      'Die Papierform spricht für {B.akk}, das Ergebnis für {A.akk}: {erg}.'],
    'einstieg.kantersieg': [
      '{A} {A|lässt|lassen} {B.dat} keine Chance und {A|gewinnt|gewinnen} {erg}.', '{erg} heißt es am Ende zwischen {A.dat} und {B.dat}.',
      'Ein Spiel zum Vergessen für {B.akk}: {A} {A|gewinnt|gewinnen} {erg}.', '{A} {A|schießt|schießen} {B.akk} mit {erg} ab.',
      'Gegen {B.akk} läuft bei {A.dat} fast alles: {erg} am Ende.'],
    'einstieg.fuehrung': [
      'Nach dem {erg} gegen {B.akk} {A|führt|führen} {A} die {konf} an.', '{A} {A|ist|sind} der neue Spitzenreiter der {konf}.',
      '{A} {A|steht|stehen} jetzt an der Spitze der {konf}. Gegen {B.akk} gab es ein {erg}.', 'Mit dem {erg} gegen {B.akk} {A|klettert|klettern} {A} auf Platz eins der {konf}.',
      'Ganz oben in der {konf} {A|steht|stehen} jetzt {A}, nach einem {erg} gegen {B.akk}.'],
    'einstieg.fuehrung.ohne': ['{A} {A|steht|stehen} jetzt an der Spitze der {konf}.', '{A} {A|ist|sind} der neue Spitzenreiter der {konf}.',
      'Ganz oben in der {konf} {A|steht|stehen} jetzt {A}.'],
    'einstieg.playoffplatz': [
      'Mit dem {erg} gegen {B.akk} {A|klettert|klettern} {A} auf Platz {platz} der {konf}, Stand heute ein Playoff-Platz.',
      '{A} {A|ist|sind} zurück in den Playoff-Rängen: Platz {platz} nach dem {erg} gegen {B.akk}.',
      'Das {erg} gegen {B.akk} bringt {A.akk} auf Platz {platz}. Damit {A|wäre|wären} {A} heute in den Playoffs.'],
    'einstieg.playoffraus': [
      'Nach dem {erg} gegen {B.akk} {A|rutscht|rutschen} {A} auf Platz {platz} der {konf} und damit aus den Playoff-Rängen.',
      '{A} {A|fällt|fallen} auf Platz {platz} zurück. Stand heute {A|wäre|wären} {A} in den Playoffs nicht dabei.',
      'Das {erg} gegen {B.akk} kostet {A.akk} den Playoff-Platz: Platz {platz} in der {konf}.'],

    // ── Spiel: Kern ──
    'tore.hattrick': ['{S} traf dreimal und war der Mann des Spiels.', 'Den Unterschied machte {S} mit drei Toren.', 'Dreimal war {S} zur Stelle.',
      '{S} schnürte einen Dreierpack.', 'Drei Tore gingen auf das Konto von {S}.'],
    'tore.viererpack': ['{S} traf {mal}.', 'Allein {tore} Tore erzielte {S}.', '{S} war mit {tore} Toren nicht zu halten.'],
    'tore.doppelpack': ['{S} traf doppelt.', 'Zweimal war {S} erfolgreich.', '{S} schnürte einen Doppelpack.', 'Für zwei Tore sorgte {S}.',
      'Zwei Treffer gingen auf das Konto von {S}.', '{S} stand zweimal goldrichtig.'],
    'tore.einer': ['Das Tor des Tages erzielte {S}.', 'Ein Tor von {S} reichte.', '{S} sorgte mit seinem Treffer für die Entscheidung.',
      'Den Treffer des Tages erzielte {S}.', 'Entschieden hat das Spiel ein Tor von {S}.'],
    'tore.liste': ['Die Tore erzielten {liste}.', 'Getroffen haben {liste}.', 'Für die Tore sorgten {liste}.', 'Torschützen waren {liste}.',
      'In die Torschützenliste trugen sich {liste} ein.'],
    'tore.dazu': ['Dazu traf {liste}.', 'Außerdem traf {liste}.', 'Ebenfalls traf {liste}.'],
    'tore.dazu.mehr': ['Dazu trafen {liste}.', 'Außerdem trafen {liste}.', 'Die weiteren Tore erzielten {liste}.'],
    'tore.saison': ['Er steht jetzt bei {saisontore} Saisontoren.', 'In dieser Saison hat er damit {saisontore} Tore erzielt.',
      'Für ihn sind es {saisontore} Tore in dieser Saison.'],
    'tore.gegner': ['Für {B.akk} traf {liste}.', 'Für {B.akk} war {liste} erfolgreich.', 'Auf der anderen Seite traf {liste}.'],
    'tore.gegner.mehr': ['Für {B.akk} trafen {liste}.', 'Auf der anderen Seite trafen {liste}.', 'Die Tore für {B.akk} erzielten {liste}.'],
    'serie.s': ['{A} {A|hat|haben} damit {nw} Spiele in Folge gewonnen.', 'Es ist der {nter} Sieg in Folge.', 'Die Serie hält: {nw} Siege am Stück.',
      'Damit {A|steht|stehen} {A} bei {nw} Siegen in Folge.', 'Der Lauf {A.gen} hält an: {nw} Siege hintereinander.'],
    'serie.n': ['Es ist die {nter} Niederlage in Folge.', 'Für {A.akk} ist es schon die {nter} Niederlage hintereinander.',
      '{nw} Spiele, {nw} Niederlagen: die Lage wird ungemütlich.', 'Die Serie reißt nicht ab: {nw} Niederlagen am Stück für {A.akk}.',
      '{A} {A|wartet|warten} jetzt seit {nw} Spielen auf Punkte.'],
    'serie.ende.s': ['Damit ist die Serie von {nw} Siegen {A.gen} vorbei.', 'Für {A.akk} reißt eine Serie von {nw} Siegen.'],
    'serie.ende.n': ['Damit endet für {A.akk} eine Serie von {nw} Niederlagen.', 'Nach {nw} Niederlagen in Folge {A|jubelt|jubeln} {A} endlich wieder.',
      'Für {A.akk} ist es der erste Sieg nach {nw} Niederlagen.'],
    'tabelle.hoch': ['In der Tabelle {A|klettert|klettern} {A} auf Platz {platz} der {konf}.', 'Damit {A|springt|springen} {A} auf Platz {platz}.',
      'Das bringt {A.akk} auf Platz {platz} der {konf}.', 'In der {konf} geht es für {A.akk} hoch auf Platz {platz}.'],
    'tabelle.gleich': ['{A} {A|bleibt|bleiben} auf Platz {platz} der {konf}.', 'In der {konf} {A|steht|stehen} {A} weiter auf Platz {platz}.',
      'In der Tabelle ändert sich für {A.akk} nichts: Platz {platz}.'],
    'tabelle.runter': ['{A} {A|rutscht|rutschen} auf Platz {platz} der {konf} ab.', 'In der Tabelle geht es für {A.akk} auf Platz {platz} zurück.',
      'Damit {A|fällt|fallen} {A} auf Platz {platz}.'],
    'tabelle.spitze': ['{A} {A|führt|führen} die {konf} an.', 'An der Spitze der {konf} {A|steht|stehen} {A}.', 'Platz eins der {konf} gehört {A.dat}.'],
    'tabelle.playoff': ['Das wäre Stand heute ein Playoff-Platz.', 'Damit {A|liegt|liegen} {A} auf Kurs Playoffs.'],
    'tabelle.vorher': ['Vorher {V|stand|standen} dort {V}.', '{V} {V|muss|müssen} Platz eins abgeben.', 'Bis zu diesem Spieltag {V|führte|führten} {V} die Tabelle an.'],
    'tabelle.punkte': ['{A} {A|hat|haben} jetzt {punkte} Punkte aus {spiele} Spielen.', 'Nach {spiele} Spielen {A|steht|stehen} {A} bei {punkte} Punkten.'],
    'staerke': ['Auf dem Papier trennen beide Mannschaften {diff} Punkte in der Stärke.', 'Der Kader {B.gen} gilt als deutlich stärker besetzt.',
      'Gemessen an der Stärke der Kader war das nicht zu erwarten.'],
    'rekord': ['Das ist der höchste Sieg der Saison.', 'Höher hat in dieser Saison noch niemand gewonnen.', 'Ein Ergebnis, das es in dieser Saison noch nicht gab.'],
    'ausblick': ['Als Nächstes {N|wartet|warten} {N}.', 'Weiter geht es gegen {N.akk}.', 'Am nächsten Spieltag geht es gegen {N.akk}.',
      'Nächster Gegner: {N.name}.', 'Der nächste Gegner heißt {N.name}.'],
    'ausblick.derby': ['Und dann steht schon das nächste Derby an: gegen {N.akk}.', 'Am nächsten Spieltag wartet schon das Derby gegen {N.akk}.'],

    // ── Saisonstart ──
    'titel.saisonstart': ['Die Saison ist eröffnet', 'Der erste Spieltag ist gespielt', 'Die DKL ist zurück', 'Erster Spieltag, {tore} Tore',
      'Die neue Saison läuft'],
    'titel.saisonstart.team': ['Auftakt nach Maß für {A.akk}', 'Los geht es: {A.t} {A|startet|starten} mit {erg}', '{A.t} {A|setzt|setzen} zum Start ein Zeichen',
      'Erster Spieltag: {erg} für {A.akk}'],
    'einstieg.saisonstart': ['Der erste Spieltag der Saison {jahr} ist gespielt.', 'Die DKL ist zurück: {tore} Tore in 16 Spielen am ersten Spieltag.',
      'Die neue Saison ist da, und sie beginnt mit {tore} Toren in 16 Spielen.', 'Die Saison {jahr} läuft. Der erste Spieltag bringt {tore} Tore.'],
    'saisonstart.bester': ['Den besten Start {A|erwischt|erwischen} {A}: {erg} gegen {B.akk}.', 'Am deutlichsten {A|gewinnt|gewinnen} {A}, {erg} gegen {B.akk}.',
      'Ein Ausrufezeichen {A|setzt|setzen} {A} mit dem {erg} gegen {B.akk}.'],
    'saisonstart.favorit.s': ['Als stärkster Kader der Liga {F|gilt|gelten} {F}, und {F|startet|starten} mit einem {ergF} gegen {G.akk}.',
      'Der Favorit hält sich schadlos: {F} {F|gewinnt|gewinnen} {ergF} gegen {G.akk}.', 'Auch {F} {F|wird|werden} der Rolle gerecht: {ergF} gegen {G.akk}.'],
    'saisonstart.favorit.n': ['Ein Fehlstart für {F.akk}: Der stärkste Kader der Liga {F|verliert|verlieren} zum Auftakt {ergF} gegen {G.akk}.',
      'Ausgerechnet {F} {F|patzt|patzen}: {ergF} gegen {G.akk}.', 'Der Favorit stolpert: {F} {F|verliert|verlieren} {ergF} gegen {G.akk}.'],
    'saisonstart.favorit.u': ['Nur ein Punkt für den Favoriten: {F} {F|kommt|kommen} zum Auftakt nicht über ein {ergF} gegen {G.akk} hinaus.',
      'Nur ein Punkt für {F.akk}: {ergF} gegen {G.akk}.'],
    'saisonstart.eigen.s': ['Und {E}? {E|Gewinnt|Gewinnen} zum Auftakt {ergE} gegen {O.akk}.', '{E} {E|startet|starten} mit einem {ergE} gegen {O.akk}.'],
    'saisonstart.eigen.n': ['{E} {E|verliert|verlieren} zum Auftakt {ergE} gegen {O.akk}.', 'Für {E.akk} beginnt die Saison mit einem {ergE} gegen {O.akk}.'],
    'saisonstart.eigen.u': ['{E} {E|spielt|spielen} zum Auftakt {ergE} gegen {O.akk}.', 'Ein Punkt zum Start für {E.akk}: {ergE} gegen {O.akk}.'],

    // ── Trade ──
    'titel.trade': ['{A.t} {A|holt|holen} {P.nach}', '{P.nach} wechselt zu {A.dat}', 'Tausch: {P.nach} geht zu {A.dat}', '{P.nach} verlässt {B.akk}',
      'Neuer {P.Pos} für {A.akk}', 'Trade zwischen {A.dat} und {B.dat}', '{A.t} {A|schlägt|schlagen} auf dem Markt zu'],
    'einstieg.trade': ['{A} {A|holt|holen} {P.Pos} {P} von {B.dat}.', '{P.Pos} {P} wechselt von {B.dat} zu {A.dat}.',
      '{B} {B|gibt|geben} {P.Pos} {P} an {A.akk} ab.', 'Der nächste Trade in der DKL: {P} geht von {B.dat} zu {A.dat}.',
      'Tausch zwischen {A.dat} und {B.dat}: {P.Pos} {P} wechselt die Seiten.'],
    'trade.gegen': ['Im Gegenzug {B|bekommt|bekommen} {B} {gegen}.', 'Dafür {B|erhält|erhalten} {B} {gegen}.', '{B} {B|bekommt|bekommen} dafür {gegen}.'],
    'trade.titel': ['{A} {A|will|wollen} in dieser Saison oben angreifen.', 'Bei {A.dat} lautet das Ziel: Titel, und zwar jetzt.',
      'Das Signal ist klar: {A} {A|spielt|spielen} auf Sieg.'],
    'trade.aufbau': ['Für {B.akk} geht der Umbau weiter.', '{B} {B|setzt|setzen} auf die Zukunft.', 'Bei {B.dat} steht der Neuaufbau im Vordergrund.'],
    'trade.weg': ['{P.nach} hatte bei {B.dat} um einen Wechsel gebeten.', 'Der Wunsch kam vom Spieler: {P.nach} wollte weg.'],
    'trade.abgabe': ['{B} {B|wollte|wollten} ihn abgeben.', 'Bei {B.dat} stand er schon länger auf der Liste der Abgänge.'],
    'trade.alter.jung': ['Mit {alter} Jahren hat er seine besten Jahre noch vor sich.', 'Der {alter}-Jährige ist eine Wette auf die Zukunft.'],
    'trade.alter.alt': ['Mit {alter} Jahren bringt er viel Erfahrung mit.', 'Der {alter}-Jährige soll sofort helfen.'],
    'trade.weitere': ['Außerdem in dieser Woche: {liste}.', 'Dazu ein weiterer Trade: {liste}.'],

    // ── Free Agency ──
    'titel.fa': ['{P.nach} unterschreibt bei {A.dat}', '{A.t} {A|holt|holen} {P.nach}', 'Großer Vertrag für {P.nach}', '{P.nach} geht zu {A.dat}',
      'Free Agency: {P.nach} zu {A.dat}', '{A.t} {A|sichert|sichern} sich {P.nach}'],
    'einstieg.fa': ['{P.Pos} {P} unterschreibt bei {A.dat} einen Vertrag über {jahre}.', '{A} {A|sichert|sichern} sich {P.Pos} {P}, der Vertrag läuft über {jahre}.',
      'Der größte Name der Woche auf dem Markt geht zu {A.dat}: {P.Pos} {P} unterschreibt für {jahre}.',
      '{P} hat einen neuen Verein: {A} {A|holt|holen} den {P.Pos} für {jahre}.'],
    'fa.summe': ['Der Vertrag ist insgesamt {summe} wert.', 'Insgesamt geht es um {summe}.', 'Pro Saison steht er mit {jeJahr} im Cap.',
      'Das Paket hat einen Gesamtwert von {summe}.'],
    'fa.weitere': ['Außerdem unterschrieben {liste}.', 'Auch {liste} haben neue Verträge.', 'Weitere Unterschriften: {liste}.'],
    'fa.weitere.einer': ['Außerdem unterschrieb {liste}.', 'Einen neuen Vertrag hat auch {liste}.', 'Weitere Unterschrift: {liste}.'],

    // ── Verletzung ──
    'titel.verletzung': ['{P.nach} fällt {wochen} aus', 'Sorgen um {P.nach}', 'Bitterer Ausfall für {A.akk}', '{A.t} {A|muss|müssen} auf {P.nach} verzichten',
      'Lange Pause für {P.nach}', '{P.nach} verletzt'],
    'einstieg.verletzung': ['{A} {A|muss|müssen} {wochen} auf {P.Pos} {P} verzichten.', '{P.Pos} {P} fällt bei {A.dat} {wochen} aus.',
      'Schlechte Nachrichten für {A.akk}: {P} fällt {wochen} aus.', '{A} {A|muss|müssen} {wochen} ohne {P.Pos} {P} auskommen.'],
    'verletzung.art': ['Die Diagnose: {art}.', 'Die Diagnose lautet {art}.', 'Diagnose: {art}.'],
    'verletzung.weitere': ['Auch {liste} fallen länger aus.', 'Länger fehlen außerdem {liste}.'],
    'verletzung.weitere.einer': ['Auch {liste} fällt länger aus.', 'Länger fehlt außerdem {liste}.'],

    // ── Draft ──
    'titel.draft': ['{P.nach} geht an Nummer eins', 'Erster Pick: {A.t} {A|nimmt|nehmen} {P.nach}', 'Draft {jahr}: {P.nach} zuerst',
      '{A.t} {A|zieht|ziehen} {P.nach} an erster Stelle', 'Nummer eins im Draft: {P.nach}'],
    'einstieg.draft': ['Mit dem ersten Pick im Draft {jahr} {A|wählt|wählen} {A} {P.Pos} {P}.', '{P.Pos} {P} ist der erste Name im Draft {jahr}: {A} {A|holt|holen} ihn.',
      'Der Draft {jahr} beginnt mit {P.dat}: {A} {A|nimmt|nehmen} den {P.Pos} an Position eins.', 'An Nummer eins {A|entscheidet|entscheiden} sich {A} für {P.Pos} {P}.'],
    'draft.college': ['Der {alter}-Jährige kommt von der {college}.', 'Er ist {alter} Jahre alt und kommt von der {college}.'],
    'draft.danach': ['Danach folgten {liste}.', 'Auf den nächsten Plätzen: {liste}.'],
    'draft.danach.einer': ['Danach folgte {liste}.', 'An Position zwei: {liste}.'],
    'draft.eigen': ['{E} {E|wählt|wählen} an Position {nr} {Q.Pos} {Q}.', 'Für {E.akk} geht es an Position {nr} los: {Q.Pos} {Q}.',
      'Mit dem {nr}. Pick {E|holt|holen} {E} {Q.Pos} {Q}.'],
    'draft.eigen.erster': ['Es ist der erste Pick überhaupt für {E.akk} in diesem Draft.'],

    // ── Playoffs ──
    'titel.po.start.drin': ['{E.t} {E|ist|sind} in den Playoffs', 'Playoffs mit {E.dat}', '{E.t} {E|löst|lösen} das Playoff-Ticket', 'Das Feld steht, {E.t} dabei'],
    'titel.po.start.raus': ['Die Playoffs beginnen ohne {E.akk}', 'Das Playoff-Feld steht', '14 Teams, ein Titel', 'Die Hauptrunde ist vorbei'],
    'einstieg.po.start': ['Nach 26 Spieltagen steht das Feld: 14 Teams spielen um den Titel.', 'Die Hauptrunde ist vorbei, die Playoffs können beginnen.',
      'Sieben Teams je Conference haben sich für die Playoffs qualifiziert.', 'Die 26 Spieltage sind gespielt, jetzt beginnen die Playoffs.'],
    'po.start.freilos': ['Als Erste ihrer Conference haben {A} und {B} in der ersten Runde frei.', 'Ein Freilos haben {A} und {B}, die Ersten ihrer Conference.',
      '{A} und {B} gehen als Nummer eins ihrer Conference direkt in die Divisional-Runde.'],
    'po.start.eigen': ['{E} {E|geht|gehen} als Nummer {seed} der {konf} ins Rennen.', 'Für {E.akk} geht es als Nummer {seed} der {konf} los.'],
    'po.start.eigen.gegner': ['In der Wildcard-Runde geht es gegen {N.akk}.', 'Der erste Gegner: {N.name}.'],
    'po.start.eigen.frei': ['Als Nummer eins {E|hat|haben} {E} in der ersten Runde frei.'],
    'po.start.raus': ['{E} {E|ist|sind} nicht dabei.', 'Für {E.akk} ist die Saison nach 26 Spieltagen vorbei.', 'Ohne {E.akk}: Platz {platz} in der {konf} reicht nicht.'],
    'po.start.abstand': ['Am Ende fehlten {pkt} Punkte auf Platz sieben.', 'Zu Platz sieben fehlten {pkt} Punkte.'],
    'titel.po.runde': ['{A.t} {A|übersteht|überstehen} die {runde}', 'Aus in der {runde} für {B.akk}', '{B.t} {B|scheidet|scheiden} aus',
      '{A.t} {A|steht|stehen} {weiter}', '{A.t} weiter, {B.t} raus', '{runde}: {A.t} {A|gewinnt|gewinnen} {erg}'],
    'titel.po.runde.finale': ['{A.t} {A|steht|stehen} im Finale', '{A.t} {A|zieht|ziehen} ins Finale ein', 'Finale! {A.t} {A|schlägt|schlagen} {B.akk}',
      'Das Finale ruft für {A.akk}'],
    'titel.po.runde.krimi': ['Krimi in der {runde}', '{A.t} {A|setzt|setzen} sich{zusatz} durch', 'Nervenspiel: {A.t} {A|gewinnt|gewinnen}{zusatz}'],
    'einstieg.po.runde': ['{A} {A|schlägt|schlagen} {B.akk} {erg}{zusatz} und {A|steht|stehen} {weiter}.', '{erg}{zusatz}: {A} {A|wirft|werfen} {B.akk} aus den Playoffs.',
      'Für {B.akk} ist die Saison vorbei: {A} {A|gewinnt|gewinnen} {erg}{zusatz}.', '{A} {A|zieht|ziehen} mit einem {erg}{zusatz} gegen {B.akk} in die nächste Runde ein.'],
    'po.elfer': ['Nach 120 Minuten stand es {ergR}, im Elfmeterschießen {A|behält|behalten} {A} die Nerven.',
      'Nach 120 Minuten stand es {ergR}, vom Punkt {A|trifft|treffen} {A} sicherer.'],
    'po.verlaengerung': ['Erst in der Verlängerung fällt die Entscheidung.', 'Es braucht die Verlängerung, um einen Sieger zu finden.'],
    'po.seeds': ['Als Nummer {seedA} {A|schaltet|schalten} {A} die Nummer {seedB} aus.', 'Der Außenseiter setzt sich durch: Nummer {seedA} gegen Nummer {seedB}.'],
    'po.finale': ['Im Finale in {ort} geht es gegen {F.akk}.', 'Gegner im Finale in {ort}: {F.name}.', 'Im Finale wartet {F}, gespielt wird in {ort}.'],
    'titel.meister': ['{A.t} {A|ist|sind} Meister', '{A.t} {A|holt|holen} den Titel', 'Der Titel geht an {A.akk}', '{A.t} {A|gewinnt|gewinnen} das Finale',
      'Meister {jahrE}: {A.name}'],
    'einstieg.meister': ['{A} {A|gewinnt|gewinnen} das Finale in {ort} {erg}{zusatz} gegen {B.akk} und {A|ist|sind} DKL-Meister.',
      'In {ort} {A|krönt|krönen} sich {A} zum Meister: {erg}{zusatz} gegen {B.akk}.',
      'Der neue Meister heißt {A.name}. Im Finale von {ort} {A|schlägt|schlagen} {A} {B.akk} {erg}{zusatz}.',
      'Das Finale in {ort} endet {erg}{zusatz}, und {A} {A|ist|sind} DKL-Meister.'],
    'meister.titel.erster': ['Für {A.akk} ist es der erste Titel.', 'Es ist der erste Titel für {A.akk}.'],
    'meister.titel.mehr': ['Es ist der {nter} Titel für {A.akk}.', 'Für {A.akk} ist es schon der {nter} Titel.'],
    'meister.seed': ['Als Nummer {seed} der {konf} gestartet, am Ende ganz oben.', 'In die Playoffs {A|ging|gingen} {A} als Nummer {seed} der {konf}.'],
    'meister.finalist': ['Für {B.akk} bleibt Platz zwei.', '{B} {B|muss|müssen} sich mit Platz zwei begnügen.', 'Für {B.akk} endet eine starke Saison im Finale.'],

    // ── Zitate ──
    'zitat.sieg': ['Wir haben heute als Mannschaft funktioniert. Darauf lässt sich aufbauen.', 'Nicht alles war gut, aber das Ergebnis stimmt. Daran arbeiten wir weiter.',
      'Die Jungs haben bis zur letzten Minute gearbeitet. Das hat man gesehen.', 'Wir haben unseren Plan durchgezogen. Mehr kann ich nicht verlangen.',
      'Wir haben geduldig gespielt und im richtigen Moment zugeschlagen.', 'Solche Spiele musst du erst einmal gewinnen. Heute ist uns das gelungen.',
      'Wir nehmen die drei Punkte mit und schauen nach vorn.'],
    'zitat.sieg.deutlich': ['So ein Ergebnis nimmt man gern mit. Abheben wird hier trotzdem keiner.', 'Heute ist fast alles aufgegangen. Das passiert nicht jede Woche.',
      'Wir waren von Anfang an wach. Dann kann so etwas passieren.', 'Ein schöner Abend. Ab morgen zählt wieder das nächste Spiel.'],
    'zitat.sieg.knapp': ['Das war harte Arbeit. Am Ende zählt, dass wir den Vorsprung über die Zeit gebracht haben.', 'Es war eng, das gehört zur Wahrheit dazu. Aber wir haben es verteidigt.',
      'Schön war das nicht immer. Aber manchmal musst du Spiele einfach gewinnen.', 'Ein Tor Unterschied, drei Punkte. Mehr will ich heute nicht sagen.'],
    'zitat.niederlage': ['Wir haben heute nicht gut genug gespielt. Das müssen wir klar ansprechen.', 'Der Gegner war heute besser. Das muss man anerkennen.',
      'Wir hatten unsere Momente, aber am Ende fehlt das Tor. Das ärgert mich.', 'Abhaken, analysieren, weitermachen. Mehr bleibt uns nicht.',
      'Das tut weh. Am Montag geht die Arbeit weiter.'],
    'zitat.remis': ['Mit einem Punkt kann man leben. Zufrieden sind wir trotzdem nicht ganz.', 'Ein gerechtes Ergebnis, denke ich. Beide hatten ihre Phasen.',
      'Wir nehmen den Punkt mit. Mehr war heute nicht drin.', 'Das Spiel hätte in beide Richtungen kippen können.'],
    'zitat.derby': ['Für die Leute in der Stadt ist so ein Sieg mehr als drei Punkte. Für uns auch.', 'Ein Derby gewinnt man mit Herz. Davon hatten wir heute genug.',
      'Die Kurve hat uns getragen. Diesen Sieg widmen wir ihr.', 'Auf dieses Spiel haben alle hingefiebert. Umso schöner, dass wir liefern konnten.',
      'Derbys spielt man nicht, Derbys gewinnt man. Heute haben wir das gemacht.'],
    'zitat.derby.niederlage': ['Ein Derby zu verlieren tut weh. Das müssen wir jetzt erst einmal verdauen.', 'Wir waren nicht da, als es darauf ankam. Das ärgert mich am meisten.',
      'Gegen diesen Gegner willst du nie verlieren. Heute ist es passiert.'],
    'zitat.serie.s': ['Wir schauen nicht auf die Serie. Wir schauen auf das nächste Spiel.', 'Jede Serie reißt irgendwann. Bis dahin genießen wir das.',
      'Die Mannschaft hat gerade einen Lauf. Den wollen wir so lange wie möglich halten.', 'Mit Glück hat das nichts zu tun. Die Jungs arbeiten jeden Tag dafür.',
      'Gewinnen wird zur Gewohnheit. Das ist ein gutes Gefühl, aber auch eine Verpflichtung.'],
    'zitat.serie.n': ['Wir müssen jetzt zusammenhalten. Aus so einer Phase kommt man nur gemeinsam heraus.', 'Am Einsatz liegt es nicht. Aber die Ergebnisse müssen besser werden.',
      'Schönreden bringt nichts. Wir brauchen einen Sieg, und zwar schnell.', 'Die Stimmung ist gedrückt, das ist normal. Am Montag geht die Arbeit weiter.',
      'Wir stecken da gemeinsam drin, und wir kommen da gemeinsam wieder heraus.'],
    'zitat.ueberraschung': ['Uns hatte heute keiner auf der Rechnung. Umso mehr freut mich das.', 'Auf dem Papier waren wir Außenseiter. Auf dem Platz hat man davon nichts gemerkt.',
      'Wir wussten, dass wir eine Chance haben, wenn alle mitziehen. Genau das ist passiert.'],
    'zitat.spieler.hattrick': ['So viele Tore in einem Spiel, das passiert nicht oft. Aber ohne die Vorlagen der Jungs geht das nicht.', 'Den Ball nehme ich mit nach Hause.',
      'Ich stand heute einfach oft richtig. Der Rest war Arbeit der Mannschaft.', 'An so einen Abend werde ich mich lange erinnern.'],
    'zitat.spieler.tor': ['Schön, dass ich helfen konnte. Wichtig sind die drei Punkte.', 'Für einen Stürmer gibt es nichts Besseres als solche Abende.',
      'Ich freue mich über die Tore, aber noch mehr über den Sieg.'],
    'zitat.trade': ['Er bringt genau das mit, was uns gefehlt hat.', 'Wir haben ihn lange beobachtet. Jetzt passt es endlich.', 'Er wird uns sofort helfen, da bin ich mir sicher.',
      'Ein Spieler mit seiner Qualität macht uns besser. So einfach ist das.', 'Wir freuen uns auf ihn. Die Mannschaft hat ihn schon gut aufgenommen.'],
    'zitat.fa': ['Wir wollten ihn unbedingt haben. Jetzt ist er da.', 'Ein Spieler dieser Klasse ist auf dem Markt selten zu haben.',
      'Er hatte andere Angebote und hat sich für uns entschieden. Das spricht für ihn.', 'Er passt zu uns, sportlich und menschlich.'],
    'zitat.verletzung': ['Das ist bitter, für ihn und für uns. Jetzt müssen andere in die Lücke springen.', 'Wir werden ihn vermissen. Aber wir haben einen Kader, der das auffangen kann.',
      'Er war gerade richtig gut in Form. Umso ärgerlicher ist der Ausfall.', 'Er bekommt alle Zeit, die er braucht. Gesundheit geht vor.'],
    'zitat.draft': ['Wir haben uns lange mit ihm beschäftigt. Er war unser Wunschspieler.', 'Er ist jung, er hat Talent, und er will lernen. Mehr kann man sich nicht wünschen.',
      'Jetzt beginnt die eigentliche Arbeit. Wir werden ihm Zeit geben.', 'Ein großer Tag für ihn und für uns.'],
    'zitat.meister': ['Dafür arbeitet man ein ganzes Jahr. Heute darf jeder in dieser Stadt feiern.', 'Diese Mannschaft hat nie aufgehört, an sich zu glauben. Das ist ihr Titel.',
      'Ich bin unglaublich stolz. Auf die Spieler, auf das ganze Team dahinter, auf unsere Fans.', 'Das wird eine lange Nacht. Die haben sich alle verdient.'],
    'zitat.po.sieg': ['In den Playoffs ist jedes Spiel eng. Heute hatten wir das bessere Ende.', 'Wir sind noch nicht fertig. Die nächste Runde wird noch schwerer.',
      'Das war ein Spiel für die Nerven. Gut, dass wir die stärkeren hatten.', 'Wir genießen das heute. Morgen beginnt die Vorbereitung auf die nächste Runde.'],
    'zitat.po.aus': ['Es tut weh, so auszuscheiden. Aber wir haben eine Saison gespielt, auf die wir stolz sein können.',
      'Heute war der Gegner besser. Wir nehmen trotzdem viel aus dieser Saison mit.', 'Im Moment überwiegt die Enttäuschung. Mit etwas Abstand sehen wir, was wir erreicht haben.'],
    'zitat.po.start': ['Die Playoffs waren unser Ziel. Jetzt fängt alles wieder bei null an.', 'Jetzt beginnt die schönste Zeit des Jahres.',
      'Wir haben uns das über 26 Spieltage erarbeitet. Jetzt wollen wir mehr.'],
    'zitat.fuehrung': ['Platz eins ist eine Momentaufnahme. Wir arbeiten weiter wie bisher.', 'Die Tabelle schaue ich mir im Frühjahr genauer an. Aber schön ist der Blick heute schon.',
      'Ganz oben zu stehen fühlt sich gut an. Dort bleiben ist die eigentliche Aufgabe.'],
    'zitat.saisonstart': ['Ein guter Start ist wichtig für den Kopf. Mehr ist es aber noch nicht.', 'Ein Spiel ist gespielt, 25 kommen noch. Wir bleiben ruhig.',
      'Die Vorbereitung war gut, das hat man heute gesehen.'],
  };

  // ── Gedächtnis und Auswahl ───────────────────────────────────────────────
  function Schreiber(gedaechtnis, saat) {
    const rnd = rngAus(saat);
    const alt = (gedaechtnis || []).slice(-CFG.gedaechtnis);          // [[ids der Ausgabe], …], älteste zuerst
    const gesperrt = new Map();                                          // id → Alter (1 = letzte Ausgabe)
    alt.forEach((ids, i) => (ids || []).forEach(id => gesperrt.set(id, alt.length - i)));
    const heute = new Set();
    const benutzt = [];
    return {
      rnd,
      zufall: arr => arr[Math.floor(rnd() * arr.length)],
      vorlage(key) {
        const v = VORLAGEN[key];
        if (!v || !v.length) throw new Error('Vorlage fehlt: ' + key);
        const ids = v.map((_, i) => key + '#' + i);
        let frei = ids.filter(id => !gesperrt.has(id) && !heute.has(id));
        if (!frei.length) {
          // alles gesperrt: die am längsten nicht benutzte (ältestes Alter), nie zweimal in einer Ausgabe
          const rest = ids.filter(id => !heute.has(id));
          const pool = rest.length ? rest : ids;
          const maxAlter = Math.max(...pool.map(id => gesperrt.get(id) || 99));
          frei = pool.filter(id => (gesperrt.get(id) || 99) === maxAlter);
        }
        const id = frei[Math.floor(rnd() * frei.length)];
        heute.add(id); benutzt.push(id);
        return v[+id.split('#')[1]];
      },
      benutzt
    };
  }

  // ── Satzbau mit Grammatik ────────────────────────────────────────────────
  // ctx = { teams: { A: team }, spieler: { S: spieler }, werte: { … }, titel: bool }, st = Zustand des Artikels (Erwähnungen)
  const ARTEN_TEXT = ['kurz', 'stadt', 'voll'];
  function satz(vorlage, ctx, st, rnd) {
    st = st || { teams: new Set(), spieler: new Set() };
    rnd = rnd || Math.random;
    const teams = ctx.teams || {}, spieler = ctx.spieler || {}, werte = ctx.werte || {};
    // 1) Formen je Verein für diesen Satz wählen (Kasus-Bedarf beachten: Stadt hat keinen Genitiv)
    const bedarf = {};
    String(vorlage).replace(/\{([^{}]+)\}/g, (m, inhalt) => {
      const k = inhalt.split(/[.|]/)[0];
      if (teams[k]) { (bedarf[k] = bedarf[k] || new Set()).add(inhalt.indexOf('.') > 0 ? inhalt.split('.')[1] : (inhalt.indexOf('|') > 0 ? 'vb' : 'nom')); }
      return m;
    });
    const form = {};
    Object.keys(bedarf).forEach(k => {
      const t = teams[k], F = formen(t), b = bedarf[k];
      let moegl;
      if (ctx.titel) moegl = ['kurz', 'stadt', 'voll'].filter(a => F[a]);
      else if (!st.teams.has(t.id)) moegl = ['voll'];
      else moegl = ARTEN_TEXT.filter(a => F[a]);
      if (b.has('gen')) moegl = moegl.filter(a => a !== 'stadt');
      if (!moegl.length) moegl = ['voll'];
      // im Text: Spitzname bevorzugt, dann Stadt, voller Name selten (wirkt sonst steif)
      const gewicht = { kurz: 0.5, stadt: 0.35, voll: ctx.titel ? 0.3 : 0.15 };
      let summe = moegl.reduce((s, a) => s + gewicht[a], 0), z = rnd() * summe, wahl = moegl[0];
      for (const a of moegl) { z -= gewicht[a]; if (z <= 0) { wahl = a; break; } }
      form[k] = F[wahl];
    });
    // 2) Platzhalter ersetzen
    let aus = String(vorlage).replace(/\{([^{}]+)\}/g, (m, inhalt) => {
      if (inhalt.indexOf('|') > 0) {
        const [k, ein, mehr] = inhalt.split('|');
        if (!form[k]) throw new Error('Kongruenz ohne Verein: ' + inhalt);
        return form[k].pl ? mehr : ein;
      }
      const [k, feld] = inhalt.split('.');
      if (teams[k]) {
        const f = form[k], t = teams[k];
        if (!feld) return f.nom;
        if (feld === 't') return f.t;
        if (feld === 'name') return t.voll;
        if (feld === 'voll') return 'die ' + t.voll;
        const r = f[feld];
        if (r == null) throw new Error('Fall fehlt: ' + inhalt);
        return r;
      }
      if (spieler[k]) {
        const p = spieler[k];
        if (!feld) { const r = st.spieler.has(p.voll) ? p.nach : p.voll; st.spieler.add(p.voll); return r; }
        if (feld === 'nach') return p.nach;
        if (feld === 'voll') { st.spieler.add(p.voll); return p.voll; }
        if (feld === 'Pos') return POS[p.pos] || 'Spieler';
        if (feld === 'dat') { const r = st.spieler.has(p.voll) ? p.nach : p.voll; st.spieler.add(p.voll); return r; }
        throw new Error('Spielerfeld fehlt: ' + inhalt);
      }
      if (werte[inhalt] == null || (typeof werte[inhalt] === 'number' && !isFinite(werte[inhalt]))) throw new Error('Wert fehlt: ' + inhalt);
      return String(werte[inhalt]);
    });
    if (!ctx.titel) Object.keys(form).forEach(k => st.teams.add(teams[k].id));
    aus = aus.replace(/\s+/g, ' ').replace(/\s+([.,:!?])/g, '$1').trim()
      .replace(/: (die|der|den) /g, (m, a) => ': ' + gross(a) + ' ');            // nach Doppelpunkt beginnt ein ganzer Satz groß
    return gross(aus);
  }

  // ═══ Geschichten aus den Fakten ═══════════════════════════════════════════
  function teamVon(F, id) { return F.teams[id] || { id, voll: String(id), kurz: null, stadt: null }; }
  function derbyArt(F, h, g) {
    const a = F.teams[h], b = F.teams[g];
    if (!a || !b) return null;
    if (a.rivale === g || b.rivale === h) return 'rivale';
    if (a.stadt == null && b.stadt == null && a.ort && a.ort === b.ort) return 'stadt';
    if (a.div && a.div === b.div) return 'division';
    return null;
  }
  function derbyName(F, h, g, art) {
    const a = F.teams[h];
    if (art === 'stadt') return 'Stadtderby';
    if (art === 'rivale') return DERBY[a.div] || 'Derby';
    return 'Divisionsduell';
  }

  // Spielgeschichte: jedes Ligaspiel des Spieltags einmal, mit Schwerpunkt
  function spielGeschichte(F, sp) {
    const e = F.eigen, eigen = sp.h === e || sp.g === e;
    const sieg = sp.th === sp.tg ? null : (sp.th > sp.tg ? sp.h : sp.g), verl = sieg ? (sieg === sp.h ? sp.g : sp.h) : null;
    const marge = Math.abs(sp.th - sp.tg);
    const dArt = derbyArt(F, sp.h, sp.g);
    const kand = [];
    const torListe = id => (sp.tore && sp.tore[id]) || [];
    const top = [sp.h, sp.g].map(id => ({ id, s: torListe(id).slice().sort((a, b) => b.n - a.n)[0] })).filter(x => x.s && x.s.n >= 3)
      .sort((a, b) => b.s.n - a.s.n)[0];
    if (dArt === 'rivale' || dArt === 'stadt') kand.push({ fokus: 'derby', g: eigen ? 72 : 32 });
    else if (dArt === 'division' && eigen) kand.push({ fokus: 'derby', g: 42 });
    const serie = id => (F.teams[id] && F.teams[id].serie) || { art: null, n: 0 };
    if (sieg) {
      const s = serie(sieg), n = serie(verl);
      // Serien tragen eine Ausgabe nur an Marken: eigener Verein bei 3, 5, 7, 10 …, fremde bei 6 und 10 – sonst stünde
      // eine lange Serie jede Woche wieder vorn; dazwischen bleibt sie eine Meldung
      const marke = (x, eig) => (eig ? (x === 3 || x === 5 || x === 7 || (x >= 10 && x % 5 === 0)) : (x === 6 || (x >= 10 && x % 5 === 0)));
      if (s.art === 'S' && s.n >= 3) kand.push({ fokus: 'serieS', g: marke(s.n, sieg === e) ? (sieg === e ? 62 : 52) : sieg === e ? 40 : s.n >= 5 ? 34 : 22 });
      if (n.art === 'N' && n.n >= 3) kand.push({ fokus: 'serieN', g: marke(n.n, verl === e) ? (verl === e ? 60 : 50) : verl === e ? 38 : n.n >= 5 ? 32 : 20 });
      const dSt = (teamVon(F, verl).staerke || 0) - (teamVon(F, sieg).staerke || 0);
      if (dSt >= 4) kand.push({ fokus: 'ueberraschung', g: sieg === e ? 56 : eigen ? 46 : 34 + Math.min(10, (dSt - 4) * 2), dSt });
      if (marge >= 4) kand.push({ fokus: 'kantersieg', g: (sp.rekord ? 46 : 30) + (eigen ? 15 : 0) });
    }
    if (top) kand.push({ fokus: 'hattrick', g: (top.id === e ? 62 : 42) + (top.s.n >= 4 ? 5 : 0), team: top.id, s: top.s });
    if (eigen) kand.push({ fokus: 'normal', g: 26 });
    if (!kand.length) return null;
    kand.sort((a, b) => b.g - a.g);
    const k = kand[0];
    return { typ: 'spiel', fokus: k.fokus, gewicht: k.g, eigen, sp, sieg, verl, marge, dArt, top: k.fokus === 'hattrick' ? { id: k.team, s: k.s } : top, dSt: k.dSt,
      schluessel: 'spiel:' + sp.h + ':' + sp.g, teams: [sp.h, sp.g] };
  }

  function geschichten(F) {
    const G = [], e = F.eigen;
    (F.spiele || []).forEach(sp => { const g = spielGeschichte(F, sp); if (g) G.push(g); });
    // Tabelle: neuer Spitzenreiter einer Conference (ab Spieltag 3), eigener Verein in/aus den Playoff-Rängen (ab Spieltag 8)
    if ((F.spieltag || 0) >= 3) {
      Object.values(F.teams).forEach(t => {
        if (t.platz === 1 && t.platzVorher && t.platzVorher > 1)
          G.push({ typ: 'fuehrung', gewicht: t.id === e ? 64 : 44, team: t.id, schluessel: 'fuehrung:' + t.konf, teams: [t.id] });
      });
    }
    if ((F.spieltag || 0) >= 8 && F.teams[e]) {
      const t = F.teams[e];
      if (t.platz <= 7 && t.platzVorher > 7) G.push({ typ: 'playoffplatz', gewicht: 48, team: e, schluessel: 'ppl:' + e, teams: [e] });
      if (t.platz > 7 && t.platzVorher && t.platzVorher <= 7) G.push({ typ: 'playoffraus', gewicht: 44, team: e, schluessel: 'ppl:' + e, teams: [e] });
    }
    if (F.spieltag === 1 && (F.spiele || []).length) G.push({ typ: 'saisonstart', gewicht: 80, schluessel: 'saisonstart', teams: [] });
    (F.trades || []).forEach((tr, i) => G.push({ typ: 'trade', gewicht: tr.gross ? 56 : 30, tr, idx: i, schluessel: 'trade:' + i, teams: [tr.an, tr.von] }));
    const fa = (F.fa || []).slice().sort((a, b) => (b.wert || 0) - (a.wert || 0));
    if (fa.length) G.push({ typ: 'fa', gewicht: fa[0].gross ? 52 : 28, fa, schluessel: 'fa', teams: [fa[0].team] });
    const verl = (F.verletzungen || []).slice().sort((a, b) => (b.eigen ? 1 : 0) - (a.eigen ? 1 : 0) || b.wochen - a.wochen);
    if (verl.length) G.push({ typ: 'verletzung', gewicht: verl[0].eigen ? 46 : verl[0].wochen >= 6 ? 32 : 22, verl, schluessel: 'verl', teams: [verl[0].team] });
    if (F.draft && F.draft.picks && F.draft.picks.length) G.push({ typ: 'draft', gewicht: 90, schluessel: 'draft', teams: [F.draft.picks[0].team] });
    const po = F.playoffs;
    if (po && po.art === 'start') G.push({ typ: 'poStart', gewicht: 95, schluessel: 'po', teams: [] });
    if (po && po.art === 'runde') G.push({ typ: 'poRunde', gewicht: 90, schluessel: 'po', teams: [] });
    if (po && po.art === 'meister') G.push({ typ: 'meister', gewicht: 100, schluessel: 'po', teams: [po.meister] });
    return G;
  }

  // ═══ Artikel schreiben ════════════════════════════════════════════════════
  function Artikel(F, W) {
    const st = { teams: new Set(), spieler: new Set() };
    const saetze = [];
    return {
      st,
      saetze,
      add(key, ctx) { saetze.push(satz(W.vorlage(key), ctx, st, W.rnd)); },
      titel(key, ctx) { return satz(W.vorlage(key), Object.assign({}, ctx, { titel: true }), { teams: new Set(), spieler: new Set() }, W.rnd); }
    };
  }
  // Spieler für den Satzbau (voller Name, Nachname, Position)
  const sp = p => (p ? { voll: p.voll || p.nach, nach: p.nach || p.voll, pos: p.pos } : null);
  const ergVon = (a, b) => `${a}:${b}`;
  function zitatVon(F, W, teamId, key, opt) {
    const t = F.teams[teamId];
    const sprecher = (opt && opt.spieler) || (t && t.trainer);
    if (!sprecher || !sprecher.name) return null;
    return { text: W.vorlage(key), name: sprecher.name, rolle: sprecher.rolle || '', team: teamId, bild: sprecher.bild || null };
  }
  // Torschützen eines Vereins als Sätze (ohne den Hauptdarsteller, wenn schon genannt)
  function toreSaetze(A, F, teamKey, team, liste, ohne) {
    const tore = (liste || []).filter(x => !ohne || x.voll !== ohne.voll);
    if (!tore.length) return;
    const ctxT = { teams: { [teamKey]: team } };
    const mehr = tore.filter(x => x.n >= 2).sort((a, b) => b.n - a.n)[0];
    if (mehr && !ohne) {
      const key = mehr.n >= 4 ? 'tore.viererpack' : mehr.n === 3 ? 'tore.hattrick' : 'tore.doppelpack';
      A.add(key, Object.assign({}, ctxT, { spieler: { S: sp(mehr) }, werte: { mal: MAL[mehr.n] || mehr.n + '-mal', tore: zahlwort(mehr.n) } }));
      const rest = torText(tore.filter(x => x !== mehr));
      if (rest) A.add(rest.einer ? 'tore.dazu' : 'tore.dazu.mehr', { werte: { liste: rest.liste } });
      return;
    }
    if (tore.length === 1 && tore[0].n === 1 && !ohne) { A.add('tore.einer', { spieler: { S: sp(tore[0]) } }); return; }
    const t = torText(tore);
    if (ohne) { A.add(t.einer ? 'tore.dazu' : 'tore.dazu.mehr', { werte: { liste: t.liste } }); return; }
    A.add(t.einer ? 'tore.dazu' : 'tore.liste', { werte: { liste: t.liste } });
  }
  // Torschützen als Liste: ein Spieler → Einzahl („X zweimal“), mehrere → „X (2), Y und Z“
  function torText(tore) {
    if (!tore || !tore.length) return null;
    if (tore.length === 1) return { einer: true, liste: tore[0].voll + (tore[0].n >= 2 ? ' ' + (MAL[tore[0].n] || tore[0].n + '-mal') : '') };
    return { einer: false, liste: liste(tore.map(x => x.voll + (x.n >= 2 ? ` (${x.n})` : ''))) };
  }

  function tabellenSatz(A, F, id, key) {
    const t = F.teams[id];
    if (!t || !t.platz) return;
    const k = key || 'A', ctx = { teams: { [k]: t }, werte: { platz: t.platz, konf: t.konfName ? 'Conference ' + t.konfName : 'Conference' } };
    if (k !== 'A') ctx.teams.A = t;
    if (t.platz === 1) A.add('tabelle.spitze', ctx);
    else if (t.platzVorher && t.platz < t.platzVorher) A.add('tabelle.hoch', ctx);
    else if (t.platzVorher && t.platz > t.platzVorher) A.add('tabelle.runter', ctx);
    else A.add('tabelle.gleich', ctx);
  }

  function schreibeSpiel(F, W, g, kurz) {
    const s = g.sp, A0 = new Artikel(F, W);
    // Hauptdarsteller: Sieger (bei Serie N der Verlierer, beim Hattrick der Verein des Schützen, beim Remis der eigene oder Heim)
    let a = g.sieg || (s.g === F.eigen ? s.g : s.h);
    if (g.fokus === 'serieN') a = g.verl;
    if (g.fokus === 'hattrick') a = g.top.id;
    if (g.fokus === 'normal') a = F.eigen;
    const b = a === s.h ? s.g : s.h;
    const ta = a === s.h ? s.th : s.tg, tb = a === s.h ? s.tg : s.th;
    const TA = teamVon(F, a), TB = teamVon(F, b);
    const werte = { erg: ergVon(ta, tb), ergB: ergVon(tb, ta) };
    const ctx = { teams: { A: TA, B: TB }, werte };
    const remis = ta === tb, gewonnen = ta > tb;
    let titel, rubrik, bild, zitat = null;
    const derby = g.dArt ? derbyName(F, s.h, s.g, g.dArt) : null;
    if (derby) werte.derby = derby;
    const serieA = TA.serie || {}, nA = serieA.n || 0;
    Object.assign(werte, { nw: zahlwort(nA), nter: ordnung(nA), ntern: ordnungFall(nA, 'n'), nterS: gross(ordnungFall(nA, 'r')), nterF: gross(ordnung(nA)) });
    const tore = s.tore || {};
    if (g.fokus === 'derby') {
      rubrik = derby;
      titel = A0.titel(remis ? 'titel.derby.remis' : gewonnen ? 'titel.derby' : 'titel.niederlage', ctx);
      A0.add(remis ? 'einstieg.derby.remis' : gewonnen ? 'einstieg.derby' : 'einstieg.niederlage', ctx);
    } else if (g.fokus === 'serieS') {
      rubrik = 'Serie';
      titel = A0.titel('titel.serie.s', ctx); A0.add('einstieg.serie.s', ctx);
    } else if (g.fokus === 'serieN') {
      rubrik = 'Serie';
      titel = A0.titel('titel.serie.n', ctx); A0.add('einstieg.serie.n', ctx);
    } else if (g.fokus === 'hattrick') {
      rubrik = 'Der Spieltag';
      const S = sp(g.top.s), c2 = Object.assign({}, ctx, { spieler: { S }, werte: Object.assign({}, werte, { mal: MAL[g.top.s.n] || g.top.s.n + '-mal', tore: zahlwort(g.top.s.n) }) });
      titel = A0.titel(g.top.s.n >= 4 ? 'titel.viererpack' : 'titel.hattrick', c2);
      A0.add(g.top.s.n >= 4 ? 'einstieg.viererpack' : 'einstieg.hattrick', c2);
    } else if (g.fokus === 'ueberraschung') {
      rubrik = 'Überraschung';
      titel = A0.titel('titel.ueberraschung', ctx); A0.add('einstieg.ueberraschung', ctx);
    } else if (g.fokus === 'kantersieg') {
      rubrik = 'Torfestival';
      titel = A0.titel('titel.kantersieg', ctx); A0.add('einstieg.kantersieg', ctx);
    } else {
      rubrik = a === F.eigen ? 'Spielbericht' : 'Der Spieltag';
      titel = A0.titel(remis ? 'titel.remis' : gewonnen ? 'titel.sieg' : 'titel.niederlage', ctx);
      A0.add(remis ? 'einstieg.remis' : gewonnen ? 'einstieg.sieg' : 'einstieg.niederlage', ctx);
    }
    // Bild: Spieler-Porträt, wenn ein Spieler die Geschichte trägt, sonst die Wappen beider Vereine
    const held = g.fokus === 'hattrick' ? g.top.s : (tore[a] || []).slice().sort((x, y) => y.n - x.n)[0];
    if (held && held.bild && (g.fokus === 'hattrick' || held.n >= 2)) bild = { art: 'gesicht', p: held.bild, team: g.fokus === 'hattrick' ? g.top.id : a, erg: werte.erg };
    else bild = { art: 'duell', a, b, erg: werte.erg };
    if (kurz) return { typ: 'spiel', fokus: g.fokus, rubrik, titel, saetze: A0.saetze, bild, teams: [a, b], eigen: g.eigen };

    // Kern: Tore, Serie, Stärke, Rekord, Tabelle, Ausblick
    if (g.fokus === 'hattrick') {
      const S = g.top.s;
      if (S.saisontore && S.saisontore > S.n) A0.add('tore.saison', { werte: { saisontore: S.saisontore <= 12 ? zahlwort(S.saisontore) : S.saisontore } });
      toreSaetze(A0, F, 'A', TA, tore[a], S);
    } else if (remis) {
      // Remis: kein „Tor des Tages“ – je Verein, wer getroffen hat
      [[TA, tore[a]], [TB, tore[b]]].forEach(([T1, l1]) => { const l = torText(l1); if (l) A0.add(l.einer ? 'tore.gegner' : 'tore.gegner.mehr', { teams: { B: T1 }, werte: { liste: l.liste } }); });
    } else toreSaetze(A0, F, 'A', TA, gewonnen ? tore[a] : tore[b], null);
    if (!gewonnen && !remis && (tore[a] || []).length && g.fokus !== 'hattrick') {
      const l = torText(tore[a]);
      A0.add(l.einer ? 'tore.gegner' : 'tore.gegner.mehr', { teams: { B: TA }, werte: { liste: l.liste } });
    } else if (gewonnen && (tore[b] || []).length && g.fokus !== 'hattrick' && W.rnd() < 0.5) {
      const l = torText(tore[b]);
      A0.add(l.einer ? 'tore.gegner' : 'tore.gegner.mehr', { teams: { B: TB }, werte: { liste: l.liste } });
    }
    if (g.fokus === 'ueberraschung' && g.dSt) A0.add('staerke', { teams: { A: TA, B: TB }, werte: { diff: zahlwort(Math.round(g.dSt)) } });
    if (g.fokus === 'kantersieg' && s.rekord) A0.add('rekord', {});
    // Serie: läuft weiter (nicht beim Serien-Schwerpunkt, dort steht sie schon im Einstieg)
    if (g.fokus !== 'serieS' && g.fokus !== 'serieN' && nA >= 3 && serieA.art === (gewonnen ? 'S' : 'N') && !remis)
      A0.add(gewonnen ? 'serie.s' : 'serie.n', { teams: { A: TA }, werte: { nw: zahlwort(nA), nter: ordnung(nA) } });
    // beendete Serie des Gegners
    if (TB.serieVorher && TB.serieVorher.n >= 3) {
      const sv = TB.serieVorher;
      if (sv.art === 'S' && (gewonnen || remis)) A0.add('serie.ende.s', { teams: { A: TB }, werte: { nw: zahlwort(sv.n) } });
    }
    if (TA.serieVorher && TA.serieVorher.art === 'N' && TA.serieVorher.n >= 3 && gewonnen) A0.add('serie.ende.n', { teams: { A: TA }, werte: { nw: zahlwort(TA.serieVorher.n) } });
    if ((F.spieltag || 0) >= 2) tabellenSatz(A0, F, a);
    if (TA.platz && TA.platz <= 7 && (F.spieltag || 0) >= 8 && TA.platz > 1 && W.rnd() < 0.5) A0.add('tabelle.playoff', { teams: { A: TA } });
    const n = F.naechste && F.naechste[a];
    if (n && F.teams[n]) A0.add(derbyArt(F, a, n) === 'rivale' ? 'ausblick.derby' : 'ausblick', { teams: { A: TA, N: teamVon(F, n) } });
    // Zitat: beim Hattrick der Schütze, sonst der Trainer des Hauptdarstellers (bei Niederlage im Derby der Verlierer)
    if (g.fokus === 'hattrick' && g.top.s.sprecher) zitat = zitatVon(F, W, g.top.id, 'zitat.spieler.hattrick', { spieler: g.top.s.sprecher });
    else {
      const key = g.fokus === 'derby' ? (remis ? 'zitat.remis' : gewonnen ? 'zitat.derby' : 'zitat.derby.niederlage')
        : g.fokus === 'serieS' ? 'zitat.serie.s' : g.fokus === 'serieN' ? 'zitat.serie.n' : g.fokus === 'ueberraschung' ? 'zitat.ueberraschung'
          : remis ? 'zitat.remis' : !gewonnen ? 'zitat.niederlage' : (ta - tb >= 3 ? 'zitat.sieg.deutlich' : ta - tb === 1 ? 'zitat.sieg.knapp' : 'zitat.sieg');
      zitat = zitatVon(F, W, a, key);
    }
    return { typ: 'spiel', fokus: g.fokus, rubrik, titel, saetze: A0.saetze, zitat, bild, teams: [a, b], eigen: g.eigen };
  }

  // Spiel eines Vereins an diesem Spieltag (für Tabellen-Geschichten)
  const spielVon = (F, id) => (F.spiele || []).find(s => s.h === id || s.g === id) || null;

  function schreibeTabelle(F, W, g, kurz) {
    const A0 = new Artikel(F, W), t = teamVon(F, g.team), s = spielVon(F, g.team);
    const konf = t.konfName ? 'Conference ' + t.konfName : 'Conference';
    const werte = { konf, platz: t.platz, punkte: t.punkte, spiele: t.spiele };
    let ctx = { teams: { A: t }, werte }, b = null;
    if (s) {
      b = s.h === g.team ? s.g : s.h;
      const ta = s.h === g.team ? s.th : s.tg, tb = s.h === g.team ? s.tg : s.th;
      ctx = { teams: { A: t, B: teamVon(F, b) }, werte: Object.assign(werte, { erg: ergVon(ta, tb) }) };
    }
    let titel, rubrik = 'Tabelle';
    if (g.typ === 'fuehrung') {
      titel = A0.titel('titel.fuehrung', ctx);
      A0.add(s ? 'einstieg.fuehrung' : 'einstieg.fuehrung.ohne', ctx);
      const vor = t.vorgaenger && F.teams[t.vorgaenger];
      if (!kurz && vor) A0.add('tabelle.vorher', { teams: { V: vor } });
    } else if (g.typ === 'playoffplatz') {
      if (!s) return null;
      titel = A0.titel('titel.playoffplatz', ctx); A0.add('einstieg.playoffplatz', ctx); rubrik = 'Playoff-Rennen';
    } else {
      if (!s) return null;
      titel = A0.titel('titel.playoffraus', ctx); A0.add('einstieg.playoffraus', ctx); rubrik = 'Playoff-Rennen';
    }
    const bild = b ? { art: 'duell', a: g.team, b, erg: ctx.werte.erg } : { art: 'wappen', team: g.team };
    if (kurz) return { typ: g.typ, rubrik, titel, saetze: A0.saetze, bild, teams: [g.team] };
    if (t.punkte != null && t.spiele) A0.add('tabelle.punkte', { teams: { A: t }, werte: { punkte: t.punkte, spiele: t.spiele } });
    const n = F.naechste && F.naechste[g.team];
    if (n && F.teams[n]) A0.add('ausblick', { teams: { A: t, N: teamVon(F, n) } });
    return { typ: g.typ, rubrik, titel, saetze: A0.saetze, zitat: g.typ === 'fuehrung' ? zitatVon(F, W, g.team, 'zitat.fuehrung') : null, bild, teams: [g.team] };
  }

  function schreibeSaisonstart(F, W, kurz) {
    const A0 = new Artikel(F, W), sp0 = F.spiele || [];
    const tore = sp0.reduce((s, x) => s + x.th + x.tg, 0);
    const best = sp0.filter(x => x.th !== x.tg).slice().sort((x, y) => Math.abs(y.th - y.tg) - Math.abs(x.th - x.tg) || (y.th + y.tg) - (x.th + x.tg))[0];
    const werte = { tore: tore <= 12 ? zahlwort(tore) : tore, jahr: F.jahr };
    let ctxB = null;
    if (best) {
      const a = best.th > best.tg ? best.h : best.g, b = a === best.h ? best.g : best.h;
      ctxB = { teams: { A: teamVon(F, a), B: teamVon(F, b) }, werte: Object.assign({}, werte, { erg: ergVon(Math.max(best.th, best.tg), Math.min(best.th, best.tg)) }) };
    }
    const titel = A0.titel(ctxB && W.rnd() < 0.5 ? 'titel.saisonstart.team' : 'titel.saisonstart', ctxB || { werte });
    A0.add('einstieg.saisonstart', { werte });
    if (ctxB) A0.add('saisonstart.bester', ctxB);
    const bild = best ? { art: 'duell', a: ctxB.teams.A.id, b: ctxB.teams.B.id, erg: ctxB.werte.erg } : { art: 'liga' };
    if (kurz) return { typ: 'saisonstart', rubrik: 'Saisonstart', titel, saetze: A0.saetze, bild, teams: [] };
    // Favorit (stärkster Kader, öffentlich)
    const fav = Object.values(F.teams).slice().sort((x, y) => (y.staerke || 0) - (x.staerke || 0))[0];
    const fs = fav && spielVon(F, fav.id);
    if (fs && (!best || (fs !== best))) {
      const gId = fs.h === fav.id ? fs.g : fs.h, ta = fs.h === fav.id ? fs.th : fs.tg, tb = fs.h === fav.id ? fs.tg : fs.th;
      A0.add(ta > tb ? 'saisonstart.favorit.s' : ta < tb ? 'saisonstart.favorit.n' : 'saisonstart.favorit.u',
        { teams: { F: fav, G: teamVon(F, gId) }, werte: { ergF: ergVon(ta, tb) } });
    }
    const es = spielVon(F, F.eigen);
    if (es && es !== best && (!fav || fav.id !== F.eigen)) {
      const o = es.h === F.eigen ? es.g : es.h, ta = es.h === F.eigen ? es.th : es.tg, tb = es.h === F.eigen ? es.tg : es.th;
      A0.add(ta > tb ? 'saisonstart.eigen.s' : ta < tb ? 'saisonstart.eigen.n' : 'saisonstart.eigen.u',
        { teams: { E: teamVon(F, F.eigen), O: teamVon(F, o) }, werte: { ergE: ergVon(ta, tb) } });
    }
    const zitat = best ? zitatVon(F, W, ctxB.teams.A.id, 'zitat.saisonstart') : null;
    return { typ: 'saisonstart', rubrik: 'Saisonstart', titel, saetze: A0.saetze, zitat, bild, teams: [] };
  }

  function schreibeTrade(F, W, g, kurz) {
    const tr = g.tr, A0 = new Artikel(F, W), TA = teamVon(F, tr.an), TB = teamVon(F, tr.von), P = sp(tr.spieler);
    const ctx = { teams: { A: TA, B: TB }, spieler: { P } };
    const titel = A0.titel('titel.trade', ctx);
    A0.add('einstieg.trade', ctx);
    const bild = tr.spieler && tr.spieler.bild ? { art: 'gesicht', p: tr.spieler.bild, team: tr.an, tausch: tr.von } : { art: 'duell', a: tr.an, b: tr.von, tausch: true };
    if (kurz) return { typ: 'trade', rubrik: 'Trade', titel, saetze: A0.saetze, bild, teams: [tr.an, tr.von] };
    const gegen = (tr.gegen || []).map(x => pickText(x) || x).filter(Boolean);
    if (gegen.length) A0.add('trade.gegen', { teams: { B: TB }, werte: { gegen: liste(gegen) } });
    if (tr.weg === 'weg') A0.add('trade.weg', { teams: { B: TB }, spieler: { P } });
    else if (tr.weg === 'abgabe') A0.add('trade.abgabe', { teams: { B: TB } });
    if (tr.lage === 'Titel jetzt') A0.add('trade.titel', { teams: { A: TA } });
    else if (tr.lageB === 'Neuaufbau') A0.add('trade.aufbau', { teams: { B: TB } });
    if (tr.spieler && tr.spieler.alter) A0.add(tr.spieler.alter <= 24 ? 'trade.alter.jung' : 'trade.alter.alt', { werte: { alter: tr.spieler.alter } });
    return { typ: 'trade', rubrik: 'Trade', titel, saetze: A0.saetze, zitat: zitatVon(F, W, tr.an, 'zitat.trade'), bild, teams: [tr.an, tr.von] };
  }

  function schreibeFa(F, W, g, kurz) {
    const f = g.fa[0], A0 = new Artikel(F, W), TA = teamVon(F, f.team), P = sp(f.spieler);
    const ctx = { teams: { A: TA }, spieler: { P }, werte: { jahre: jahreText(f.jahre || 1), summe: f.summe, jeJahr: f.jeJahr } };
    const titel = A0.titel('titel.fa', ctx);
    A0.add('einstieg.fa', ctx);
    const bild = f.spieler && f.spieler.bild ? { art: 'gesicht', p: f.spieler.bild, team: f.team } : { art: 'wappen', team: f.team };
    if (kurz) return { typ: 'fa', rubrik: 'Free Agency', titel, saetze: A0.saetze, bild, teams: [f.team] };
    if (f.summe && f.jeJahr) A0.add('fa.summe', ctx);
    const rest = g.fa.slice(1, 4).map(x => `${x.spieler.voll} (${teamKurzText(F, x.team)})`);
    if (rest.length) A0.add(rest.length === 1 ? 'fa.weitere.einer' : 'fa.weitere', { werte: { liste: liste(rest) } });
    return { typ: 'fa', rubrik: 'Free Agency', titel, saetze: A0.saetze, zitat: zitatVon(F, W, f.team, 'zitat.fa'), bild, teams: [f.team] };
  }
  const teamKurzText = (F, id) => { const t = teamVon(F, id); return t.kurz || t.voll; };

  function schreibeVerletzung(F, W, g, kurz) {
    const v = g.verl[0], A0 = new Artikel(F, W), TA = teamVon(F, v.team), P = sp(v.spieler);
    const ctx = { teams: { A: TA }, spieler: { P }, werte: { wochen: wochenText(v.wochen), art: v.art } };
    const titel = A0.titel('titel.verletzung', ctx);
    A0.add('einstieg.verletzung', ctx);
    const bild = v.spieler && v.spieler.bild ? { art: 'gesicht', p: v.spieler.bild, team: v.team } : { art: 'wappen', team: v.team };
    if (kurz) return { typ: 'verletzung', rubrik: 'Verletzung', titel, saetze: A0.saetze, bild, teams: [v.team] };
    if (v.art) A0.add('verletzung.art', ctx);
    const rest = g.verl.slice(1, 3).map(x => `${x.spieler.voll} (${teamKurzText(F, x.team)}, ${wochenText(x.wochen)})`);
    if (rest.length) A0.add(rest.length === 1 ? 'verletzung.weitere.einer' : 'verletzung.weitere', { werte: { liste: liste(rest) } });
    return { typ: 'verletzung', rubrik: 'Verletzung', titel, saetze: A0.saetze, zitat: zitatVon(F, W, v.team, 'zitat.verletzung'), bild, teams: [v.team] };
  }

  function schreibeDraft(F, W, kurz) {
    const d = F.draft, p1 = d.picks[0], A0 = new Artikel(F, W), TA = teamVon(F, p1.team), P = sp(p1.spieler);
    const ctx = { teams: { A: TA }, spieler: { P }, werte: { jahr: d.jahr } };
    const titel = A0.titel('titel.draft', ctx);
    A0.add('einstieg.draft', ctx);
    const bild = p1.spieler && p1.spieler.bild ? { art: 'gesicht', p: p1.spieler.bild, team: p1.team } : { art: 'wappen', team: p1.team };
    if (kurz) return { typ: 'draft', rubrik: 'Draft', titel, saetze: A0.saetze, bild, teams: [p1.team] };
    if (p1.spieler.alter && p1.spieler.college) A0.add('draft.college', { werte: { alter: p1.spieler.alter, college: p1.spieler.college } });
    const danach = d.picks.slice(1, 4).map(x => `${x.spieler.voll} (${teamKurzText(F, x.team)})`);
    if (danach.length) A0.add(danach.length === 1 ? 'draft.danach.einer' : 'draft.danach', { werte: { liste: liste(danach) } });
    const eig = (d.eigen || [])[0];
    if (eig && eig.nr !== 1) A0.add('draft.eigen', { teams: { E: teamVon(F, F.eigen) }, spieler: { Q: sp(eig.spieler) }, werte: { nr: eig.nr } });
    return { typ: 'draft', rubrik: 'Draft', titel, saetze: A0.saetze, zitat: zitatVon(F, W, p1.team, 'zitat.draft'), bild, teams: [p1.team] };
  }

  function schreibePoStart(F, W, kurz) {
    const po = F.playoffs, A0 = new Artikel(F, W), E = teamVon(F, F.eigen);
    const drin = !!po.eigenSeed;
    const titel = A0.titel(drin ? 'titel.po.start.drin' : 'titel.po.start.raus', { teams: { E } });
    A0.add('einstieg.po.start', {});
    const konfs = Object.keys(po.setz || {});
    const eins = konfs.map(k => po.setz[k][0]).filter(Boolean);
    const bild = drin ? { art: 'wappen', team: F.eigen } : (eins.length === 2 ? { art: 'duell', a: eins[0], b: eins[1] } : { art: 'liga' });
    if (eins.length === 2) A0.add('po.start.freilos', { teams: { A: teamVon(F, eins[0]), B: teamVon(F, eins[1]) } });
    if (kurz) return { typ: 'poStart', rubrik: 'Playoffs', titel, saetze: A0.saetze, bild, teams: [] };
    if (drin) {
      const konf = E.konfName ? 'Conference ' + E.konfName : 'Conference';
      if (po.eigenSeed === 1) A0.add('po.start.eigen.frei', { teams: { E } });
      else {
        A0.add('po.start.eigen', { teams: { E }, werte: { seed: po.eigenSeed, konf } });
        if (po.eigenGegner) A0.add('po.start.eigen.gegner', { teams: { N: teamVon(F, po.eigenGegner) } });
      }
    } else if (E.platz) {
      A0.add('po.start.raus', { teams: { E }, werte: { platz: E.platz, konf: E.konfName ? 'Conference ' + E.konfName : 'Conference' } });
      if (po.abstand > 0) A0.add('po.start.abstand', { werte: { pkt: zahlwort(po.abstand) } });
    }
    return { typ: 'poStart', rubrik: 'Playoffs', titel, saetze: A0.saetze, zitat: drin ? zitatVon(F, W, F.eigen, 'zitat.po.start') : null, bild, teams: [] };
  }

  function poSpielWerte(s, sieger) {
    const a = sieger, heim = s.h === a;
    const ta = heim ? s.th : s.tg, tb = heim ? s.tg : s.th;
    const w = { erg: ergVon(ta, tb), zusatz: zusatzText(s.art) };
    // im Elfmeterschießen steht das Ergebnis vom Punkt vorn („4:3 im Elfmeterschießen“), das nach 120 Minuten im Text
    if (s.art === 'Elfmeterschießen' && s.elfer) { const e = heim ? s.elfer : [s.elfer[1], s.elfer[0]]; w.elfer = ergVon(e[0], e[1]); w.ergR = ergVon(ta, tb); w.erg = w.elfer; }
    return w;
  }
  function schreibePoRunde(F, W, kurz) {
    const po = F.playoffs, r = po.runde, A0 = new Artikel(F, W);
    const spiele = po.spiele || [];
    // Schwerpunkt: eigenes Spiel, sonst Krimi, sonst Außenseitersieg, sonst das erste Spiel
    const sp1 = spiele.find(s => s.h === F.eigen || s.g === F.eigen) || spiele.find(s => s.art === 'Elfmeterschießen' || s.art === 'Verlängerung')
      || spiele.find(s => s.seedSieger && s.seedVerl && s.seedSieger > s.seedVerl) || spiele[0];
    if (!sp1) return null;
    const a = sp1.sieger, b = a === sp1.h ? sp1.g : sp1.h;
    const werte = Object.assign({ runde: RUNDE[r], weiter: WEITER_IN[r] || '' }, poSpielWerte(sp1, a));
    const ctx = { teams: { A: teamVon(F, a), B: teamVon(F, b) }, werte };
    const krimi = sp1.art === 'Elfmeterschießen' || sp1.art === 'Verlängerung';
    const titel = A0.titel(r === 3 ? 'titel.po.runde.finale' : krimi ? 'titel.po.runde.krimi' : 'titel.po.runde', ctx);
    A0.add('einstieg.po.runde', ctx);
    const bild = { art: 'duell', a, b, erg: werte.erg };
    if (kurz) return { typ: 'poRunde', rubrik: RUNDE[r], titel, saetze: A0.saetze, bild, teams: [a, b] };
    if (sp1.art === 'Elfmeterschießen' && werte.elfer) A0.add('po.elfer', ctx);
    else if (sp1.art === 'Verlängerung') A0.add('po.verlaengerung', ctx);
    if (sp1.seedSieger && sp1.seedVerl && sp1.seedSieger - sp1.seedVerl >= 2)
      A0.add('po.seeds', { teams: { A: teamVon(F, a) }, werte: { seedA: sp1.seedSieger, seedB: sp1.seedVerl } });
    if (r === 3 && po.finalGegner && po.finalGegner[a]) A0.add('po.finale', { teams: { F: teamVon(F, po.finalGegner[a]) }, werte: { ort: po.ort || 'neutralem Platz' } });
    // Zitat: verliert der eigene Verein, spricht sein Trainer; sonst der Sieger (deutlicher Sieg ohne „eng“)
    const marge = Math.abs((sp1.th || 0) - (sp1.tg || 0));
    const zitat = b === F.eigen ? zitatVon(F, W, b, 'zitat.po.aus')
      : zitatVon(F, W, a, sp1.art === 'regulär' && marge >= 3 ? 'zitat.sieg.deutlich' : 'zitat.po.sieg');
    return { typ: 'poRunde', rubrik: RUNDE[r], titel, saetze: A0.saetze, zitat, bild, teams: [a, b] };
  }

  function schreibeMeister(F, W, kurz) {
    const po = F.playoffs, A0 = new Artikel(F, W), a = po.meister, b = po.finalist, f = po.finale || {};
    const werte = Object.assign({ ort: po.ort || 'neutralem Platz', jahrE: F.jahrEnde || F.jahr }, f.h ? poSpielWerte(f, a) : { erg: '', zusatz: '' });
    const ctx = { teams: { A: teamVon(F, a), B: teamVon(F, b) }, werte };
    const titel = A0.titel('titel.meister', ctx);
    if (f.h) A0.add('einstieg.meister', ctx);
    const bild = { art: 'wappen', team: a, meister: true };
    if (kurz) return { typ: 'meister', rubrik: 'Finale', titel, saetze: A0.saetze, bild, teams: [a] };
    if (po.titelNr === 1) A0.add('meister.titel.erster', { teams: { A: teamVon(F, a) } });
    else if (po.titelNr > 1) A0.add('meister.titel.mehr', { teams: { A: teamVon(F, a) }, werte: { nter: ordnung(po.titelNr) } });
    if (f.art === 'Elfmeterschießen' && werte.elfer) A0.add('po.elfer', ctx);
    if (po.seed && teamVon(F, a).konfName) A0.add('meister.seed', { teams: { A: teamVon(F, a) }, werte: { seed: po.seed, konf: 'Conference ' + teamVon(F, a).konfName } });
    if (b) A0.add('meister.finalist', { teams: { B: teamVon(F, b) } });
    return { typ: 'meister', rubrik: 'Finale', titel, saetze: A0.saetze, zitat: zitatVon(F, W, a, 'zitat.meister'), bild, teams: [a] };
  }

  function schreibe(F, W, g, kurz) {
    switch (g.typ) {
      case 'spiel': return schreibeSpiel(F, W, g, kurz);
      case 'fuehrung': case 'playoffplatz': case 'playoffraus': return schreibeTabelle(F, W, g, kurz);
      case 'saisonstart': return schreibeSaisonstart(F, W, kurz);
      case 'trade': return schreibeTrade(F, W, g, kurz);
      case 'fa': return schreibeFa(F, W, g, kurz);
      case 'verletzung': return schreibeVerletzung(F, W, g, kurz);
      case 'draft': return schreibeDraft(F, W, kurz);
      case 'poStart': return schreibePoStart(F, W, kurz);
      case 'poRunde': return schreibePoRunde(F, W, kurz);
      case 'meister': return schreibeMeister(F, W, kurz);
      default: return null;
    }
  }

  // ═══ Ausgabe ══════════════════════════════════════════════════════════════
  // gedaechtnis: [[Vorlagen-IDs je Ausgabe], …] (älteste zuerst); opt.saat (Zahl), opt.immer (auch ohne Geschichte, für Tests)
  function ausgabe(F, gedaechtnis, opt) {
    opt = opt || {};
    const G = geschichten(F);
    if (!G.length) return null;
    const W = Schreiber(gedaechtnis, opt.saat || 1);
    // Reihenfolge: Gewicht, bei Gleichstand der eigene Verein, dann Zufall
    G.forEach(g => { g._r = W.rnd(); g._eigen = (g.teams || []).indexOf(F.eigen) >= 0 ? 1 : 0; });
    G.sort((a, b) => b.gewicht - a.gewicht || b._eigen - a._eigen || a._r - b._r);
    if (G[0].gewicht < CFG.schwelle && !opt.immer) return null;
    // Spielgeschichten, die schon in einer Tabellen-/Saisonstart-Geschichte stecken, als Meldung nur, wenn sie selbst tragen
    const stuecke = [], schluessel = new Set(), foki = new Set();
    const lead = G[0];
    const aufmacher = schreibe(F, W, lead, false);
    if (!aufmacher) return null;
    aufmacher.gewicht = lead.gewicht;
    stuecke.push(aufmacher); schluessel.add(lead.schluessel);
    const leadSpiel = lead.typ === 'spiel' ? lead.schluessel : (lead.typ === 'fuehrung' || lead.typ === 'playoffplatz' || lead.typ === 'playoffraus')
      ? (() => { const s = spielVon(F, lead.team); return s ? 'spiel:' + s.h + ':' + s.g : null; })() : null;
    for (const g of G.slice(1)) {
      if (stuecke.length > CFG.weitere) break;
      if (schluessel.has(g.schluessel) || g.schluessel === leadSpiel) continue;
      if (g.gewicht < CFG.weitereAb && !(g.typ === 'spiel' && g.eigen)) continue;
      // Tabellen-Geschichte zum selben Spiel wie eine schon gewählte Spielgeschichte: weglassen
      if ((g.typ === 'fuehrung' || g.typ === 'playoffplatz' || g.typ === 'playoffraus')) { const s = spielVon(F, g.team); if (s && schluessel.has('spiel:' + s.h + ':' + s.g)) continue; }
      if (g.typ === 'spiel' && stuecke.some(x => (x.typ === 'fuehrung' || x.typ === 'playoffplatz' || x.typ === 'playoffraus') && x.teams && (x.teams[0] === g.sp.h || x.teams[0] === g.sp.g))) continue;
      // Abwechslung: je Schwerpunkt (Überraschung, Serie …) höchstens eine Meldung
      const fokus = g.typ + ':' + (g.fokus || '');
      if (foki.has(fokus) && !(g.typ === 'spiel' && g.eigen)) continue;
      const k = schreibe(F, W, g, true);
      if (!k) continue;
      foki.add(fokus);
      k.gewicht = g.gewicht;
      stuecke.push(k); schluessel.add(g.schluessel);
    }
    return { stuecke, vorlagen: W.benutzt.slice(), gewicht: lead.gewicht, art: lead.typ };
  }

  // Prüfung der Vorlagen selbst (Prüflauf): Platzhalter bekannt, keine doppelten Leerzeichen, Satzzeichen
  function pruefeVorlagen() {
    const f = [];
    Object.keys(VORLAGEN).forEach(k => VORLAGEN[k].forEach((v, i) => {
      if (/\s{2,}/.test(v)) f.push(`${k}#${i}: doppeltes Leerzeichen`);
      if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(v)) f.push(`${k}#${i}: Emoji`);
      if ((v.match(/\{/g) || []).length !== (v.match(/\}/g) || []).length) f.push(`${k}#${i}: Klammern`);
      if (/\bOVR\b/.test(v)) f.push(`${k}#${i}: OVR`);
    }));
    return f;
  }

  window.DFLZeitungText = { CFG, VORLAGEN, ausgabe, geschichten, satz, formen, liste, zahlwort, ordnung, pickText, pruefeVorlagen, rngAus, Schreiber, POS, RUNDE, DERBY };
  if (typeof console !== 'undefined') console.log('[DFL-Zeitung-Text v1] aktiv — Textbaukasten mit Grammatik der Vereinsnamen und Gedächtnis');
})();
