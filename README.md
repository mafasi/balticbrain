# Baltic Brain · Fraunhofer IGD

Erster Entwurf eines deutschsprachigen Onepagers für die KI-Forschungsinfrastruktur Baltic Brain. Die Seite unterstützt GitHub Pages und GitLab Pages und verwendet ausschließlich statisches HTML, CSS und JavaScript. Ein Build und zusätzliche Abhängigkeiten sind nicht erforderlich.

## Lokal ansehen

`index.html` direkt im Browser öffnen oder im Repository einen lokalen Webserver starten:

```sh
python3 -m http.server 8000
```

Danach `http://localhost:8000` aufrufen.

## GitHub Pages

Nach dem Commit und Push in GitHub unter **Settings → Pages → Build and deployment** die Quelle **Deploy from a branch**, den Branch **main** und das Verzeichnis **/ (root)** auswählen. Die Datei `.nojekyll` erlaubt die direkte Auslieferung ohne Jekyll.

Alle lokalen Links sind relativ. Damit funktioniert die Seite sowohl unter einem Repository-Pfad wie `/balticbrain/` als auch unter einer eigenen Domain. Eine Domain wird durch diesen Entwurf nicht konfiguriert.

## GitLab Pages

Die folgende Konfiguration setzt GitLab **17.10 oder neuer**, aktiviertes GitLab Pages und einen verfügbaren CI/CD-Runner mit Unterstützung für Container-Images voraus. Auf einer eigenen GitLab-Instanz werden Pages und Runner gegebenenfalls durch die Administration bereitgestellt. Die Dateien aus diesem Repository (`./site` im übergeordneten Workspace) müssen im Wurzelverzeichnis des GitLab-Repositories liegen.

1. In GitLab ein leeres Projekt anlegen oder das bestehende Repository importieren.
2. Neben `index.html` eine Datei `.gitlab-ci.yml` mit folgendem Inhalt anlegen. Das Beispiel ist hier dokumentiert; eine CI-Datei ist noch nicht im Repository enthalten.

```yaml
deploy-pages:
  image: alpine:3
  stage: deploy
  script:
    - mkdir -p public
    - cp index.html styles.css script.js public/
    - cp -R assets public/assets
  pages:
    publish: public
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
```

Der Job kopiert die Webseite einschließlich Bildern und PDF-Downloads nach `public/` und veröffentlicht diesen Ordner. Ab GitLab 17.10 wird er automatisch als Pages-Artefakt übernommen. Die Pipeline veröffentlicht nur den Standardbranch des GitLab-Projekts, üblicherweise `main`. Die relativen Links funktionieren auch unter einem GitLab-Pages-Projektpfad.

3. Die CI-Datei committen und den Branch nach GitLab pushen. Wenn `origin` weiterhin auf GitHub zeigt, kann ein zusätzliches Remote `gitlab` verwendet werden. `<GITLAB-CLONE-URL>` durch die im GitLab-Projekt angezeigte SSH- oder HTTPS-Clone-URL ersetzen:

```sh
git add .gitlab-ci.yml
git commit -m "Configure GitLab Pages"
git remote add gitlab '<GITLAB-CLONE-URL>'
git push gitlab main
```

Ist das Remote `gitlab` bereits eingerichtet, entfällt `git remote add`. Bei einem anderen Standardbranch den Branchnamen im Push-Befehl entsprechend anpassen.

4. Unter **Build → Pipelines** den Job `deploy-pages` verfolgen. Nach erfolgreicher Veröffentlichung steht die tatsächliche Website-URL unter **Deploy → Pages**. Weitere Pushes in den Standardbranch aktualisieren die Seite automatisch.

Bleibt der Job auf `pending`, unter **Settings → CI/CD → Runners** die verfügbaren Runner und gegebenenfalls erforderliche Runner-Tags prüfen. Die YAML-Konfiguration lässt sich im GitLab-Pipeline-Editor mit **CI Lint** validieren.

