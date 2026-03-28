<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**AI로 Yida 로우코드 플랫폼을 구동 — 설정 없이 즉시 배포.**

[시작하기](#시작하기) · [CLI 명령어](#cli-명령어-목록) · [데모](#데모) · [기여 가이드](./CONTRIBUTING.md) · [변경 로그](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**언어：**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## 시작하기

```bash
npm install -g openyida
```

**설정 없이 바로 사용.** 설치 후 Claude Code / OpenCode / Aone Copilot에서 바로 대화하세요:

```
Yida로 칩 생산 전 과정을 관리하는 IPD 시스템 만들어줘
CRM 시스템 구축해줘
개인 급여 계산기 앱 만들어줘
```

---

## 지원하는 AI 코딩 도구

| 도구 | 지원 상태 |
|------|-----------|
| [Claude Code](https://claude.ai/code) | ✅ 완전 지원 |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ 완전 지원 |
| [OpenCode](https://opencode.ai) | ✅ 완전 지원 |
| [Cursor](https://cursor.com/) | ✅ 완전 지원 |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ 완전 지원 |
| [Qoder](https://qoder.com) | ✅ 완전 지원 |
| [Wukong](https://dingtalk.com/wukong) | ✅ 완전 지원 |

---

## 다른 AI 앱 빌더와의 차이점

| 항목 | OpenYida | 다른 AI 앱 빌더 |
|------|----------|----------------|
| 대상 사용자 | 개발자 (코드를 아는 사람) | 비즈니스 사용자 (비개발자) |
| 상호작용 | 자연어 + AI 채팅 | 시각적 드래그 앤 드롭 |
| 결과물 | Yida 앱 (편집 가능, 완전한 로우코드 기능) | 설정 (블랙박스 실행) |
| 배포 | Yida 플랫폼 | SaaS 플랫폼 고정 |
| AI 모델 | 최적 모델 자유 선택 | 플랫폼 지정, 변경 불가 |
| 보안 및 규정 준수 | Yida 엔터프라이즈급 보안 | 플랫폼 의존 |

---

## 요구 사항

| 의존성 | 버전 | 용도 |
|--------|------|------|
| Node.js | ≥ 18 | CLI 실행 및 페이지 배포 |

---

## CLI 명령어 목록

```bash
openyida append-chart         # 기존 보고서에 차트 추가
openyida auth                 # 로그인 상태 관리 (status/login/refresh/logout)
openyida cdn-config           # CDN 이미지 업로드 설정 (Aliyun OSS + CDN)
openyida cdn-refresh          # CDN 캐시 갱신
openyida cdn-upload           # CDN에 이미지 업로드
openyida configure-process    # 프로세스 규칙 설정 및 배포
openyida connector            # HTTP 커넥터 관리
openyida copy                 # 현재 AI 도구 환경에 project 디렉토리 초기화
openyida create-app           # Yida 앱 생성
openyida create-form          # 폼 페이지 생성 / 업데이트
openyida create-page          # 커스텀 표시 페이지 생성
openyida create-process       # 프로세스 폼 생성 (통합형)
openyida create-report        # Yida 보고서 생성
openyida data                 # 통합 데이터 관리 (폼/프로세스/작업/서브폼)
openyida doctor               # 환경 진단 및 자동 복구
openyida env                  # 현재 AI 도구 환경 및 로그인 상태 확인
openyida export               # 앱 마이그레이션 패키지 내보내기
openyida get-page-config      # 페이지 공개 접근 / 공유 설정 조회
openyida get-permission       # 폼 권한 설정 조회
openyida get-schema           # 폼 스키마 가져오기
openyida import               # 마이그레이션 패키지 가져와 앱 재구축
openyida login                # Yida 로그인 (캐시 우선, 없으면 QR 코드)
openyida logout               # 로그아웃 / 계정 전환
openyida org                  # 조직 관리 (list/switch)
openyida publish              # 커스텀 페이지 컴파일 및 배포
openyida query-data           # 폼 인스턴스 데이터 조회
openyida save-permission      # 폼 권한 설정 저장
openyida save-share-config    # 공개 접근 / 공유 설정 저장
openyida update-form-config   # 폼 설정 업데이트
openyida verify-short-url     # 단축 URL 사용 가능 여부 확인
```

---

## 데모

### 🏢 비즈니스 시스템 — IPD / CRM

한 문장으로 요구사항을 설명하면 AI가 완전한 멀티 폼 비즈니스 시스템을 자동 생성.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 유틸리티 — 개인 급여 계산기

![급여 계산기](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 랜딩 페이지 — 엔터프라이즈 협업

한 문장으로 완전한 엔터프라이즈 제품 랜딩 페이지 생성.

![엔터프라이즈 협업](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 캠페인 — 등불 수수께끼 게임

AI가 수수께끼 이미지를 생성하고 사용자가 답을 맞추는 게임. 틀리면 AI의 유머러스한 피드백.

![등불 수수께끼 게임](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## 자주 쓰는 프롬프트

```
[xxx] 앱 만들어줘
이 요구사항 문서로 앱 생성해줘
[xxx] 폼 페이지 만들어줘
[xxx] 페이지에 [xxx] 필드 추가해줘, 필드명: [이름], 타입: [타입]
[xxx] 페이지의 [xxx] 필드를 필수로 만들어줘
[xxx] 페이지 배포해줘
페이지를 공개 접근 가능하게 만들어줘
재로그인 / 로그아웃
```

---

## OpenClaw 연동

OpenClaw에서 [yida-app](https://clawhub.ai/nicky1108/yida-app)을 통해 사용:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## 커뮤니티

DingTalk QR 코드를 스캔하여 OpenYida 사용자 그룹에 참여하고 최신 소식과 지원을 받으세요.

![OpenYida 커뮤니티 참여](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## 기여자

OpenYida에 기여해주신 모든 분들께 감사드립니다! [기여 가이드](./CONTRIBUTING.md)를 읽고 함께 만들어가요.

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

## 라이선스

[MIT](./LICENSE) © 2026 Alibaba Group
