/* Gesamt-App · Kickdraft-Texte für die Erinnerungen (gesamt/push.js = flutlicht_manager/js/kickstil_push.js).
   Lädt VOR push.js. Rückmeldung 17.10. (13): „cooler schreiben … da dürfen auch Emojis genutzt werden“ – je Lage mehrere
   Varianten aus dem Spielstand (nächster Gegner, Seed, Bye Week, Playoffs, Draft, Sonderkarte), sonst allgemein.
   Emojis nur hier in den Erinnerungen (im Spiel gilt D104: keine Emojis). */
(function () {
  'use strict';
  const zufallAus = a => a[Math.floor(Math.random() * a.length)];
  const dfl = () => { try { return typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl; } catch (e) { return false; } };
  function lage() {
    const z = {};
    try { z.v = CLUB.shortName || CLUB.name || 'Dein Team'; } catch (e) { z.v = 'Dein Team'; }
    try {
      const f = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
      if (f) {
        const t = findFcmGroup(LEAGUE).group.teams.find(x => x.id === f.opponentId);
        z.gegner = t ? t.name : null; z.heim = f.isHome;
        z.bye = Array.isArray(LEAGUE.matchWeeks) && LEAGUE.matchWeeks[f.matchday - 1] > LEAGUE.week + 1;
      }
    } catch (e) { /* ohne Gegner */ }
    try {
      const me = findFcmGroup(LEAGUE).group.teams.find(x => x.id === 'fcm');
      if (me && me.played && window.DFLSpiel && DFLSpiel.setzliste) {
        const s = DFLSpiel.setzliste(me.conference), reihe = s.sieger.concat(s.wild, s.draussen);
        z.seed = reihe.findIndex(x => x.id === 'fcm') + 1;
      }
    } catch (e) { /* ohne Seed */ }
    try { z.playoffs = !!(window.DFLPlayoffs && DFLPlayoffs.stand && DFLPlayoffs.stand()); } catch (e) { /* nein */ }
    try { z.draft = !!(LEAGUE.dflWechsel || (window.DFLSaisonwechsel && DFLSaisonwechsel.kachel && DFLSaisonwechsel.kachel())); } catch (e) { /* nein */ }
    try { z.karte = window.DFLWoche ? (SQUAD || []).find(p => DFLWoche.bonus(p)) : null; } catch (e) { /* ohne */ }
    return z;
  }
  window.KSPushTexte = function () {
    if (!dfl()) return [
      { titel: '🏈 Dein Team wartet auf dich', text: 'Die Saison in Kickdraft geht weiter – dein Kader braucht seinen Manager.' },
      { titel: '📋 Neues aus der Liga', text: 'Angebote, Verträge und Talente warten auf deine Entscheidung.' },
      { titel: '🏟️ Lange nicht gesehen', text: 'Deine Fans fragen schon nach dir. Ein Spieltag ist schnell gespielt.' }];
    const z = lage(), v = z.v, out = [];
    let eins;
    if (z.playoffs) eins = zufallAus([
      { titel: '🏆 Playoffs! Jetzt zählt alles', text: `Eine Niederlage und die Saison ist vorbei. ${v} braucht dich an der Seitenlinie.` },
      { titel: '🏆 Win or go home', text: `Die Playoffs laufen. Stell die beste Elf auf, bevor es zu spät ist.` }]);
    else if (z.draft) eins = zufallAus([
      { titel: '📝 Der Draft rückt näher', text: 'Dein Board ist noch nicht fertig. Wen holst du mit deinem ersten Pick? 🤔' },
      { titel: '🧾 Tag der Verträge', text: `Wer bleibt, wer geht? ${v} plant die neue Saison – ohne dich geht es nicht.` }]);
    else if (z.karte) eins = { titel: `🃏 ${z.karte.name} ist on fire`, text: `Sonderkarte der Woche – mit Bonus im nächsten Spiel. Nutz die Form, bevor sie verpufft! ⚡` };
    else if (z.seed && z.seed <= 7 && z.gegner) eins = zufallAus([
      { titel: `📈 Seed ${z.seed} – halt ihn fest`, text: `Nächster Gegner: ${z.gegner}. Jeder Sieg bringt dich näher an die Playoffs.` },
      { titel: `🏈 ${z.gegner} wartet schon`, text: `${v} steht auf Seed ${z.seed}. Bleib dran, Coach!` }]);
    else if (z.seed && z.seed > 7 && z.gegner) eins = zufallAus([
      { titel: '😤 Playoffs noch drin!', text: `Seed ${z.seed} – noch nicht vorbei. ${z.gegner} ist die nächste Hürde.` },
      { titel: '🔥 Aufholjagd gefällig?', text: `Die Wildcard ist in Reichweite. ${v} braucht jetzt Siege.` }]);
    else if (z.gegner) eins = zufallAus([
      { titel: `🏈 ${z.gegner} wärmt sich auf`, text: `${z.heim ? 'Heimspiel' : 'Auswärtsspiel'} steht an – deine Elf wartet auf die Aufstellung. 👀` },
      { titel: `⚽ ${v} wartet auf den Anpfiff`, text: `Nächster Gegner: ${z.gegner}. Die Taktiktafel liegt bereit.` }]);
    else eins = { titel: '🏈 Dein Team wartet auf dich', text: 'Die Saison geht weiter – dein Kader braucht seinen Manager.' };
    out.push(eins);
    out.push(zufallAus([
      z.bye && { titel: '😴 Ausgeschlafen nach der Bye Week', text: 'Die Spieler sind ausgeruht. Zeit, die Elf fürs nächste Spiel zu bauen.' },
      { titel: '📞 Trade-Angebot im Postfach?', text: 'Andere Teams fragen nach deinen Spielern. Schau, ob ein Deal passt.' },
      { titel: '🃏 Wer wird Spieler der Woche?', text: 'Offensiv, defensiv, Team der Woche – vielleicht landet einer von deinen auf einer Sonderkarte.' },
      { titel: '📋 Der Eigentümer fragt nach dir', text: `Wie geht es weiter bei ${v}? Die nächste Woche wartet.` }].filter(Boolean)));
    out.push(zufallAus([
      { titel: '🏟️ Lange nicht gesehen', text: `Die Fans von ${v} fragen schon nach dir. Ein Spieltag ist schnell gespielt.` },
      { titel: '📰 Gerüchte um den Manager', text: `„Wo steckt eigentlich der Manager von ${v}?“ Zeit, die Gerüchte zu beenden. 😎` },
      { titel: '🧤 Die Kabine wird unruhig', text: 'Ohne dich trainiert das Team nur Elfmeter. Komm zurück!' }]));
    return out;
  };
})();
