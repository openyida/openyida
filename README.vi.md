<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Xây dựng ứng dụng Yida low-code với AI — không cần cấu hình, triển khai ngay lập tức.**

[Bắt đầu](#bắt-đầu) · [Lệnh CLI](#lệnh-cli) · [Demo](#demo) · [Đóng góp](./CONTRIBUTING.md) · [Nhật ký thay đổi](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Ngôn ngữ:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## Bắt đầu

```bash
npm install -g openyida
```

**Không cần cấu hình, dùng ngay sau khi cài.** Sau khi cài đặt, chỉ cần trò chuyện trong Claude Code / OpenCode / Aone Copilot:

```
Tạo cho tôi hệ thống IPD trên Yida để quản lý toàn bộ quy trình sản xuất chip
Xây dựng hệ thống CRM
Tạo ứng dụng tính lương cá nhân
```

---

## Công cụ AI được hỗ trợ

| Công cụ | Trạng thái |
|---------|-----------|
| [Claude Code](https://claude.ai/code) | ✅ Hỗ trợ đầy đủ |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Hỗ trợ đầy đủ |
| [OpenCode](https://opencode.ai) | ✅ Hỗ trợ đầy đủ |
| [Cursor](https://cursor.com/) | ✅ Hỗ trợ đầy đủ |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Hỗ trợ đầy đủ |
| [Qoder](https://qoder.com) | ✅ Hỗ trợ đầy đủ |
| [Wukong](https://dingtalk.com/wukong) | ✅ Hỗ trợ đầy đủ |

---

## Sự khác biệt với các nền tảng AI khác

| Chiều | OpenYida | Nền tảng AI khác |
|-------|----------|-----------------|
| Người dùng mục tiêu | Lập trình viên (biết code) | Người dùng nghiệp vụ (không phải lập trình viên) |
| Tương tác | Ngôn ngữ tự nhiên + chat AI | Kéo thả trực quan |
| Kết quả | Ứng dụng Yida (có thể chỉnh sửa, đầy đủ tính năng low-code) | Cấu hình (thực thi hộp đen) |
| Triển khai | Nền tảng Yida | Bị khóa vào nền tảng SaaS |
| Mô hình AI | Tự do chọn mô hình tốt nhất | Do nền tảng chỉ định |
| Bảo mật | Bảo mật cấp doanh nghiệp của Yida | Phụ thuộc nền tảng |

---

## Yêu cầu

| Phụ thuộc | Phiên bản | Mục đích |
|-----------|-----------|---------|
| Node.js | ≥ 18 | Chạy CLI và xuất bản trang |

---

## Lệnh CLI

```bash
openyida append-chart         # Thêm biểu đồ vào báo cáo hiện có
openyida auth                 # Quản lý trạng thái đăng nhập (status/login/refresh/logout)
openyida cdn-config           # Cấu hình tải ảnh CDN (Aliyun OSS + CDN)
openyida cdn-refresh          # Làm mới cache CDN
openyida cdn-upload           # Tải ảnh lên CDN
openyida configure-process    # Cấu hình và xuất bản quy tắc quy trình
openyida connector            # Quản lý kết nối HTTP
openyida copy                 # Khởi tạo thư mục project cho công cụ AI hiện tại
openyida create-app           # Tạo ứng dụng Yida
openyida create-form          # Tạo / cập nhật trang biểu mẫu
openyida create-page          # Tạo trang hiển thị tùy chỉnh
openyida create-process       # Tạo biểu mẫu quy trình (tích hợp)
openyida create-report        # Tạo báo cáo Yida
openyida data                 # Quản lý dữ liệu thống nhất (biểu mẫu/quy trình/nhiệm vụ/biểu mẫu con)
openyida doctor               # Chẩn đoán môi trường và sửa chữa tự động
openyida env                  # Phát hiện môi trường công cụ AI hiện tại và trạng thái đăng nhập
openyida export               # Xuất gói di chuyển ứng dụng
openyida get-page-config      # Truy vấn cấu hình truy cập công khai / chia sẻ của trang
openyida get-permission       # Truy vấn cấu hình quyền biểu mẫu
openyida get-schema           # Lấy schema biểu mẫu
openyida import               # Nhập gói di chuyển để xây dựng lại ứng dụng
openyida login                # Đăng nhập Yida (ưu tiên cache, nếu không có thì dùng QR code)
openyida logout               # Đăng xuất / chuyển tài khoản
openyida org                  # Quản lý tổ chức (list/switch)
openyida publish              # Biên dịch và xuất bản trang tùy chỉnh
openyida query-data           # Truy vấn dữ liệu phiên bản biểu mẫu
openyida save-permission      # Lưu cấu hình quyền biểu mẫu
openyida save-share-config    # Lưu cấu hình truy cập công khai / chia sẻ
openyida update-form-config   # Cập nhật cấu hình biểu mẫu
openyida verify-short-url     # Kiểm tra URL rút gọn có khả dụng không
```

---

## Demo

### 🏢 Hệ thống nghiệp vụ — IPD / CRM

Mô tả yêu cầu bằng một câu — AI tự động tạo hệ thống nghiệp vụ đa biểu mẫu hoàn chỉnh.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 Tiện ích — Máy tính lương cá nhân

![Máy tính lương](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — Cộng tác doanh nghiệp

Tạo landing page sản phẩm doanh nghiệp hoàn chỉnh từ một câu duy nhất.

![Cộng tác doanh nghiệp](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 Chiến dịch — Trò chơi đoán câu đố đèn lồng

AI tạo hình ảnh câu đố, người dùng đoán câu trả lời với phản hồi hài hước khi sai.

![Trò chơi đoán câu đố](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## Câu lệnh thường dùng

```
Xây dựng cho tôi ứng dụng [xxx]
Tạo ứng dụng từ tài liệu yêu cầu này
Tạo trang biểu mẫu [xxx]
Thêm trường [xxx] vào trang [xxx], tên trường: [tên], loại: [loại]
Đặt trường [xxx] trên trang [xxx] là bắt buộc
Xuất bản trang [xxx]
Đặt trang có thể truy cập công khai
Đăng nhập lại / đăng xuất
```

---

## Tích hợp OpenClaw

Sử dụng qua [yida-app](https://clawhub.ai/nicky1108/yida-app) trong OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## Cộng đồng

Quét mã QR để tham gia nhóm người dùng OpenYida trên DingTalk.

![Tham gia cộng đồng OpenYida](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## Người đóng góp

Cảm ơn tất cả những người đã đóng góp cho OpenYida! Đọc [Hướng dẫn đóng góp](./CONTRIBUTING.md) để tham gia.

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

## Giấy phép

[MIT](./LICENSE) © 2026 Alibaba Group
