/**
 * 宜搭表单字段定义模板
 * 
 * 使用说明：
 * 1. 先运行 openyida get-schema <appType> <formUuid> 获取字段 ID
 * 2. 根据实际字段修改下方 fieldDefinitions
 * 3. 在插入数据时使用正确的字段 ID
 * 
 * 字段 ID 格式：
 * - 文本字段：textField_xxxxx
 * - 数字字段：numberField_xxxxx
 * - 选择字段：selectField_xxxxx
 * - 日期字段：dateField_xxxxx
 * - 成员字段：employeeField_xxxxx（值为 ["userId"] 数组）
 * - 多行文本：textareaField_xxxxx
 */

// ============================================================
// 示例：需求管理表单字段定义
// ============================================================
var requirementFormFields = {
  formUuid: 'FORM-91F6B7D25F114C78A0E66EB3CA01A328Q1D9',
  fields: {
    reqCode: 'textField_vgya1fme1',      // 需求编号
    reqTitle: 'textField_vgya2wkph',     // 需求标题
    reqType: 'selectField_vgya3dplb',    // 需求类型
    priority: 'selectField_vgya4k097',   // 优先级
    description: 'textareaField_vgya5bron', // 需求描述
    requester: 'employeeField_vgya6es5u', // 提出人
    dueDate: 'dateField_vgya7xjkf',      // 期望完成日期
    status: 'selectField_vgya8o7ea'      // 状态
  },
  // 选项值映射
  options: {
    reqType: ['产品需求', '技术需求', '市场需求', '客户需求'],
    priority: ['P0-紧急', 'P1-高', 'P2-中', 'P3-低'],
    status: ['待评审', '已评审', '开发中', '已上线', '已拒绝']
  }
};

// ============================================================
// 数据插入示例
// ============================================================

/**
 * 构建表单数据对象
 * @param {Object} data - 业务数据
 * @param {Object} fieldDefs - 字段定义
 * @returns {Object} - 符合宜搭格式的数据对象
 */
function buildFormData(data, fieldDefs) {
  var result = {};
  Object.keys(data).forEach(function(key) {
    var fieldId = fieldDefs.fields[key];
    if (fieldId && data[key] !== undefined) {
      result[fieldId] = data[key];
    }
  });
  return result;
}

/**
 * 插入表单数据命令示例
 * 
 * openyida data create form <appType> <formUuid> --data '<JSON>'
 * 
 * 示例：
 * openyida data create form APP_XXX FORM-XXX --data '{"textField_xxx":"测试值"}'
 */

// ============================================================
// 常见字段值格式参考
// ============================================================

/*
| 组件类型 | 保存格式 | 示例 |
|---------|---------|------|
| 单行文本 | 字符串 | "文本内容" |
| 多行文本 | 字符串 | "多行文本内容" |
| 数字 | 数字 | 100 |
| 单选 | 字符串 | "选项一" |
| 多选 | 数组 | ["选项一", "选项二"] |
| 日期 | 时间戳 | 1719705600000 |
| 成员 | 数组 | ["userId"] |
| 部门 | 数组 | ["deptId"] |
| 图片 | 数组 | ["url1", "url2"] |
| 附件 | 数组 | [{name: "文件名", url: "下载地址"}] |
*/

// ============================================================
// 完整数据插入示例
// ============================================================

/*
# 插入需求管理数据
openyida data create form APP_PZS775X8ZG1BDDHD0J8Z FORM-91F6B7D25F114C78A0E66EB3CA01A328Q1D9 --data '{
  "textField_vgya1fme1": "REQ-2024-001",
  "textField_vgya2wkph": "支持多语言国际化",
  "selectField_vgya3dplb": "产品需求",
  "selectField_vgya4k097": "P1-高",
  "textareaField_vgya5bron": "系统需要支持中英文切换",
  "selectField_vgya8o7ea": "开发中"
}'
*/
