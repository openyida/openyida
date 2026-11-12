# 宜搭基础表单组件开发规范

普通表单和流程表单使用基础表单组件扩展。先确定组件是展示已有数据、复用原生字段的存值能力，还是用多个字段组合采集数据。需要同时出现在自定义页面时，另行注册自定义页面的设计态和运行态扩展。

## 组件标识与字段 Schema

- 从一个共享常量取组件标识，区分大小写。设计态 `designerView.displayName`、运行态 `view.displayName`、Yida API 注册的 `componentName`、运行态配置的 `componentNameList` 都使用这个标识。移动端视图也使用相同的注册标识。类或函数在源码中的名字可以描述其用途。
- 使用业务前缀避开官方组件和同一组织中已安装的组件，例如 `SmartFinCurrencyField`。复合表单组件用 `CC_` 开头并保留业务前缀，例如 `CC_SmartFinInvoiceField`，配置 `isCompositeFormField: true`。数据字段推荐以 `Field` 结尾，部分筛选器和流程字段工具按这个后缀识别字段。字段类型和提交能力由实际元数据及宿主支持决定。
- 独立组件的拖拽片段用注册标识作 `schema.componentName`。复用原生字段时，`targetMetaDataFieldName` 和 `schema.componentName` 用实际原生类型，`schema.props.__viewName__` 用插件视图标识。例如原生 `NumberField` 的自定义视图使用 `SmartFinCurrencyField`。
- 已使用的组件保留 Schema 引用的标识。升级时如确需改名，先盘点旧表单引用，再提供兼容注册或迁移。迁移后验证字段 ID、配置和历史数据。

## 表单注册和发布配置

下例展示复用数值字段的注册关系。`CurrencyView` 是插件实现的视图，按宿主字段契约处理值、编辑与只读状态。两段注册分别放入各自入口的 `run`，与视图共用组件标识常量。

```js
// shared/component-name.js
export const COMPONENT_NAME = "SmartFinCurrencyField";

// 视图模块
CurrencyView.displayName = COMPONENT_NAME;

// ./designer/form 的 run
Yida.designer.form.addBasicComponent({
  componentName: COMPONENT_NAME,
  targetMetaDataFieldName: "NumberField",
  title: "财务金额",
  designerView: CurrencyView,
  snippets: [{
    label: "财务金额",
    schema: {
      componentName: "NumberField",
      props: { __viewName__: COMPONENT_NAME },
    },
  }],
});

// ./app/form 的 run
Yida.app.form.addBasicComponent({
  componentName: COMPONENT_NAME,
  view: CurrencyView,
  dataView: {
    icon: "success",
    meta: { type: COMPONENT_NAME, typeName: "财务金额" },
    gridFormatter: ({ value }) =>
      value == null || value === "" ? "—" : String(value),
    enableBatchEdit: false,
  },
});
```

下面是 `frontEndDevInfo` 的表单配置示例。先用 `openyida plugin extensions --json` 核对目标环境的扩展点，再将真实入口及配置合入 `version-get` 回读的配置。

```json
{
  "cdnEntry": "https://static.example.com/smart-fin/1.0.0/remoteEntry.js",
  "extensions": [
    { "extensionId": "yida.designer.form.basic-component" },
    {
      "extensionId": "yida.app.form.basic-component",
      "config": { "componentNameList": ["SmartFinCurrencyField"] }
    }
  ]
}
```

自定义页面增加 `yida.designer.custom-page.component` 和 `yida.app.custom-page.component`，分别暴露 `./designer/custom-page` 和 `./app/custom-page`，调用 `Yida.designer.customPage.addComponent` 和 `Yida.app.customPage.addComponent`。在自定义页面的运行态扩展配置中列出该场域的注册名。两种宿主可以共享纯视图组件，例如表单注册为 `SmartFinCurrencyField`，自定义页面注册为 `SmartFinCurrencyView`，各自场域内的注册、视图和 Schema 名保持一致。

## 数据管理与数据管理视图

普通表单和流程表单的插件开发，默认把数据管理页和数据管理视图纳入配置与验收。

