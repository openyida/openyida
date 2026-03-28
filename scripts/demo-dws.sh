#!/bin/bash
# 钉钉 CLI 集成演示脚本

set -e

echo "========================================"
echo "  OpenYida 钉钉 CLI 集成演示"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}1. 查看 dws 命令帮助${NC}"
echo "----------------------------------------"
node bin/yida.js dws --help | head -20
echo ""
echo "按回车继续..."
read

echo -e "${CYAN}2. 检查钉钉 CLI 安装状态${NC}"
echo "----------------------------------------"
if command -v dws &> /dev/null; then
    echo -e "${GREEN}✓ 钉钉 CLI 已安装${NC}"
    node bin/yida.js dws version
else
    echo -e "${YELLOW}⚠ 钉钉 CLI 未安装${NC}"
    echo "可以使用以下命令安装："
    echo "  openyida dws install"
fi
echo ""
echo "按回车继续..."
read

echo -e "${CYAN}3. 查看主帮助中的 dws 命令${NC}"
echo "----------------------------------------"
node bin/yida.js --help | grep -A 2 "dws"
echo ""
echo "按回车继续..."
read

echo -e "${CYAN}4. 常用命令示例${NC}"
echo "----------------------------------------"
echo ""
echo "搜索联系人:"
echo "  ${GREEN}openyida dws contact user search --keyword \"悟空\"${NC}"
echo ""
echo "创建待办事项:"
echo "  ${GREEN}openyida dws todo task create --title \"任务\" --executors \"userId\"${NC}"
echo ""
echo "列出日历事件:"
echo "  ${GREEN}openyida dws calendar event list${NC}"
echo ""
echo "查询考勤记录:"
echo "  ${GREEN}openyida dws attendance record list${NC}"
echo ""
echo "发送机器人消息:"
echo "  ${GREEN}openyida dws chat robot send --content \"消息内容\"${NC}"
echo ""
echo "按回车继续..."
read

echo -e "${CYAN}5. 输出格式示例${NC}"
echo "----------------------------------------"
echo ""
echo "表格输出（默认）:"
echo "  openyida dws contact user search --keyword \"张三\" ${GREEN}-f table${NC}"
echo ""
echo "JSON 输出（适合 AI Agent）:"
echo "  openyida dws contact user search --keyword \"张三\" ${GREEN}-f json${NC}"
echo ""
echo "原始 API 响应:"
echo "  openyida dws contact user search --keyword \"张三\" ${GREEN}-f raw${NC}"
echo ""
echo "按回车继续..."
read

echo -e "${CYAN}6. 特殊命令${NC}"
echo "----------------------------------------"
echo ""
echo "一键安装钉钉 CLI:"
echo "  ${GREEN}openyida dws install${NC}"
echo ""
echo "预览操作（不执行）:"
echo "  ${GREEN}openyida dws <command> --dry-run${NC}"
echo ""
echo "输出到文件:"
echo "  ${GREEN}openyida dws <command> -o result.json${NC}"
echo ""
echo "按回车继续..."
read

echo "========================================"
echo "  演示完成！"
echo "========================================"
echo ""
echo "更多信息请查看文档："
echo "  - docs/dws-cli-guide.md (完整指南)"
echo "  - docs/dws-quick-start.md (快速开始)"
echo "  - docs/dws-integration-changelog.md (更新说明)"
echo ""
echo "准备就绪，可以开始使用钉钉 CLI 了！"
echo ""
