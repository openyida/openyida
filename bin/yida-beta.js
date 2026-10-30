#!/usr/bin/env node
'use strict';
// beta 保持当前安装版本；环境、域名和登录态沿用标准 CLI 的解析规则。
process.env.OPENYIDA_SKIP_UPDATE_CHECK = '1';
require('./yida.js');
