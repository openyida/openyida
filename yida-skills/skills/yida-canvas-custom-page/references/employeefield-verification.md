# YidaCodeCanvas 组件运行时事实与 EmployeeField 验证

使用 `YidaCodeCanvas` 组件接入 `EmployeeField` 前，先确认运行时边界、组件探测结果和值结构。

## 运行时事实

- `.canvas.jsx` 源码在运行页面 `window` 中执行，`YidaComp` 是普通 React 函数组件。
- `YidaCodeCanvas` 组件使用 React 函数组件上下文；数据读写、生命周期和渲染通过 hooks、props、HTTP 数据桥或连接器完成。
- 代码执行后必须返回 `YidaComp`、`YidaComp.default` 或组件函数。
- 页面要读写宜搭数据，只能在组件内使用 HTTP 数据桥、连接器代理或显式 props 注入。

> 可用资源清单、import 写法与运行时加载方式已拆到 [dependencies-and-cdn.md](dependencies-and-cdn.md)。

## 宜搭原生组件判断

`EmployeeField`、`SelectField`、`DepartmentSelectField`、`AttachmentField` 等宜搭原生字段组件按运行态组件接入。使用前确认：

- 页面 `window.Deep` / `window.DeepYida` / `window.YidaNativeComponents` 能探测到目标组件。
- 组件所需 CSS、页面上下文、组织权限、弹层容器、移动端版本均可用。
- `onChange` 返回值结构能被后续数据保存或查询逻辑消费。

这些原生组件从页面 `window` 探测。确认条件齐全时渲染原生组件；确认条件不足时使用普通 UI：用 antd 或自定义控件选择候选用户，值只存已知 userId / unionId / 文本快照。

## EmployeeField 验证示例

示例用于 YidaCodeCanvas 验证；历史 `.oyd.jsx` 自定义页使用实例桥写法。

```jsx
import React from 'react';

function findEmployeeField() {
  var sources = [];
  if (window.Deep) { sources.push(window.Deep); }
  if (window.YidaNativeComponents) { sources.push(window.YidaNativeComponents); }
  if (window.DeepYida) {
    sources.push(window.DeepYida.default || window.DeepYida);
    if (Array.isArray(window.DeepYida)) {
      sources = sources.concat(window.DeepYida);
    }
  }

  for (var i = 0; i < sources.length; i += 1) {
    var source = sources[i];
    if (source && source.EmployeeField) {
      return source.EmployeeField;
    }
    if (Array.isArray(source)) {
      var match = source.find(function(item) {
        return item && (item.displayName === 'EmployeeField' || item.name === 'EmployeeField');
      });
      if (match) {
        return match.component || match.Component || match.default || null;
      }
    }
  }
  return null;
}

function YidaComp(props) {
  var EmployeeField = findEmployeeField();
  var state = React.useState([]);
  var value = state[0];
  var setValue = state[1];

  if (!EmployeeField) {
    return (
      <div style={{ padding: 16 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>负责人</label>
        <input
          placeholder="未探测到 EmployeeField，使用文本 fallback"
          onChange={function (event) {
            setValue([{ name: event.target.value, raw: { fallback: true } }]);
          }}
        />
        <pre style={{ marginTop: 12, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <EmployeeField
        label="负责人"
        placeholder="请选择负责人"
        multiple={false}
        value={value}
        onChange={function (nextValue) {
          setValue(nextValue || []);
        }}
      />
      <pre style={{ marginTop: 12, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default YidaComp;
```

验收点：

- 组件探测结果能明确显示可用或缺失，不因缺失组件白屏。
- 页面控制台保持干净，无 `EmployeeField is not defined`、样式缺失、弹层挂载错误。
- 成员弹层能打开、搜索、选择、清空。
- PC 和移动端都能完成选择。
- `onChange` 输出的值结构被记录下来，后续代码按真实结构处理。
