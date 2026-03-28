<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Crea aplicaciones Yida low-code con IA — cero configuración, despliegue instantáneo.**

[Comenzar](#comenzar) · [Comandos CLI](#comandos-cli) · [Demo](#demo) · [Contribuir](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Idiomas:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## Comenzar

```bash
npm install -g openyida
```

**Cero configuración, listo para usar.** Después de la instalación, chatea directamente en Claude Code / OpenCode / Aone Copilot:

```
Crea un sistema IPD en Yida para gestionar el flujo completo de producción de chips
Construye un CRM
Crea una aplicación de calculadora de salario personal
```

---

## Herramientas de IA compatibles

| Herramienta | Estado |
|-------------|--------|
| [Claude Code](https://claude.ai/code) | ✅ Soporte completo |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Soporte completo |
| [OpenCode](https://opencode.ai) | ✅ Soporte completo |
| [Cursor](https://cursor.com/) | ✅ Soporte completo |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Soporte completo |
| [Qoder](https://qoder.com) | ✅ Soporte completo |
| [Wukong](https://dingtalk.com/wukong) | ✅ Soporte completo |

---

## Diferencias con otros constructores de apps IA

| Dimensión | OpenYida | Otros constructores IA |
|-----------|----------|------------------------|
| Usuarios objetivo | Desarrolladores (con conocimientos de código) | Usuarios de negocio (no desarrolladores) |
| Interacción | Lenguaje natural + chat IA | Arrastrar y soltar visual |
| Resultado | App Yida (editable, capacidades low-code completas) | Configuración (ejecución caja negra) |
| Despliegue | Plataforma Yida | Bloqueado en plataforma SaaS |
| Modelo IA | Elige el mejor modelo libremente | Especificado por la plataforma |
| Seguridad | Seguridad enterprise-grade de Yida | Depende de la plataforma |

---

## Requisitos

| Dependencia | Versión | Propósito |
|-------------|---------|-----------|
| Node.js | ≥ 18 | Ejecución CLI y publicación de páginas |

---

## Comandos CLI

```bash
openyida append-chart         # Agregar gráfico a un informe existente
openyida auth                 # Gestión del estado de login (status/login/refresh/logout)
openyida cdn-config           # Configurar carga de imágenes CDN (Aliyun OSS + CDN)
openyida cdn-refresh          # Actualizar caché del CDN
openyida cdn-upload           # Subir imágenes al CDN
openyida configure-process    # Configurar y publicar reglas de proceso
openyida connector            # Gestión de conectores HTTP
openyida copy                 # Inicializar directorio project para la herramienta IA actual
openyida create-app           # Crear una aplicación Yida
openyida create-form          # Crear / actualizar una página de formulario
openyida create-page          # Crear una página de visualización personalizada
openyida create-process       # Crear un formulario de proceso (integrado)
openyida create-report        # Crear un informe Yida
openyida data                 # Gestión de datos unificada (formulario/proceso/tarea/subformulario)
openyida doctor               # Diagnóstico de entorno y reparación automática
openyida env                  # Detectar el entorno de herramienta IA actual y estado de login
openyida export               # Exportar paquete de migración de aplicación
openyida get-page-config      # Consultar configuración de acceso público / compartir de una página
openyida get-permission       # Consultar configuración de permisos del formulario
openyida get-schema           # Obtener el esquema del formulario
openyida import               # Importar paquete de migración para reconstruir aplicación
openyida login                # Iniciar sesión en Yida (caché primero, si no QR code)
openyida logout               # Cerrar sesión / cambiar cuenta
openyida org                  # Gestión de organización (list/switch)
openyida publish              # Compilar y publicar una página personalizada
openyida query-data           # Consultar datos de instancia de formulario
openyida save-permission      # Guardar configuración de permisos del formulario
openyida save-share-config    # Guardar configuración de acceso público / compartir
openyida update-form-config   # Actualizar configuración del formulario
openyida verify-short-url     # Verificar si una URL corta es accesible
```

---

## Demo

### 🏢 Sistemas de negocio — IPD / CRM

Describe tus requisitos en una frase — la IA genera automáticamente un sistema de negocio multi-formulario completo.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 Utilidades — Calculadora de salario personal

![Calculadora de salario](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — Colaboración empresarial

Genera una landing page de producto empresarial completa desde una sola frase.

![Colaboración empresarial](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 Campañas — Juego de adivinanzas de linternas

La IA genera imágenes de acertijos, los usuarios adivinan las respuestas con retroalimentación humorística de la IA.

![Juego de adivinanzas](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## Prompts habituales

```
Construye una aplicación [xxx]
Genera una app desde este documento de requisitos
Crea una página de formulario [xxx]
Añade un campo [xxx] a la página [xxx], nombre del campo: [nombre], tipo: [tipo]
Haz que el campo [xxx] de la página [xxx] sea obligatorio
Publica la página [xxx]
Haz la página accesible públicamente
Volver a iniciar sesión / cerrar sesión
```

---

## Integración con OpenClaw

Usa a través de [yida-app](https://clawhub.ai/nicky1108/yida-app) en OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## Comunidad

Escanea el código QR para unirte al grupo de usuarios de OpenYida en DingTalk.

![Únete a la comunidad OpenYida](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## Colaboradores

¡Gracias a todos los que han contribuido a OpenYida! Lee la [Guía de contribución](./CONTRIBUTING.md) para participar.

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

## Licencia

[MIT](./LICENSE) © 2026 Alibaba Group
