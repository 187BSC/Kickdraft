/* ===== events_config_patch.js =====
   Reichhaltige Vereinsleben-Events für das Random-Event-System (events_patch.js
   im bundle_economy). Füllt window.EVENTS_CONFIG mit vielen atmosphärischen
   Events rund um Kabine, Fans, Stadt, Presse, Jugend, Finanzen und kleine
   Alltagsprobleme — damit sich der Verein lebendig und real anfühlt.

   Event-Typen:
   - Flavor-Event:   { id, weight, trigger, title, flavor, flavorEffect:[eff...] }
                     → läuft direkt als News (optional mit kleinen Effekten)
   - Entscheidung:   { id, weight, trigger, title, flavor, options:[
                       { label, resultText, effects:[eff...], bet:{p,win,lose} } ] }
                     → zeigt Dialog, Spieler entscheidet

   Effekt-Typen (aus events_patch.js): moralePlayer/moraleTalent(s)/moraleStar/
   moraleVeteran/teamMorale (delta), money/moneyRange (tier e/ee/eee, sign),
   wage, rep (board/ultras/eventFans ±1..3), mentalRandom, boostWeakestAttr,
   injury (weeks,count,label), nextMatchModifier/nextMatchRandomSwing (pct,scope),
   streakMorale, injuryRiskMod, trainingPause.
   Trigger (aus events_patch.js): always, squadMin14, hasTalent, hasStar,
   teamMoraleBelow75, veteranAndTalent, budgetAtLeastEE, homeMatchWithin2,
   hasOvr74OrStar, homeMatchNextWeek, matchNextWeek, thinSquadOrCongestion,
   streak3, freeWeek.
   Lädt VOR bundle_economy (setzt window.EVENTS_CONFIG, das dort gelesen wird).
   ============================================================================= */
