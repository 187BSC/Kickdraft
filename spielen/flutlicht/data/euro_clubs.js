/* ===== euro_clubs.js =====
   Europäische Vereinsdatenbank für die internationalen Wettbewerbe
   (Champions League / Europa League / Conference League).

   Jeder Verein:
     id, name, country, flag, def/mid/att (→ ovr abgeleitet),
     coeff  = Länder-Koeffizient-Stufe (1 = stärkste Liga … 6 = kleinste)
     tier   = übliche Start-Wettbewerbsebene ('cl' | 'el' | 'co')

   Die Werte sind an der bestehenden Skala kalibriert
   (Top 86-91, stark 80-85, mittel 70-79, klein 55-69).
   Die *aktuelle* Stärke entwickelt sich später über das NPC-Entwicklungssystem.
   ============================================================================= */
(function () {
  'use strict';

  // Kompakte Notation: [id, name, def, mid, att, tier]
  // gruppiert pro Land (country/flag/coeff werden unten ergänzt).
  const C = {
    // ───────── Stufe 1 (4 CL / 2 EL / 1 CO) ─────────
    England: { flag: '🏴', coeff: 1, clubs: [
      ['mancity','Manchester City',89,90,90,'cl'],
      ['arsenal','Arsenal FC',85,86,85,'cl'],
      ['liverpool','FC Liverpool',85,86,87,'cl'],
      ['chelsea','FC Chelsea',82,83,83,'cl'],
      ['newcastle','Newcastle United',80,80,80,'cl'],          // +1 optional
      ['tottenham','Tottenham Hotspur',79,81,83,'cl'],
      ['astonvilla','Aston Villa',78,79,79,'el'],
      ['nottingham','Nottingham Forest',75,75,76,'el'],
      ['crystalp','Crystal Palace',73,73,74,'co'],
      ['brighton','Brighton & Hove Albion',76,78,77,'el'],
      ['mancutd','Manchester United',79,80,81,'cl'],
      ['brentford','Brentford FC',73,74,75,'co'],
      // ERGÄNZT: Premier-League-Vereine ohne Europapokal. Sie fehlten komplett,
      // obwohl sie auf dem Transfermarkt eine große Rolle spielen — ein
      // englischer Tabellenzwölfter zahlt mehr als mancher CL-Teilnehmer.
      ['westham','West Ham United',73,74,74,null],
      ['fulham','FC Fulham',72,73,73,null],
      ['bournemouth','AFC Bournemouth',72,73,73,null],
      ['wolves','Wolverhampton Wanderers',71,72,72,null],
      ['everton','FC Everton',71,71,70,null],
      ['leeds','Leeds United',70,71,71,null],
      ['burnley','FC Burnley',69,69,69,null],
      ['sunderland','AFC Sunderland',69,70,70,null],
      ['leicester','Leicester City',70,71,71,null],
      ['southampton','FC Southampton',69,70,70,null],
    ]},
    Deutschland: { flag: '🇩🇪', coeff: 1, clubs: [
      // (echte Bundesliga liegt in game_data; hier nur als Euro-Referenz, falls FCM ausländisch denkt)
    ]},
    Spanien: { flag: '🇪🇸', coeff: 1, clubs: [
      ['realmadrid','Real Madrid',88,90,91,'cl'],
      ['barcelona','FC Barcelona',85,88,88,'cl'],
      ['atletico','Atlético Madrid',87,84,83,'cl'],
      ['athletic','Athletic Bilbao',79,79,78,'cl'],
      ['villarreal','Villarreal CF',77,78,78,'cl'],
      ['betis','Betis Sevilla',76,77,77,'el'],
      ['celta','Celta Vigo',73,74,74,'el'],
      ['rayo','Rayo Vallecano',71,71,71,'co'],
      ['sevilla','FC Sevilla',77,78,77,'el'],
      ['realsociedad','Real Sociedad',78,79,78,'el'],
      ['valencia','Valencia CF',74,75,75,'co'],
    ]},
    Italien: { flag: '🇮🇹', coeff: 1, clubs: [
      ['inter','Inter Mailand',87,86,86,'cl'],
      ['juventus','Juventus Turin',85,84,83,'cl'],
      ['napoli','SSC Neapel',83,84,85,'cl'],
      ['atalanta','Atalanta BC',81,82,83,'cl'],
      ['roma','AS Rom',79,80,79,'el'],
      ['bologna','FC Bologna',77,77,77,'el'],
      ['fiorentina','AC Florenz',76,77,77,'co'],
      ['milan','AC Mailand',84,84,84,'cl'],
      ['lazio','Lazio Rom',78,79,79,'el'],
    ]},
    // ───────── Stufe 2 (3/1/1) ─────────
    Frankreich: { flag: '🇫🇷', coeff: 2, clubs: [
      ['psg','Paris Saint-Germain',86,88,90,'cl'],
      ['monaco','AS Monaco',78,79,80,'cl'],
      ['marseille','Olympique Marseille',78,78,79,'cl'],
      ['lille','OSC Lille',76,77,77,'el'],
      ['nice','OGC Nizza',75,75,75,'el'],
      ['lyon','Olympique Lyon',76,77,78,'el'],
      ['strasbourg','Racing Straßburg',72,72,72,'co'],
      ['lens','RC Lens',75,75,75,'el'],
      ['rennes','Stade Rennes',75,76,76,'el'],
    ]},
    // ───────── Stufe 3 (2/2/1) ─────────
    Portugal: { flag: '🇵🇹', coeff: 3, clubs: [
      ['benfica','SL Benfica',80,81,82,'cl'],
      ['sporting','Sporting CP',80,80,81,'cl'],
      ['braga','Sporting Braga',75,76,76,'el'],
      ['porto','FC Porto',79,79,79,'el'],
    ]},
    Niederlande: { flag: '🇳🇱', coeff: 3, clubs: [
      ['ajax','Ajax Amsterdam',77,79,80,'cl'],
      ['psv','PSV Eindhoven',78,79,81,'cl'],
      ['feyenoord','Feyenoord Rotterdam',77,77,78,'el'],
      ['utrecht','FC Utrecht',72,72,72,'el'],
      ['goahead','Go Ahead Eagles',69,69,69,'el'],
      ['az','AZ Alkmaar',74,75,75,'co'],
    ]},
    // ───────── Stufe 4 (1/1/1) ─────────
    Belgien: { flag: '🇧🇪', coeff: 4, clubs: [
      ['brugge','Club Brügge',76,76,76,'cl'],
      ['union_sg','Union Saint-Gilloise',74,75,75,'cl'],
      ['genk','KRC Genk',73,73,74,'el'],
    ]},
    Türkei: { flag: '🇹🇷', coeff: 4, clubs: [
      ['galatasaray','Galatasaray',79,79,80,'cl'],
      ['fenerbahce','Fenerbahçe',78,78,79,'el'],
      ['besiktas','Beşiktaş',75,75,75,'co'],
      ['trabzonspor','Trabzonspor',73,73,74,'co'],
      ['samsunspor','Samsunspor',69,69,69,'co'],
    ]},
    Österreich: { flag: '🇦🇹', coeff: 4, clubs: [
      ['salzburg','RB Salzburg',77,78,78,'cl'],
      ['sturm','SK Sturm Graz',73,73,73,'el'],
      ['rapid','Rapid Wien',71,71,71,'co'],
      ['lask','LASK Linz',70,70,70,'co'],
    ]},
    Schottland: { flag: '🏴', coeff: 4, clubs: [
      ['celtic','Celtic Glasgow',76,76,77,'cl'],
      ['rangers','Glasgow Rangers',74,75,75,'el'],
      ['hearts','Heart of Midlothian',68,68,68,'co'],
      ['aberdeen','FC Aberdeen',67,67,67,'co'],
    ]},
    Griechenland: { flag: '🇬🇷', coeff: 4, clubs: [
      ['olympiacos','Olympiacos',76,76,76,'cl'],
      ['paok','PAOK Thessaloniki',73,73,73,'el'],
      ['panathinaikos','Panathinaikos',72,72,73,'el'],
      ['aek','AEK Athen',71,71,71,'co'],
      ['aris','Aris Thessaloniki',69,69,70,'co'],
    ]},
    Tschechien: { flag: '🇨🇿', coeff: 4, clubs: [
      ['slavia','Slavia Prag',75,75,75,'cl'],
      ['sparta','Sparta Prag',74,74,74,'el'],
      ['plzen','Viktoria Pilsen',71,71,71,'el'],
      ['olomouc','Sigma Olmütz',67,67,67,'co'],
      ['ostrava','Baník Ostrava',68,68,68,'co'],
    ]},
    Schweiz: { flag: '🇨🇭', coeff: 4, clubs: [
      ['youngboys','BSC Young Boys',73,73,73,'cl'],
      ['basel','FC Basel',72,72,72,'el'],
      ['lausanne','FC Lausanne-Sport',67,67,67,'co'],
      ['servette','Servette Genf',68,68,68,'co'],
    ]},
    Dänemark: { flag: '🇩🇰', coeff: 4, clubs: [
      ['copenhagen','FC Kopenhagen',74,74,74,'cl'],
      ['midtjylland','FC Midtjylland',73,73,73,'el'],
      ['brondby','Brøndby IF',69,69,70,'co'],
    ]},
    Norwegen: { flag: '🇳🇴', coeff: 4, clubs: [
      ['bodo','FK Bodø/Glimt',74,74,75,'cl'],
      ['brann','SK Brann',69,69,69,'el'],
      ['molde','Molde FK',70,70,70,'co'],
    ]},
    Kroatien: { flag: '🇭🇷', coeff: 4, clubs: [
      ['dinamozagreb','Dinamo Zagreb',74,74,74,'cl'],
      ['rijeka','HNK Rijeka',69,69,69,'el'],
      ['hajduk','Hajduk Split',71,71,71,'co'],
      ['osijek','NK Osijek',67,67,67,'co'],
    ]},
    Serbien: { flag: '🇷🇸', coeff: 4, clubs: [
      ['crvenazvezda','Roter Stern Belgrad',74,74,75,'cl'],
      ['partizan','Partizan Belgrad',71,71,72,'el'],
      ['vojvodina','Vojvodina Novi Sad',66,66,66,'co'],
    ]},
    Polen: { flag: '🇵🇱', coeff: 4, clubs: [
      ['jagiellonia','Jagiellonia Białystok',70,70,70,'cl'],
      ['legia','Legia Warschau',72,72,72,'el'],
      ['lech','Lech Posen',71,71,71,'co'],
      ['rakow','Raków Częstochowa',71,71,71,'co'],
      ['pogon','Pogoń Stettin',69,69,69,'co'],
    ]},
    // ───────── Stufe 5 (0/1/1) ─────────
    Ukraine: { flag: '🇺🇦', coeff: 5, clubs: [
      ['shakhtar','Schachtar Donezk',75,75,75,'el'],
      ['dynamokiew','Dynamo Kiew',73,73,73,'co'],
    ]},
    Rumänien: { flag: '🇷🇴', coeff: 5, clubs: [
      ['fcsb','FCSB Bukarest',71,71,71,'el'],
      ['craiova','Universitatea Craiova',67,67,67,'co'],
      ['cfrcluj','CFR Cluj',69,69,69,'co'],
    ]},
    Israel: { flag: '🇮🇱', coeff: 5, clubs: [
      ['maccabitelaviv','Maccabi Tel Aviv',71,71,71,'el'],
      ['beersheva','Hapoel Be\u2019er Sheva',68,68,68,'co'],
    ]},
    Ungarn: { flag: '🇭🇺', coeff: 5, clubs: [
      ['ferencvaros','Ferencváros Budapest',71,71,71,'el'],
      ['fehervar','Fehérvár FC',65,65,65,'co'],
      ['debrecen','Debreceni VSC',64,64,64,'co'],
    ]},
    Schweden: { flag: '🇸🇪', coeff: 5, clubs: [
      ['djurgarden','Djurgårdens IF',70,70,70,'el'],
      ['malmo','Malmö FF',71,71,71,'co'],
    ]},
    Zypern: { flag: '🇨🇾', coeff: 5, clubs: [
      ['apoel','APOEL Nikosia',69,69,69,'el'],
      ['aeklarnaka','AEK Larnaka',67,67,67,'co'],
      ['omonia','Omonia Nikosia',67,67,67,'co'],
    ]},
    Bulgarien: { flag: '🇧🇬', coeff: 5, clubs: [
      ['ludogorets','Ludogorets Rasgrad',71,71,71,'el'],
      ['cska_sofia','ZSKA Sofia',66,66,66,'co'],
      ['levski','Lewski Sofia',65,65,65,'co'],
    ]},
    // ───────── Stufe 6 (0/0/1) ─────────
    Aserbaidschan: { flag: '🇦🇿', coeff: 6, clubs: [
      ['qarabag','Qarabağ FK',71,71,71,'co'],
      ['neftci','Neftçi Baku',64,64,64,'co'],
    ]},
    Kasachstan: { flag: '🇰🇿', coeff: 6, clubs: [
      ['kairat','FC Kairat',66,66,66,'co'],
      ['astana','FK Astana',67,67,67,'co'],
    ]},
    Slowakei: { flag: '🇸🇰', coeff: 6, clubs: [
      ['slovan','Slovan Bratislava',69,69,69,'co'],
      ['trnava','Spartak Trnava',64,64,64,'co'],
    ]},
    Slowenien: { flag: '🇸🇮', coeff: 6, clubs: [
      ['celje','NK Celje',66,66,66,'co'],
      ['maribor','NK Maribor',65,65,65,'co'],
    ]},
    Armenien: { flag: '🇦🇲', coeff: 6, clubs: [
      ['noah','FC Noah',64,64,64,'co'],
      ['alashkert','FC Alashkert',62,62,62,'co'],
    ]},
    Kosovo: { flag: '🇽🇰', coeff: 6, clubs: [
      ['drita','KF Drita',61,61,61,'co'],
    ]},
    Finnland: { flag: '🇫🇮', coeff: 6, clubs: [
      ['kuops','Kuopion PS',62,62,62,'co'],
      ['hjk','HJK Helsinki',65,65,65,'co'],
    ]},
    Mazedonien: { flag: '🇲🇰', coeff: 6, clubs: [
      ['shkendija','Shkendija Tetovo',61,61,61,'co'],
    ]},
    Island: { flag: '🇮🇸', coeff: 6, clubs: [
      ['vikingur','Vikingur Reykjavik',60,60,60,'co'],
      ['breidablik','UMF Breidablik',61,61,61,'co'],
    ]},
    Irland: { flag: '🇮🇪', coeff: 6, clubs: [
      ['shelbourne','FC Shelbourne',60,60,60,'co'],
      ['shamrock','Shamrock Rovers',63,63,63,'co'],
    ]},
    Malta: { flag: '🇲🇹', coeff: 6, clubs: [
      ['hamrun','Ħamrun Spartans',58,58,58,'co'],
    ]},
    Gibraltar: { flag: '🇬🇮', coeff: 6, clubs: [
      ['lincoln','Lincoln Red Imps',57,57,57,'co'],
    ]},
    Luxemburg: { flag: '🇱🇺', coeff: 6, clubs: [
      ['dudelange','F91 Düdelingen',59,59,59,'co'],
    ]},
    Litauen: { flag: '🇱🇹', coeff: 6, clubs: [
      ['zalgiris','Žalgiris Vilnius',62,62,62,'co'],
    ]},
    Lettland: { flag: '🇱🇻', coeff: 6, clubs: [
      ['rfs','RFS Riga',62,62,62,'co'],
    ]},
    Estland: { flag: '🇪🇪', coeff: 6, clubs: [
      ['flora','FC Flora Tallinn',60,60,60,'co'],
    ]},
    BosnienHerzegowina: { flag: '🇧🇦', coeff: 6, clubs: [
      ['zrinjski','Zrinjski Mostar',63,63,63,'co'],
      ['sarajevo','FK Sarajevo',61,61,61,'co'],
    ]},
    Albanien: { flag: '🇦🇱', coeff: 6, clubs: [
      ['tirana','KF Tirana',60,60,60,'co'],
      ['partizani','Partizani Tirana',59,59,59,'co'],
    ]},
  };

  const countryName = {
    England:'England', Deutschland:'Deutschland', Spanien:'Spanien', Italien:'Italien',
    Frankreich:'Frankreich', Portugal:'Portugal', Niederlande:'Niederlande',
    Belgien:'Belgien', Türkei:'Türkei', Österreich:'Österreich', Schottland:'Schottland',
    Griechenland:'Griechenland', Tschechien:'Tschechien', Schweiz:'Schweiz', Dänemark:'Dänemark',
    Norwegen:'Norwegen', Kroatien:'Kroatien', Serbien:'Serbien', Polen:'Polen',
    Ukraine:'Ukraine', Rumänien:'Rumänien', Israel:'Israel', Ungarn:'Ungarn',
    Schweden:'Schweden', Zypern:'Zypern', Bulgarien:'Bulgarien',
    Aserbaidschan:'Aserbaidschan', Kasachstan:'Kasachstan', Slowakei:'Slowakei',
    Slowenien:'Slowenien', Armenien:'Armenien', Kosovo:'Kosovo', Finnland:'Finnland',
    Mazedonien:'Mazedonien', Island:'Island', Irland:'Irland', Malta:'Malta',
    Gibraltar:'Gibraltar', Luxemburg:'Luxemburg', Litauen:'Litauen', Lettland:'Lettland',
    Estland:'Estland', BosnienHerzegowina:'Bosnien-Herzegowina', Albanien:'Albanien',
  };

  const out = [];
  Object.keys(C).forEach(key => {
    const grp = C[key];
    (grp.clubs || []).forEach(([id, name, def, mid, att, tier]) => {
      out.push({
        id, name, country: countryName[key] || key, flag: grp.flag,
        coeff: grp.coeff, tier,
        def, mid, att, ovr: Math.round((def + mid + att) / 3),
        foreign: true,
      });
    });
  });

  // Länder-Slot-Tabelle (für die Qualifikationslogik)
  const COUNTRY_SLOTS = {};
  Object.keys(C).forEach(key => {
    const cn = countryName[key] || key;
    const co = C[key].coeff;
    COUNTRY_SLOTS[cn] = (
      co === 1 ? { cl: 4, el: 2, co: 1 } :
      co === 2 ? { cl: 3, el: 1, co: 1 } :
      co === 3 ? { cl: 2, el: 2, co: 1 } :
      co === 4 ? { cl: 1, el: 1, co: 1 } :
      co === 5 ? { cl: 0, el: 1, co: 1 } :
                 { cl: 0, el: 0, co: 1 }
    );
  });
  // Deutschland: Slots gelten, aber die Teilnehmer kommen aus der echten Bundesliga
  COUNTRY_SLOTS['Deutschland'] = { cl: 4, el: 2, co: 1 };

  window.EURO_CLUBS = out;
  window.EURO_COUNTRY_SLOTS = COUNTRY_SLOTS;
  window.EURO_FIELD_SIZE = 36;

  console.log('[EuroClubs] geladen:', out.length, 'Vereine aus', Object.keys(COUNTRY_SLOTS).length, 'Ländern');
})();