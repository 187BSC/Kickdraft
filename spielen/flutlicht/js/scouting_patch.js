/* ===== scouting_patch.js =====
   Komplett überarbeitetes Scouting-System.
   ─────────────────────────────────────────────────────────────────────────────
   - Zeitbasis: echte Kalenderwochen (advanceCalendarWeek), Basis 7 Wochen.
   - Gezielte Suche: Position + Mindest-Potenzial vor der Reise wählbar.
   - Länderabhängig: jedes Land hat Entfernung/Schwierigkeit → beeinflusst Dauer
     UND Erfolgsqualität (leichter erreichbare Länder liefern zuverlässiger).
   - Nie ergebnislos bei gezielter Suche: es kommt immer mindestens ein
     passender (ggf. schwacher) Spieler zurück.
   - Klügere Verteilung: statt 3 harter Stufen eine echte Glockenkurve um einen
     von Scoutlevel + Länderschwierigkeit abhängigen Erwartungswert.
   - 18 Länder, größere Namensdatenbank (je 20 Vor-/Nachnamen = 400 Kombinationen
     pro Land) für mehr Namensvielfalt.
   Lädt nach engine_main.js, app_main.js (braucht CLUB, LEAGUE, POS_LIST,
   generatePositions, generateAreaRatings, genAttributes, computeOvrFromAreas,
   computeMarketValue, assignBirthday, addNews, formatEuro, rndN, pickRnd,
   computeTeamRatings, renderFacilityCard, renderContractsSection,
   isTransferWindowOpen, positionsDisplay, potentialDisplay, displayName).
   Wird zyklisch von advanceCalendarWeek (Wochen-Tick) aufgerufen — siehe Hook
   am Dateiende.
   ============================================================================= */
