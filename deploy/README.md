# Deployment auf balticbrain-dmz · balticbrain.ai

Diese Datei dokumentiert den automatischen Deploy der statischen Website über
GitLab CI auf den Webserver. Sie richtet sich an Betrieb (doti) und
Projektowner.

## Übersicht

| Punkt | Wert |
| --- | --- |
| Zielserver (VM) | `balticbrain-dmz`, öffentliche IP `153.96.43.35` (DMZ), Ubuntu 26.04 |
| Webserver | nginx, Document Root `/var/www/balticbrain`, Ports 80 (Redirect) + 443 (TLS), Security-Header via Snippet, `server_tokens off` |
| Öffentliche URL | `https://balticbrain.ai` (primär), `www.balticbrain.ai` (MIT) |
| Weiterleitungen | `balticbrain.com`, `balticbrain.cloud`, `balticbrain.org` (jeweils inkl. `www`) → 301 auf `https://balticbrain.ai` |
| TLS | Let's Encrypt via acme.sh, **DNS-01 über die Porkbun-API**; ein Zertifikat für alle 8 Namen (4 Domänen + je Wildcard), Renewal automatisch per Cron |
| GitLab-Runner | läuft **auf der VM selbst** (Projekt-Runner `vahl/balticbrain.ai`, Tag `balticbrain-dmz`, Shell-Executor, User `gitlab-runner`, locked/exklusiv, **protected**) |
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
- Der Runner ist **protected** (`access_level: ref_protected`, gesetzt am
  23.11.2026): Er nimmt nur Jobs aus Pipelines auf geschützten Refs an —
  derzeit nur `main`. Ein Feature-Branch mit geänderter `.gitlab-ci.yml`
  kann damit keine Befehle auf der VM ausführen; die `workflow`-Regel in
  `.gitlab-ci.yml` wird so durch die Runner-Konfiguration erzwungen, statt
  nur auf Konvention zu beruhen.
- Schreibrechte im GitLab-Projekt klein halten; der Default-Branch ist
  geschützt (Push und Merge nur Maintainer).
- **Merge-Gate „Pipelines must succeed"** (aktiviert am 23.11.2026): Ein MR
  ist erst mergbar, wenn seine Pipeline grün ist. Dafür erzeugen
  `workflow`-Regeln zusätzlich MR-Pipelines, die den leichten Job `check`
  auf Shared-/Instanz-Runnern ausführen (Datei-Existenz und Integrität der
  referenzierten Assets; kein Zugriff auf die DMZ-VM). Zusammenspiel:
  Versucht ein MR, einen Job mit dem Tag `balticbrain-dmz` zu starten,
  nimmt ihn der protected-Runner nicht an – der Job bleibt `pending`, die
  Pipeline wird nie grün, der MR ist nicht mergbar. Deploy bleibt
  ausschließlich Push-auf-`main`-Pipeline des protected-Runners vorbehalten.
- Die Jobs laufen mit den beschränkten Rechten des Users `gitlab-runner`
  (Deploy-Ziel: nur `/var/www/balticbrain`).

## Server-Härtung (Stand 23.11.2026, aus dem Security-Audit)

Umgesetzt nach dem Security-Audit vom 23.11.2026 (live verifiziert):
- **Security-Header global** über das Snippet
  `/etc/nginx/snippets/security-headers.conf`: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, strenge `Content-Security-Policy`
  (`default-src 'none'`-Profil; die Seite nutzt keinerlei
  Inline-Styles/-Scripts) und `Permissions-Policy` mit deaktivierten
  APIs. Alle mit `always`, damit sie auch auf Fehlerseiten gesetzt sind.
- **HSTS:** Hauptsite
  `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`;
  Redirect-Vhosts ohne `preload` (reine Weiterleitungen). Auf Port-80-Blöcken
  bewusst kein HSTS. Die Einreichung von `balticbrain.ai` auf
  hstspreload.org ist ein bewusster Folgeschritt (s. offene Punkte).
