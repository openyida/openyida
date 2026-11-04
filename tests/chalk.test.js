'use strict';

const { step } = require('../lib/core/chalk');
const { stripVTControlCharacters } = require('util');

let previousQuiet;

beforeEach(() => {
  previousQuiet = process.env.YIDA_QUIET;
  delete process.env.YIDA_QUIET;
  jest.spyOn(process.stdout, 'write').mockReturnValue(true);
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  if (previousQuiet === undefined) { delete process.env.YIDA_QUIET; }
  else { process.env.YIDA_QUIET = previousQuiet; }
  jest.restoreAllMocks();
});

test.each([true, false])('progress is not a JSON document with stderr=%s', stderr => {
  step(1, '\n读取登录态', stderr);
  step(2, '\r\nCreate application', stderr);
  step(3, '', stderr);
  const stream = stderr ? process.stderr : process.stdout;
  const other = stderr ? process.stdout : process.stderr;
  const lines = stripVTControlCharacters(stream.write.mock.calls.map(([value]) => value).join(''))
    .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  expect(lines.join('\n')).toContain('读取登录态');
  expect(lines.join('\n')).toContain('Create application');
  for (const line of lines) {
    expect(() => JSON.parse(line)).toThrow();
  }
  expect(other.write).not.toHaveBeenCalled();
});

test('quiet suppresses progress on both streams', () => {
  process.env.YIDA_QUIET = '1';
  step(1, '\n读取登录态');
  step(2, '\nCreate application', false);
  expect(process.stderr.write).not.toHaveBeenCalled();
  expect(process.stdout.write).not.toHaveBeenCalled();
});
