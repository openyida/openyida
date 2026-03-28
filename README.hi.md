<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**AI के साथ Yida लो-कोड ऐप्स बनाएं — शून्य कॉन्फ़िगरेशन, तत्काल डिप्लॉयमेंट।**

[शुरू करें](#शुरू-करें) · [CLI कमांड](#cli-कमांड) · [डेमो](#डेमो) · [योगदान](./CONTRIBUTING.md) · [चेंजलॉग](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**भाषाएं:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## शुरू करें

```bash
npm install -g openyida
```

**शून्य कॉन्फ़िगरेशन, इंस्टॉल करते ही उपयोग करें।** इंस्टॉलेशन के बाद Claude Code / OpenCode / Aone Copilot में सीधे बात करें:

```
Yida पर चिप उत्पादन की पूरी प्रक्रिया प्रबंधित करने के लिए IPD सिस्टम बनाओ
CRM सिस्टम बनाओ
व्यक्तिगत वेतन कैलकुलेटर ऐप बनाओ
```

---

## समर्थित AI कोडिंग टूल्स

| टूल | स्थिति |
|-----|--------|
| [Claude Code](https://claude.ai/code) | ✅ पूर्ण समर्थन |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ पूर्ण समर्थन |
| [OpenCode](https://opencode.ai) | ✅ पूर्ण समर्थन |
| [Cursor](https://cursor.com/) | ✅ पूर्ण समर्थन |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ पूर्ण समर्थन |
| [Qoder](https://qoder.com) | ✅ पूर्ण समर्थन |
| [Wukong](https://dingtalk.com/wukong) | ✅ पूर्ण समर्थन |

---

## अन्य AI ऐप बिल्डर्स से अंतर

| आयाम | OpenYida | अन्य AI ऐप बिल्डर्स |
|------|----------|---------------------|
| लक्षित उपयोगकर्ता | डेवलपर्स (कोड जानने वाले) | बिज़नेस यूज़र्स (गैर-डेवलपर्स) |
| इंटरैक्शन | प्राकृतिक भाषा + AI चैट | विज़ुअल ड्रैग-एंड-ड्रॉप |
| आउटपुट | Yida ऐप (संपादन योग्य, पूर्ण लो-कोड क्षमताएं) | कॉन्फ़िगरेशन (ब्लैक-बॉक्स निष्पादन) |
| डिप्लॉयमेंट | Yida प्लेटफ़ॉर्म | SaaS प्लेटफ़ॉर्म पर लॉक |
| AI मॉडल | सर्वोत्तम मॉडल स्वतंत्र रूप से चुनें | प्लेटफ़ॉर्म द्वारा निर्दिष्ट |
| सुरक्षा | Yida की एंटरप्राइज़-ग्रेड सुरक्षा | प्लेटफ़ॉर्म पर निर्भर |

---

## आवश्यकताएं

| निर्भरता | संस्करण | उद्देश्य |
|----------|---------|---------|
| Node.js | ≥ 18 | CLI रनटाइम और पेज प्रकाशन |

---

## CLI कमांड

```bash
openyida append-chart         # मौजूदा रिपोर्ट में चार्ट जोड़ें
openyida auth                 # लॉगिन स्थिति प्रबंधन (status/login/refresh/logout)
openyida cdn-config           # CDN इमेज अपलोड कॉन्फ़िगर करें (Aliyun OSS + CDN)
openyida cdn-refresh          # CDN कैश रिफ्रेश करें
openyida cdn-upload           # CDN पर इमेज अपलोड करें
openyida configure-process    # प्रोसेस नियम कॉन्फ़िगर और प्रकाशित करें
openyida connector            # HTTP कनेक्टर प्रबंधन
openyida copy                 # वर्तमान AI टूल के लिए project डायरेक्टरी इनिशियलाइज़ करें
openyida create-app           # Yida ऐप बनाएं
openyida create-form          # फ़ॉर्म पेज बनाएं / अपडेट करें
openyida create-page          # कस्टम डिस्प्ले पेज बनाएं
openyida create-process       # प्रोसेस फ़ॉर्म बनाएं (एकीकृत)
openyida create-report        # Yida रिपोर्ट बनाएं
openyida data                 # एकीकृत डेटा प्रबंधन (फ़ॉर्म/प्रोसेस/टास्क/सबफ़ॉर्म)
openyida doctor               # वातावरण निदान और स्वचालित मरम्मत
openyida env                  # वर्तमान AI टूल वातावरण और लॉगिन स्थिति का पता लगाएं
openyida export               # ऐप माइग्रेशन पैकेज निर्यात करें
openyida get-page-config      # पेज की सार्वजनिक एक्सेस / शेयरिंग कॉन्फ़िग देखें
openyida get-permission       # फ़ॉर्म अनुमति कॉन्फ़िगरेशन देखें
openyida get-schema           # फ़ॉर्म स्कीमा प्राप्त करें
openyida import               # माइग्रेशन पैकेज आयात करके ऐप पुनर्निर्माण करें
openyida login                # Yida में लॉगिन करें (कैश प्राथमिकता, अन्यथा QR कोड)
openyida logout               # लॉगआउट / खाता बदलें
openyida org                  # संगठन प्रबंधन (list/switch)
openyida publish              # कस्टम पेज कंपाइल और प्रकाशित करें
openyida query-data           # फ़ॉर्म इंस्टेंस डेटा क्वेरी करें
openyida save-permission      # फ़ॉर्म अनुमति कॉन्फ़िगरेशन सहेजें
openyida save-share-config    # सार्वजनिक एक्सेस / शेयरिंग कॉन्फ़िग सहेजें
openyida update-form-config   # फ़ॉर्म कॉन्फ़िगरेशन अपडेट करें
openyida verify-short-url     # शॉर्ट URL उपलब्ध है या नहीं जांचें
```

---

## डेमो

### 🏢 बिज़नेस सिस्टम — IPD / CRM

एक वाक्य में आवश्यकताएं बताएं — AI स्वचालित रूप से पूर्ण मल्टी-फ़ॉर्म बिज़नेस सिस्टम बनाता है।

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 यूटिलिटी — व्यक्तिगत वेतन कैलकुलेटर

![वेतन कैलकुलेटर](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 लैंडिंग पेज — एंटरप्राइज़ सहयोग

एक वाक्य से पूर्ण एंटरप्राइज़ प्रोडक्ट लैंडिंग पेज जनरेट करें।

![एंटरप्राइज़ सहयोग](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 अभियान — लालटेन पहेली खेल

AI पहेली चित्र बनाता है, उपयोगकर्ता उत्तर अनुमान लगाते हैं, गलत होने पर AI हास्यपूर्ण प्रतिक्रिया देता है।

![लालटेन पहेली खेल](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## सामान्य प्रॉम्प्ट

```
मेरे लिए [xxx] ऐप बनाओ
इस आवश्यकता दस्तावेज़ से ऐप जनरेट करो
[xxx] फ़ॉर्म पेज बनाओ
[xxx] पेज में [xxx] फ़ील्ड जोड़ो, फ़ील्ड नाम: [नाम], प्रकार: [प्रकार]
[xxx] पेज पर [xxx] फ़ील्ड को आवश्यक बनाओ
[xxx] पेज प्रकाशित करो
पेज को सार्वजनिक रूप से एक्सेस योग्य बनाओ
पुनः लॉगिन / लॉगआउट
```

---

## OpenClaw एकीकरण

OpenClaw में [yida-app](https://clawhub.ai/nicky1108/yida-app) के माध्यम से उपयोग करें:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## समुदाय

DingTalk पर OpenYida उपयोगकर्ता समूह में शामिल होने के लिए QR कोड स्कैन करें।

![OpenYida समुदाय में शामिल हों](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## योगदानकर्ता

OpenYida में योगदान देने वाले सभी लोगों का धन्यवाद! [योगदान गाइड](./CONTRIBUTING.md) पढ़ें।

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

## लाइसेंस

[MIT](./LICENSE) © 2026 Alibaba Group
