# Deployment auf balticbrain-dmz · balticbrain.ai / brain.vahl.de

Diese Datei dokumentiert den automatischen Deploy der statischen Website über
GitLab CI auf den Webserver. Sie richtet sich an Betrieb (doti) und
Projektowner.

## Übersicht

| Punkt | Wert |
| --- | --- |
| Zielserver (VM) | `balticbrain-dmz`, IP `10.53.28.55`, Ubuntu 26.04 |
| Webserver | nginx, Document Root `/var/www/balticbrain`, lauscht auf Port 80 |
| Öffentliche URL | `http://brain.vahl.de` |
| GitLab-Runner | läuft **auf der VM selbst** (Projekt-Runner `vahl/balticbrain.ai`, Tag `balticbrain-dmz`, Shell-Executor, User `gitlab-runner`, locked/exklusiv) |
| Deploy-Inhalt | `index.html`, `styles.css`, `script.js`, `.nojekyll`, `assets/` |
| Deployment | GitLab CI, Job `deploy`, nur bei Push auf `main` |
| Konfiguration im Repo | [`.gitlab-ci.yml`](../.gitlab-ci.yml) (Repo-Root) |

## Ablauf

Die Seite ist rein statisch; es gibt keinen Build-Schritt. Bei jedem Push auf
den Default-Branch `main` nimmt der auf der VM laufende Runner den Job an
(Tag `balticbrain-dmz`), checkt das Repository lokal aus und synchronisiert
die Dateien direkt ins Web-Verzeichnis:

```sh
rsync -az --delete index.html styles.css script.js .nojekyll assets/ /var/www/balticbrain/
```

`--delete` hält das Web-Verzeichnis deckungsgleich mit dem Repository:
Gelöschte Dateien (unterhalb von `assets/`) verschwinden auch von der Website.

Der Transfer läuft vollständig lokal auf der VM. Es gibt **kein SSH, kein
rsync über das Netz und keine geheimen CI-Variablen**. Der Runner benötigt
netzseitig nur ausgehend HTTPS (443) zum GitLab-Server, um Jobs und Quellen zu
ziehen; eine eingehende Freigabe für die CI ist nicht nötig.

## Sicherheitsmodell

Der Shell-Executor führt `.gitlab-ci.yml` direkt auf der VM aus – als User
`gitlab-runner`. Das heißt: **Push-Rechte auf dieses Repository sind
Code-Ausführung auf der VM.** Daraus folgt:

- Der Runner gehört **exklusiv zu diesem Projekt** (locked, kein weiteres
  Repository und keine Gruppe auf diesem Runner).
- Schreibrechte im GitLab-Projekt klein halten; der Default-Branch ist
  geschützt.
- Die Jobs laufen mit den begrenzten Rechten des Users `gitlab-runner`
  (Deploy-Ziel: nur `/var/www/balticbrain`).

### Abgelöst: SSH-Deploy-Key und CI-Variable

Der ursprüngliche Entwurf deployte per SSH/rsync über das Netz mit einem
Deploy-Key des Users `deploy`, dessen SSH-Key durch einen forced command auf
genau einen rsync-Aufruf nach `/var/www/balticbrain/` eingeschränkt war, und
mit dem privaten Key in der maskierten CI-Variable `BALTICBRAIN_DEPLOY_KEY`.
Dieses Verfahren ist **abgelöst**: Der Runner läuft inzwischen auf der VM
selbst, der SSH-Weg wird nicht mehr benötigt.

- Die CI-Variable `BALTICBRAIN_DEPLOY_KEY` muss **nicht** gesetzt werden.
- Der forced-command-Eintrag des Deploy-Users auf dem Server kann entfernt
  und der Key außer Betrieb genommen werden (doti).
- Keine Secrets in der CI-Konfiguration, keine CI-Variablen mit
  Schlüsselmaterial.

## Server-Einrichtung (doti, serverseitig)

- GitLab Runner `gitlab-runner` 19.6.0, Shell-Executor, als **Projekt-Runner**
  für `vahl/balticbrain.ai` registriert, Tag `balticbrain-dmz`, läuft als User
  `gitlab-runner`.
- **Schreibrechte des Users `gitlab-runner` auf `/var/www/balticbrain`**
  setzt doti serverseitig (offen).
- `rsync` muss auf der VM installiert sein (der Job prüft Existenz und
  Beschreibbarkeit des Ziels und bricht sonst mit klarer Meldung ab).

## Offene Punkte (IT / doti)

1. **DNS:** `brain.vahl.de` muss auf `10.53.28.55` (bzw. die öffentliche
   DMZ-Frontend-IP) zeigen. Liegt bei der IT.
2. **Firewall:** Freigabe 80/443 zur VM in der DMZ. Liegt bei der IT.
3. **Schreibrechte:** `gitlab-runner` beschreibbar auf `/var/www/balticbrain`
   machen. Liegt bei doti serverseitig.
4. **TLS:** Aktuell serviert nginx Port 80 ohne TLS. HTTPS/Redirect auf 443
   mit Zertifikat für `brain.vahl.de` ist ein Folgeschritt, sobald DNS und
   Firewall stehen.

## nginx-Konfiguration auf balticbrain-dmz

Referenz der aktiven Vhost-Konfiguration (nginx, Port 80):

```nginx
server {
    listen 80 default_server;
    server_name brain.vahl.de balticbrain-dmz _;
    root /var/www/balticbrain;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;

    location ~* \.(css|js|svg|png|jpg|jpeg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```
