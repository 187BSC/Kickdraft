/* ===== player_attributes.js =====
   DETAILLIERTE SPIELERWERTE FÜR ALLE SPIELER
   ─────────────────────────────────────────────────────────────────────────────
   Die Kartei kennt bisher nur fünf Grobwerte (def, mid, att, pace, mental).
   Dieses Modul leitet daraus die feinen Werte ab — für alle 1558 Kartei-Spieler,
   alle NPC-Kader UND jeden neu erzeugten Spieler.

   DREI ENTWURFSENTSCHEIDUNGEN, die wichtig sind:

   1. ABGELEITET, NICHT GEWÜRFELT. Die Werte entstehen aus den vorhandenen
      Grobwerten plus einem Positionsprofil. Ein Innenverteidiger bekommt so
      zwangsläufig Kopfball und Zweikampf, ein Flügel Dribbling und Flanken.

   2. DETERMINISTISCH. Die Streuung kommt aus dem `seed` des Spielers (ersatzweise
      aus einem Hash über Name und Alter) — NIE aus Math.random(). Sonst hätte
      derselbe Spieler nach jedem Neuladen andere Werte.

   3. BEI BEDARF BERECHNET UND GECACHT. Statt 1558 Objekte vorab aufzublähen,
      liefert `spielerWerte(p)` die Werte on demand und legt sie nicht-aufzählbar
      am Spieler ab. Dadurch sind automatisch auch generierte Spieler abgedeckt,
      ohne dass jede Erzeugungsstelle im Code angefasst werden muss — und der
      Spielstand wächst nicht, weil JSON.stringify nicht-aufzählbare Felder
      überspringt.

   Fitness ist bewusst KEIN abgeleiteter Wert: die Tagesform steht schon als
   `p.fitness` im Spieler. Ausdauer dagegen ist die trainierbare Eigenschaft.
   ============================================================================= */
