<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Yida Low-Code-Apps mit KI erstellen — keine Konfiguration, sofortiges Deployment.**

[Loslegen](#loslegen) · [CLI-Befehle](#cli-befehle) · [Demo](#demo) · [Beitragen](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Sprachen:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## Loslegen

```bash
npm install -g openyida
```

**Keine Konfiguration, sofort einsatzbereit.** Nach der Installation einfach in Claude Code / OpenCode / Aone Copilot chatten:

```
Erstelle mir ein IPD-System auf Yida zur Verwaltung des gesamten Chip-Produktionsprozesses
Baue mir ein CRM
Erstelle eine persönliche Gehaltsrechner-App
```

---

## Unterstützte KI-Coding-Tools

| Tool | Status |
|------|--------|
| [Claude Code](https://claude.ai/code) | ✅ Vollständig unterstützt |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Vollständig unterstützt |
| [OpenCode](https://opencode.ai) | ✅ Vollständig unterstützt |
| [Cursor](https://cursor.com/) | ✅ Vollständig unterstützt |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Vollständig unterstützt |
| [Qoder](https://qoder.com) | ✅ Vollständig unterstützt |
| [Wukong](https://dingtalk.com/wukong) | ✅ Vollständig unterstützt |

---

## Unterschiede zu anderen KI-App-Buildern

| Dimension | OpenYida | Andere KI-App-Builder |
|-----------|----------|-----------------------|
| Zielgruppe | Entwickler (mit Programmierkenntnissen) | Business-Nutzer (Nicht-Entwickler) |
| Interaktion | Natürliche Sprache + KI-Chat | Visuelles Drag-and-Drop |
| Ergebnis | Yida-App (bearbeitbar, vollständige Low-Code-Funktionen) | Konfiguration (Black-Box-Ausführung) |
| Deployment | Yida-Plattform | An SaaS-Plattform gebunden |
| KI-Modell | Bestes Modell frei wählbar | Plattformvorgabe, nicht änderbar |
| Sicherheit | Yidas Enterprise-Sicherheit | Plattformabhängig |

---

## Voraussetzungen

| Abhängigkeit | Version | Zweck |
|--------------|---------|-------|
| Node.js | ≥ 18 | CLI-Ausführung und Seitenveröffentlichung |

---

## CLI-Befehle

```bash
openyida append-chart         # Diagramm zu bestehendem Bericht hinzufügen
openyida auth                 # Login-Status verwalten (status/login/refresh/logout)
openyida cdn-config           # CDN-Bild-Upload konfigurieren (Aliyun OSS + CDN)
openyida cdn-refresh          # CDN-Cache aktualisieren
openyida cdn-upload           # Bilder zum CDN hochladen
openyida configure-process    # Prozessregeln konfigurieren und veröffentlichen
openyida connector            # HTTP-Connector-Verwaltung
openyida copy                 # Project-Verzeichnis für aktuelles KI-Tool initialisieren
openyida create-app           # Yida-App erstellen
openyida create-form          # Formularseite erstellen / aktualisieren
openyida create-page          # Benutzerdefinierte Anzeigeseite erstellen
openyida create-process       # Prozessformular erstellen (integriert)
openyida create-report        # Yida-Bericht erstellen
openyida data                 # Einheitliche Datenverwaltung (Formular/Prozess/Aufgabe/Unterformular)
openyida doctor               # Umgebungsdiagnose und automatische Reparatur
openyida env                  # Aktuelle KI-Tool-Umgebung und Login-Status erkennen
openyida export               # App-Migrationspaket exportieren
openyida get-page-config      # Öffentlichen Zugang / Freigabe-Konfiguration einer Seite abfragen
openyida get-permission       # Formular-Berechtigungskonfiguration abfragen
openyida get-schema           # Formular-Schema abrufen
openyida import               # Migrationspaket importieren und App neu erstellen
openyida login                # Bei Yida anmelden (Cache bevorzugt, sonst QR-Code)
openyida logout               # Abmelden / Konto wechseln
openyida org                  # Organisationsverwaltung (list/switch)
openyida publish              # Benutzerdefinierte Seite kompilieren und veröffentlichen
openyida query-data           # Formularinstanzdaten abfragen
openyida save-permission      # Formular-Berechtigungskonfiguration speichern
openyida save-share-config    # Öffentlichen Zugang / Freigabe-Konfiguration speichern
openyida update-form-config   # Formularkonfiguration aktualisieren
openyida verify-short-url     # Prüfen ob eine Kurz-URL erreichbar ist
```

---

## Demo

### 🏢 Geschäftssysteme — IPD / CRM

Beschreiben Sie Ihre Anforderungen in einem Satz — KI generiert automatisch ein vollständiges Multi-Formular-Geschäftssystem.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 Hilfsprogramme — Persönlicher Gehaltsrechner

![Gehaltsrechner](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — Unternehmenskooperation

Generieren Sie eine vollständige Unternehmens-Produkt-Landing-Page aus einem einzigen Satz.

![Unternehmenskooperation](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 Kampagnen — Laternen-Rätsel-Spiel

KI generiert Rätselbilder, Nutzer raten die Antworten mit humorvollem KI-Feedback bei falschen Antworten.

![Laternen-Rätsel-Spiel](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## Häufige Prompts

```
Erstelle mir eine [xxx]-Anwendung
Generiere eine App aus diesem Anforderungsdokument
Erstelle eine [xxx]-Formularseite
Füge ein [xxx]-Feld zur [xxx]-Seite hinzu, Feldname: [Name], Typ: [Typ]
Mache das [xxx]-Feld auf der [xxx]-Seite erforderlich
Veröffentliche die [xxx]-Seite
Mache die Seite öffentlich zugänglich
Erneut anmelden / abmelden
```

---

## OpenClaw-Integration

Verwenden Sie über [yida-app](https://clawhub.ai/nicky1108/yida-app) in OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## Community

Scannen Sie den QR-Code, um der OpenYida-Benutzergruppe auf DingTalk beizutreten.

![OpenYida-Community beitreten](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## Mitwirkende

Danke an alle, die zu OpenYida beigetragen haben! Lesen Sie den [Beitragsleitfaden](./CONTRIBUTING.md).

<p align="left">
  <a href="https://github.com/yize"><img src="https://avatars.githubusercontent.com/u/1578814?v=4&s=48" width="48" height="48" alt="九神" title="九神"/></a>
  <a href="https://github.com/alex-mm"><img src="https://avatars.githubusercontent.com/u/3302053?v=4&s=48" width="48" height="48" alt="天晟" title="天晟"/></a>
  <a href="https://github.com/nicky1108"><img src="https://avatars.githubusercontent.com/u/4279283?v=4&s=48" width="48" height="48" alt="nicky1108" title="nicky1108"/></a>
  <a href="https://github.com/angelinheys"><img src="https://avatars.githubusercontent.com/u/49426983?v=4&s=48" width="48" height="48" alt="angelinheys" title="angelinheys"/></a>
  <a href="https://github.com/yipengmu"><img src="https://avatars.githubusercontent.com/u/3232735?v=4&s=48" width="48" height="48" alt="yipengmu" title="yipengmu"/></a>
  <a href="https://github.com/Waawww"><img src="https://avatars.githubusercontent.com/u/31886449?v=4&s=48" width="48" height="48" alt="Waawww" title="Waawww"/></a>
  <a href="https://github.com/kangjiano"><img src="https://avatars.githubusercontent.com/u/54129385?v=4&s=48" width="48" height="48" alt="kangjiano" title="kangjiano"/></a>
  <a href="https://github.com/ElZe98"><img src="https://avatars.githubusercontent.com/u/35736727?v=4&s=48" width="48" height="48" alt="ElZe98" title="ElZe98"/></a>
  <a href="https://github.com/OAHyuhao"><img src="https://avatars.githubusercontent.com/u/99954323?v=4&s=48" width="48" height="48" alt="OAHyuhao" title="OAHyuhao"/></a>
  <a href="https://github.com/xiaofu704"><img src="https://avatars.githubusercontent.com/u/209416122?v=4&s=48" width="48" height="48" alt="xiaofu704" title="xiaofu704"/></a>
  <a href="https://github.com/guchenglin111"><img src="https://avatars.githubusercontent.com/u/10860875?v=4&s=48" width="48" height="48" alt="guchenglin111" title="guchenglin111"/></a>
  <a href="https://github.com/liug0911"><img src="https://avatars.githubusercontent.com/u/1578814?v=4&s=48" width="48" height="48" alt="LIUG" title="LIUG"/></a>
  <a href="https://github.com/sunliz-xiuli"><img src="https://avatars.githubusercontent.com/u/76982855?v=4&s=48" width="48" height="48" alt="sunliz-xiuli" title="sunliz-xiuli"/></a>
  <a href="https://github.com/M12REDX"><img src="https://avatars.githubusercontent.com/u/22703542?v=4&s=48" width="48" height="48" alt="M12REDX" title="M12REDX"/></a>
</p>

---

## Lizenz

[MIT](./LICENSE) © 2026 Alibaba Group
