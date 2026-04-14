/**
 * db-seq-fix.js - 宜搭专属数据库 Sequence 起始值修复
 *
 * 功能：
 *   1. 检测所有使用 bigserial 主键的表
 *   2. 查询每个表的最大 ID
 *   3. 检查对应的 Sequence 当前值
 *   4. 如果 Sequence 值小于最大 ID，自动修复
 *
 * 用法：
 *   yida db-seq-fix              检查所有 Sequence 状态
 *   yida db-seq-fix --fix        自动修复有问题的 Sequence
 *   yida db-seq-fix --dry-run    预览修复 SQL，不实际执行
 */

'use strict';

const {
  loadCookieData,
  resolveBaseUrl,
  httpPost,
  httpGet,
} = require('../core/utils');
const { t } = require('../core/i18n');

// ── 参数解析 ──────────────────────────────────────────

/**
 * 从 args 数组中解析命名参数
 */
function parseFlag(args, flagName) {
  const index = args.indexOf(flagName);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

/**
 * 检查 args 中是否包含某个布尔标志
 */
function hasFlag(args, flagName) {
  return args.includes(flagName);
}

// ── 表定义 ──────────────────────────────────────────────

/**
 * 已知的表和 Sequence 映射关系
 * key: 表名
 * value: { sequence: Sequence 名称, pkField: 主键字段 }
 */
const TABLE_SEQUENCE_MAP = {
  'alibpms_app_cm_operator_record': {
    sequence: 'pro_operator_record_id_seq',
    pkField: 'id',
  },
  'tianshu_data_form_version': {
    sequence: 'data_form_version_id_seq',
    pkField: 'id',
  },
  'tianshu_form_data': {
    sequence: 'form_data_id_seq',
    pkField: 'id',
  },
  'tianshu_form_data_operation_log': {
    sequence: 'operation_log_id_seq',
    pkField: 'id',
  },
  'tianshu_form_data_stash': {
    sequence: 'form_data_stash_id_seq',
    pkField: 'id',
  },
  'tianshu_form_remark': {
    sequence: 'form_remark_id_seq',
    pkField: 'id',
  },
  'tianshu_instance_relation': {
    sequence: 'instance_relation_id_seq',
    pkField: 'id',
  },
  'tianshu_proc_inst_carbon': {
    sequence: 'proc_inst_carbon_id_seq',
    pkField: 'id',
  },
};

// ── SQL 生成 ────────────────────────────────────────────

/**
 * 生成查询表最大 ID 的 SQL
 * @param {string} tableName - 表名
 * @param {string} pkField - 主键字段名
 * @returns {string}
 */
function generateMaxIdSql(tableName, pkField) {
  return `SELECT COALESCE(MAX(${pkField}), 0) as max_id FROM ${tableName};`;
}

/**
 * 生成查询 Sequence 当前值的 SQL
 * @param {string} sequenceName - Sequence 名称
 * @returns {string}
 */
function generateSeqValueSql(sequenceName) {
  return `SELECT last_value FROM ${sequenceName};`;
}

/**
 * 生成修复 Sequence 的 SQL
 * @param {string} sequenceName - Sequence 名称
 * @param {number} startValue - 新的起始值
 * @returns {string}
 */
function generateFixSeqSql(sequenceName, startValue) {
  return `ALTER SEQUENCE ${sequenceName} RESTART WITH ${startValue};`;
}

/**
 * 生成查询所有表信息的 SQL（用于自动发现）
 * @returns {string}
 */
function generateDiscoverTablesSql() {
  return `
    SELECT 
      table_name,
      column_name,
      pg_get_serial_sequence(table_name, column_name) as sequence_name
    FROM information_schema.columns
    WHERE column_default LIKE 'nextval%'
      AND table_schema = 'public'
    ORDER BY table_name;
  `;
}

// ── API 调用 ────────────────────────────────────────────

/**
 * 执行 SQL 查询
 * @param {string} baseUrl - 基础 URL
 * @param {string} csrfToken - CSRF token
 * @param {Array} cookies - Cookie 数组
 * @param {string} sql - SQL 语句
 * @returns {Promise<object>}
 */
async function executeSqlQuery(baseUrl, csrfToken, cookies, sql) {
  const requestPath = `/query/exclusive/executeSql.json`;
  
  const postData = `_csrf_token=${csrfToken}&_locale_time_zone_offset=28800000&sql=${encodeURIComponent(sql)}`;
  
  return httpPost(baseUrl, requestPath, postData, cookies);
}

/**
 * 查询专属数据库配置
 * @param {string} baseUrl - 基础 URL
 * @param {string} csrfToken - CSRF token
 * @param {Array} cookies - Cookie 数组
 * @returns {Promise<object>}
 */
async function queryExclusiveDbConfig(baseUrl, csrfToken, cookies) {
  const requestPath = `/query/exclusive/queryExclusiveDbConfig.json`;
  const queryParams = {
    _api: 'Exclusive.queryExclusiveDbConfig',
    _mock: 'false',
    _csrf_token: csrfToken,
    _locale_time_zone_offset: '28800000',
    _stamp: Date.now().toString(),
  };

  return httpGet(baseUrl, requestPath, queryParams, cookies);
}

// ── Sequence 检测和修复 ────────────────────────────────

/**
 * 检测单个表的 Sequence 状态
 * @param {string} tableName - 表名
 * @param {object} seqInfo - Sequence 信息 { sequence, pkField }
 * @param {string} baseUrl - 基础 URL
 * @param {string} csrfToken - CSRF token
 * @param {Array} cookies - Cookie 数组
 * @returns {Promise<object>}
 */
async function checkTableSequence(tableName, seqInfo, baseUrl, csrfToken, cookies) {
  const { sequence, pkField } = seqInfo;
  
  // 查询表最大 ID
  const maxIdSql = generateMaxIdSql(tableName, pkField);
  const maxIdResult = await executeSqlQuery(baseUrl, csrfToken, cookies, maxIdSql);
  
  let maxId = 0;
  if (maxIdResult && maxIdResult.content && maxIdResult.content.rows) {
    maxId = parseInt(maxIdResult.content.rows[0]?.max_id || 0, 10);
  }
  
  // 查询 Sequence 当前值
  const seqValueSql = generateSeqValueSql(sequence);
  const seqResult = await executeSqlQuery(baseUrl, csrfToken, cookies, seqValueSql);
  
  let seqValue = 0;
  if (seqResult && seqResult.content && seqResult.content.rows) {
    seqValue = parseInt(seqResult.content.rows[0]?.last_value || 0, 10);
  }
  
  // 判断是否需要修复
  const needsFix = seqValue <= maxId;
  const suggestedValue = maxId + 1;
  
  return {
    tableName,
    sequence,
    pkField,
    maxId,
    seqValue,
    needsFix,
    suggestedValue,
  };
}

/**
 * 检查所有表的 Sequence 状态
 * @param {string} baseUrl - 基础 URL
 * @param {string} csrfToken - CSRF token
 * @param {Array} cookies - Cookie 数组
 * @returns {Promise<Array>}
 */
async function checkAllSequences(baseUrl, csrfToken, cookies) {
  const results = [];
  
  for (const [tableName, seqInfo] of Object.entries(TABLE_SEQUENCE_MAP)) {
    try {
      const result = await checkTableSequence(tableName, seqInfo, baseUrl, csrfToken, cookies);
      results.push(result);
    } catch (error) {
      results.push({
        tableName,
        sequence: seqInfo.sequence,
        error: error.message,
        needsFix: false,
      });
    }
  }
  
  return results;
}

/**
 * 修复单个 Sequence
 * @param {string} sequenceName - Sequence 名称
 * @param {number} startValue - 起始值
 * @param {string} baseUrl - 基础 URL
 * @param {string} csrfToken - CSRF token
 * @param {Array} cookies - Cookie 数组
 * @returns {Promise<object>}
 */
async function fixSequence(sequenceName, startValue, baseUrl, csrfToken, cookies) {
  const fixSql = generateFixSeqSql(sequenceName, startValue);
  return executeSqlQuery(baseUrl, csrfToken, cookies, fixSql);
}

// ── 报告生成 ────────────────────────────────────────────

/**
 * 生成 Sequence 检测报告
 * @param {Array} results - 检测结果
 * @param {boolean} showFixSql - 是否显示修复 SQL
 */
function generateReport(results, showFixSql = false) {
  console.log('');
  console.log('📊 ' + t('db_seq_fix.report_title'));
  console.log('─'.repeat(70));
  
  // 按状态分组
  const needFix = results.filter(r => r.needsFix);
  const ok = results.filter(r => !r.needsFix && !r.error);
  const errors = results.filter(r => r.error);
  
  // 显示需要修复的
  if (needFix.length > 0) {
    console.log('');
    console.log('⚠️  ' + t('db_seq_fix.need_fix', needFix.length));
    console.log('');
    
    for (const item of needFix) {
      console.log(`   📋 ${item.tableName}`);
      console.log(`      ${t('db_seq_fix.sequence')}: ${item.sequence}`);
      console.log(`      ${t('db_seq_fix.max_id')}: ${item.maxId}`);
      console.log(`      ${t('db_seq_fix.current_seq')}: ${item.seqValue}`);
      console.log(`      ${t('db_seq_fix.suggested')}: ${item.suggestedValue}`);
      
      if (showFixSql) {
        const fixSql = generateFixSeqSql(item.sequence, item.suggestedValue);
        console.log(`      ${t('db_seq_fix.fix_sql')}: ${fixSql}`);
      }
      console.log('');
    }
  }
  
  // 显示正常的
  if (ok.length > 0) {
    console.log('');
    console.log('✅ ' + t('db_seq_fix.ok', ok.length));
    console.log('');
    
    for (const item of ok) {
      console.log(`   ✓ ${item.tableName} (${t('db_seq_fix.max_id')}: ${item.maxId}, ${t('db_seq_fix.current_seq')}: ${item.seqValue})`);
    }
  }
  
  // 显示错误的
  if (errors.length > 0) {
    console.log('');
    console.log('❌ ' + t('db_seq_fix.errors', errors.length));
    console.log('');
    
    for (const item of errors) {
      console.log(`   ✗ ${item.tableName}: ${item.error}`);
    }
  }
  
  console.log('');
  console.log('─'.repeat(70));
  
  // 总结
  console.log('');
  if (needFix.length > 0) {
    console.log(`💡 ${t('db_seq_fix.summary_need_fix', needFix.length)}`);
    console.log(`   ${t('db_seq_fix.run_fix_hint')}`);
  } else if (ok.length === results.length) {
    console.log(`✨ ${t('db_seq_fix.summary_ok')}`);
  }
  console.log('');
}

// ── 主入口 ──────────────────────────────────────────────

/**
 * CLI 入口函数
 * @param {Array} args - 命令行参数
 */
async function run(args) {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log('');
    console.log(t('db_seq_fix.usage'));
    console.log('');
    console.log(t('db_seq_fix.commands'));
    console.log('  (no args)       ' + t('db_seq_fix.cmd_check'));
    console.log('  --fix           ' + t('db_seq_fix.cmd_fix'));
    console.log('  --dry-run       ' + t('db_seq_fix.cmd_dry_run'));
    console.log('');
    console.log(t('db_seq_fix.examples'));
    console.log('  yida db-seq-fix              ' + t('db_seq_fix.example_check'));
    console.log('  yida db-seq-fix --fix        ' + t('db_seq_fix.example_fix'));
    console.log('  yida db-seq-fix --dry-run    ' + t('db_seq_fix.example_dry_run'));
    console.log('');
    process.exit(0);
  }
  
  const shouldFix = hasFlag(args, '--fix');
  const dryRun = hasFlag(args, '--dry-run');
  
  // 检查登录态
  const cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies) {
    console.error(t('common.login_no_cache'));
    process.exit(1);
  }
  
  const baseUrl = resolveBaseUrl(cookieData);
  const { csrfToken } = cookieData;
  
  console.error(t('db_seq_fix.checking_login', baseUrl));
  
  try {
    // 查询专属数据库配置
    console.error(t('db_seq_fix.querying_db_config'));
    const dbConfig = await queryExclusiveDbConfig(baseUrl, csrfToken, cookieData.cookies);
    
    if (!dbConfig || !dbConfig.content) {
      console.error(t('db_seq_fix.no_db_config'));
      process.exit(1);
    }
    
    // 检查所有 Sequence
    console.error(t('db_seq_fix.checking_sequences'));
    const results = await checkAllSequences(baseUrl, csrfToken, cookieData.cookies);
    
    // 如果是 dry-run，显示修复 SQL
    if (dryRun) {
      generateReport(results, true);
      return;
    }
    
    // 如果需要修复
    if (shouldFix) {
      const needFix = results.filter(r => r.needsFix);
      
      if (needFix.length === 0) {
        generateReport(results, false);
        return;
      }
      
      console.error(t('db_seq_fix.fixing_sequences', needFix.length));
      
      for (const item of needFix) {
        console.error(`  ${t('db_seq_fix.fixing')} ${item.tableName}...`);
        await fixSequence(item.sequence, item.suggestedValue, baseUrl, csrfToken, cookieData.cookies);
      }
      
      console.error(t('db_seq_fix.fix_done'));
      
      // 重新检查
      const newResults = await checkAllSequences(baseUrl, csrfToken, cookieData.cookies);
      generateReport(newResults, false);
    } else {
      // 仅检查
      generateReport(results, false);
    }
  } catch (error) {
    console.error(t('db_seq_fix.error', error.message));
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = {
  run,
  checkTableSequence,
  checkAllSequences,
  fixSequence,
  generateMaxIdSql,
  generateSeqValueSql,
  generateFixSeqSql,
  TABLE_SEQUENCE_MAP,
};