/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · ANZEIGENAMEN  ·  v1   (Nutzer 2026-10-15: Release-Namen „Flutlicht Manager“)
   ─────────────────────────────────────────────────────────────────────────
   Geschützte Namen erscheinen nirgends mehr auf dem Bildschirm:
     Bundesliga → Erste Liga · 2. Bundesliga → Zweite Liga · 3. Liga → Dritte Liga · Regionalliga bleibt
     DFB-Pokal → Flutlichtpokal · Champions League → Champions Cup · Europa League → Europacup ·
     Conference League → Kontinentalcup · „Fußball Manager“ → „Flutlicht Manager“
   Warum eine Anzeige-Schicht statt Umschreiben im Code: Die alten Namen sind an rund einem Dutzend Stellen INTERNE
   SCHLÜSSEL (Tabellen je Liga, Vereinsdaten league:"Bundesliga", Spielstände mit Gruppennamen). Die bleiben unverändert,
   umbenannt wird jeder sichtbare Text, wenn er ins Dokument kommt – auch alte Meldungen aus Spielständen.
   Grammatik: Fügungen mit Artikel werden gebeugt („der Bundesliga“ → „der Ersten Liga“), Zusammensetzungen gekürzt
   („Bundesliga-Platzierung“ → „Erstliga-Platzierung“, „Bundesligist“ → „Erstligist“).
   Nicht erfasst: Text, der direkt auf eine Zeichenfläche (canvas) gemalt wird – dort stehen nur Vereinsnamen.
   API: KSAnzeige.text(s) – für eigenen Code, der Texte außerhalb des Dokuments braucht (z. B. Teilen, Export)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const REGELN = [
    [/DFB-POKALSIEGER/g, 'FLUTLICHTPOKALSIEGER'], [/DFB-POKAL/g, 'FLUTLICHTPOKAL'], [/DFB-Pokal/g, 'Flutlichtpokal'],
    [/Champions[- ]League/g, 'Champions Cup'], [/CHAMPIONS[- ]LEAGUE/g, 'CHAMPIONS CUP'],
    [/Europa[- ]League/g, 'Europacup'], [/EUROPA[- ]LEAGUE/g, 'EUROPACUP'],
    [/(?:Europa[- ])?Conference[- ]League/g, 'Kontinentalcup'], [/(?:EUROPA[- ])?CONFERENCE[- ]LEAGUE/g, 'KONTINENTALCUP'],
    // Artikel mit Beugung (der/zur + Liga → „-en“)
    [/\b(der|Der|zur|Zur)\s+2\.\s?Bundesliga(?![-\wäöü])/g, '$1 Zweiten Liga'],
    [/\b(der|Der|zur|Zur)\s+Bundesliga(?![-\wäöü])/g, '$1 Ersten Liga'],
    [/\b(der|Der|zur|Zur)\s+3\.\s?Liga(?![-\wäöü])/g, '$1 Dritten Liga'],
    // Zusammensetzungen
    [/2\.\s?Bundesliga-/g, 'Zweitliga-'], [/Bundesliga-/g, 'Erstliga-'], [/3\.\s?Liga-/g, 'Drittliga-'],
    [/2\.\s?Bundesligist/g, 'Zweitligist'], [/Bundesligist/g, 'Erstligist'], [/Bundesligaspieler/g, 'Erstligaspieler'],
    // einfache Namen
    [/2\.\s?Bundesliga/g, 'Zweite Liga'], [/Bundesliga/g, 'Erste Liga'], [/(^|[^\d])3\.\s?Liga/g, '$1Dritte Liga'],
    [/2\.\s?BUNDESLIGA/g, 'ZWEITE LIGA'], [/BUNDESLIGA/g, 'ERSTE LIGA'], [/(^|[^\d])3\.\s?LIGA/g, '$1DRITTE LIGA'],
    [/Fußball[- ]Manager/g, 'Unter Flutlicht']
  ];
  const TEST = /Bundesliga|BUNDESLIGA|3\.\s?L(?:iga|IGA)|DFB-P|League|LEAGUE|Fußball[- ]Manager/;
  function text(s) {
    if (typeof s !== 'string' || !TEST.test(s)) return s;
    let r = s;
    for (const [re, neu] of REGELN) r = r.replace(re, neu);
    return r;
  }
  const ATTR = ['title', 'aria-label', 'placeholder', 'alt', 'data-tip'];
  function knoten(n) {
    if (n.nodeType === 3) { const v = n.nodeValue; if (TEST.test(v)) { const w = text(v); if (w !== v) n.nodeValue = w; } return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    for (const a of ATTR) { const v = n.getAttribute && n.getAttribute(a); if (v && TEST.test(v)) { const w = text(v); if (w !== v) n.setAttribute(a, w); } }
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') return;
    const walk = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let x;
    while ((x = walk.nextNode())) {
      if (x.nodeType === 3) { const v = x.nodeValue; if (TEST.test(v)) { const w = text(v); if (w !== v) x.nodeValue = w; } }
      else if (x.tagName !== 'SCRIPT' && x.tagName !== 'STYLE') for (const a of ATTR) { const v = x.getAttribute(a); if (v && TEST.test(v)) { const w = text(v); if (w !== v) x.setAttribute(a, w); } }
    }
  }
  function start() {
    if (document.title) document.title = text(document.title);
    knoten(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') knoten(m.target);
        else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v && TEST.test(v)) { const w = text(v); if (w !== v) m.target.setAttribute(m.attributeName, w); } }   // nur bei Änderung – sonst weckt das eigene Setzen den Observer endlos
        else m.addedNodes.forEach(knoten);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    // Titel der Seite (wird teils per Skript gesetzt)
    const t = document.querySelector('title');
    if (t) new MutationObserver(() => { const w = text(document.title); if (w !== document.title) document.title = w; }).observe(t, { childList: true, characterData: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.KSAnzeige = { text };
  console.log('[Kickstil-Anzeige v1] aktiv — Erste/Zweite/Dritte Liga, Flutlichtpokal, Champions Cup, Europacup, Kontinentalcup');
})();
