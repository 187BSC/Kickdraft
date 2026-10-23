/* ===== kickstil_transfer_karten.js =====
   KICKSTIL · TRANSFERS MIT BILDERN  ·  v1   (2026-10-15)
   ─────────────────────────────────────────────────────────────────────────────
   Nutzer: „bei Anfragen auch die Bilder zeigen und die Summe usw.“ – nach dem
   Vorbild der Tausch-Karte aus Kickdraft (dfl_bilder_patch.js, D76 · 10), aber
   für unsere Welt mit Ablösesummen statt Tauschgeschäften:

     · Angebotskarte für Gebote auf eigene Spieler: links „Du gibst“ (Gesicht,
       Position, Name, Alter, Stärke), rechts der Bieter mit Wappen und Summe,
       darunter die Waage „Angebot gegen Marktwert“ (Prozent, Farbe) und Marken
       (Top-Klub, Talent, Deadline, Ausland, selbst angeboten).
       Erscheint im Postfach (Angebote), unter „Angebote für deine Spieler“ im
       Transfermarkt und oben im Verkaufsdialog (openSellNegotiation).
     · Kaufkarte im Dialog „Verhandlung mit dem Verein“ (Kauf): Spieler mit
       Gesicht, abgebender Verein mit Wappen, dein Angebot gegen Forderung und
       Marktwert.
     · Transfermarkt: kleines Porträt vor jedem Spieler.

   Rechnet nichts: Summen, Marktwerte und Knöpfe kommen unverändert aus dem
   Spiel (acceptTransferBid, openSellNegotiation, declineTransferBid).
   Braucht KSVerein (js/kickstil_verein.js). Lädt nach buy_negotiation_patch.js
   und dfl_kenney_patch.js (äußerer Wrapper um buildPostfachItems).
   ============================================================================= */
