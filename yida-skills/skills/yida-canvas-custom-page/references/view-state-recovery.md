# 页面状态恢复

编码前在当前页面实现计划中列出：哪些状态需要恢复、保存位置、有效范围和清除时机。URL 只是显示状态，不提供访问权限；服务端查询仍按当前访问者授权。沿用现有路由，不在同一页面再建立第二套路由。

## 默认恢复规则

| 状态 | 页内切换、列表详情返回 | 刷新、跨页返回 | 保存与清除 |
| --- | --- | --- | --- |
| 本地视图、非敏感枚举筛选、页码 | 恢复原任务；改变筛选后回第 1 页 | 从当前路由恢复，非法值回默认值 | URL 使用页面专属前缀和白名单；不覆盖平台参数 |
| 搜索文本、成员、手机号等敏感筛选 | 稳定父层按任务 key 保留 | 默认不恢复；有明确需求再设计受控存储 | 不放 URL、localStorage 或日志 |
| 已加载数据、滚动位置、焦点 | 同任务保留，详情关闭后焦点回入口 | 重新鉴权取数；数据就绪后按实际滚动容器恢复位置 | 内存缓存按应用、用户和任务隔离；切换身份清除 |
| 未提交草稿 | 放稳定父层，按任务/记录 key 保存；切换不可静默丢失 | 仅通过已验证的草稿服务恢复；无保存能力时明确离开策略 | 成功提交、明确放弃后清除；过期草稿须提示，不自动提交 |

不同任务的筛选各自保存；同一列表的状态分类 Tab 可以共享筛选。先决定语义，再决定是否重置页码。浏览器刷新与列表“刷新数据”不同：后者保留筛选、页码、旧数据和未提交输入，失败时显示局部错误。

## 可提取的最小片段

没有现成路由、没有未保存编辑拦截需求的独立页面，可提取：

```bash
openyida sample openyida-page-template canvas-view-state --output .cache/samples/canvas-view-state.jsx
```

将片段整体合并到业务源码并合并 React import；在 YidaComp 外声明稳定配置。视图数组和每个筛选数组必须非空、由字符串组成，第一项是默认值；namespace 使用当前页面唯一的稳定名称。

```jsx
const REGISTRATION_VIEW_STATE = {
  namespace: 'registrationList',
  views: ['list', 'calendar'],
  filters: { status: ['all', 'pending', 'confirmed'] },
};

function YidaComp() {
  const [route, changeRoute] = useCanvasViewState(REGISTRATION_VIEW_STATE);
  // Tabs.activeKey = route.view
  // Tabs.onChange = view => changeRoute({ view })
  // Select.value = route.filters.status
  // Select.onChange = status => changeRoute({ filters: { status } })
  // Pagination.current = route.page
  // Pagination.onChange = page => changeRoute({ page })
  // 查询依赖 route.view / route.filters.status / route.page，取消或忽略过期请求。
  return <div>{route.view}</div>;
}
```

片段恢复当前任务的视图、白名单筛选和页码，监听前进后退及页面返回，保留无关 query、完整 hash 和 history.state；重复选择不增加历史。它不管理跨任务缓存、滚动、权限或草稿，也不拦截浏览器离开。已有路由时把同样的白名单、编码与恢复规则接入现有路由，不再调用片段写 history。iframe 中仅操作当前页面窗口；须实测平台刷新和顶层返回能否恢复当前地址，平台未保留 iframe 地址时不能宣称支持跨页恢复。

有编辑区时，先实现保存/放弃/取消策略，再允许页面切换；浏览器返回沿用现有路由的离开拦截能力，取消须保持地址、选中态与内容一致。浏览器关闭/刷新只能使用其支持的 beforeunload 提醒，不能保证自定义弹窗或自动保存。缺少可靠离开拦截时，优先使用有已验证草稿能力的原生表单，不把无保护的编辑器接到这个片段上。

## 验收

验证筛选后翻页 → 详情 → 返回、刷新、前进后退、重复选择、快速连续切换、非法 URL、权限变化和草稿取消离开。跨任务、跨用户不能复用旧草稿或数据；没有真实浏览器验证时明确记录待验证范围。