Weitere Details: [GitLab-Pages-Anleitung](https://docs.gitlab.com/user/project/pages/getting_started/pages_from_scratch/), [Pages-Voraussetzungen](https://docs.gitlab.com/user/project/pages/introduction/#gitlab-pages-requirements) und [Referenz zu `pages.publish`](https://docs.gitlab.com/ci/yaml/#pagespublish).

## Inhalte und Gestaltung

- `index.html`: Texte, Navigation, Hardwaredaten, FAQ, Kontakt und PDF-Links.
- `styles.css`: Fraunhofer-Grün aus der Vorlage, Typografie, Layout, mobile Ansichten und Druckansicht.
- `script.js`: mobiles Menü und Markierung des aktuellen Navigationsabschnitts. Inhalte, FAQs und Kontaktlinks funktionieren auch ohne JavaScript.
- `assets/images/`: bereitgestelltes IGD-Logo als SVG, Rechenzentrumsfoto und Projekt-Favicon.
- `assets/downloads/`: technische Spezifikation und Leistungsblätter für Compute und AI-Act-Beratung.

Die Inhalte und Kapazitätsangaben basieren auf den bereitgestellten Leistungsblättern in `leistung_baltic_brain/leistungsblaetter`, Stand 06.10.2026. Die Webseite und die PDF-Downloads bezeichnen die Plattform als drei NVIDIA DGX B200-Systeme mit insgesamt 24 B200-GPUs und enthalten keine ausdrücklichen Standortangaben. Die Downloads sind entsprechend angepasste Fassungen der Vorlagen. Compute und AI-Act-Beratung bleiben eigenständig beauftragbare Angebote. Preise, Modellkataloge und interne Betriebsadressen werden nicht veröffentlicht.

Die Leistungen werden als neutrale, wissenschaftsgeleitete Zusammenarbeit mit Zugang zu aktuellen Forschungsergebnissen und einem gemeinsamen Transfer in die Anwendung beschrieben. Öffentliche Projektförderung wird als mögliche finanzielle Entlastung geeigneter Innovationsvorhaben eingeordnet. Die Einwerbung wird gemeinsam geprüft; Förderfähigkeit, Eigenanteile und Bewilligung sind programm- und projektabhängig. Es werden keine Förderquoten, laufenden Programme oder Förderzusagen genannt.

Redaktionelle Grundlagen für diese Ergänzungen: [Fraunhofers Grundsätze zur Zusammenarbeit und Neutralität](https://www.fraunhofer.de/de/ueber-fraunhofer/nachhaltigkeit/verantwortung-fuer-unsere-organisation/erklaerungen-zur-zusammenarbeit.html), [Forschung und Entwicklung](https://www.fraunhofer.de/de/forschung/leistungsangebot/forschung-entwicklung.html) und [Forschungskooperationen und öffentliche Förderung am Beispiel Fraunhofer IIS](https://www.iis.fraunhofer.de/de/profil/das-koennen-wir-fuer-sie-tun/zusammenarbeit.html). Die Quellen beschreiben den institutionellen Rahmen; konkrete Leistungen und Förderperspektiven für Baltic Brain werden vorhabenbezogen vereinbart.

Die Gestaltung orientiert sich an der bereitgestellten IGD-Vorlage und der [Institutswebsite](https://www.igd.fraunhofer.de/). Frutiger wird verwendet, wenn die Schrift lokal installiert ist; andernfalls greift eine Systemschrift. Die lizenzierten TTF-Dateien werden nicht als Webfonts übernommen. Es werden keine externen Schrift-, Skript- oder Trackingdienste eingebunden.

Logo, Foto und PDFs stammen aus den bereitgestellten Unterlagen. Die ursprünglichen Rechte gelten weiterhin; dieses Repository erteilt keine zusätzliche Asset-Lizenz. Impressum und Datenschutz verweisen auf die Institutswebsite und sind vor einer Veröffentlichung auf ihre Anwendbarkeit für die gewählte Domain zu prüfen.

Die Veröffentlichung über GitHub Pages oder GitLab Pages erfolgt gesondert.