1. **插件运行态配置。** 在 `Yida.app.form.addBasicComponent` 中提供 `dataView`，用 `meta.type` 对齐组件标识，配置列标题图标和 `gridFormatter`。同一格式化函数可以处理管理端 `admin` 和用户端 `app`。两端展示有差异时按 `scenarioCode` 处理。只读列也提供格式化结果，核对空值、零值和实际业务值。
2. **表单数据管理配置。** 在目标表单的数据管理页配置默认展示列。已有视图先读取真实配置，再将插件字段或实际承载数据的原生字段加入目标视图。配置步骤见[数据管理视图技能](../../yida-form-view/SKILL.md)。
3. **视图验收。** 提交测试记录后打开数据管理列表和目标视图，确认字段可选、列标题正确、单元格能渲染。需要行内编辑时实现 `gridEditor` 并核对保存值，完成批量编辑验收后再开启 `enableBatchEdit`。

只读展示组件通过绑定读取其他字段时，使用实际存值字段配置数据管理列。例如票据详情组件读取子表单时，按业务需要展示子表单字段或主表汇总字段。

## 按实际使用场景配置

把 `renderControl` 的交互抽成独立组件，需要复杂只读展示时也抽出 `renderView`。筛选器和流程设置面板可复用纯视图，避免在这些面板中嵌套完整的表单字段。使用 `configure` 定义设计器属性和 setter，有移动端要求时配置 `designerMobileView` 及运行态移动视图。

组件自身存值时，按宿主契约传递 `value` 和 `onChange`。需要把结果写入其他原生字段时，从运行时上下文定位目标字段，按表单实际字段 ID 和值结构配置映射。上传票据并填充子表单时，上传、解析和写回由录入组件或业务流程完成，详情视图通过绑定读取已保存的明细。

| 使用场景 | 相关配置与检查 |
| --- | --- |
| 表单存值与字段匹配 | 按需配置 `targetMetaDataFieldName` 或 `isCompositeFormField`。使用 `matchedFields` 声明已验证的匹配类型，初期只匹配自身。 |
| 表单、数据管理及流程筛选 | 按需配置 `filterView` 和 `supportedOperators`。设计态与运行态都消费筛选器时，两端都注册对应配置。按实际支持的操作符验证条件视图、值类型和校验。 |
| 公式 | 用 `formulaView` 声明 `valueTypes`、`fieldTagMap`，需要转换时实现 `parseValue`。在实际编辑器中验证字段选择、返回值和计算。 |
| 流程设计器与集成自动化 | 用 `flowSetterView` 配置面板视图。根据需求逐项验证后开启 `enableUpdate`、`enableCondition`、`enablePermission`、`enableMatch` 等能力。流程表单填写页的组件渲染与流程节点配置分别验收。 |
| 关联、导入导出、消息与历史 | 分别按需配置 `associationView`、`importExport`、`messageView`、`modifyHistoryView`。关联填充核对 `fillableFields`，关联展示的 `getViewText` 返回字符串。仅开启已实现的能力。 |

历史场域可能还使用组件类型清单或专有映射。组件未出现在某个场域时，先核对该扩展是否加载、能力开关是否生效，再确认宿主支持的字段匹配和操作符。

## 验收与排查

1. 构建前核对共享标识和字段 Schema。构建后确认入口暴露目标模块，所有分包可访问，压缩产物中的 `displayName` 与注册及版本配置一致。
2. 组织发布并启用后，在目标设计器拖入组件，检查画布、属性面板、保存和重开。组件库可见而画布提示「组件未找到」时，对照保存节点的 `componentName` 或 `__viewName__` 与实际注册的 `designerView.displayName`。
3. 在真实普通表单和流程表单的填写页验证自动渲染、交互和只读状态。涉及数据写入时用测试表单提交并重新打开，核对原生字段或子表单的值。自定义页面及启用的其他场域逐一验收。
4. 在数据管理列表和目标数据管理视图中分别检查测试记录的列和值。插件字段显示异常时，核对运行态注册中的 `dataView.meta.type` 和 `gridFormatter`，以及表单视图使用的字段 ID。
5. 运行态缺少组件时核对启用版本、实际入口和分包请求、运行态 `componentNameList` 以及 `view.displayName`。同一组织有多个第三方插件使用同一资源主机时，如果其中一个没有发出脚本请求，检查目标宿主是否按相同运行时标识覆盖了插件。确认冲突后为各插件使用独立资源主机。