(function () {
  'use strict';
  const KS = () => window.KSVerein;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = x => (typeof formatEuro === 'function' ? formatEuro(Math.round(x || 0)) : Math.round(x || 0) + ' €');
  const ti = (n, kl) => `<i class="ti ti-${n}${kl ? ' ' + kl : ''}" aria-hidden="true"></i>`;
  const name = p => (typeof displayName === 'function' ? displayName(p) : ((p.firstName ? p.firstName + ' ' : '') + p.name));
  const posVon = p => (p.positions && p.positions[0]) || p.pos || '';
  const mwVon = p => { try { return typeof computeMarketValue === 'function' ? computeMarketValue(p) : (p.value || 0); } catch (e) { return p.value || 0; } };
  const bids = () => (typeof CLUB !== 'undefined' && CLUB && Array.isArray(CLUB.transferBids)) ? CLUB.transferBids : [];
  const bidVon = id => bids().find(b => b.id === id) || null;
  const spieler = id => (typeof getPlayer === 'function' ? getPlayer(id) : null);

  function gesicht(p, vid) {
    try { return KS() ? KS().gesicht(p, vid) : ''; } catch (e) { return ''; }
  }
  function wappen(vereinName, kl) {
    let st = '';
    try { const id = KS() ? KS().idNachName(vereinName) : null; st = id && typeof crestStyle === 'function' ? crestStyle(id) : ''; } catch (e) { st = ''; }
    return `<span class="lg-crest ${kl || ''}" style="${st}" aria-hidden="true"></span>`;
  }
  // Waage: Verhältnis Summe ÷ Bezug (Marktwert bzw. Forderung), Skala 50 … 150 %, Strich bei 100 %
  function waage(summe, bezug, bezugText) {
    if (!bezug) return '';
    const q = summe / bezug, pct = Math.round((q - 1) * 100);
    const pos = Math.max(0, Math.min(100, (q - 0.5) * 100));
    const art = q >= 1.05 ? 'gut' : q >= 0.92 ? 'mittel' : 'schlecht';
    const txt = pct === 0 ? `genau ${bezugText}` : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} % ${pct > 0 ? 'über' : 'unter'} ${bezugText}`;
    return `<div class="ks-waage ${art}" role="img" aria-label="${esc(txt)}">
      <span class="ks-waage-bahn"><i style="width:${pos.toFixed(1)}%"></i><em title="${esc(bezugText)}"></em></span>
      <span class="ks-waage-text">${ti(q >= 1 ? 'trending-up' : 'trending-down')}${esc(txt)}</span></div>`;
  }
  function spielerTeil(p, vid, titel) {
    const st = typeof ovrBase === 'function' ? ovrBase(p) : p.ovr;
    return `<div class="ks-ang-seite du"><small>${esc(titel)}</small>
      <span class="ks-ang-sp"><span class="ks-ang-gesicht">${gesicht(p, vid)}</span>
        <span class="ks-ang-wer"><span><span class="pos-badge-sm pos-${esc(posVon(p))}">${esc(posVon(p))}</span><b>${esc(name(p))}</b></span>
          <small>${p.age != null ? esc(p.age) + ' J · ' : ''}Stärke ${esc(st)}</small></span></span></div>`;
  }

  // ── Angebotskarte für ein Gebot auf einen eigenen Spieler ────────────────
  function angebotKarte(b, opt) {
    opt = opt || {};
    const p = b && spieler(b.playerId); if (!b || !p) return '';
    const mw = mwVon(p);
    const marken = [];
    if (b.isTopClub) marken.push(`<span class="bk-chip gold">${ti('crown')}Top-Klub</span>`);
    if (b.forTalent) marken.push(`<span class="bk-chip">${ti('plant-2')}Talent</span>`);
    if (b.isDeadline) marken.push(`<span class="bk-chip schlecht">${ti('clock')}Deadline-Day</span>`);
    if (b.ausland || b.land) marken.push(`<span class="bk-chip">${ti('world')}${esc(b.land || 'Ausland')}</span>`);
    if (b.playerInitiated) marken.push(`<span class="bk-chip">${ti('speakerphone')}auf deinen Wunsch</span>`);
    return `<div class="ks-angebot${opt.gross ? ' gross' : ''}">
      <div class="ks-ang-seiten">${spielerTeil(p, 'fcm', 'Du gibst')}
        <span class="ks-ang-pfeil">${ti('arrow-right')}</span>
        <div class="ks-ang-seite sie"><small>${wappen(b.club, 'ks-ang-wappen')}<span>${esc(b.club)}</span></small>
          <b class="ks-ang-summe">${esc(euro(b.amount))}</b><small class="ks-ang-mw">Marktwert ${esc(euro(mw))}</small></div></div>
      ${waage(b.amount, mw, 'Marktwert')}
      ${marken.length ? `<div class="ks-ang-fuss">${marken.join('')}</div>` : ''}</div>`;
  }

  // ── Postfach: Angebote als Karte ─────────────────────────────────────────
  if (typeof window.buildPostfachItems === 'function') {
    const _orig = window.buildPostfachItems;
    window.buildPostfachItems = function () {
      const items = _orig.apply(this, arguments);
      try {
        if (Array.isArray(items)) items.forEach(i => {
          if (i.cat !== 'offer' || !i.actions) return;
          const m = /onAcceptBid\('([^']+)'\)/.exec(i.actions);
          const b = m && bidVon(m[1]);
          const k = b && angebotKarte(b);
          if (k) { i.text = k; i.icon = wappen(b.club, 'ks-pf-wappen'); }
        });
      } catch (e) { console.warn('[Kickstil-Transfer] Postfach', e); }
      return items;
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nur window */ }
  }

  // ── Transfermarkt: „Angebote für deine Spieler“ als Karten ────────────────
  if (typeof window.renderTransferBids === 'function') {
    const _orig = window.renderTransferBids;
    window.renderTransferBids = function () {
      const r = _orig.apply(this, arguments);
      try {
        const el = document.getElementById('tr-bids'), liste = bids();
        if (!el || !liste.length) return r;
        el.innerHTML = `<div class="news-header" style="margin:4px 0 8px">${ti('mail')} Angebote für deine Spieler</div>` + liste.map(b => {
          const k = angebotKarte(b); if (!k) return '';
          return `<div class="ks-angebot-zeile">${k}<div class="ks-ang-knoepfe">
            <button class="mkt-btn" onclick="onAcceptBid('${esc(b.id)}')">Annehmen</button>
            <button class="mkt-btn" onclick="openSellNegotiation('${esc(b.id)}')">Verhandeln</button>
            <button class="mkt-btn secondary" onclick="declineTransferBid('${esc(b.id)}'); renderTransferTab();">Ablehnen</button></div></div>`;
        }).join('');
      } catch (e) { console.warn('[Kickstil-Transfer] Angebote', e); }
      return r;
    };
    try { renderTransferBids = window.renderTransferBids; } catch (e) { /* nur window */ }
  }

  // ── Transfermarkt: Porträt vor jedem Spieler ─────────────────────────────
  if (typeof window.renderMarketList === 'function') {
    const _orig = window.renderMarketList;
    window.renderMarketList = function () {
      const r = _orig.apply(this, arguments);
      try {
        if (!window.facesjs || typeof MARKET === 'undefined' || !MARKET) return r;
        document.querySelectorAll('#tr-sub-markt .market-row').forEach(row => {
          if (row.querySelector('.ks-mkt-gesicht')) return;
          const m = /buyPlayer\('([^']+)'\)/.exec(row.innerHTML) || /loanInPlayer\('([^']+)'\)/.exec(row.innerHTML);
          const p = m && MARKET.players.find(x => x.id === m[1]);
          if (p) row.insertAdjacentHTML('afterbegin', `<span class="ks-mkt-gesicht dfl-portrait klein">${gesicht(p)}</span>`);
        });
      } catch (e) { console.warn('[Kickstil-Transfer] Markt', e); }
      return r;
    };
    try { renderMarketList = window.renderMarketList; } catch (e) { /* nur window */ }
  }

  // ── Verhandlungsdialoge: Karte oben einsetzen ────────────────────────────
  // renderSellNego/renderClubNego (buy_negotiation_patch.js) sind intern und bauen das Fenster bei jeder Änderung
  // neu (innerHTML) – deshalb ein Beobachter, der die Karte nach jedem Neuaufbau wieder einsetzt.
  function sellKarte() {
    const s = window._sellNego; if (!s) return '';
    const b = bidVon(s.bidId), p = spieler(s.playerId); if (!b || !p) return '';
    const k = angebotKarte(Object.assign({}, b, { club: s.club || b.club }), { gross: true });
    // Darunter: deine Forderung gegen das Gebot
    return k + `<div class="ks-ang-forderung"><span>Deine Forderung</span><b>${esc(euro(s.fee))}</b></div>` + waage(s.fee, b.amount, 'dem Gebot');
  }
  function kaufKarte() {
    const s = window._clubNego; if (!s || typeof MARKET === 'undefined' || !MARKET) return '';
    const p = MARKET.players.find(x => x.id === s.marketId); if (!p) return '';
    const mw = mwVon(p);
    return `<div class="ks-angebot gross">
      <div class="ks-ang-seiten">${spielerTeil(p, null, 'Du bekommst')}
        <span class="ks-ang-pfeil">${ti('arrow-left')}</span>
        <div class="ks-ang-seite sie"><small>${wappen(p.fromClub, 'ks-ang-wappen')}<span>${esc(p.fromClub || 'Verein')}</span></small>
          <b class="ks-ang-summe">${esc(euro(s.fee))}</b><small class="ks-ang-mw">Forderung ${esc(euro(s.ask))} · Marktwert ${esc(euro(mw))}</small></div></div>
      ${waage(s.fee, s.ask, 'der Forderung')}</div>`;
  }
  function einsetzen(ov, html) {
    if (!ov || !html) return;
    const karte = ov.querySelector('.nego-card'); if (!karte || karte.querySelector('.ks-angebot')) return;
    const kopf = karte.querySelector('.nego-head');
    const box = document.createElement('div'); box.className = 'ks-nego-karte'; box.innerHTML = html;
    if (kopf) kopf.insertAdjacentElement('afterend', box); else karte.insertAdjacentElement('afterbegin', box);
  }
  function pruefen() {
    try {
      einsetzen(document.getElementById('sellnego-overlay'), sellKarte());
      einsetzen(document.getElementById('clubnego-overlay'), kaufKarte());
    } catch (e) { console.warn('[Kickstil-Transfer] Verhandlung', e); }
  }
  if (typeof MutationObserver === 'function' && document.body) {
    let geplant = false;
    new MutationObserver(() => {
      if (geplant) return; geplant = true;
      Promise.resolve().then(() => { geplant = false; if (document.getElementById('sellnego-overlay') || document.getElementById('clubnego-overlay')) pruefen(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.KSTransfer = { angebotKarte, kaufKarte, sellKarte, waage };
  console.log('[Kickstil-Transfer v1] aktiv — Angebote und Kauf als Karte mit Gesicht, Wappen, Summe und Waage; Porträts im Markt');
})();
