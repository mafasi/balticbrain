# Deployment auf balticbrain-dmz · balticbrain.ai / brain.vahl.de

Diese Datei dokumentiert den automatischen Deploy der statischen Website über
GitLab CI auf den zentralen Webserver. Sie richtet sich an Betrieb (doti) und
Projektowner.

## Übersicht

| Punkt | Wert |
| --- | --- |
| Zielserver (VM) | `balticbrain-dmz`, IP `10.53.28.55`, Ubuntu 26.04 |
| Webserver | nginx, Document Root `/var/www/balticbrain`, lauscht auf Port 80 |
| Öffentliche URL | `http://brain.vahl.de` |
| Deploy-User (SSH) | `deploy` |
| Deploy-Inhalt | `index.html`, `styles.css`, `script.js`, `.nojekyll`, `assets/` |
| Deployment | GitLab CI, Job `deploy`, nur bei Push auf `main` |
| Konfiguration im Repo | [`.gitlab-ci.yml`](../.gitlab-ci.yml) (Repo-Root) |

## Ablauf

Die Seite ist rein statisch; es gibt keinen Build-Schritt. Bei jedem Push auf
den Default-Branch `main` lädt der GitLab-Runner das Repository, installiert
`rsync` und `openssh-client` in einem Alpine-Container, schreibt den privaten
Key aus der CI-Variable `BALTICBRAIN_DEPLOY_KEY` in eine temporäre Datei
(`chmod 600`), pinnt den SSH-Host-Key des Ziels per `ssh-keyscan -H 10.53.28.55`
in `known_hosts` und führt anschließend exakt diesen Transfer aus:

```sh
rsync -az --delete \
  -e "ssh -i <keyfile> -o IdentitiesOnly=yes" \
  index.html styles.css script.js .nojekyll assets \
  deploy@10.53.28.55:/
```

Das Zielverzeichnis (`/var/www/balticbrain/`) wird serverseitig durch den forced
command des Deploy-Keys festgelegt. `--delete` hält das Web-Verzeichnis
deckungsgleich mit dem Repository; gelöschte Dateien verschwinden also auch
von der Website.

## CI-Variable `BALTICBRAIN_DEPLOY_KEY` (maskiert, von Owner/doti zu setzen)

Der SSH-Private-Key des Deploy-Users **darf niemals ins Repository committet
werden**. Er wird ausschließlich als geschützte CI/CD-Variable im GitLab-Projekt
hinterlegt (**Settings → CI/CD → Variables**, Zuständigkeit: Projektowner bzw.
doti):

- **Name:** `BALTICBRAIN_DEPLOY_KEY`
- **Wert:** privater SSH-Key des Users `deploy`; **base64-kodiert und damit
  einzeilig**, weil maskierte GitLab-Variablen keine Zeilenumbrüche erlauben:
  ```sh
  base64 -w 0 ~/.ssh/id_ed25519        # GNU/Linux (base64 bricht sonst um)
  openssl base64 -A -in id_ed25519     # alternative, überall verfügbar
  ```
- **Flags:** `masked` (Wert wird in Logs maskiert) **und** `protected` (Key
  steht nur Pipelines auf geschützten Branches, d. h. `main`, zur Verfügung).

Im Job wird der Wert dekodiert und als Key-Datei mit `chmod 600` verwendet.
Passend zum Private-Key liegt auf dem Server der Public-Key des Deploy-Users
in `~deploy/.ssh/authorized_keys` – mit einem forced command, der die Nutzung
auf genau diesen einen rsync-Aufruf einschränkt:

```
rsync --server -vlogDtprze.iLsfx --delete . /var/www/balticbrain/
```

Damit erlaubt der Key selbst bei Kompromittierung nur das Überschreiben des
Webinhalts unterhalb von `/var/www/balticbrain` – keine Shell und keine
anderen Befehle.

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

## Offene Punkte (bei der IT / doti)

1. **DNS:** `brain.vahl.de` muss auf `10.53.28.55` (bzw. die öffentliche
   DMZ-Frontend-IP) zeigen. Liegt bei der IT.
2. **Firewall:** Freigabe 80/443 zur VM in der DMZ. Liegt bei der IT.
3. **Runner-Netzwerkzugriff:** Der GitLab-Runner, der den Job `deploy`
   ausführt, muss per SSH (Port 22) `10.53.28.55` erreichen können. Ist das
   beim Standard-Runner nicht gegeben, bleibt der Job hängen bzw. bricht mit
   Timeout ab. Dann braucht das Projekt einen Runner mit passender
   Netzwerkroute (ggf. via Runner-Tag und `tags:` im Job). Liegt bei der IT.
4. **Krypto/TLS:** Aktuell serviert nginx Port 80 ohne TLS. HTTPS/Redirect auf
   443 mit Zertifikat für `brain.vahl.de` ist ein Folgeschritt, sobald DNS und
   Firewall stehen.
