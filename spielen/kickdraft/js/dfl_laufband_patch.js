/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   DFL-LAUFBAND  ·  v1   (D72, Wunsch 2026-10-10: „wie bei ESPN kommt das Banner von rechts nach links durchgelaufen,
   auch mit den Seeds in der jeweiligen Conference“, ohne Torschützen)
   ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Nach jedem Spieltag läuft in Office und Liga ein Band von rechts nach links durch:
     · alle Ergebnisse des letzten Spieltags, wie sie in der Tabelle zählen (eigenes Spiel zuerst und markiert)
     · danach die Playoff-Seeds 1–7 je Conference nach aktueller Tabelle (DFLSpiel.setzliste)
     · in den Playoffs die Ergebnisse der letzten Runde (n. V., i. E.) und wer je Conference noch dabei ist
     · nach dem Saisonabschluss bis zum ersten Spieltag: Finale und Meister der letzten Saison
   Das Basisspiel speichert keine Einzelergebnisse (recordResult zählt nur in die Tabelle) → ein Haken merkt sich den
   laufenden Spieltag in LEAGUE.dflSpieltag = { saison, nr, spiele: [[heim, gast, th, tg], …] } (rund 1 KB).
   Bewegung über die Web Animations API mit festem Tempo (px/s): erst von rechts herein, dann ohne Lücke im Kreis (Inhalt
   doppelt, die zweite Hälfte schließt an). Hält beim Antippen/Darüberfahren; neu gestartet nur bei neuem Inhalt, nach dem
   Wiedereinblenden oder wenn sich die Breite ändert (am Handy feuert „resize“ auch beim Scrollen). Bei „Bewegung
   reduzieren“ steht das Band und lässt sich wischen. Antippen öffnet die Liga.
   Lädt nach dfl_app_shell.js (Ansichtswechsel) und vor init_bootstrap.js. CSS: css/dfl_laufband.css.
   API: DFLLaufband.daten() · .zeichne()
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFLSpiel;
  if (!D) { console.warn('[DFL-Laufband] DFLSpiel fehlt – Patch inaktiv'); return; }
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const TEMPO = 60;                                    // Pixel je Sekunde (ESPN-artig ruhig)
  const ANSICHTEN = ['view-home', 'view-liga'];         // nur Office und Liga
  const RUNDE = { 1: 'Wildcard-Runde', 2: 'Divisional-Runde', 3: 'Conference-Finale', 4: 'Finale' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── 1) Ergebnisse des laufenden Spieltags merken ─────────────────────────────────────────────────────────────
  {
    const _orig = window.recordResult;
    if (typeof _orig === 'function') {
      window.recordResult = function (teams, homeId, awayId, gh, ga) {
        const r = _orig.apply(this, arguments);
        try {
          if (dfl()) {
            const nr = (LEAGUE.matchday || 0) + 1;      // advanceMatchday zählt erst nach allen Spielen hoch
            let st = LEAGUE.dflSpieltag;
            if (!st || st.saison !== LEAGUE.season || st.nr !== nr) st = LEAGUE.dflSpieltag = { saison: LEAGUE.season, nr, spiele: [] };
            st.spiele.push([homeId, awayId, gh, ga]);
            // eigene Ligaergebnisse der Saison für den Spielplan (dort stand bisher nur „gespielt“)
            if (homeId === 'fcm' || awayId === 'fcm') {
              let e = LEAGUE.dflEigeneErg;
              if (!e || e.saison !== LEAGUE.season) e = LEAGUE.dflEigeneErg = { saison: LEAGUE.season, erg: {} };
              e.erg[nr] = [gh, ga];
            }
            spaeter();
          }
        } catch (e) { console.warn('[DFL-Laufband] Ergebnis', e); }
        return r;
      };
      try { recordResult = window.recordResult; } catch (e) { /* window.recordResult reicht */ }
    }
  }

  // Spielplan: Ergebnis statt „gespielt“ (Reihenfolge wie die Paarung: Heim zuerst), Farbe nach Sieg/Remis/Niederlage
  {
    const _orig = window.renderLgSpielplan;
    if (typeof _orig === 'function') {
      window.renderLgSpielplan = function () {
        const r = _orig.apply(this, arguments);
        try {
          const e = dfl() && LEAGUE.dflEigeneErg;
          if (e && e.saison === LEAGUE.season) {
            document.querySelectorAll('#lg-sub-spielplan .fixture-row.played').forEach(row => {
              const md = row.querySelector('.fixture-md'), res = row.querySelector('.fixture-res');
              const nr = md ? parseInt(md.textContent, 10) : NaN, x = e.erg[nr];
              if (!res || !x || res.textContent.trim() !== 'gespielt') return;
              const heim = row.querySelector('.fixture-opp').textContent.indexOf('(Heim') >= 0;
              const eig = heim ? x[0] : x[1], geg = heim ? x[1] : x[0];
              res.textContent = `${x[0]}:${x[1]}`;
              res.classList.add(eig > geg ? 'erg-sieg' : eig < geg ? 'erg-niederlage' : 'erg-remis');
            });
          }
        } catch (err) { console.warn('[DFL-Laufband] Spielplan', err); }
        return r;
      };
      try { renderLgSpielplan = window.renderLgSpielplan; } catch (e) { /* window reicht */ }
    }
  }

  // ── 2) Was läuft durch? ──────────────────────────────────────────────────────────────────────────────────────
  function daten() {
    if (!dfl()) return null;
    const po = LEAGUE.dflPO && LEAGUE.dflPO.saison === LEAGUE.season ? LEAGUE.dflPO : null;
    const konfs = Object.keys(D.KONF || {});
    if (po && po.spiele.some(s => s.sieger)) {
      const fertig = po.spiele.filter(s => s.sieger), r = Math.max(...fertig.map(s => s.runde));
      return {
        titel: RUNDE[r] || 'Playoffs',
        // D166: Hin und Rück – Gesamtergebnis, Hinspiel im Zusatz
        spiele: fertig.filter(s => s.runde === r).map(s => ({ h: s.heim, a: s.gast, gh: s.gh + (s.hin ? s.hin.gh : 0), ga: s.ga + (s.hin ? s.hin.ga : 0),
          zusatz: [s.hin ? `Hin ${s.hin.gh}:${s.hin.ga}` : '', s.art === 'Verlängerung' ? 'n. V.' : s.art === 'Elfmeterschießen' && s.elfer ? `i. E. ${s.elfer[0]}:${s.elfer[1]}` : ''].filter(Boolean).join(' · ') })),
        meister: po.meister || null,
        gruppen: po.meister ? [] : konfs.map(k => ({ titel: 'Noch dabei · ' + D.KONF[k],
          eintraege: (po.setzliste[k] || []).map((id, i) => ({ id, seed: i + 1 })).filter(x => !(x.id in po.ausgeschieden)) }))
      };
    }
    const st = LEAGUE.dflSpieltag;
    // Nach dem Saisonabschluss bis zum ersten Spieltag: Finale und Meister der letzten Saison
    const P = LEAGUE.dflPlayoffs, fin = P && P.meister && P.saison === LEAGUE.season - 1 && Array.isArray(P.spiele) ? P.spiele.find(s => s.runde === 4) : null;
    if (!po && fin && !(st && st.saison === LEAGUE.season && st.spiele.length)) {
      return { titel: 'Finale', meister: P.meister, gruppen: [],
        spiele: [{ h: fin.heim, a: fin.gast, gh: fin.gh, ga: fin.ga,
          zusatz: fin.art === 'Verlängerung' ? 'n. V.' : fin.art === 'Elfmeterschießen' && fin.elfer ? `i. E. ${fin.elfer[0]}:${fin.elfer[1]}` : '' }] };
    }
    if (!st || st.saison !== LEAGUE.season || !st.spiele.length) return null;
    return {
      titel: st.nr + '. Spieltag',
      spiele: st.spiele.map(([h, a, gh, ga]) => ({ h, a, gh, ga, zusatz: '' })),
      gruppen: konfs.map(k => {
        const s = D.setzliste(k);
        return { titel: 'Seeds · ' + D.KONF[k], eintraege: s.sieger.concat(s.wild).map((t, i) => ({ id: t.id, seed: i + 1, pts: t.pts })) };
      })
    };
  }

  // ── 3) Band bauen ────────────────────────────────────────────────────────────────────────────────────────────
  // Namen nur aus der Franchise (erfundene Namen, D57) – nie die interne ID: die enthält den echten Vereinsnamen
  // („dfl_leipzig-imperials“, Prüfung 2026-10-10: eine globale teamName gibt es nicht, das Band zeigte die IDs)
  const franchise = id => (D && D.franchise ? D.franchise(id) : null) || null;
  const kurz = id => (window.DFLNamen && DFLNamen.kuerzel(id)) || (franchise(id) || {}).kurz || '–';
  const wappen = id => `<span class="lg-crest db-wappen" style="${typeof crestStyle === 'function' ? crestStyle(D && D.spielId ? D.spielId(D.dflIdVon(id)) : id) : ''}" aria-hidden="true"></span>`;
  const name = id => id === 'fcm' && typeof CLUB !== 'undefined' && CLUB && CLUB.name ? CLUB.name : (franchise(id) || {}).name || kurz(id);
  function inhalt(d) {
    const sp = d.spiele.slice().sort((x, y) => ((y.h === 'fcm' || y.a === 'fcm') - (x.h === 'fcm' || x.a === 'fcm')));
    const erg = sp.map(s => `<span class="db-erg${s.h === 'fcm' || s.a === 'fcm' ? ' db-eigen' : ''}">${wappen(s.h)}${esc(kurz(s.h))}` +
      ` <b>${s.gh}:${s.ga}</b> ${esc(kurz(s.a))}${wappen(s.a)}${s.zusatz ? `<small>${esc(s.zusatz)}</small>` : ''}</span>`).join('');
    let html = `<span class="db-marke">${esc(d.titel)}</span>${erg}`;
    if (d.meister) html += `<span class="db-marke db-gold">Meister</span><span class="db-erg db-eigen">${wappen(d.meister)}${esc(name(d.meister))}</span>`;
    (d.gruppen || []).forEach(g => {
      html += `<span class="db-marke db-leise">${esc(g.titel)}</span>` + g.eintraege.map(x =>
        `<span class="db-seed${x.id === 'fcm' ? ' db-eigen' : ''}"><i>${x.seed}</i>${wappen(x.id)}${esc(kurz(x.id))}${x.pts != null ? `<small>${x.pts}</small>` : ''}</span>`).join('');
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
  const sichtbar = () => ANSICHTEN.some(id => { const v = document.getElementById(id); return v && v.classList.contains('active') && getComputedStyle(v).display !== 'none'; })
    && !(document.getElementById('view-fo') && document.getElementById('view-fo').classList.contains('active'));
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
    // Kennung aus den Daten, nicht aus dem HTML: crestStyle vergibt je Aufruf neue clipPath-IDs → das Band liefe sonst bei
    // jedem renderAll von vorn los
    const sig = JSON.stringify(d), neu = sig !== kennung;
    band.setAttribute('aria-label', d.titel + ': Ergebnisse und Seeds, Antippen öffnet die Liga');
    if (neu) { const html = inhalt(d); band.querySelector('.db-lauf').innerHTML = `<div class="db-teil">${html}</div><div class="db-teil" aria-hidden="true">${html}</div>`; kennung = sig; }
    const warVersteckt = band.hidden;
    band.hidden = false;
    if (neu || warVersteckt || !anim) starte();
  }
  let geplant = false;
  function spaeter() { if (geplant) return; geplant = true; setTimeout(() => { geplant = false; try { zeichne(); } catch (e) { console.warn('[DFL-Laufband]', e); } }, 0); }

  // ── 4) Anlässe: Ansichtswechsel, Wochentakt, Playoff-Runde, Laden ──────────────────────────────────────────────
  ['switchAppView', 'advanceCalendarWeek', 'postMatchContinue', 'renderAll'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { const r = _orig.apply(this, arguments); spaeter(); return r; };
    try { if (fn === 'switchAppView') switchAppView = window[fn]; } catch (e) { /* window reicht */ }
  });
  // Front Office der App-Shell schaltet ohne switchAppView um → nur die Klasse der Ansichten beobachten (nicht den ganzen
  // Baum: im Spieltag wechseln laufend Klassen)
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

  window.DFLLaufband = { daten, zeichne, inhalt };
  spaeter();
  console.log('%c[DFL-Laufband v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Ergebnisse des Spieltags + Seeds je Conference von rechts nach links (D72), Playoff-Runden, ohne Torschützen');
})();
