<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Construisez des applications Yida low-code avec l'IA — zéro configuration, déploiement instantané.**

[Démarrer](#démarrer) · [Commandes CLI](#commandes-cli) · [Démo](#démo) · [Contribuer](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Langues :**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## Démarrer

```bash
npm install -g openyida
```

**Zéro configuration, prêt à l'emploi.** Après l'installation, discutez directement dans Claude Code / OpenCode / Aone Copilot :

```
Crée-moi un système IPD sur Yida pour gérer le flux de production de puces
Construis-moi un CRM
Crée une application de calcul de salaire personnel
```

---

## Outils IA supportés

| Outil | Statut |
|-------|--------|
| [Claude Code](https://claude.ai/code) | ✅ Support complet |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Support complet |
| [OpenCode](https://opencode.ai) | ✅ Support complet |
| [Cursor](https://cursor.com/) | ✅ Support complet |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Support complet |
| [Qoder](https://qoder.com) | ✅ Support complet |
| [Wukong](https://dingtalk.com/wukong) | ✅ Support complet |

---

## Différences avec les autres constructeurs d'applications IA

| Dimension | OpenYida | Autres constructeurs IA |
|-----------|----------|------------------------|
| Utilisateurs cibles | Développeurs (sachant coder) | Utilisateurs métier (non-développeurs) |
| Interaction | Langage naturel + chat IA | Glisser-déposer visuel |
| Résultat | Application Yida (modifiable, capacités low-code complètes) | Configuration (exécution boîte noire) |
| Déploiement | Plateforme Yida | Verrouillé sur plateforme SaaS |
| Modèle IA | Choisissez le meilleur modèle | Imposé par la plateforme |
| Sécurité | Sécurité enterprise-grade de Yida | Dépend de la plateforme |

---

## Prérequis

| Dépendance | Version | Usage |
|------------|---------|-------|
| Node.js | ≥ 18 | Exécution CLI et publication de pages |

---

## Commandes CLI

```bash
openyida append-chart         # Ajouter un graphique à un rapport existant
openyida auth                 # Gestion du statut de connexion (status/login/refresh/logout)
openyida cdn-config           # Configurer l'upload d'images CDN (Aliyun OSS + CDN)
openyida cdn-refresh          # Rafraîchir le cache CDN
openyida cdn-upload           # Uploader des images vers le CDN
openyida configure-process    # Configurer et publier les règles de processus
openyida connector            # Gestion des connecteurs HTTP
openyida copy                 # Initialiser le répertoire project pour l'outil IA actuel
openyida create-app           # Créer une application Yida
openyida create-form          # Créer / mettre à jour une page de formulaire
openyida create-page          # Créer une page d'affichage personnalisée
openyida create-process       # Créer un formulaire de processus (intégré)
openyida create-report        # Créer un rapport Yida
openyida data                 # Gestion unifiée des données (formulaire/processus/tâche/sous-formulaire)
openyida doctor               # Diagnostic d'environnement et réparation automatique
openyida env                  # Détecter l'environnement IA actuel et le statut de connexion
openyida export               # Exporter le package de migration d'application
openyida get-page-config      # Consulter la config d'accès public / partage d'une page
openyida get-permission       # Consulter la configuration des permissions du formulaire
openyida get-schema           # Récupérer le schéma de formulaire
openyida import               # Importer le package de migration pour reconstruire l'application
openyida login                # Se connecter à Yida (cache en priorité, sinon QR code)
openyida logout               # Se déconnecter / changer de compte
openyida org                  # Gestion des organisations (list/switch)
openyida publish              # Compiler et publier une page personnalisée
openyida query-data           # Consulter les données d'instance de formulaire
openyida save-permission      # Sauvegarder la configuration des permissions du formulaire
openyida save-share-config    # Sauvegarder la config d'accès public / partage
openyida update-form-config   # Mettre à jour la configuration du formulaire
openyida verify-short-url     # Vérifier si une URL courte est accessible
```

---

## Démo

### 🏢 Systèmes métier — IPD / CRM

Décrivez vos besoins en une phrase — l'IA génère automatiquement un système métier complet multi-formulaires.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 Utilitaires — Calculateur de salaire

![Calculateur de salaire](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — Collaboration d'entreprise

Générez une landing page produit complète en une seule phrase.

![Collaboration d'entreprise](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 Campagnes — Jeu de devinettes de lanternes

L'IA génère des images d'énigmes, les utilisateurs devinent les réponses avec des retours humoristiques en cas d'erreur.

![Jeu de devinettes](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## Prompts courants

```
Construis-moi une application [xxx]
Génère une application depuis ce document de spécifications
Crée une page de formulaire [xxx]
Ajoute un champ [xxx] à la page [xxx], nom du champ : [nom], type : [type]
Rends le champ [xxx] de la page [xxx] obligatoire
Publie la page [xxx]
Rends la page accessible publiquement
Se reconnecter / se déconnecter
```

---

## Intégration OpenClaw

Utilisez via [yida-app](https://clawhub.ai/nicky1108/yida-app) dans OpenClaw :

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## Communauté

Scannez le QR code pour rejoindre le groupe d'utilisateurs OpenYida sur DingTalk.

![Rejoindre la communauté OpenYida](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## Contributeurs

Merci à tous ceux qui ont contribué à OpenYida ! Lisez le [Guide de contribution](./CONTRIBUTING.md) pour participer.

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

## Licence

[MIT](./LICENSE) © 2026 Alibaba Group