(function () {
  'use strict';

  // ── Beschreibung der Werte (für Oberfläche und Training nutzbar) ───────────
  const ALLGEMEIN = [
    { k: 'ausdauer',      n: 'Ausdauer' },
    { k: 'schnelligkeit', n: 'Schnelligkeit' },
    { k: 'kraft',         n: 'Kraft' }
  ];
  const TORWART = [
    { k: 'einsGegenEins', n: '1 gegen 1' },
    { k: 'spielaufbau',   n: 'Spielaufbau' },
    { k: 'abwurf',        n: 'Abwurf' },
    { k: 'reflexe',       n: 'Reflexe' },
    { k: 'paraden',       n: 'Paraden' }
  ];
  const FELD = [
    { k: 'defStellung',      n: 'Defensives Stellungsspiel' },
    { k: 'tackling',         n: 'Tackling' },
    { k: 'defEinsGegenEins', n: 'Defensives 1 gegen 1' },
    { k: 'kopfball',         n: 'Kopfball' },
    { k: 'passen',           n: 'Passen' },
    { k: 'spielintelligenz', n: 'Spielintelligenz' },
    { k: 'dribbling',        n: 'Dribbling' },
    { k: 'flanken',          n: 'Flanken' },
    { k: 'schiessen',        n: 'Schießen' },
    { k: 'offStellung',      n: 'Offensives Stellungsspiel' },
    { k: 'offEinsGegenEins', n: 'Offensives 1 gegen 1' }
  ];

  // Woraus speist sich ein Wert? (Grobwert der Kartei)
  const QUELLE = {
    ausdauer: 'mental', schnelligkeit: 'pace', kraft: 'def',
    einsGegenEins: 'def', spielaufbau: 'mid', abwurf: 'mid', reflexe: 'def', paraden: 'def',
    defStellung: 'def', tackling: 'def', defEinsGegenEins: 'def', kopfball: 'def',
    passen: 'mid', spielintelligenz: 'mental', dribbling: 'mid', flanken: 'mid',
    schiessen: 'att', offStellung: 'att', offEinsGegenEins: 'pace'
  };

  // Positionsprofile: Abweichung vom Grundniveau des Spielers in Punkten.
  // Summe je Position bewusst nahe null, damit das Gesamtniveau erhalten bleibt.
  const PROFIL = {
    TW:  { paraden: 8, reflexe: 7, einsGegenEins: 5, spielaufbau: -2, abwurf: 2,
           kraft: 3, ausdauer: -6, schnelligkeit: -6 },
    IV:  { defStellung: 7, tackling: 7, defEinsGegenEins: 6, kopfball: 9, kraft: 7,
           passen: -1, spielintelligenz: 2, dribbling: -9, flanken: -11,
           schiessen: -13, offStellung: -11, offEinsGegenEins: -8, schnelligkeit: -2 },
    AV:  { defStellung: 3, tackling: 4, defEinsGegenEins: 4, kopfball: -2, kraft: 0,
           passen: 0, spielintelligenz: 0, dribbling: 1, flanken: 7,
           schiessen: -10, offStellung: -3, offEinsGegenEins: 2,
           ausdauer: 6, schnelligkeit: 3 },
    ZDM: { defStellung: 6, tackling: 6, defEinsGegenEins: 5, kopfball: 3, kraft: 4,
           passen: 3, spielintelligenz: 5, dribbling: -3, flanken: -5,
           schiessen: -7, offStellung: -6, offEinsGegenEins: -5, ausdauer: 3 },
    ZM:  { defStellung: 0, tackling: 0, defEinsGegenEins: 0, kopfball: -1, kraft: 0,
           passen: 7, spielintelligenz: 5, dribbling: 2, flanken: 0,
           schiessen: -2, offStellung: 0, offEinsGegenEins: 0, ausdauer: 5 },
    ZOM: { defStellung: -8, tackling: -7, defEinsGegenEins: -6, kopfball: -4, kraft: -3,
           passen: 6, spielintelligenz: 7, dribbling: 6, flanken: 2,
           schiessen: 3, offStellung: 7, offEinsGegenEins: 5 },
    FL:  { defStellung: -6, tackling: -6, defEinsGegenEins: -4, kopfball: -7, kraft: -3,
           passen: 0, spielintelligenz: 1, dribbling: 9, flanken: 8,
           schiessen: 1, offStellung: 4, offEinsGegenEins: 9,
           schnelligkeit: 5, ausdauer: 3 },
    ST:  { defStellung: -11, tackling: -10, defEinsGegenEins: -7, kopfball: 6, kraft: 4,
           passen: -4, spielintelligenz: 1, dribbling: 2, flanken: -8,
           schiessen: 11, offStellung: 10, offEinsGegenEins: 5 }
  };
  PROFIL.AM = PROFIL.ZOM;                       // „AM" in der Kartei = offensives Mittelfeld
  // DFL D95 (Positionen mit Seite): LV/RV wie AV, LF/RF wie FL; LM/RM eigenes Profil – Flanken, Ausdauer, Tempo, ordentlich
  // nach hinten (zwischen Außenverteidiger und Flügel)
  PROFIL.LV = PROFIL.RV = PROFIL.AV;
  PROFIL.LF = PROFIL.RF = PROFIL.FL;
  PROFIL.LM = PROFIL.RM = { defStellung: -1, tackling: -1, defEinsGegenEins: 1, kopfball: -6, kraft: -3,
    passen: 3, spielintelligenz: 2, dribbling: 4, flanken: 9,
    schiessen: -4, offStellung: 1, offEinsGegenEins: 3,
    ausdauer: 6, schnelligkeit: 3 };

  // ── Deterministische Streuung ──────────────────────────────────────────────
  // Ein Spieler ist nie exakt sein Profil: der eine Innenverteidiger ist
  // kopfballstark, der andere schnell. Diese Abweichung MUSS reproduzierbar sein.
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function grundSaat(p) {
    if (p.seed != null && isFinite(p.seed)) return (p.seed >>> 0) || 1;
    return hash(String(p.firstName || '') + '|' + String(p.name || '') + '|' + (p.age || 0)) || 1;
  }
  // Streuung je Spieler UND Wert — beide gehen in den Hash ein
  function streuung(saat, key, spanne) {
    const h = hash(key + '#' + saat);
    return ((h % 1000) / 999 - 0.5) * 2 * spanne;
  }

  function hauptPos(p) {
    const pos = (p.positions && p.positions[0]) || p.pos || 'ZM';
    return PROFIL[pos] ? pos : 'ZM';
  }

  // ── Einsatz auf einer FREMDEN Position ─────────────────────────────────────
  // Bisher lieferte das Modul immer das Profil der Stammposition. Steht ein
  // Torwart im Feld, kam dadurch der 11er-Torwartsatz zurück — `passen`,
  // `dribbling`, `spielintelligenz` und `schiessen` waren schlicht `undefined`.
  // Die Match-Engine rechnet damit ins Leere: gemessen 33 Pässe und 0,4 Schüsse
  // pro Spiel statt 495/9,6. Deshalb entscheidet ab jetzt die Position, auf der
  // ein Spieler TATSÄCHLICH aufläuft, welcher Wertesatz gilt.
  const KETTE = { TW: 0, IV: 1, AV: 2, LV: 2, RV: 2, ZDM: 3, ZM: 4, ZOM: 5, AM: 5, LM: 5, RM: 5, FL: 6, LF: 6, RF: 6, ST: 7 };

  // Wie weit ist die Einsatzposition von dem entfernt, was der Spieler kann?
  // 0 = Stammposition oder gelernte Nebenposition, sonst wächst der Abstand.
  function fremdheit(p, einsatz) {
    const stamm = hauptPos(p);
    if (einsatz === stamm) return 0;
    // Gelernte Nebenposition (p.positions) kostet nichts.
    if (Array.isArray(p.positions) && p.positions.indexOf(einsatz) >= 0) return 0;
    const a = KETTE[stamm], b = KETTE[einsatz];
    if (a == null || b == null) return 1;
    // Torwart im Feld (oder umgekehrt) ist der Extremfall — ein Keeper hat die
    // Feldfähigkeiten nie trainiert, ein Feldspieler steht ratlos im Tor.
    if ((a === 0) !== (b === 0)) return TORWART_TAUSCH;
    return Math.abs(a - b);
  }
  const TORWART_TAUSCH = 99;

  // Malus aufs Grundniveau. Ein Stürmer als Innenverteidiger ist schlecht, aber
  // nicht so verloren wie ein Torwart im Mittelfeld — deshalb zwei Stufen:
  // innerhalb des Feldes 2,2 Punkte je Kettenschritt (Deckel 11), beim
  // Torwart-Tausch der volle Satz.
  function fremdMalus(f) {
    if (f <= 0) return 0;
    if (f === TORWART_TAUSCH) return 24;
    return Math.min(11, f * 2.2);
  }
  // DFL (D81): für eigene Spieler derselbe Abzug wie in Anzeige, Teamstärke und „Beste Elf“ (dfl_position_patch.js setzt
  // SpielerAttribute.abzugHaken: gelernte 2./3. Position −2, nicht gelernt −8/−12/−18, Torwart ↔ Feld −24).
  // Liefert der Haken keine Zahl (KI-Spieler, außerhalb der DFL), gilt der Abzug oben.
  function abzugFuer(p, pos) {
    const h = window.SpielerAttribute && window.SpielerAttribute.abzugHaken;
    if (typeof h === 'function') { const a = h(p, pos); if (typeof a === 'number' && isFinite(a)) return a; }
    return fremdMalus(fremdheit(p, pos));
  }

  // Grundniveau: bevorzugt der bereits berechnete OVR, sonst aus den Grobwerten.
  // Die Kartei (EMBEDDED_PLAYERS) führt keinen OVR — deshalb der Ersatzweg.
  function niveau(p) {
    if (p.ovr != null && isFinite(p.ovr) && p.ovr > 0) return p.ovr;
    const pos = hauptPos(p);
    const d = p.def || 55, m = p.mid || 55, a = p.att || 55, me = p.mental || 55;
    let v;
    if (pos === 'TW') v = d * 0.72 + m * 0.10 + me * 0.18;
    else if (pos === 'IV') v = d * 0.58 + m * 0.22 + a * 0.06 + me * 0.14;
    else if (pos === 'AV' || pos === 'LV' || pos === 'RV') v = d * 0.44 + m * 0.30 + a * 0.12 + me * 0.14;
    else if (pos === 'LM' || pos === 'RM') v = d * 0.16 + m * 0.46 + a * 0.24 + me * 0.14;
    else if (pos === 'ZDM') v = d * 0.36 + m * 0.42 + a * 0.08 + me * 0.14;
    else if (pos === 'ZM') v = d * 0.20 + m * 0.52 + a * 0.14 + me * 0.14;
    else if (pos === 'ZOM' || pos === 'AM') v = d * 0.08 + m * 0.48 + a * 0.30 + me * 0.14;
    else if (pos === 'FL' || pos === 'LF' || pos === 'RF') v = d * 0.08 + m * 0.38 + a * 0.40 + me * 0.14;
    else v = d * 0.05 + m * 0.25 + a * 0.56 + me * 0.14;
    return Math.round(v);
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function berechne(p, einsatzPos) {
    const stamm = hauptPos(p);
    const pos = (einsatzPos && PROFIL[einsatzPos]) ? einsatzPos : stamm;
    const prof = PROFIL[pos] || {}, saat = grundSaat(p);
    const nv = Math.max(20, Math.round(niveau(p) - abzugFuer(p, pos)));
    const basis = { def: p.def || 55, mid: p.mid || 55, att: p.att || 55,
                    pace: p.pace || 55, mental: p.mental || 55 };
    const liste = ALLGEMEIN.concat(pos === 'TW' ? TORWART : FELD);
    const w = { _pos: pos, _niveau: nv, _torwart: pos === 'TW' };
    liste.forEach(e => {
      const quelle = basis[QUELLE[e.k]] != null ? basis[QUELLE[e.k]] : nv;
      // Grundniveau und passender Grobwert je zur Hälfte — so bleibt der Spieler
      // insgesamt seiner Stärke treu, behält aber seinen Charakter aus der Kartei.
      const roh = nv * 0.55 + quelle * 0.45 + (prof[e.k] || 0) + streuung(saat, e.k, 3.5);
      w[e.k] = clamp(Math.round(roh), 20, 99);
    });
    // Schnelligkeit läuft bewusst durch dieselbe Mischung wie alle anderen Werte.
    // Der Rohwert `pace` der Kartei liegt für Offensivspieler auf einer eigenen,
    // deutlich höheren Skala (Flügel im Schnitt 87 bei Niveau 67) — unvermischt
    // stünde neben „Passen 66" ein „Schnelligkeit 92", was den Satz unstimmig macht.
    // Schnelle Spieler bleiben durch den 45-%-Anteil trotzdem klar erkennbar.
    w.schnelligkeit = clamp(Math.round(nv * 0.55 + basis.pace * 0.45
      + (prof.schnelligkeit || 0) + streuung(saat, 'sp', 2.5)), 20, 99);
    return w;
  }

  // ── Öffentliche Schnittstelle ──────────────────────────────────────────────
  // Werte eines Spielers holen (berechnet beim ersten Zugriff, danach gecacht).
  // `einsatzPos` (optional): Position, auf der der Spieler in diesem Spiel
  // aufläuft. Ohne Angabe gilt seine Stammposition — so verhalten sich alle
  // bestehenden Aufrufer (Kader-Oberfläche, Training) unverändert.
  function versteckt(p, feld, wert) {
    try { Object.defineProperty(p, feld, { value: wert, enumerable: false, writable: true, configurable: true }); }
    catch (e) { p[feld] = wert; }
    return wert;
  }
  window.spielerWerte = function (p, einsatzPos) {
    if (!p || typeof p !== 'object') return null;
    const stamm = hauptPos(p);
    const pos = (einsatzPos && PROFIL[einsatzPos]) ? einsatzPos : stamm;
    // Stammposition: der eingebaute Cache — nicht aufzählbar, damit der
    // Spielstand nicht wächst.
    if (pos === stamm) return p._werte || versteckt(p, '_werte', berechne(p, stamm));
    // Fremdposition: eigener Cache je Position, sonst würde ein Spieler, der
    // einmal aushilft, den Wertesatz für seine Stammposition überschreiben.
    const alt = p._werteAlt || versteckt(p, '_werteAlt', {});
    return alt[pos] || (alt[pos] = berechne(p, pos));
  };
  // Nach einer Werteänderung (Training, Entwicklung) neu berechnen lassen
  window.spielerWerteFrisch = function (p, einsatzPos) {
    if (p) {
      try { delete p._werte; delete p._werteAlt; } catch (e) { p._werte = null; p._werteAlt = null; }
    }
    return window.spielerWerte(p, einsatzPos);
  };

  window.SpielerAttribute = {
    allgemein: ALLGEMEIN, torwart: TORWART, feld: FELD,
    profile: PROFIL, niveau: niveau, hauptPos: hauptPos,
    // Alle Schlüssel eines Spielertyps
    keys: function (istTw) { return ALLGEMEIN.concat(istTw ? TORWART : FELD).map(e => e.k); },
    name: function (k) {
      const alle = ALLGEMEIN.concat(TORWART, FELD).find(e => e.k === k);
      return alle ? alle.n : k;
    }
  };

  console.log('[SpielerAttribute v1] aktiv — feine Werte für alle Spieler, abgeleitet und deterministisch');
})();
