/* ===== kickstil_pc_nlz_ehemalige.js =====
   KICKSTIL · NLZ AM PC: EHEMALIGE, AUSBILDUNGSENTSCHÄDIGUNG, SOLIDARITÄTSBEITRAG  ·  v1   (2026-10-19)
   ─────────────────────────────────────────────────────────────────────────────
   Nur PC (Erweiterung von kickstil_pc_nlz.js, Reiter „Ehemalige“). Nutzer 2026-10-19: schlank, nur belegte Regeln
   („dazu müssen die infos sitzen“). Nach den FIFA-Regeln (RSTP Art. 20/21, Anhang 4/5), wie im Spiel vereinfacht:
   · AUSBILDUNGSENTSCHÄDIGUNG – gilt nur bei Wechseln ins Ausland bis 23: Verkaufst du ein Eigengewächs an einen
     Auslandsverein, zahlt der zusätzlich je Ausbildungsjahr (12–21) die Ausbildungskosten seiner Kategorie:
     UEFA I 90.000 €, II 60.000 €, III 30.000 €, IV 10.000 € (FIFA Circular 1805); die Jahre 12–15 immer mit Kategorie IV.
     Vereinfacht: Kategorie nach Stärke des Auslandsvereins; Ausbildung bei dir ab 12 (Jahrgänge ab U9).
   · SOLIDARITÄTSBEITRAG – gilt nur bei Wechseln über eine Landesgrenze mit Ablöse: 5 % gehen an die Ausbildungsvereine,
     je Saison mit 12–15 Jahren 0,25 %, mit 16–23 Jahren 0,5 % der Ablöse. Gilt für jeden späteren Wechsel deiner Ehemaligen
     (Transfermarkt der KI-Vereine, CLUB.welt.kiMarkt.log).
   Zustand: CLUB.welt.nlz.ehe = { v, liste: [{ k, n, pos, land, ab, weg, saison, wohin, wie }], da: { k: alter }, gesehen: [..], geld: [..] }.
   Lädt nach kickstil_pc_nlz_ausbau.js, vor init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';
  const W = window, N = W.KSNlz;
  if (!N || !N.erweitern) { console.warn('[Kickstil-PC-NLZ-Ehemalige] KSNlz fehlt – Modul inaktiv'); return; }
  const H = N.hilfe, esc = H.esc;
  const CFG = {
    kategorie: [90000, 60000, 30000, 10000],            // FIFA Circular 1805 (UEFA), je Ausbildungsjahr
    katGrenzen: [80, 72, 64],                          // Stärke des Auslandsvereins → Kategorie I/II/III, darunter IV
    solidaritaet: { jung: 0.0025, alt: 0.005 },          // je Saison 12–15 / 16–23 (zusammen höchstens 5 %)
    ab: 12, ausbildungBis: 21, solidBis: 23, entschBis: 23
  };
  const saison = () => LEAGUE.season || 1;
  const schluessel = p => (p.firstName || '') + '|' + (p.name || '') + '|' + (p.country || '');
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + (p.name || '');
  function ze(n) {
    if (!n.ehe || n.ehe.v !== 1) n.ehe = { v: 1, liste: [], da: {}, gesehen: [], geld: [] };
    return n.ehe;
  }
  const euroClub = name => ((W.EURO_CLUBS) || []).find(c => c.name === name || (name && name.indexOf(c.name) === 0)) || null;
  const katVon = c => { const o = c ? c.ovr || 0 : 0; const g = CFG.katGrenzen; return o >= g[0] ? 0 : o >= g[1] ? 1 : o >= g[2] ? 2 : 3; };
  const KAT = ['I', 'II', 'III', 'IV'];

  // Ausbildungsjahre bei dir: ab 12 bis zum Alter beim Abschied
  function ausbildung(e, bis, satz) {
    let summe = 0, jahre = 0;
    for (let a = Math.max(CFG.ab, e.ab || CFG.ab); a < Math.min(bis + 1, e.weg); a++) { summe += satz(a); jahre++; }
    return { summe, jahre };
  }
  function buchen(n, art, betrag, text, e, nach) {
    if (!(betrag > 0)) return;
    const z = ze(n); betrag = Math.round(betrag / 1000) * 1000;
    CLUB.budget = (CLUB.budget || 0) + betrag;
    z.geld.push({ s: saison(), art, b: betrag, k: e.k, n: e.n, nach });
    z.geld = z.geld.slice(-60);
    if (typeof addNews === 'function') addNews('club', art === 'aus' ? '🎓 NLZ: Ausbildungsentschädigung' : '🤝 NLZ: Solidaritätsbeitrag', text.replace('{b}', H.euro(betrag)));
  }

  // ── Abgänge erkennen (Kaderabgleich je Woche und Saison) ─────────────────────────────────────────────────────
  function abgleichen(n) {
    if (typeof SQUAD === 'undefined') return;
    const z = ze(n), jetzt = {};
    SQUAD.forEach(p => { if (H.istEigengewaechs(p)) jetzt[schluessel(p)] = { alter: p.age || 18, n: voll(p), pos: p.pos, land: p.country || '' }; });
    Object.keys(z.da).forEach(k => {
      if (jetzt[k] || z.liste.some(e => e.k === k && e.saison === saison())) return;
      const d = z.da[k];
      if (!z.liste.some(e => e.k === k)) z.liste.push({ k, n: d.n, pos: d.pos, land: d.land, ab: CFG.ab, weg: d.alter, saison: saison(), wohin: '', wie: 'abgang' });
    });
    z.da = {}; Object.keys(jetzt).forEach(k => { z.da[k] = jetzt[k]; });
  }
  // Verkauf an einen Auslandsverein: Ausbildungsentschädigung zusätzlich zur Ablöse
  if (typeof W.acceptTransferBid === 'function') {
    const _acc = W.acceptTransferBid;
    W.acceptTransferBid = function (bidId) {
      let bid = null, sp = null;
      try { bid = (CLUB.transferBids || []).find(b => b.id === bidId); sp = bid && SQUAD.find(p => p.id === bid.playerId); } catch (e) { /* weiter */ }
      const r = _acc.apply(this, arguments);
      try {
        const n = CLUB.welt && CLUB.welt.nlz;
        if (r && sp && n && H.istPc() && H.istEigengewaechs(sp)) {
          const z = ze(n), k = schluessel(sp), c = euroClub(bid.club);
          let e = z.liste.find(x => x.k === k);
          if (!e) { e = { k, n: voll(sp), pos: sp.pos, land: sp.country || '', ab: CFG.ab, weg: sp.age || 18, saison: saison() }; z.liste.push(e); }
          e.wohin = bid.club; e.wie = 'verkauft'; e.ablose = bid.amount; delete z.da[k];
          if (c && (sp.age || 99) <= CFG.entschBis) {
            const kat = katVon(c);
            const r2 = ausbildung(e, CFG.ausbildungBis, a => a <= 15 ? CFG.kategorie[3] : CFG.kategorie[kat]);
            e.kat = KAT[kat];
            buchen(n, 'aus', r2.summe, `${bid.club} zahlt für ${e.n} zusätzlich {b} Ausbildungsentschädigung (${r2.jahre} Ausbildungsjahre bei dir, Kategorie ${KAT[kat]}).`, e, bid.club);
          }
        }
      } catch (er) { console.warn('[Kickstil-PC-NLZ-Ehemalige] Verkauf', er); }
      return r;
    };
    try { acceptTransferBid = W.acceptTransferBid; } catch (e) { /* window reicht */ }
  }
  // Spätere Wechsel der Ehemaligen über eine Landesgrenze: Solidaritätsbeitrag
  function solidaritaet(n) {
    const z = ze(n), log = (CLUB.welt && CLUB.welt.kiMarkt && CLUB.welt.kiMarkt.log) || [];
    if (!z.liste.length || !log.length) return;
    const gesehen = new Set(z.gesehen);
    log.forEach(e => {
      const key = e.s + '|' + e.f + '|' + e.id;
      if (gesehen.has(key)) return;
      gesehen.add(key);
      if (!(e.ab > 0) || !!e.vonDe === !!e.nachDe) return;
      const ex = z.liste.find(x => x.n === e.n && (x.land || '') === (e.l || ''));
      if (!ex) return;
      const r = ausbildung(ex, CFG.solidBis, a => (a <= 15 ? CFG.solidaritaet.jung : CFG.solidaritaet.alt) * e.ab);
      ex.wohin = e.nach;
      buchen(n, 'sol', r.summe, `${ex.n} wechselt für ${H.euro(e.ab)} von ${e.von} zu ${e.nach} – als Ausbildungsverein bekommst du {b} Solidaritätsbeitrag.`, ex, e.nach);
    });
    z.gesehen = Array.from(gesehen).slice(-800);
  }

  // ── Anzeige ────────────────────────────────────────────────────────────────────────────────────────────────────
  function jetztBei(e) {
    try {
      const pruef = (kader, name) => (kader || []).some(p => voll(p) === e.n && (p.country || '') === (e.land || '')) ? name : null;
      const sq = CLUB.npcSquads || {};
      for (const id of Object.keys(sq)) { const nm = pruef(sq[id], id); if (nm) { const d = W.KSVerein && KSVerein.daten ? KSVerein.daten(id) : null; return (d && d.name) || id; } }
      const ek = CLUB.euroKader || {};
      for (const id of Object.keys(ek)) { const nm = pruef(ek[id], id); if (nm) { const c = (W.EURO_CLUBS || []).find(x => x.id === id); return c ? c.name : id; } }
    } catch (er) { /* unbekannt */ }
    return e.wohin || 'unbekannt';
  }
  function html(n) {
    const z = ze(n), summe = art => z.geld.filter(g => g.art === art).reduce((a, g) => a + g.b, 0);
    const zeilen = z.liste.slice().reverse().map(e => {
      const g = z.geld.filter(x => x.k === e.k).reduce((a, x) => a + x.b, 0);
      return `<tr><td class="l"><b>${esc(e.n)}</b> <small>${esc(e.pos || '')}</small></td><td>${CFG.ab}–${Math.max(CFG.ab, e.weg - 1)} J.</td><td class="l">Saison ${e.saison} · ${e.wie === 'verkauft' ? 'verkauft' + (e.ablose ? ' für ' + H.euro(e.ablose) : '') : 'gegangen'}</td>
        <td class="l">${esc(H.istPc() ? jetztBei(e) : '')}</td><td>${g ? '<b>' + H.euro(g) + '</b>' : '–'}</td></tr>`;
    }).join('');
    return `<div class="ne-kopf nz-kasten"><div><small>Ehemalige</small><b>${z.liste.length}</b></div><div><small>Ausbildungsentschädigung</small><b>${H.euro(summe('aus'))}</b></div><div><small>Solidaritätsbeitrag</small><b>${H.euro(summe('sol'))}</b></div></div>
      <section class="nz-kasten"><h3>Deine Ehemaligen <small>Eigengewächse, die den Verein verlassen haben</small></h3>
        ${zeilen ? `<table class="ne-tab"><thead><tr><th class="l">Spieler</th><th>Ausbildung bei dir</th><th class="l">Abschied</th><th class="l">Jetzt bei</th><th>Eingenommen</th></tr></thead><tbody>${zeilen}</tbody></table>`
          : '<div class="nz-leer">Noch kein Eigengewächs hat den Verein verlassen.</div>'}</section>
      <div class="nz-kasten nz-um"><b>So bekommst du Geld für deine Ausbildung</b> (Regeln der FIFA, im Spiel vereinfacht):<br>
        <b>Ausbildungsentschädigung:</b> Verkaufst du ein Eigengewächs bis 23 ins Ausland, zahlt der neue Verein zusätzlich je Ausbildungsjahr (12–21) die Ausbildungskosten seiner Kategorie: I 90.000 €, II 60.000 €, III 30.000 €, IV 10.000 € – die Jahre bis 15 immer mit Kategorie IV. Bei Wechseln innerhalb Deutschlands gibt es sie nicht.<br>
        <b>Solidaritätsbeitrag:</b> Wechselt ein Ehemaliger später gegen Ablöse über eine Landesgrenze, gehen 5 % an seine Ausbildungsvereine – je Saison bei dir mit 12–15 Jahren 0,25 %, mit 16–23 Jahren 0,5 % der Ablöse.</div>`;
  }
  const CSS = `
#view-nlz .ne-kopf { display: flex; gap: 28px; padding: 12px 16px; margin-bottom: 14px; }
#view-nlz .ne-kopf div { display: grid; } #view-nlz .ne-kopf small { font-size: 11px; font-weight: 800; color: var(--text3); text-transform: uppercase; letter-spacing: .05em; }
#view-nlz .ne-kopf b { font-family: var(--font-display, inherit); font-size: 21px; }
#view-nlz .ne-tab { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
#view-nlz .ne-tab th, #view-nlz .ne-tab td { padding: 6px 12px; border-bottom: 1px solid color-mix(in srgb, var(--k-linie, var(--border)) 55%, transparent); text-align: right; }
#view-nlz .ne-tab th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text3); } #view-nlz .ne-tab .l { text-align: left; }
#view-nlz .ne-tab small { color: var(--text3); font-weight: 800; }
#view-nlz .nz-um { margin-top: 14px; }
`;
  function cssEinbauen() { if (document.getElementById('ne-css')) return; const st = document.createElement('style'); st.id = 'ne-css'; st.textContent = CSS; document.head.appendChild(st); }

  N.erweitern({
    tab: { id: 'ehe', name: 'Ehemalige', html: n => { cssEinbauen(); abgleichen(n); return html(n); }, klick: () => false },
    woche: n => { abgleichen(n); solidaritaet(n); },
    saison: n => { abgleichen(n); solidaritaet(n); }
  });
  W.KSNlzEhemalige = { CFG, z: () => { const n = N.z(); return n ? ze(n) : null; }, pruefen: () => { const n = N.z(); if (n) { abgleichen(n); solidaritaet(n); } } };
})();
