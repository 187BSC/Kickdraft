# langerhafer.com – Website von Langer Hafer Studios

Studio-Seite für **Unter Flutlicht** mit den Spielarten Vereinskarriere und Kickdraft. Ausgeliefert über GitHub Pages (Zweig `main`,
eigene Domain in `CNAME`).

| Pfad | Inhalt |
|---|---|
| `index.html`, `style.css`, `bilder/`, `schrift/` | Startseite (beide Spielarten, Handy und PC) |
| `datenschutz.html` | Datenschutzerklärung (App mit Werbung, Pro, Browser-Demo, Website) |
| `spielen/` | Online-Demo: Moduswahl + beide Spielarten, **erzeugt** – nie von Hand ändern |

`spielen/` neu bauen (im Spiel-Repo 187BSC/football-nfl):

```
gesamt_app/website_bauen.sh /pfad/zu/dieser/website/spielen
```

Demo-Grenze Vereinskarriere 2 Saisons, Kickdraft 1 Saison (`DEMO_SAISONS_FL`, `DEMO_SAISONS_KD`), ohne Werbung, am PC ab 1200 px
mit Maus die PC-Bedienung. Offen: Impressum (Anschrift fehlt noch), `app-ads.txt` (AdMob-Kennung fehlt noch).
