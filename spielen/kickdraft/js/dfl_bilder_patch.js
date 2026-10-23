/* ═══════════════════════════════════════════════════════════════════════════
   DFL · BILDER STATT TEXT  ·  v1   (D76, freigegeben 2026-10-10: „arbeite alles in die App ein“;
   Vorschau spiel/dfl_bilder_vorschau.html, Teil „Weniger lesen“, offene Fragen = Vorschlag der Vorschau)
   ─────────────────────────────────────────────────────────────────────────
   Lange Meldungen und Erklärsätze werden Karten mit Zahlen, Balken und Symbolen:
     1  Spieltag-Karte im Postfach: Ergebnis mit Wappen, Zuschauer (Ring), Tickets, Merch, Moral ▲▼ bzw. Platz – eine Karte je
        Spieltag statt „Sieg: …“ + „Stimmung steigt“ (Frage 1: ja; ≈ 55 Einzelmeldungen je Saison → 26 Karten + Testspiele)
     2  „Aufstellung angepasst“ / „Zurück in der Elf“: Gesichter, Grund (Wochen, Sperre, Streik), Stärke-Verlust, Rückkehr
     3  „Stimmung im Kader“: Moral-Skala mit den Unzufriedenen, je Spieler Stufe, Wert-Abschlag und Knopf (Traden/Aufstellen) –
        statt Unzufrieden/Trade-Wunsch/Streik je Spieler (Meldungen + Warnungen)
     6  Eigentümer: Ampel (Kürzung · Zuschuss), drei Ringe (Gewinn/Erfolg/Fans, Strichstärke = Gewicht), Ergebnis gegen Plan
     7  Cap-Untergrenze: 4-Saisons-Balken (gezahlt, Prognose, Lücke, Soll) statt zwei Absätzen
     8  Saisonplan: Einnahmen und Ausgaben als zwei Balken (Postfach)
     9  Trainingsgruppe: drei Ringe (Development Squad 80 %, ohne Stammplatz 40 %, Mentor +10 %)
     10 Trade-Anfrage: Tausch-Karte (links du, rechts sie, Gesichter), Wert-Waage, Uhr bis KW …; die doppelte Meldung entfällt
     11 Trades der KI: Wappen ⇄ Wappen, Spieler als Positionsmarke + Stärke
     14 Verlorenes Jahr / Potenzial-Revision: Einsatz-Balken und Potenzial ▲▼ (Potenzial nur sichtbar, D103 – nie die echte Zahl)
     +  Verletzung und Rückkehr (D102 kam nach der Vorschau, ≈ 27 Meldungen je Saison): Wochen, verpasste Spieltage, Rückkehr,
        Rückstand als Kacheln, Medizin als Marke, Knopf „Verletztenliste“ solange möglich; „Wieder fit“ entfällt neben „Zurück: …“
     Erklärsätze, die man braucht, liegen hinter einem Info-Knopf (Frage 2: ⓘ statt streichen; info_cards_patch.js).
   Die Meldungen bleiben im Spielstand (CLUB.news: Titel und Text unverändert – Zeitung und „Simulieren bis …“ lesen sie);
   Karten-Daten hängen als `karte` an der Meldung (addNews mit 4. Argument oder hier beim Anlegen erkannt), alte Spielstände
   bekommen die Karte aus dem Text. Gezeichnet wird nur im Postfach (buildPostfachItems, äußerster Wrapper).
   Nicht hier: Kurz erklärt + Sponsorenwahl (D106–D109), Anlagen/Finanzseite (D75), Talent-Karte im Scouting (D78).
   API: DFLBilder.karteVon(news) · .karteHtml(karte, news) · .stimmungItem() · .tauschKarte(anfrage) · .traden(id) · .aufstellen(id)
        · .eignerHtml() · .untergrenzeHtml() · .CFG · .STAND
   Lädt nach dfl_oberflaeche_patch.js (Positionsmarken), vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const DOM = typeof document !== 'undefined';
  const CFG = {
    aus: false,                          // Messschalter: Postfach und Verein wie vorher
    spieltagHinweisWeg: true,            // „Spieltag – Diese Woche steht ein Spiel an“: Haupt-Button und Office-Kachel sagen es schon
    stufen: { unhappy: ['unzufrieden', 'mood-sad', 'mittel'], wants_out: ['will weg', 'plane-departure', 'mittel'], strike: ['Streik', 'hand-stop', 'schlecht'] },
    zonen: [[0, 30, 'streik'], [30, 45, 'wunsch'], [45, 62, 'unz'], [62, 100, 'ok']],     // contracts_patch.js DISCONTENT.enter
    wert: { unhappy: 0.90, wants_out: 0.75, strike: 0.60 },                                 // DISCONTENT.discount
    spieltage: 26
  };
  const STAND = { karten: 0, moralZusammen: 0, alteKarten: 0 };
  const dfl = () => !CFG.aus && typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zahl = (x, n) => Number(x || 0).toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  const ti = (n, kl) => `<i class="ti ti-${n}${kl ? ' ' + kl : ''}" aria-hidden="true"></i>`;
  const O = () => W.DFLOberflaeche || null;
  const posMarke = (x, opt) => (O() ? O().posMarke(x, opt) : `<span class="pos-badge-sm">${esc(Array.isArray(x) ? x[0] : x && x.pos || x)}</span>`);
  const wappen = (id, kl) => `<span class="lg-crest ${kl || ''}" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true"></span>`;
  const ohneEmoji = s => (W.DFLKenney ? DFLKenney.ohne(s) : String(s == null ? '' : s));
  // ohne D104-Modul (Prüflauf): führende Zeichen vor dem ersten Buchstaben weg („😃 Stimmung steigt“ → „Stimmung steigt“)
  const kopfOhneEmoji = s => (W.DFLKenney ? DFLKenney.ohne(DFLKenney.teile(s).rest).trim() : String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim());
  // Geld in Kacheln: „3,11“ + „Mio €“ darunter, unter einer Million wie formatEuro („830.000 €“)
  const geldKachel = x => x >= 1e6 ? { gross: zahl(x / 1e6, x >= 1e7 ? 1 : 2), klein: 'Mio €' } : { gross: typeof formatEuro === 'function' ? formatEuro(x) : zahl(x) + ' €', klein: '' };
  const mio = x => zahl(x / 1e6, 1) + ' Mio €';
  function teams() { try { return LEAGUE.tiers.bundesliga.groups[0].teams; } catch (e) { return []; } }
  const teamVon = id => teams().find(t => t.id === id) || null;
  const teamNachName = n => teams().find(t => t.name === n) || null;
  const kuerzel = id => (O() ? O().kuerzel(id) : (W.DFLNamen && DFLNamen.kuerzel(id)) || '');
  const spieler = id => (id != null && typeof getPlayer === 'function' ? getPlayer(id) : null) || null;
  const kurz = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  function gesicht(p, kl) {
    if (O()) return O().gesicht(p, kl);
    try { return `<span class="ko-gesicht ${kl || ''}">${W.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p) : ''}</span>`; } catch (e) { return ''; }
  }
  const ligaPlatz = id => (O() ? O().ligaPlatz(id) : null);
  function ring(anteil, kl, text) {
    const r = 15.9155, p = Math.max(0, Math.min(1, anteil || 0));
    return `<svg class="bk-ring${kl ? ' ' + kl : ''}" viewBox="0 0 36 36" aria-hidden="true"><circle class="bk-ring-grund" cx="18" cy="18" r="${r}"/>` +
      `<circle class="bk-ring-wert" cx="18" cy="18" r="${r}" stroke-dasharray="${(p * 100).toFixed(1)} 100" transform="rotate(-90 18 18)"/>` +
      (text != null ? `<text x="18" y="21.5" text-anchor="middle">${esc(text)}</text>` : '') + '</svg>';
  }
  const pfeil = d => d > 0 ? '▲' + d : d < 0 ? '▼' + Math.abs(d) : '±0';
  const info = (key, titel, text) => { if (typeof W.infoKarteSetzen === 'function') W.infoKarteSetzen(key, titel, text); return typeof W.infoBtn === 'function' ? W.infoBtn(key) : ''; };

  // ── 1) Meldungen erkennen und Karten-Daten anhängen ─────────────────────
  const RE_ERG = /^(Sieg|Niederlage|Unentschieden|Testspiel): (.+?) (\d+):(\d+) (.+)$/;
  const RE_MORAL = /^Stimmung (?:steigt|gedämpft)$/;
  const RE_STIMMUNG = /^(Streik|Trade-Wunsch|Unzufrieden): /;
  const RE_KITRADE_T = /^Trade: /;          // „🔁 Trade: A ↔ B“ – D104 nimmt das ↔ aus dem Titel, entscheidend ist der Text
  const RE_JAHR = /^(Verlorenes Jahr|Potenzial-Revision): (.+)$/;
  const RE_VERL = /^(Schwere Verletzung|Verletzung): (.+?) · (.+)$/;       // dfl_medizin_patch.js (D102)
  const RE_ZURUECK = /^Zurück: (.+)$/;
  const RE_FIT = /^Wieder fit: (.+)$/;
  // Zuschauer und Einnahmen aus dem Text („42.100 von 42.100 Zuschauern (100% Auslastung) — Tickets 3,11 Mio €, Merchandise 1,36 Mio €.“)
  function geldAus(s) {
    const m = /([\d.,]+)\s*(Mio\s*)?€/.exec(s || ''); if (!m) return null;
    return m[2] ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) * 1e6 : parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  }
  function torAusText(k, t) {
    const a = /([\d.]+) von ([\d.]+) Zuschauern \((\d+)\s*% Auslastung\)/.exec(t || '');
    if (a) { k.zuschauer = +a[1].replace(/\./g, ''); k.plaetze = +a[2].replace(/\./g, ''); k.fuell = +a[3] / 100; }
    const tk = /Tickets ([\d.,]+\s*(?:Mio\s*)?€)/.exec(t || ''), me = /Merchandise ([\d.,]+\s*(?:Mio\s*)?€)/.exec(t || '');
    if (tk) k.tickets = geldAus(tk[1]);
    if (me) k.merch = geldAus(me[1]);
    return k;
  }
  function spielKarteAusText(n) {
    const m = RE_ERG.exec(kopfOhneEmoji(n.title)); if (!m) return null;
    const geg = teamNachName(m[5]);
    const k = { typ: 'spiel', art: m[1] === 'Testspiel' ? 'test' : 'liga', nr: n.matchday || 0, heim: !/\bbei\b/.test(n.text || ''),
      geg: geg ? geg.id : null, gegName: m[5], tore: [+m[3], +m[4]] };
    return torAusText(k, n.text);
  }
  function moralAus(t) { const m = /(steigt|sinkt) um (\d+)\. Teammoral jetzt (\d+)/.exec(t || ''); return m ? { d: (m[1] === 'steigt' ? 1 : -1) * +m[2], tm: +m[3] } : null; }
  function planKarte(bd) {
    if (!bd || !bd.income || !bd.cost) return null;
    const i = bd.income, c = bd.cost, extra = {};
    // weitere Kosten (Unterhalt der Anlagen, D75: c.anlagen, dazu derselbe Betrag als c.dflUnterhalt) als eigene Abschnitte – nur, was
    // c.total noch nicht über Kader + Betrieb enthält (Pläne von vor D75 führen c.anlagen, zählen es aber im Betrieb)
    let rest = c.total != null ? c.total - (c.wages || 0) - (c.running || 0) : Infinity;
    Object.keys(c).forEach(k => {
      if (['total', 'wages', 'running', 'dflUnterhalt'].indexOf(k) >= 0 || typeof c[k] !== 'number' || c[k] <= 0 || c[k] > rest + 1) return;
      extra[k] = c[k]; rest -= c[k];
    });
    return { typ: 'plan', saison: typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season : null,
      ein: { tv: i.tv || 0, tickets: (i.seasonTickets || 0) + (i.matchday || 0), merch: i.merch || 0, sponsoren: (i.sponsors || 0) + (i.banner || 0) + (i.klausel || 0), teilung: i.teilung || 0 },
      aus: Object.assign({ kader: c.wages || 0, betrieb: c.running || 0 }, extra), ergebnis: bd.fixBalance || 0, kasse: CLUB.budget || 0 };
  }
  function planKarteAusText(n) {
    const t = n.text || '', g = re => { const m = re.exec(t); return m ? geldAus(m[1]) : 0; };
    const vz = re => { const m = re.exec(t); if (!m) return 0; const v = geldAus(m[1].replace(/^[−-]/, '')) || 0; return /^[−-]/.test(m[1]) ? -v : v; };
    if (!/Einnahmen/.test(t)) return null;
    return { typ: 'plan', saison: n.season, ein: { tv: g(/TV ([\d.,]+ Mio €)/), tickets: g(/Tickets ([\d.,]+ Mio €)/), merch: g(/Merch ([\d.,]+ (?:Mio )?€)/),
      sponsoren: g(/Sponsoren ([\d.,]+ (?:Mio )?€)/), teilung: vz(/Ticketteilung ([+−-]?[\d.,]+ (?:Mio )?€)/) },
      aus: { kader: g(/Kader ([\d.,]+ Mio €)/), betrieb: g(/Betrieb ([\d.,]+ Mio €)/) }, ergebnis: vz(/Ergebnis ([+−-][\d.,]+ (?:Mio )?€)/), kasse: g(/Kasse jetzt ([\d.,]+ (?:Mio )?€)/) };
  }
  function jahrKarte(n) {
    const m = RE_JAHR.exec(kopfOhneEmoji(n.title)); if (!m) return null;
    const p = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(q => ((q.firstName || '') + ' ' + q.name).trim() === m[2].trim());
    const t = n.text || '', e = /nur (\d+) Einsätze/.exec(t), o = /Ø ([\d,]+)(?: aus (\d+) Spielen)?/.exec(t);
    return { typ: 'jahr', art: m[1] === 'Verlorenes Jahr' ? 'verloren' : /gesenkt/.test(t) ? 'ab' : 'auf', pid: p ? p.id : null, name: m[2].trim(),
      einsaetze: e ? +e[1] : o && o[2] ? +o[2] : null, note: o ? o[1] : null };
  }
  // Verletzung und Rückkehr (D102): alles steht im Text – Wochen, verpasste Spieltage, Rückkehr, Rückstand, Medizin
  function kaderNachName(nm, typ) {
    const sq = typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) ? SQUAD : [];
    const passt = sq.filter(q => kurz(q) === nm || ((q.firstName || '') + ' ' + q.name).trim() === nm);
    return (typ && passt.find(q => q.injuryType === typ)) || passt[0] || null;
  }
  const dez = s => parseFloat(String(s).replace(',', '.'));
  function verletzungKarte(n) {
    const m = RE_VERL.exec(kopfOhneEmoji(n.title)); if (!m) return null;
    const t = n.text || '', p = kaderNachName(m[2], m[3]);
    const g = re => { const x = re.exec(t); return x ? x[1] : null; };
    const tage = /verpasst Spieltag (\d+)(?:–(\d+))?/.exec(t), reha = /Rückstand −([\d,]+): mit Einsatz etwa (\d+) Wochen? bis (\d+)/.exec(t);
    const med = /Medizin Stufe (\d+): (?:(eine Woche|\d+ Wochen) kürzer|Der Verdacht auf (.+?) hat sich nicht bestätigt)/.exec(t);
    const zur = g(/Zurück zu Spieltag (\d+)/), wann = g(/^(Im Spiel|Im Testspiel|Im Training|Erneut) verletzt/);
    return { typ: 'verletzung', schwer: m[1] === 'Schwere Verletzung', pid: p ? p.id : null, name: m[2], art: m[3],
      wann: wann ? wann.replace(/^Im /, 'im ').replace(/^Erneut$/, 'erneut') : '', wochen: +(g(/Fällt (\d+) Wochen? aus/) || 0),
      tage: tage ? [+tage[1], +(tage[2] || tage[1])] : [], zurueck: zur ? +zur : null,
      nachPause: /nach der Sommerpause/.test(t), nachSaison: /nach dem letzten Spieltag/.test(t),
      rueckstand: reha ? dez(reha[1]) : 0, mit: reha ? +reha[2] : 0, ziel: reha ? +reha[3] : null,
      med: med ? { stufe: +med[1], kuerzer: med[2] ? (med[2] === 'eine Woche' ? 1 : parseInt(med[2], 10)) : 0, verdacht: med[3] || null } : null,
      rest: /zurückbleiben/.test(t) };
  }
  function rueckkehrKarte(n) {
    const m = RE_ZURUECK.exec(kopfOhneEmoji(n.title)), t = n.text || '';
    if (!m || !/wieder einsatzfähig/.test(t)) return null;
    const p = kaderNachName(m[1]);
    const reha = /Rückstand −([\d,]+), mit Einsatz in etwa (\d+) Wochen? wieder bei (\d+)/.exec(t);
    const rest = /Ein Rest bleibt: −(\d+) Stärke(?:, Potenzial −(\d+))?/.exec(t);
    return { typ: 'rueckkehr', pid: p ? p.id : null, name: m[1], rueckstand: reha ? dez(reha[1]) : 0, mit: reha ? +reha[2] : 0, ziel: reha ? +reha[3] : null,
      rest: rest ? { ovr: +rest[1], pot: rest[2] ? +rest[2] : null } : null };
  }
  // Karte zu einer Meldung (gespeichert oder aus dem Text)
  function karteVon(n) {
    if (!n) return null;
    if (n.karte && n.karte.typ) return n.karte;
    const titel = kopfOhneEmoji(n.title);
    if (n.category === 'match' && RE_ERG.test(titel)) return spielKarteAusText(n);
    if (/^Saisonplan steht/.test(titel)) return planKarteAusText(n);
    if (RE_KITRADE_T.test(titel) && O() && O().kiTradeTeile(String(n.text || '').replace(/\.$/, ''))) return { typ: 'kitrade', text: String(n.text || '').replace(/\.$/, '') };
    if (RE_JAHR.test(titel)) return jahrKarte(n);
    if (RE_VERL.test(titel)) return verletzungKarte(n);
    if (RE_ZURUECK.test(titel)) return rueckkehrKarte(n);
    return null;
  }

  // Während der Buchung eines eigenen Ligaspiels/Testspiels: Ergebnis-Meldung merken, Moral-Meldung hineinlegen
  let sammeln = null;
  {
    const _orig = W.addNews;
    if (typeof _orig === 'function') {
      W.addNews = function (kat, titel, text, extra) {
        if (!dfl()) return _orig.call(this, kat, titel, text);
        const t0 = kopfOhneEmoji(titel);
        if (sammeln && sammeln.ergebnis && RE_MORAL.test(t0)) {
          const m = moralAus(text);
          if (m) { sammeln.ergebnis.karte.moral = m; STAND.moralZusammen++; return; }
        }
        const vorher = Array.isArray(CLUB.news) ? CLUB.news[0] : null;
        const r = _orig.call(this, kat, titel, text);
        try {
          const n = Array.isArray(CLUB.news) ? CLUB.news[0] : null;
          if (n && n !== vorher) {
            if (extra && extra.karte) n.karte = anreichern(extra.karte);
            else if (sammeln && kat === 'match' && RE_ERG.test(t0)) {
              const k = spielKarteAusText(n);
              if (k) { Object.assign(k, sammeln.fx); n.karte = k; sammeln.ergebnis = n; }
            } else if (/^Saisonplan steht/.test(t0)) n.karte = planKarte(CLUB._budgetBreakdown);
            else if (RE_JAHR.test(t0)) n.karte = jahrKarte(n);
            if (n.karte) STAND.karten++;
          }
        } catch (e) { console.warn('[DFL-Bilder] Meldung', e); }
        return r;
      };
      try { addNews = W.addNews; } catch (e) { /* window reicht */ }
    }
  }
  // Aufstellungs-Meldung (dfl_engine_patch.js liefert IDs): Namen, Positionen, Stärke auf dem Platz, Wochen und Rückkehr festhalten
  function anreichern(k) {
    if (!k || k.typ !== 'aufstellung') return k;
    const slots = (typeof FORMATIONS !== 'undefined' && typeof CLUB !== 'undefined' && FORMATIONS[CLUB.formation]) || [];
    const P = W.DFLPosition;
    const bild = (id, slot) => {
      const p = spieler(id); if (!p) return null;
      const s = slot ? slots.find(x => x.id === slot) : null, platz = s && P ? P.platz(s) : null;
      return { id, n: kurz(p), pos: (p.positions && p.positions.length ? p.positions : [p.pos]).slice(0, 3), ovr: p.ovr,
        wirk: platz && P ? P.wirksam(p, platz) : p.ovr, platz };
    };
    k.liste = (k.liste || []).map(x => {
      const raus = bild(x.raus, x.slot), rein = bild(x.rein, x.slot), p = spieler(x.raus);
      const e = { grund: x.grund, raus, rein };
      if (p && x.grund === 'verletzt') {
        e.wochen = p.injuryWeeks || 0;
        try { if (W.DFLMedizin && DFLMedizin.verpasst) e.zurueck = DFLMedizin.verpasst(p).zurueck; } catch (err) { /* ohne Prognose */ }
      } else if (p && x.grund === 'gesperrt') { e.spiele = p.suspendedGames || 0; e.zurueck = (LEAGUE.matchday || 0) + (p.suspendedGames || 0) + 1; }
      return e;
    });
    return k;
  }
  {
    const _orig = W.processFixtureResult;
    if (typeof _orig === 'function') {
      W.processFixtureResult = function () {
        const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
        if (!dfl() || !fx || (fx.type !== 'liga' && fx.type !== 'friendly')) return _orig.apply(this, arguments);
        const s = sammeln = { fx: { geg: fx.opponentId, heim: typeof FCM_IS_HOME !== 'undefined' ? !!FCM_IS_HOME : true, platzVorher: fx.type === 'liga' ? ligaPlatz('fcm') : null }, ergebnis: null };
        try { return _orig.apply(this, arguments); }
        finally {
          sammeln = null;
          try { if (s.ergebnis && fx.type === 'liga') s.ergebnis.karte.platz = ligaPlatz('fcm'); } catch (e) { /* Platz ist Beiwerk */ }
        }
      };
      try { processFixtureResult = W.processFixtureResult; } catch (e) { /* window reicht */ }
    }
  }

  // ── 2) Karten zeichnen ───────────────────────────────────────────────────
  const KARTE_MARKE = { s: ['S', 'gut'], u: ['U', 'mittel'], n: ['N', 'schlecht'] };
  function markeHtml(m) {
    if (KARTE_MARKE[m]) return `<span class="km km-${KARTE_MARKE[m][1]} km-fuellt bk-erg-marke" aria-hidden="true"><b>${KARTE_MARKE[m][0]}</b></span>`;
    const [ic, art] = m.split(':');
    return `<span class="km km-${art || 'info'} km-fuellt" aria-hidden="true">${ti(ic)}</span>`;
  }
  function spielHtml(k) {
    const eig = k.tore[0], geg = k.tore[1], erg = eig > geg ? 's' : eig < geg ? 'n' : 'u';
    const heimId = k.heim ? 'fcm' : k.geg, gastId = k.heim ? k.geg : 'fcm';
    const th = k.heim ? eig : geg, tg = k.heim ? geg : eig;
    const team = (id, rechts) => `<span class="bk-team${rechts ? ' rechts' : ''}">${rechts ? '' : (id ? wappen(id, 'bk-wappen') : '')}<b>${esc(id ? kuerzel(id) || (teamVon(id) || {}).name || '' : (k.gegName || ''))}</b>${rechts ? (id ? wappen(id, 'bk-wappen') : '') : ''}</span>`;
    const werte = [];
    if (k.heim && k.zuschauer) {
      const voll = k.fuell >= 0.995;
      werte.push(`<div class="bk-kachel">${ring(k.fuell, voll ? 'gut' : k.fuell >= 0.8 ? 'mittel' : 'schlecht')}<b>${zahl(k.zuschauer)}</b><small>${voll ? 'ausverkauft' : Math.round(k.fuell * 100) + ' % voll'}</small></div>`);
      if (k.tickets != null) { const g = geldKachel(k.tickets); werte.push(`<div class="bk-kachel">${ti('ticket')}<b>${g.gross}</b><small>${g.klein ? g.klein + ' ' : ''}Tickets</small></div>`); }
      if (k.merch != null) { const g = geldKachel(k.merch); werte.push(`<div class="bk-kachel">${ti('shirt')}<b>${g.gross}</b><small>${g.klein ? g.klein + ' ' : ''}Merch</small></div>`); }
    }
    if (k.art === 'liga' && k.platz) {
      const d = k.platzVorher ? k.platzVorher - k.platz : 0;
      werte.push(`<div class="bk-kachel${d > 0 ? ' gut' : d < 0 ? ' schlecht' : ''}">${ti('trophy')}<b>${k.platz}.</b><small>Platz${d ? ' ' + pfeil(d) : ''}</small></div>`);
    }
    if (k.moral) werte.push(`<div class="bk-kachel${k.moral.d > 0 ? ' gut' : ' schlecht'}">${ti(k.moral.d > 0 ? 'mood-smile' : 'mood-sad')}<b>${pfeil(k.moral.d)}</b><small>Moral ${k.moral.tm}</small></div>`);
    return { marke: erg, titel: (k.art === 'test' ? 'Testspiel' : `Spieltag ${k.nr}`) + ` · ${k.heim ? 'Heim' : 'Auswärts'}`,
      html: `<div class="bk-erg">${team(heimId)}<span class="bk-stand ${erg}"><b>${th}</b><i>:</i><b>${tg}</b></span>${team(gastId, true)}</div>` +
        (werte.length ? `<div class="bk-kacheln n${werte.length}">${werte.join('')}</div>` : '') };
  }
  const GRUND = { verletzt: ['bandage', 'schlecht'], gesperrt: ['ban', 'schlecht'], Streik: ['hand-stop', 'schlecht'], Verletztenliste: ['first-aid-kit', 'schlecht'],
    'Development Squad': ['plant-2', 'info'], zurück: ['arrow-back-up', 'gut'] };
  function aufstellungHtml(k) {
    const liste = k.liste || [];
    const sp = (b, rolle, e) => {
      if (!b) return `<div class="bk-sp leer">${ti('user-off')}<small>niemand</small></div>`;
      const p = spieler(b.id) || { id: b.id, name: b.n, pos: b.pos[0], positions: b.pos };
      const g = GRUND[e.grund] || ['info-circle', 'info'];
      const unter = rolle === 'raus'
        ? (e.grund === 'verletzt' ? `${ti('bandage')}${e.wochen ? e.wochen + (e.wochen === 1 ? ' Woche' : ' Wochen') : 'verletzt'}`
          : e.grund === 'gesperrt' ? `${ti('ban')}gesperrt${e.spiele ? ' · ' + e.spiele + (e.spiele === 1 ? ' Spiel' : ' Spiele') : ''}`
            : e.grund === 'zurück' ? `${ti('arrow-down-right')}auf die Bank` : `${ti(g[0])}${esc(e.grund)}`)
        : e.grund === 'zurück' ? `${ti('arrow-back-up')}wieder da` : 'springt ein';
      // auf fremdem Platz (D81) oder mit Rückstand (D102): groß die wirksame Stärke, klein die Rechnung wie in der Aufstellung („83 −8 als AV“)
      const d = rolle === 'rein' && b.wirk != null ? b.ovr - b.wirk : 0;
      const rechnung = d > 0 ? `<small class="bk-sp-abz">${b.ovr} <em class="dfl-abz ${d <= 2 ? 'gelernt' : d >= 24 ? 'torwart' : 'fremd'}">−${d}</em>${b.platz ? ' als ' + esc(b.platz) : ''}</small>` : '';
      return `<div class="bk-sp ${rolle}">${gesicht(p, 'bk-gesicht')}${posMarke(b.pos)}<b>${esc(b.n)}</b><span class="bk-sp-st">${rolle === 'rein' && b.wirk != null ? b.wirk : b.ovr}</span>
        ${rechnung}<small class="kz-${rolle === 'raus' && e.grund !== 'zurück' ? g[1] : 'neutral'}">${unter}</small></div>`;
    };
    const trotz = liste.filter(e => e.raus && e.rein && e.raus.id === e.rein.id);
    const echte = liste.filter(e => !(e.raus && e.rein && e.raus.id === e.rein.id));
    const zeilen = echte.slice(0, 4).map(e => {
      const verlust = e.raus && e.rein && e.grund !== 'zurück' ? e.rein.wirk - e.raus.ovr : null;
      const fuss = [];
      if (verlust) fuss.push(`<span class="bk-chip ${verlust < 0 ? 'schlecht' : 'gut'}">${verlust > 0 ? '+' : '−'}${Math.abs(verlust)} Stärke</span>`);
      if (e.zurueck && e.raus) fuss.push(`<span class="bk-chip">${ti('refresh')}${esc(e.raus.n.split(' ').pop())} zurück: Spieltag ${e.zurueck}</span>`);
      const [links, rechts] = e.grund === 'zurück' ? [sp(e.raus, 'raus', e), sp(e.rein, 'rein', e)] : [sp(e.raus, 'raus', e), sp(e.rein, 'rein', e)];
      return `<div class="bk-wechsel">${links}<span class="bk-pfeil">${ti('arrow-right')}</span>${rechts}</div>${fuss.length ? `<div class="bk-fuss">${fuss.join('')}</div>` : ''}`;
    }).join('') + (echte.length > 4 ? `<div class="bk-fuss"><span class="bk-chip">und ${echte.length - 4} weitere</span></div>` : '');
    const sammel = trotz.length ? `<div class="bk-sammel">${ti('alert-triangle')}<b>${trotz.length} ${trotz.length === 1 ? 'Ausfall spielt' : 'Ausfälle spielen'} trotzdem</b>
      <span class="bk-sammel-ico">${trotz.map(e => `<span title="${esc(e.raus.n)}: ${esc(e.grund)}">${ti((GRUND[e.grund] || ['info-circle'])[0])}</span>`).join('')}</span><small>zu wenige Einsatzfähige</small></div>` : '';
    return { marke: k.art === 'zurueck' ? 'arrow-back-up:gut' : 'arrows-exchange:mittel', titel: k.art === 'zurueck' ? 'Zurück in der Elf' : 'Aufstellung angepasst', html: zeilen + sammel };
  }
  const PLAN_EIN = [['tv', 'TV', 'f-tv'], ['tickets', 'Tickets', 'f-tickets'], ['merch', 'Merch', 'f-merch'], ['sponsoren', 'Sponsoren', 'f-spons']];
  const PLAN_AUS = { kader: ['Kader', 'f-kader'], betrieb: ['Betrieb', 'f-betrieb'], anlagen: ['Unterhalt', 'f-anlagen'], unterhalt: ['Unterhalt', 'f-anlagen'], amort: ['Abschreibung', 'f-anlagen'] };
  function planHtml(k) {
    const ein = PLAN_EIN.map(([key, label, f]) => ({ label, f, v: Math.max(0, k.ein[key] || 0) })).filter(x => x.v > 0);
    const aus = Object.keys(k.aus).map(key => ({ label: (PLAN_AUS[key] || [key])[0], f: (PLAN_AUS[key] || [0, 'f-anlagen'])[1], v: Math.max(0, k.aus[key] || 0) })).filter(x => x.v > 0);
    const sE = ein.reduce((s, x) => s + x.v, 0) + Math.min(0, k.ein.teilung || 0), sA = aus.reduce((s, x) => s + x.v, 0);
    const skala = Math.max(sE, sA, 1);
    // Beschriftung nur, wenn sie in den Abschnitt passt (Balken am Handy ≈ 170 px, ≈ 5,6 px je Zeichen)
    const passt = (anteil, text) => anteil * 170 >= text.length * 5.6 + 4;
    const bahn = (teile, rest) => `<span class="bk-pl-bahn">${teile.map(x => `<i class="${x.f}" style="width:${(x.v / skala * 100).toFixed(1)}%" title="${esc(x.label)} ${mio(x.v)}">${passt(x.v / skala, x.label) ? esc(x.label) : ''}</i>`).join('')}${rest > 0 ? `<i class="bk-pl-luecke" style="width:${(rest / skala * 100).toFixed(1)}%" title="Überschuss ${mio(rest)}">${passt(rest / skala, '+' + zahl(rest / 1e6)) ? '+' + zahl(rest / 1e6) : ''}</i>` : ''}</span>`;
    const leg = ein.concat(aus).map(x => `<span><i class="${x.f}"></i>${esc(x.label)} <b>${zahl(x.v / 1e6, 1)}</b></span>`).join('');
    return { marke: 'chart-bar:info', titel: `Saisonplan ${typeof seasonYearLabel === 'function' && k.saison ? seasonYearLabel(k.saison) : ''}`.trim(),
      html: `<div class="bk-plan"><div class="bk-pl-zeile"><span>Einnahmen</span>${bahn(ein, 0)}<b>${zahl(sE / 1e6, 1)}</b></div>
        <div class="bk-pl-zeile"><span>Ausgaben</span>${bahn(aus, sE - sA)}<b>${zahl(sA / 1e6, 1)}</b></div>
        <div class="bk-legende">${leg}<span class="bk-mio">Mio €</span></div>
        <div class="bk-fazit ${k.ergebnis >= 0 ? 'gut' : 'schlecht'}">${ti('coin')}<b>${k.ergebnis >= 0 ? '+' : '−'}${zahl(Math.abs(k.ergebnis) / 1e6, 1)} Mio € geplant</b><small>Kasse ${mio(k.kasse)}</small></div></div>` };
  }
  function jahrHtml(k) {
    const p = k.pid ? spieler(k.pid) : null, scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const pot = p && typeof potentialRange === 'function' ? potentialRange(p, scout) : null;     // nur sichtbar (D103)
    const potTxt = pot ? (pot.exact || pot.lo === pot.hi ? String(pot.lo) : pot.lo + '–' + pot.hi) : '';
    const ab = k.art !== 'auf';
    const e = k.einsaetze != null ? Math.min(CFG.spieltage, k.einsaetze) : null;
    return { marke: ab ? 'trending-down:schlecht' : 'trending-up:gut', titel: (k.art === 'verloren' ? 'Verlorenes Jahr: ' : 'Potenzial: ') + (p ? kurz(p) : k.name),
      html: `<div class="bk-jahr">${p ? gesicht(p, 'bk-gesicht') : ''}<div class="bk-jahr-mitte">
        ${e != null ? `<div class="bk-jahr-zeile mit-bahn"><span>Einsätze</span><span class="k-bahn bk-jahr-bahn"><i class="k-fuell" style="width:${(e / CFG.spieltage * 100).toFixed(0)}%"></i></span><b>${e}<small>/${CFG.spieltage}</small></b></div>` : ''}
        ${k.note ? `<div class="bk-jahr-zeile"><span>Ø Note</span><b>${esc(k.note)}</b></div>` : ''}</div>
        <span class="bk-jahr-pot ${ab ? 'ab' : 'auf'}">${ti(ab ? 'arrow-down' : 'arrow-up')}<b>${potTxt ? 'Pot ' + esc(potTxt) : 'Potenzial'}</b><small>${ab ? (k.art === 'verloren' ? 'mit Einsätzen aufholbar' : 'gesenkt') : 'angehoben'}</small></span></div>` };
  }
  // Kopf der Verletzungs-Karten: Gesicht, Marke, Stärke, Art und Anlass
  function vlKopf(p, unter) {
    return `<div class="bk-vl-kopf">${p ? gesicht(p, 'bk-gesicht klein') : ''}${p ? posMarke(p) : ''}${p ? `<span class="bk-st-ovr">${p.ovr}</span>` : ''}<span class="bk-vl-unter">${unter}</span></div>`;
  }
  // Verletztenliste (DFLTraining, ab 4 Wochen): Knopf nur, solange er noch so lange ausfällt
  function vlKnopf(p) {
    const T = W.DFLTraining, c = (T && T.CFG && T.CFG.verletztenliste) || { abWochen: 4, mindestWochen: 4 };
    if (!p || !T || typeof T.aufVerletztenliste !== 'function') return '';
    if (p.verletztenliste) return `<span class="bk-chip">${ti('first-aid-kit')}auf der Verletztenliste</span>`;
    if (p.perspektiv || (p.injuryWeeks || 0) < c.abWochen) return '';
    return `<button class="pf-btn" onclick="DFLTraining.aufVerletztenliste('${esc(p.id)}')">${ti('first-aid-kit')}Verletztenliste</button>` +
      info('verletztenliste', 'Verletztenliste', `Ab ${c.abWochen} Wochen Ausfall: sein Kaderplatz wird frei, das Gehalt zählt weiter gegen den Cap. Zurück frühestens nach ${c.mindestWochen} Wochen.`);
  }
  function verletzungHtml(k, n) {
    const p = k.pid ? spieler(k.pid) : null, w = [];
    w.push(`<div class="bk-kachel schlecht">${ti('bandage')}<b>${k.wochen}</b><small>${k.wochen === 1 ? 'Woche' : 'Wochen'} Ausfall</small></div>`);
    const nT = k.tage.length ? k.tage[1] - k.tage[0] + 1 : 0;
    w.push(nT ? `<div class="bk-kachel">${ti('calendar-x')}<b>${k.tage[0] === k.tage[1] ? k.tage[0] : k.tage[0] + '–' + k.tage[1]}</b><small>${nT === 1 ? 'Spieltag' : 'Spieltage'} verpasst</small></div>`
      : `<div class="bk-kachel gut">${ti('calendar-check')}<b>0</b><small>Spieltage verpasst</small></div>`);
    // Rückkehr: Spieltag; nach der Sommerpause eigene Kachel; „nach dem letzten Spieltag“ sagen schon die verpassten Spieltage
    if (k.zurueck) w.push(`<div class="bk-kachel gut">${ti('arrow-back-up')}<b>${k.zurueck}.</b><small>Spieltag zurück</small></div>`);
    else if (k.nachPause) w.push(`<div class="bk-kachel schlecht">${ti('sun')}<b>Sommer</b><small>zurück nach der Pause</small></div>`);
    if (k.rueckstand) w.push(`<div class="bk-kachel mittel">${ti('trending-up')}<b>−${zahl(k.rueckstand, k.rueckstand % 1 ? 1 : 0)}</b><small>Rückstand danach</small></div>`);
    const fuss = [];
    if (k.rueckstand && k.ziel) fuss.push(`<span class="bk-chip">${ti('clock')}mit Einsatz ≈ ${k.mit} ${k.mit === 1 ? 'Woche' : 'Wochen'} bis ${k.ziel}</span>`);
    if (k.med && k.med.kuerzer) fuss.push(`<span class="bk-chip gut">${ti('first-aid-kit')}Medizin Stufe ${k.med.stufe}: −${k.med.kuerzer} ${k.med.kuerzer === 1 ? 'Woche' : 'Wochen'}</span>`);
    if (k.med && k.med.verdacht) fuss.push(`<span class="bk-chip gut">${ti('first-aid-kit')}kein ${esc(k.med.verdacht)} (Medizin ${k.med.stufe})</span>`);
    if (k.rest) fuss.push(`<span class="bk-chip mittel">${ti('alert-triangle')}es kann etwas bleiben</span>`);
    const vl = vlKnopf(p);
    return { marke: 'bandage:schlecht', titel: kopfOhneEmoji(n && n.title) || 'Verletzung',
      html: vlKopf(p, `${ti(k.schwer ? 'first-aid-kit' : 'bandage')}${esc(k.art)}${k.wann ? ' · ' + esc(k.wann) : ''}`) +
        `<div class="bk-kacheln n${w.length}">${w.join('')}</div>` + (fuss.length || vl ? `<div class="bk-fuss">${fuss.join('')}${vl}</div>` : '') };
  }
  function rueckkehrHtml(k) {
    const p = k.pid ? spieler(k.pid) : null, w = [`<div class="bk-kachel gut">${ti('circle-check')}<b>fit</b><small>einsatzfähig</small></div>`];
    if (k.rueckstand) {
      w.push(`<div class="bk-kachel mittel">${ti('trending-up')}<b>−${zahl(k.rueckstand, k.rueckstand % 1 ? 1 : 0)}</b><small>Rückstand</small></div>`);
      w.push(`<div class="bk-kachel">${ti('clock')}<b>${k.mit}</b><small>${k.mit === 1 ? 'Woche' : 'Wochen'} mit Einsatz bis ${k.ziel}</small></div>`);
    }
    if (k.rest) w.push(`<div class="bk-kachel schlecht">${ti('alert-triangle')}<b>−${k.rest.ovr}</b><small>Stärke bleibt weg</small></div>`);
    return { marke: 'arrow-back-up:gut', titel: 'Zurück: ' + (p ? kurz(p) : k.name),
      html: vlKopf(p, `${ti('arrow-back-up')}nach der Verletzung`) + `<div class="bk-kacheln n${w.length}">${w.join('')}</div>` };
  }
  function karteHtml(k, n) {
    if (!k) return null;
    if (k.typ === 'spiel' && k.tore) return spielHtml(k);
    if (k.typ === 'aufstellung') return aufstellungHtml(k);
    if (k.typ === 'plan' && k.ein) return planHtml(k);
    if (k.typ === 'kitrade' && O()) {
      const h = O().kiTradeHtml(k.text), t = O().kiTradeTeile(k.text);
      const ort = (id, name) => (id && O().ortName(id)) || name;
      return h ? { marke: 'arrows-exchange:info', titel: t ? `${ort(t.aId, t.a)} und ${ort(t.bId, t.b)} tauschen` : 'Trade in der Liga', html: h } : null;
    }
    if (k.typ === 'jahr') return jahrHtml(k);
    if (k.typ === 'verletzung') return verletzungHtml(k, n);
    if (k.typ === 'rueckkehr') return rueckkehrHtml(k);
    // D158: Pro Bowl (Aufgebot, Ergebnis) zeichnet dfl_ehrungen_patch.js
    if (k.typ === 'probowl' && W.DFLEhrungen && typeof DFLEhrungen.proBowlKarte === 'function') return DFLEhrungen.proBowlKarte(k);
    return null;
  }

  // ── 3) Stimmung im Kader ─────────────────────────────────────────────────
  const stufeVon = p => p.onStrike ? 'strike' : p.wantsOut ? 'wants_out' : p._dcStage === 'unhappy' ? 'unhappy' : (p._dcStage || 'ok');
  function stimmungItem() {
    const own = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => !p.onLoanAt);
    const liste = own.filter(p => CFG.stufen[stufeVon(p)]).sort((a, b) => (a.morale || 70) - (b.morale || 70));
    if (!liste.length) return null;
    const moral = p => Math.round(typeof p.morale === 'number' ? p.morale : 70);
    const ini = p => ((p.firstName || ' ')[0] + (p.name || ' ')[0]).toUpperCase();
    const zonen = CFG.zonen.map(([a, b, kl]) => `<i class="bk-z-${kl}" style="width:${b - a}%"></i>`).join('');
    // D99: Trade-Wunsch aus der Stimmung (dfl_wechsel_patch.js, p.wantsOut 'stimmung') – Grund statt Moral und Wertabschlag (der Abschlag hängt
    // nur an der Moral); auf der Moral-Skala steht er nicht (seine Moral ist nicht der Grund)
    const d99 = p => (p.wantsOut === 'stimmung' && W.DFLWechsel && DFLWechsel.grundKurz ? DFLWechsel.grundKurz(p) : '');
    const marken = liste.filter(p => !d99(p)).slice(0, 8).map((p, i) => `<span class="bk-st-marke ${i % 2 ? 'unten' : 'oben'} k-${stufeVon(p)}" style="left:${Math.max(3, Math.min(97, moral(p)))}%" title="${esc(kurz(p))}: ${moral(p)}"><b>${esc(ini(p))}</b></span>`).join('');
    const achse = [0, 30, 45, 62, 100].map(x => `<span style="left:${x}%">${x}</span>`).join('');
    const zeilen = liste.map(p => {
      const st = stufeVon(p), s = CFG.stufen[st], w = CFG.wert[st] || 1, g = d99(p);
      const knopf = p.perspektiv ? '' : st === 'unhappy'
        ? `<button class="pf-btn" onclick="DFLBilder.aufstellen('${esc(p.id)}')">${ti('player-play')}Aufstellen</button>`
        : `<button class="pf-btn ok" onclick="DFLBilder.traden('${esc(p.id)}')">${ti('arrows-exchange')}Traden</button>`;
      return `<div class="bk-st-zeile k-${st}">${gesicht(p, 'bk-gesicht klein')}<span class="bk-st-mitte"><b>${esc(kurz(p))}</b>
        <span class="bk-st-unter">${posMarke(p)}<span class="bk-st-ovr">${p.ovr}</span><span class="bk-st-stufe kz-${s[2]}">${ti(s[1])}${s[0]}${g ? '' : ' · ' + moral(p)}</span><span class="bk-st-wert">${g ? esc(g) : `Wert −${Math.round((1 - w) * 100)} %`}</span></span></span>${knopf}</div>`;
    }).join('');
    const mitD99 = liste.some(p => d99(p));
    const schlimm = liste.some(p => stufeVon(p) === 'strike') ? 'strike' : liste.some(p => stufeVon(p) === 'wants_out') ? 'wants_out' : 'unhappy';
    return { cat: schlimm === 'unhappy' ? 'news' : 'warn', icon: markeHtml(schlimm === 'strike' ? 'hand-stop:schlecht' : schlimm === 'wants_out' ? 'plane-departure:mittel' : 'mood-sad:mittel'),
      title: `Stimmung im Kader · ${liste.length} von ${own.length} ${info('stimmung', 'Stimmung', 'Moral unter 62: unzufrieden (Wert −10 %), unter 45: will getradet werden (−25 %), unter 30: Streik, nicht aufstellbar (−40 %). Einsatzzeit nach seiner Rolle hilft – oder ein Trade.' + (mitD99 ? ' „Will weg“ mit Grund: seine Stimmung im Verein (Rolle, Vertrag, Erfolg, Umfeld) ist unter −2,0 – ohne Wertabschlag; bessert sie sich, bleibt er.' : ''))}`,
      prio: schlimm === 'strike' ? 6 : schlimm === 'wants_out' ? 3 : 1, ts: Date.now(),
      text: `<div class="pfk pfk-stimmung">${marken ? `<div class="bk-st-skala"><div class="bk-st-zonen">${zonen}</div>${marken}<div class="bk-st-achse">${achse}</div></div>` : ''}` +
        `<div class="bk-st-liste">${zeilen}</div></div>` };
  }
  function traden(id) { if (W.DFLTrade && DFLTrade.oeffne) DFLTrade.oeffne(id); }
  function aufstellen(id) {
    const p = spieler(id); if (!p) return;
    if (W.DFLAppShell && DFLAppShell.zeige) DFLAppShell.zeige('squad'); else if (typeof switchAppView === 'function') switchAppView('squad', document.getElementById('nav-squad'));
    const b = [...document.querySelectorAll('#view-squad .subtab')].find(x => /'lineup'/.test(x.getAttribute('onclick') || ''));
    if (b) b.click();
    if (typeof clickBench === 'function') { try { clickBench(id); } catch (e) { /* nicht auf der Bank */ } }
    // Nutzer 2026-10-22: überflüssiger Text raus: Hinweis „tippe einen Platz in der Elf an“ nur am Handy, am PC (body.pcu-an) keine Meldung
    if (typeof showToast === 'function' && !document.body.classList.contains('pcu-an')) showToast(`${kurz(p)}: tippe einen Platz in der Elf an, um zu tauschen.`, 'info', { duration: 4000 });
  }

  // ── 10) Trade-Anfrage als Tausch-Karte ───────────────────────────────────
  function anfrage(id) { return ((CLUB.dfl && CLUB.dfl.anfragen) || []).find(a => a.id === id) || null; }
  function tauschKarte(a, gross) {
    if (!a || !a.deal || !W.DFLSpiel) return null;
    const L = DFLSpiel.liga(), A = L.teams.find(t => t.id === a.deal.von), B = L.teams.find(t => t.id === a.deal.an);
    if (!A || !B) return null;
    const H = W.DFLHandel;
    const sq = w => (typeof SQUAD !== 'undefined' ? SQUAD.find(q => q.id === w.sq || (q.dflId && q.dflId === w.id)) : null) || w;
    const farben = T => { try { const f = DFLSpiel.franchise(DFLSpiel.spielId ? DFLSpiel.spielId(T.id) : T.id); return f ? { farben: f.farben } : null; } catch (e) { return null; } };
    // D78: Spieler der KI ohne Scout-Bericht nur mit Stufe („80er“), mit Bericht genau – wie Trade-Zentrale und Anfrage-Text
    const SC = W.DFLScouting && typeof DFLScouting.aktiv === 'function' && DFLScouting.aktiv() ? W.DFLScouting : null;
    const staerke = (w, fremd) => { if (!fremd || !SC) return String(w.ovr); try { return SC.staerkeHtml(w, 'kurz') || String(w.ovr); } catch (e) { return String(w.ovr); } };
    const stk = (T, teil) => {
      const fremd = T !== A;
      const sp = (teil.spieler || []).map(id => T.roster.find(p => p.id === id)).filter(Boolean).map(w => {
        const p = sq(w); let g = '';
        try { g = W.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, farben(T)) : ''; } catch (e) { g = ''; }
        return `<span class="bk-tk-sp"><span class="ko-gesicht bk-gesicht${gross ? '' : ' klein'}">${g}</span><span class="bk-tk-wer">${posMarke(w)}<b>${esc(w.name)}</b></span><em>${staerke(w, fremd)}</em></span>`;
      });
      const pk = (teil.picks || []).map(id => (L.picks || []).find(x => x.id === id)).filter(Boolean)
        .map(x => `<span class="bk-tk-sp pick">${ti('ticket')}<span class="bk-tk-wer"><b>${x.jahr}</b><small>Runde ${x.runde}</small></span><em>${H && H.pickText ? esc(String(H.pickText(L, x)).replace(/^[^~]*(~|$)/, '~').replace(/^~$/, '')) : ''}</em></span>`);
      return sp.concat(pk).join('') || '<span class="bk-tk-leer">nichts</span>';
    };
    const sId = DFLSpiel.spielId ? DFLSpiel.spielId(B.id) : B.id;
    // D120: Urteil des Chefscouts statt Wert-Waage (keine Wertzahlen)
    let urteil = null;
    try { urteil = W.DFLChefscout ? DFLChefscout.urteil(L, a.deal) : null; } catch (e) { urteil = null; }
    const rest = Math.max(0, (a.bis || 0) - (LEAGUE.week || 0));
    return `<div class="bk-tausch${gross ? ' gross' : ''}">
      <div class="bk-tk-seiten"><div class="bk-tk-seite du"><small>Du gibst</small>${stk(A, a.deal.gibt || {})}</div>
        <span class="bk-tk-pfeil">${ti('arrows-exchange')}</span>
        <div class="bk-tk-seite sie"><small>${wappen(sId, 'bk-wappen klein')}${esc(B.kurz || kuerzel(sId))} gibt</small>${stk(B, a.deal.bekommt || {})}</div></div>
      <div class="bk-tk-fuss">${urteil ? `<span class="bk-chip cs-chip ${urteil.key}" title="${esc(urteil.satz)}">${ti(urteil.icon.replace(/^ti-/, ''))}${esc(urteil.name)}</span>` : ''}
        <span class="bk-chip${rest <= 1 ? ' schlecht' : ''}">${ti('clock')}bis KW ${a.bis}${rest ? ` · noch ${rest} ${rest === 1 ? 'Woche' : 'Wochen'}` : ''}</span></div></div>`;
  }
  // offene Anfragen: die Meldung „Trade-Anfrage: …“ steht schon als Angebot im Postfach
  function anfrageTitel(a) {
    try {
      const B = DFLSpiel.liga().teams.find(t => t.id === a.team); if (!B) return null;
      return a.art === 'pick' ? `${B.name} will deinen ${String(a.pickText || '').replace(/^Pick /, '')}` : `${B.name} will ${a.spielerName}`;
    } catch (e) { return null; }
  }
  if (W.DFLAnfragen && typeof DFLAnfragen.zeigen === 'function') {
    const _orig = DFLAnfragen.zeigen;
    DFLAnfragen.zeigen = function (id) {
      const r = _orig.apply(this, arguments);
      try {
        const a = anfrage(id), box = document.querySelector('#app-blatt.auf .app-blatt-box') || document.querySelector('#anf-ov .anf-dialog');
        if (dfl() && a && box && !box.querySelector('.bk-tausch')) {
          const h = tauschKarte(a, true), listen = box.querySelectorAll('.ks-liste'), titel = box.querySelectorAll('.ks-titel');
          if (h && listen.length >= 2) {
            listen[0].insertAdjacentHTML('beforebegin', h);
            [].forEach.call(listen, x => x.remove()); [].forEach.call(titel, x => x.remove());
            const hw = box.querySelector('.ks-hinweis');
            if (hw) hw.innerHTML = a.runde ? 'Ein letztes Angebot.' : 'Lehnst du ab, kommen sie höchstens einmal mit einem besseren Angebot wieder.';
          }
        }
      } catch (e) { console.warn('[DFL-Bilder] Anfrage', e); }
      return r;
    };
  }

  // ── Postfach: Karten statt Text ──────────────────────────────────────────
  const TEIL = { ATT: 'Angriff', MID: 'Mittelfeld', DEF: 'Abwehr' };
  function postfachNews(liste) {
    const aus = [], ergebnisse = new Set(), moral = new Map(), zurueck = new Set();
    liste.forEach(n => {
      if (!n) return;
      const t = kopfOhneEmoji(n.title);
      if (n.category === 'match' && RE_ERG.test(t)) ergebnisse.add(n.season + '|' + n.matchday);
      else if (RE_MORAL.test(t)) { const m = moralAus(n.text); if (m) moral.set(n.season + '|' + n.matchday, m); }
      else if (RE_ZURUECK.test(t)) zurueck.add(n.season + '|' + n.matchday + '|' + RE_ZURUECK.exec(t)[1]);
    });
    const offen = new Set(((CLUB.dfl && CLUB.dfl.anfragen) || []).filter(a => a.status === 'offen').map(anfrageTitel).filter(Boolean));
    for (const n of liste) {
      if (!n) continue;
      const t = kopfOhneEmoji(n.title);
      if (RE_MORAL.test(t) && ergebnisse.has(n.season + '|' + n.matchday)) continue;                        // steht in der Spieltag-Karte
      if (CFG.spieltagHinweisWeg && n.category === 'match' && t === 'Spieltag' && /Spieltag-Tab/.test(n.text || '')) continue;
      if (RE_STIMMUNG.test(t)) continue;                                                                      // steht in „Stimmung im Kader“
      if (RE_FIT.test(t) && zurueck.has(n.season + '|' + n.matchday + '|' + RE_FIT.exec(t)[1])) continue;   // „Zurück: …“ (D102) sagt mehr
      if (/^Trade-Anfrage: /.test(t) && offen.has(t.replace(/^Trade-Anfrage: /, ''))) continue;              // steht als Angebot oben
      let k = karteVon(n);
      if (k && k.typ === 'spiel' && !k.moral && moral.has(n.season + '|' + n.matchday)) { k = Object.assign({}, k, { moral: moral.get(n.season + '|' + n.matchday) }); STAND.alteKarten++; }
      const h = k ? karteHtml(k, n) : null;
      if (h) { aus.push(Object.assign({}, n, { title: h.titel, text: `<div class="pfk pfk-${esc(k.typ)}" data-marke="${esc(h.marke)}">${h.html}</div>` })); continue; }
      // Formserie (bundle_match.js): „MID +1“ → „Mittelfeld +1“ (D85, Kleinteile)
      const dt = String(n.text || '').replace(/\b(ATT|MID|DEF) ([+−-]\d+)/g, (x, a, d) => TEIL[a] + ' ' + d);
      aus.push(dt !== n.text ? Object.assign({}, n, { text: dt }) : n);
    }
    return aus;
  }
  {
    const _orig = W.buildPostfachItems;
    if (typeof _orig === 'function') {
      W.buildPostfachItems = function () {
        if (!dfl() || !Array.isArray(CLUB.news)) return _orig.apply(this, arguments);
        const echt = CLUB.news;
        let items;
        try { CLUB.news = postfachNews(echt); items = _orig.apply(this, arguments); }
        catch (e) { CLUB.news = echt; console.warn('[DFL-Bilder] Postfach', e); return _orig.apply(this, arguments); }
        finally { CLUB.news = echt; }
        try {
          (items || []).forEach(i => {
            const m = /^<div class="pfk pfk-([a-z]+)" data-marke="([^"]+)"/.exec(i.text || '');
            if (m) { i.icon = markeHtml(m[2]); if (m[1] === 'spiel' && i.meta) i.meta = i.meta.replace(/ · Spieltag \d+$/, ''); }
          });
          items = items.filter(i => !(i.cat === 'warn' && /^(Streik|Trade-Wunsch): /.test(i.title || '')));
          const st = stimmungItem(); if (st) items.push(st);
          items.forEach(i => {
            if (i.cat !== 'offer') return;
            const m = /DFLAnfragen\.zeigen\('([^']+)'\)/.exec(i.actions || ''), a = m && anfrage(m[1]), h = a && tauschKarte(a, false);
            // Position und Stärke stehen aktuell in der Karte (im Titel stand der Stand vom Tag der Anfrage)
            if (h) { i.text = `<div class="pfk pfk-anfrage">${h}</div>`; i.title = String(i.title || '').replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*$/, ''); }
          });
        } catch (e) { console.warn('[DFL-Bilder] Postfach-Karten', e); }
        return items;
      };
      try { buildPostfachItems = W.buildPostfachItems; } catch (e) { /* window reicht */ }
    }
  }

  // ── 6/7) Verein: Eigentümer und Cap-Untergrenze ─────────────────────────
  function eignerHtml() {
    const E = W.DFLEigner, s = E && E.stand ? E.stand() : null; if (!s) return '';
    const C = E.CFG, p = C.profile[s.profil], d = CLUB.dfl, ser = (d.eigner && d.eigner.serie) || 0;
    const klasse = s.wert >= 45 ? 'gut' : s.wert >= 30 ? 'mittel' : 'schlecht';
    const gew = [['Gewinn', s.g, p.g], ['Erfolg', s.e, p.e], ['Fans', s.f, p.f]];
    const ringe = gew.map(([t, v, g]) => `<div class="bk-eg-ring">${ring(v / 100, (v >= 60 ? 'gut' : v >= 35 ? 'mittel' : 'schlecht') + ' w' + Math.round(g * 100), v)}<b>${t}</b><small>${Math.round(g * 100)} %</small></div>`).join('');
    const lo = Math.min(0, s.ergebnis, s.erwartung), hi = Math.max(s.ergebnis, s.erwartung, 1e6) * 1.1, sp = hi - lo || 1;
    const x = v => ((v - lo) / sp * 100).toFixed(1);
    const nullP = x(0), erg = x(s.ergebnis);
    const fill = s.ergebnis >= 0 ? `left:${nullP}%;width:${(erg - nullP).toFixed(1)}%` : `left:${erg}%;width:${(nullP - erg).toFixed(1)}%`;
    const rangTxt = s.rang < s.erwRang ? `Platz ${s.rang} · besser als Stärke-Rang ${s.erwRang}` : s.rang > s.erwRang ? `Platz ${s.rang} · schlechter als Stärke-Rang ${s.erwRang}` : `Platz ${s.rang} = Stärke-Rang ${s.erwRang}`;
    const hist = (d.eigner.historie || []).slice(-4).map(h => `<span class="bk-chip ${h.wert >= 45 ? 'gut' : h.wert >= 30 ? 'mittel' : 'schlecht'}" title="${esc(h.urteil)}">${h.saison}: ${h.wert}</span>`).join('');
    return `<div class="exp-section-title"><i class="ti ti-building-bank"></i> Eigentümer ${info('eigner', p.name, esc(p.text) + ' Gewichtung: Gewinn ' + Math.round(p.g * 100) + ' %, Erfolg ' + Math.round(p.e * 100) + ' %, Fans ' + Math.round(p.f * 100) + ' %. Ab 70 schießt er zu, unter 30 kürzt er. Drei verärgerte Saisons in Folge – dann ist Schluss.')}</div>
      <div class="bk-eg-kopf"><span class="bk-eg-name"><b>${esc(s.name)}</b><span class="bk-chip">${esc(p.name)}</span></span>
        <span class="bk-eg-wert ${klasse}"><b>${s.wert}</b><small>${esc(s.urteil)}</small></span></div>
      <div class="bk-ampel" role="img" aria-label="Zufriedenheit ${s.wert} von 100: unter 30 Kürzung, ab 70 Zuschuss">
        <i class="bk-a-k" style="width:30%">Kürzung</i><i class="bk-a-n" style="width:40%"></i><i class="bk-a-z" style="width:30%">Zuschuss</i>
        <span class="bk-zeiger" style="left:${Math.max(1, Math.min(99, s.wert))}%"></span></div>
      <div class="bk-eg-ringe">${ringe}</div>
      <div class="bk-eg-erg"><span>Ergebnis</span><span class="bk-eg-bahn" role="img" aria-label="Ergebnis ${mio(s.ergebnis)}, Plan ${mio(s.erwartung)}">
        <i class="${s.ergebnis >= s.erwartung ? 'gut' : 'schlecht'}" style="${fill}"></i><em style="left:${x(s.erwartung)}%" title="Plan ${mio(s.erwartung)}"></em></span>
        <b>${s.ergebnis >= 0 ? '+' : '−'}${zahl(Math.abs(s.ergebnis) / 1e6, 1)}</b></div>
      <div class="bk-eg-fuss"><span>${ti('trophy')}${rangTxt}</span><small>Strich = Plan ${s.erwartung >= 0 ? '+' : '−'}${zahl(Math.abs(s.erwartung) / 1e6, 1)} Mio € · Prognose</small></div>
      ${ser ? `<div class="bk-fazit schlecht">${ti('alert-triangle')}<b>${ser === 1 ? 'Letzte Saison war er verärgert.' : 'Ultimatum: noch eine verärgerte Saison, dann bist du entlassen.'}</b></div>` : ''}
      ${hist ? `<div class="bk-eg-hist"><small>Bisher</small>${hist}</div>` : ''}`;
  }
  function untergrenzeHtml() {
    const E = W.DFLEigner; if (!E || !E.untergrenzeFenster) return '';
    const U = E.untergrenzeFenster(), J = E.CFG.untergrenze.jahre, anteil = Math.round(E.CFG.untergrenze.anteil * 100);
    const fertig = (U.jahre || []).map(j => j.bar || 0), summeFertig = fertig.reduce((a, b) => a + b, 0);
    const laufend = Math.max(0, U.ist - summeFertig), prog = Math.max(0, U.prognose - U.ist), luecke = Math.max(0, U.soll - U.prognose);
    const skala = Math.max(U.soll, U.prognose) * 1.04 || 1, pc = v => (v / skala * 100).toFixed(2);
    const segmente = fertig.map((v, i) => `<i class="bk-ug-fertig" style="width:${pc(v)}%" title="Saison ${i + 1}: ${mio(v)}">${v / skala > 0.12 ? zahl(v / 1e6, 1) : ''}</i>`).join('') +
      `<i class="bk-ug-jetzt" style="width:${pc(laufend)}%" title="Saison ${U.n}: ${mio(laufend)}">${laufend / skala > 0.12 ? zahl(laufend / 1e6, 1) : ''}</i>` +
      (prog > 0 ? `<i class="bk-ug-prog" style="width:${pc(prog)}%" title="Prognose mit dem heutigen Kader">${prog / skala > 0.18 ? 'Prognose' : ''}</i>` : '') +
      (luecke > 0 ? `<i class="bk-ug-luecke" style="width:${pc(luecke)}%" title="Lücke ${mio(luecke)}"></i>` : '');
    const tabs = Array.from({ length: J }, (_, i) => `<span class="${i + 1 === U.n ? 'jetzt' : i + 1 < U.n ? 'fertig' : ''}">Saison ${i + 1}</span>`).join('');
    const nach = (CLUB.dfl.untergrenze && CLUB.dfl.untergrenze.nachgezahlt) || 0;
    return `<div class="exp-section-title"><i class="ti ti-scale"></i> Cap-Untergrenze ${anteil} % ${info('untergrenze', 'Cap-Untergrenze', `In vier Saisons müssen ${anteil} % der Caps an die Spieler fließen – sonst wird der Rest an den Kader nachgezahlt. Fenster ${U.startSaison}–${U.startSaison + J - 1}.`)}</div>
      <div class="bk-ug-tabs">${tabs}</div>
      <div class="bk-ug-bahn" role="img" aria-label="Gezahlt ${mio(U.ist)}, Prognose ${mio(U.prognose)}, Soll ${mio(U.soll)}">${segmente}<span class="bk-ug-soll" style="left:${pc(U.soll)}%"></span></div>
      <div class="bk-legende"><span><i class="bk-ug-fertig"></i>gezahlt <b>${zahl(U.ist / 1e6, 1)}</b></span><span><i class="bk-ug-prog"></i>Prognose <b>${zahl(U.prognose / 1e6, 1)}</b></span>
        <span><i class="bk-ug-soll-i"></i>Soll <b>${zahl(U.soll / 1e6, 1)}</b></span><span class="bk-mio">Mio €</span></div>
      <div class="bk-fazit ${luecke > 0 ? 'schlecht' : 'gut'}">${ti(luecke > 0 ? 'alert-triangle' : 'circle-check')}<b>${luecke > 0 ? `fehlen ${zahl(luecke / 1e6, 1)} Mio → Nachzahlung an den Kader` : 'Soll erreicht'}</b>${nach ? `<small>bisher nachgezahlt ${mio(nach)}</small>` : ''}</div>`;
  }
  if (W.DFLEigner && typeof DFLEigner.panelHtml === 'function') {
    const _orig = DFLEigner.panelHtml;
    DFLEigner.panelHtml = function () {
      const html = _orig.apply(this, arguments);
      if (!dfl() || !DOM || !html) return html;
      try {
        const t = document.createElement('template'); t.innerHTML = html;
        t.content.querySelectorAll('.exp-section').forEach(sec => {
          const titel = sec.querySelector('.exp-section-title i');
          if (titel && titel.classList.contains('ti-building-bank')) { sec.innerHTML = eignerHtml(); sec.classList.add('bk-eigner'); }
          else if (titel && titel.classList.contains('ti-scale')) { sec.innerHTML = untergrenzeHtml(); sec.classList.add('bk-untergrenze'); }
        });
        return t.innerHTML;
      } catch (e) { console.warn('[DFL-Bilder] Eigentümer', e); return html; }
    };
  }
  // Fanstimmung: der Erklärsatz geht hinter ⓘ am Titel
  if (W.DFLEigner && typeof DFLEigner.fanHinweisHtml === 'function') {
    const _orig = DFLEigner.fanHinweisHtml;
    DFLEigner.fanHinweisHtml = function () { return dfl() ? '' : _orig.apply(this, arguments); };
  }
  {
    const _orig = W.renderExpectationsPanel;
    if (typeof _orig === 'function') {
      W.renderExpectationsPanel = function () {
        const r = _orig.apply(this, arguments);
        try {
          if (dfl()) document.querySelectorAll('#exp-panel .exp-section-title').forEach(el => {
            if (/Fanstimmung/.test(el.textContent) && !el.querySelector('.info-btn'))
              el.insertAdjacentHTML('beforeend', ' ' + info('fans', 'Fanstimmung', 'Preise, Ergebnisse und volle Ränge bewegen die Fans – gute Stimmung bringt mehr Einnahmen (Tickets, Merch).'));
          });
        } catch (e) { console.warn('[DFL-Bilder] Fans', e); }
        return r;
      };
      try { renderExpectationsPanel = W.renderExpectationsPanel; } catch (e) { /* window reicht */ }
    }
  }

  // ── 9) Trainingsgruppe: drei Ringe statt Satz ───────────────────────────
  function trainingsgruppeRinge() {
    const intro = document.querySelector('#dfl-trainingsgruppe .tg-intro'); if (!intro || intro.dataset.bk) return;
    const f = (W.DFLTraining && DFLTraining.CFG && DFLTraining.CFG.faktor) || { perspektiv: 0.8, inaktivJung: 0.4, mentor: 0.1, jungBis: 23 };
    const r = (anteil, gross, klein, kl) => `<div class="bk-tg-ring">${ring(anteil, kl, gross)}<small>${klein}</small></div>`;
    intro.dataset.bk = '1'; intro.classList.add('bk-tg');
    intro.innerHTML = r(f.perspektiv, Math.round(f.perspektiv * 100) + ' %', 'Development Squad', 'gut') + r(f.inaktivJung, Math.round(f.inaktivJung * 100) + ' %', `bis ${f.jungBis} ohne Stammplatz`, 'mittel') +
      r(f.mentor, '+' + Math.round(f.mentor * 100) + ' %', 'Mentor', 'info') +
      `<span class="bk-tg-info">${info('trainingsgruppe', 'Trainingsgruppe', `Ohne Spielzeit kaum Entwicklung – Training ersetzt einen Teil: Development Squad ${Math.round(f.perspektiv * 100)} %, bis ${f.jungBis} ohne Stammplatz ${Math.round(f.inaktivJung * 100)} %, ein Mentor (ab 28) +${Math.round(f.mentor * 100)} %. 100 % = Entwicklung wie mit Einsätzen.`)}</span>`;
  }
  if (W.TrainingSystem && typeof TrainingSystem.renderTrainingTab === 'function') {
    const _orig = TrainingSystem.renderTrainingTab;
    TrainingSystem.renderTrainingTab = function () {
      const r = _orig.apply(this, arguments);
      try { if (dfl()) trainingsgruppeRinge(); } catch (e) { console.warn('[DFL-Bilder] Trainingsgruppe', e); }
      return r;
    };
  }
  if (W.DFLTraining && typeof DFLTraining.zeichne === 'function') {
    const _orig = DFLTraining.zeichne;
    DFLTraining.zeichne = function () { const r = _orig.apply(this, arguments); try { if (dfl()) trainingsgruppeRinge(); } catch (e) { /* Beiwerk */ } return r; };
  }

  // Postfach nach dem Laden einmal neu (initGame zeichnet vor den Patches)
  try { if (dfl() && typeof W.renderPostfach === 'function' && DOM && document.getElementById('postfach-list')) W.renderPostfach(); } catch (e) { /* Postfach optional */ }

  W.DFLBilder = { CFG, STAND, karteVon, karteHtml, spielKarteAusText, planKarte, planKarteAusText, moralAus, postfachNews, stimmungItem, tauschKarte,
    traden, aufstellen, eignerHtml, untergrenzeHtml, markeHtml };
  console.log('[DFL-Bilder v1] aktiv — Bilder statt Text (D76): Spieltag-Karte (Ergebnis + Moral), Aufstellung mit Gesichtern, Stimmung im Kader, Saisonplan, Tausch-Karte, Eigentümer-Ampel, Untergrenze, Trainingsgruppe; Erklärsätze hinter ⓘ');
})();
