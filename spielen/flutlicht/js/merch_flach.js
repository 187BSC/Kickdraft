/* ═══════════════════════════════════════════════════════════════════════════
   FANSHOP FLACHER · v1 · Kickdraft und Unter Flutlicht (gleiche Datei in beiden Spielen)
   Nutzer 2026-10-22: „man kann auch höher generell das Niveau ansetzen bei Level 1 und dann geht's weniger steil nach oben …
   später der Outcome bei den Stufen prozentual nicht mehr viel“ – „bitte das alles auch für die Vereinskarriere“.
   Eigener Verein: Spieltags-Merch (merchIncomePerMatch) und Wochenumsatz (merchandisingIncome) wie Stufe 1, mal FLACH[Stufe]:
   Stufe 1 × 1,25, danach +18/+14/+11/+9/+7/+5/+4/+3/+2 % – Stufe 10 bringt das Doppelte von Stufe 1 statt das Fünffache.
   Gleiche Kurve wie die KI-Welt in Kickdraft (dfl_finanzen.js CFG.merch.flach, Test analyse/kd_anlagen_test.js).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const FLACH = [1, 1.18, 1.345, 1.49, 1.62, 1.73, 1.82, 1.89, 1.945, 1.98].map(x => x * 1.25);
  const CFG = { aus: false, FLACH };
  const stufe = () => { try { return Math.max(1, Math.min(10, (CLUB.facilities && CLUB.facilities.merchandising) || 1)); } catch (e) { return 1; } };
  // Spieltag: die alte Formel multipliziert mit 1 + (Stufe − 1) × 0,2 → auf Stufe 1 zurückrechnen, dann FLACH
  const _proSpiel = window.merchIncomePerMatch;
  if (typeof _proSpiel === 'function') {
    window.merchIncomePerMatch = function () {
      const alt = _proSpiel.apply(this, arguments);
      if (CFG.aus) return alt;
      const s = stufe();
      return Math.round(alt / (1 + (s - 1) * 0.2) * FLACH[s - 1]);
    };
    try { merchIncomePerMatch = window.merchIncomePerMatch; } catch (e) { /* nur im Spiel */ }
  }
  // Woche: alte Tabelle [1500 … 311000] → Wert von Stufe 1 (1500) mal FLACH, Stadionfaktor bleibt
  const _woche = window.merchandisingIncome;
  if (typeof _woche === 'function') {
    window.merchandisingIncome = function () {
      const alt = _woche.apply(this, arguments);
      if (CFG.aus || !alt) return alt;
      const T = [1500, 4000, 9000, 17000, 31000, 53000, 86000, 136000, 206000, 311000], s = stufe();
      return Math.round(alt / T[s - 1] * T[0] * FLACH[s - 1]);
    };
    try { merchandisingIncome = window.merchandisingIncome; } catch (e) { /* nur im Spiel */ }
  }
  window.MerchFlach = CFG;
  console.log('[Fanshop flacher v1] aktiv — Stufe 1 × 1,25, Stufe 10 × 2,5 (vorher × 5)');
})();
