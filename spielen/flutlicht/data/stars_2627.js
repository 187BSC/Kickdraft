/* Stars der Spitzenvereine, Saison 2026/27 (Stand: Oktober 2026)
   ─────────────────────────────────────────────────────────────────
   Je Topverein die zehn besten Spieler des echten Kaders 2026/27 – nur als WERTE: Position, Alter,
   Nationalität, Stärke, Potenzial. KEINE ECHTEN NAMEN (rechtlich, siehe CLAUDE.md) – im Spiel
   bekommt jeder Star einen erfundenen Namen aus seinem Land (KSNationen).
   Eingesetzt beim Anlegen der Auslandskader (js/euro_kader.js → sterneEinsetzen), in Saison 1
   für ein Jahr vom KI-Markt gesperrt (der Kader steht ja schon).
   Format: vereinsId: [[Position, Alter, Land, Stärke, Potenzial], …] – Positionen mit Seite (LV/RV, LF/RF, ZOM; 2026-10-18)
   Recherche 2026-10-16 (offizielle Aufstellungen, CL-Kaderlisten, Transferberichte). */
(function () {
  'use strict';
  window.KS_STARS_2627 = {
  realmadrid: [['ST',27,'Frankreich',93,93],['RF',26,'Brasilien',89,90],['ZOM',23,'England',89,91],['ZM',28,'Uruguay',88,88],['TW',34,'Belgien',89,89],['ZDM',26,'Frankreich',86,87],['ZOM',21,'Türkei',85,89],['LF',19,'Elfenbeinküste',83,90],['IV',21,'Spanien',84,89],['LV',28,'England',86,86]],
  barcelona: [['LF',19,'Spanien',92,95],['ZM',23,'Spanien',90,91],['RF',29,'Brasilien',89,89],['ZDM',30,'Spanien',88,88],['TW',25,'Spanien',86,88],['RV',27,'Frankreich',86,86],['IV',19,'Spanien',85,90],['LF',25,'England',85,86],['ZM',29,'Niederlande',85,85],['ZOM',28,'Spanien',84,84]],
  atletico: [['ST',26,'Argentinien',89,90],['TW',33,'Slowenien',86,86],['IV',28,'Argentinien',86,86],['ZDM',27,'Dänemark',84,85],['ZOM',25,'Spanien',84,85],['ZOM',25,'Südkorea',83,84],['LF',23,'Argentinien',83,85],['RV',31,'Spanien',84,84],['IV',28,'Slowakei',83,83],['ZM',23,'Spanien',82,85]],
  psg: [['RF',29,'Frankreich',90,90],['ZM',26,'Portugal',89,90],['LV',27,'Marokko',88,88],['LF',25,'Georgien',88,89],['RV',24,'Portugal',88,89],['RF',21,'Frankreich',87,91],['ZM',22,'Portugal',87,90],['IV',25,'Ecuador',86,87],['IV',32,'Brasilien',85,85],['TW',27,'Russland',83,84]],
  inter: [['ST',29,'Argentinien',88,88],['ZM',29,'Italien',87,87],['IV',27,'Italien',87,87],['ST',29,'Frankreich',86,86],['ZDM',32,'Türkei',85,85],['RV',28,'Italien',85,85],['IV',31,'Schweiz',84,84],['IV',32,'England',83,83],['ZM',22,'Kroatien',81,86],['TW',28,'Spanien',81,82]],
  milan: [['TW',31,'Frankreich',87,87],['LF',28,'USA',85,85],['ZM',31,'Frankreich',84,84],['ST',25,'Portugal',83,85],['IV',25,'Serbien',83,85],['ZM',41,'Kroatien',82,82],['IV',26,'Spanien',82,84],['RF',27,'Belgien',81,82],['IV',26,'Italien',80,81],['RV',28,'Ecuador',80,80]],
  juventus: [['RF',21,'Türkei',86,91],['IV',29,'Brasilien',85,85],['TW',30,'Italien',84,84],['ZM',25,'Frankreich',83,86],['LV',26,'Italien',83,85],['ZDM',28,'Italien',82,82],['LF',23,'Portugal',82,85],['ST',24,'Deutschland',82,85],['ST',27,'Frankreich',82,83],['IV',26,'Frankreich',82,83]],
  napoli: [['ZM',29,'Schottland',87,87],['ZOM',35,'Belgien',85,85],['ST',23,'Dänemark',84,87],['ZDM',31,'Slowakei',84,84],['LV',33,'Italien',83,83],['IV',32,'Kosovo',83,83],['ZM',30,'Kamerun',83,83],['RF',29,'Brasilien',82,82],['TW',29,'Italien',82,82],['IV',27,'Niederlande',82,82]],
  mancity: [['ST',26,'Norwegen',92,93],['TW',27,'Italien',89,89],['IV',29,'Portugal',86,86],['IV',26,'England',86,87],['ZM',25,'Argentinien',87,88],['ZDM',23,'England',86,89],['ZOM',23,'Frankreich',86,89],['ZOM',26,'England',86,87],['RF',24,'Belgien',85,87],['LF',26,'Ghana',85,86]],
  arsenal: [['TW',31,'Spanien',87,87],['IV',25,'Frankreich',89,90],['IV',28,'Brasilien',88,88],['LV',25,'Niederlande',85,86],['ZM',27,'England',89,89],['ZDM',28,'Brasilien',86,86],['ZOM',27,'Norwegen',86,86],['RF',25,'England',89,90],['ZOM',28,'England',85,85],['ST',28,'Schweden',86,86]],
  liverpool: [['TW',34,'Brasilien',86,86],['IV',35,'Niederlande',86,86],['IV',21,'Frankreich',80,87],['RV',22,'Ungarn',82,85],['ZDM',24,'Niederlande',87,89],['ZM',27,'Argentinien',86,86],['ZM',25,'Ungarn',86,87],['ZOM',23,'Deutschland',88,91],['LF',24,'Frankreich',85,87],['ST',27,'Schweden',88,88]],
  chelsea: [['TW',34,'Argentinien',85,85],['IV',23,'England',83,86],['IV',26,'Frankreich',83,84],['LV',26,'England',85,85],['ZDM',24,'Ecuador',89,90],['ZOM',24,'England',88,90],['ZOM',24,'England',86,88],['RF',26,'Portugal',84,85],['LF',19,'Brasilien',83,90],['ST',25,'Brasilien',85,86]],
  mancutd: [['TW',24,'Belgien',81,85],['IV',20,'Frankreich',81,87],['IV',28,'Argentinien',84,84],['ZDM',22,'Kamerun',84,87],['ZM',21,'England',82,87],['ZOM',32,'Portugal',87,87],['LF',27,'Kamerun',86,86],['RF',27,'Brasilien',85,85],['LF',24,'Elfenbeinküste',83,85],['ST',23,'Slowenien',83,87]],
  tottenham: [['TW',22,'Tschechien',78,83],['IV',25,'Niederlande',85,86],['IV',26,'Niederlande',83,84],['RV',27,'Spanien',83,83],['ZM',26,'Italien',86,86],['ZM',22,'Portugal',82,86],['LF',22,'Brasilien',84,87],['RF',26,'Ghana',84,84],['ST',27,'Ägypten',83,83],['ST',29,'England',82,82]],
  newcastle: [['TW',24,'Tschechien',79,83],['IV',25,'Deutschland',82,84],['IV',26,'Niederlande',82,83],['RV',22,'England',82,86],['ZDM',24,'Spanien',82,84],['ZM',20,'England',79,86],['LF',28,'England',82,82],['RF',31,'England',80,80],['LF',21,'Belgien',80,86],['ST',30,'DR Kongo',82,82]],
  benfica: [['TW',25,'Ukraine',82,84],['RV',28,'Dänemark',79,79],['LV',23,'Schweden',79,82],['IV',24,'Portugal',81,85],['IV',23,'Australien',79,83],['ZDM',31,'Portugal',83,83],['ZOM',24,'Ukraine',82,85],['RF',20,'Argentinien',78,86],['LF',29,'Belgien',82,82],['ST',27,'Griechenland',83,84]],
  porto: [['TW',27,'Portugal',84,85],['LV',22,'Portugal',80,84],['IV',30,'Polen',80,80],['IV',26,'Polen',81,82],['RV',27,'Portugal',79,80],['ZDM',25,'Argentinien',81,83],['ZM',20,'Dänemark',80,87],['ZOM',24,'Spanien',82,85],['RF',25,'Spanien',80,82],['ST',22,'Spanien',82,87]],
  sporting: [['TW',32,'Spanien',81,81],['IV',25,'Portugal',83,85],['IV',24,'Portugal',79,82],['RV',26,'Uruguay',81,82],['LV',22,'Spanien',76,81],['ZM',23,'Italien',79,83],['ZOM',27,'Uruguay',82,83],['ZOM',28,'Portugal',83,83],['LF',25,'Mosambik',80,81],['ST',28,'Kolumbien',83,83]],
  psv: [['TW',26,'Tschechien',79,81],['LV',25,'USA',81,82],['RV',27,'Brasilien',79,79],['IV',26,'Niederlande',79,80],['IV',27,'Curaçao',78,78],['ZDM',23,'Japan',78,82],['ZM',28,'Niederlande',78,78],['ZOM',26,'Niederlande',78,79],['RF',37,'Kroatien',79,79],['ST',23,'USA',80,82]],
  ajax: [['TW',34,'Deutschland',83,83],['LV',26,'Brasilien',76,78],['IV',30,'Deutschland',78,78],['IV',23,'Niederlande',78,81],['ZDM',30,'Marokko',80,80],['ZM',18,'Belgien',75,86],['ZOM',30,'Deutschland',81,81],['ZOM',22,'Israel',78,82],['RF',28,'Ukraine',79,79],['ST',25,'Nigeria',78,80]],
  feyenoord: [['TW',23,'Deutschland',76,80],['RV',20,'Niederlande',77,84],['IV',29,'Niederlande',78,78],['IV',25,'Spanien',77,79],['LV',24,'Spanien',76,79],['ZDM',28,'Belgien',78,78],['ZM',24,'Marokko',77,79],['ZOM',23,'Niederlande',79,82],['LF',24,'Algerien',80,82],['ST',22,'Spanien',76,80]],
  };
  console.log('[Stars 26/27] geladen: ' + Object.keys(window.KS_STARS_2627).length + ' Vereine');
})();
