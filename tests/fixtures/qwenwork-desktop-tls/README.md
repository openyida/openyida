# 本机 TLS 测试夹具

此目录中的自签名证书和私钥是公开测试材料，只用于 `qwenwork-desktop-login.test.js` 的隔离本机 HTTPS 服务。没有生产身份或外部服务权限。测试子进程通过 `NODE_EXTRA_CA_CERTS` 信任该证书，不关闭 TLS 验证，也不修改系统证书存储。