- **Versionsverrat entfernt:** `server_tokens off;` in
  `/etc/nginx/nginx.conf` → `Server: nginx` ohne Version/OS.
- **nginx-Vererbung:** Location-Blöcke mit eigenem `add_header` (Assets-Cache)
  erben Server-Header nicht — das Snippet wird dort erneut eingebunden.
- **Kernel:** laufender Kernel `7.0.0-44-generic` ist der beste verfügbare
  Repository-Stand (0 upgradable). Die angreifbaren Alt-Kernel 7.0.0-31/30
  wurden am 23.11.2026 vollständig entfernt (Purge + `update-grub`); die
  zugehörigen Wazuh-CVEs sind damit eliminiert. Künftige Kernel-Rolls
  installiert `unattended-upgrades` automatisch (inkl. `-security`-Origin);
  Reboot danach bewusst manuell (s. offene Punkte).
- Rollback für alle Änderungen: Konfigurations-Backups in
  `~/nginx-backup-20261123/` auf der VM, Proxmox-Snapshot
  `pre-sec-hardening-20261123` (VM 1078, Node ceph-1).

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

Global in `/etc/nginx/nginx.conf`: `server_tokens off;`.

Security-Header-Snippet (`/etc/nginx/snippets/security-headers.conf`,
einbindbar auf Server- und Location-Ebene):

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" always;
```

Primär-Site (`/etc/nginx/sites-available/balticbrain`), Stand 23.11.2026:

```nginx
server {
    listen 80 default_server;
    server_name balticbrain-dmz _;          # blanker Host/IP -> plain HTTP
    root /var/www/balticbrain;
    index index.html;
    include snippets/security-headers.conf;   # kein HSTS auf Port 80
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

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    include snippets/security-headers.conf;

    location / { try_files $uri $uri/ =404; }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;

    location ~* \.(css|js|svg|png|jpg|jpeg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
        # eigener add_header -> Server-Header erben nicht: erneut einbinden
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        include snippets/security-headers.conf;
    }
}
```

Redirect-Vhosts (`/etc/nginx/sites-available/redirect-balticbrain.{com,cloud,org}`,
je Domäne analog; HSTS hier ohne `preload`):

```nginx
server {
    listen 80;
    server_name balticbrain.com www.balticbrain.com;
    return 301 https://balticbrain.ai$request_uri;
}
server {
    listen 443 ssl;
    http2 on;
    server_name balticbrain.com www.balticbrain.com;
    ssl_certificate     /home/vmuser/certs/balticbrain/fullchain.pem;
    ssl_certificate_key /home/vmuser/certs/balticbrain/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    include snippets/security-headers.conf;
    return 301 https://balticbrain.ai$request_uri;
}
```

## Offene Punkte

1. **Firewall:** Freigabe 80/443 **vom Internet** zur VM liegt bei der IT-SC
   (Server-FAQ #133568, Ticket #209567). Serverseitig ist alles fertig; nach
   der Freigabe ist `https://balticbrain.ai` ohne weiteres Zutun live.
2. **Legacy `brain.vahl.de`:** zeigt noch per CNAME auf GitHub Pages
   (`mafasi.github.io`). Entscheiden, ob die Alt-Domain auf
   `https://balticbrain.ai` umgezogen wird (DNS + `CNAME`-Datei im Repo).
3. **HSTS-Preload:** `https://balticbrain.ai` sendet bereits den
   `preload`-Header; die tatsächliche Aufnahme in die Preload-Liste
   erfordert die bewusste Einreichung auf
   [hstspreload.org](https://hstspreload.org) (dauerhafte HTTPS-Pflicht für
   alle Subdomains der Domäne — vorher abwägen).
4. **Kernel-Reboot nach Roll:** `unattended-upgrades` installiert neue
   Kernel-Pakete automatisch; ein Auto-Reboot ist bewusst nicht konfiguriert.
   Nach Auftauchen von `reboot-required` (per Wazuh/Icinga beobachten)
   die VM zeitnah neu starten, damit gefixte Kernel aktiv werden.
