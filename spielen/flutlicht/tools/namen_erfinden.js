/* Werkzeug (wird vom Spiel nicht geladen) – 2026-10-16, Nutzer: „echte Spielernamen müssen vor dem Store raus“.
   Ersetzt die (bisher nur leicht verfremdeten) Namen der 1558 Kartei-Spieler in data/game_data.js durch erfundene Namen aus den
   Namenslisten des jeweiligen Landes (scouting_patch.js SCOUTING_COUNTRIES, engine_main.js GERMAN_FIRST/TRANSFER_SURNAMES;
   Länder ohne Liste über NAH aus kickstil_namen.js). Werte, Alter, Positionen und Nationalität bleiben.
   Regeln: deterministisch (Prüfsumme aus altem Namen + Verein), kein Name doppelt, neuer Nachname beginnt nicht wie der alte,
   gesperrte Kombinationen berühmter Spieler (SPERRE). Schreibt data/game_data.js neu und data/ks_namen2.js (Prüfsumme des alten
   Namens → neuer Name) für die Umbenennung alter Spielstände (kickstil_namen.js).
   Aufruf (Repo-Wurzel, Spiel auf http://localhost:8133):  NODE_PATH=… node flutlicht_manager/tools/namen_erfinden.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const WURZEL = path.join(__dirname, '..');
const SPERRE = ['Thomas Müller', 'Manuel Neuer', 'Toni Kroos', 'Mats Hummels', 'Marco Reus', 'Leon Goretzka', 'Joshua Kimmich', 'Jamal Musiala',
  'Florian Wirtz', 'Kai Havertz', 'Leroy Sané', 'Serge Gnabry', 'Niclas Füllkrug', 'Jonathan Tah', 'Antonio Rüdiger', 'Timo Werner', 'Julian Brandt',
  'Robin Gosens', 'David Raum', 'Nico Schlotterbeck', 'Deniz Undav', 'Pascal Groß', 'Chris Führich', 'Karim Adeyemi', 'Robert Andrich', 'Oliver Baumann',
  'Alexander Nübel', 'Kevin Trapp', 'Bernd Leno', 'Mario Götze', 'Lukas Podolski', 'Philipp Lahm', 'Miroslav Klose', 'Michael Ballack', 'Oliver Kahn',
  'Max Kruse', 'Julian Draxler', 'Emre Can', 'Jonas Hector', 'Matthias Ginter', 'Kevin Volland', 'Lars Bender', 'Sven Bender', 'Max Meyer', 'Timo Horn',
  'Lukas Klostermann', 'Benjamin Henrichs', 'Maximilian Mittelstädt', 'Felix Nmecha', 'Aleksandar Pavlović', 'Angelo Stiller', 'Maximilian Arnold',
  'Kevin Kampl', 'Christoph Kramer', 'Sebastian Rode', 'Marvin Ducksch', 'Jonas Hofmann', 'Florian Neuhaus', 'Nadiem Amiri', 'Tim Kleindienst',
  'Ragnar Ache', 'Lukas Hradecky', 'Daniel Ginczek', 'Kevin Behrens', 'Jan Thielmann', 'Marius Wolf', 'Jonas Urbig', 'Tom Bischof', 'Paul Wanner'];
(async () => {
  const NAH = Function('return ' + /const NAH = (\{[\s\S]*?\});/.exec(fs.readFileSync(path.join(WURZEL, 'js/kickstil_namen.js'), 'utf8'))[1])();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:8133/index.html'); await p.waitForTimeout(2500);
  const r = await p.evaluate(({ NAH, SPERRE }) => {
    const h32 = KSNamen.h32, SC = window.SCOUTING_COUNTRIES || {};
    const uniq = a => Array.from(new Set(a.filter(Boolean)));
    const liste = (land, art) => {
      const d = SC[land] || SC[NAH[land]];
      let l = d ? d[art] || [] : [];
      if (land === 'Deutschland' || (!d && art)) {
        if (land === 'Deutschland' || !d) l = l.concat(art === 'first' ? GERMAN_FIRST : TRANSFER_SURNAMES).concat(((SC.Deutschland || {})[art]) || []);
      }
      return uniq(l);
    };
    const sperre = new Set(SPERRE.map(s => s.toLowerCase()));
    const vergeben = new Set(), map = {}, aus = [];
    const ohne = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    EMBEDDED_PLAYERS.forEach((q, i) => {
      const land = q.country || 'Deutschland';
      const vor = liste(land, 'first'), nach = liste(land, 'last');
      let h = h32((q.firstName || '') + '|' + q.name + '|' + q.clubId);
      let neu = null;
      for (let v = 0; v < 400 && !neu; v++) {
        const f = vor[(h + v * 7) % vor.length], l = nach[((h >>> 7) + v * 13) % nach.length];
        const voll = (f + ' ' + l).toLowerCase();
        if (vergeben.has(voll) || sperre.has(voll)) continue;
        if (ohne(l).slice(0, 3) === ohne(q.name).slice(0, 3)) continue;         // nicht wie der alte Name beginnen
        if (ohne(f) === ohne(q.firstName) && ohne(l).slice(0, 2) === ohne(q.name).slice(0, 2)) continue;
        neu = { firstName: f, name: l };
      }
      if (!neu) throw new Error('kein Name für ' + q.name + ' ' + land);
      vergeben.add((neu.firstName + ' ' + neu.name).toLowerCase());
      map[h32((q.firstName || '') + '|' + q.name)] = [neu.firstName, neu.name];
      aus.push(neu);
    });
    return { aus, map, ohneListe: uniq(EMBEDDED_PLAYERS.map(q => q.country).filter(c => !SC[c] && !SC[NAH[c]] && c !== 'Deutschland')) };
  }, { NAH, SPERRE });
  await b.close();
  // game_data.js neu schreiben: nur firstName/name der EMBEDDED_PLAYERS ersetzen
  const datei = path.join(WURZEL, 'data/game_data.js');
  let src = fs.readFileSync(datei, 'utf8');
  const start = src.indexOf('window.EMBEDDED_PLAYERS = ') + 'window.EMBEDDED_PLAYERS = '.length;
  const ende = src.indexOf('];', start) + 1;
  const spieler = JSON.parse(src.slice(start, ende));
  if (spieler.length !== r.aus.length) throw new Error('Anzahl passt nicht');
  spieler.forEach((q, i) => { q.firstName = r.aus[i].firstName; q.name = r.aus[i].name; });
  src = src.slice(0, start) + JSON.stringify(spieler).replace(/},\{/g, '}, {').replace(/":/g, '": ').replace(/,"/g, ', "') + src.slice(ende);
  fs.writeFileSync(datei, src);
  fs.writeFileSync(path.join(WURZEL, 'data/ks_namen2.js'),
    '/* Umbenennung alter Spielstände (2026-10-16, tools/namen_erfinden.js): Prüfsumme (FNV-1a, KSNamen.h32) von Vorname|Nachname\n' +
    '   der früheren, nur leicht verfremdeten Kartei-Namen → neuer, erfundener Name. Die alten Namen selbst stehen hier nicht. */\n' +
    'window.KS_NAMEN2 = ' + JSON.stringify(r.map) + ';\n');
  console.log('neu benannt:', r.aus.length, '· Länder ohne eigene Liste (deutsche Namen):', r.ohneListe.join(', ') || 'keine');
  console.log('Beispiele:', spieler.slice(0, 12).map(q => q.firstName + ' ' + q.name + ' (' + q.country + ')').join(' · '));
})();
