/* ═══════════════════════════════════════════════════════════════════════════
   DFL-DESIGN-PATCH  ·  v2   (Einbau nach docs/konzept-design.md, Abschnitt 4; v2: Kenney-Stil D54)
   ─────────────────────────────────────────────────────────────────────────
     · Stil „Kenney Tag“ / „Kenney Nacht“ (css/theme_dfl_kenney.css): <html class="freundlich kenney tag|dark">,
       Wahl „nach Uhrzeit“ (6–19 Uhr Tag, sonst Nacht; Standard), „Tag“ oder „Nacht“ – je Gerät (localStorage
       'dfl-stil'), ein Inline-Skript in index.html setzt die Klasse schon vor dem ersten Bild; Vereinsfarben als Akzent
     · Wappen: crestStyle/crestInitials liefern für DFL-Vereine die Wappen aus DFLIdentitaet (D113: kleine Variante,
       crestStyle(id, { groesse }) ab der Schwelle die große; greift überall, wo das Spiel Crests zeichnet)
     · Gesichter (facesjs) in Kaderliste und Spielerkarte
     · Emoji in Meldungen → Icons
   Braucht: dfl_identitaet.js, dfl_liga_patch.js (DFLSpiel). Lädt danach, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const I = window.DFLIdentitaet;
  if (!I) { console.warn('[DFL-Design] DFLIdentitaet fehlt – Patch inaktiv'); return; }
  const D = () => window.DFLSpiel;
  const aktiv = () => !!(D() && D().aktiv());
  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const root = document.documentElement;

  // ── Vereinsfarben als Akzent ─────────────────────────────────────────────
  let farbeFuer = null;
  function farbenSetzen() {
    if (!aktiv() || !hatClub() || !CLUB.dfl) return;
    if (farbeFuer === CLUB.dfl.franchiseId) return;
    const f = D().franchise('fcm');
    if (f) { I.vereinsTheme(f, root); farbeFuer = CLUB.dfl.franchiseId; }
  }

  // ── Stil Kenney Tag / Nacht (D54) ────────────────────────────────────────
  const STIL_KEY = 'dfl-stil', WAHLEN = ['auto', 'tag', 'nacht'];
  function stilWahl() { try { const w = localStorage.getItem(STIL_KEY); return WAHLEN.indexOf(w) >= 0 ? w : 'auto'; } catch (e) { return 'auto'; } }
  const nachUhr = () => { const h = new Date().getHours(); return h >= 6 && h < 19 ? 'tag' : 'nacht'; };
  let modusJetzt = null;
  function stilAnwenden() {
    const m = stilWahl() === 'auto' ? nachUhr() : stilWahl();
    if (m === modusJetzt) return m;
    modusJetzt = m;
    root.classList.add('freundlich', 'kenney');
    root.classList.toggle('dark', m === 'nacht');
    root.classList.toggle('tag', m === 'tag');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', m === 'tag' ? '#8b5a2b' : '#1e2230');
    farbeFuer = null; farbenSetzen();            // Akzent hängt am Grund (Kontrast) → neu rechnen
    try { window.dispatchEvent(new CustomEvent('dfl-stil', { detail: m })); } catch (e) { /* alter Browser */ }
    return m;
  }
  function stilSetzen(w) {
    try { localStorage.setItem(STIL_KEY, WAHLEN.indexOf(w) >= 0 ? w : 'auto'); } catch (e) { /* ohne Speicher: nur bis zum Neuladen */ }
    modusJetzt = null; return stilAnwenden();
  }
  stilAnwenden();
  setInterval(stilAnwenden, 60000);              // „nach Uhrzeit“: um 6 und 19 Uhr umschalten

  // ── Wappen ───────────────────────────────────────────────────────────────
  const dflFranchise = id => (aktiv() && id != null) ? D().franchise(id) : null;
  {
    // D113: kleine Variante (fast jede Stelle ist kleiner als 64 px); crestStyle(id, { groesse }) wählt ab der Schwelle die große
    const _orig = window.crestStyle;
    window.crestStyle = function (id, opt) {
      const f = dflFranchise(id);
      return f ? I.wappenHintergrund(f, opt && opt.groesse ? { groesse: opt.groesse } : null) : (_orig ? _orig.apply(this, arguments) : '');
    };
  }
  {
    const _orig = window.crestInitials;
    const namen = new Set((window.DFL_LIGA ? window.DFL_LIGA.franchises : []).map(f => f.name));
    window.crestInitials = function (name) {
      if (aktiv() && (namen.has(name) || (hatClub() && name === CLUB.name))) return '';
      return _orig ? _orig.apply(this, arguments) : '';
    };
  }
  // Ligabezeichnung im Kopf: „DFL · Conference … · Division …“
  {
    const _orig = window.tierLabelOf;
    window.tierLabelOf = function (tierKey) {
      if (aktiv() && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl) {
        const f = D().franchise('fcm');
        return f ? `Conference ${D().KONF[f.conference]}` : 'Deutsche Kickdraft Liga';
      }
      return _orig.apply(this, arguments);
    };
  }

  // ── Startseite: eigenes Wappen + Farben ──────────────────────────────────
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      if (aktiv()) {
        farbenSetzen();
        const f = D().franchise('fcm'), b = document.getElementById('hc-badge');
        // D113: 54 bzw. 46 px – das Monogramm (ab 40 px) zeigt hier schon das ganze Kürzel
        if (f && b) { b.textContent = ''; b.setAttribute('style', I.wappenHintergrund(f, { groesse: 54 })); b.classList.add('dfl-badge'); }
        // „Nächstes Spiel“: eigenes Wappen (das Spiel färbt nur den Gegner)
        const h = document.getElementById('hm-home-crest');
        if (f && h) { h.textContent = ''; h.setAttribute('style', I.wappenHintergrund(f, { groesse: 46 })); }
        const a = document.getElementById('hm-away-crest');
        if (a && a.getAttribute('style') && /url\(/.test(a.getAttribute('style'))) a.textContent = '';
        const tier = document.getElementById('hc-tier');
        if (f && tier) tier.textContent = `Deutsche Kickdraft Liga · Conference ${D().KONF[f.conference]} · Division ${f.division}`;
      }
      return r;
    };
  }

  // Teamprofil: Wappen ohne aufgedruckte Initialen
  {
    const _orig = window.showTeamProfile;
    if (typeof _orig === 'function') window.showTeamProfile = function (id) {
      const r = _orig.apply(this, arguments);
      const c = dflFranchise(id) && document.querySelector('#team-profile-ov .tp-crest');
      if (c) c.textContent = '';
      return r;
    };
  }

  // ── Gesichter ────────────────────────────────────────────────────────────
  const eigeneFarben = () => { const f = aktiv() ? D().franchise('fcm') : null; return f ? { farben: f.farben } : null; };
  function spielerAusZeile(row) {
    const attr = (row.getAttribute('onclick') || '') + ' ' + (row.getAttribute('ondragstart') || '');
    const slot = /clickSlot\('([^']+)'\)/.exec(attr);
    const id = slot ? (CLUB.lineup || {})[slot[1]] : (/'bench','([^']+)'/.exec(attr) || /clickBench\('([^']+)'\)/.exec(attr) || [])[1];
    return id ? SQUAD.find(p => p.id === id) : null;
  }
  {
    const _orig = window.renderSquadList;
    if (typeof _orig === 'function') window.renderSquadList = function () {
      const r = _orig.apply(this, arguments);
      if (aktiv() && window.facesjs) {
        farbenSetzen();
        const farben = eigeneFarben();
        document.querySelectorAll('#squad-list .squad-row').forEach(row => {
          if (row.querySelector('.dfl-face')) return;
          const p = spielerAusZeile(row);
          if (p) row.insertAdjacentHTML('afterbegin', `<span class="dfl-face">${I.gesichtSvg(p, farben)}</span>`);
        });
      }
      return r;
    };
  }
  {
    const _orig = window.renderPlayerCard;
    if (typeof _orig === 'function') window.renderPlayerCard = function (p) {
      const r = _orig.apply(this, arguments);
      if (aktiv() && p && window.facesjs) {
        const el = document.getElementById('playercard-sec');
        const name = el && el.querySelector('.pcard-name');
        if (name && !el.querySelector('.dfl-face')) {
          const eigen = SQUAD.some(x => x.id === p.id);
          name.insertAdjacentHTML('beforebegin', `<div class="dfl-pcard-gesicht"><span class="dfl-face gross">${I.gesichtSvg(p, eigen ? eigeneFarben() : null)}</span></div>`);
        }
      }
      return r;
    };
  }

  // ── Emoji in Meldungen → Icons ───────────────────────────────────────────
  {
    const _orig = window.renderNewsFeed;
    if (typeof _orig === 'function') window.renderNewsFeed = function () {
      const r = _orig.apply(this, arguments);
      if (aktiv()) document.querySelectorAll('.news-title').forEach(el => {
        if (!el.dataset.dflIcons) { el.innerHTML = I.emojiZuIcon(el.innerHTML); el.dataset.dflIcons = '1'; }
      });
      return r;
    };
  }

  // ── Navigation: Europa ausblenden, Reiter passend benennen ───────────────
  function navAnpassen() {
    if (!aktiv()) return;
    const setze = (id, html) => { const b = document.getElementById(id); if (b && b.dataset.dfl !== '1') { b.innerHTML = html; b.dataset.dfl = '1'; } };
    const euro = document.getElementById('nav-europa'); if (euro) euro.style.display = 'none';
    setze('nav-liga', '<i class="ti ti-trophy" aria-hidden="true"></i> Liga & Playoffs');
    setze('nav-scout', '<i class="ti ti-binoculars" aria-hidden="true"></i> Scouting');
  }
  {
    const _orig = window.renderHomeTab;
    window.renderHomeTab = function () { navAnpassen(); return _orig.apply(this, arguments); };
  }

  window.DFLDesign = { farbenSetzen, stilWahl, stilSetzen, stilAnwenden, modus: () => modusJetzt };
  // Spielstand schon vor den DFL-Modulen geladen: Ansichten nach dem letzten Skript neu zeichnen
  if (aktiv() && hatClub() && CLUB.dfl) setTimeout(() => {
    try {
      farbenSetzen();
      ['renderAll', 'renderLeagueTab', 'renderHomeTab', 'renderClubTab'].forEach(f => { if (typeof window[f] === 'function') window[f](); });
    } catch (e) { console.warn('[DFL-Design] Neuzeichnen nach dem Laden', e); }
  }, 0);
  console.log('%c[DFL-Design v2] aktiv', 'color:#3fb950;font-weight:bold',
    `— Stil Kenney ${modusJetzt === 'tag' ? 'Tag' : 'Nacht'} (${stilWahl() === 'auto' ? 'nach Uhrzeit' : 'fest'}), Wappen, Gesichter, Icons statt Emoji`);
})();
