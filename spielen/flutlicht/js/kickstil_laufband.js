/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   KICKSTIL-LAUFBAND  ·  v1   (aus Kickdraft dfl_laufband_patch.js, für unsere Ligenpyramide)
   ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Nach jedem Spieltag läuft in Übersicht und Liga ein Band von rechts nach links durch (ESPN-artig):
     · alle Ergebnisse des letzten Spieltags der EIGENEN Liga (eigenes Spiel zuerst und markiert), mit Wappen
     · danach die Tabellenspitze (Platz 1–5) und – falls weiter hinten – der eigene Platz
     · nach dem Saisonabschluss bis zum ersten Spieltag: Meister der eigenen Liga und der eigene Endplatz
   Das Basisspiel speichert keine Einzelergebnisse (recordResult zählt nur in die Tabelle) → ein Haken merkt sich den
   laufenden Spieltag in LEAGUE.ksSpieltag = { saison, nr, spiele: [[heim, gast, th, tg], …] } (rund 1 KB).
   Nur Ergebnisse aus der Gruppe des eigenen Vereins (recordResult läuft auch für alle anderen Ligen und Europa).
   Bewegung über die Web Animations API mit festem Tempo; hält beim Antippen/Darüberfahren; Antippen öffnet die Liga.
   Bei „Bewegung reduzieren“ steht das Band und lässt sich wischen.
   Lädt nach kickstil_verein.js (crestStyle → generierte Wappen) und vor init_bootstrap.js. CSS: css/dfl_laufband.css.
   API: KSLaufband.daten() · .zeichne()
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const aktiv = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers;
  const TEMPO = 60;                                    // Pixel je Sekunde
  const ANSICHTEN = ['view-home', 'view-liga'];         // nur Übersicht/Office und Liga
  const SPITZE = 5;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eigeneGruppe = () => { try { const g = findFcmGroup(LEAGUE); return g || null; } catch (e) { return null; } };

  // ── 1) Ergebnisse des laufenden Spieltags merken ─────────────────────────────────────────────────────────────
  {
    const _orig = window.recordResult;
    if (typeof _orig === 'function') {
      window.recordResult = function (teams, homeId, awayId, gh, ga) {
        const r = _orig.apply(this, arguments);
        try {
          const g = aktiv() && eigeneGruppe();
          if (g && teams === g.group.teams) {
            const nr = (LEAGUE.matchday || 0) + 1;      // advanceMatchday zählt erst nach allen Spielen hoch
            let st = LEAGUE.ksSpieltag;
            if (!st || st.saison !== LEAGUE.season || st.nr !== nr) st = LEAGUE.ksSpieltag = { saison: LEAGUE.season, nr, spiele: [] };
            st.spiele.push([homeId, awayId, gh, ga]);
            spaeter();
          }
        } catch (e) { console.warn('[Kickstil-Laufband] Ergebnis', e); }
        return r;
      };
      try { recordResult = window.recordResult; } catch (e) { /* window.recordResult reicht */ }
    }
  }

  // Saisonende: Meister und eigenen Platz merken, BEVOR Auf-/Abstieg die Gruppen umbaut
  {
    const _orig = window.runEndOfSeason;
    if (typeof _orig === 'function') {
      window.runEndOfSeason = function (league) {
        try {
          const g = eigeneGruppe();
          if (g) {
            const tbl = computeTable(g.group.teams), platz = tbl.findIndex(t => t.id === 'fcm') + 1;
            LEAGUE.ksLetzteSaison = { saison: LEAGUE.season, liga: g.group.name || g.tierName,
              meister: { id: tbl[0].id, name: tbl[0].name, pts: tbl[0].pts }, platz, pts: (tbl[platz - 1] || {}).pts,
              pokal: !!(typeof CUP !== 'undefined' && CUP && CUP.winnerId === 'fcm') };   // Pokalsieg im Spielstand (Laden: Titeljahr)
          }
        } catch (e) { console.warn('[Kickstil-Laufband] Saisonende', e); }
        return _orig.apply(this, arguments);
      };
      try { runEndOfSeason = window.runEndOfSeason; } catch (e) { /* window reicht */ }
    }
  }

  // ── 2) Was läuft durch? ──────────────────────────────────────────────────────────────────────────────────────
  function daten() {
    if (!aktiv()) return null;
    const g = eigeneGruppe(); if (!g) return null;
    const liga = g.group.name || g.tierName;
    const st = LEAGUE.ksSpieltag;
    const laufend = st && st.saison === LEAGUE.season && st.spiele.length;
    const L = LEAGUE.ksLetzteSaison;
    if (!laufend && L && L.saison === LEAGUE.season - 1) {
      return { titel: 'Saison ' + L.saison + ' · ' + L.liga, spiele: [],
        meister: L.meister, gruppen: L.meister.id === 'fcm' ? [] : [{ titel: 'Dein Endplatz', eintraege: [{ id: 'fcm', platz: L.platz, pts: L.pts }] }] };
    }
    if (!laufend) return null;
    const tbl = computeTable(g.group.teams);
    const eintraege = tbl.slice(0, SPITZE).map((t, i) => ({ id: t.id, name: t.name, platz: i + 1, pts: t.pts }));
    const eig = tbl.findIndex(t => t.id === 'fcm');
    if (eig >= SPITZE) eintraege.push({ id: 'fcm', name: tbl[eig].name, platz: eig + 1, pts: tbl[eig].pts, abstand: true });
    return {
      titel: st.nr + '. Spieltag · ' + liga,
      spiele: st.spiele.map(([h, a, gh, ga]) => ({ h, a, gh, ga })),
      gruppen: [{ titel: 'Tabelle', eintraege }]
    };
  }

  // ── 3) Band bauen ────────────────────────────────────────────────────────────────────────────────────────────
  // Namen ohne Rechtsform, damit „Lokomotive Leipzig“ und „Chemie Leipzig“ unterscheidbar bleiben
  const FORM = /^(\d+\.?|FC|SV|SC|VfL|VfB|TSG|TSV|FSV|SpVgg|SG|BV|RB|SSV|SpVg|KFC|MSV|FK|SSC|SU|TuS|TSC|VfR|SVgg|BSG|VSG|FSV)$/i;
  function name(id) {
    let n = '';
    if (id === 'fcm') n = CLUB.name;
    else { try { const t = eigeneGruppe().group.teams.find(x => x.id === id); n = t ? t.name : ''; } catch (e) { n = ''; } }
    if (!n && window.KSVerein) { const d = KSVerein.daten(id); n = d ? d.name : ''; }
    n = String(n || id);
    const w = n.split(' ').filter(x => !FORM.test(x));
    return w.length ? w.join(' ') : n;
  }
  const wappen = id => `<span class="lg-crest db-wappen" style="${typeof crestStyle === 'function' ? esc(crestStyle(id)) : ''}" aria-hidden="true"></span>`;
  function inhalt(d) {
    const sp = d.spiele.slice().sort((x, y) => ((y.h === 'fcm' || y.a === 'fcm') - (x.h === 'fcm' || x.a === 'fcm')));
    const erg = sp.map(s => `<span class="db-erg${s.h === 'fcm' || s.a === 'fcm' ? ' db-eigen' : ''}">${wappen(s.h)}${esc(name(s.h))}` +
      ` <b>${s.gh}:${s.ga}</b> ${esc(name(s.a))}${wappen(s.a)}</span>`).join('');
    let html = `<span class="db-marke">${esc(d.titel)}</span>${erg}`;
    if (d.meister) html += `<span class="db-marke db-gold">Meister</span><span class="db-erg${d.meister.id === 'fcm' ? ' db-eigen' : ''}">` +
      `${wappen(d.meister.id)}${esc(d.meister.name)}<small>${d.meister.pts} Pkt.</small></span>`;
    (d.gruppen || []).forEach(g => {
      html += `<span class="db-marke db-leise">${esc(g.titel)}</span>` + g.eintraege.map(x =>
        `${x.abstand ? '<span class="db-luecke">…</span>' : ''}<span class="db-seed${x.id === 'fcm' ? ' db-eigen' : ''}"><i>${x.platz}</i>` +
        `${wappen(x.id)}${esc(name(x.id))}${x.pts != null ? `<small>${x.pts} Pkt.</small>` : ''}</span>`).join('');
    });
    return html;
  }
  let band = null, anim = null, kennung = '', breite = 0, gehalten = false;
  function baue() {
    if (band) return band;
    const nav = document.querySelector('.app .appnav'); if (!nav) return null;
    band = document.createElement('div');
    band.id = 'dfl-band'; band.hidden = true;
    band.setAttribute('role', 'button'); band.tabIndex = 0;
    band.innerHTML = '<div class="db-fenster"><div class="db-lauf"></div></div>';
    nav.after(band);
    const halt = () => { gehalten = true; if (anim) anim.pause(); }, weiter = () => { gehalten = false; if (anim) anim.play(); };
    band.addEventListener('pointerenter', halt); band.addEventListener('pointerleave', weiter);
    band.addEventListener('pointerdown', halt); band.addEventListener('pointerup', weiter); band.addEventListener('pointercancel', weiter);
    band.addEventListener('focus', halt); band.addEventListener('blur', weiter);
    const zurLiga = () => { if (typeof switchAppView === 'function') switchAppView('liga', document.getElementById('nav-liga')); };
    band.addEventListener('click', zurLiga);
    band.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); zurLiga(); } });
    return band;
  }
  const sichtbar = () => ANSICHTEN.some(id => { const v = document.getElementById(id); return v && v.classList.contains('active') && getComputedStyle(v).display !== 'none'; });
  const ruhig = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function starte() {
    if (anim) { anim.cancel(); anim = null; }
    const lauf = band.querySelector('.db-lauf'), fenster = band.querySelector('.db-fenster'), teil = lauf.querySelector('.db-teil');
    breite = fenster.clientWidth;
    if (band.hidden || typeof lauf.animate !== 'function' || ruhig()) return;
    const w = breite, tw = teil ? teil.offsetWidth : 0;
    if (!w || !tw) return;
    const neu = (bild, dauer, n) => { const a = lauf.animate(bild, { duration: Math.round(dauer / TEMPO * 1000), iterations: n, easing: 'linear' }); if (gehalten) a.pause(); return a; };
    // erst von rechts herein …
    const rein = anim = neu([{ transform: `translateX(${w}px)` }, { transform: 'translateX(0px)' }], w, 1);
    // … dann im Kreis: nach einer Hälfte steht die zweite genau dort, wo die erste begann
    rein.onfinish = () => { if (anim === rein) anim = neu([{ transform: 'translateX(0px)' }, { transform: `translateX(${-tw}px)` }], tw, Infinity); };
  }
  function zeichne() {
    if (!baue()) return;
    const d = daten(), zeigen = !!d && sichtbar();
    if (!zeigen) { band.hidden = true; if (anim) { anim.cancel(); anim = null; } return; }
    // Kennung aus den Daten, nicht aus dem HTML – sonst liefe das Band bei jedem Neuzeichnen von vorn los
    const sig = JSON.stringify(d), neu = sig !== kennung;
    band.setAttribute('aria-label', d.titel + ': Ergebnisse und Tabelle, Antippen öffnet die Liga');
    if (neu) { const html = inhalt(d); band.querySelector('.db-lauf').innerHTML = `<div class="db-teil">${html}</div><div class="db-teil" aria-hidden="true">${html}</div>`; kennung = sig; }
    const warVersteckt = band.hidden;
    band.hidden = false;
    if (neu || warVersteckt || !anim) starte();
  }
  let geplant = false;
  function spaeter() { if (geplant) return; geplant = true; setTimeout(() => { geplant = false; try { zeichne(); } catch (e) { console.warn('[Kickstil-Laufband]', e); } }, 0); }

  // ── 4) Anlässe: Ansichtswechsel, Wochentakt, Laden ───────────────────────────────────────────────────────────
  ['switchAppView', 'advanceCalendarWeek', 'postMatchContinue', 'renderAll'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { const r = _orig.apply(this, arguments); spaeter(); return r; };
    try { if (fn === 'switchAppView') switchAppView = window[fn]; } catch (e) { /* window reicht */ }
  });
  // Die App-Shell (Handy) schaltet teils ohne switchAppView um → Klassen der Ansichten beobachten
  try {
    const app = document.querySelector('.app');
    if (app && window.MutationObserver) {
      const obs = new MutationObserver(spaeter);
      const beobachte = () => app.querySelectorAll(':scope > .app-view').forEach(v => obs.observe(v, { attributes: true, attributeFilter: ['class'] }));
      beobachte();
      new MutationObserver(() => { beobachte(); spaeter(); }).observe(app, { childList: true });
    }
  } catch (e) { /* ohne Beobachter: Anlässe oben reichen */ }
  window.addEventListener('resize', () => { if (band && !band.hidden && band.querySelector('.db-fenster').clientWidth !== breite) starte(); });

  window.KSLaufband = { daten, zeichne, inhalt };
  spaeter();
  console.log('[Kickstil-Laufband v1] aktiv — Ergebnisse des Spieltags + Tabellenspitze der eigenen Liga von rechts nach links');
})();
