/* ═══════════════════════════════════════════════════════════════════════════
   CHARAKTEREIGENSCHAFTEN  ·  v1 (Kern)
   ─────────────────────────────────────────────────────────────────────────
   27 Eigenschaften, die Spieler mit gleichen Werten unterscheidbar machen.

   Verteilung: 45 % ohne, 32 % eine, 17 % zwei, 5 % drei, 1 % vier —
   Toptalente etwas häufiger mit. Wer drei oder mehr hat, bekommt garantiert
   mindestens einen Nachteil, sonst wären Mehrfach-Charaktere schlicht bessere
   Spieler. Nachteile sind beim Ziehen zusätzlich höher gewichtet, weil es
   deutlich mehr Vorteile in der Liste gibt.

   Sichtbarkeit:
     offen     — steht sofort im Kader
     scout     — die Beobachtung deckt es bei 60 % Fortschritt auf
     verdeckt  — zeigt sich erst durch Ereignisse (2. Verletzung, Formkrise,
                 Rollenkonflikt)

   Dieser Kern liefert Datenmodell, Vergabe, Aufdeckung und Anzeige. Die
   Wirkungen auf Entwicklung und Physis hängen direkt daran; alles Weitere
   (Kabine, Verhandlung, Spielweise) lässt sich einzeln nachrüsten.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // art: 'plus' | 'minus' | 'mix'   ·   sicht: 'offen' | 'scout' | 'verdeckt'
  const TRAITS = {
    // ── Entwicklung ────────────────────────────────────────────────────────
    fruehentwickler: { name:'Frühentwickler', art:'mix', sicht:'scout', gruppe:'Entwicklung',
      text:'Reift schnell, ist früh fertig — und baut auch früher ab.' },
    spaetentwickler: { name:'Spätentwickler', art:'mix', sicht:'scout', gruppe:'Entwicklung',
      text:'Braucht lange, legt dafür bis weit in die Zwanziger zu.' },
    trainingsfleiss: { name:'Trainingsweltmeister', art:'plus', sicht:'scout', gruppe:'Entwicklung',
      text:'Arbeitet härter als alle anderen und entwickelt sich schneller.' },
    trainingsfaul:   { name:'Trainingsfaul', art:'minus', sicht:'scout', gruppe:'Entwicklung',
      text:'Lässt im Training nach — die Entwicklung stockt.' },

    // ── Physis ─────────────────────────────────────────────────────────────
    laufwunder:      { name:'Laufwunder', art:'plus', sicht:'offen', gruppe:'Physis',
      text:'Hat auch nach 90 Minuten noch Luft.' },
    konditionsschwach:{ name:'Konditionsschwach', art:'minus', sicht:'offen', gruppe:'Physis',
      text:'Geht früh die Puste aus.' },
    verletzungsanfaellig:{ name:'Verletzungsanfällig', art:'minus', sicht:'verdeckt', gruppe:'Physis',
      text:'Fällt häufiger aus als andere.' },
    unverwuestlich:  { name:'Unverwüstlich', art:'plus', sicht:'scout', gruppe:'Physis',
      text:'Steht praktisch immer zur Verfügung.' },
    schnellheiler:   { name:'Schnellheiler', art:'plus', sicht:'scout', gruppe:'Physis',
      text:'Kommt schneller zurück als die Prognose sagt.' },
    vorbildprofi:    { name:'Vorbildprofi', art:'plus', sicht:'scout', gruppe:'Physis',
      text:'Lebt professionell — der Abbau ab 30 setzt später ein.' },

    // ── Kabine ─────────────────────────────────────────────────────────────
    fuehrungsspieler:{ name:'Führungsspieler', art:'plus', sicht:'offen', gruppe:'Kabine',
      text:'Hebt die Stimmung der ganzen Mannschaft.' },
    mentor:          { name:'Mentor', art:'plus', sicht:'scout', gruppe:'Kabine',
      text:'Bringt junge Mitspieler schneller voran.' },
    diva:            { name:'Diva', art:'minus', sicht:'verdeckt', gruppe:'Kabine',
      text:'Verlangt eine große Rolle — und wird laut, wenn er sie nicht bekommt.' },

    // ── Verhandlung und Ehrgeiz ────────────────────────────────────────────
    vereinstreu:     { name:'Vereinstreu', art:'plus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Verlängert unter Wert und wird nie von sich aus wechselwillig.' },
    geldgierig:      { name:'Geldgierig', art:'minus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Verlangt deutlich mehr Gehalt — ist dafür fast immer zu holen.' },
    bescheiden:      { name:'Bescheiden', art:'plus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Nimmt auch eine Reservistenrolle ohne Murren an.' },
    titelhungrig:    { name:'Titelhungrig', art:'mix', sicht:'offen', gruppe:'Ehrgeiz',
      text:'Will Erfolg — und wird unzufrieden, wenn die Saisonziele verfehlt werden.' },
    heimatverbunden: { name:'Heimatverbunden', art:'plus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Verlangt in der Heimat oder beim alten Verein weniger Gehalt.' },
    wechselfreudig:  { name:'Wechselfreudig', art:'minus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Drängt regelmäßig auf Veränderung.' },

    // ── Spielweise ─────────────────────────────────────────────────────────
    konstant:        { name:'Konstant', art:'plus', sicht:'scout', gruppe:'Spielweise',
      text:'Schwankt kaum — man weiß, was man bekommt.' },
    launisch:        { name:'Launisch', art:'minus', sicht:'verdeckt', gruppe:'Spielweise',
      text:'Zwischen Rausch und Krise liegt bei ihm wenig.' },
    nervenstark:     { name:'Nervenstark', art:'plus', sicht:'scout', gruppe:'Spielweise',
      text:'Wächst in Derbys, Pokalspielen und Topspielen über sich hinaus.' },
    mentalitaet:     { name:'Mentalitätsspieler', art:'plus', sicht:'scout', gruppe:'Spielweise',
      text:'Wird stärker, wenn die Mannschaft zurückliegt.' },
    standards:       { name:'Standardspezialist', art:'plus', sicht:'offen', gruppe:'Spielweise',
      text:'Gefährlich bei Freistößen und Ecken.' },
    hitzkopf:        { name:'Hitzkopf', art:'minus', sicht:'offen', gruppe:'Spielweise',
      text:'Sieht mehr Karten als ihm guttut.' },

    // ── Öffentlichkeit ─────────────────────────────────────────────────────
    publikumsliebling:{ name:'Publikumsliebling', art:'plus', sicht:'offen', gruppe:'Öffentlichkeit',
      text:'Die Fans lieben ihn — ein Verkauf kostet Stimmung.' },
    medienpraesent:  { name:'Medienpräsent', art:'mix', sicht:'offen', gruppe:'Öffentlichkeit',
      text:'Steht ständig in der Zeitung, im Guten wie im Schlechten.' }
  };
  const SCHLUESSEL = Object.keys(TRAITS);

  const CFG = {
    // Verteilung der Anzahl: [ohne, 1, 2, 3, 4]
    verteilung: [0.45, 0.32, 0.17, 0.05, 0.01],
    // Toptalente haben häufiger Charakter — Persönlichkeit ist mit ein Grund,
    // warum jemand oben landet.
    talentBonus: 0.12,        // verschiebt die Verteilung nach oben
    talentAbPotenzial: 80,
    // Es gibt 15 Vorteile, 8 Nachteile und 4 zweischneidige. Ohne Gegengewicht
    // würde jeder Kader im Schnitt besser. 1,55 landet bei rund 1,1 Vorteilen
    // je Nachteil — leicht positiv, ohne dass die Werte davonlaufen.
    minusGewicht: 1.55,
    minusPflichtAb: 3,        // ab so vielen Traits mindestens ein Nachteil
    scoutSchwelle: 0.6,       // ab diesem Beobachtungs-Fortschritt sichtbar
    // Gegensätze, die sich ausschließen
    unvereinbar: [
      ['fruehentwickler','spaetentwickler'], ['trainingsfleiss','trainingsfaul'],
      ['laufwunder','konditionsschwach'], ['verletzungsanfaellig','unverwuestlich'],
      ['geldgierig','bescheiden'], ['geldgierig','vereinstreu'],
      ['vereinstreu','wechselfreudig'], ['bescheiden','diva'],
      ['konstant','launisch'], ['vorbildprofi','trainingsfaul']
    ]
  };
  window.Traits = { katalog: TRAITS, cfg: CFG };

  function passtDazu(schon, kand) {
    if (schon.includes(kand)) return false;
    return !CFG.unvereinbar.some(([a, b]) =>
      (a === kand && schon.includes(b)) || (b === kand && schon.includes(a)));
  }
  function zieheAnzahl(potenzial) {
    let r = Math.random();
    // Nach OBEN verschieben, nicht nach unten: Index 0 ist „keine Eigenschaft".
    // Vorher senkte der Bonus r und machte Toptalente dadurch charakterloser.
    if ((potenzial || 0) >= CFG.talentAbPotenzial) r = Math.min(0.9999, r + CFG.talentBonus);
    let summe = 0;
    for (let i = 0; i < CFG.verteilung.length; i++) {
      summe += CFG.verteilung[i];
      if (r < summe) return i;
    }
    return 0;
  }
  function ziehe(schon, nurArt) {
    const kandidaten = SCHLUESSEL.filter(k =>
      passtDazu(schon, k) && (!nurArt || TRAITS[k].art === nurArt));
    if (!kandidaten.length) return null;
    const gewichte = kandidaten.map(k => TRAITS[k].art === 'minus' ? CFG.minusGewicht : 1);
    const gesamt = gewichte.reduce((a, b) => a + b, 0);
    let r = Math.random() * gesamt;
    for (let i = 0; i < kandidaten.length; i++) { r -= gewichte[i]; if (r <= 0) return kandidaten[i]; }
    return kandidaten[kandidaten.length - 1];
  }

  // Vergibt Eigenschaften an einen Spieler. Idempotent — wer schon welche hat,
  // behält sie.
  function vergib(p) {
    if (!p || Array.isArray(p.traits)) return p;
    const n = zieheAnzahl(p.truePotential || p.ovr);
    const raus = [];
    for (let i = 0; i < n; i++) {
      // Ab drei Eigenschaften muss ein Nachteil dabei sein
      const pflicht = (n >= CFG.minusPflichtAb && i === n - 1 &&
                       !raus.some(k => TRAITS[k].art === 'minus')) ? 'minus' : null;
      const k = ziehe(raus, pflicht);
      if (k) raus.push(k);
    }
    p.traits = raus;
    // Verdeckte Eigenschaften sind anfangs unbekannt
    p.traitsBekannt = raus.filter(k => TRAITS[k].sicht === 'offen');
    return p;
  }
  window.traitsVergeben = vergib;

  function hat(p, key) { return !!(p && p.traits && p.traits.indexOf(key) >= 0); }
  window.hatTrait = hat;

  // Welche Eigenschaften darf der Spieler gerade sehen?
  function sichtbare(p) {
    if (!p || !Array.isArray(p.traits)) return [];
    const bekannt = p.traitsBekannt || [];
    const fortschritt = (typeof window.beobachtungsFortschritt === 'function')
      ? window.beobachtungsFortschritt(p) : 0;
    const imKader = (typeof SQUAD !== 'undefined') && SQUAD.some(x => x && x.id === p.id);
    return p.traits.filter(k => {
      const t = TRAITS[k]; if (!t) return false;
      if (t.sicht === 'offen') return true;
      if (t.sicht === 'scout') return imKader || fortschritt >= CFG.scoutSchwelle;
      return bekannt.indexOf(k) >= 0;              // verdeckt: nur wenn aufgedeckt
    });
  }
  window.sichtbareTraits = sichtbare;

  // Eine verdeckte Eigenschaft ans Licht bringen (nach Verletzung, Krise, Streit)
  window.traitAufdecken = function (p, key, grund) {
    if (!hat(p, key)) return false;
    if (!Array.isArray(p.traitsBekannt)) p.traitsBekannt = [];
    if (p.traitsBekannt.indexOf(key) >= 0) return false;
    p.traitsBekannt.push(key);
    const t = TRAITS[key];
    if (typeof addNews === 'function') {
      const nm = (typeof displayName === 'function') ? displayName(p) : p.name;
      addNews('squad', 'Erkenntnis: ' + nm + ' — ' + t.name,
        (grund ? grund + ' ' : '') + t.text);
    }
    return true;
  };

  // ── Wirkungen: Entwicklung und Physis ─────────────────────────────────────
  // Multiplikator auf die Entwicklungsgeschwindigkeit
  window.traitDevFaktor = function (p) {
    let f = 1;
    if (hat(p, 'trainingsfleiss')) f *= 1.30;
    if (hat(p, 'trainingsfaul'))   f *= 0.68;
    const age = (p && p.age) || 25;
    // Früh- und Spätentwickler verschieben die Kurve, statt sie anzuheben
    if (hat(p, 'fruehentwickler')) f *= age <= 21 ? 1.35 : age <= 25 ? 1.0 : 0.55;
    if (hat(p, 'spaetentwickler')) f *= age <= 20 ? 0.62 : age <= 24 ? 1.0 : 1.45;
    return f;
  };
  // Multiplikator auf das Verletzungsrisiko
  window.traitVerletzungsFaktor = function (p) {
    let f = 1;
    if (hat(p, 'verletzungsanfaellig')) f *= 1.85;
    if (hat(p, 'unverwuestlich'))       f *= 0.45;
    if (hat(p, 'vorbildprofi'))         f *= 0.85;
    return f;
  };
  // Multiplikator auf die Ausfalldauer
  window.traitHeilFaktor = function (p) {
    let f = 1;
    if (hat(p, 'schnellheiler')) f *= 0.65;
    if (hat(p, 'vorbildprofi'))  f *= 0.90;
    return f;
  };
  // Multiplikator auf den Konditionsverbrauch in der Engine
  window.traitKondFaktor = function (p) {
    let f = 1;
    if (hat(p, 'laufwunder'))        f *= 0.80;
    if (hat(p, 'konditionsschwach')) f *= 1.28;
    return f;
  };
  // Ab wann der altersbedingte Abbau einsetzt (Verschiebung in Jahren)
  window.traitAlterungsVerschiebung = function (p) {
    let v = 0;
    if (hat(p, 'vorbildprofi'))    v += 2;
    if (hat(p, 'fruehentwickler')) v -= 2;
    if (hat(p, 'spaetentwickler')) v += 1;
    return v;
  };

  // ── Anzeige ───────────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('trait-css')) return;
    const st = document.createElement('style'); st.id = 'trait-css';
    st.textContent = `.trait-chip{display:inline-block;font-size:9.5px;line-height:1.5;padding:1px 6px;
      border-radius:9px;margin:2px 3px 0 0;border:1px solid;white-space:nowrap}
    .trait-plus{color:var(--accent,#3fb950);border-color:rgba(63,185,80,.45);background:rgba(63,185,80,.10)}
    .trait-minus{color:#f85149;border-color:rgba(248,81,73,.45);background:rgba(248,81,73,.10)}
    .trait-mix{color:var(--gold,#f2c14e);border-color:rgba(242,193,78,.45);background:rgba(242,193,78,.10)}`;
    document.head.appendChild(st);
  }
  // HTML-Schnipsel mit den sichtbaren Eigenschaften eines Spielers
  window.traitChips = function (p, maxAnzahl) {
    const keys = sichtbare(p);
    if (!keys.length) return '';
    css();
    return keys.slice(0, maxAnzahl || 99).map(k => {
      const t = TRAITS[k];
      return '<span class="trait-chip trait-' + t.art + '" title="' +
        String(t.text).replace(/"/g, '&quot;') + '">' + t.name + '</span>';
    }).join('');
  };

  // ── Vergabe an bestehende und neue Spieler ────────────────────────────────
  // Marktspieler bekommen ihre Eigenschaften bei der Erzeugung.
  if (typeof window.generateMarketPlayer === 'function') {
    const _gen = window.generateMarketPlayer;
    window.generateMarketPlayer = function () {
      const p = _gen.apply(this, arguments);
      try { vergib(p); } catch (e) {}
      return p;
    };
    try { generateMarketPlayer = window.generateMarketPlayer; } catch (e) {}
  }
  // Alles, was schon im Spielstand liegt (Kader, Markt, Ablösefreie), wird
  // einmalig nachgerüstet — sonst hätten Bestandsspieler nie Charakter.
  window.traitsNachruesten = function () {
    let n = 0;
    const durch = liste => (liste || []).forEach(p => {
      if (p && p.ovr && !Array.isArray(p.traits)) { vergib(p); n++; }
    });
    try { durch(typeof SQUAD !== 'undefined' ? SQUAD : []); } catch (e) {}
    try { durch(typeof MARKET !== 'undefined' && MARKET ? MARKET.players : []); } catch (e) {}
    try { durch(CLUB && CLUB.freeAgents); } catch (e) {}
    try { durch(CLUB && CLUB.youthPlayers); } catch (e) {}
    return n;
  };
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.traitsNachruesten(); } catch (e) {} }, 1200);
  });

  console.log('%c[Traits v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— ' + SCHLUESSEL.length + ' Eigenschaften, Kern mit Vergabe, Aufdeckung und Anzeige');
})();