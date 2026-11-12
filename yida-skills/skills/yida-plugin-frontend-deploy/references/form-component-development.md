# 宜搭基础表单组件开发规范

普通表单和流程表单使用基础表单组件扩展。先确定组件是展示已有数据、复用原生字段的存值能力，还是用多个字段组合采集数据。需要同时出现在自定义页面时，另行注册自定义页面的设计态和运行态扩展。

## 组件标识与字段 Schema

- 命名与注册遵循[组件标识一致性](./frontend-contract.md#组件标识一致性)。表单设计态、运行态和移动端共用同一个组件标识。
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

自定义页面增加 `yida.designer.custom-page.component` 和 `yida.app.custom-page.component`，分别暴露 `./designer/custom-page` 和 `./app/custom-page`，调用 `Yida.designer.customPage.addComponent` 和 `Yida.app.customPage.addComponent`。在自定义页面的运行态扩展配置中列出该场域的注册名。同一组件在两个宿主中使用同一个标识。需要独立注册表单字段与自定义页面展示组件时，可以共享内部控件，并分别使用 `SmartFinCurrencyField` 和 `SmartFinCurrencyView`。

## 多场域和移动端的实现

- 每个场域的设计态和运行态都用独立的 `run` 入口。设计态入口注册拖拽片段、预览视图和 setter，运行态入口注册实际视图和消费场景配置。共用的控件和值转换放在独立模块里。按 `isMobile` 选择运行视图，设计器有移动端画布时一并配置 `designerMobileView`。
- 表单视图通过宿主字段契约收集数据，自定义页面、筛选器和流程 setter 通过各自传入的 `value` 和 `onChange` 复用控件。让控件只处理当前输入，表单包装层负责字段状态和提交。设计器和只读视图渲染时保持已保存值，默认值通过 Schema 或宿主允许的初始化逻辑设置。
- 结构化字段在读入时统一处理对象、JSON 字符串和空值。保存时保留字段约定的值结构。只读视图、表格列和关联展示共用格式化函数，关联字段需要文本时返回字符串。普通值、空值和旧版本保存的值都要经过同一套读入逻辑。
- 使用 `configure` 提供业务属性和默认值。拖拽片段、属性面板和控件的默认值保持一致。标题、说明等界面文案按项目的国际化契约配置，流程操作符使用宿主定义的标识。

## 使用宜搭原生组件

- 原生附件、子表单和数值需要随表单提交时，在表单 Schema 中保留真实的 `AttachmentField`、`TableField` 和 `NumberField`。插件要作为一个完整组件拖入时，用 `isContainer: true` 注册布局容器，将原生字段放进 `snippets[].schema.children`，设计态和运行态都渲染宿主传入的 `children`。例如「发票分析」容器的两个直接子节点是附件和子表，子表下才放多行文本、数值。容器本身无需新增 Dictionary 字段。
- 容器内读写字段时，从当前容器的 Schema 子树解析宿主生成的字段 ID；仅当插件消费独立存在的字段时，才通过插件属性配置外部字段 ID。运行态通过 `window.Yida.utils.getRuntimeContextFromComponentProps(props)` 获取当前表单上下文，再使用 `ctx.$(fieldId).getValue()` 或 `setValue()` 读写。保留宿主传入的上下文 props，写入前核对目标字段可编辑。测试同一表单插入两个容器时，每个实例只操作自己的子节点，并核对实际存值字段能在数据管理视图中选择。
- 插件内部需要直接渲染原生控件时，沿用 Canvas 的探测思路，从当前页面的 `window.Deep`、`window.DeepYida` 或存在时的 `window.YidaNativeComponents` 查找宿主暴露的可渲染组件。按目标设计态、运行态和设备核实组件名、属性及值结构。确认所需的 React 和宿主全局对象后再声明 externals。缺少必需的原生组件时给出具体提示，保留原生字段的提交路径。
- 插件视图本身可以用宿主提供的 `window.Deep.FormHelper` 接入字段状态。展示层嵌入的控件由插件负责绑定值，提交数据通过真实字段或宿主的字段回调保存。配置原生附件和子表单时，先验证上传后的附件值，再用真实子字段 ID 组装行对象。金额用数值字段并配置业务所需小数位。

## 原生子表单列与附件回填

- 在拖拽片段里显式配置多行文本列为 `componentName: "TextareaField"` 和 `props.htmlType: "textarea"`。缺少 `htmlType` 时，底层文本控件默认按单行模式渲染。沿用目标设计器的原生子表单列元数据，原生列由宿主渲染。需要自定义视图时才配置 `__viewName__`。
- 附件回填从上传成功且附件值可用时触发。在填写态展示处理状态，按当前附件去重，丢弃附件移除或替换前发起的过期结果，保留已有手工行和编辑值。按实际子字段 ID 写入行对象，多行文本存可读明细，金额存数字。处理失败时保留已上传的附件和原有行，给用户可见的反馈。
- 接入解析前用目标服务验证实际支持的输入和输出。`openyida ai text` 调用的 `txtFromAI` 接收文本 prompt。PDF 解析需要验证能接收附件的服务，或先提取 PDF 文本再调用文本生成。只验收上传、处理状态和回填链路时，可以用标明为模拟的固定结果，上传成功后自动回填。
- 迁移已有表单时先回读字段 Schema 和数据管理配置。若字段已经是 `TextareaField`，补齐 `htmlType` 并清理旧视图覆盖即可，保留字段 ID 及数据管理列的绑定。仅补字段属性时，按字段 ID 使用 [`create-form update`](../../yida-create-form-page/SKILL.md#update-模式)。按需另行处理历史记录中保存的 JSON 字符串。下线旧插件组件时，先清理普通表单、流程表单及其视图中的引用，再移除相应的注册和版本配置项。

## 数据管理与数据管理视图

普通表单和流程表单的插件开发，默认把数据管理页和数据管理视图纳入配置与验收。

1. **插件运行态配置。** 在 `Yida.app.form.addBasicComponent` 中提供 `dataView`，用 `meta.type` 对齐组件标识，配置列标题图标和 `gridFormatter`。同一格式化函数可以处理管理端 `admin` 和用户端 `app`。两端展示有差异时按 `scenarioCode` 处理。只读列也提供格式化结果，核对空值、零值和实际业务值。
2. **表单数据管理配置。** 在目标表单的数据管理页配置默认展示列。已有视图先读取真实配置，再将插件字段或实际承载数据的原生字段加入目标视图。配置步骤见[数据管理视图技能](../../yida-form-view/SKILL.md)。
3. **视图验收。** 提交测试记录后打开数据管理列表和目标视图，确认字段可选、列标题正确、单元格能渲染。需要行内编辑时实现 `gridEditor` 并核对保存值，完成批量编辑验收后再开启 `enableBatchEdit`。

只读展示组件通过绑定读取其他字段时，使用实际存值字段配置数据管理列。例如票据详情组件读取子表单时，按业务需要展示子表单字段或主表汇总字段。

## 按实际使用场景配置

把 `renderControl` 的交互抽成独立组件，需要复杂只读展示时也抽出 `renderView`。筛选器和流程设置面板可复用纯视图，避免在这些面板中嵌套完整的表单字段。使用 `configure` 定义设计器属性和 setter，有移动端要求时配置 `designerMobileView` 及运行态移动视图。

组件自身存值时，按宿主契约传递 `value` 和 `onChange`。需要把结果写入其他原生字段时，从运行时上下文定位目标字段，按表单实际字段 ID 和值结构配置映射。上传票据并填充子表单时，上传、解析和写回由录入组件或业务流程完成，详情视图通过绑定读取已保存的明细。

## 基础表单组件配置项

以下字段用于 `Yida.designer.form.addBasicComponent` 或 `Yida.app.form.addBasicComponent` 的注册对象。先实现视图、回调和值转换，再启用目标场景的开关。

### 基础配置

| 配置项 | 类型 | 用途 |
| --- | --- | --- |
| `componentName` | `string` | 组件标识，与视图的 `displayName`、Schema 引用及运行态配置对应。 |
| `targetMetaDataFieldName` | 组件类型名 | 复用原生字段的元数据与存值类型。 |
| `isCompositeFormField` | `boolean` | 声明复合字段，组件名以 `CC_` 开头。 |
| `matchedFields` | `string[]` | 允许在筛选等场景匹配的字段类型，初期可只声明自身类型。 |
| `supportedOperators` | `string[]` 或操作符对象数组 | 声明宿主识别的操作符。对象以 `value` 标识操作符，`label` 用于展示。 |
| `view`、`designerView`、`designerMobileView` | `ComponentType`，部分宿主接受 `ReactNode` | 分别用于运行态、设计态和移动设计态。移动运行态可按宿主支持配置 `mobileView`。 |

流程的匹配、条件过滤、数据节点可分别使用 `operatorMapConfig.flowMatch`、`flowFilter`、`flowDataNode`。各项取字符串数组或操作符对象数组。核对宿主实际接受的操作符值，特别是使用历史中文标识的流程节点。

### 数据管理和修改历史

| 配置项 | 类型 | 用途 |
| --- | --- | --- |
| `dataView.icon` | `string` | 数据管理表头图标。 |
| `dataView.meta` | `{ type, typeName }` | `type` 对齐 `componentName`，`typeName` 为类型展示名。 |
| `dataView.gridFormatter` | `({ value, scenarioCode }) => ReactNode` | 渲染列值。用 `admin` 或 `app` 区分管理端与用户端，验证空值、零值和只读展示。 |
| `dataView.gridEditor` | `(props, ref) => ReactNode` | 行内编辑器。宿主传入 `value`、`inputRef`、`onChange`、`options`。验证编辑后的实际存值。 |
| `dataView.enableBatchEdit` | `boolean` | 批量编辑开关。完成批量保存与回读验证后再开启。 |
| `modifyHistoryView.view` | `ReactNode` | 渲染实例详情中的字段变更历史。 |

将实际存值字段加入目标数据管理视图后，再验证表格和详情。关联查询依赖 `dataView`，在设计态和运行态都加载相关配置。

### 筛选和关联

| 配置项 | 类型 | 用途 |
| --- | --- | --- |
| `filterView.view` | `ReactNode` | 筛选条件的输入视图。 |
| `filterView.conditionView` | 操作符到视图的映射 | 为特定操作符指定渲染视图。键使用宿主的操作符标识。 |
| `filterView.getExtraProps` | `(props) => object` | 补充筛选视图所需的属性。 |
| `filterView.validateValue` | `(value) => boolean` | 校验筛选条件值。 |
| `filterView.isCascade` | `boolean` | 声明级联字段，以便筛选器按级联值结构处理。 |
| `associationView.enable` | `boolean` | 开启关联表单支持。 |
| `associationView.enableAssociationQuery` | `boolean` | 开启关联查询支持。 |
| `associationView.fillableFields` | `string[]` | 允许关联填充的组件类型。 |
| `associationView.getViewText` | `({ value, options }) => string` | 返回关联展示的纯文本。 |

筛选器在设计态和运行态都可能使用，两个入口均注册 `filterView`。流程设计器优先使用 `flowSetterView`，再回退到 `filterView` 或组件视图。使用独立控件复用输入能力，避免在流程 setter 中嵌套完整表单字段。

### 流程面板 `flowSetterView`

| 属性 | 类型 | 对应能力 |
| --- | --- | --- |
| `view` | `ReactNode` 或 `ComponentType` | 流程设置面板的输入视图。 |
| `enableUpdate` | `boolean` | 允许更新字段值。 |
| `enableCondition` | `boolean` | 允许作为条件项。 |
| `enablePermission` | `boolean` | 允许配置字段权限。 |
| `enableService` | `boolean` | 允许用于第三方服务配置。 |
| `enableMessage` | `boolean` | 允许用于流程消息内容配置。 |
| `enableMatch` | `boolean` | 允许用于字段匹配。 |
| `updateMatchFields` | `string[]` | 允许在更新场景中匹配的字段类型。 |
| `enableFilter` | `boolean` | 允许用于流程筛选。 |
| `enableLiteral` | `boolean` | 允许配置字面量值。 |

更新字段的运行时键为 `enableUpdate`。部分 SDK 类型和旧文档表格拼写为 `enableUpate`，以目标消费者实际读取的键为准。按本次业务需要开启开关，在流程或集成自动化中配置并执行一条对应规则。

### 公式、消息和导入导出

| 配置项 | 类型 | 用途 |
| --- | --- | --- |
| `formulaView.fieldTagMap` | `string` 或 `{ style, text }` | 定义公式编辑器中的字段标签。 |
| `formulaView.valueTypes` | `string[]` | 声明该字段支持的公式返回类型。 |
| `formulaView.parseValue` | `(value) => value` | 将公式结果转换为字段约定的值。 |
| `messageView.enable` | `boolean` | 开启消息通知和消息卡片支持。 |
| `importExport.view` | `ReactNode` | 导入导出场景的视图。 |
| `importExport.enable` | `boolean` | 开启导入导出支持。 |

组件在目标场景未出现时，检查设计态和运行态的注册、对应能力开关、字段匹配及操作符，再用实际记录验证渲染、写入和回读。

## 验收与排查

1. 构建前核对共享标识和字段 Schema。构建后确认入口暴露目标模块，所有分包可访问，压缩产物中的 `displayName` 与注册及版本配置一致。
2. 组织发布并启用后，在目标设计器拖入组件，检查画布、属性面板、保存和重开。组件库可见而画布提示「组件未找到」时，对照保存节点的 `componentName` 或 `__viewName__` 与实际注册的 `designerView.displayName`。
3. 在真实普通表单和流程表单的填写页验证自动渲染、交互和只读状态。涉及数据写入时，提交测试记录并重新打开核对存值。附件回填还要实测上传、处理状态、子表单列的渲染和回填值。分别验收设计器中新拖入的组件、已有表单以及记录详情。自定义页面及启用的其他场域逐一验收。
4. 在数据管理列表和目标数据管理视图中分别检查测试记录的列和值。插件字段显示异常时，核对运行态注册中的 `dataView.meta.type` 和 `gridFormatter`，以及表单视图使用的字段 ID。
5. 运行态缺少组件时核对启用版本、实际入口和分包请求、运行态 `componentNameList` 以及 `view.displayName`。同一组织有多个第三方插件使用同一资源主机时，如果其中一个没有发出脚本请求，检查目标宿主是否按相同运行时标识覆盖了插件。确认冲突后为各插件使用独立资源主机。
6. 有移动端要求时，分别在移动设计器和移动填写页检查组件是否显示、弹层是否可操作、保存后值是否一致。启用筛选、流程 setter 或关联填充时，实际配置一条规则并验证结果。