(function () {
  'use strict';

  // ── Länder-Datenbank: Namen + Scouting-Schwierigkeit ────────────────────────
  // difficulty 1 (leicht, nah) … 3 (schwer, weit/exotisch):
  //  - beeinflusst Basis-Dauer (± Wochen) und die Nieten-/Qualitätschance.
  const COUNTRIES = {
    // ERWEITERT: vorher 19 Länder — Europa, Südamerika, drei afrikanische und
    // zwei asiatische. Für „Talente aus aller Welt" fehlten die großen
    // Fußballnationen Englands und Italiens ebenso wie Nordafrika, Nordamerika
    // und Skandinavien. Jetzt 29.
    // Namen (2026-10-15, Nutzer: „keine echten Namen“): Die Listen enthielten die Nachnamen bekannter Nationalspieler – und
    // speisen Scouting, Auslandsmarkt und ALLE Europapokal-Kader (euro_kader.js). Jetzt nur gängige Namen des Landes,
    // deutlich mehr je Land; auffällige Vornamen bekannter Spieler sind ebenfalls raus.
    'England':       { flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', difficulty:1,
      first:['Harry','Jack','Callum','Reece','Mason','Liam','Oliver','George','Charlie','Thomas','James','William','Joseph','Samuel','Daniel','Lewis','Ryan','Connor','Jamie','Luke','Adam','Ben','Josh','Kieran','Nathan','Owen','Ethan','Dylan','Jordan','Aaron','Toby','Alfie'],
      last:['Smith','Jones','Taylor','Brown','Williams','Wilson','Johnson','Davies','Robinson','Wright','Thompson','Evans','Walker','White','Roberts','Green','Wood','Jackson','Clarke','Harris','Lewis','Cooper','King','Baker','Turner','Hill','Ward','Morris','Moore','Parker','Fletcher','Hughes','Price','Bennett','Griffiths','Marshall','Webb','Holmes','Pearson','Barker','Chapman','Dawson','Foster','Hunt','Mills','Lawson'] },
    'Italien':       { flag:'🇮🇹', difficulty:1,
      first:['Matteo','Lorenzo','Federico','Alessandro','Giacomo','Riccardo','Davide','Samuele','Tommaso','Andrea','Pietro','Luca','Simone','Marco','Francesco','Gabriele','Stefano','Emanuele','Filippo','Michele','Antonio','Giuseppe','Leonardo','Mattia','Edoardo','Christian','Daniele','Alberto','Enrico','Vincenzo'],
      last:['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi','Caruso','Ferrara','Galli','Martini','Leone','Longo','Gentile','Martinelli','Vitale','Lombardo','Serra','Coppola','De Santis','Marchetti','Parisi','Villa','Pellegrini'] },
    'Dänemark':      { flag:'🇩🇰', difficulty:2,
      first:['Rasmus','Mikkel','Anders','Jonas','Emil','Kasper','Frederik','Magnus','Oliver','Nikolaj','Victor','Malthe','Alexander','Sebastian','Lucas','Noah','Mathias','Christian','Søren','Jakob','Mads','Morten','Thomas','Peter','Martin','Asger','Tobias','William','Oscar','Villads'],
      last:['Andersen','Jensen','Nielsen','Christensen','Larsen','Sørensen','Pedersen','Hansen','Kristensen','Poulsen','Madsen','Thomsen','Skov','Bruun','Rasmussen','Jørgensen','Petersen','Johansen','Mortensen','Møller','Olsen','Knudsen','Jakobsen','Lund','Holm','Clausen','Frederiksen','Laursen','Østergaard','Dam','Berg','Bach','Krogh','Holst','Lauridsen','Iversen','Mikkelsen','Winther','Friis','Lindholm'] },
    'Schweden':      { flag:'🇸🇪', difficulty:2,
      first:['Viktor','Anton','Alexander','Emil','Gustav','Hugo','Oskar','Elias','Filip','Ludvig','Melker','Jesper','Noel','Adam','Simon','Erik','Johan','Lucas','William','Axel','Theo','Liam','Max','Carl','Albin','Linus','Rasmus','Leo','Olle','Henrik'],
      last:['Karlsson','Nordström','Bergström','Holmgren','Ahlberg','Wickström','Falk','Dahlin','Lindqvist','Johansson','Andersson','Nilsson','Eriksson','Larsson','Olsson','Persson','Svensson','Gustafsson','Pettersson','Jonsson','Jansson','Hansson','Bengtsson','Lindberg','Lindström','Jakobsson','Magnusson','Lindgren','Axelsson','Berglund','Sandberg','Lundberg','Sjöberg','Wallin','Engström','Håkansson','Danielsson','Lundgren','Björk','Hedlund'] },
    'Polen':         { flag:'🇵🇱', difficulty:2,
      first:['Kacper','Jakub','Bartosz','Szymon','Mateusz','Filip','Michał','Piotr','Krzysztof','Tomasz','Adrian','Sebastian','Damian','Paweł','Wiktor','Kamil','Łukasz','Marcin','Dawid','Patryk','Maciej','Grzegorz','Rafał','Adam','Oskar','Hubert','Igor','Dominik','Antoni','Jan'],
      last:['Nowak','Kowalski','Wiśniewski','Wójcik','Kowalczyk','Kamiński','Szymański','Woźniak','Dąbrowski','Kozłowski','Jankowski','Mazur','Kwiatkowski','Krawczyk','Kaczmarek','Piotrowski','Grabowski','Pawłowski','Michalski','Nowakowski','Adamczyk','Zając','Wieczorek','Jabłoński','Król','Majewski','Olszewski','Jaworski','Wróbel','Malinowski','Pawlak','Witkowski','Walczak','Stępień','Górski','Rutkowski','Michalak','Sikora','Ostrowski','Baran'] },
    'Türkei':        { flag:'🇹🇷', difficulty:2,
      first:['Emre','Yusuf','Can','Kerem','Salih','Berke','Barış','Umut','Ozan','Mehmet','Ahmet','Mustafa','Murat','Burak','Serkan','Onur','Eren','Ömer','Ali','Furkan','Enes','Oğuz','Tolga','Batuhan','Alper','Volkan','Selim','Kaan','Efe','Doğan'],
      last:['Yılmaz','Demir','Şahin','Çelik','Yıldırım','Aydın','Öztürk','Arslan','Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özdemir','Polat','Erdem','Korkmaz','Akın','Bulut','Güneş','Keskin','Ünal','Tekin','Taş','Kaya','Aksoy','Özkan','Avcı','Uçar','Bozkurt','Karaca','Yavuz','Acar','Sarı','Coşkun','Duman','Kaplan','Ateş'] },
    'Marokko':       { flag:'🇲🇦', difficulty:3,
      first:['Youssef','Bilal','Amine','Ilias','Anass','Mehdi','Zakaria','Oussama','Reda','Ayoub','Walid','Soufiane','Hamza','Omar','Karim','Rachid','Mohamed','Adil','Nabil','Yassine','Tarik','Said','Khalid','Hicham','Imad','Badr','Ismail','Ayman','Othmane','Marouane'],
      last:['Idrissi','Alaoui','Bennani','Tazi','El Amrani','Berrada','Chraibi','El Fassi','Lahlou','Ouazzani','Benjelloun','Bouzid','El Khatib','Haddad','Mansouri','Naciri','Rahmouni','Sabri','Tahiri','Belkadi','Cherkaoui','Daoudi','Fadili','Hamdaoui','Jabri','Kabbaj','Lamrani','Mekouar','Naji','Ouali','Raji','Saidi','Talbi','Wahbi','Yacoubi','Zerouali','Amrani','Bouhlal','Chakir','Ennaji'] },
    'Ghana':         { flag:'🇬🇭', difficulty:3,
      first:['Kwame','Kofi','Yaw','Kwabena','Kwaku','Kojo','Kwesi','Ernest','Osman','Abdul','Prince','Joseph','Samuel','Emmanuel','Daniel','Isaac','Richard','Eric','Felix','Godfred','Nana','Ebenezer','Francis','Michael','Stephen','Seth','Bernard','Kelvin','Raphael','Patrick'],
      last:['Owusu','Mensah','Asare','Amoah','Opoku','Baidoo','Agyeman','Addo','Appiah','Asante','Badu','Danso','Darko','Frimpong','Gyamfi','Kyei','Nkansah','Ofori','Osei','Quaye','Sarpong','Tetteh','Yeboah','Acheampong','Adjei','Amankwah','Anane','Antwi','Boakye','Donkor','Duah','Fosu','Kusi','Manu','Nyarko','Obeng','Ocran','Poku','Wiredu','Bonsu'] },
    'Mexiko':        { flag:'🇲🇽', difficulty:3,
      first:['Santiago','Diego','Alexis','César','Jorge','Luis','Roberto','Kevin','Julián','Israel','Erick','Marcelo','Obed','Alejandro','Miguel','Carlos','José','Juan','Fernando','Ricardo','Daniel','Eduardo','Javier','Raúl','Héctor','Emiliano','Rodrigo','Iván','Mauricio','Ángel'],
      last:['Álvarez','Vega','Sánchez','Quiñones','Pineda','Reyes','Rodríguez','Huerta','Ruíz','Gutiérrez','Aguirre','Domínguez','Hernández','García','Martínez','López','González','Pérez','Ramírez','Flores','Cruz','Morales','Ortiz','Castillo','Jiménez','Mendoza','Vázquez','Ramos','Romero','Herrera','Medina','Aguilar','Navarro','Salazar','Cortés','Delgado','Guzmán','Rosas','Juárez','Fuentes'] },
    'USA':           { flag:'🇺🇸', difficulty:3,
      first:['Christian','Tyler','Malik','Ricardo','Brenden','Johnny','Cade','Kevin','Caleb','Alejandro','Ryan','Matthew','Jacob','Ethan','Noah','Logan','Dylan','Austin','Brandon','Jordan','Chris','Michael','Andrew','Joshua','Cameron','Luke','Owen','Nathan','Jake','Mason'],
      last:['Adams','Wiley','Smith','Johnson','Williams','Brown','Jones','Miller','Davis','Wilson','Anderson','Taylor','Thomas','Moore','Martin','Jackson','Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Young','Allen','Wright','Scott','Green','Baker','Nelson','Carter','Mitchell','Roberts','Turner','Phillips','Campbell','Parker','Evans','Collins','Stewart'] },
    'Deutschland':   { flag:'🇩🇪', difficulty:1,
      first:['Lukas','Maximilian','Felix','Leon','Ben','Jonas','Noah','Elias','Julian','Tim','Finn','Paul','Moritz','Jan','Niklas','Erik','Luca','David','Simon','Fabian','Jannik','Lennard','Malte','Henrik','Ole','Mats','Till','Jakob','Linus','Hannes','Marlon','Kilian','Bastian','Tobias','Nils','Jonathan','Vincent','Anton','Carl','Emil'],
      last:['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Koch','Bauer','Richter','Klein','Wolf','Neumann','Krüger','Braun','Zimmermann','Hartmann','Schröder','Schwarz','Lange','Werner','Krause','Lehmann','Köhler','Herrmann','König','Walter','Mayer','Huber','Kaiser','Fuchs','Peters','Lang','Scholz','Möller','Weiß','Jung','Hahn','Schubert','Vogel','Friedrich','Keller','Günther','Frank','Berger','Winkler','Roth','Beck','Lorenz','Baumann','Franke','Albrecht','Schuster','Simon','Ludwig','Böhm','Winter'] },
    'Österreich':    { flag:'🇦🇹', difficulty:1,
      first:['Lukas','Fabian','Sebastian','Florian','Daniel','Michael','Thomas','Stefan','Christoph','Markus','Andreas','Philipp','Alexander','Matthias','Bernhard','Georg','Manuel','Patrick','Dominik','Raphael','Valentin','Jakob','Clemens','Konstantin','Lorenz','Maximilian','Elias','Tobias','Martin','Julian'],
      last:['Gruber','Huber','Bauer','Wagner','Müller','Pichler','Steiner','Moser','Mayer','Hofer','Leitner','Berger','Fuchs','Eder','Fischer','Schmid','Winkler','Weber','Aigner','Wimmer','Brunner','Lechner','Haas','Schwarz','Wallner','Egger','Reiter','Lang','Baumgartner','Auer','Binder','Wieser','Holzer','Mair','Koller','Lehner','Brandstätter','Hackl','Strasser','Ebner'] },
    'Schweiz':       { flag:'🇨🇭', difficulty:1,
      first:['Luca','Noah','Elias','Nico','Yannick','Simon','Lukas','Fabio','Dario','Marco','Kevin','Fabian','Ramon','Timo','Silvan','Janick','Reto','Livio','Sandro','Cyril','Jonas','Levin','Nils','Jan','Andrin','Gian','Flavio','Pascal','Raphael','Remo'],
      last:['Müller','Meier','Schmid','Keller','Weber','Huber','Schneider','Meyer','Steiner','Fischer','Gerber','Brunner','Baumann','Frei','Zimmermann','Moser','Widmer','Graf','Bachmann','Suter','Wyss','Hofmann','Kunz','Lüthi','Bühler','Marti','Bieri','Kaufmann','Zürcher','Hess','Wenger','Roth','Egli','Studer','Sutter','Lehmann','Fuchs','Ammann','Vogel','Schärer'] },
    'Brasilien':     { flag:'🇧🇷', difficulty:2,
      first:['Gabriel','Lucas','Matheus','Pedro','Thiago','Vinicius','Vitor','Arthur','Rodrigo','Felipe','Gustavo','Bruno','Rafael','Diego','Eduardo','Leonardo','Caio','Igor','Marcelo','Danilo'],
      last:['Silva','Santos','Souza','Oliveira','Pereira','Lima','Ferreira','Costa','Ribeiro','Almeida','Carvalho','Gomes','Martins','Araujo','Rocha','Barbosa','Freitas','Barros','Mendes','Cardoso','Moreira','Nascimento','Teixeira','Correia','Batista','Moura','Vieira','Monteiro','Pinto','Fonseca'] },
    'Argentinien':   { flag:'🇦🇷', difficulty:2,
      first:['Santiago','Matías','Nicolás','Lautaro','Tomás','Facundo','Benjamín','Franco','Joaquín','Bautista','Ignacio','Agustín','Gonzalo','Emiliano','Maximiliano','Federico','Julián','Tobías','Ramiro','Bruno'],
      last:['Fernández','Rodríguez','González','García','López','Martínez','Pérez','Álvarez','Gómez','Díaz','Romero','Sosa','Torres','Ruiz','Flores','Acosta','Benítez','Herrera','Medina','Suárez','Molina','Castro','Ortiz','Silva','Luna','Juárez','Cabrera','Ríos','Ledesma','Aguirre'] },
    'Kolumbien':     { flag:'🇨🇴', difficulty:2,
      first:['Juan','Andrés','Santiago','Sebastian','Mateo','Alejandro','Samuel','Diego','Nicolas','Daniel','Camilo','Esteban','Julian','David','Cristian','Miguel','Jhon','Brayan','Kevin','Yeison'],
      last:['Rodríguez','Martínez','García','Gómez','López','González','Hernández','Sánchez','Pérez','Díaz','Ramírez','Torres','Vargas','Castro','Rojas','Ortiz','Morales','Jiménez','Gutiérrez','Castillo','Mosquera','Cuesta','Valencia','Murillo','Arango','Restrepo','Zapata','Mejía','Ospina','Cárdenas'] },
    'Uruguay':       { flag:'🇺🇾', difficulty:2,
      first:['Federico','Nicolás','Diego','Sebastián','Agustín','Rodrigo','Martín','Bruno','Facundo','Ignacio','Maximiliano','Gonzalo','Joaquín','Lucas','Franco','Mateo','Emiliano','Thiago','Santiago','Leandro'],
      last:['Rodríguez','Fernández','González','Pérez','Sosa','Silva','Martínez','Suárez','Gómez','Díaz','Acosta','Pereira','Cabrera','Rivas','Correa','Núñez','Viera','Machado','Olivera','Ramos','Castro','Méndez','Pintos','Cardozo','Larrosa','Ferreira','Rosales','Techera','Moreira','Lemos'] },
    'Portugal':      { flag:'🇵🇹', difficulty:1,
      first:['João','Rodrigo','Martim','Afonso','Tomas','Gonçalo','Francisco','Duarte','Lourenço','Miguel','Diogo','Tiago','André','Bruno','Rafael','Pedro','Simão','Rui','Nuno','Vasco'],
      last:['Silva','Santos','Ferreira','Pereira','Oliveira','Costa','Rodrigues','Almeida','Nunes','Mendes','Carvalho','Teixeira','Marques','Gomes','Lopes','Martins','Sousa','Fonseca','Pinto','Ramos','Correia','Moreira','Cardoso','Batista','Neves','Antunes','Matos','Vieira','Tavares','Coelho'] },
    'Spanien':       { flag:'🇪🇸', difficulty:1,
      first:['Alejandro','Daniel','David','Javier','Carlos','Sergio','Jorge','Manuel','Pablo','Alvaro','Adrian','Diego','Ivan','Marcos','Raul','Ruben','Victor','Hugo','Mario','Angel'],
      last:['Garcia','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Perez','Sanchez','Ramirez','Torres','Flores','Rivera','Gomez','Diaz','Reyes','Cruz','Morales','Ortiz','Gutierrez','Chavez','Navarro','Moreno','Romero','Alonso','Blanco','Molina','Serrano','Castro','Ortega','Delgado'] },
    'Frankreich':    { flag:'🇫🇷', difficulty:1,
      first:['Lucas','Hugo','Nathan','Louis','Enzo','Gabriel','Rayan','Ethan','Mathis','Noah','Tom','Adam','Sacha','Yanis','Theo','Maxime','Antoine','Baptiste','Alexandre','Nicolas'],
      last:['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','André','Lefèvre','Mercier','Dupont','Lambert','Bonnet','François','Martinez'] },
    'Belgien':       { flag:'🇧🇪', difficulty:1,
      first:['Liam','Noah','Lucas','Louis','Arthur','Mathis','Adam','Victor','Nathan','Ethan','Milan','Jules','Leon','Finn','Elias','Sam','Tuur','Wout','Robbe','Senne'],
      last:['Peeters','Janssens','Maes','Jacobs','Mertens','Willems','Claes','Goossens','Wouters','De Smet','Dubois','Lambert','Simon','Michiels','Vermeulen','Vandenberghe','Van Damme','Verhoeven','Aerts','Hermans','Desmet','Smets','Pauwels','Martens','Wuyts','Renard','Leclercq','Lemaire','Dupuis','Claessens'] },
    'Niederlande':   { flag:'🇳🇱', difficulty:1,
      first:['Daan','Milan','Luuk','Thijs','Sem','Bram','Levi','Lucas','Lars','Finn','Ruben','Jesse','Sven','Max','Tim','Stijn','Noud','Cas','Guus','Bram'],
      last:['de Jong','de Vries','van Dijk','Jansen','Bakker','Visser','Smit','Meijer','de Boer','Mulder','de Groot','Bos','Vos','Peters','Hendriks','van Leeuwen','Dekker','Brouwer','de Wit','Dijkstra','Smits','Kok','Jacobs','Vermeulen','van den Berg','Koster','Prins','Huisman','Postma','Kuiper'] },
    'Kroatien':      { flag:'🇭🇷', difficulty:2,
      first:['Luka','Marko','Ivan','Ante','Josip','Filip','Petar','Karlo','Tomislav','Nikola','Marin','Dario','Domagoj','Bruno','Fran','Mateo','Roko','Toni','Kristijan','Leon'],
      last:['Horvat','Kovačević','Babić','Marić','Jurić','Kovač','Vuković','Knežević','Novak','Petrović','Matić','Barišić','Perić','Blažević','Radić','Tomić','Grgić','Šimić','Vidović','Bošnjak','Pavić','Božić','Lovrić','Kolar','Jurišić','Mlinarić','Pranjić','Rukavina','Galić','Zorić'] },
    'Serbien':       { flag:'🇷🇸', difficulty:2,
      first:['Nikola','Marko','Stefan','Milan','Aleksandar','Nemanja','Luka','Uroš','Dušan','Vladimir','Filip','Ognjen','Bogdan','Đorđe','Miloš','Petar','Andrija','Nenad','Vuk','Igor'],
      last:['Jovanović','Petrović','Nikolić','Marković','Đorđević','Stojanović','Ilić','Stanković','Pavlović','Milošević','Todorović','Ristić','Simić','Ranković','Popović','Kostić','Lukić','Vasić','Živković','Đukić','Obradović','Mitrović','Radović','Janković','Savić','Zečević','Dimitrijević','Mladenović','Stevanović','Lazić'] },
    'Elfenbeinküste':{ flag:'🇨🇮', difficulty:3,
      first:['Ibrahim','Moussa','Sekou','Cheick','Oumar','Aboubacar','Mamadou','Yao','Koffi','Youssouf','Amara','Souleymane','Bakary','Lassana','Karim','Yssouf','Adama','Boubacar','Drissa','Zié'],
      last:['Kouadio','Koné','Kouassi','Bamba','Traoré','Fofana','Diomandé','Touré','Cissé','Yapi','Diabaté','Sangaré','Ouattara','Coulibaly','Camara','Diallo','Konaté','Sylla','Diakité','Doumbia','Kamagaté','Gnagne','Dosso','Kouamé','Ahoua','Zadi','Yao','Brou','Aka','Tanoh'] },
    'Senegal':       { flag:'🇸🇳', difficulty:3,
      first:['Mamadou','Ousmane','Ibrahima','Cheikh','Moussa','Abdoulaye','Modou','Alioune','Babacar','Assane','Serigne','El Hadji','Pape','Amadou','Souleymane','Idrissa','Lamine','Boubacar','Malick','Youssou'],
      last:['Diop','Ndiaye','Fall','Diallo','Sow','Ba','Gueye','Sarr','Sy','Cissé','Faye','Diagne','Mbaye','Thiam','Kane','Sene','Toure','Diatta','Camara','Seck','Niang','Badji','Sane','Mendy','Goudiaby','Dieng','Sall','Wade','Ka','Diouf'] },
    'Nigeria':       { flag:'🇳🇬', difficulty:3,
      first:['Chidi','Emeka','Ifeanyi','Chinedu','Obinna','Kelechi','Tobenna','Kingsley','Success','Ahmed','Musa','Ibrahim','Segun','Tunde','Bayo','Femi','Chukwuemeka','Sunday','Victor','Samuel'],
      last:['Okafor','Okonkwo','Eze','Obi','Adeyemi','Balogun','Okoye','Nwosu','Ibrahim','Bello','Adamu','Yusuf','Onyango','Chukwu','Ogundipe','Afolabi','Oladipo','Nwachukwu','Umeh','Etim','Okeke','Adebayo','Olawale','Uche','Onuoha','Abubakar','Danjuma','Ekong','Okoro','Nnamdi'] },
    'Japan':         { flag:'🇯🇵', difficulty:3,
      first:['Hiroto','Ren','Yuma','Sota','Haruto','Asahi','Itsuki','Yamato','Riku','Hinata','Sora','Kaito','Yuto','Kenta','Daiki','Shota','Ryusei','Taiga','Kaito','Minato'],
      last:['Sato','Suzuki','Takahashi','Tanaka','Watanabe','Ito','Yamamoto','Nakamura','Kobayashi','Kato','Yoshida','Yamada','Sasaki','Yamaguchi','Matsumoto','Inoue','Kimura','Hayashi','Shimizu','Saito','Mori','Ikeda','Hashimoto','Abe','Ishikawa','Ogawa','Fujita','Okada','Goto','Hasegawa'] },
    'Südkorea':      { flag:'🇰🇷', difficulty:3,
      first:['Min-jun','Seo-jun','Do-yun','Ha-jun','Ji-ho','Joon-woo','Si-woo','Hyun-woo','Jae-won','Tae-yang','Woo-jin','Dong-hyun','Sung-min','Jun-ho','Yong-jun','Kang-min','Sang-woo','Jin-woo','Hyun-jin','Chan-ho'],
      last:['Kim','Lee','Park','Choi','Jung','Kang','Cho','Yoon','Jang','Lim','Han','Oh','Seo','Shin','Kwon','Hwang','Ahn','Song','Yoo','Hong','Jeon','Ko','Moon','Yang','Bae','Baek','Heo','Nam','Noh','Ha'] },
  };
  const COUNTRY_LIST = Object.keys(COUNTRIES);

  // Basis-Dauer 7 Wochen; Schwierigkeit verschiebt sie leicht.
  const BASE_DURATION = 7;
  const MISSION_COST = 120000;
  // zusätzliche Kosten pro Schwierigkeitsstufe (weitere Reise, mehr Spesen)
  const DIFFICULTY_COST_ADD = { 1: 0, 2: 25000, 3: 55000 };
  const DIFFICULTY_DURATION_ADD = { 1: 0, 2: 1, 3: 3 };     // Wochen Aufschlag
  // Gezielte Suche (Position/Potenzial) braucht zusätzliche Zeit — man sucht ja
  // bewusst nach einem bestimmten Profil statt "irgendwen Gutes".
  const TARGETED_DURATION_ADD = 2;

  function EP() { return typeof CLUB !== 'undefined' ? CLUB : null; }

  // ── Scout-Verwaltung ─────────────────────────────────────────────────────
  function scoutCountForLevel(lvl) { return lvl >= 8 ? 3 : lvl >= 4 ? 2 : 1; }
  function ensureScouts() {
    if (!CLUB.scouts) CLUB.scouts = [];
    const target = scoutCountForLevel(CLUB.facilities.scouting || 1);
    while (CLUB.scouts.length < target) {
      CLUB.scouts.push({ id: 'scout' + CLUB.scouts.length, name: 'Scout ' + (CLUB.scouts.length + 1),
        status: 'ready', country: null, progress: 0, duration: BASE_DURATION,
        targetPos: null, targetPotential: null });
    }
  }

  function missionCost(country) {
    const d = COUNTRIES[country]; if (!d) return MISSION_COST;
    return MISSION_COST + (DIFFICULTY_COST_ADD[d.difficulty] || 0);
  }
  function missionDuration(country, targeted) {
    const d = COUNTRIES[country]; if (!d) return BASE_DURATION;
    let dur = BASE_DURATION + (DIFFICULTY_DURATION_ADD[d.difficulty] || 0);
    if (targeted) dur += TARGETED_DURATION_ADD;
    return dur;
  }

  // Startet eine Mission. targetPos: Positionscode oder null (offene Suche).
  // minPotential: 0 (egal) / 5 (solide+) / 10 (hohes Potenzial) / 15 (Elite).
  function startScoutMission(scoutId, country, targetPos, minPotential) {
    ensureScouts();
    const scout = CLUB.scouts.find(s => s.id === scoutId);
    if (!scout || scout.status !== 'ready') return;
    if (!COUNTRIES[country]) { alert('Ungültiges Ziel!'); return; }
    const cost = missionCost(country);
    if (CLUB.budget < cost) { alert('Nicht genug Budget für die Mission (' + formatEuro(cost) + ')!'); return; }
    const targeted = !!(targetPos || minPotential);
    const dur = missionDuration(country, targeted);

    CLUB.budget -= cost;
    scout.status = 'searching'; scout.country = country; scout.progress = 0;
    scout.duration = dur; scout.targetPos = targetPos || null; scout.targetPotential = minPotential || 0;

    const searchDesc = targeted
      ? `gezielt nach ${targetPos ? 'einem ' + posLongName(targetPos) : 'einem Talent'}${minPotential ? ' mit ' + potentialLabel(minPotential) + ' Potenzial' : ''}`
      : 'nach vielversprechenden Talenten';
    addNews('club', '🔎 Scout reist ab',
      `${scout.name} sucht ${dur} Wochen lang in ${COUNTRIES[country].flag} ${country} ${searchDesc}.`);
    renderScoutTab(); saveGameState();
  }

  function posLongName(pos) {
    return { TW:'Torwart', IV:'Innenverteidiger', AV:'Außenverteidiger', LV:'Linken Verteidiger', RV:'Rechten Verteidiger',
      ZDM:'Def. Mittelfeldspieler', ZM:'Zentr. Mittelfeldspieler', AM:'Äußeren Mittelfeldspieler', LM:'Linken Mittelfeldspieler',
      RM:'Rechten Mittelfeldspieler', OM:'Offensiven Mittelfeldspieler', ZOM:'Zentr. Offensivspieler', FL:'Flügelspieler',
      LF:'Linksaußen', RF:'Rechtsaußen', ST:'Stürmer' }[pos] || pos;
  }
  function potentialLabel(min) {
    if (min >= 15) return 'Elite-';
    if (min >= 10) return 'hohem';
    if (min >= 5) return 'solidem';
    return 'egal welchem';
  }

  // ── Wochen-Tick: Fortschritt + Ergebnis ─────────────────────────────────────
  function advanceScoutsWeekly() {
    if (!CLUB.scouts) return;
    let teamRating = 65;
    try { teamRating = computeTeamRatings().overall; } catch (e) {}
    const scoutLvl = (CLUB.facilities && CLUB.facilities.scouting) ? CLUB.facilities.scouting : 1;

    CLUB.scouts.forEach(scout => {
      if (scout.status !== 'searching') return;
      scout.progress++;
      const dur = scout.duration || BASE_DURATION;
      if (scout.progress < dur) return;

      scout.status = 'ready';
      const country = scout.country;
      const cd = COUNTRIES[country] || { difficulty: 2, flag: '🏳️' };
      resolveMission(scout, country, cd, teamRating, scoutLvl);
    });
  }

  // Klügere, echte Glockenkurve statt harter 3-Stufen-Treppe: Erwartungswert
  // hängt von Scoutlevel & Länderschwierigkeit ab, Streuung sorgt für Vielfalt
  // (Ausreißer nach oben UND unten möglich, aber Extreme selten).
  function gaussianSample(mean, sd) {
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * sd;
  }

  function resolveMission(scout, country, cd, teamRating, scoutLvl) {
    const targeted = !!(scout.targetPos || scout.targetPotential);
    const levelBoost = (scoutLvl - 1) / 9;           // 0..1
    const diffPenalty = (cd.difficulty - 1) * 0.14;   // schwerere Länder: mehr Risiko

    // ── Ergebnis-Qualität als Glockenkurve ──────────────────────────────────
    // Erwartungswert (in OVR-Punkten relativ zum Teamniveau) steigt mit
    // Scout-Level, sinkt mit Länderschwierigkeit. Streuung macht die Kurve
    // "klug" statt sprunghaft: die meisten Funde liegen nahe am Erwartungswert,
    // aber echte Perlen und echte Nieten bleiben möglich.
    const mean = -3 + levelBoost * 7 - diffPenalty * 6;   // ca. -9 (Anfänger, schwer) .. +4 (Meister, leicht)
    const sd = 5.5 + diffPenalty * 2;                      // schwerere Länder streuen mehr
    let qualityOffset = gaussianSample(mean, sd);
    qualityOffset = Math.max(-16, Math.min(20, qualityOffset));

    // Ungezielte Suche kann komplett ergebnislos bleiben (v.a. schwere Länder,
    // niedriges Level). Gezielte Suche liefert laut Vorgabe IMMER jemanden,
    // ggf. schwach — dafür braucht sie ja auch länger.
    if (!targeted) {
      const nothingChance = Math.max(0.04, 0.22 + diffPenalty - levelBoost * 0.18);
      if (Math.random() < nothingChance) {
        addNews('club', '🔍 Scouting ergebnislos',
          `${scout.name} kehrt aus ${cd.flag} ${country} zurück, ohne ein überzeugendes Talent gefunden zu haben. Die Reise war diesmal umsonst.`);
        return;
      }
    }

    // ── Position bestimmen ──────────────────────────────────────────────────
    const pos = scout.targetPos || pickRnd(POS_LIST);
    const positions = generatePositions(pos);
    const age = 16 + rndN(4);

    // ── OVR aus Teamniveau + Qualitäts-Offset ───────────────────────────────
    let ovr = Math.round(teamRating + qualityOffset);
    ovr = Math.max(45, Math.min(90, ovr));

    // ── Potenzial: an Qualität gekoppelt, aber bei Mindestanforderung garantiert ─
    let potentialBonus = Math.max(0, Math.round((qualityOffset + 10) * 0.7));
    potentialBonus = Math.max(0, Math.min(18, potentialBonus));
    if (scout.targetPotential && potentialBonus < scout.targetPotential) {
      // gezielte Suche nach hohem Potenzial: Mindestwert garantieren (kostet halt
      // Zeit — das haben wir schon über TARGETED_DURATION_ADD eingepreist),
      // dafür OVR etwas niedriger ansetzen (Kompromiss: Talent statt Fertigware).
      potentialBonus = scout.targetPotential + rndN(4);
      ovr = Math.max(45, ovr - 3 - rndN(4));
    }

    const areas = generateAreaRatings(positions, ovr);
    const paceMental = genAttributes(pos, ovr);
    const player = {
      id: 'scout_' + Date.now() + '_' + rndN(1000), name: generateScoutPlayerName(country),
      flag: cd.flag, pos, positions, age,
      def: areas.def, mid: areas.mid, att: areas.att,
      pace: paceMental.pace, mental: paceMental.mental,
      gamesPlayed: 0, seed: rndN(100), country,
    };
    player.ovr = computeOvrFromAreas(player);
    player.truePotential = Math.min(96, player.ovr + potentialBonus);
    const priceFactor = 0.55 + Math.random() * 0.35;
    player.price = Math.floor(computeMarketValue(player) * priceFactor / 1000) * 1000;
    assignBirthday(player);
    if (!CLUB.scoutedPlayers) CLUB.scoutedPlayers = [];
    CLUB.scoutedPlayers.push(player);

    const tierLabel = qualityOffset >= 9 ? 'top' : qualityOffset >= 2 ? 'solide' : qualityOffset >= -6 ? 'durchschnittlich' : 'schwach';
    const emoji = { top: '💎', solide: '🔎', durchschnittlich: '📋', schwach: '🪫' }[tierLabel];
    const headline = { top: 'Scouting-Juwel!', solide: 'Talent gefunden', durchschnittlich: 'Spieler beobachtet', schwach: 'Mäßiger Fund' }[tierLabel];
    const targetTxt = targeted ? ' (Zielsuche)' : '';
    addNews('transfer', `${emoji} ${headline}${targetTxt}`,
      `${scout.name} bringt aus ${cd.flag} ${country} einen Spieler mit: ${player.flag} ${player.name} (${positionsDisplay(player)}, OVR ${player.ovr}) — Preis ${formatEuro(player.price)}.`);
  }

  function generateScoutPlayerName(country) {
    const d = COUNTRIES[country]; if (!d) return 'Unbekannt';
    return pickRnd(d.first) + ' ' + pickRnd(d.last);
  }

  // ── UI: Scout-Tab ────────────────────────────────────────────────────────
  const POS_OPTIONS = ['TW', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'LM', 'RM', 'ZOM', 'LF', 'RF', 'ST'];
  const POTENTIAL_OPTIONS = [
    { v: 0, label: 'Egal (offene Suche)' },
    { v: 5, label: 'Solides Potenzial' },
    { v: 10, label: 'Hohes Potenzial' },
    { v: 15, label: 'Elite-Potenzial' },
  ];

  // ── Scouting-Weltkarte: Länder nach Region, klickbar, mit Missions-Fortschritt ──
  const SCOUT_REGIONS = {
    'Europa':     ['Deutschland', 'Österreich', 'Schweiz', 'Niederlande', 'Belgien', 'Frankreich', 'Portugal', 'Spanien', 'Kroatien', 'Serbien'],
    'Südamerika': ['Brasilien', 'Argentinien', 'Kolumbien', 'Uruguay'],
    'Afrika':     ['Elfenbeinküste', 'Senegal', 'Nigeria'],
    'Asien':      ['Japan', 'Südkorea']
  };
  function scoutFlag(country) {
    return (typeof window.flagHTML === 'function') ? window.flagHTML(country) : ((COUNTRIES[country] && COUNTRIES[country].flag) || '🏳️');
  }
  function buildScoutWorldMap(scoutLvl) {
    ensureScouts();
    const freeScout = CLUB.scouts.find(s => s.status !== 'searching');
    const activeByCountry = {};
    CLUB.scouts.forEach(s => { if (s.status === 'searching') activeByCountry[s.country] = s; });
    const posOptions = `<option value="">Beliebige Position</option>` + POS_OPTIONS.map(p => `<option value="${p}">${posLongName(p)}</option>`).join('');
    const potOptions = POTENTIAL_OPTIONS.map(o => `<option value="${o.v}">${o.label}</option>`).join('');
    // Nutzer 2026-10-22: überflüssiger Text raus („Land anklicken zum Losschicken“ steht schon in der ⓘ-Karte); der leere Span hält nur den ⓘ-Knopf rechts
    const toolbar = `<div class="wm-toolbar">
        <span class="wm-scout ${freeScout ? '' : 'busy'}">${freeScout ? '<i class="ti ti-user-search"></i> ' + freeScout.name + ' bereit' : '<i class="ti ti-clock"></i> kein Scout frei'}</span>
        <select id="wm-pos" class="scout-select">${posOptions}</select>
        <select id="wm-pot" class="scout-select">${potOptions}</select>
        <span class="wm-hint" aria-hidden="true"></span>${typeof infoBtn === 'function' ? infoBtn('scouting') : ''}
      </div>`;
    const regionsHtml = Object.keys(SCOUT_REGIONS).map(reg => {
      const cards = SCOUT_REGIONS[reg].map(c => {
        const d = COUNTRIES[c]; if (!d) return '';
        const active = activeByCountry[c];
        const stars = '★'.repeat(d.difficulty) + '☆'.repeat(3 - d.difficulty);
        if (active) {
          const pct = Math.round(active.progress / active.duration * 100);
          return `<div class="wm-country busy" title="${active.name} unterwegs">
              <div class="wm-flag">${scoutFlag(c)}</div><div class="wm-cname">${c}</div>
              <div class="wm-prog"><div class="wm-prog-fill" style="width:${pct}%"></div></div>
              <div class="wm-sub">Woche ${active.progress}/${active.duration}</div></div>`;
        }
        const clickable = !!freeScout;
        return `<div class="wm-country ${clickable ? '' : 'off'}" ${clickable ? `onclick="scoutSendTo('${c}')"` : ''} title="Schwierigkeit ${d.difficulty}/3">
            <div class="wm-flag">${scoutFlag(c)}</div><div class="wm-cname">${c}</div>
            <div class="wm-diff">${stars}</div></div>`;
      }).join('');
      return `<div class="wm-region"><div class="wm-region-head">${reg}</div><div class="wm-grid">${cards}</div></div>`;
    }).join('');
    return `<div class="scout-worldmap">${toolbar}${regionsHtml}</div>`;
  }
  window.scoutSendTo = function (country) {
    const free = (CLUB.scouts || []).find(s => s.status !== 'searching');
    if (!free) { if (typeof showToast === 'function') showToast('Kein Scout verfügbar — warte, bis eine Mission endet.', 'warn'); return; }
    const pos = (document.getElementById('wm-pos') || {}).value || '';
    const pot = parseInt((document.getElementById('wm-pot') || {}).value) || 0;
    startScoutMission(free.id, country, pos, pot);
  };

  function renderScoutTab() {
    if (!LEAGUE) return;
    ensureScouts();
    const scoutLvl = CLUB.facilities.scouting || 1;

    const banner = document.getElementById('scout-banner');
    if (banner) banner.innerHTML = `<div>Budget: <span class="budget-amount">${formatEuro(CLUB.budget)}</span></div><div style="font-size:11px;color:var(--text2)">Scouting Stufe ${scoutLvl} · ${CLUB.scouts.length} Scout(s) · Mission ab ${formatEuro(MISSION_COST)} / ${BASE_DURATION} Wochen</div>`;

    const youthEl = document.getElementById('scout-youth-facility');
    if (youthEl) youthEl.innerHTML = renderFacilityCard('youth');
    const scoutFacEl = document.getElementById('scout-facility');
    if (scoutFacEl) scoutFacEl.innerHTML = renderFacilityCard('scouting');

    const mEl = document.getElementById('scout-missions');
    if (mEl) mEl.innerHTML = buildScoutWorldMap(scoutLvl);

    const rEl = document.getElementById('scout-results');
    if (rEl) {
      const list = CLUB.scoutedPlayers || [];
      rEl.innerHTML = list.length ? list.map(p => `<div class="market-row">
        <div style="flex:1"><span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span><span class="market-name">${p.flag} ${displayName(p)}</span>
        <div class="market-meta">${p.age} J · ${potentialDisplay(p, scoutLvl)} · DEF ${p.def} · MID ${p.mid} · ATT ${p.att} · ${p.country}</div></div>
        <div class="market-value">${formatEuro(p.price)}</div>
        <div class="market-btns"><button class="mkt-btn" ${(CLUB.budget < p.price || !isTransferWindowOpen()) ? 'disabled' : ''} onclick="signScoutedPlayer('${p.id}')">Verpflichten</button></div>
      </div>`).join('') : '<div style="color:var(--text3);font-size:11px">Noch keine Talente gescoutet. Schick einen Scout auf Mission!</div>';
    }

    const contractsEl = document.getElementById('scout-contracts');
    if (contractsEl) contractsEl.innerHTML = renderContractsSection();
  }

  // CSS für Fortschrittsbalken & Formular
  if (typeof document !== 'undefined' && !document.getElementById('scouting-style')) {
    const s = document.createElement('style');
    s.id = 'scouting-style';
    s.textContent = `
      .scout-progress-bar { background:var(--bg3,#21262d); border-radius:5px; height:6px; margin-top:6px; overflow:hidden; }
      .scout-progress-fill { height:100%; background:var(--blue,#388bfd); }
      .scout-mission-form { flex-direction:column; align-items:stretch; gap:8px; }
      .scout-form-row { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
      .scout-select { background:var(--bg3,#21262d); color:var(--text,#e6edf3); border:1px solid var(--border,#30363d);
        border-radius:6px; padding:6px; font-size:11px; flex:1; min-width:120px; }
    `;
    document.head.appendChild(s);
  }

  // ── Wochen-Hook: Scouting läuft pro echter Kalenderwoche ────────────────────
  if (typeof window.advanceCalendarWeek === 'function') {
    const _orig = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _orig.apply(this, arguments);
      if (r !== false) { try { advanceScoutsWeekly(); } catch (e) { console.warn('[Scouting] Tick-Fehler', e); } }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // Globale API (von HTML-onclick & anderen Modulen genutzt)
  window.startScoutMission = startScoutMission;
  window.renderScoutTab = renderScoutTab;
  window.ensureScouts = ensureScouts;
  window.advanceScoutsWeekly = advanceScoutsWeekly;
  window.SCOUTING_COUNTRIES = COUNTRIES;   // Kompat-Name, falls woanders genutzt
  window.SCOUT_COUNTRY_LIST = COUNTRY_LIST;

  console.log('[Scouting] neu aktiv — ' + COUNTRY_LIST.length + ' Länder, Zielsuche, wochenbasiert');
})();