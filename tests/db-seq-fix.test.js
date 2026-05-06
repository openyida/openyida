'use strict';

const {
  generateMaxIdSql,
  generateSeqValueSql,
  generateFixSeqSql,
  TABLE_SEQUENCE_MAP,
} = require('../lib/db/db-seq-fix');

describe('db-seq-fix SQL generation', () => {
  test('generates max id, sequence value, and fix SQL exactly', () => {
    expect(generateMaxIdSql('tianshu_form_data', 'id')).toBe(
      'SELECT COALESCE(MAX(id), 0) as max_id FROM tianshu_form_data;'
    );
    expect(generateSeqValueSql('form_data_id_seq')).toBe(
      'SELECT last_value FROM form_data_id_seq;'
    );
    expect(generateFixSeqSql('form_data_id_seq', 42)).toBe(
      'ALTER SEQUENCE form_data_id_seq RESTART WITH 42;'
    );
  });

  test('known table sequence map includes high-risk Yida tables', () => {
    expect(TABLE_SEQUENCE_MAP.tianshu_form_data).toEqual({
      sequence: 'form_data_id_seq',
      pkField: 'id',
    });
    expect(TABLE_SEQUENCE_MAP.alibpms_app_cm_operator_record.sequence).toBe(
      'pro_operator_record_id_seq'
    );
  });
});
