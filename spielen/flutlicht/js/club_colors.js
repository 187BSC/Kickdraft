/* ===== club_colors.js =====
   Vereinsfarben für die Crests (Broadcast-Look). Bekannte Klubs bekommen ihre
   echten Hauptfarben (Bayern rot, BVB gelb, Bremen grün …); unbekannte Klubs eine
   stabile, aus der ID abgeleitete Farbe. Lädt VOR app_main.js, damit alle Render-
   Funktionen die Helfer kennen.
   Helfer (global): clubColors(id) → [bg, textColor], crestStyle(id) → CSS-String,
   crestInitials(name) → 2–3-Buchstaben-Kürzel.
   ============================================================================= */
(function () {
  'use strict';

  // clubId → [Primärfarbe, Textfarbe für Kontrast]
  const COLORS = {
    // Bundesliga
    bayern: ['#dc052d', '#fff'], dortmund: ['#fde100', '#151515'], leipzig: ['#dd0741', '#fff'],
    leverkusen: ['#e32219', '#fff'], stuttgart: ['#e30613', '#fff'], frankfurt: ['#e1000f', '#fff'],
    bremen: ['#1d9053', '#fff'], gladbach: ['#00a94d', '#fff'], wolfsburg: ['#65b32e', '#fff'],
    freiburg: ['#e2001a', '#fff'], mainz: ['#c3141e', '#fff'], hoffenheim: ['#1961b5', '#fff'],
    augsburg: ['#ba3733', '#fff'], union: ['#eb1923', '#fff'], koeln: ['#ed1c24', '#fff'],
    hamburg: ['#0a3e88', '#fff'], schalke: ['#004d9d', '#fff'], stpauli: ['#61443b', '#fff'],
    elversberg: ['#e2001a', '#fff'], paderborn: ['#004a99', '#fff'], heidenheim: ['#e2001a', '#fff'],
    // 2. Bundesliga / 3. Liga (bekannte)
    bochum: ['#005ca9', '#fff'], darmstadt: ['#004b9b', '#fff'], kaiserslautern: ['#e30613', '#fff'],
    nuernberg: ['#ad1732', '#fff'], karlsruhe: ['#0a4ea2', '#fff'], hertha: ['#005ca9', '#fff'],
    dresden: ['#ffe600', '#151515'], kiel: ['#003f7d', '#fff'], magdeburg: ['#0a3b7c', '#fff'],
    braunschweig: ['#f2c500', '#151515'], hannover: ['#0a7d3b', '#fff'], fuerth: ['#009a3d', '#fff'],
    duesseldorf: ['#e2001a', '#fff'], bielefeld: ['#0a3b7c', '#fff'],
    rostock: ['#0a3b7c', '#fff'], saarbruecken: ['#0a3b7c', '#fff'], aue: ['#5a2d82', '#fff'],
    ingolstadt: ['#e2001a', '#fff'], osnabrueck: ['#5a2d82', '#fff'], verl: ['#0a3b7c', '#fff'],
    cottbus: ['#e2001a', '#fff'], viktoria_koeln: ['#e2001a', '#fff'], mannheim: ['#0a3b7c', '#fff'],
    rot_weiss_essen: ['#e2001a', '#fff'], sv_meppen: ['#0a3b7c', '#fff'], tsv_havelse: ['#0a5a2d', '#fff']
  };

  function hashHue(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 360; }

  // IDs kommen mal als 'bayern', mal als 'club_bayern' (LEAGUE-Teams) — Präfix weg.
  function normId(id) { id = String(id || ''); return id.indexOf('club_') === 0 ? id.slice(5) : id; }

  function clubColors(id) {
    const key = normId(id);
    if (key && COLORS[key]) return COLORS[key];
    return ['hsl(' + hashHue(key || 'x') + ',52%,42%)', '#fff'];
  }
  window.clubColors = clubColors;

  // Inline-Style für einen Crest: Hintergrund mit etwas Tiefe + Kontrast-Text.
  window.crestStyle = function (id) {
    const c = clubColors(id);
    return 'background:linear-gradient(150deg,rgba(255,255,255,.17),rgba(0,0,0,.30)),' + c[0] + ';color:' + c[1] + ';';
  };

  // 2–3-Buchstaben-Kürzel aus dem Vereinsnamen (ohne Zahlen/Punkte).
  window.crestInitials = function (name) {
    return String(name || '?').replace(/[0-9.]/g, ' ').split(/[\s\-]+/).filter(Boolean)
      .slice(0, 3).map(w => w[0]).join('').toUpperCase() || '?';
  };

  console.log('[ClubColors] aktiv — Vereinsfarben für Crests');
})();
