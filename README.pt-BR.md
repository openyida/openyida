<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Crie aplicativos Yida low-code com IA — zero configuração, deploy instantâneo.**

[Começar](#começar) · [Comandos CLI](#comandos-cli) · [Demo](#demo) · [Contribuir](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Idiomas:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## Começar

```bash
npm install -g openyida
```

**Zero configuração, pronto para usar.** Após a instalação, converse diretamente no Claude Code / OpenCode / Aone Copilot:

```
Crie um sistema IPD no Yida para gerenciar todo o fluxo de produção de chips
Construa um CRM
Crie um aplicativo de calculadora de salário pessoal
```

---

## Ferramentas de IA suportadas

| Ferramenta | Status |
|------------|--------|
| [Claude Code](https://claude.ai/code) | ✅ Suporte completo |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Suporte completo |
| [OpenCode](https://opencode.ai) | ✅ Suporte completo |
| [Cursor](https://cursor.com/) | ✅ Suporte completo |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Suporte completo |
| [Qoder](https://qoder.com) | ✅ Suporte completo |
| [Wukong](https://dingtalk.com/wukong) | ✅ Suporte completo |

---

## Diferenças em relação a outros construtores de apps IA

| Dimensão | OpenYida | Outros construtores IA |
|----------|----------|------------------------|
| Usuários-alvo | Desenvolvedores (que sabem programar) | Usuários de negócio (não desenvolvedores) |
| Interação | Linguagem natural + chat IA | Arrastar e soltar visual |
| Resultado | App Yida (editável, capacidades low-code completas) | Configuração (execução caixa-preta) |
| Deploy | Plataforma Yida | Bloqueado em plataforma SaaS |
| Modelo IA | Escolha o melhor modelo livremente | Especificado pela plataforma |
| Segurança | Segurança enterprise-grade do Yida | Depende da plataforma |

---

## Requisitos

| Dependência | Versão | Propósito |
|-------------|--------|-----------|
| Node.js | ≥ 18 | Execução CLI e publicação de páginas |

---

## Comandos CLI

```bash
openyida append-chart         # Adicionar gráfico a um relatório existente
openyida auth                 # Gerenciamento de status de login (status/login/refresh/logout)
openyida cdn-config           # Configurar upload de imagens CDN (Aliyun OSS + CDN)
openyida cdn-refresh          # Atualizar cache do CDN
openyida cdn-upload           # Fazer upload de imagens para o CDN
openyida configure-process    # Configurar e publicar regras de processo
openyida connector            # Gerenciamento de conectores HTTP
openyida copy                 # Inicializar diretório project para a ferramenta IA atual
openyida create-app           # Criar um aplicativo Yida
openyida create-form          # Criar / atualizar uma página de formulário
openyida create-page          # Criar uma página de exibição personalizada
openyida create-process       # Criar um formulário de processo (integrado)
openyida create-report        # Criar um relatório Yida
openyida data                 # Gerenciamento de dados unificado (formulário/processo/tarefa/subformulário)
openyida doctor               # Diagnóstico de ambiente e reparo automático
openyida env                  # Detectar o ambiente da ferramenta IA atual e status de login
openyida export               # Exportar pacote de migração de aplicativo
openyida get-page-config      # Consultar configuração de acesso público / compartilhamento de uma página
openyida get-permission       # Consultar configuração de permissões do formulário
openyida get-schema           # Obter o schema do formulário
openyida import               # Importar pacote de migração para reconstruir aplicativo
openyida login                # Fazer login no Yida (cache primeiro, senão QR code)
openyida logout               # Fazer logout / trocar conta
openyida org                  # Gerenciamento de organização (list/switch)
openyida publish              # Compilar e publicar uma página personalizada
openyida query-data           # Consultar dados de instância de formulário
openyida save-permission      # Salvar configuração de permissões do formulário
openyida save-share-config    # Salvar configuração de acesso público / compartilhamento
openyida update-form-config   # Atualizar configuração do formulário
openyida verify-short-url     # Verificar se uma URL curta está acessível
```

---

## Demo

### 🏢 Sistemas de negócio — IPD / CRM

Descreva seus requisitos em uma frase — a IA gera automaticamente um sistema de negócio multi-formulário completo.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 Utilitários — Calculadora de salário pessoal

![Calculadora de salário](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — Colaboração empresarial

Gere uma landing page de produto empresarial completa a partir de uma única frase.

![Colaboração empresarial](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 Campanhas — Jogo de adivinhação de lanternas

A IA gera imagens de enigmas, os usuários adivinham as respostas com feedback humorístico da IA quando erram.

![Jogo de adivinhação](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## Prompts comuns

```
Construa um aplicativo [xxx]
Gere um app a partir deste documento de requisitos
Crie uma página de formulário [xxx]
Adicione um campo [xxx] à página [xxx], nome do campo: [nome], tipo: [tipo]
Torne o campo [xxx] da página [xxx] obrigatório
Publique a página [xxx]
Torne a página acessível publicamente
Fazer login novamente / fazer logout
```

---

## Integração com OpenClaw

Use via [yida-app](https://clawhub.ai/nicky1108/yida-app) no OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## Comunidade

Escaneie o QR code para entrar no grupo de usuários do OpenYida no DingTalk.

![Entrar na comunidade OpenYida](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## Contribuidores

Obrigado a todos que contribuíram para o OpenYida! Leia o [Guia de contribuição](./CONTRIBUTING.md) para participar.

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

## Licença

[MIT](./LICENSE) © 2026 Alibaba Group