(function () {
  'use strict';

  const EVENTS = [

    // ═══════════════ KABINE & TEAM-DYNAMIK ═══════════════
    {
      id: 'kabine_grillfest', weight: 5, trigger: 'squadMin14',
      title: 'Grillfest in der Kabine',
      flavor: 'Nach der letzten Einheit wirft {veteran} kurzerhand den Grill an. Bald duftet es über den ganzen Trainingsplatz, {talent} legt die Musik auf, und Alt und Jung sitzen bis in den Abend zusammen. So eine gelöste Stimmung hat man lange nicht gesehen.',
      flavorEffect: [{ type: 'teamMorale', delta: 4 }]
    },
    {
      id: 'kabine_streit', weight: 4, trigger: 'squadMin14',
      title: 'Zoff in der Kabine',
      flavor: '{p1} und {p2} geraten im Abschlusstraining aneinander — ein Zweikampf, der eine Spur zu hart war, dann fliegen Worte. Der Co-Trainer muss die beiden trennen, in der Kabine ist die Luft zum Schneiden.',
      options: [
        { label: 'Aussprache moderieren — du redest mit beiden', resultText: 'Du setzt {p1} und {p2} an einen Tisch. Nach einer halben Stunde geben sie sich die Hand — die Sache ist geklärt, das Team atmet auf.',
          effects: [{ type: 'teamMorale', delta: 3 }] },
        { label: 'Beide zum Extratraining bitten', resultText: 'Eine Extraschicht Läufe für {p1} und {p2}. Zähneknirschend absolviert — aber am Ende schweißt der gemeinsame Frust sie zusammen.',
          effects: [{ type: 'moralePlayers', delta: -2, count: 2 }, { type: 'boostWeakestAttr', delta: 1, count: 2 }] },
        { label: 'Laufen lassen — das regeln Profis selbst', resultText: 'Du hältst dich raus. Mal geht das gut — diesmal schwelt es weiter.',
          bet: { p: 0.5, win: { text: '{p1} und {p2} klären es unter vier Augen, Thema erledigt.', effects: [{ type: 'teamMorale', delta: 1 }] },
                         lose: { text: 'Die Fronten verhärten sich, Lager bilden sich, die Stimmung kippt.', effects: [{ type: 'teamMorale', delta: -4 }] } } }
      ]
    },
    {
      id: 'kapitaen_ansprache', weight: 3, trigger: 'teamMoraleBelow75',
      title: 'Kapitäns-Ansprache',
      flavor: 'Kapitän {veteran} bittet um eine Mannschaftssitzung — ohne Trainerstab, nur die Spieler unter sich. Man spürt: Sie wollen die zuletzt gedrückte Stimmung selbst in den Griff bekommen.',
      flavorEffect: [{ type: 'teamMorale', delta: 5 }]
    },
    {
      id: 'veteran_mentor', weight: 3, trigger: 'veteranAndTalent',
      title: 'Routinier nimmt Talent unter die Fittiche',
      flavor: 'Routinier {veteran} kümmert sich abseits des Platzes intensiv um {talent} ({talentAge}) — Ernährung, Laufwege, Mentalität. Nach jedem Training bleiben die beiden noch eine Stunde länger. Der Junge saugt jeden Tipp auf.',
      flavorEffect: [{ type: 'moraleTalent', delta: 5 }, { type: 'boostWeakestAttr', delta: 1, count: 1 }]
    },
    {
      id: 'teambuilding_angebot', weight: 3, trigger: 'squadMin14',
      title: 'Teambuilding-Wochenende',
      flavor: 'Der Mannschaftsrat um {veteran} schlägt ein Teambuilding-Wochenende in den Bergen vor. Es würde ins Budget einschneiden — aber der Zusammenhalt könnte einen Schub gebrauchen.',
      options: [
        { label: 'Volles Programm buchen', resultText: 'Klettern, Kanu, Lagerfeuer bis tief in die Nacht — die Mannschaft kommt als verschworene Einheit zurück.',
          effects: [{ type: 'money', tier: 'ee', sign: -1 }, { type: 'teamMorale', delta: 7 }] },
        { label: 'Bescheidene Variante', resultText: 'Ein Tag Kart fahren und gemeinsames Essen — günstig, und trotzdem lachen am Ende alle zusammen.',
          effects: [{ type: 'money', tier: 'e', sign: -1 }, { type: 'teamMorale', delta: 3 }] },
        { label: 'Kein Budget dafür', resultText: 'Du winkst ab. Der Mannschaftsrat ist enttäuscht, nickt aber verständnisvoll.',
          effects: [{ type: 'teamMorale', delta: -1 }] }
      ]
    },

    // ═══════════════ FANS & ULTRAS ═══════════════
    {
      id: 'ultras_choreo', weight: 4, trigger: 'homeMatchNextWeek',
      title: 'Ultras planen große Choreo',
      flavor: 'Die aktive Fanszene tüftelt fürs nächste Heimspiel an einer aufwändigen Choreografie — Fahnen, Doppelhalter, eine riesige Blockfahne über die ganze Kurve. Für Stoff und Farbe fehlt aber Geld, also klopfen die Vorsänger bei dir an.',
      options: [
        { label: 'Materialkosten übernehmen', resultText: 'Beim Einlaufen empfängt die Mannschaft ein Meer aus Fahnen und Bannern. Die Kurve bebt, {star} bekommt Gänsehaut.',
          effects: [{ type: 'money', tier: 'e', sign: -1 }, { type: 'rep', ultras: 2 }, { type: 'teamMorale', delta: 2 }] },
        { label: 'Freundlich ablehnen', resultText: 'Die Ultras ziehen eine kleine Version durch. Sie verstehen die Absage — begeistert sind sie nicht.',
          effects: [{ type: 'rep', ultras: -1 }] }
      ]
    },
    {
      id: 'fanclub_jubilaeum', weight: 3, trigger: 'always',
      title: 'Fanclub feiert Jubiläum',
      flavor: 'Der älteste Fanclub des Vereins feiert 50-jähriges Bestehen. Bei Bier und alten Fotos schwelgen die Mitglieder in Erinnerungen — und laden die Vereinsführung als Ehrengäste ein.',
      flavorEffect: [{ type: 'rep', ultras: 1, eventFans: 1 }]
    },
    {
      id: 'fan_protest', weight: 3, trigger: 'always',
      title: 'Unmut auf den Rängen',
      flavor: 'In den Fanforen brodelt es — Ticketpreise, sportliche Ausrichtung, alles kommt auf den Tisch. Für das nächste Heimspiel wird ein Banner-Protest angedroht.',
      options: [
        { label: 'Dialog mit den Fanvertretern suchen', resultText: 'Du lädst die Fansprecher ein und hörst wirklich zu. Die Geste kommt an, die Wogen glätten sich spürbar.',
          effects: [{ type: 'rep', ultras: 1, eventFans: 1 }] },
        { label: 'Aussitzen', resultText: 'Du reagierst nicht. Der Protest findet statt — Banner hoch, ein Nadelstich, mehr aber auch nicht.',
          effects: [{ type: 'rep', ultras: -2 }] }
      ]
    },
    {
      id: 'auswaertsfahrt', weight: 3, trigger: 'matchNextWeek',
      title: 'Rekord-Auswärtsfahrt',
      flavor: 'Für das nächste Auswärtsspiel melden sich so viele Fans an wie nie. Die Anhänger organisieren einen Sonderzug, Fahnen und Verpflegung inklusive — die halbe Stadt scheint mitzufahren.',
      flavorEffect: [{ type: 'rep', ultras: 1 }, { type: 'teamMorale', delta: 2 }]
    },

    // ═══════════════ STADT & UMFELD ═══════════════
    {
      id: 'buergermeister_empfang', weight: 3, trigger: 'always',
      title: 'Empfang im Rathaus',
      flavor: 'Der Bürgermeister lädt die Vereinsführung zu einem Empfang mit Häppchen und Lokalpresse. Zwischen den Zeilen geht es um mehr: die Rolle des Vereins in der Stadt — und eine mögliche finanzielle Unterstützung.',
      options: [
        { label: 'Charmant auftreten und Nähe zeigen', resultText: 'Du hinterlässt einen glänzenden Eindruck, plauderst mit Stadträten und Sponsoren. Die Stadt signalisiert Wohlwollen — und schiebt eine Zuwendung rüber.',
          effects: [{ type: 'rep', board: 1 }, { type: 'moneyRange', min: 'e', max: 'ee', sign: 1 }] },
        { label: 'Termin absagen — Training geht vor', resultText: 'Du bleibst beim Team auf dem Platz. Sportlich verständlich, aber im Rathaus ist man leicht pikiert.',
          effects: [{ type: 'rep', board: -1 }] }
      ]
    },
    {
      id: 'schulprojekt', weight: 3, trigger: 'always',
      title: 'Schulprojekt angefragt',
      flavor: 'Eine örtliche Grundschule bittet um einen Aktionstag mit ein paar Profis — Autogramme, kleines Kicken, Fragerunde. Gut fürs Image, kostet aber wertvolle Trainingszeit.',
      options: [
        { label: '{star} und Kollegen hinschicken', resultText: 'Strahlende Kinderaugen, als {star} den Ball jongliert — und tolle Bilder in der Lokalpresse. Die Region liebt ihren Verein.',
          effects: [{ type: 'rep', eventFans: 2 }] },
        { label: 'Höflich absagen', resultText: 'Du priorisierst das Training. Verständlich — aber eine verpasste Chance fürs Image.',
          effects: [] }
      ]
    },
    {
      id: 'lokalderby_hype', weight: 3, trigger: 'matchNextWeek',
      title: 'Die Stadt fiebert mit',
      flavor: 'Vor dem nächsten Spiel ist die ganze Stadt im Ausnahmezustand: Schaufenster in Vereinsfarben, Fahnen an den Balkonen, an jeder Theke wird über die Aufstellung diskutiert. Die Mannschaft spürt diesen Rückenwind bis in die Kabine.',
      flavorEffect: [{ type: 'teamMorale', delta: 3 }]
    },

    // ═══════════════ PRESSE & MEDIEN ═══════════════
    {
      id: 'presse_kritik', weight: 4, trigger: 'streak3',
      title: 'Presse geht auf Distanz',
      flavor: 'Nach der jüngsten Ergebnis-Serie schießt sich die Lokalpresse auf die Mannschaft ein. „Wo ist der Biss?", titelt das Sportblatt, und auch {key} bekommt sein Fett weg. Die Kabine liest mit.',
      options: [
        { label: 'Rückendeckung für das Team geben', resultText: 'Auf der Pressekonferenz stellst du dich schützend vor deine Spieler. In der Kabine kommt das an — die Mannschaft dankt es dir mit Trotz.',
          effects: [{ type: 'teamMorale', delta: 3 }, { type: 'rep', board: -1 }] },
        { label: 'Selbstkritisch antworten', resultText: 'Du gibst der Presse teils recht und forderst öffentlich mehr. Der Vorstand goutiert die klare Kante — die Spieler weniger.',
          effects: [{ type: 'rep', board: 1 }, { type: 'teamMorale', delta: -2 }] }
      ]
    },
    {
      id: 'star_interview', weight: 3, trigger: 'hasStar',
      title: 'Star gibt großes Interview',
      flavor: 'Aushängeschild {star} ({starOvr} OVR) gibt einem großen Magazin ein exklusives Interview. Die Redaktion bohrt sicher nach Wechselgedanken — es könnte ein Treuebekenntnis werden oder ein Politikum.',
      options: [
        { label: '{star} ein Treuebekenntnis nahelegen', resultText: '{star} bekennt sich im Interview klar zum Verein und zum gemeinsamen Ziel. Die Fans feiern jede Zeile.',
          effects: [{ type: 'moraleStar', delta: 3 }, { type: 'rep', ultras: 1 }] },
        { label: '{star} frei reden lassen', resultText: 'Ein ungeschöntes Gespräch — riskant, aber authentisch.',
          bet: { p: 0.6, win: { text: '{star} spricht voller Leidenschaft vom Verein. Perfekte PR, die Kurve ist begeistert.', effects: [{ type: 'rep', eventFans: 2 }] },
                         lose: { text: '{star} lässt Wechselgedanken durchblicken. Prompt entsteht Unruhe im Umfeld.', effects: [{ type: 'rep', ultras: -1 }, { type: 'teamMorale', delta: -2 }] } } }
      ]
    },
    {
      id: 'trainer_lob', weight: 2, trigger: 'always',
      title: 'Lob vom Experten',
      flavor: 'Ein bekannter TV-Experte lobt in einer Talkshow ausdrücklich deine Arbeit — die Entwicklung von {talent} sei „ein Musterbeispiel guter Ausbildung". Solche Worte hört man im Verein gern.',
      flavorEffect: [{ type: 'rep', board: 1 }, { type: 'teamMorale', delta: 1 }]
    },

    // ═══════════════ JUGEND & NACHWUCHS ═══════════════
    {
      id: 'nlz_talent_durchbruch', weight: 3, trigger: 'hasTalent',
      title: 'Talent drängt nach oben',
      flavor: '{talent} ({talentAge}, {talentPos}) trainiert seit Wochen bei den Profis mit und lässt selbst die Routiniers staunen. Im Abschlussspiel legt der Youngster zwei Tore auf — und drängt sichtbar auf seine Chance.',
      flavorEffect: [{ type: 'moraleTalent', delta: 4 }, { type: 'boostWeakestAttr', delta: 1, count: 1 }]
    },
    {
      id: 'nlz_investition', weight: 3, trigger: 'budgetAtLeastEE',
      title: 'Investition ins NLZ?',
      flavor: 'Der Nachwuchsleiter steht mit glänzenden Augen und einem Prospekt in deinem Büro: moderne Trainingsgeräte, Videoanalyse-Technik, GPS-Westen. „Damit machen wir aus Talenten wie {talent} echte Profis." Es wäre eine Investition in die Zukunft.',
      options: [
        { label: 'Investieren', resultText: 'Das NLZ rüstet auf. Schon nach Wochen sieht man {talent} und die anderen Talente sichtbar schneller reifen.',
          effects: [{ type: 'money', tier: 'ee', sign: -1 }, { type: 'moraleTalents', delta: 3, count: 3 }, { type: 'boostWeakestAttr', delta: 1, count: 2 }] },
        { label: 'Verschieben', resultText: 'Du vertagst die Investition auf ruhigere Zeiten. Der Nachwuchsleiter zieht enttäuscht von dannen.',
          effects: [] }
      ]
    },
    {
      id: 'jugend_titel', weight: 2, trigger: 'always',
      title: 'A-Jugend wird Meister',
      flavor: 'Die A-Jugend des Vereins holt in einem Herzschlagfinale die Staffelmeisterschaft! Auf dem Platz wird gejubelt, als hätte man den Pokal gewonnen — ein starkes Signal für die ganze Nachwuchsarbeit.',
      flavorEffect: [{ type: 'rep', board: 1, ultras: 1 }, { type: 'moraleTalents', delta: 2, count: 2 }]
    },

    // ═══════════════ FINANZEN & ALLTAG ═══════════════
    {
      id: 'sponsor_bonus_geruecht', weight: 3, trigger: 'always',
      title: 'Unerwartete Einnahme',
      flavor: 'Ein regionaler Unternehmer und langjähriger Dauerkartenbesitzer möchte den Verein „einfach mal" mit einer einmaligen Zuwendung unterstützen — aus purer Verbundenheit. Ein Handschlag, ein Scheck, keine Gegenleistung.',
      flavorEffect: [{ type: 'moneyRange', min: 'e', max: 'ee', sign: 1 }]
    },
    {
      id: 'rasen_schaden', weight: 3, trigger: 'homeMatchNextWeek',
      title: 'Rasen in schlechtem Zustand',
      flavor: 'Nach tagelangem Dauerregen gleicht der Stadionrasen einem Acker — tiefe Furchen, matschige Stellen vor beiden Toren. Bis zum Heimspiel muss eine Entscheidung her.',
      options: [
        { label: 'Neuen Rasen verlegen', resultText: 'Über Nacht rollen die Greenkeeper frische Bahnen aus. Ein perfekter Teppich zum Heimspiel — teuer, aber die Mannschaft dankt es dir mit gepflegtem Kombinationsspiel.',
          effects: [{ type: 'money', tier: 'ee', sign: -1 }, { type: 'nextMatchModifier', pct: 3, scope: 'any', label: 'Perfekter Rasen' }] },
        { label: 'Notdürftig ausbessern', resultText: 'Sand in die Löcher, kurz gemäht, Linien nach. Bespielbar — schön ist anders.',
          effects: [{ type: 'money', tier: 'e', sign: -1 }] }
      ]
    },
    {
      id: 'mannschaftsbus_panne', weight: 2, trigger: 'matchNextWeek',
      title: 'Der Mannschaftsbus streikt',
      flavor: 'Mitten auf der Autobahn qualmt es aus dem Motorraum — der Mannschaftsbus bleibt liegen. Die Spieler stehen am Standstreifen, das Auswärtsspiel wartet nicht. Improvisation ist gefragt.',
      options: [
        { label: 'Sofort Ersatzbus organisieren', resultText: 'Ein Anruf, eine Stunde Wartezeit, dann rollt Ersatz an. Etwas Stress, aber pünktlich am Ziel — die Profis nehmen es mit Humor.',
          effects: [{ type: 'money', tier: 'e', sign: -1 }, { type: 'teamMorale', delta: 1 }] },
        { label: 'Auf die Reparatur warten', resultText: 'Der Fahrer schraubt, alle bibbern am Standstreifen. Die Anreise wird hektisch, die Aufwärmung fällt viel zu kurz aus.',
          effects: [{ type: 'nextMatchRandomSwing', pct: 3 }] }
      ]
    },
    {
      id: 'trainingslager_angebot', weight: 2, trigger: 'freeWeek',
      title: 'Kurz-Trainingslager möglich',
      flavor: 'Die spielfreie Woche eröffnet die Chance auf ein kompaktes Trainingslager — abgeschieden, ohne Ablenkung, um an Fitness und Abläufen zu feilen. Der Co-Trainer hat schon eine Anlage im Blick.',
      options: [
        { label: 'Trainingslager durchführen', resultText: 'Doppeleinheiten, Taktiktafel, Videoanalyse — die intensiven Tage zahlen sich aus. Die Mannschaft kehrt spürbar eingespielter zurück.',
          effects: [{ type: 'money', tier: 'ee', sign: -1 }, { type: 'boostWeakestAttr', delta: 1, count: 3 }, { type: 'teamMorale', delta: 2 }] },
        { label: 'Spieler erholen lassen', resultText: 'Statt Schweiß gibt es ein paar freie Tage. Regeneration statt Malochen — auch das kann klug sein.',
          effects: [{ type: 'teamMorale', delta: 3 }, { type: 'injuryRiskMod', weeks: 3, factor: 0.7 }] }
      ]
    },
    {
      id: 'grippewelle', weight: 3, trigger: 'squadMin14',
      title: 'Grippewelle im Team',
      flavor: 'Es fängt mit einem Kratzen im Hals an, dann liegt das halbe Team flach. Der Mannschaftsarzt warnt vor Ansteckung und rät dringend zur Vorsicht — der Kader ist ohnehin dünn.',
      options: [
        { label: 'Betroffene schonen', resultText: 'Du schickst die Kränkelnden nach Hause. Das Training wird dünn, aber die Welle bricht sich, bevor sie richtig um sich greift.',
          effects: [{ type: 'injuryRiskMod', weeks: 2, factor: 0.8 }] },
        { label: 'Volles Training durchziehen', resultText: 'Du ziehst das Programm eiskalt durch — riskant bei angeschlagener Truppe.',
          bet: { p: 0.5, win: { text: 'Die Mannschaft steckt es weg, keiner fällt aus.', effects: [{ type: 'teamMorale', delta: 1 }] },
                         lose: { text: 'Prompt erwischt es einen: fieberhafter Infekt, Ausfall.', effects: [{ type: 'injury', weeks: 2, count: 1, label: 'Infekt' }] } } }
      ]
    },
    {
      id: 'wetterchaos', weight: 2, trigger: 'matchNextWeek',
      title: 'Unwetterwarnung',
      flavor: 'Der Wetterdienst gibt eine amtliche Unwetterwarnung für den Spieltag heraus: Sturmböen, Starkregen, womöglich Hagel. Die Platzverhältnisse könnten zur Lotterie werden.',
      flavorEffect: [{ type: 'nextMatchRandomSwing', pct: 2 }]
    },
    {
      id: 'jubilaeum_verein', weight: 2, trigger: 'always',
      title: 'Vereinsjubiläum',
      flavor: 'Der Verein feiert einen runden Geburtstag. Beim Festakt betreten alte Legenden noch einmal das Feld, die Tribüne erhebt sich, und selbst hartgesottene Fans wischen sich eine Träne weg. Die ganze Stadt ist gerührt.',
      flavorEffect: [{ type: 'rep', board: 1, ultras: 1, eventFans: 1 }, { type: 'teamMorale', delta: 2 }]
    },
    {
      id: 'sozialaktion', weight: 2, trigger: 'always',
      title: 'Spieler starten Sozialaktion',
      flavor: '{veteran} und {talent} organisieren eine Sozialaktion für Bedürftige in der Region — Geschenke packen, Suppenküche, Besuch im Kinderheim. Die Presse berichtet wohlwollend, die Fans sind stolz auf ihre Jungs.',
      flavorEffect: [{ type: 'rep', eventFans: 2 }, { type: 'teamMorale', delta: 1 }]
    },
    {
      id: 'star_muede', weight: 3, trigger: 'hasOvr74OrStar',
      title: 'Leistungsträger wirkt ausgelaugt',
      flavor: '{key} ({keyOvr} OVR, {keyPos}) schleppt sich müde durchs Training, die Spritzigkeit fehlt. Der Fitnesstrainer nimmt dich zur Seite: „Der Junge ist überspielt — er braucht eine Pause, sonst reißt was."',
      options: [
        { label: '{key} eine Woche schonen', resultText: 'Du gibst {key} frei. Frisch und mit neuer Energie kehrt er auf den Platz zurück.',
          effects: [{ type: 'moraleStar', delta: 3, who: 'key' }, { type: 'injuryRiskMod', weeks: 2, factor: 0.6 }] },
        { label: '{key} muss durchspielen', resultText: 'Du brauchst ihn und stellst ihn auf. {key} beißt auf die Zähne — hoffentlich geht das gut.',
          bet: { p: 0.55, win: { text: '{key} liefert trotz Müdigkeit ab und hält die Klasse hoch.', effects: [{ type: 'moraleStar', delta: 1, who: 'key' }] },
                          lose: { text: 'Die Überlastung rächt sich: {key} zwickt der Muskel und muss raus.', effects: [{ type: 'injury', weeks: 2, count: 1, label: 'Muskelprobleme', who: 'key' }] } } }
      ]
    }

  ];

  // Frequenz & Skalierung beibehalten wie im DEFAULTS des Event-Systems,
  // aber Events ergänzen. Falls schon eine Config existiert, mergen.
  const base = window.EVENTS_CONFIG || {};
  window.EVENTS_CONFIG = {
    frequency: base.frequency || { baseChance: 0.28, cooldownWeeks: 2, skipBusyWeeks: false },
    money: base.money || { e: 0.02, ee: 0.06, eee: 0.15 },
    repStrength: base.repStrength || { 1: 4, 2: 8, 3: 15 },
    events: (base.events || []).concat(EVENTS),
  };

  console.log('[EventsConfig] ' + EVENTS.length + ' Vereinsleben-Events geladen');
})();
