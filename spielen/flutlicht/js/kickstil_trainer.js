/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · EIGENE TRAINERFIGUR  ·  v1   (Nutzer 2026-10-16: „dass der Spieler sich selbst erstellen kann … auch Frauen
   zulassen … eigene Werte haben und sich selber entwickeln je nachdem, wie man sich als Trainer so anstellt“)
   ─────────────────────────────────────────────────────────────────────────
   ERSTELLEN   Nach der Vereinswahl (und einmal für alte Spielstände): Trainer oder Trainerin, Name, Alter, Gesicht aus
               facesjs-Bausteinen (Kopf, Haut, Frisur, Haarfarbe, Brauen, Augen, Nase, Mund, Bart, Brille, Kopfbedeckung)
               und Outfit in Vereinsfarben (Trainingsjacke, Anzug, Pullover, Mantel mit Schal, Polo). Danach der Werdegang.
   WERTE       Sechs Werte 1–20, Start aus dem Werdegang (Summe 52), Wirkung klein:
                 taktik     Teamstärke (computeTeamRatings) (v − 8) × 0,15, gerundet: ab 12 +1, ab 18 +2, bis 4 −1
                 fuehrung   Moral: je Woche Chance (v − 8) × 5 % auf +1 für Spieler unter 70 (unter 8: −1 für die über 70)
                 talente    Spieler bis 21 (Kickdraft 23): Trainingstempo × (1 + (v − 8) × 0,018) über traitDevFaktor (20 ≈ +22 %)
                 fitness    Verletzungsrisiko × (1 − (v − 8) × 0,02)  (20 = −24 %)
                 verhandeln Kaufverhandlung: Mitte der Annahmekurve − (v − 8) × 0,004 (20 ≈ 6 % günstiger)
                 ansehen    Vorstand: Verluste an Zufriedenheit × (1 − (v − 8) × 0,025)  (20 = −30 %)
   ENTWICKLUNG Lernen durch Tun (Erfahrung je Wert, Bedarf 6 + 1,5 × Wert):
                 taktik     Sieg 1,5 · Remis 0,5 · gegen klar Stärkere (≥ 3) Sieg 4 / Remis 2
                 fuehrung   Woche mit Teammoral ≥ 75: 1 · Sieg nach Niederlage 2 · Derbysieg 2
                 talente    je Pflichtspiel 0,3 je Startelf-Spieler bis 21 (höchstens 1; Kickdraft bis 23)
                 fitness    Woche ohne neue Verletzung 0,5
                 verhandeln Kauf 4 · Verkauf 3
                 ansehen    zum Saisonende direkt: Meister +2, Aufstieg +2, Pokal +2, Europapokal +1, obere Hälfte +1,
                            Vorstand ≥ 75 % +1, unter 40 % −1, Abstieg −2
               LIZENZEN begrenzen die Werte: C bis 13, B bis 15, A bis 18, Pro bis 20. Lehrgang in der Sommerpause, wenn
               B: 1 Saison und Summe ≥ 56 · A: 3 Saisons, Summe ≥ 64, Ansehen ≥ 9 · Pro: 5 Saisons, Summe ≥ 74, Ansehen ≥ 11.
               Jede neue Lizenz: eine Eigenschaft aus drei (EIGENSCHAFTEN).
   ALTERN      Ab 46 Falten, ab 50 graue Haare (nur Anzeige, das gewählte Gesicht bleibt gespeichert).
   ANZEIGE     Verein-Reiter oben („Dein Trainer“), Mehr → „Mein Trainer“, Sommerpause-Blatt mit Entwicklung und Lehrgang.
   Zustand CLUB.ksTrainer (Karrierestart/Laden räumen ks…-Felder, deshalb erst nach startNewGameState gesetzt).
   Vorlage fürs nächste Spiel geräteweit: localStorage „gesamt-trainer“ (Aussehen, Name, Geschlecht, Werdegang; in der Gesamt-App
   für beide Spiele dieselbe). Tests (navigator.webdriver): Figur still angelegt, außer localStorage kstr-test = an.
   KICKDRAFT (gleiche Datei in kickdraft/spiel/js, Quelle: flutlicht_manager/js): der Spieler ist der Chefcoach seiner Franchise
               (dfl_trainer.js besetzt beim eigenen Verein keinen „chef“). Unterschiede: Farben aus DFLSpiel.franchise, Verhandeln wirkt
               auf die Gehaltsforderungen (DFLGenerator.forderung für das eigene Team, 20 ≈ −7 %), Erfahrung Verhandeln aus Trades
               (DFLHandel.ausfuehren) und Free Agents (signFreeAgent), Talente bis 23 (Draft), Ansehen aus Playoffs (Meister +3, Finale +2,
               Conference-Finale +1, Playoffs +1) und dem Urteil des Eigentümers (≥ 70 +1, < 30 −1), Texte ohne Emoji (D104),
               Kachel im Front Office.
   API: KSTrainer.daten() · .wert(k) · .wort(t) · .gesichtSvg(T, opt) · .editor(opt) · .profil() · .bonus()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const KD = !!(W.DFLSpiel && W.DFLSpiel.franchise);          // Kickdraft (DFL-Franchise-Liga)
  const em = s => KD ? '' : s;                                 // D104: Kickdraft-Texte ohne Emoji
  const KEY = 'gesamt-trainer';                               // Vorlage geteilt: in der Gesamt-App derselbe Trainer in beiden Spielen
  const WERTE = [
    ['taktik', 'Taktik', 'chess-knight'], ['fuehrung', 'Menschenführung', 'heart-handshake'], ['talente', 'Talentförderung', 'plant-2'],
    ['fitness', 'Fitness', 'run'], ['verhandeln', 'Verhandeln', 'cash'], ['ansehen', 'Ansehen', 'speakerphone']];
  const WERDEGANG = {
    exprofi: { name: 'Ex-Profi', icon: 'shirt-sport', text: 'Lange selbst gespielt. Die Kabine hört zu, Taktiktafeln sind nicht deins.', w: { taktik: 6, fuehrung: 11, talente: 8, fitness: 8, verhandeln: 7, ansehen: 12 } },
    laptop: { name: 'Laptop-Trainer', icon: 'device-laptop', text: 'Videoanalyse bis nachts um drei. Taktisch top, aber keiner kennt dich.', w: { taktik: 13, fuehrung: 7, talente: 8, fitness: 9, verhandeln: 9, ansehen: 6 } },
    jugend: { name: 'Jugendtrainer', icon: 'plant-2', text: 'Aus dem Nachwuchs hochgekommen. Talente blühen bei dir auf.', w: { taktik: 8, fuehrung: 10, talente: 13, fitness: 8, verhandeln: 6, ansehen: 7 } },
    motivator: { name: 'Motivator', icon: 'flame', text: 'Deine Ansprachen gehen unter die Haut. Fitnesspläne eher nicht.', w: { taktik: 8, fuehrung: 13, talente: 8, fitness: 6, verhandeln: 8, ansehen: 9 } },
    athletik: { name: 'Athletiktrainer', icon: 'barbell', text: 'Vom Fitnesscoach zum Chef. Deine Spieler laufen und bleiben gesund.', w: { taktik: 8, fuehrung: 8, talente: 9, fitness: 13, verhandeln: 7, ansehen: 7 } },
    allrounder: { name: 'Allrounder', icon: 'adjustments', text: 'Von allem etwas, nichts übertrieben.', w: { taktik: 9, fuehrung: 9, talente: 9, fitness: 9, verhandeln: 8, ansehen: 8 }, versteckt: true }
  };
  const LIZENZEN = [
    { id: 'C', name: 'C-Lizenz', max: 13 },
    { id: 'B', name: 'B-Lizenz', max: 15, saisons: 1, summe: 56 },
    { id: 'A', name: 'A-Lizenz', max: 18, saisons: 3, summe: 64, ansehen: 9 },
    { id: 'P', name: 'Pro-Lizenz', max: 20, saisons: 5, summe: 74, ansehen: 11 }];
  const EIGENSCHAFTEN = {
    kabine: { name: 'Kabinenflüsterer', icon: 'message-heart', text: 'Nach Niederlagen +2 Moral für die Startelf' },
    talentauge: { name: 'Talentauge', icon: 'eye', text: 'Talentförderung wirkt 1,5-fach und bis 23 Jahre' },
    festung: { name: 'Festung', icon: 'home-shield', text: 'Heimspiele: Teamstärke +1' },
    reise: { name: 'Reisekönig', icon: 'bus', text: 'Auswärtsspiele: Teamstärke +1' },
    derby: { name: 'Derbykönig', icon: 'swords', text: 'Derbys: Teamstärke +2', nur: 'fl' },
    pokal: { name: 'Pokalfighter', icon: 'trophy', text: 'Pokal und Europapokal: Teamstärke +1', nur: 'fl' },
    playoffs: { name: 'Playoff-Fighter', icon: 'trophy', text: 'Playoffs: Teamstärke +2', nur: 'kd' },
    guru: { name: 'Fitnessguru', icon: 'heartbeat', text: 'Verletzungen zusätzlich −15 %' },
    feilscher: { name: 'Feilscher', icon: 'scale', text: 'Verhandeln wirkt doppelt' },
    medien: { name: 'Medienprofi', icon: 'microphone', text: 'Der Vorstand verzeiht zusätzlich 20 % mehr' }
  };
  const OUTFITS = [['jacke', 'Trainingsjacke'], ['anzug', 'Anzug'], ['pulli', 'Pullover'], ['mantel', 'Mantel mit Schal'], ['polo', 'Polo']];
  // Bausteine (aus facesjs 5.0.3 gesammelt, beide Geschlechter frei kombinierbar)
  const TEILE = {
    head: ['head1', 'head2', 'head3', 'head4', 'head5', 'head6', 'head7', 'head8', 'head9', 'head10', 'head11', 'head12', 'head13', 'head14', 'head15', 'head16', 'head17', 'head18', 'female1', 'female2', 'female3'],
    haut: ['#fedac7', '#f2d6cb', '#f0c5a3', '#eab687', '#ddb7a0', '#e8c3a6', '#dcb08e', '#d0a07e', '#c99878', '#bb876f', '#aa816f', '#a67358', '#ad6453', '#74453d', '#5c3937'],
    hair: ['short', 'short2', 'short3', 'crop', 'crop-fade', 'crop-fade2', 'short-fade', 'short-fade-2', 'tall-fade', 'blowoutFade', 'parted', 'middle-part', 'messy', 'messy-short', 'spike', 'spike2', 'faux-hawk',
      'curly', 'curly2', 'curly3', 'curlyFade1', 'afro', 'afro2', 'cornrows', 'dreads', 'emo', 'shaggy1', 'shaggy2', 'longHair', 'short-bald', 'bald',
      'female1', 'female2', 'female3', 'female4', 'female5', 'female6', 'female7', 'female8', 'female9', 'female10', 'female11', 'female12'],
    haarfarbe: ['#0f0902', '#1c1008', '#272421', '#2C1608', '#3D2314', '#5A3825', '#B55239', '#CC9966', '#D7BF91', '#e9c67b', '#8d8a86', '#bdbab5', '#e6e3de'],
    eyebrow: ['eyebrow1', 'eyebrow2', 'eyebrow3', 'eyebrow4', 'eyebrow5', 'eyebrow6', 'eyebrow7', 'eyebrow8', 'eyebrow9', 'eyebrow10', 'eyebrow11', 'eyebrow12', 'eyebrow13', 'eyebrow14', 'eyebrow15', 'eyebrow16', 'eyebrow17', 'eyebrow18', 'eyebrow19', 'eyebrow20',
      'female1', 'female2', 'female3', 'female4', 'female5', 'female6', 'female7', 'female8', 'female9', 'female10'],
    eye: ['eye1', 'eye2', 'eye3', 'eye4', 'eye5', 'eye6', 'eye7', 'eye8', 'eye9', 'eye10', 'eye11', 'eye12', 'eye13', 'eye14', 'eye15', 'eye16', 'eye17', 'eye18', 'eye19',
      'female1', 'female2', 'female3', 'female4', 'female5', 'female6', 'female7', 'female8', 'female9', 'female10', 'female11', 'female12', 'female13', 'female14', 'female15', 'female16'],
    nose: ['small', 'nose1', 'nose2', 'nose3', 'nose4', 'nose5', 'nose6', 'nose7', 'nose8', 'nose9', 'nose10', 'nose11', 'nose12', 'nose13', 'nose14', 'honker', 'pinocchio'],
    mouth: ['smile', 'smile2', 'smile3', 'smile4', 'smile-closed', 'closed', 'mouth', 'mouth2', 'mouth3', 'mouth4', 'mouth5', 'mouth6', 'mouth7', 'mouth8', 'side', 'straight', 'angry'],
    facialHair: ['none', 'beard1', 'beard2', 'beard3', 'beard4', 'beard5', 'beard6', 'beard-point', 'fullgoatee', 'fullgoatee2', 'goatee1', 'goatee2', 'goatee4', 'goatee1-stache', 'mustache1', 'mustache-thin',
      'chin-strap', 'chin-strapStache', 'soul', 'soul-stache', 'logan', 'honest-abe', 'harley1', 'mutton', 'muttonStache', 'neckbeard', 'sideburns1', 'sideburns2'],
    glasses: ['none', 'glasses1-primary', 'glasses1-secondary', 'glasses2-black', 'glasses2-primary', 'glasses2-secondary'],
    accessories: ['none', 'hat', 'hat2', 'hat3', 'headband']
  };
  const REIHEN = [['head', 'Gesicht'], ['haut', 'Hautton'], ['hair', 'Frisur'], ['haarfarbe', 'Haarfarbe'], ['eyebrow', 'Augenbrauen'], ['eye', 'Augen'],
    ['nose', 'Nase'], ['mouth', 'Mund'], ['facialHair', 'Bart'], ['glasses', 'Brille'], ['accessories', 'Kopfbedeckung'], ['outfit', 'Outfit']];
  const VORNAMEN = { m: ['Jonas', 'Lukas', 'Felix', 'Tobias', 'Daniel', 'Sebastian', 'Marco', 'Kai', 'Timo', 'Florian', 'Nico', 'Dennis', 'Patrick', 'Jan', 'Robin', 'Stefan', 'Mehmet', 'Luca', 'Malte', 'Ole'],
    w: ['Lena', 'Anna', 'Laura', 'Julia', 'Sarah', 'Lisa', 'Nina', 'Katharina', 'Miriam', 'Johanna', 'Sophie', 'Carla', 'Merle', 'Hanna', 'Elif', 'Paula', 'Svenja', 'Marie', 'Jana', 'Tanja'] };
  const NACHNAMEN = ['Hartmann', 'Kessler', 'Brandt', 'Wagner', 'Lorenz', 'Seidel', 'Kramer', 'Busch', 'Albrecht', 'Hahn', 'Winter', 'Sommer', 'Engel', 'Franke', 'Graf', 'Roth', 'Jung', 'Lange', 'Vogel', 'Kaya', 'Neumann', 'Peters', 'Ritter', 'Stein'];

  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const zuf = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lies = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ohne Speicher */ } };
  const toast = (t, art) => { if (typeof W.showToast === 'function') W.showToast(t, art || 'info'); };
  const news = (titel, text) => { try { if (typeof addNews === 'function') addNews('club', titel, text); } catch (e) { /* ohne Postfach */ } };
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ } };
  const jahrJetzt = () => { try { return typeof seasonStartYear === 'function' ? seasonStartYear(LEAGUE.season) : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } };
  // Automatische Tests (Playwright, navigator.webdriver): Figur still anlegen, Lehrgang still wählen – außer localStorage kstr-test = an
  const testlauf = () => { try { return !!navigator.webdriver && localStorage.getItem('kstr-test') !== 'an'; } catch (e) { return false; } };
  const testWerdegang = () => { try { return localStorage.getItem('kstr-wg') || 'allrounder'; } catch (e) { return 'allrounder'; } };
  const saisonLabel = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : 'Saison ' + s; } catch (e) { return 'Saison ' + s; } };

  // ── Farben ────────────────────────────────────────────────────────────────
  function hex(c) { c = String(c || '#000').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) || 0); }
  function mische(a, b, t) { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function vereinsFarben(dataClubId, name) {
    if (KD) {
      try {
        const f = name ? (W.DFL_LIGA.franchises || []).find(x => x.name === name) : (hatSpiel() ? DFLSpiel.franchise('fcm') : null);
        if (f && f.farben && f.farben[0]) return [f.farben[0], f.farben[1] || '#ffffff'];
      } catch (e) { /* Standard */ }
      return ['#2c7cb5', '#ffffff'];
    }
    try {
      const d = W.KSVerein && (dataClubId ? KSVerein.daten(dataClubId) : (hatSpiel() ? KSVerein.eigen() : null));
      if (d && d.farben && d.farben[0]) return [d.farben[0], d.farben[1] || '#ffffff'];
    } catch (e) { /* Standard */ }
    return ['#2c7cb5', '#ffffff'];
  }

  // ── Gesicht und Outfit ────────────────────────────────────────────────────
  function zufallsGesicht(g) {
    const F = W.facesjs; if (!F) return null;
    const f = F.generate({ jersey: { id: 'jersey' }, accessories: { id: 'none' }, glasses: { id: 'none' } }, { gender: g === 'w' ? 'female' : 'male' });
    if (Math.random() < 0.18) f.glasses = { id: zuf(TEILE.glasses.slice(1)) };
    if (g !== 'w' && Math.random() < 0.35) f.facialHair = { id: zuf(TEILE.facialHair.slice(1)) };
    return f;
  }
  // facesjs-Basketballhemd (fester Pfad im 400 × 600-Raster), wie in dfl_identitaet.js – wird gegen das Outfit getauscht
  const TANK = /<path fill="([^"]+)" stroke="#000" stroke-width="6" d="M80 610s10-30 10-90l20-10s10 80 90 80 90-80 90-80l20 10c0 60 10 90 10 90z"\/>/;
  const RUMPF = 'M-5 610c0-45 10-70 60-82l85-30h120l85 30c50 12 60 37 60 82z';
  function outfitSvg(art, a, b) {
    const k = '#000', dunkel = mische(a, '#000000', 0.35);
    const rumpf = f => `<path fill="${f}" stroke="${k}" stroke-width="6" d="${RUMPF}"/>`;
    if (art === 'anzug') {
      const sakko = '#2d3340';
      return `<g class="outfit">${rumpf(sakko)}<path fill="#f4f4f2" stroke="${k}" stroke-width="4" d="M146 497l54 105 54-105z"/>
        <path fill="${a}" stroke="${k}" stroke-width="3" d="M190 512h20l-3 14h-14zM193 526h14l8 66-15 16-15-16z"/>
        <path fill="#20242e" stroke="${k}" stroke-width="4" d="M140 496l60 110-30-78 10-16zM260 496l-60 110 30-78-10-16z"/>
        <circle cx="300" cy="566" r="9" fill="${a}" stroke="${b}" stroke-width="3"/></g>`;
    }
    if (art === 'pulli') {
      return `<g class="outfit">${rumpf(a)}<path fill="none" stroke="${k}" stroke-width="22" d="M140 497c18 34 102 34 120 0"/>
        <path fill="none" stroke="${dunkel}" stroke-width="14" d="M140 497c18 34 102 34 120 0"/>
        <circle cx="282" cy="566" r="15" fill="${b}" stroke="${k}" stroke-width="4"/><path d="M276 566h12M282 560v12" stroke="${a}" stroke-width="4"/></g>`;
    }
    if (art === 'mantel') {
      const m = '#3b4150';
      return `<g class="outfit">${rumpf(m)}<path fill="#2c313d" stroke="${k}" stroke-width="4" d="M130 498l45 112h-20l-40-100zM270 498l-45 112h20l40-100z"/>
        <path fill="${a}" stroke="${k}" stroke-width="5" d="M136 490c14 44 114 44 128 0l12 16c-18 56-134 56-152 0z"/>
        <path fill="${b}" d="M150 512c30 18 70 18 100 0l4 9c-34 20-74 20-108 0z"/>
        <path fill="${a}" stroke="${k}" stroke-width="5" d="M214 530h30l4 82h-36z"/><path fill="${b}" d="M213 552h33v10h-33zM212 576h35v10h-35z"/></g>`;
    }
    if (art === 'polo') {
      return `<g class="outfit">${rumpf(a)}<path fill="${a}" stroke="${k}" stroke-width="4" d="M188 505h24v55h-24z"/>
        <circle cx="200" cy="522" r="4" fill="${b}" stroke="${k}" stroke-width="2"/><circle cx="200" cy="544" r="4" fill="${b}" stroke="${k}" stroke-width="2"/>
        <path fill="${b}" stroke="${k}" stroke-width="5" stroke-linejoin="round" d="M138 494l62 14-30 34zM262 494l-62 14 30 34z"/></g>`;
    }
    // Trainingsjacke: Stehkragen, Reißverschluss, Schulterstreifen
    return `<g class="outfit">${rumpf(a)}<path d="M132 502L28 548M268 502l104 46" stroke="${b}" stroke-width="12" stroke-linecap="round"/>
      <path fill="${dunkel}" stroke="${k}" stroke-width="5" d="M138 494c12 34 112 34 124 0l10 12c-16 46-128 46-144 0z"/>
      <path d="M200 528v84" stroke="${k}" stroke-width="5"/><path fill="${b}" stroke="${k}" stroke-width="3" d="M194 532h12v18h-12z"/></g>`;
  }
  function alterVon(T) { return T && T.geburtsjahr ? clamp(jahrJetzt() - T.geburtsjahr, 18, 90) : 40; }
  function gealtert(face, alter) {
    const f = JSON.parse(JSON.stringify(face));
    if (alter >= 46 && (!f.eyeLine || f.eyeLine.id === 'none')) f.eyeLine = { id: alter >= 58 ? 'line3' : 'line1' };
    if (alter >= 52 && (!f.smileLine || f.smileLine.id === 'none')) f.smileLine = { id: 'line1', size: 1 };
    if (alter > 50 && f.hair && f.hair.color) f.hair.color = mische(f.hair.color, '#cfcbc6', clamp((alter - 50) / 18, 0, 0.88));
    return f;
  }
  const SVG_CACHE = new Map();
  function gesichtSvg(T, opt) {
    opt = opt || {};
    const F = W.facesjs; if (!F || !T || !T.gesicht) return '';
    const [a, b] = opt.farben || vereinsFarben(opt.dataClubId, opt.vereinsName);
    const alter = opt.alter != null ? opt.alter : alterVon(T);
    const key = JSON.stringify([T.gesicht, T.outfit, a, b, opt.altern === false ? 0 : alter]);
    if (SVG_CACHE.has(key)) return SVG_CACHE.get(key);
    let svg = '';
    try {
      const face = opt.altern === false ? JSON.parse(JSON.stringify(T.gesicht)) : gealtert(T.gesicht, alter);
      face.jersey = { id: 'jersey' };
      face.teamColors = [a, b, mische(a, '#000000', 0.45)];
      svg = F.faceToSvgString(face).replace(TANK, outfitSvg(T.outfit, a, b)).replace('<svg ', '<svg role="img" aria-label="Trainergesicht" ');
    } catch (e) { console.warn('[Kickstil-Trainer] Gesicht', e); }
    if (SVG_CACHE.size > 60) SVG_CACHE.clear();
    SVG_CACHE.set(key, svg);
    return svg;
  }

  // ── Zustand ───────────────────────────────────────────────────────────────
  const daten = () => (hatSpiel() && CLUB.ksTrainer) || null;
  function eigen(id) { const T = daten(); return !!(T && (T.eigenschaften || []).indexOf(id) >= 0); }
  function wert(k) { const T = daten(); return T && T.werte && typeof T.werte[k] === 'number' ? T.werte[k] : 8; }
  const lizenz = T => LIZENZEN[clamp((T && T.lizenz) || 0, 0, LIZENZEN.length - 1)];
  const summe = T => WERTE.reduce((s, [k]) => s + (T.werte[k] || 0), 0);
  const bedarf = v => 6 + 1.5 * v;
  const wort = t => {
    const w = (daten() || {}).geschlecht === 'w';
    if (!w) return t;
    return String(t).replace(/\bTrainers\b/g, 'Trainerin').replace(/\bseinen Trainer\b/g, 'seine Trainerin').replace(/\bseinem Trainer\b/g, 'seiner Trainerin')
      .replace(/\bseines Trainers\b/g, 'seiner Trainerin').replace(/\bDein Trainer\b/g, 'Deine Trainerin').replace(/\bdein Trainer\b/g, 'deine Trainerin')
      .replace(/\bder Trainer\b/g, 'die Trainerin').replace(/\bDer Trainer\b/g, 'Die Trainerin').replace(/\bden Trainer\b/g, 'die Trainerin').replace(/\bTrainer\b/g, 'Trainerin');
  };
  function neuerTrainer(entwurf) {
    const wg = WERDEGANG[entwurf.werdegang] ? entwurf.werdegang : 'allrounder';
    return {
      v: 1, name: entwurf.name, geschlecht: entwurf.geschlecht === 'w' ? 'w' : 'm', geburtsjahr: entwurf.geburtsjahr, gesicht: entwurf.gesicht, outfit: entwurf.outfit || 'jacke',
      werdegang: wg, werte: Object.assign({}, WERDEGANG[wg].w), xp: {}, lizenz: 0, eigenschaften: [], zuwachs: {}, saisons: 0,
      bilanz: { sp: 0, s: 0, u: 0, n: 0 }, titel: [], start: hatSpiel() ? LEAGUE.season : 1, offen: null
    };
  }
  function vorlageMerken(T) { schreib(KEY, { name: T.name, geschlecht: T.geschlecht, geburtsjahr: T.geburtsjahr, gesicht: T.gesicht, outfit: T.outfit, werdegang: T.werdegang }); }

  // Erfahrung buchen, Wert steigt bei genug Erfahrung (bis zum Lizenz-Deckel)
  function erfahrung(k, n) {
    const T = daten(); if (!T || !n) return;
    T.xp[k] = Math.max(0, (T.xp[k] || 0) + n);
    const max = lizenz(T).max;
    let stieg = false;
    while (T.werte[k] < max && T.xp[k] >= bedarf(T.werte[k])) {
      T.xp[k] -= bedarf(T.werte[k]); T.werte[k]++; stieg = true;
      const s = LEAGUE.season; T.zuwachs[s] = T.zuwachs[s] || {}; T.zuwachs[s][k] = (T.zuwachs[s][k] || 0) + 1;
    }
    if (T.werte[k] >= max) T.xp[k] = Math.min(T.xp[k], bedarf(T.werte[k]));      // Deckel: Erfahrung staut sich nur bis zum nächsten Schritt
    if (stieg) {
      const name = WERTE.find(x => x[0] === k)[1];
      toast(`${em('📈 ')}${name} steigt auf ${T.werte[k]}`, 'success');
      news(`${em('📈 ')}${KD ? 'Chefcoach' : wort('Trainer')}: ${name} ${T.werte[k]}`, `Deine Arbeit zahlt sich aus – ${name} steigt auf ${T.werte[k]}. ${wirkungText(k, T.werte[k])}.`);
    }
  }
  function ansehenAendern(d, grund, s) {
    const T = daten(); if (!T || !d) return 0;
    const alt = T.werte.ansehen, neu = clamp(alt + d, 1, lizenz(T).max);
    T.werte.ansehen = neu; T.zuwachs[s] = T.zuwachs[s] || {}; T.zuwachs[s].ansehen = (T.zuwachs[s].ansehen || 0) + (neu - alt);
    (T.ansehenLog = T.ansehenLog || []).push({ s, d: neu - alt, grund }); if (T.ansehenLog.length > 30) T.ansehenLog.splice(0, T.ansehenLog.length - 30);
    return neu - alt;
  }

  // ── Wirkung ───────────────────────────────────────────────────────────────
  const taktikBonus = v => Math.round((v - 8) * 0.15);
  const fuehrungChance = v => (v - 8) * 0.05;
  const talentFaktor = v => 1 + Math.max(0, (v - 8) * 0.018) * (eigen('talentauge') ? 1.5 : 1);
  const talentBis = () => (KD ? 23 : 21) + (eigen('talentauge') ? 2 : 0);
  const fitnessFaktor = v => (1 - (v - 8) * 0.02) * (eigen('guru') ? 0.85 : 1);
  const verhandelnDelta = v => (v - 8) * 0.004 * (eigen('feilscher') ? 2 : 1);
  const gehaltFaktor = v => 1 - (v - 8) * 0.006 * (eigen('feilscher') ? 2 : 1);
  const ansehenFaktor = v => (v - 8) * 0.025 + (eigen('medien') ? 0.2 : 0);
  const pct = x => Math.round(x * 100);
  function wirkungText(k, v) {
    if (k === 'taktik') { const b = taktikBonus(v); return b > 0 ? `Teamstärke +${b}` : b < 0 ? `Teamstärke ${b}` : 'Teamstärke ±0 (ab 12: +1)'; }
    if (k === 'fuehrung') { const c = fuehrungChance(v); return c > 0 ? `Moral erholt sich schneller (${pct(c)} % je Woche)` : c < 0 ? `Gute Laune hält kürzer (${pct(-c)} % je Woche)` : 'Moral normal'; }
    if (k === 'talente') { const f = talentFaktor(v); return f > 1 ? `Spieler bis ${talentBis()}: +${pct(f - 1)} % Entwicklung` : 'Talente normal (ab 9: schneller)'; }
    if (k === 'fitness') { const f = fitnessFaktor(v); return f < 1 ? `Verletzungen −${pct(1 - f)} %` : f > 1 ? `Verletzungen +${pct(f - 1)} %` : 'Verletzungen normal'; }
    if (k === 'verhandeln') {
      if (KD) { const f = gehaltFaktor(v); return f < 1 ? `Gehaltsforderungen −${pct(1 - f)} %` : f > 1 ? `Gehaltsforderungen +${pct(f - 1)} %` : 'Gehaltsforderungen normal'; }
      const d = verhandelnDelta(v); return d > 0 ? `Ablösen etwa −${Math.round(d / 0.9 * 100)} %` : d < 0 ? `Ablösen etwa +${Math.round(-d / 0.9 * 100)} %` : 'Ablösen normal'; }
    if (k === 'ansehen') { const f = ansehenFaktor(v), wer = KD ? 'Eigentümer' : 'Vorstand'; return f > 0 ? `${wer} verzeiht ${pct(f)} % mehr` : f < 0 ? `${wer} ${pct(-f)} % strenger` : `${wer} normal`; }
    return '';
  }
  // Teamstärke: Taktik + Eigenschaften je Spiel (gedeckelt −2 … +3)
  function bonus() {
    const T = daten(); if (!T) return 0;
    let d = taktikBonus(T.werte.taktik);
    let fx = null, heim = true;
    try { fx = CURRENT_FIXTURE; heim = typeof FCM_IS_HOME === 'undefined' ? true : !!FCM_IS_HOME; } catch (e) { fx = null; }
    if (fx && fx.type !== 'friendly') {
      if (eigen('festung') && heim) d += 1;
      if (eigen('reise') && !heim) d += 1;
      if (eigen('pokal') && (fx.type === 'cup' || fx.type === 'euro')) d += 1;
      if (eigen('playoffs') && fx.type === 'playoff') d += 2;
      try { if (eigen('derby') && W.KSDerby && KSDerby.istDerby(fx)) d += 2; } catch (e) { /* ohne Derby */ }
    }
    return clamp(d, -2, 3);
  }
  if (typeof W.computeTeamRatings === 'function') {
    const _c = W.computeTeamRatings;
    W.computeTeamRatings = function () {
      const r = _c.apply(this, arguments);
      try {
        const d = bonus();
        if (d && r) ['overall', 'attack', 'defense', 'mental'].forEach(k => { if (typeof r[k] === 'number') r[k] = Math.round(clamp(r[k] + d, 30, 95)); });
      } catch (e) { /* ohne Wirkung */ }
      return r;
    };
    try { computeTeamRatings = W.computeTeamRatings; } catch (e) { /* window reicht */ }
  }
  // Nur der eigene Kader: Kickdrafts Weltsimulation fragt dieselben Haken für alle 32 Vereine ab
  function istEigen(p) {
    if (!p || typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return false;
    if (SQUAD.indexOf(p) >= 0) return true;
    if (KD) { try { return p.teamId != null && p.teamId === DFLSpiel.eigeneDflId(); } catch (e) { return false; } }
    return SQUAD.some(q => q && q.id === p.id);
  }
  // Fitness: Verletzungsrisiko (engine_main.js/bundle_squad.js rufen window.traitVerletzungsFaktor je Wurf)
  const _vf = W.traitVerletzungsFaktor;
  W.traitVerletzungsFaktor = function (p) {
    let f = typeof _vf === 'function' ? _vf.apply(this, arguments) : 1;
    try { if (daten() && istEigen(p)) f *= fitnessFaktor(wert('fitness')); } catch (e) { /* ohne */ }
    return f;
  };
  // Talentförderung: Tempo der Trainingsentwicklung junger Spieler (bundle_match.js fragt traitDevFaktor je Spieler und Woche;
  // Potenzial, Spielzeit, Intensität und Anlage gelten wie immer)
  const _df = W.traitDevFaktor;
  W.traitDevFaktor = function (p) {
    let f = typeof _df === 'function' ? _df.apply(this, arguments) : 1;
    try { if (daten() && p && (p.age || 25) <= talentBis() && istEigen(p)) f *= talentFaktor(wert('talente')); } catch (e) { /* ohne */ }
    return f;
  };
  // Verhandeln: Mitte der Annahmekurve (buy_negotiation_patch.js liest window.Kaufverhandlung bei jedem Angebot)
  const MITTE = W.Kaufverhandlung ? W.Kaufverhandlung.mitte : null;
  function mitteSetzen() { if (W.Kaufverhandlung && MITTE != null) W.Kaufverhandlung.mitte = daten() ? clamp(MITTE - verhandelnDelta(wert('verhandeln')), 0.7, 1.0) : MITTE; }
  ['openClubNegotiation', 'clubNegoMakeOffer', 'clubNegoAcceptCounter'].forEach(fn => {
    if (typeof W[fn] !== 'function') return;
    const _o = W[fn];
    W[fn] = function () { try { mitteSetzen(); } catch (e) { /* ohne */ } return _o.apply(this, arguments); };
  });
  // Kickdraft: Verhandeln wirkt auf die Gehaltsforderungen an den eigenen Verein; Trades und Free Agents bringen Erfahrung
  if (KD) {
    const eigeneId = () => { try { return DFLSpiel.eigeneDflId(); } catch (e) { return null; } };
    const Gen = W.DFLGenerator;
    if (Gen && typeof Gen.forderung === 'function') {
      const _f = Gen.forderung;
      Gen.forderung = function (p, team) {
        const f = _f.apply(this, arguments);
        try {
          if (f && team && daten() && team.id === eigeneId() && typeof f.jahresWert === 'number') {
            const min = (Gen.CFG && Gen.CFG.mindestgehalt) || 0;
            f.jahresWert = Math.max(min, Math.round(f.jahresWert * gehaltFaktor(wert('verhandeln')) / 10000) * 10000);
          }
        } catch (e) { /* ohne */ }
        return f;
      };
    }
    const H = W.DFLHandel;
    if (H && typeof H.ausfuehren === 'function') {
      const _a = H.ausfuehren;
      H.ausfuehren = function (L, deal) {
        const e = _a.apply(this, arguments);
        try { const id = eigeneId(); if (e && e.akzeptiert && deal && (deal.von === id || deal.an === id || deal.von === 'fcm' || deal.an === 'fcm')) erfahrung('verhandeln', 4); } catch (x) { /* ohne */ }
        return e;
      };
    }
    if (typeof W.signFreeAgent === 'function') {
      const _s = W.signFreeAgent;
      W.signFreeAgent = function () {
        const n = typeof SQUAD !== 'undefined' ? SQUAD.length : 0;
        const r = _s.apply(this, arguments);
        try { if (typeof SQUAD !== 'undefined' && SQUAD.length > n) erfahrung('verhandeln', 3); } catch (e) { /* ohne */ }
        return r;
      };
      try { signFreeAgent = W.signFreeAgent; } catch (e) { /* window reicht */ }
    }
  }
  // Ansehen: Verluste an Vorstands-Zufriedenheit abfedern (EXP.hook… sind Eigenschaften, also überschreibbar)
  function vorstand() { try { return CLUB.expectations ? CLUB.expectations.boardSatisfaction : null; } catch (e) { return null; } }
  function abfedern(vorher) {
    const T = daten(), e = CLUB.expectations; if (!T || !e || vorher == null) return;
    const verlust = vorher - e.boardSatisfaction; if (!(verlust > 0)) return;
    T._rest = (T._rest || 0) + verlust * ansehenFaktor(wert('ansehen'));
    const ganz = T._rest > 0 ? Math.floor(T._rest) : Math.ceil(T._rest);
    if (ganz) { e.boardSatisfaction = clamp(e.boardSatisfaction + ganz, 0, 100); T._rest -= ganz; }
  }
  function expHaken() {
    if (typeof EXP === 'undefined' || !EXP || EXP._ksTrainer) return;
    EXP._ksTrainer = true;
    ['hookMatchResult', 'hookSeasonStart'].forEach(fn => {
      if (typeof EXP[fn] !== 'function') return;
      const _o = EXP[fn];
      EXP[fn] = function () { const v = vorstand(); const r = _o.apply(this, arguments); try { abfedern(v); } catch (e) { /* ohne */ } return r; };
    });
    if (typeof EXP.hookTransfer === 'function') {
      const _t = EXP.hookTransfer;
      EXP.hookTransfer = function (player, kind) {
        const v = vorstand(); const r = _t.apply(this, arguments);
        try { abfedern(v); if (player && !player.akademie) erfahrung('verhandeln', kind === 'buy' ? 4 : kind === 'sell' ? 3 : 0); } catch (e) { /* ohne */ }
        return r;
      };
    }
  }
  expHaken();

  // ── Lernen durch Tun ──────────────────────────────────────────────────────
  let VERLETZTE = null;
  function woche() {
    const T = daten(); if (!T || typeof SQUAD === 'undefined') return;
    // Menschenführung (Wirkung)
    const fc = fuehrungChance(T.werte.fuehrung);
    SQUAD.forEach(p => {
      if (!p || typeof p.morale !== 'number') return;
      if (fc > 0 && p.morale < 70 && Math.random() < fc) p.morale = Math.min(100, p.morale + 1);
      if (fc < 0 && p.morale > 70 && Math.random() < -fc) p.morale = Math.max(0, p.morale - 1);
    });
    // Erfahrung: Teammoral und Verletzungen
    try { if (typeof W.teamMorale === 'function' && W.teamMorale() >= 75) erfahrung('fuehrung', 1); } catch (e) { /* ohne Moral */ }
    const jetzt = new Set(SQUAD.filter(p => p && (p.injuryWeeks || 0) > 0).map(p => p.id));
    if (VERLETZTE) { let neu = 0; jetzt.forEach(id => { if (!VERLETZTE.has(id)) neu++; }); if (!neu) erfahrung('fitness', 0.5); }
    VERLETZTE = jetzt;
  }
  function spiel(fx, f, g, staerke, jung) {
    const T = daten(); if (!T || !fx || fx.type === 'friendly') return;
    const sieg = f > g, remis = f === g, stark = staerke && staerke.gegner - staerke.wir >= 3;
    T.bilanz.sp++; if (sieg) T.bilanz.s++; else if (remis) T.bilanz.u++; else T.bilanz.n++;
    erfahrung('taktik', sieg ? (stark ? 4 : 1.5) : remis ? (stark ? 2 : 0.5) : 0);
    if (sieg && T._letzteNiederlage) erfahrung('fuehrung', 2);
    try { if (sieg && W.KSDerby && KSDerby.istDerby(fx)) erfahrung('fuehrung', 2); } catch (e) { /* ohne Derby */ }
    T._letzteNiederlage = !sieg && !remis;
    if (jung) erfahrung('talente', Math.min(1, jung * 0.3));
  }

  // ── Sommerpause: Ansehen, Lizenz, Eigenschaft ─────────────────────────────
  function saisonende(v) {
    const T = daten(); if (!T || !v || T._gewertet === v.saison) return;
    T._gewertet = v.saison; T.saisons++;
    const s = v.saison, an = (d, g) => ansehenAendern(d, g, s);          // Zuwachs der abgelaufenen Saison zuordnen
    if (v.platz === 1) { an(2, 'Meister'); T.titel.push({ saison: v.label, text: 'Meister der ' + (v.liga || 'Liga') }); }
    if (v.auf) { an(2, 'Aufstieg'); if (v.platz !== 1) T.titel.push({ saison: v.label, text: 'Aufstieg' }); }
    if (v.pokalsieger) { an(2, 'Pokalsieg'); T.titel.push({ saison: v.label, text: 'Flutlichtpokal' }); }
    if (v.ab) an(-2, 'Abstieg');
    if (!v.ab && !v.auf && v.platz && v.anzahl && v.platz <= v.anzahl / 2 && v.platz !== 1) an(1, 'Obere Tabellenhälfte');
    if (T._euro) an(1, 'Europapokal');
    const b = vorstand();
    if (b != null && b >= 75) an(1, 'Vorstand zufrieden'); else if (b != null && b < 40) an(-1, 'Vorstand unzufrieden');
    lehrgang(T, v);
  }
  function lehrgang(T, v) {
    // Noch offene Wahl vom letzten Lehrgang (Blatt nie gesehen): nicht verfallen lassen, die erste Eigenschaft nehmen
    if (T.offen && T.offen.lizenz && T.offen.wahl && T.offen.wahl.length && EIGENSCHAFTEN[T.offen.wahl[0]] && T.eigenschaften.indexOf(T.offen.wahl[0]) < 0) {
      T.eigenschaften.push(T.offen.wahl[0]);
      news(`${em('⭐ ')}Neue Eigenschaft: ${EIGENSCHAFTEN[T.offen.wahl[0]].name}`, EIGENSCHAFTEN[T.offen.wahl[0]].text + '.');
    }
    let neueLizenz = null;
    const nxt = LIZENZEN[(T.lizenz || 0) + 1];
    if (nxt && T.saisons >= nxt.saisons && summe(T) >= nxt.summe && (!nxt.ansehen || T.werte.ansehen >= nxt.ansehen)) {
      T.lizenz++; neueLizenz = nxt.id;
      const pool = Object.keys(EIGENSCHAFTEN).filter(id => T.eigenschaften.indexOf(id) < 0 && (!EIGENSCHAFTEN[id].nur || EIGENSCHAFTEN[id].nur === (KD ? 'kd' : 'fl'))).sort(() => Math.random() - 0.5).slice(0, 3);
      T.offen = { saison: v.saison, label: v.label, lizenz: neueLizenz, wahl: pool };
      news(`${em('🎓 ')}Lehrgang bestanden: ${nxt.name}`, `In der Sommerpause hast du die ${nxt.name} gemacht. Deine Werte können jetzt bis ${nxt.max} steigen.`);
    } else T.offen = { saison: v.saison, label: v.label };
    T._euro = false;
  }

  // ── Oberfläche: Editor ────────────────────────────────────────────────────
  let ED = null;
  function editorCss() {
    if (document.getElementById('kstr-css')) return;
    const css = document.createElement('style'); css.id = 'kstr-css';
    css.textContent = `#kstr-ed{position:fixed;inset:0;z-index:10050;background:var(--bg1,#f4e3c1);color:var(--text,#2b2a26);overflow-y:auto;font-family:var(--font-text,system-ui)}
    html.dark #kstr-ed{background:var(--bg1,#141821)}
    .kstr-in{max-width:560px;margin:0 auto;padding:14px 16px calc(28px + env(safe-area-inset-bottom,0px))}
    .kstr-kopf{text-align:center;margin:4px 0 10px}.kstr-kopf b{display:block;font:700 24px/1.15 var(--font-titel,Fredoka,system-ui)}
    .kstr-kopf small{color:var(--text3,#846d52);font-size:13px}
    .kstr-schritte{display:flex;gap:6px;justify-content:center;margin:0 0 10px}.kstr-schritte span{width:30px;height:5px;border-radius:3px;background:var(--bg4,#c9b48f);opacity:.5}
    .kstr-schritte span.an{background:var(--k-gruen,#25c065);opacity:1}
    .kstr-vorschau{display:flex;gap:14px;align-items:center;justify-content:center;margin-bottom:10px}
    .kstr-av{width:132px;height:198px;flex-shrink:0;border-radius:18px;background:radial-gradient(circle at 50% 38%,var(--bg2,#fffaf0),var(--bg3,#efe2c8));border:3px solid var(--k-rahmen,#8b5a2b);overflow:hidden}
    .kstr-av svg{width:100%;height:100%;display:block}
    .kstr-seite{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1;max-width:260px}
    .kstr-g{display:flex;border:2px solid var(--k-rand,#d9c29a);border-radius:12px;overflow:hidden}
    .kstr-g button{flex:1;border:0;background:transparent;color:inherit;padding:9px 6px;font:700 13px/1 var(--font-titel,system-ui);cursor:pointer}
    .kstr-g button.an{background:var(--k-blau,#2c7cb5);color:#fff}
    .kstr-feld{display:flex;flex-direction:column;gap:3px}.kstr-feld label{font-size:11px;font-weight:700;color:var(--text3,#846d52);text-transform:uppercase;letter-spacing:.4px}
    .kstr-feld input{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:10px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0);color:inherit;font-size:14px}
    .kstr-alter{display:flex;align-items:center;gap:6px}.kstr-alter b{min-width:54px;text-align:center;font-size:15px}
    .kstr-mini{border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0);color:inherit;border-radius:10px;width:38px;height:36px;font-size:17px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
    .kstr-reihen{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
    .kstr-reihe{display:flex;align-items:center;gap:4px;padding:5px 6px;border-radius:12px;background:var(--bg2,#fffaf0);border:2px solid var(--k-rand,#d9c29a)}
    html.dark .kstr-reihe,html.dark .kstr-feld input,html.dark .kstr-mini{background:var(--bg2,#1e2230)}
    .kstr-reihe span{flex:1;min-width:0;text-align:center;font-size:12px;line-height:1.15}.kstr-reihe span small{display:block;color:var(--text3,#846d52);font-size:10px}
    .kstr-reihe .kstr-mini{width:30px;height:30px;font-size:15px;border-width:0;background:var(--bg3,#efe2c8)}
    .kstr-fuss{display:flex;gap:8px;margin-top:12px}
    .kstr-knopf{flex:1;border:0;border-radius:14px;padding:13px 12px;font:700 15px/1.1 var(--font-titel,system-ui);cursor:pointer;color:#fff;background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}
    .kstr-knopf.leise{flex:0 0 auto;background:var(--bg3,#efe2c8);color:inherit;box-shadow:0 4px 0 var(--bg4,#c9b48f)}
    .kstr-wg{display:flex;flex-direction:column;gap:8px}
    .kstr-wgk{display:flex;gap:12px;align-items:flex-start;text-align:left;padding:11px 12px;border-radius:14px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0);color:inherit;cursor:pointer;font:inherit}
    html.dark .kstr-wgk{background:var(--bg2,#1e2230)}
    .kstr-wgk.an{border-color:var(--k-gruen,#25c065);box-shadow:0 0 0 2px var(--k-gruen,#25c065) inset}
    .kstr-wgk>i{font-size:26px;color:var(--k-blau,#2c7cb5);margin-top:2px}.kstr-wgk b{font:700 15px/1.2 var(--font-titel,system-ui)}
    .kstr-wgk small{display:block;color:var(--text3,#846d52);font-size:12px;line-height:1.3;margin:2px 0 6px}
    .kstr-balken{display:grid;grid-template-columns:auto 1fr auto auto 1fr auto;gap:3px 6px;align-items:center;font-size:11px}
    .kstr-balken em{font-style:normal;color:var(--text3,#846d52)}.kstr-balken b{font:700 11px/1 var(--font-text,system-ui)}
    .kstr-bar{height:7px;border-radius:4px;background:var(--bg3,#efe2c8);overflow:hidden;position:relative}.kstr-bar i{position:absolute;left:0;top:0;bottom:0;background:var(--k-blau,#2c7cb5);border-radius:4px}
    .kstr-bar i.hoch{background:var(--k-gruen,#25c065)}.kstr-bar i.tief{background:#d9822b}
    .kstr-bar u{position:absolute;top:0;bottom:0;background:rgba(37,192,101,.35);text-decoration:none}
    /* Profil */
    .kstr-p{margin:12px 0;padding:12px;border-radius:16px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0)}
    html.dark .kstr-p{background:var(--bg2,#1e2230)}
    .kstr-pkopf{display:flex;gap:12px;align-items:center}
    .kstr-pkopf .kstr-av{width:84px;height:126px;border-width:2px;border-radius:14px}
    .kstr-pkopf>div:not(.kstr-av){flex:1;min-width:0}.kstr-pkopf b{display:block;font:700 19px/1.15 var(--font-titel,Fredoka,system-ui)}
    .kstr-pkopf small{display:block;color:var(--text3,#846d52);font-size:12px;line-height:1.35}
    .kstr-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
    .kstr-chip{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:3px 7px;border-radius:999px;background:var(--bg3,#efe2c8)}
    .kstr-chip.liz{background:#e3a524;color:#2b1d05}
    .kstr-wl{display:flex;flex-direction:column;gap:7px;margin-top:10px}
    .kstr-w{display:grid;grid-template-columns:22px 1fr auto;gap:2px 8px;align-items:center}
    .kstr-w>i{font-size:18px;color:var(--k-blau,#2c7cb5);grid-row:span 2}.kstr-w>span{font-size:13px;font-weight:700}.kstr-w>b{font:700 15px/1 var(--font-titel,system-ui)}
    .kstr-w .kstr-bar{grid-column:2/4}.kstr-w small{grid-column:2/4;color:var(--text3,#846d52);font-size:11px;line-height:1.25}
    .kstr-pfuss{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .kstr-pk{border:2px solid var(--k-rand,#d9c29a);background:transparent;color:inherit;border-radius:10px;padding:8px 10px;font:700 12px/1.1 var(--font-titel,system-ui);cursor:pointer}
    .kstr-lauf{font-size:12px;color:var(--text3,#846d52);margin-top:8px;line-height:1.4}
    /* Sommerpause */
    #kstr-sp{position:fixed;inset:0;z-index:9800;pointer-events:none}#kstr-sp.auf{pointer-events:auto}
    #kstr-sp .kstb-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#kstr-sp.auf .kstb-bg{opacity:1}
    #kstr-sp .kstr-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;max-height:88vh;overflow-y:auto;background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);
      border-radius:22px 22px 0 0;border:3px solid var(--k-rahmen,#8b5a2b);border-bottom:0;padding:12px 14px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);
      transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}
    #kstr-sp.auf .kstr-box{transform:none}html.dark #kstr-sp .kstr-box{background:var(--bg2,#1e2230)}
    .kstr-plus{color:var(--k-gruen,#1f9d55);font-weight:800}.kstr-minus{color:#c0392b;font-weight:800}
    .kstr-liz{margin:12px 0 8px;padding:12px;border-radius:14px;background:linear-gradient(135deg,#f6d36b,#e3a524);color:#2b1d05;text-align:center}
    .kstr-liz b{display:block;font:700 19px/1.2 var(--font-titel,system-ui)}.kstr-liz small{font-size:12px}
    .kstr-eig{display:flex;flex-direction:column;gap:7px}
    @media (max-width:380px){.kstr-reihen{grid-template-columns:1fr}.kstr-av{width:112px;height:168px}}`;
    document.head.appendChild(css);
  }
  function entwurfAus(vorlage, g) {
    const v = vorlage || {};
    const geschlecht = v.geschlecht || g || 'm';
    return {
      geschlecht, name: v.name || zuf(VORNAMEN[geschlecht]) + ' ' + zuf(NACHNAMEN),
      geburtsjahr: v.geburtsjahr || (jahrJetzt() - 38), gesicht: v.gesicht || zufallsGesicht(geschlecht), outfit: v.outfit || 'jacke', werdegang: v.werdegang || 'motivator'
    };
  }
  function teilWert(E, k) {
    if (k === 'haut') return E.gesicht.body && E.gesicht.body.color;
    if (k === 'haarfarbe') return E.gesicht.hair && E.gesicht.hair.color;
    if (k === 'outfit') return E.outfit;
    return E.gesicht[k] && E.gesicht[k].id;
  }
  function teilSetzen(E, k, val) {
    if (k === 'haut') E.gesicht.body = Object.assign({}, E.gesicht.body, { color: val });
    else if (k === 'haarfarbe') E.gesicht.hair = Object.assign({}, E.gesicht.hair, { color: val });
    else if (k === 'outfit') E.outfit = val;
    else E.gesicht[k] = Object.assign({}, E.gesicht[k], { id: val });
    if (k === 'hair') E.gesicht.hairBg = { id: val === 'longHair' ? 'longHair' : /^shaggy/.test(val) ? 'shaggy' : /^female[1-5]$/.test(val) ? val : 'none' };
  }
  const teilListe = k => k === 'outfit' ? OUTFITS.map(o => o[0]) : TEILE[k];
  function teilName(k, val) {
    if (k === 'outfit') return (OUTFITS.find(o => o[0] === val) || [0, val])[1];
    const L = teilListe(k), i = L.indexOf(val);
    if (val === 'none') return 'ohne';
    return i >= 0 ? (i + 1) + ' von ' + L.length : '–';
  }
  function balkenHtml(w, alt) {
    return `<div class="kstr-balken">${WERTE.map(([k, n]) => { const v = w[k], cls = v >= 12 ? 'hoch' : v <= 6 ? 'tief' : '';
      return `<em>${n}</em><div class="kstr-bar"><i class="${cls}" style="width:${v / 20 * 100}%"></i></div><b>${v}</b>`; }).join('')}</div>`;
  }
  // opt: { dataClubId, modus: 'neu' | 'nachruesten' | 'aussehen', fertig(entwurf) , spaeter() }
  function editor(opt) {
    opt = opt || {};
    editorCss();
    const T = daten();
    const E = entwurfAus(opt.modus === 'aussehen' && T ? T : lies(KEY, null));
    if (!E.gesicht) { if (opt.fertig) opt.fertig(E); return; }
    let schritt = 0;
    const farben = vereinsFarben(opt.dataClubId, opt.vereinsName);
    if (ED) ED.remove();
    ED = document.createElement('div'); ED.id = 'kstr-ed'; ED.setAttribute('role', 'dialog'); ED.setAttribute('aria-modal', 'true');
    document.body.appendChild(ED);
    const titel = () => opt.modus === 'aussehen' ? 'Aussehen ändern' : E.geschlecht === 'w' ? 'Wer ist die neue Trainerin?' : 'Wer ist der neue Trainer?';
    function zeichne() {
      const svg = gesichtSvg({ gesicht: E.gesicht, outfit: E.outfit, geburtsjahr: E.geburtsjahr }, { farben });
      const alter = jahrJetzt() - E.geburtsjahr;
      const schritte = opt.modus === 'aussehen' ? '' : `<div class="kstr-schritte"><span class="an"></span><span class="${schritt ? 'an' : ''}"></span></div>`;
      if (schritt === 0) {
        ED.innerHTML = `<div class="kstr-in">${schritte}<div class="kstr-kopf"><b>${esc(titel())}</b><small>${opt.modus === 'nachruesten' ? 'Neu: Erstelle dich selbst – mit eigenen Werten, die mit dir wachsen.' : 'Erstelle dich selbst. Das Outfit trägt die Vereinsfarben.'}</small></div>
          <div class="kstr-vorschau"><div class="kstr-av">${svg}</div><div class="kstr-seite">
            <div class="kstr-g" role="group" aria-label="Trainer oder Trainerin"><button type="button" data-g="m" class="${E.geschlecht === 'm' ? 'an' : ''}">Trainer</button><button type="button" data-g="w" class="${E.geschlecht === 'w' ? 'an' : ''}">Trainerin</button></div>
            <div class="kstr-feld"><label for="kstr-name">Name</label><input id="kstr-name" maxlength="28" value="${esc(E.name)}" autocomplete="off"></div>
            <div class="kstr-feld"><label>Alter</label><div class="kstr-alter"><button type="button" class="kstr-mini" data-alter="-1" aria-label="jünger">${ic('minus')}</button><b>${alter} Jahre</b><button type="button" class="kstr-mini" data-alter="1" aria-label="älter">${ic('plus')}</button></div></div>
            <button type="button" class="kstr-pk" data-zufall="1">${ic('dice-5')} Zufall</button></div></div>
          <div class="kstr-reihen">${REIHEN.map(([k, n]) => `<div class="kstr-reihe"><button type="button" class="kstr-mini" data-teil="${k}" data-d="-1" aria-label="${n} zurück">${ic('chevron-left')}</button>
            <span>${n}<small>${esc(teilName(k, teilWert(E, k)))}</small></span><button type="button" class="kstr-mini" data-teil="${k}" data-d="1" aria-label="${n} weiter">${ic('chevron-right')}</button></div>`).join('')}</div>
          <div class="kstr-fuss">${opt.modus === 'nachruesten' ? '<button type="button" class="kstr-knopf leise" data-spaeter="1">Später</button>' : opt.modus === 'aussehen' ? '<button type="button" class="kstr-knopf leise" data-abbruch="1">Abbrechen</button>' : ''}
            <button type="button" class="kstr-knopf" data-weiter="1">${opt.modus === 'aussehen' ? 'Speichern' : 'Weiter: Werdegang'}</button></div></div>`;
      } else {
        const wahl = Object.keys(WERDEGANG).filter(k => !WERDEGANG[k].versteckt);
        ED.innerHTML = `<div class="kstr-in">${schritte}<div class="kstr-kopf"><b>Dein Werdegang</b><small>Er bestimmt deine Startwerte (1–20). Danach wächst du durch das, was du tust.</small></div>
          <div class="kstr-wg">${wahl.map(k => { const D = WERDEGANG[k]; return `<button type="button" class="kstr-wgk ${E.werdegang === k ? 'an' : ''}" data-wg="${k}">${ic(D.icon)}
            <span style="flex:1;min-width:0"><b>${esc(D.name)}</b><small>${esc(D.text)}</small>${balkenHtml(D.w)}</span></button>`; }).join('')}</div>
          <div class="kstr-fuss"><button type="button" class="kstr-knopf leise" data-zurueck="1">Zurück</button><button type="button" class="kstr-knopf" data-fertig="1">Los geht's</button></div></div>`;
      }
    }
    function blaettern(k, d) {
      const L = teilListe(k); let i = L.indexOf(teilWert(E, k)); if (i < 0) i = 0;
      teilSetzen(E, k, L[(i + d + L.length) % L.length]);
    }
    function schliessen() { if (ED) { ED.remove(); ED = null; } }
    ED.addEventListener('input', ev => { if (ev.target.id === 'kstr-name') E.name = ev.target.value; });
    ED.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      const nameEl = ED.querySelector('#kstr-name'); if (nameEl) E.name = nameEl.value;
      if (b.dataset.g) {
        if (E.geschlecht !== b.dataset.g) {
          const alt = E.geschlecht; E.geschlecht = b.dataset.g;
          // Standardname mittauschen, wenn noch der vorgeschlagene drinsteht
          if (VORNAMEN[alt].some(v => E.name.indexOf(v + ' ') === 0)) E.name = zuf(VORNAMEN[E.geschlecht]) + ' ' + E.name.split(' ').slice(1).join(' ');
          const f = zufallsGesicht(E.geschlecht); if (f) { f.body.color = E.gesicht.body.color; E.gesicht = f; }
        }
      } else if (b.dataset.alter) E.geburtsjahr = clamp(E.geburtsjahr - (+b.dataset.alter), jahrJetzt() - 70, jahrJetzt() - 26);
      else if (b.dataset.zufall) { const f = zufallsGesicht(E.geschlecht); if (f) E.gesicht = f; E.outfit = zuf(OUTFITS)[0]; }
      else if (b.dataset.teil) blaettern(b.dataset.teil, +b.dataset.d);
      else if (b.dataset.wg) E.werdegang = b.dataset.wg;
      else if (b.dataset.zurueck) schritt = 0;
      else if (b.dataset.abbruch) { schliessen(); return; }
      else if (b.dataset.spaeter) { schliessen(); E.werdegang = 'allrounder'; if (opt.spaeter) opt.spaeter(E); return; }
      else if (b.dataset.weiter) {
        E.name = (E.name || '').trim() || zuf(VORNAMEN[E.geschlecht]) + ' ' + zuf(NACHNAMEN);
        if (opt.modus === 'aussehen') { schliessen(); if (opt.fertig) opt.fertig(E); return; }
        schritt = 1;
      } else if (b.dataset.fertig) { schliessen(); if (opt.fertig) opt.fertig(E); return; }
      else return;
      zeichne();
    });
    zeichne();
  }

  // ── Oberfläche: Profil (Verein-Reiter und Mehr-Menü) ──────────────────────
  function profilHtml(T, kompakt) {
    const L = lizenz(T), alter = alterVon(T), Bz = T.bilanz;
    const eig = T.eigenschaften.map(id => EIGENSCHAFTEN[id]).filter(Boolean);
    return `<div class="kstr-pkopf"><div class="kstr-av">${gesichtSvg(T)}</div><div>
        <b>${esc(T.name)}</b><small>${KD ? 'Chefcoach' : T.geschlecht === 'w' ? 'Trainerin' : 'Trainer'} · ${alter} Jahre · ${esc(WERDEGANG[T.werdegang].name)}</small>
        <div class="kstr-chips"><span class="kstr-chip liz">${ic('school')} ${esc(L.name)} · Werte bis ${L.max}</span>
        ${eig.map(e => `<span class="kstr-chip" title="${esc(e.text)}">${ic(e.icon)} ${esc(e.name)}</span>`).join('')}</div>
        <small style="margin-top:4px">${Bz.sp} Pflichtspiele · ${Bz.s} S · ${Bz.u} U · ${Bz.n} N${T.titel.length ? ' · ' + T.titel.length + ' Titel' : ''}</small></div></div>
      <div class="kstr-wl">${WERTE.map(([k, n, icon]) => { const v = T.werte[k], need = bedarf(v), xp = T.xp[k] || 0, voll = v >= L.max;
        return `<div class="kstr-w">${ic(icon)}<span>${n}</span><b>${v}</b><div class="kstr-bar" title="${voll ? 'Lizenz-Deckel erreicht' : 'Erfahrung bis zum nächsten Punkt'}"><i class="${v >= 12 ? 'hoch' : v <= 6 ? 'tief' : ''}" style="width:${v / 20 * 100}%"></i>${!voll && k !== 'ansehen' ? `<u style="left:${v / 20 * 100}%;width:${clamp(xp / need, 0, 1) * 5}%"></u>` : ''}</div>
          <small>${esc(wirkungText(k, v))}${voll && v < 20 ? ' · Deckel – nächste Lizenz nötig' : ''}</small></div>`; }).join('')}</div>
      ${kompakt ? '' : naechsteLizenzHtml(T)}
      ${!kompakt && T.titel.length ? `<div class="kstr-lauf"><b>Titel:</b> ${T.titel.map(t => esc(t.text + ' (' + t.saison + ')')).join(' · ')}</div>` : ''}
      <div class="kstr-pfuss"><button type="button" class="kstr-pk" data-kstr="aussehen">${ic('palette')} Aussehen ändern</button>${kompakt ? '<button type="button" class="kstr-pk" data-kstr="profil">' + ic('id-badge-2') + ' Alles ansehen</button>' : ''}</div>`;
  }
  function naechsteLizenzHtml(T) {
    const n = LIZENZEN[(T.lizenz || 0) + 1];
    if (!n) return '<div class="kstr-lauf">Höchste Lizenz erreicht – alle Werte können bis 20 steigen.</div>';
    const teile = [`${Math.min(T.saisons, n.saisons)}/${n.saisons} Saisons`, `Summe der Werte ${summe(T)}/${n.summe}`];
    if (n.ansehen) teile.push(`Ansehen ${T.werte.ansehen}/${n.ansehen}`);
    // Rückmeldung 18.10.: Erklärung hinter ⓘ statt im Fließtext
    let info = '';
    if (typeof window.infoBtn === 'function') {
      if (typeof window.infoKarteSetzen === 'function') window.infoKarteSetzen('trainer-lizenz', 'Trainerlizenz', 'Der nächste Lehrgang findet in der Sommerpause statt, sobald die Bedingungen erfüllt sind. Danach können die Werte höher steigen.'
        + (KD ? '' : ' <b>Lernen durch Tun:</b> Siege (vor allem gegen Stärkere) bringen Taktik, gute Stimmung Menschenführung, junge Spieler in der Startelf Talentförderung, Wochen ohne Verletzung Fitness, Transfers Verhandeln. Ansehen kommt aus Titeln, Aufstiegen und einem zufriedenen Vorstand.'));
      info = ' ' + window.infoBtn('trainer-lizenz');
    }
    return `<div class="kstr-lauf"><b>Nächster Lehrgang: ${esc(n.name)}</b> · Werte bis ${n.max} · ${teile.join(' · ')}${info}</div>`;
  }
  function zeichneVerein() {
    if (KD) return;
    const T = daten(), view = document.getElementById('view-club'); if (!view) return;
    let el = document.getElementById('kstr-verein');
    if (!T) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('section'); el.id = 'kstr-verein'; el.className = 'kstr-p';
      const tt = document.getElementById('ks-trainerteam'), fac = document.getElementById('club-facilities');
      const vor = tt || (fac && fac.nextSibling);
      if (vor && vor.parentNode) vor.parentNode.insertBefore(el, vor); else view.appendChild(el);
    }
    el.innerHTML = `<div class="kst-kopf"><b>${ic('user-star')} ${T.geschlecht === 'w' ? 'Deine Trainerin' : 'Dein Trainer'}</b></div>` + profilHtml(T, true);
  }
  let PB = null;
  function blatt(inhalt, label, zuOk) {
    editorCss();
    if (!PB) {
      PB = document.createElement('div'); PB.id = 'kstr-sp';
      PB.innerHTML = '<div class="kstb-bg"></div><div class="kstr-box" role="dialog" aria-modal="true"></div>';
      PB.addEventListener('click', ev => {
        if ((ev.target.closest('.kstb-bg') && PB.dataset.zu === '1') || ev.target.closest('[data-kstr-zu]')) { PB.classList.remove('auf'); return; }
        const e = ev.target.closest('[data-kstr-eig]'); if (e) { eigenschaftWaehlen(e.dataset.kstrEig); }
      });
      document.body.appendChild(PB);
    }
    PB.dataset.zu = zuOk === false ? '0' : '1';
    const box = PB.querySelector('.kstr-box'); box.setAttribute('aria-label', label); box.innerHTML = inhalt;
    requestAnimationFrame(() => PB.classList.add('auf'));
  }
  function profil() {
    const T = daten(); if (!T) return;
    blatt(`<div class="kstb-kopf"><b>${T.geschlecht === 'w' ? 'Meine Trainerin' : 'Mein Trainer'}</b><button type="button" class="kstb-zu" data-kstr-zu="1" aria-label="Schließen">${ic('x')}</button></div>
      <div class="kstr-p" style="border:0;padding:4px 0;background:transparent">${profilHtml(T, false)}</div>`, 'Trainerprofil');
  }
  function sommerpause() {
    const T = daten(); if (!T || !T.offen) return;
    const o = T.offen, z = T.zuwachs[o.saison] || {}, L = lizenz(T);
    const zeilen = WERTE.map(([k, n, icon]) => { const d = z[k] || 0; return `<div class="kstr-w">${ic(icon)}<span>${n}</span><b>${T.werte[k]} ${d > 0 ? `<span class="kstr-plus">+${d}</span>` : d < 0 ? `<span class="kstr-minus">${d}</span>` : ''}</b>
      <small style="grid-column:2/4">${esc(wirkungText(k, T.werte[k]))}</small></div>`; }).join('');
    const gruende = (T.ansehenLog || []).filter(x => x.s === o.saison && x.d).map(x => `${x.grund} ${x.d > 0 ? '+' : ''}${x.d}`).join(' · ');
    const liz = o.lizenz ? `<div class="kstr-liz">${ic('school')}<b>Lehrgang bestanden: ${esc(L.name)}</b><small>Deine Werte können jetzt bis ${L.max} steigen. Wähle eine Eigenschaft:</small></div>
      <div class="kstr-eig">${(o.wahl || []).map(id => { const E = EIGENSCHAFTEN[id]; return `<button type="button" class="kstr-wgk" data-kstr-eig="${id}">${ic(E.icon)}<span><b>${esc(E.name)}</b><small style="margin:2px 0 0">${esc(E.text)}</small></span></button>`; }).join('')}</div>` : '';
    blatt(`<div class="kstb-kopf"><b>Sommerpause ${esc(o.label || '')}</b>${o.lizenz ? '' : `<button type="button" class="kstb-zu" data-kstr-zu="1" aria-label="Schließen">${ic('x')}</button>`}</div>
      <div class="kstr-pkopf" style="margin:8px 0"><div class="kstr-av">${gesichtSvg(T)}</div><div><b>${esc(T.name)}</b><small>Das hat dir die Saison gebracht.${gruende ? '<br>Ansehen: ' + esc(gruende) : ''}</small></div></div>
      <div class="kstr-wl">${zeilen}</div>${liz}
      ${o.lizenz ? '' : `<div class="kstr-lauf">${naechsteLizenzHtml(T).replace(/^<div class="kstr-lauf">|<\/div>$/g, '')}</div><div class="kstr-fuss"><button type="button" class="kstr-knopf" data-kstr-zu="1">Weiter</button></div>`}`,
    'Sommerpause', !o.lizenz);
    if (!o.lizenz) { T.offen = null; speichern(); }
  }
  function eigenschaftWaehlen(id) {
    const T = daten(); if (!T || !T.offen || !EIGENSCHAFTEN[id]) return;
    T.eigenschaften.push(id); T.offen = null;
    news(`${em('⭐ ')}Neue Eigenschaft: ${EIGENSCHAFTEN[id].name}`, EIGENSCHAFTEN[id].text + '.');
    toast(`${em('⭐ ')}${EIGENSCHAFTEN[id].name}`, 'success');
    speichern(); if (PB) PB.classList.remove('auf');
    try { zeichneVerein(); } catch (e) { /* Ansicht optional */ }
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-kstr]'); if (!b) return;
    ev.preventDefault();
    if (b.dataset.kstr === 'profil') profil();
    if (b.dataset.kstr === 'aussehen') {
      if (PB) PB.classList.remove('auf');
      editor({ modus: 'aussehen', fertig: E => { const T = daten(); if (!T) return; Object.assign(T, { name: E.name, geschlecht: E.geschlecht, geburtsjahr: E.geburtsjahr, gesicht: E.gesicht, outfit: E.outfit }); vorlageMerken(T); speichern(); zeichneVerein(); } });
    }
  });
  function mehrEintrag() {
    const box = document.querySelector('#app-sheet .app-sheet-box');
    const T = daten();
    if (!box || !T) return;
    const da = box.querySelector('.kstr-eintrag');
    if (da) {                                                  // Name/Lizenz können sich ändern
      const sub = `${T.name} · ${lizenz(T).name} · Werte und Entwicklung`, sm = da.querySelector('small'), bb = da.querySelector('b');
      if (sm && sm.textContent !== sub) sm.textContent = sub;
      if (bb) bb.textContent = T.geschlecht === 'w' ? 'Meine Trainerin' : 'Mein Trainer';
      return;
    }
    const html = `<button class="app-eintrag kstr-eintrag" type="button">${ic('user-star')}<span class="app-eintrag-txt"><b>${T.geschlecht === 'w' ? 'Meine Trainerin' : 'Mein Trainer'}</b><small>${esc(T.name)} · ${esc(lizenz(T).name)} · Werte und Entwicklung</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i></button>`;
    const vor = box.querySelector('.app-eintrag');
    if (vor) vor.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
    box.querySelector('.kstr-eintrag').addEventListener('click', ev => { ev.stopPropagation(); const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); profil(); });
  }

  // ── Begrüßung (Rückmeldung 17.10. (2), Nutzer: „ein stimmigerer Anfang, der mit der Vergangenheit des Trainers zu tun hat:
  //    schön, dass endlich mal ein Jugendtrainer kommt … der letzte war ein Ex-Profi und hat sie nie eingesetzt“ – „variabel sein
  //    und viele Kommentare vorbereitet haben“). Einmal je Karriere nach dem Anlegen, sobald kein anderes Fenster offen ist.
  //    Bausteine: Sprecher (Rolle) · Hoffnung je Werdegang · was der Vorgänger falsch gemacht hat (passend zum Werdegang) · Wunsch.
  const GRUSS = {
    sprecher: KD ? [['Eigentümer', 'm'], ['Eigentümerin', 'w'], ['General Manager', 'm'], ['Kapitän', 'm']] : [['Sportdirektor', 'm'], ['Präsidentin', 'w'], ['Präsident', 'm'], ['Kapitän', 'm']],
    hoffnung: {
      jugend: ['Schön, dass endlich mal ein Jugendtrainer kommt – unsere Talente warten seit Jahren auf eine echte Chance.',
        'Ein Trainer, der junge Spieler wirklich besser macht – genau das haben wir gesucht.',
        'Im Nachwuchs reden alle schon von dir. Jetzt bekommst du die große Bühne.'],
      exprofi: ['Endlich jemand, der selbst auf dem Platz stand. Die Kabine hat schon gefragt, ob es wirklich du bist.',
        'Mit deiner Karriere im Rücken hört dir jeder zu – das brauchen wir jetzt.',
        'Ein Ex-Profi an der Seitenlinie – die Fans haben dein altes Trikot noch im Schrank.'],
      laptop: ['Du hast mehr Spiele analysiert, als wir alle zusammen gesehen haben. Zeig uns, was in den Zahlen steckt.',
        'Video, Daten, Matchpläne – genau diese Ordnung hat uns gefehlt.',
        'Kaum ein Fan kennt dich, aber jeder Analyst der Liga kennt deine Präsentationen.'],
      motivator: ['Man sagt, nach deinen Ansprachen laufen Spieler durch Wände. Gut so – wir brauchen Feuer.',
        'Diese Mannschaft braucht jemanden, der sie mitreißt. Das bist du.',
        'Die Stimmung war zuletzt im Keller. Du sollst sie wieder hochholen.'],
      athletik: ['Unsere Verletztenliste war zuletzt länger als der Spielberichtsbogen. Du sollst das ändern.',
        'Fitness gewinnt Spiele in der Schlussphase – und genau da haben wir zuletzt alles hergeschenkt.',
        'Endlich jemand, der weiß, wie man Spieler gesund durch eine Saison bringt.'],
      allrounder: ['Kein Spezialist, sondern jemand, der überall anpackt – genau das suchen wir.',
        'Taktik, Kabine, Training: Von dir erwarten wir ein bisschen von allem. Und zwar sofort.',
        'Du bist schwer einzuordnen. Das gefällt uns.']
    },
    vorgaenger: {
      jugend: ['Der Letzte war ein Ex-Profi und hat die Jungen nie eingesetzt – lieber seine alten Weggefährten.',
        'Dein Vorgänger hat für jedes Talent einen Routinier geholt. Die Jugend saß nur auf der Tribüne.',
        'Unter dem letzten Trainer hat kein Spieler unter 23 auch nur eine Minute gesehen.'],
      exprofi: ['Dein Vorgänger kam vom Laptop und hat die Kabine nie erreicht. Zuhören wollte ihm keiner.',
        'Der Letzte hatte nie selbst gespielt – und das haben die Spieler ihn jeden Tag spüren lassen.',
        'Der letzte Trainer war ein Theoretiker. Die Führungsspieler haben ihn ausgelacht.'],
      laptop: ['Der Letzte hat viel geredet und laut geschrien, aber einen Matchplan hatte er nie.',
        'Dein Vorgänger hat aus dem Bauch aufgestellt. Manchmal hat es geklappt, meistens nicht.',
        'Unter dem letzten Trainer wusste nach dem Anpfiff keiner mehr, was eigentlich der Plan war.'],
      motivator: ['Dein Vorgänger hatte für alles eine Statistik, aber die Kabine war ihm egal. Die Stimmung ist im Keller.',
        'Der Letzte war ein Schleifer. Gewonnen haben wir wenig, gelacht noch weniger.',
        'Unter dem letzten Trainer hat keiner mehr an sich geglaubt – nach dem ersten Gegentor war das Spiel vorbei.'],
      athletik: ['Unter deinem Vorgänger hatten wir mehr Verletzte als Punkte.',
        'Der Letzte hat in der Vorbereitung nur Taktik gemacht. Nach 70 Minuten ging uns jedes Mal die Luft aus.',
        'Dein Vorgänger hat die Belastung nie gesteuert – im Frühjahr lagen die halben Stammspieler beim Arzt.'],
      allrounder: ['Der Letzte war ein Feuerwehrmann für drei Monate – danach war er schneller weg als gekommen.',
        'Dein Vorgänger konnte genau eine Sache gut. Leider nicht die, die wir gebraucht haben.',
        'Der letzte Trainer hat sich mit allen angelegt – mit Spielern, Fans und Vorstand.']
    },
    wunsch: {
      jugend: KD ? 'Unser Wunsch: Gib den Rookies Einsatzzeit – die Zukunft der Franchise liegt im Draft.' : 'Unser Wunsch: Gib unseren Talenten Spielminuten – die Akademie schaut auf dich.',
      exprofi: 'Unser Wunsch: Hol die Kabine zurück. Wenn die Führungsspieler mitziehen, folgt der Rest.',
      laptop: 'Unser Wunsch: Eine klare Spielidee, die jeder versteht – vom Kapitän bis zum Ersatztorhüter.',
      motivator: 'Unser Wunsch: Bring das Feuer zurück. Die Fans wollen eine Mannschaft sehen, die nie aufgibt.',
      athletik: 'Unser Wunsch: Bring die Stammspieler gesund durch die Saison – dann kommen die Punkte von selbst.',
      allrounder: 'Unser Wunsch: Ein stabiler Start. Den Rest bauen wir gemeinsam auf.'
    }
  };
  const zuf2 = a => a[Math.floor(Math.random() * a.length)];
  function grussBauen(T) {
    const wg = GRUSS.hoffnung[T.werdegang] ? T.werdegang : 'allrounder';
    const [rolle, g] = zuf2(GRUSS.sprecher);
    const F = W.facesjs;
    const person = F ? { gesicht: F.generate({ jersey: { id: 'jersey' }, accessories: { id: 'none' }, glasses: { id: 'none' } }, { gender: g === 'w' ? 'female' : 'male' }),
      outfit: rolle === 'Kapitän' ? 'jacke' : 'anzug', geburtsjahr: jahrJetzt() - (rolle === 'Kapitän' ? 29 : 52) } : null;
    return { rolle, person, hoffnung: zuf2(GRUSS.hoffnung[wg]), vorgaenger: zuf2(GRUSS.vorgaenger[wg]), wunsch: GRUSS.wunsch[wg] };
  }
  const offenesFenster = () => [...document.querySelectorAll('body > *')].some(el => {
    if (el.id === 'kstr-gruss') return false;
    const cs = getComputedStyle(el);
    // sichtbar und bedienbar (das Mehr-Blatt liegt versteckt mit pointer-events: none bereit)
    return cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && +cs.opacity > 0.05 && +cs.zIndex >= 50 && el.getClientRects().length && el.offsetHeight > 150;
  });
  function grussZeigen() {
    const T = daten();
    if (!T || T.gruss !== 'offen' || document.getElementById('kstr-gruss') || offenesFenster()) return false;
    const G = T.grussText || (T.grussText = grussBauen(T));
    const anrede = T.geschlecht === 'w' ? 'Trainerin' : 'Trainer';
    const name = typeof clubName === 'function' ? clubName() : (CLUB.name || '');
    const ov = document.createElement('div');
    ov.id = 'kstr-gruss';
    ov.innerHTML = `<div class="kgr-box" role="dialog" aria-modal="true" aria-label="Begrüßung">
      <div class="kgr-kopf">${G.person ? `<span class="kgr-gesicht">${gesichtSvg(G.person, { farben: vereinsFarben(CLUB.dataClubId, KD ? null : CLUB.name), altern: false })}</span>` : ''}
        <div><small>${esc(G.rolle)} · ${esc(name)}</small><b>${em('👋 ')}Willkommen, ${esc(anrede)} ${esc(T.name)}!</b></div></div>
      <p class="kgr-blase">„${esc(G.hoffnung)} ${esc(G.vorgaenger)}“</p>
      <p class="kgr-wunsch">${esc(G.wunsch)}</p>
      <button type="button" class="kgr-los">Los geht's</button></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('auf'));
    ov.querySelector('.kgr-los').addEventListener('click', () => { T.gruss = 'gezeigt'; delete T.grussText; ov.remove(); speichern(); });
    news(`${em('👋 ')}Begrüßung: ${G.rolle}`, `„${G.hoffnung} ${G.vorgaenger}“ ${G.wunsch}`);
    return true;
  }
  let grussTakt = null;
  function grussPlanen() {
    if (grussTakt || testlauf()) return;
    let n = 0;
    grussTakt = setInterval(() => {
      n++;
      const T = hatSpiel() ? daten() : null;
      if (!T || T.gruss !== 'offen' || n > 300) { clearInterval(grussTakt); grussTakt = null; return; }
      try { if (grussZeigen()) { clearInterval(grussTakt); grussTakt = null; } } catch (e) { clearInterval(grussTakt); grussTakt = null; }
    }, 2000);
  }
  function grussCss() {
    if (document.getElementById('kstr-gruss-stil')) return;
    const st = document.createElement('style'); st.id = 'kstr-gruss-stil';
    st.textContent = `#kstr-gruss{position:fixed;inset:0;z-index:9800;display:grid;place-items:center;padding:16px;background:rgb(10 12 20/.72);opacity:0;transition:opacity .25s}
      #kstr-gruss.auf{opacity:1}
      .kgr-box{width:min(380px,100%);background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border-radius:20px;padding:16px;display:grid;gap:12px;
        border:3px solid var(--k-rand,#8b5a2b);box-shadow:0 8px 0 rgb(0 0 0/.25);transform:translateY(16px);transition:transform .3s}
      #kstr-gruss.auf .kgr-box{transform:none}
      .kgr-kopf{display:flex;gap:12px;align-items:center}
      .kgr-gesicht{flex:none;width:70px;height:70px;border-radius:50%;overflow:hidden;background:var(--bg3,#efe2c8);border:3px solid var(--k-rand,#8b5a2b)}
      .kgr-gesicht svg{width:100%;height:150%;margin-top:-6%}
      .kgr-kopf small{display:block;font-size:12px;opacity:.7}
      .kgr-kopf b{font:700 19px/1.2 var(--font-display,system-ui)}
      .kgr-blase{margin:0;background:var(--bg3,#efe2c8);border-radius:14px;padding:12px;font-size:15px;line-height:1.45;position:relative}
      .kgr-wunsch{margin:0;font-size:14px;font-weight:700}
      .kgr-los{justify-self:end;font:700 16px var(--font-display,system-ui);padding:10px 22px;border-radius:12px;border:0;background:var(--app-gut,#25a95c);color:#fff;box-shadow:0 4px 0 rgb(0 0 0/.25);cursor:pointer}
      @media (prefers-reduced-motion:reduce){#kstr-gruss,.kgr-box{transition:none}}`;
    document.head.appendChild(st);
  }
  grussCss();
  setTimeout(() => { try { if (hatSpiel() && daten() && daten().gruss === 'offen') grussPlanen(); } catch (e) { /* ohne Spiel */ } }, 2500);

  // ── Einhängen ─────────────────────────────────────────────────────────────
  let NEU_LAEUFT = false, WARTEND = null;
  function anlegen(E) {
    if (!hatSpiel()) return;
    CLUB.ksTrainer = neuerTrainer(E); vorlageMerken(CLUB.ksTrainer);
    CLUB.ksTrainer.gruss = 'offen';                            // Begrüßung passend zum Werdegang (grussZeigen)
    try { sessionStorage.removeItem('kstr-entwurf'); } catch (e) { /* ohne */ }
    news(`${em('👋 ')}${E.geschlecht === 'w' ? 'Die neue Trainerin' : 'Der neue Trainer'}: ${E.name}`,
      `${WERDEGANG[CLUB.ksTrainer.werdegang].name} · ${lizenz(CLUB.ksTrainer).name}`);
    speichern();
    try { zeichneVerein(); } catch (e) { /* Ansicht optional */ }
    grussPlanen();
  }
  // Neues Spiel: nach der Vereinswahl erst die Figur, dann der Start (Karrierestart räumt ks…-Felder → danach setzen)
  if (typeof W._beginNewGame === 'function') {
    const _b = W._beginNewGame;
    W._beginNewGame = function (chosenTeam) {
      const self = this, args = arguments;
      // Kickdraft lädt für eine neue Karriere die Seite neu und wählt den Verein dort noch einmal (dfl_start.js, D135):
      // der eben erstellte Entwurf liegt dann in der Sitzung und der Editor erscheint nicht zweimal
      let gemerkt = null;
      try { const x = JSON.parse(sessionStorage.getItem('kstr-entwurf') || 'null'); if (x && Date.now() - x.t < 300000) gemerkt = x.E; } catch (e) { gemerkt = null; }
      if (gemerkt) { WARTEND = gemerkt; return _b.apply(self, args); }
      if (testlauf()) { const E = entwurfAus(null); E.werdegang = testWerdegang(); WARTEND = E; return _b.apply(self, args); }
      NEU_LAEUFT = true;
      return new Promise(res => {
        editor({ modus: 'neu', dataClubId: chosenTeam && chosenTeam.dataClubId, vereinsName: chosenTeam && chosenTeam.name, fertig: E => {
          WARTEND = E; try { sessionStorage.setItem('kstr-entwurf', JSON.stringify({ E, t: Date.now() })); } catch (e) { /* ohne */ } res(); } });
      }).then(() => _b.apply(self, args)).finally(() => { NEU_LAEUFT = false; });
    };
    try { _beginNewGame = W._beginNewGame; } catch (e) { /* window reicht */ }
  }
  if (typeof W.startNewGameState === 'function') {
    const _s = W.startNewGameState;
    W.startNewGameState = function () {
      const r = _s.apply(this, arguments);
      const danach = () => { if (WARTEND) { const E = WARTEND; WARTEND = null; try { anlegen(E); } catch (e) { console.warn('[Kickstil-Trainer] Anlegen', e); } } };
      if (r && typeof r.then === 'function') return r.then(x => { danach(); return x; });
      danach(); return r;
    };
    try { startNewGameState = W.startNewGameState; } catch (e) { /* window reicht */ }
  }
  if (typeof W.processFixtureResult === 'function') {
    const _p = W.processFixtureResult;
    W.processFixtureResult = function () {
      let fx = null, tore = null, staerke = null, jung = 0, xi = [];
      try {
        fx = CURRENT_FIXTURE ? Object.assign({}, CURRENT_FIXTURE) : null;
        tore = { f: G.homeGoals, g: G.awayGoals };
        staerke = { wir: (TEAMS.home && TEAMS.home.str) || 0, gegner: (TEAMS.away && TEAMS.away.str) || 0 };
        xi = getLineupIds().map(getPlayer).filter(Boolean);
        jung = xi.filter(p => (p.age || 25) <= (KD ? 23 : 21)).length;
      } catch (e) { fx = null; }
      const r = _p.apply(this, arguments);
      try {
        if (fx && tore && daten()) {
          spiel(fx, tore.f, tore.g, staerke, jung);
          if (fx.type === 'euro') daten()._euro = true;
          if (eigen('kabine') && tore.f < tore.g && fx.type !== 'friendly' && typeof W.addMorale === 'function') W.addMorale(xi, 2);
        }
      } catch (e) { console.warn('[Kickstil-Trainer] Spiel', e); }
      return r;
    };
    try { processFixtureResult = W.processFixtureResult; } catch (e) { /* window reicht */ }
  }
  if (typeof W.advanceCalendarWeek === 'function') {
    const _w = W.advanceCalendarWeek;
    W.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try { if (r !== false) woche(); } catch (e) { console.warn('[Kickstil-Trainer] Woche', e); }
      return r;
    };
    try { advanceCalendarWeek = W.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // Kickdraft: Saisondaten aus Playoffs (LEAGUE.dflPlayoffs.ausgeschieden.fcm: 1–4 Runde des Aus, 5 Meister) und Eigentümer-Urteil
  const KD_RUNDE = ['', 'Playoffs', 'Playoffs', 'Conference-Finale', 'Finale', 'Meister'];
  function kdVorher() {
    try { const po = LEAGUE.dflPlayoffs || {}; return { saison: LEAGUE.season, label: saisonLabel(LEAGUE.season), runde: (po.ausgeschieden && po.ausgeschieden.fcm) || 0 }; } catch (e) { return null; }
  }
  function kdSaisonende(v) {
    const T = daten(); if (!T || !v || T._gewertet === v.saison) return;
    T._gewertet = v.saison; T.saisons++;
    const an = (d, g) => ansehenAendern(d, g, v.saison);
    // Playoff-Runde: dfl_saisonwechsel_patch.js liegt außen und räumt LEAGUE.dflPlayoffs vor unserem Haken – sicher steht sie im
    // Urteil des Eigentümers (historie[].runde, 1–4 Aus in Runde, 5 Meister)
    let h = null;
    try { const E = CLUB.dfl && CLUB.dfl.eigner; h = E && E.historie && E.historie[E.historie.length - 1]; } catch (e) { h = null; }
    const runde = Math.max(v.runde || 0, (h && h.runde) || 0);
    if (runde >= 5) { an(3, 'Meister'); T.titel.push({ saison: v.label, text: 'DFL-Meister' }); }
    else if (runde === 4) an(2, 'Finale');
    else if (runde === 3) an(1, 'Conference-Finale');
    else if (runde >= 1) an(1, 'Playoffs');
    if (h && h.wert >= 70) an(1, 'Eigentümer begeistert'); else if (h && h.wert < 30) an(-1, 'Eigentümer verärgert');
    lehrgang(T, v);
  }
  // Nach kickstil_saisonabschluss.js: dessen Saisondaten (KSSaisonende.letzte) stehen nach dem Original bereit
  if (typeof W.startNewSeason === 'function') {
    const _n = W.startNewSeason;
    W.startNewSeason = function () {
      const vorher = KD ? kdVorher() : null;
      const r = _n.apply(this, arguments);
      const danach = () => { try { if (daten() && !CLUB.ksEntlassen) { if (KD) kdSaisonende(vorher); else saisonende(W.KSSaisonende && KSSaisonende.letzte()); } } catch (e) { console.warn('[Kickstil-Trainer] Saisonende', e); } };
      if (r && typeof r.then === 'function') r.then(x => { danach(); return x; }); else danach();
      return r;
    };
    try { startNewSeason = W.startNewSeason; } catch (e) { /* window reicht */ }
  }
  if (typeof W.renderClubTab === 'function') {
    const _r = W.renderClubTab;
    W.renderClubTab = function () {
      const r = _r.apply(this, arguments);
      try { zeichneVerein(); } catch (e) { console.warn('[Kickstil-Trainer] Anzeige', e); }
      return r;
    };
    try { renderClubTab = W.renderClubTab; } catch (e) { /* window reicht */ }
  }
  const frei = () => { try { const E = W.KSErfolge || W.DFLErfolge; return E && E.frei ? E.frei() : true; } catch (e) { return false; } };
  // Kickdraft: Kachel im Front Office (eigener Klick, damit die FO-Navigation sie nicht als Bereich deutet)
  function foKachel() {
    const box = document.querySelector('#view-fo .fo-kacheln'), T = daten();
    if (!box || !T || box.querySelector('.kstr-fo')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fo-kachel kstr-fo';
    b.innerHTML = `${ic('user-star')}<b>${T.geschlecht === 'w' ? 'Chefcoach' : 'Chefcoach'}</b><small>${esc(T.name)} · ${esc(lizenz(T).name)}</small>`;
    b.addEventListener('click', ev => { ev.stopPropagation(); profil(); });
    box.appendChild(b);
  }
  const sichtbar = s => { const e = document.querySelector(s); return !!(e && e.offsetParent !== null); };
  setInterval(() => {
    try {
      expHaken();
      if (!hatSpiel() || NEU_LAEUFT || ED) return;
      mehrEintrag(); if (KD) foKachel();
      if (CLUB.ksEntlassen) return;
      const T = daten();
      if (!T) {
        // Alte Spielstände: einmal anbieten, „Später“ legt einen Allrounder mit Zufallsgesicht an
        if (testlauf()) { const E = entwurfAus(null); E.werdegang = testWerdegang(); anlegen(E); return; }
        if (frei() && sichtbar('#view-home.active')) editor({ modus: 'nachruesten', fertig: anlegen, spaeter: anlegen });
        return;
      }
      if (T.offen && testlauf()) { if (T.offen.lizenz && T.offen.wahl && T.offen.wahl.length) eigenschaftWaehlen(T.offen.wahl[0]); else T.offen = null; return; }
      if (T.offen && frei() && !(PB && PB.classList.contains('auf'))) sommerpause();
    } catch (e) { /* später */ }
  }, 1300);

  W.KSTrainer = { begruessung: () => grussZeigen(), WERTE, WERDEGANG, LIZENZEN, EIGENSCHAFTEN, OUTFITS, daten, wert, wort, bonus, gesichtSvg, editor, profil, sommerpause, erfahrung, wirkungText,
    lizenz: () => lizenz(daten()), _saisonende: saisonende, _woche: woche };
  console.log('[Kickstil-Trainer v1] aktiv — eigene Trainerfigur (Trainer/Trainerin, Gesicht, Outfit), Werdegang, 6 Werte, Lernen durch Tun, Lizenzen, Eigenschaften');
})();
