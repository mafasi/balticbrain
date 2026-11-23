# Deployment auf balticbrain-dmz · balticbrain.ai

Diese Datei dokumentiert den automatischen Deploy der statischen Website über
GitLab CI auf den Webserver. Sie richtet sich an Betrieb (doti) und
Projektowner.

## Übersicht

| Punkt | Wert |
| --- | --- |
| Zielserver (VM) | `balticbrain-dmz`, öffentliche IP `153.96.43.35` (DMZ), Ubuntu 26.04 |
| Webserver | nginx, Document Root `/var/www/balticbrain`, Ports 80 (Redirect) + 443 (TLS) |
| Öffentliche URL | `https://balticbrain.ai` (primär), `www.balticbrain.ai` (MIT) |
| Weiterleitungen | `balticbrain.com`, `balticbrain.cloud`, `balticbrain.org` (jeweils inkl. `www`) → 301 auf `https://balticbrain.ai` |
| TLS | Let's Encrypt via acme.sh, **DNS-01 über die Porkbun-API**; ein Zertifikat für alle 8 Namen (4 Domänen + je Wildcard), Renewal automatisch per Cron |
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
netzseitig nur ausgehend HTTPS zum GitLab-Server, um Jobs und Quellen zu
ziehen; eine eingehende Freigabe für die CI ist nicht nötig.

## Sicherheitsmodell

Der Shell-Executor führt `.gitlab-ci.yml` direkt auf der VM aus – als User
`gitlab-runner`. Das heißt: **Push-Rechte auf dieses Repository sind
Code-Ausführung auf der VM.** Daraus folgt:

- Der Runner gehört **exklusiv zu diesem Projekt** (locked, kein weiteres
  Repository und keine Gruppe auf diesem Runner).
- Schreibrechte im GitLab-Projekt klein halten; der Default-Branch ist
  geschützt.
- Die Jobs laufen mit den beschränkten Rechten des Users `gitlab-runner`
  (Deploy-Ziel: nur `/var/www/balticbrain`).

## TLS / Zertifikate (Stand 23.11.2026)

- Ausgestellt wird per **acme.sh** (User `vmuser`, `/home/vmuser/.acme.sh`)
  und **DNS-01-Challenge über die Porkbun-API** (Keys liegen unter
  `~vmuser/.secrets/porkbun.env`, API-Key auf Scopes `read,dns` beschränkt).
  Die Domänen müssen in Porkbun für API-Zugriff opted-in sein
  (Account → „Opt In All Domains"). Dieser Weg braucht **keinen offenen
  Port 80** – die Renewals funktionieren unabhängig von der Firewall.
- **Ein Zertifikat** (ECDSA P-256) mit 8 SANs:
  `balticbrain.ai`, `*.balticbrain.ai`, analog für `.com`, `.cloud`, `.org`.
  Installiert nach `~/certs/balticbrain/{fullchain,key}.pem`,
  reloading von nginx über `--reloadcmd "sudo systemctl reload nginx"`.
- Erneuerung: acme.sh-Cron des Users `vmuser` (11× täglich geprüft, ARI-gesteuert).

## Server-Zugriff

Die VM steht in der DMZ; SSH (Port 22222) ist nur über die Jumphost-Kette
erreichbar: **Jumphost `neon`** → knock-Sequenz
(`32994 14299 41588 25872`, Closing `31149 38304 15201 40058`) →
`ssh -p 22222 vmuser@balticbrain-dmz`. Auf neon existiert dafür
`~/bin/knock-ssh`. UFW: 22222 nur vom Jumphost, 80/443 offen.

## nginx-Konfiguration auf balticbrain-dmz

Primär-Site (`/etc/nginx/sites-available/balticbrain`), Stand 23.11.2026:

```nginx
server {
    listen 80 default_server;
    server_name balticbrain-dmz _;          # blanker Host/IP -> plain HTTP
    root /var/www/balticbrain;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}

server {
    listen 80;
    server_name balticbrain.ai www.balticbrain.ai;
    return 301 https://balticbrain.ai$request_uri;
}

server {
    listen 443 ssl default_server;
    http2 on;
    server_name balticbrain.ai www.balticbrain.ai;

    ssl_certificate     /home/vmuser/certs/balticbrain/fullchain.pem;
    ssl_certificate_key /home/vmuser/certs/balticbrain/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /var/www/balticbrain;
    index index.html;

    location / { try_files $uri $uri/ =404; }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;

    location ~* \.(css|js|svg|png|jpg|jpeg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

Die Nebendomänen liegen je in `/etc/nginx/sites-available/redirect-balticbrain.{com,cloud,org}`
(HTTP + HTTPS, jeweils 301 auf `https://balticbrain.ai$request_uri`,
gleiches Zertifikat).

## Offene Punkte

1. **Firewall:** Freigabe 80/443 **vom Internet** zur VM liegt bei der IT-SC
   (Server-FAQ #133568, Ticket #209567). Serverseitig ist alles fertig; nach
   der Freigabe ist `https://balticbrain.ai` ohne weiteres Zutun live.
2. **Legacy `brain.vahl.de`:** zeigt noch per CNAME auf GitHub Pages
   (`mafasi.github.io`). Entscheiden, ob die Alt-Domain auf
   `https://balticbrain.ai` umgezogen wird (DNS + `CNAME`-Datei im Repo).
