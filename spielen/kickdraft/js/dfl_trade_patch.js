/* ═══════════════════════════════════════════════════════════════════════════
   DFL-TRADE-PATCH  ·  v2   (Trades statt Ablösen, Spec 3.3 + Football-GM-Logik)
   ─────────────────────────────────────────────────────────────────────────
   Zwei neue Reiter im Transfermarkt:
     · Trades: Partner wählen, Spieler und Draft-Picks beider Seiten wählen, die KI
       bewertet live (DFLHandel: Wert, Teamlage, Pick-Bremse, Cap-Regel, Titelteams
       geben Stammspieler nicht für Picks ab, Teams über dem Cap verkaufen günstiger).
       „Was müsste ich dazugeben?“, Trading Block (Angebote für einen eigenen Spieler).
     · Wertliste: Pick-Wertkurve (1–128), die wertvollsten Spieler der Liga, dein Kader.
   Trade-Deadline: nach Spieltag 16 bis Saisonende gesperrt (DFLHandel.CFG.deadlineSpieltag).
   D50 (2026-10-09): Schilder „nicht zu haben“ / „×2,5“ beim Partner, Taktik des Partners, „Interesse“ an deinen
   Spielern, „Anfrage senden“ (abgelehnte Anfragen zählen: nach 3 je Verein bricht er die Gespräche bis zum Ende
   des Wechselfensters ab), Interessenzuschlag beim Verhandeln einer Anfrage (DFLAnfragen), Unverkäuflich-Knopf.
   D54 (2026-10-09): Lage-Schild (Titelanwärter / Mittelfeld / Neuaufbau) und Trade-O-Meter (rot → gelb → grün,
   Nadel = Bereitschaft der KI aus kiErhaelt/kiBraucht). Kein Cash im Trade.
   v2 (2026-10-11, Vorschau spiel/dfl_trade_vorschau.html, freigegeben):
     · D84 anschaulicher: links immer deine Seite, rechts ihre – Karten mit Gesicht (facesjs wie im Kader), Position
       mit Nebenpositionen (D83), Stärke, Alter, Cap Hit; Picks als Tickets (Jahr, Runde, erwarteter Platz, Wert).
       Darunter der Vorrat beider Vereine zum Antippen (Spieler, Picks), Trade-O-Meter wie bisher, Cap-Balken beider
       Vereine vor/nach dem Tausch (Welt-Projektion DFLHandel.capNach; gebucht wird im Spiel, Cap Welt = Spiel).
       Pick-Werte bleiben die geeichten aus D96 (die ×1,25/×1,20 der Vorschau sind durch D96 ersetzt).
     · D86 Vertrag vorab: hat ein eingehender Spieler nur noch 1 Vertragsjahr, bietet die Zentrale einen Folgevertrag
       an (Blatt aus dfl_saisonwechsel_patch.js im Tausch-Modus: Forderung DFLGenerator.forderung aus Sicht des neuen
       Vereins, Vorlagen gleich/steigend/fallend D87, „heute zahlen“). Ob er unterschreibt, entscheidet seine Stimmung
       (je Spieler und Saison fest gewürfelt); lehnt er ab, geht der Tausch ohne Vertrag. Trade und Vertrag gelten nur
       zusammen: der Cap wird mit dem Kader nach dem Tausch und dem neuen Cap Hit geprüft (diese Saison inkl. „heute
       zahlen“, Startsaison des Vertrags), gebucht wird beides in ausfuehrenDeal.
     · D99 (2026-10-11, Vorschau spiel/dfl_scout_vorschau.html): Block „Zu haben in der Liga“ über dem Tausch – alle, die bei
       anderen Vereinen weg wollen (Preis 85 %) oder abgegeben werden (90 %; Cap-Not, Neuaufbau, Stil, Überschuss), Filter
       nach Grund mit Zählern, antippen = Partner + in den Tausch; Schilder „will weg“/„Abgabe“ an Karten und im Vorrat,
       Hinweis zum Preis unter dem Trade-O-Meter. Stärke fremder Spieler wie überall über DFLScouting (D78).
   Braucht: DFLSpiel, DFLKader, DFLHandel, DFLGenerator; für D86 DFLSaisonwechsel (lädt später, zur Laufzeit gelesen).
   Lädt nach dfl_kader_patch.js. CSS: css/dfl_trade.css (D99: css/dfl_wechsel.css). API DFLTrade.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, H = window.DFLHandel, D = window.DFLSpiel, K = window.DFLKader;
  if (!G || !H || !D || !K) { console.warn('[DFL-Trade] DFL-Module fehlen – Patch inaktiv'); return; }

  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const dfl = () => !!(hatClub() && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl);
  const mio = v => (Math.round(v / 1e5) / 10).toLocaleString('de-DE') + ' Mio';
  const zahl1 = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const mioE = x => zahl1(x) + ' Mio €';
  const wert1 = x => (Math.round((x || 0) * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const kurzname = p => (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name;
  const label = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : 'Saison ' + s; } catch (e) { return 'Saison ' + s; } };
  const kl = s => { const l = label(s); return /^\d{4}\//.test(l) ? l.slice(2) : l; };        // „27/28“
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  // Position mit Neben-Positionen in Klammern (D83, Nutzer 2026-10-10: „bei den Trades generell die Zweit- oder
  // Drittpositionen in Klammern angeben“), Bezeichnungen wie im Spiel (OM = ZOM)
  const posName = x => x === 'OM' ? 'ZOM' : x;
  const posText = p => { const n = [...new Set((p.positions || []).filter(x => x && x !== p.pos))].map(posName);
    return posName(p.pos) + (n.length ? ' (' + n.join(', ') + ')' : ''); };
  const leer = () => ({ spieler: [], picks: [] });
  // vertrag (D86): vereinbarter Vertrag vorab { id (Welt-ID des Spielers), staffel, vorab, f (feste Forderung) } · nein: abgelehnt (Saison:ID)
  let Z = { partner: null, gibt: leer(), bekommt: leer(), block: null, meldung: '', interesse: null, vertrag: null, nein: new Set() };
  const A_ = () => window.DFLAnfragen;
  // Abgelehnte Anfragen des Nutzers je Verein und Wechselfenster (D50)
  const MAX_ANFRAGEN = 3;
  const fensterKey = () => LEAGUE.season + (LEAGUE.matchday < H.CFG.deadlineSpieltag ? 'a' : 'b');
  function gespraech(teamId) {
    const g = (CLUB.dfl.gespraeche = CLUB.dfl.gespraeche || {});
    if (!g[teamId] || g[teamId].f !== fensterKey()) g[teamId] = { f: fensterKey(), n: 0 };
    return g[teamId];
  }
  // Zuschlag nur, solange der Deal den Spieler der offenen Anfrage enthält
  function optFuer(deal) {
    const i = Z.interesse;
    if (!i || i.team !== deal.an) return {};
    if (i.spieler && (deal.gibt.spieler || []).indexOf(i.spieler) < 0) return {};
    if (i.pick && (deal.gibt.picks || []).indexOf(i.pick) < 0) return {};
    return { interesse: i.wert, ki: !!i.ki };
  }

  function welt() { const L = D.welt(); H.picks(L); return L; }
  const eigenId = () => D.eigeneDflId();
  function fenster() {
    if (LEAGUE.matchday < H.CFG.deadlineSpieltag) return { ok: true, text: `Deadline: Spieltag ${H.CFG.deadlineSpieltag - 1}` };
    return { ok: false, text: `Trade-Deadline vorbei (nach Spieltag ${H.CFG.deadlineSpieltag - 1}). Nach der Saison geht es weiter.` };
  }
  const scouting = () => (CLUB.facilities && CLUB.facilities.scouting) || 5;
  // D78 (dfl_scouting_patch.js): fremde Spieler ohne Scout-Bericht nur mit Stufe („80er“) und ohne Potenzial, mit Bericht genau
  const SC = () => (window.DFLScouting && DFLScouting.aktiv() ? window.DFLScouting : null);
  const CS = () => window.DFLChefscout || null;                                  // D120: Urteil des Chefscouts statt Wertzahl
  function staerke(x) {
    const sc = !x.eigen && SC();
    if (!sc) return { text: String(x.eigen ? x.p.ovr : x.sicht.ovr), kl: 'pos-' + posName(x.p.pos), titel: 'Stärke ' + (x.eigen ? x.p.ovr : x.sicht.ovr),
      pot: x.p.age <= 25 && x.sicht.pot > (x.eigen ? x.p.ovr : x.sicht.ovr) ? 'Pot. ~' + x.sicht.pot : '' };
    const s = sc.sicht(x.p);
    if (s && s.bericht) return { text: String(s.ovr), kl: 'pos-' + posName(x.p.pos), titel: 'Stärke ' + s.ovr + ' (Scout-Bericht)',
      pot: x.p.age <= 25 && s.pot && s.pot.hi > s.ovr ? 'Pot. ' + (s.pot.lo === s.pot.hi ? s.pot.lo : s.pot.lo + '–' + s.pot.hi) : '' };
    const st = sc.stufe(x.p.ovr);
    return { text: st.kurz, kl: 'sc-stufe ' + st.key, titel: `Stärke ${st.name} (${st.spanne}) – genau erst mit Scout-Bericht`, pot: '', stufe: true };
  }

  // ── Bausteine (D84): Gesichter, Karten, Tickets, Vorrat, Cap-Balken ─────
  const STAND_SAAT = () => (CLUB.dfl.saisonIndex || 0) * 13;
  const farbenVon = T => (T && T.farben) || ((D.franchise(T && T.id) || {}).farben) || null;
  // Eigene Spieler: Gesicht vom Spielspieler (wie im Kader); fremde: Weltspieler (nach dem Tausch dasselbe Gesicht, dflSeed = seed)
  const spielSpieler = w => (typeof SQUAD !== 'undefined' ? SQUAD.find(q => q.id === w.sq || (q.dflId && q.dflId === w.id)) : null) || w;
  function gesichtHtml(p, farben, kl2) {
    let svg = '';
    try { svg = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, farben ? { farben } : null) : ''; } catch (e) { svg = ''; }
    return `<span class="tz-gesicht${kl2 ? ' ' + kl2 : ''}" aria-hidden="true">${svg}</span>`;
  }
  const wappenHtml = (T, kl2) => `<span class="lg-crest tz-wappen${kl2 ? ' ' + kl2 : ''}" style="${typeof crestStyle === 'function' ? crestStyle(D.spielId(T.id)) : ''}" aria-hidden="true"></span>`;
  const LAGE_SCHILD = { titel: 'Titelanwärter', neuaufbau: 'Neuaufbau', mittelfeld: 'Mittelfeld' };
  const schildLage = l => `<span class="dfl-tr-badge ${l.key}">${LAGE_SCHILD[l.key] || l.text}</span>`;
  const faktorText = f => '×' + (Math.round(f * 100) / 100).toLocaleString('de-DE');
  const posBadge = p => `<span class="pos-badge-sm pos-${esc(posName(p.pos))}">${esc(posName(p.pos))}</span>`;
  // D85: Positionsmarke über DFLOberflaeche (Farbe nach Mannschaftsteil, Nebenpositionen geteilt), ohne das Modul die alte Marke
  const posMarke = p => (window.DFLOberflaeche && DFLOberflaeche.posMarke ? DFLOberflaeche.posMarke(p) : posBadge(p));
  // D112: Stil-Zeichen (dfl_ebenen_patch.js; Typ öffentlich, Prozente mit Bericht) und Filter „passt zu meinem Stil“
  const EB = () => (window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null);
  const stilZ = (p, klein) => (EB() ? EB().zeichenHtml(p, { klein }) : '');
  const stilFilter = key => (EB() && EB().filter(key) ? (p => EB().passtZuMir(p)) : null);
  const stilChip = (key, ps) => (EB() ? EB().filterChipHtml(key, ps.filter(p => EB().passtZuMir(p)).length) : '');
  // ── D99: Zu haben (will weg / Abgabe) ────────────────────────────────────
  const ZH_GRUND = { weg: 'will weg', cap: 'Cap-Not', neuaufbau: 'Neuaufbau', stil: 'Stil', ueberschuss: 'Überschuss' };
  const ZH_LANG = { weg: 'will weg', cap: 'Cap-Not', neuaufbau: 'Neuaufbau', stil: 'passt nicht zu ihrem Stil', ueberschuss: 'Überschuss' };
  const prozent = f => Math.round((f || 1) * 100) + ' %';
  const zhText = z => (z.art === 'weg' ? 'will weg' : 'Abgabe: ' + z.gruende.map(g => ZH_LANG[g] || g).join(', ')) + ' – günstiger zu haben';
  // D120: Urteil des Chefscouts als kleines Schild (Symbol + Wort) – Angebote, Trading Block
  const urteilChip = u => u ? `<span class="cs-chip ${u.key}" title="${esc(u.satz)}"><i class="ti ${u.icon}" aria-hidden="true"></i>${esc(u.name)}</span>` : '';
  const zhSchild = z => `<span class="tz-schild ${z.art === 'weg' ? 'weg' : 'ab'}" title="${esc(zhText(z))}">${ico(z.art === 'weg' ? 'door-exit' : 'tag')}${z.art === 'weg' ? 'will weg' : esc(ZH_GRUND[z.gruende[0]] || 'Abgabe')}</span>`;
  // Liste der Liga (ohne deinen Verein) – je Woche, Tausch und Kaderstand einmal gerechnet
  let zhCache = { k: '', liste: [] };
  function zuHabenLiga(L, A, rang) {
    if (!H.zuHabenListe) return [];
    const k = LEAGUE.season + ':' + LEAGUE.week + ':' + (L.handel || []).length + ':' + L.teams.reduce((s, t) => s + t.roster.length, 0) + ':' + (L.freie || []).length;
    if (zhCache.k !== k) zhCache = { k, liste: H.zuHabenListe(L, { ohne: [A.id], rang }) };
    return zhCache.liste;
  }
  const ZH_FILTER = [['alle', 'Alle'], ['weg', 'will weg'], ['cap', 'Cap-Not'], ['neuaufbau', 'Neuaufbau'], ['stil', 'Stil'], ['ueberschuss', 'Überschuss']];
  const ZH_ZEIGEN = 6;
  function zuHabenHtml(L, A, rang) {
    const alle = zuHabenLiga(L, A, rang);
    if (!H.zuHabenListe) return '';
    const zf = Z.zh = Z.zh || { f: 'alle', alle: false };
    const sort = z => (SC() ? SC().sortWert(z.p) : z.p.ovr);
    const sf = stilFilter('zuhaben');
    const liste = alle.filter(z => (zf.f === 'alle' || z.gruende.indexOf(zf.f) >= 0) && (!sf || sf(z.p))).map(z => ({ z, s: sort(z) })).sort((a, b) => b.s - a.s).map(x => x.z);
    const zeigen = zf.alle ? liste : liste.slice(0, ZH_ZEIGEN);
    const chips = ZH_FILTER.map(([k, t]) => { const n = k === 'alle' ? alle.length : alle.filter(z => z.gruende.indexOf(k) >= 0).length;
      return `<button type="button" class="tz-zh-chip" data-tz="zh-filter:${k}" aria-pressed="${zf.f === k}">${esc(t)} <b>${n}</b></button>`; }).join('') + stilChip('zuhaben', alle.map(z => z.p));
    const drin = new Set(Z.bekommt.spieler);
    const zeile = z => {
      const p = z.p, T = z.team, st = SC() ? SC().staerkeHtml(p, 'kurz') : `<span class="sc-zahl">${p.ovr}</span>`;
      const gruende = z.gruende.map(g => `<span class="tz-zh-grund ${g === 'weg' ? 'weg' : g}">${esc(ZH_GRUND[g] || g)}</span>`).join('');
      return `<button type="button" class="tz-zh-zeile${drin.has(p.id) && Z.partner === T.id ? ' drin' : ''}" data-tz="zh:${esc(T.id)}:${esc(p.id)}" title="${esc(name(p))} · ${esc(T.name)} · ${esc(zhText(z))} – antippen: in die Trade-Zentrale">
        ${wappenHtml(T, 'klein')}<span class="tz-zh-wer"><b>${esc(kurzname(p))}${stilZ(p, true)}</b><small>${posMarke(p)} ${p.age} J · ${esc(T.kurz || T.name)}</small><span class="tz-zh-gruende">${gruende}</span></span>
        <span class="tz-zh-werte">${st}</span></button>`;
    };
    // Nutzer 2026-10-22: überflüssiger Text raus: „· antippen = in den Tausch“ nur am Handy, am PC (body.pcu-an) bleibt nur die Preis-Legende
    const zhTipp = document.body.classList.contains('pcu-an') ? '' : ' · antippen = in den Tausch';
    return `<section class="tz-zh" aria-label="Zu haben in der Liga">
      <div class="tz-zh-kopf"><b>${ico('door-exit')}Zu haben in der Liga</b><small>will weg (Preis 85 %) · wird abgegeben (90 %)${zhTipp}</small></div>
      <div class="tz-zh-filter" role="group" aria-label="Grund">${chips}</div>
      <div class="tz-zh-liste">${zeigen.map(zeile).join('') || `<div class="tz-leer klein">${sf ? 'Niemand passt klar zu deinem Stil.' : 'Niemand mit diesem Grund.'}</div>`}</div>
      ${liste.length > ZH_ZEIGEN ? `<button type="button" class="tz-zh-mehr" data-tz="zh-alle">${zf.alle ? ico('chevron-up') + 'Weniger zeigen' : ico('chevron-down') + `Alle ${liste.length} zeigen`}</button>` : ''}
    </section>`;
  }
  function zuHabenZeichnen() {
    const el = document.getElementById('tz-zh-box');
    if (!el) return;
    try { const L = welt(), A = L.teams.find(t => t.id === eigenId()); el.innerHTML = zuHabenHtml(L, A, H.raenge(L)); } catch (e) { console.warn('[DFL-Trade] Zu haben', e); }
  }
  // Daten je Spieler: Sicht (Scouting – auch beim eigenen Kader nur geschätzt), Wert aus Sicht des Partners, Schilder (D50)
  function spielerDaten(L, A, B, rang, lgB) {
    const scout = scouting(), saat = STAND_SAAT();
    H.taktikenSetzen(L);
    const schutzB = H.schutzKarte(L, B, rang), interessiert = {};
    L.teams.forEach(t => (t.beobachtet || []).forEach(w => { if (w.team === A.id) (interessiert[w.id] = interessiert[w.id] || []).push(t.kurz || t.name); }));
    const unverk = w => { const q = spielSpieler(w); return !!(q && q !== w && A_() && A_().istUnverkaeuflich(q.id)); };
    const sortiert = T => T.roster.slice().sort((a, b) => b.ovr - a.ovr);
    // fremde: genau nur mit Scout-Bericht, sonst nach der groben Sicht deines Scoutings (D78)
    const sortiertFremd = T => SC() ? T.roster.map(p => ({ p, k: SC().sortWert(p) })).sort((a, b) => b.k - a.k).map(x => x.p) : sortiert(T);
    const fA = farbenVon(A), fB = farbenVon(B);
    // D99: wer beim Partner weg will oder abgegeben wird (Schild „will weg“ / „Abgabe“, Preis 85 / 90 %)
    const kB = H.abgabeKontext ? H.abgabeKontext(L, B, rang, schutzB) : null;
    const eigen = sortiert(A).map(p => ({ p, eigen: true, sicht: G.sichtAuf(p, scout, saat), wert: H.spielerWert(p, lgB, null), interesse: interessiert[p.id] || null,
      unverk: unverk(p), farben: fA, bild: spielSpieler(p) }));
    const fremd = sortiertFremd(B).map(p => ({ p, eigen: false, sicht: G.sichtAuf(p, scout, saat), wert: H.spielerWert(p, lgB, B), schild: schutzB.get(p.id) || null,
      zh: kB ? H.zuHabenInfo(L, B, p, kB) : null, farben: fB, bild: p }));
    const nachJahr = (x, y) => (x.jahr - y.jahr) || (x.runde - y.runde);
    return { eigen, fremd, picksA: L.picks.filter(x => x.besitzer === A.id).sort(nachJahr), picksB: L.picks.filter(x => x.besitzer === B.id).sort(nachJahr) };
  }
  // Karte oben (im Tausch): Gesicht mit Stärke, Name, Position mit Nebenpositionen, Alter · Cap Hit · Vertragsjahre; × nimmt heraus
  function karteHtml(x, seite, extra) {
    const p = x.p, st = staerke(x), c = p.contract, jahre = c ? c.years_remaining : 1;
    // Cap Hit bei dir: eingehende Spieler kommen ohne Handgeld (C4, bleibt beim alten Verein) – wie die Cap-Prüfung rechnet
    const hit = x.eigen ? G.capHitSpieler(p) : (c ? c.base_salary + (c.guaranteed_bonuses || 0) : 0);
    const pot = st.pot ? `<span>${esc(st.pot)}</span>` : '';
    const schilder = [];
    // verletzt (D102: Welt-Feld aus = Wochen, ausTyp = Art; beim eigenen Kader aus injuryWeeks gespiegelt)
    if (p.aus > 0) schilder.push(`<span class="tz-schild zu">${ico('first-aid-kit')}${esc(p.ausTyp || 'verletzt')} · ${p.aus} ${p.aus === 1 ? 'Woche' : 'Wochen'}</span>`);
    if (x.schild && x.schild.stufe === 'teuer') schilder.push(`<span class="tz-schild teuer">${ico('coin')}${faktorText(x.schild.faktor)} · ${esc(x.schild.grund)}</span>`);
    if (x.zh) schilder.push(zhSchild(x.zh));
    if (x.interesse) schilder.push(`<span class="tz-schild auge">${ico('eye')}Interesse: ${esc(x.interesse.join(', '))}</span>`);
    if (extra) schilder.push(extra);
    return `<button type="button" class="tz-karte" data-weg="${seite}:spieler:${esc(p.id)}" title="${esc(name(p))} herausnehmen" aria-label="${esc(name(p))} herausnehmen">
      <span class="tz-bild">${gesichtHtml(x.bild, x.farben)}<b class="tz-ovr ${esc(st.kl)}" title="${esc(st.titel)}">${esc(st.text)}</b></span>
      <span class="tz-wer"><b>${esc(kurzname(p))}${stilZ(p, true)}</b><small class="tz-pos-text">${esc(posText(p))}</small>
        <span class="tz-fakten"><span>${p.age} J</span><span>${zahl1(hit)} Mio</span><span class="${jahre <= 1 ? 'tz-letztes' : ''}">${jahre} J</span>${pot}</span>${schilder.join('')}</span>
      <i class="ti ti-x tz-weg" aria-hidden="true"></i></button>`;
  }
  function ticketHtml(L, x, seite, lg, rang) {
    const pw = H.pickWert(L, x, lg, rang), von = x.besitzer !== x.von ? L.teams.find(t => t.id === x.von) : null;
    return `<button type="button" class="tz-ticket" data-weg="${seite}:picks:${esc(x.id)}" title="Pick herausnehmen" aria-label="Pick ${x.jahr} Runde ${x.runde} herausnehmen">
      <span class="tz-wer"><b>${x.jahr} · R${x.runde}</b><small>${ico('ticket')}Pick ~${pw.platz}${von ? ' · ' + esc(von.kurz || von.name) : ''}</small></span>
      <i class="ti ti-x tz-weg" aria-hidden="true"></i></button>`;
  }
  // Vorrat (antippen = in den Tausch, noch einmal = heraus)
  function miniHtml(x, seite) {
    const p = x.p, st = staerke(x), an = Z[seite].spieler.indexOf(p.id) >= 0;
    const zu = !!(x.schild && x.schild.stufe === 'gesperrt');
    const ecke = zu ? `<span class="tz-ecke zu">${ico('lock')}</span>`
      : p.aus > 0 ? `<span class="tz-ecke zu">${ico('first-aid-kit')}${p.aus}</span>`
      : x.zh ? `<span class="tz-ecke ${x.zh.art === 'weg' ? 'weg' : 'ab'}">${ico(x.zh.art === 'weg' ? 'door-exit' : 'tag')}</span>`
      : x.schild && x.schild.stufe === 'teuer' ? `<span class="tz-ecke teuer">${faktorText(x.schild.faktor)}</span>`
        : x.interesse ? `<span class="tz-ecke auge">${ico('eye')}</span>` : x.unverk ? `<span class="tz-ecke">${ico('shield-lock')}</span>` : '';
    const titel = `${name(p)} · ${posText(p)} · ${p.age} J · ${st.titel}` + (p.aus > 0 ? ` · verletzt (${p.aus} ${p.aus === 1 ? 'Woche' : 'Wochen'})` : '') + (zu ? ` · nicht zu haben: ${x.schild.grund}` : x.schild && x.schild.stufe === 'teuer' ? ` · ${faktorText(x.schild.faktor)}: ${x.schild.grund}` : '') +
      (x.zh ? ' · ' + zhText(x.zh) : '') + (x.interesse ? ' · Interesse: ' + x.interesse.join(', ') : '') + (x.unverk ? ' · unverkäuflich (keine Anfragen)' : '');
    const z = stilZ(p, true);
    return `<button type="button" class="tz-mini${an ? ' drin' : ''}${zu ? ' zu' : ''}" data-add="${seite}:spieler:${esc(p.id)}" aria-pressed="${an}"${zu && !an ? ' disabled' : ''} title="${esc(titel)}" aria-label="${esc(titel)}">
      ${gesichtHtml(x.bild, x.farben)}<span class="tz-mini-ovr"><b${st.stufe ? ` class="${esc(st.kl)}"` : ''}>${esc(st.text)}</b>${posBadge(p)}</span><span class="tz-mini-name">${esc(p.name)}</span>${ecke}${z ? `<span class="tz-mini-stil">${z}</span>` : ''}<span class="tz-haken">${ico('check')}</span></button>`;
  }
  function miniPickHtml(L, x, seite, lg, rang) {
    const an = Z[seite].picks.indexOf(x.id) >= 0, pw = H.pickWert(L, x, lg, rang);
    const von = x.besitzer !== x.von ? L.teams.find(t => t.id === x.von) : null;
    const titel = `Pick ${x.jahr} · Runde ${x.runde} · erwartet ~${pw.platz}${von ? ' · von ' + (von.kurz || von.name) : ''}`;
    return `<button type="button" class="tz-mini pk${an ? ' drin' : ''}" data-add="${seite}:picks:${esc(x.id)}" aria-pressed="${an}" title="${esc(titel)}" aria-label="${esc(titel)}">
      ${ico('ticket')}<b>${x.jahr}</b><span>Runde ${x.runde}</span><small>~${pw.platz}${von ? ' ' + esc(von.kurz || '') : ''}</small><span class="tz-haken">${ico('check')}</span></button>`;
  }
  function vorratHtml(L, A, B, rang, lgB, dat) {
    const leiste = (inhalt, leerText) => `<div class="tz-leiste">${inhalt || `<span class="tz-leer klein">${leerText}</span>`}</div>`;
    // Nutzer 2026-10-22: überflüssiger Text raus: „antippen = mitgeben/haben wollen“ nur am Handy, am PC (body.pcu-an) weg
    const pc = document.body.classList.contains('pcu-an');
    return `<div class="tz-vorrat">
      <section class="tz-vorrat-teil ich" aria-label="Deine Spieler und Picks">
        <h5>Deine Spieler${pc ? '' : ' <small>antippen = mitgeben</small>'}</h5>${leiste(dat.eigen.map(x => miniHtml(x, 'gibt')).join(''), 'Keine Spieler')}
        <h5>Deine Picks</h5>${leiste(dat.picksA.map(x => miniPickHtml(L, x, 'gibt', lgB, rang)).join(''), 'Keine Picks')}
      </section>
      <section class="tz-vorrat-teil er" aria-label="Spieler und Picks von ${esc(B.name)}">
        <h5>Spieler ${esc(B.kurz || B.name)}${pc ? '' : ' <small>antippen = haben wollen</small>'}</h5>
        ${EB() ? `<div class="tz-vorrat-filter">${stilChip('vorrat', dat.fremd.map(x => x.p))}</div>` : ''}
        ${leiste(dat.fremd.filter(x => !stilFilter('vorrat') || stilFilter('vorrat')(x.p) || Z.bekommt.spieler.indexOf(x.p.id) >= 0).map(x => miniHtml(x, 'bekommt')).join(''), stilFilter('vorrat') ? 'Niemand passt klar zu deinem Stil' : 'Keine Spieler')}
        <h5>Picks ${esc(B.kurz || B.name)}</h5>${leiste(dat.picksB.map(x => miniPickHtml(L, x, 'bekommt', lgB, rang)).join(''), 'Keine Picks')}
      </section></div>`;
  }
  // Cap-Balken: Strich = vorher, Balken = nachher (Welt-Projektion; dazu „heute gezahlt“ aus dem Vertrag vorab), dicker Strich = Limit
  function capBalkenHtml(T, c, extra, ich) {
    const nach = c.nachher + (extra || 0), skala = Math.max(c.limit, c.vorher, nach) * 1.06 || 1;
    const pc = x => Math.max(0, Math.min(100, x / skala * 100)).toFixed(1);
    const zu = nach > c.limit + 1, d = nach - c.vorher;
    const diff = Math.abs(d) < 5e4 ? '±0' : (d > 0 ? '+' : '−') + zahl1(Math.abs(d));
    return `<div class="tz-cap ${ich ? 'ich' : 'er'}${zu ? ' zu' : ''}">
      ${wappenHtml(T, 'klein')}
      <span class="tz-cap-bahn" role="img" aria-label="Cap ${esc(T.name)}: vorher ${zahl1(c.vorher)}, nachher ${zahl1(nach)} von ${zahl1(c.limit)} Mio €${zu ? ', über dem Limit' : ''}">
        <i class="tz-cap-nach" style="width:${pc(nach)}%"></i><i class="tz-cap-vor" style="left:${pc(c.vorher)}%"></i><i class="tz-cap-grenze" style="left:${pc(c.limit)}%"></i></span>
      <span class="tz-cap-zahl"><b>${zahl1(nach)}</b><small>${diff} · Limit ${zahl1(c.limit)}</small></span></div>`;
  }

  // ── D86: Vertrag vorab ───────────────────────────────────────────────────
  const SWV = () => (window.DFLSaisonwechsel && DFLSaisonwechsel.tauschVertrag && DFLSaisonwechsel.angebotFuer ? window.DFLSaisonwechsel : null);
  // Nur bei 1 Restjahr (Vorschau-Vorschlag, freigegeben); Development-Squad-Verträge nicht
  const vorabMoeglich = w => !!(w && w.contract && w.contract.years_remaining === 1 && w.contract.art !== 'perspektiv');
  const neinKey = w => LEAGUE.season + ':' + w.id;
  // Ob er vorab unterschreibt: Stimmung gegenüber dem neuen Verein (Chance), je Spieler und Saison fest gewürfelt (kein Neuladen-Glück)
  const zufallVorab = w => G.hashText('vorab:' + w.id + ':' + LEAGUE.season + ':' + (CLUB.dfl.seed || 1)) / 4294967296;
  // Forderung aus Sicht des neuen Vereins (wie ein Free Agent, D40: DFLGenerator.forderung ohne Treuerabatt) in Euro der Startsaison;
  // Chance aus der Stimmung gegenüber deinem Verein (DFLStimmung, Sicht eines Fremden: Teamerfolg, Hype, Bühne, Rolle …)
  function forderungNeu(w, capStart) {
    const L = D.welt(), t = L.teams.find(x => x.id === eigenId());
    if (!t) return null;
    const titel = L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).slice(0, 8).some(x => x.id === t.id);
    const ctx = { eigenerVerein: false, titelkandidat: titel, prestige: t.prestige || 0 };
    const alt = G.CFG.cap;
    G.setzeCap(capStart || K.cap());
    try {
      const f = G.forderung(w, t, ctx), st = window.DFLStimmung && DFLStimmung.stimmung ? DFLStimmung.stimmung(w, t, L) : null;
      return { jahresWert: f.jahresWert, jahre: Math.max(1, Math.min(5, f.jahre || 2)), handgeldAnteil: f.handgeldAnteil, staffelung: f.staffelung || 'gleich',
        gruende: (f.gruende || []).slice(0, 3), chance: st ? st.chance : 100, key: st ? st.bereitschaft.key : 'bereit', text: st ? st.bereitschaft.text : '' };
    } finally { G.setzeCap(alt); }
  }
  // Kader nach dem Tausch (Spiel): ohne die Abgegebenen, mit den Neuen so, wie ausfuehrenDeal sie anlegt (Handgeld bleibt beim
  // alten Verein, C4); Dead Cap des Tauschs = Rest-Handgeld der Abgegebenen (Welt, wie H.ausfuehren bucht); Pick-Besitz danach
  // (Rookie-Verträge des kommenden Drafts im Cap-Plan)
  function kontextFuer(A, B, deal) {
    const weg = new Set((deal.gibt.spieler || []).map(id => { const w = A.roster.find(x => x.id === id); return w ? (w.sq || w.id) : id; }));
    const neu = (deal.bekommt.spieler || []).map(id => B.roster.find(x => x.id === id)).filter(Boolean)
      .map(w => D.zuSpielSpieler(Object.assign({}, w, { contract: w.contract ? Object.assign({}, w.contract, { signing_bonus_total: 0 }) : w.contract })));
    const deadExtra = (deal.gibt.spieler || []).map(id => A.roster.find(x => x.id === id)).filter(Boolean).reduce((s, w) => s + H.restBonus(w), 0);
    const pickBesitz = new Map();
    (deal.gibt.picks || []).forEach(id => pickBesitz.set(id, B.id));
    (deal.bekommt.picks || []).forEach(id => pickBesitz.set(id, A.id));
    return { kader: SQUAD.filter(q => !weg.has(q.id)).concat(neu), deadExtra, neu, pickBesitz };
  }
  // Cap und Kosten des Tauschs je Seite, wie ausfuehrenDeal bucht: Dead Cap = Rest-Handgeld der Abgegebenen (H.restBonus, wie
  // H.ausfuehren), sofort bezahlt über DFLKader.deadCapBuchen (Geld = deadCapGeld); Cap danach im Spiel = Cap Hits des Kaders
  // danach (capHitJahr, Neue ohne Handgeld wie zuSpielSpieler) + Dead Cap (Cap Welt = Spiel); Partner: H.capNach (Welt).
  // heute: Vorauszahlung eines Vertrags vorab (D86), gebucht wie Dead Cap
  function kosten(deal, heute) {
    if (!dfl() || !deal) return null;
    const L = welt(), A = L.teams.find(t => t.id === deal.von), B = L.teams.find(t => t.id === deal.an);
    if (!A || !B) return null;
    const gA = (deal.gibt.spieler || []).map(id => A.roster.find(x => x.id === id)).filter(Boolean);
    const gB = (deal.bekommt.spieler || []).map(id => B.roster.find(x => x.id === id)).filter(Boolean);
    const restA = gA.reduce((s, w) => s + H.restBonus(w), 0), restB = gB.reduce((s, w) => s + H.restBonus(w), 0);
    const dead0 = CLUB.dfl.deadCap || 0, deadNeu = Math.max(0, (A.dead_cap_total || 0) + restA - dead0);
    const kx = kontextFuer(A, B, deal), vorab = Math.max(0, heute || 0);
    const capA = kx.kader.reduce((s, q) => s + K.capHitJahr(q), 0) + dead0 + deadNeu + vorab;
    const geld = (K.deadCapGeld ? K.deadCapGeld(deadNeu) + K.deadCapGeld(vorab) : Math.round((deadNeu + vorab) * 1.1));
    return { A, B, capA, limitA: K.capLimit(), deadA: deadNeu, vorab, geldA: geld,
      capB: H.capNach(B, gB, gA), limitB: B.salary_cap_limit, deadB: restB };
  }
  const euro = x => (typeof formatEuro === 'function' ? formatEuro(x) : mioE(x));
  function kostenHtml(deal, heute) {
    let k = null;
    try { k = kosten(deal, heute); } catch (e) { console.warn('[DFL-Trade] Kosten', e); }
    if (!k) return '';
    const zeile = (T, cap, limit, dead, geld, ich) => `<div class="tz-kosten-zeile${cap > limit + 1 ? ' zu' : ''}">
        ${wappenHtml(T, 'klein')}<span class="tz-kosten-text"><b>${ich ? 'Du' : esc(T.kurz || T.name)}: Cap danach ${zahl1(cap)} von ${zahl1(limit)} Mio €</b>
        <small>${dead > 0 ? 'Dead Cap ' + euro(dead) + ' (Handgeld-Rest)' : 'kein Dead Cap'}${ich ? ' · ' + (geld > 0 ? 'sofort bezahlt ' + euro(geld) : 'keine Kosten sofort') : ''}</small></span></div>`;
    return `<div class="tz-kosten">${zeile(k.A, k.capA, k.limitA, k.deadA + k.vorab, k.geldA, true)}${zeile(k.B, k.capB, k.limitB, k.deadB, 0, false)}</div>`;
  }
  // Lage des vereinbarten Vertrags im aktuellen Tausch: Angebot mit dem Kader danach; ok = Cap der Startsaison hält
  function vertragLage(L, A, B, deal, V) {
    const SW = SWV();
    if (!V || !SW) return null;
    const w = B && B.roster.find(x => x.id === V.id);
    if (!w || (deal.bekommt.spieler || []).indexOf(V.id) < 0) return { ok: false, weg: true, grund: 'Der Spieler des Vertrags vorab ist nicht mehr im Tausch.' };
    const kx = kontextFuer(A, B, deal), q = kx.neu.find(x => x.dflId === w.id);
    if (!q) return { ok: false, weg: true, grund: 'Der Spieler des Vertrags vorab ist nicht mehr im Tausch.' };
    const a = SW.angebotFuer(q, { kontext: kx, f: V.f, staffel: V.staffel, vorab: V.vorab });
    return { ok: a.capOk, w, q, kx, a, grund: a.capOk ? '' : `Vertrag vorab: Cap ${kl(a.start)} läge ${mioE(a.ueber)} über dem Limit – Vertrag ändern oder streichen.` };
  }
  // Angebot für einen eingehenden Spieler im Tausch (Werkzeuge, Prüflauf): ohne Vereinbarung, ohne Würfel
  function vorabAngebot(deal, wId, opt) {
    opt = opt || {};
    const SW = SWV(); if (!SW) return null;
    const L = welt(), A = L.teams.find(t => t.id === eigenId()), B = L.teams.find(t => t.id === deal.an);
    const w = B && B.roster.find(x => x.id === wId);
    if (!w || !vorabMoeglich(w) || (deal.bekommt.spieler || []).indexOf(wId) < 0) return null;
    const kx = kontextFuer(A, B, deal), q = kx.neu.find(x => x.dflId === wId);
    const f = opt.f || forderungNeu(w, K.capNaechste().cap);
    const a = SW.angebotFuer(q, { kontext: kx, f, staffel: opt.staffel, vorab: opt.vorab });
    return { w, q, kx, f, a, zusage: zufallVorab(w) * 100 < (f.chance != null ? f.chance : 100) };
  }
  function vorabHtml(B, deal, vl) {
    if (!SWV()) return '';
    const kand = (deal.bekommt.spieler || []).map(id => B.roster.find(x => x.id === id)).filter(vorabMoeglich);
    if (!kand.length) return '';
    return kand.map(w => {
      const V = Z.vertrag && Z.vertrag.id === w.id ? Z.vertrag : null;
      if (V && vl && vl.a) {
        const a = vl.a, frei = a.plan.spalten[a.k] ? a.plan.spalten[a.k].frei : 0;
        return `<div class="tz-vorab an${vl.ok ? '' : ' zu'}">${ico('signature')}<div class="tz-vorab-text"><b>Vertrag vorab: ${esc(kurzname(w))}</b>
          <small>${mioE(a.gesamt)} über ${a.jahre} J ab ${esc(kl(a.start))} · ${esc(a.staffel)}${a.vorab ? ` · ${mioE(a.vorab)} heute` : ''}</small>
          <small class="${vl.ok ? 'gut' : 'schlecht'}">${vl.ok ? `Cap ${esc(kl(a.start))} danach: ${mioE(Math.max(0, frei))} frei` : esc(vl.grund)}</small></div>
          <div class="tz-vorab-knoepfe"><button type="button" class="app-knopf" data-tz="vorab:${esc(w.id)}">${ico('pencil')}Ändern</button>
          <button type="button" class="app-knopf rot" data-tz="vorab-weg">${ico('x')}Streichen</button></div></div>`;
      }
      if (Z.nein.has(neinKey(w))) return `<div class="tz-vorab nein">${ico('hand-stop')}<div class="tz-vorab-text"><b>${esc(kurzname(w))} will vorab nicht verlängern</b>
        <small>Der Tausch geht trotzdem – ohne Vertrag; sein Vertrag endet nach dieser Saison.</small></div></div>`;
      const anderer = Z.vertrag && Z.vertrag.id !== w.id ? ' Ein Vertrag vorab je Trade – er ersetzt den anderen.' : '';
      return `<div class="tz-vorab">${ico('file-certificate')}<div class="tz-vorab-text"><b>${esc(kurzname(w))}: Vertrag endet nach dieser Saison</b>
        <small>Vertrag vorab anbieten – gilt nur zusammen mit dem Trade.${anderer}</small></div>
        <div class="tz-vorab-knoepfe"><button type="button" class="app-knopf" data-tz="vorab:${esc(w.id)}">${ico('signature')}Vertrag vorab</button></div></div>`;
    }).join('');
  }
  // Blatt öffnen (dfl_saisonwechsel_patch.js, Tausch-Modus)
  function vertragOeffnen(wId) {
    const SW = SWV(); if (!SW) return;
    const L = welt(), A = L.teams.find(t => t.id === eigenId()), B = L.teams.find(t => t.id === Z.partner);
    const deal = aktuellerDeal(), w = B && B.roster.find(x => x.id === wId);
    if (!w || !vorabMoeglich(w) || deal.bekommt.spieler.indexOf(wId) < 0) return;
    const kx = kontextFuer(A, B, deal), q = kx.neu.find(x => x.dflId === wId);
    const V = Z.vertrag && Z.vertrag.id === wId ? Z.vertrag : null;
    const f = V ? V.f : forderungNeu(w, K.capNaechste().cap);
    if (!q || !f) return;
    SW.tauschVertrag({ p: q, kontext: kx, f, von: B.name, staffel: V ? V.staffel : null, vorab: V ? V.vorab : 0, vereinbart: !!V, nein: Z.nein.has(neinKey(w)),
      vereinbaren: o => {
        // schon vereinbart: nur Verteilung/heute zahlen ändern; neu: er entscheidet (fest je Saison)
        if (!V && !(zufallVorab(w) * 100 < (f.chance != null ? f.chance : 100))) {
          Z.nein.add(neinKey(w));
          return { ok: false, nein: true, grund: `${name(w)} lehnt ab (${f.chance} % · ${f.text || 'skeptisch'}) – der Tausch geht ohne Vertrag.` };
        }
        Z.vertrag = { id: w.id, staffel: o.staffel, vorab: o.vorab, f };
        Z.meldung = '';
        return { ok: true };
      },
      streichen: () => { Z.vertrag = null; Z.meldung = ''; },
      zurueck: () => aktualisieren() });
  }

  // ── Reiter „Trades“ ──────────────────────────────────────────────────────
  const aktuellerDeal = () => ({ von: eigenId(), an: Z.partner, gibt: Z.gibt, bekommt: Z.bekommt });
  // Alles, was Karten, Urteil und Knöpfe brauchen (bei jedem Antippen neu; der Vorrat wird nur beim vollen Zeichnen gebaut)
  function rechne() {
    const L = welt(), A = L.teams.find(t => t.id === eigenId()), rang = H.raenge(L);
    const partner = L.teams.filter(t => t.id !== A.id).sort((a, b) => a.name.localeCompare(b.name));
    if (!Z.partner || !partner.some(t => t.id === Z.partner)) Z.partner = partner[0].id;
    const B = L.teams.find(t => t.id === Z.partner), lgB = H.lage(L, B, rang), lgA = H.lage(L, A, rang);
    // nur, was noch da ist (nach einem Tausch der KI, einem Spielerwechsel oder einem neuen Jahrgang)
    const da = (liste, T) => liste.filter(id => T.roster.some(p => p.id === id));
    const pkDa = (liste, T) => liste.filter(id => L.picks.some(x => x.id === id && x.besitzer === T.id));
    Z.gibt = { spieler: da(Z.gibt.spieler, A), picks: pkDa(Z.gibt.picks, A) };
    Z.bekommt = { spieler: da(Z.bekommt.spieler, B), picks: pkDa(Z.bekommt.picks, B) };
    const deal = aktuellerDeal(), e = H.bewerte(L, deal, optFuer(deal));
    let vl = Z.vertrag ? vertragLage(L, A, B, deal, Z.vertrag) : null;
    if (vl && vl.weg) { Z.vertrag = null; vl = null; }
    return { L, A, B, rang, lgA, lgB, partner, deal, e, vl, dat: spielerDaten(L, A, B, rang, lgB) };
  }
  function obenHtml(c) {
    const { L, A, B, rang, lgA, lgB, e, vl, dat } = c;
    const stilA = H.stilVon(A), stilB = H.stilVon(B);
    const kein = new Set(e.keinBedarf || []);
    const gib = Z.gibt.spieler.map(id => dat.eigen.find(x => x.p.id === id)).filter(Boolean)
      .map(x => karteHtml(x, 'gibt', kein.has(x.p.id) ? `<span class="tz-schild zu">${ico('mood-empty')}kein Bedarf bei ${esc(B.kurz || B.name)}</span>` : '')).join('') +
      Z.gibt.picks.map(id => L.picks.find(x => x.id === id)).filter(Boolean).map(x => ticketHtml(L, x, 'gibt', lgB, rang)).join('');
    const bek = Z.bekommt.spieler.map(id => dat.fremd.find(x => x.p.id === id)).filter(Boolean).map(x => karteHtml(x, 'bekommt')).join('') +
      Z.bekommt.picks.map(id => L.picks.find(x => x.id === id)).filter(Boolean).map(x => ticketHtml(L, x, 'bekommt', lgB, rang)).join('');
    const leerDeal = !Z.gibt.spieler.length && !Z.gibt.picks.length && !Z.bekommt.spieler.length && !Z.bekommt.picks.length;
    const quote = e.kiBraucht ? Math.min(1.3, e.kiErhaelt / e.kiBraucht) : 0;
    // Harte Gründe (Cap, Kader, Startelf-Lücke, gesperrt) sind kein „Knapp“ – der Wert allein reicht dann nicht
    const g = e.grund || '', hart = /^Cap|^Kader|nicht zu haben|zu wenige|nicht mehr zu diesem Verein/.test(g);
    const farbe = e.akzeptiert ? 'gut' : !hart && quote >= 0.9 ? 'knapp' : 'schlecht';
    const chip = leerDeal ? 'Paket wählen' : e.akzeptiert ? 'Deal' : /^Cap/.test(g) ? 'Cap' : /^Kader|zu wenige/.test(g) ? 'Kader' : hart ? 'Gesperrt' : quote >= 0.9 ? 'Knapp' : 'Nein';
    const heute = vl && vl.ok && vl.a ? vl.a.vorab : 0;
    // Nutzer 2026-10-22: überflüssiger Text raus: leere Seite am PC (body.pcu-an) ohne „Unten antippen“, am Handy unverändert
    const leerTipp = document.body.classList.contains('pcu-an') ? '' : 'Unten antippen';
    const seite = (kls, T, lg, stil, titel, inhalt) => `<section class="tz-seite ${kls}" aria-label="${titel}">
        <div class="tz-seite-kopf">${wappenHtml(T)}<span><b>${titel}</b><small>${esc(T.kurz || T.name)}${stil ? ' · ' + esc(H.STIL_TEXT[stil]) : ''}</small></span>${schildLage(lg)}</div>
        ${inhalt || `<div class="tz-leer">${leerTipp}</div>`}</section>`;
    return `<div class="tz-seiten">${seite('ich', A, lgA, stilA, 'Du gibst', gib)}${seite('er', B, lgB, stilB, 'Du bekommst', bek)}</div>
      ${SC() ? SC().tauschLeiste(B, Z.bekommt.spieler) : ''}
      ${!leerDeal && !hart && CS() ? CS().urteilHtml(CS().urteil(L, c.deal)) : ''}
      <div class="dfl-tr-urteil tz-urteil ${farbe}" aria-live="polite">
        <div class="dfl-tr-meter-kopf"><b>${esc(B.kurz || B.name)}</b><span class="dfl-tr-chip ${farbe}">${chip}</span></div>
        <div class="tz-grund">${esc(e.grund)}</div>
        ${(e.zuHaben || []).length ? `<div class="dfl-draft-sub tz-zh-hinweis">${ico('discount-2')}${(e.zuHaben || []).map(z => { const x = dat.fremd.find(f => f.p.id === z.id);
          return esc(x ? kurzname(x.p) : z.id) + ' ' + (z.art === 'weg' ? 'will weg' : 'wird abgegeben') + ': günstiger zu haben'; }).join(' · ')}</div>` : ''}
        <div class="tz-caps">${capBalkenHtml(A, e.cap.a, heute, true)}${capBalkenHtml(B, e.cap.b, 0, false)}</div>
        ${leerDeal ? '' : kostenHtml(c.deal, heute)}
        ${e.hinweise.length ? `<div class="dfl-draft-sub">${esc(e.hinweise.join(' · '))}</div>` : ''}
      </div>
      ${vorabHtml(B, c.deal, vl)}`;
  }
  function untenHtml(c) {
    const { B, e, vl } = c, f = fenster();
    const gs = gespraech(B.id), abgebrochen = gs.n >= MAX_ANFRAGEN;
    const leerDeal = !Z.gibt.spieler.length && !Z.gibt.picks.length && !Z.bekommt.spieler.length && !Z.bekommt.picks.length;
    const hart = /^Cap|^Kader|nicht zu haben/.test(e.grund || '');
    const mitV = !!(Z.vertrag && vl && vl.a), vertragZu = mitV && !vl.ok;
    const gesperrt = !f.ok || leerDeal || hart || abgebrochen || (e.akzeptiert && vertragZu);
    const haupt = e.akzeptiert ? (mitV ? 'Tausch + Vertrag' : 'Tausch abschließen') : 'Anfrage senden';
    const sub = !f.ok ? 'Wechselfenster zu' : leerDeal ? 'erst Spieler oder Picks wählen' : e.akzeptiert
      ? (vertragZu ? 'Vertrag vorab passt nicht in den Cap' : mitV ? `${kurzname(vl.w)} verlängert ab ${kl(vl.a.start)}` : `${B.kurz || B.name} ist einverstanden`)
      : abgebrochen ? 'Gespräche abgebrochen' : `abgelehnte Anfragen ${gs.n}/${MAX_ANFRAGEN}`;
    try { const u = document.getElementById('tz-unten'); if (u) u.classList.toggle('fest', !leerDeal); } catch (e) { /* ohne DOM */ }
    return `${Z.meldung ? `<div class="tz-meldung">${esc(Z.meldung)}</div>` : ''}
      ${abgebrochen ? `<div class="tz-meldung">${esc(B.name)} hat die Gespräche nach ${MAX_ANFRAGEN} abgelehnten Anfragen abgebrochen – im nächsten Wechselfenster wieder.</div>` : ''}
      <div class="tz-knoepfe">
        <button type="button" class="app-knopf" data-tz="dazu" aria-label="Was müsste ich dazugeben?">${ico('scale')}<span class="tz-k-text">Was müsste ich dazugeben?</span></button>
        <button type="button" class="app-knopf" data-tz="leeren" aria-label="Leeren">${ico('eraser')}<span class="tz-k-text">Leeren</span></button>
        <button type="button" class="app-knopf haupt" data-tz="los"${gesperrt ? ' disabled' : ''}>${ico(e.akzeptiert ? (mitV ? 'signature' : 'arrows-exchange') : 'send')}<span class="ak-zwei">${haupt}<small>${esc(sub)}</small></span></button>
      </div>`;
  }
  function tradesHtml() {
    const c = rechne(), { L, A, B, rang, lgA, lgB, partner, dat } = c;
    const elfB = G.startelfVon(B.roster), alterB = elfB.reduce((s, p) => s + p.age, 0) / Math.max(1, elfB.length);
    const f = fenster();
    const opt = partner.map(t => {
      const lg = H.lage(L, t, rang), frei = t.salary_cap_limit - G.capHitTeam(t);
      const ab = gespraech(t.id).n >= MAX_ANFRAGEN ? ' · Gespräche abgebrochen' : '';
      return `<option value="${t.id}" ${t.id === B.id ? 'selected' : ''}>${t.name} · ${lg.text} · Cap ${frei >= 0 ? 'frei ' + mio(frei) : mio(-frei) + ' drüber'}${ab}</option>`;
    }).join('');
    return `<div class="dfl-tr tz" data-partner="${esc(B.id)}">
      <div class="tz-kopf"><b>Trade-Zentrale</b><span class="tz-frist${f.ok ? '' : ' zu'}">${ico('clock')}${esc(f.ok ? f.text : 'Trade-Deadline vorbei')}</span></div>
      <div class="dfl-tr-partner"><select onchange="DFLTrade.partner(this.value)" aria-label="Trade-Partner">${opt}</select></div>
      <div class="tz-lage">Du: <b>${esc(lgA.text)}</b> (Rang ${lgA.rang}) · ${esc(B.kurz || B.name)}: <b>${esc(lgB.text)}</b> (Rang ${lgB.rang}, Startelf Ø ${alterB.toFixed(1).replace('.', ',')} J.)${f.ok ? '' : ` · ${esc(f.text)}`}</div>
      ${window.DFLLage && DFLLage.partnerHtml ? DFLLage.partnerHtml(L, B, rang) : ''}
      <div id="tz-zh-box">${zuHabenHtml(L, A, rang)}</div>
      <div id="tz-oben" class="tz-oben">${obenHtml(c)}</div>
      ${vorratHtml(L, A, B, rang, lgB, dat)}
      <div id="tz-unten" class="tz-unten${!Z.gibt.spieler.length && !Z.gibt.picks.length && !Z.bekommt.spieler.length && !Z.bekommt.picks.length ? '' : ' fest'}">${untenHtml(c)}</div>
      <div id="tz-block">${blockHtml(L, A)}</div>
      ${logHtml()}
    </div>`;
  }
  // Letzte Trades der Liga (KI untereinander und Draft-Trades, dfl_kader_patch.js)
  function logHtml() {
    const log = (CLUB.dfl && CLUB.dfl.tradeLog) || [];
    if (!log.length) return '<div class="dfl-tr-log dfl-draft-sub">Noch keine Trades in der Liga – die KI-Teams handeln in der Vorbereitung und bis zur Deadline.</div>';
    return `<div class="dfl-tr-log"><b>Letzte Trades in der DKL</b><ul class="dfl-draft-letzte" style="columns:1">${log.slice(0, 12).map(x =>
      `<li><span class="dfl-draft-sub">Saison ${x.s}${x.w ? ', Woche ' + x.w : ''}:</span> ${x.t}</li>`).join('')}</ul></div>`;
  }
  // Trading Block: Angebote der KI-Teams für einen eigenen Spieler
  function blockHtml(L, A) {
    const opt = A.roster.slice().sort((a, b) => b.ovr - a.ovr).map(p => `<option value="${p.id}" ${p.id === Z.block ? 'selected' : ''}>${name(p)} (${posText(p)}, ${p.age}, OVR ${p.ovr})</option>`).join('');
    let angebote = '';
    if (Z.block && A.roster.some(p => p.id === Z.block)) {
      const liste = H.angeboteFuer(L, A.id, Z.block, 5);
      angebote = liste.length ? liste.map((a, i) => `<div class="dfl-tr-angebot"><div><b>${a.team.name}</b> <span class="dfl-draft-sub">(${a.lage.text})</span><br>
          ${a.paket.map(x => SC() && x.art === 'spieler' ? SC().teilText(x.text, a.team, x.id) : x.text).join(' + ')}</div><div>${CS() ? urteilChip(CS().urteil(L, a.deal)) : ''}
          <button class="dfl-draft-btn" onclick="DFLTrade.angebot(${i})">Annehmen</button></div></div>`).join('')
        : '<div class="dfl-draft-sub">Kein Team macht gerade ein Angebot.</div>';
      Z._angebote = liste;
    }
    return `<div class="dfl-tr-block"><b>Trading Block</b> <span class="dfl-draft-sub">– Wer bietet was für einen deiner Spieler?</span>
      <div class="dfl-tr-partner"><select onchange="DFLTrade.block(this.value)"><option value="">Spieler wählen …</option>${opt}</select></div>${angebote}</div>`;
  }

  // ── Reiter „Wertliste“ ───────────────────────────────────────────────────
  function werteHtml() {
    const L = welt(), rang = H.raenge(L), A = L.teams.find(t => t.id === eigenId());
    const nr = [1, 2, 3, 4, 5, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80, 96, 112, 128];
    const picks = nr.map(n => `<tr><td class="num">${n}</td><td>Runde ${Math.ceil(n / 32)}</td><td class="num"><b>${H.pickWertNr(n)}</b></td><td class="num">${H.pickWertNr(n, 1)}</td></tr>`).join('');
    const alle = [];
    L.teams.forEach(t => { const lg = H.lage(L, t, rang); t.roster.forEach(p => alle.push({ p, t, w: H.spielerWert(p, lg, t) })); });
    alle.sort((a, b) => b.w - a.w);
    // D78: fremde Spieler ohne Scout-Bericht nur mit Stufe; Name antippen öffnet Bericht bzw. „Scouten“; D112: Stil-Zeichen am Namen
    const fremdName = x => SC() && x.t.id !== A.id ? `<button type="button" class="sc-namelink" data-sc="blatt:${esc(x.p.id)}">${esc(name(x.p))}${stilZ(x.p, true)}</button>` : `<b>${name(x.p)}</b>${stilZ(spielSpieler(x.p), true)}`;
    const fremdOvr = x => SC() && x.t.id !== A.id ? SC().staerkeHtml(x.p, 'kurz') : x.p.ovr;
    const sf = stilFilter('werte'), alle40 = alle.slice(0, 40);
    const top = alle40.map((x, i) => ({ x, i })).filter(({ x }) => !sf || sf(x.t.id === A.id ? spielSpieler(x.p) : x.p)).map(({ x, i }) => `<tr class="${x.t.id === A.id ? 'fcm-row' : ''}"><td class="num">${i + 1}</td><td>${fremdName(x)}<div class="dfl-draft-sub">${x.t.name}</div></td>
      <td>${posText(x.p)}</td><td class="num">${x.p.age}</td><td class="num">${fremdOvr(x)}</td><td class="num">${mio(G.capHitSpieler(x.p))}</td><td class="num"><b>${Math.round(x.w)}</b></td></tr>`).join('');
    const lgA = H.lage(L, A, rang);
    const eigene = A.roster.map(p => ({ p, w: H.spielerWert(p, lgA, A) })).filter(x => !sf || sf(spielSpieler(x.p))).sort((a, b) => b.w - a.w).map(x => `<tr><td><b>${name(x.p)}</b>${stilZ(spielSpieler(x.p), true)}</td><td>${posText(x.p)}</td>
      <td class="num">${x.p.age}</td><td class="num">${x.p.ovr}</td><td class="num">${mio(G.capHitSpieler(x.p))}</td><td class="num"><b>${Math.round(x.w)}</b></td></tr>`).join('');
    const kopf = cols => `<table class="lg-table dfl-tabelle"><thead><tr>${cols.map(c => `<th${/Wert|Pick|Alter|OVR|Cap|#/.test(c) ? ' class="num"' : ''}>${c}</th>`).join('')}</tr></thead><tbody>`;
    const stilN = EB() ? alle40.map(x => x.t.id === A.id ? spielSpieler(x.p) : x.p).concat(A.roster.map(spielSpieler)) : [];
    return `<div class="dfl-tr">
      <div class="dfl-draft-sub" style="margin-bottom:8px"><b>Wert</b> = Stärke (überproportional) + Potenzial bei Jungen − Alter ab 29 ± Vertrag</div>
      <div class="dfl-tr-spalten">
        <div class="dfl-tr-spalte"><h4>Pick-Wertkurve</h4>${kopf(['Pick', 'Runde', 'Wert', 'Nächstes Jahr'])}${picks}</tbody></table>
          ${EB() ? `<div class="tz-werte-filter">${stilChip('werte', stilN)}</div>` : ''}
          <h4 style="margin-top:12px">Dein Kader (${lgA.text})</h4>${kopf(['Spieler', 'Pos', 'Alter', 'OVR', 'Cap Hit', 'Wert'])}${eigene}</tbody></table></div>
        <div class="dfl-tr-spalte"><h4>Die 40 wertvollsten Spieler der DKL</h4>${kopf(['#', 'Spieler', 'Pos', 'Alter', 'OVR', 'Cap Hit', 'Wert'])}${top}</tbody></table></div>
      </div></div>`;
  }

  // ── Aktionen ─────────────────────────────────────────────────────────────
  // Voll zeichnen (Partner, Rückkehr in den Reiter, nach dem Tausch); beim Antippen nur Karten, Urteil und Knöpfe neu und
  // im Vorrat die Markierung – der Vorrat hat 50+ Gesichter (je ~8 KB SVG), ihn bei jedem Tippen neu zu bauen wäre am Handy träge
  function zeichne() {
    const t = document.getElementById('tr-sub-trades'), w = document.getElementById('tr-sub-werte');
    try {
      if (t && t.classList.contains('active')) t.innerHTML = tradesHtml();
      if (w && w.classList.contains('active')) w.innerHTML = werteHtml();
    } catch (e) { console.warn('[DFL-Trade] Anzeige', e); }
  }
  function aktualisieren() {
    const box = document.getElementById('tr-sub-trades');
    if (!box || !box.classList.contains('active')) return;
    const wurzel = box.querySelector('.tz'), oben = box.querySelector('#tz-oben'), unten = box.querySelector('#tz-unten');
    if (!wurzel || !oben || !unten || wurzel.getAttribute('data-partner') !== Z.partner) { zeichne(); return; }
    try {
      const c = rechne();
      if (wurzel.getAttribute('data-partner') !== Z.partner) { zeichne(); return; }
      oben.innerHTML = obenHtml(c);
      unten.innerHTML = untenHtml(c);
      box.querySelectorAll('.tz-vorrat [data-add]').forEach(b => {
        const [seite, art, id] = teile(b.getAttribute('data-add')), an = !!(Z[seite] && Z[seite][art].indexOf(id) >= 0);
        b.classList.toggle('drin', an); b.setAttribute('aria-pressed', String(an));
        if (b.classList.contains('zu')) b.disabled = !an;
      });
    } catch (e) { console.warn('[DFL-Trade] Anzeige', e); zeichne(); }
  }
  const teile = s => { const a = String(s).indexOf(':'), b = String(s).indexOf(':', a + 1); return [s.slice(0, a), s.slice(a + 1, b), s.slice(b + 1)]; };
  // Ein Klick-Empfänger für die ganze Zentrale (Karten heraus, Vorrat an/aus, Knöpfe)
  function klick(ev) {
    const box = ev.target.closest && ev.target.closest('#tr-sub-trades');
    if (!box || !dfl()) return;
    const t = ev.target.closest('[data-add],[data-weg],[data-tz]');
    if (!t || t.disabled || !box.contains(t)) return;
    if (t.hasAttribute('data-add') || t.hasAttribute('data-weg')) {
      const weg = t.hasAttribute('data-weg'), [seite, art, id] = teile(t.getAttribute(weg ? 'data-weg' : 'data-add'));
      const liste = Z[seite] && Z[seite][art];
      if (!liste) return;
      const i = liste.indexOf(id);
      if (i >= 0) liste.splice(i, 1); else if (!weg) liste.push(id);
      Z.meldung = ''; aktualisieren();
      return;
    }
    const was = t.getAttribute('data-tz');
    // D99: Filter „Zu haben“ (nur der Block neu), alle zeigen, Spieler antippen = Partner + in den Tausch
    if (/^zh-filter:/.test(was)) { Z.zh = Object.assign(Z.zh || {}, { f: was.slice(10), alle: false }); zuHabenZeichnen(); return; }
    if (was === 'zh-alle') { Z.zh = Object.assign(Z.zh || { f: 'alle' }, { alle: !(Z.zh && Z.zh.alle) }); zuHabenZeichnen(); return; }
    if (/^zh:/.test(was)) {
      const rest = was.slice(3), i = rest.indexOf(':'), team = rest.slice(0, i), id = rest.slice(i + 1);
      if (Z.partner === team) { if (Z.bekommt.spieler.indexOf(id) < 0) Z.bekommt.spieler.push(id); Z.meldung = ''; zeichne(); }
      else window.DFLTrade.mitSpieler(team, id);
      return;
    }
    if (was === 'dazu') window.DFLTrade.dazugeben();
    else if (was === 'leeren') window.DFLTrade.leeren();
    else if (was === 'los') window.DFLTrade.ausfuehren();
    else if (was === 'vorab-weg') { Z.vertrag = null; Z.meldung = ''; aktualisieren(); }
    else if (/^vorab:/.test(was)) vertragOeffnen(was.slice(6));
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', klick);

  // vertrag (D86, optional): { id, staffel, vorab, f } – Vertrag vorab für einen eingehenden Spieler; gilt nur zusammen mit dem Tausch
  function ausfuehrenDeal(deal, opt, vertrag) {
    if (!fenster().ok) { Z.meldung = fenster().text; zeichne(); return false; }
    const L = welt(), A = L.teams.find(t => t.id === eigenId()), B = L.teams.find(t => t.id === deal.an);
    const gegeben = (deal.gibt.spieler || []).slice(), bekommen = (deal.bekommt.spieler || []).slice();
    // Mindestkader während der Saison (D46)
    const K = window.DFLKader;
    const laeuft = K && K.saisonLaeuft && K.saisonLaeuft(), grenze = K && (K.grenzeAktiv ? K.grenzeAktiv() : laeuft);
    if (laeuft || grenze) {
      const nachher = K.hauptkader().length - gegeben.filter(id => K.hauptkader().some(q => (q.dflId || q.id) === id)).length + bekommen.length;
      // D136: zwei Torhüter während der Saison
      const twMin = K.TW_MIN || 0, twVorher = K.torhueter ? K.torhueter().length : 99;
      const twNachher = twVorher - gegeben.filter(id => K.torhueter().some(q => (q.dflId || q.id) === id)).length
        + bekommen.filter(id => { const w = B && B.roster.find(x => x.id === id); return w && w.pos === 'TW'; }).length;
      const kaderText = laeuft && nachher < K.MIN() ? `Nach dem Tausch hättest du nur ${nachher} Spieler – mindestens ${K.MIN()} sind während der Saison Pflicht.`
        : laeuft && twNachher < twMin && twNachher < twVorher ? `Nach dem Tausch hättest du ${twNachher ? 'nur ' + twNachher : 'keinen'} Torhüter – ${twMin} sind während der Saison Pflicht.`
        : grenze && K.MAX && nachher > Math.max(K.MAX(), K.hauptkader().length) ? `Nach dem Tausch hättest du ${nachher} Spieler – ab dem Kaderschnitt sind höchstens ${K.MAX()} erlaubt. Erst Platz schaffen.` : '';
      // Anfragen im Postfach zeigen die Trade-Zentrale nicht – deshalb zusätzlich als Hinweis
      if (kaderText) { Z.meldung = kaderText; zeichne(); if (typeof showToast === 'function') showToast(kaderText, 'warn', { duration: 5000 }); return false; }
    }
    // D86: Vertrag vorab vor dem Tausch prüfen – Trade und Vertrag gelten nur zusammen (Cap der Startsaison mit dem neuen Cap Hit)
    let vl = null;
    if (vertrag) {
      vl = vertragLage(L, A, B, deal, vertrag);
      if (!vl || !vl.ok) { Z.meldung = (vl && vl.grund) || 'Der Vertrag vorab lässt sich nicht prüfen – Tausch nicht ausgeführt.'; zeichne(); return false; }
    }
    const namenGeg = gegeben.map(id => { const p = A.roster.find(x => x.id === id); return p ? name(p) : id; });
    const e = H.ausfuehren(L, deal, opt || optFuer(deal));
    if (!e.ausgefuehrt) { Z.meldung = e.grund; zeichne(); return false; }
    // Eigene Spieler verlassen den Kader, neue kommen dazu (Rest-Handgeld bleibt als Dead Cap, C4)
    gegeben.forEach(id => {
      const q = SQUAD.find(x => (x.dflId || x.id) === id);
      if (q) { if (typeof clearFromLineup === 'function') clearFromLineup(q.id); SQUAD.splice(SQUAD.indexOf(q), 1); }
      const w = B.roster.find(p => p.id === id); if (w) { delete w.sq; delete w.ir; }   // Verletztenliste gilt nur im eigenen Kader
    });
    const neu = [];
    bekommen.forEach(id => {
      const w = A.roster.find(p => p.id === id);
      if (!w) return;
      const q = D.zuSpielSpieler(w);
      q.acquiredSeason = LEAGUE.season;
      if (typeof assignBirthday === 'function') assignBirthday(q);
      SQUAD.push(q); neu.push(name(w) + ' (' + posText(w) + ', ' + w.ovr + ')');
    });
    // Neuer Dead Cap aus dem Trade (restliches Handgeld der Abgegebenen): sofort bezahlt wie bei einer Entlassung
    const deadNeu = Math.max(0, (A.dead_cap_total || 0) - (CLUB.dfl.deadCap || 0));
    if (deadNeu && window.DFLKader && DFLKader.deadCapBuchen) DFLKader.deadCapBuchen(deadNeu); else CLUB.dfl.deadCap = A.dead_cap_total || 0;
    K.capSetzen();
    // D86: Folgevertrag mit dem eingetauschten Spieler (Cap oben mit dem Kader danach geprüft, Forderung fest wie vereinbart)
    let vText = '';
    if (vertrag && vl) {
      const q = SQUAD.find(x => x.dflId === vertrag.id), SW = SWV();
      const r = q && SW ? SW.verlaengern(q.id, { staffel: vertrag.staffel, vorab: vertrag.vorab, f: vertrag.f, ohneZufall: true, capGeprueft: true,
        anlass: `Vertrag vorab im Trade mit ${B.name}` }) : null;
      if (r && r.ok) vText = ` ${name(q)} verlängert vorab: ${mioE(r.vertrag.gesamt)} über ${r.vertrag.jahre} ${r.vertrag.jahre === 1 ? 'Jahr' : 'Jahre'} ab ${label(r.vertrag.start)}.`;
      else console.warn('[DFL-Trade] Vertrag vorab nicht gebucht', r && r.grund);
    }
    const pk = (deal.bekommt.picks || []).length, pg = (deal.gibt.picks || []).length;
    if (!CLUB.transferHistory) CLUB.transferHistory = [];
    CLUB.transferHistory.unshift({ type: 'trade', name: neu.join(', ') || 'Picks', amount: 0, season: LEAGUE.season });
    addNews('transfer', `🔁 Trade mit ${B.name}`, `${CLUB.shortName || CLUB.name} gibt ${[...namenGeg, pg ? pg + ' Pick' + (pg > 1 ? 's' : '') : ''].filter(Boolean).join(', ') || 'nichts'} ` +
      `und bekommt ${[...neu, pk ? pk + ' Pick' + (pk > 1 ? 's' : '') : ''].filter(Boolean).join(', ') || 'nichts'}.` + vText + ' ' +
      (CLUB.dfl.deadCap ? `Dead Cap diese Saison: ${mio(CLUB.dfl.deadCap)}. ` : '') + `Cap: ${mio(K.capBelegt())} von ${mio(K.capLimit())}.`);
    K.capSetzen(); D.weltGeaendert();
    Z.gibt = leer(); Z.bekommt = leer(); Z.block = null; Z.interesse = null; Z.vertrag = null;
    Z.meldung = vText ? 'Tausch und Vertrag vorab abgeschlossen.' : 'Tausch abgeschlossen.';
    if (A_()) A_().nachTausch(deal);
    ['renderAll', 'renderClubTab'].forEach(f => { if (typeof window[f] === 'function') { try { window[f](); } catch (err) { /* optional */ } } });
    if (typeof saveGameState === 'function') saveGameState();
    zeichne();
    return true;
  }
  // Rückmeldung 17.10. (16): „Zum Trade anbieten“ im Spieler-Blatt – die Angebote der KI-Teams gleich dort, ein Tipp zum Annehmen
  function blattAngebote(spielerId) {
    const f = fenster(); if (!f.ok) return { ok: false, html: `<p class="aa-leer">${esc(f.text)}</p>` };
    const q = SQUAD.find(x => x.id === spielerId), id = q ? (q.dflId || q.id) : spielerId;
    const L = welt(), A = L.teams.find(t => t.id === eigenId());
    if (!A || !A.roster.some(p => p.id === id)) return { ok: false, html: '<p class="aa-leer">Der Spieler steht nicht im Kader.</p>' };
    const liste = H.angeboteFuer(L, A.id, id, 4); Z._blatt = liste;
    if (!liste.length) return { ok: true, html: '<p class="aa-leer">Gerade bietet kein Team genug. Versuch es nach dem nächsten Spieltag noch einmal.</p>' };
    return { ok: true, html: liste.map((a, i) => `<div class="aa-zeile">${wappenHtml(a.team)}<div class="aa-text"><b>${esc(a.team.name)}</b>
        <small>${a.paket.map(x => SC() && x.art === 'spieler' ? SC().teilText(x.text, a.team, x.id) : esc(x.text)).join(' + ')}</small>
        ${CS() ? urteilChip(CS().urteil(L, a.deal)) : ''}</div><button type="button" class="app-knopf haupt" data-ang="${i}">Annehmen</button></div>`).join('') };
  }
  function blattAnnehmen(i) {
    const a = (Z._blatt || [])[i]; if (!a) return { ok: false, text: 'Angebot nicht mehr da.' };
    Z.partner = a.team.id;
    const ok = ausfuehrenDeal(a.deal);
    Z._blatt = null;
    return { ok, text: Z.meldung };
  }
  window.DFLTrade = { urteilChip, kosten, kostenHtml, blattAngebote, blattAnnehmen,
    zeichne,       // D112: Filter „passt zu meinem Stil“ (dfl_ebenen_patch.js) zeichnet Zu haben, Vorrat und Wertliste neu
    deadlineText() { return LEAGUE.matchday < H.CFG.deadlineSpieltag ? `Trades bis Spieltag ${H.CFG.deadlineSpieltag - 1}` : 'Trade-Deadline vorbei'; },
    partner(id) { Z.partner = id; Z.bekommt = leer(); Z.vertrag = null; Z.meldung = ''; if (Z.interesse && Z.interesse.team !== id) Z.interesse = null; zeichne(); },
    umschalten(seite, art, id) {
      const liste = Z[seite][art], i = liste.indexOf(id);
      if (i >= 0) liste.splice(i, 1); else liste.push(id);
      Z.meldung = ''; aktualisieren();
    },
    leeren() { Z.gibt = leer(); Z.bekommt = leer(); Z.vertrag = null; Z.meldung = ''; aktualisieren(); },
    dazugeben() {
      const L = welt(), v = H.wasMuessteIchDazugeben(L, aktuellerDeal());
      if (!v) Z.meldung = 'Mit höchstens zwei Zusatzteilen aus deinem Kader klappt das nicht.';
      else if (v.schon) Z.meldung = 'Passt schon so.';
      else { Z.gibt = { spieler: v.deal.gibt.spieler.slice(), picks: v.deal.gibt.picks.slice() }; Z.meldung = 'Vorschlag: ' + v.zusatz.map(x => x.text).join(' + ') + ' dazu.'; }
      aktualisieren();
    },
    ausfuehren() {
      const deal = aktuellerDeal();
      const L = welt(), e = H.bewerte(L, deal, optFuer(deal));
      if (e.akzeptiert) { ausfuehrenDeal(deal, null, Z.vertrag); return; }
      // Abgelehnte Anfrage zählt (D50): nach 3 je Verein und Wechselfenster bricht der Verein die Gespräche ab
      const g = gespraech(Z.partner); g.n++;
      const B = L.teams.find(t => t.id === Z.partner);
      Z.meldung = g.n >= MAX_ANFRAGEN ? `${B.name} lehnt ab und bricht die Gespräche ab: „${e.grund}“`
        : `${B.name} lehnt ab (${g.n}/${MAX_ANFRAGEN}): „${e.grund}“`;
      if (typeof saveGameState === 'function') saveGameState();
      aktualisieren();
    },
    ausfuehrenDeal,
    // D86 für Werkzeuge und Prüflauf: Angebot „Vertrag vorab“ für einen eingehenden Spieler im Tausch (ohne Vereinbarung) und Zustand
    vorabAngebot, vorabMoeglich, vertragOeffnen, zustand: () => ({ partner: Z.partner, gibt: Z.gibt, bekommt: Z.bekommt, vertrag: Z.vertrag }),
    // Anfrage verhandeln: Trade-Zentrale mit dem Angebot vorbelegen, Zuschlag gilt weiter (D99: Angebote an dich mit eigener Meldung)
    vorbelegen(deal, interesse, meldung) {
      Z.partner = deal.an; Z.gibt = { spieler: (deal.gibt.spieler || []).slice(), picks: (deal.gibt.picks || []).slice() };
      Z.bekommt = { spieler: (deal.bekommt.spieler || []).slice(), picks: (deal.bekommt.picks || []).slice() };
      Z.vertrag = null;
      Z.interesse = interesse || null; Z.meldung = meldung || 'Angebot übernommen – ändere es und schick es zurück.';
      this.oeffne(null);
    },
    block(id) {
      Z.block = id || null;
      const el = document.getElementById('tz-block');
      if (!el) { zeichne(); return; }
      try { const L = welt(); el.innerHTML = blockHtml(L, L.teams.find(t => t.id === eigenId())); } catch (e) { console.warn('[DFL-Trade] Trading Block', e); }
    },
    angebot(i) { const a = (Z._angebote || [])[i]; if (a) { Z.partner = a.team.id; ausfuehrenDeal(a.deal); } },
    // D78: aus dem Scout-Bericht – Zentrale mit diesem Partner, der Spieler steht schon auf „Du bekommst“
    mitSpieler(teamId, spielerId) {
      Z.partner = teamId; Z.gibt = leer(); Z.bekommt = { spieler: spielerId ? [String(spielerId)] : [], picks: [] };
      Z.vertrag = null; Z.interesse = null; Z.meldung = '';
      this.oeffne(null);
    },
    oeffne(spielerId) {
      if (spielerId) { const q = SQUAD.find(x => x.id === spielerId); Z.block = q ? (q.dflId || q.id) : null; }
      const nav = document.getElementById('nav-transfer');
      if (nav && typeof switchAppView === 'function') switchAppView('transfer', nav);
      const b = document.querySelector('#view-transfer .subtab[data-dfl-reiter="trades"]');
      if (b) window.switchTransferSubview('trades', b);
    }
  };

  // ── Einhängen: zwei Reiter im Transfermarkt ─────────────────────────────
  function reiterEinbauen() {
    const leiste = document.querySelector('#view-transfer .subtabs');
    if (!leiste || leiste.querySelector('[data-dfl-reiter]')) return;
    const wrap = leiste.parentElement;
    [['trades', 'Trades'], ['werte', 'Wertliste']].forEach(([k, t]) => {
      leiste.insertAdjacentHTML('beforeend', `<button class="subtab" data-dfl-reiter="${k}" onclick="switchTransferSubview('${k}', this)">${t}</button>`);
      wrap.insertAdjacentHTML('beforeend', `<div class="subview" id="tr-sub-${k}" style="padding-top:12px"></div>`);
    });
  }
  {
    const _orig = window.switchTransferSubview;
    if (typeof _orig === 'function') window.switchTransferSubview = function (name, btn) {
      const eigene = ['trades', 'werte'];
      if (eigene.indexOf(name) >= 0) {
        document.querySelectorAll('#view-transfer .subtab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#view-transfer .subview').forEach(v => v.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const v = document.getElementById('tr-sub-' + name); if (v) v.classList.add('active');
        zeichne();
        return;
      }
      eigene.forEach(n => { const v = document.getElementById('tr-sub-' + n); if (v) v.classList.remove('active'); });
      return _orig.apply(this, arguments);
    };
  }
  {
    const _orig = window.renderTransferTab;
    if (typeof _orig === 'function') window.renderTransferTab = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) { reiterEinbauen(); zeichne(); }
      else document.querySelectorAll('#view-transfer [data-dfl-reiter]').forEach(b => b.style.display = 'none');
      return r;
    };
  }
  // Spielerkarte: „Auf den Trading Block“
  {
    const _orig = window.renderPlayerCard;
    if (typeof _orig === 'function') window.renderPlayerCard = function (p) {
      const r = _orig.apply(this, arguments);
      const ziel = dfl() && p && document.querySelector('#playercard-sec .dfl-vertrag .dfl-draft-aktionen');
      if (ziel && !p.perspektiv && !ziel.querySelector('.dfl-tr-knopf')) {
        ziel.insertAdjacentHTML('afterbegin', `<button class="dfl-draft-btn leise dfl-tr-knopf" onclick="DFLTrade.oeffne('${p.id}')">Trading Block</button>`);
        if (A_() && SQUAD.some(q => q.id === p.id)) {
          const u = A_().istUnverkaeuflich(p.id);
          ziel.insertAdjacentHTML('afterbegin', `<button class="dfl-draft-btn leise dfl-tr-knopf" onclick="DFLAnfragen.unverkaeuflich('${p.id}');renderPlayerCard(getPlayer('${p.id}'))">${u ? 'Wieder verkäuflich' : 'Unverkäuflich'}</button>`);
        }
      }
      return r;
    };
  }

  console.log('%c[DFL-Trade v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— Trade-Zentrale mit Gesichtern, Pick-Tickets und Cap-Balken (D84), Vertrag vorab (D86), Live-Bewertung, Trading Block, Wertliste, „Zu haben“ (D99)');
})();
