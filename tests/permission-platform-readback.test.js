'use strict';

const { normalizeListedPackage } = require('../lib/permission/permit-package-service');
const { verifyPackageDimensions } = require('../lib/permission/save-permission');
const { formatPermissions } = require('../lib/permission/get-permission');

describe('permission platform list DTO compatibility', () => {
  const raw = {
    packageUuid: 'pkg-platform', packageType: '',
    roleMembers: [{ roleType: 'ROLE', label: '角色', roleValue: [{ key: 'ROLE-EXISTING', label: '角色' }] }],
  };

  test.each(['FORM_PACKAGE_VIEW', 'FORM_PACKAGE_START'])('retains the explicit filtered query type %s for blank DTO types', type => {
    const actual = normalizeListedPackage(raw, type);
    expect(actual.packageType).toBe(type);
    expect(actual.roleData).toEqual({ include: [{ roleType: 'ROLE', roleValue: 'ROLE-EXISTING' }] });
    expect(actual.roleDataComplete).toBe(true);
    expect(raw.packageType).toBe('');
  });

  test('does not relabel an explicit type mismatch or an absent type', () => {
    expect(normalizeListedPackage({ ...raw, packageType: 'FORM_PACKAGE_VIEW' }, 'FORM_PACKAGE_START').packageType).toBe('FORM_PACKAGE_VIEW');
    expect(normalizeListedPackage({ ...raw, packageType: undefined }, 'FORM_PACKAGE_START').packageType).toBeUndefined();
  });

  test('verifies members from the platform include-only DTO', () => {
    const actual = normalizeListedPackage(raw, 'FORM_PACKAGE_VIEW');
    const expected = { packageType: 'FORM_PACKAGE_VIEW', roleData: JSON.stringify({ include: [{ roleType: 'ROLE', roleValue: 'ROLE-EXISTING' }] }) };
    expect(verifyPackageDimensions(null, expected, actual, ['roleData']).mismatches).toEqual([]);
    const wrong = normalizeListedPackage({ ...raw, roleMembers: [{ roleType: 'ROLE', roleValue: [{ key: 'OTHER' }] }] }, 'FORM_PACKAGE_VIEW');
    expect(verifyPackageDimensions(null, expected, wrong, ['roleData']).mismatches).toEqual(expect.arrayContaining([expect.objectContaining({ dimension: 'roleData' })]));
  });

  test('preserves native roleData, including exclusions, without replacing it with display members', () => {
    const roleData = JSON.stringify({ include: [{ roleType: 'ROLE', roleValue: 'ROLE-EXISTING' }], exclude: [{ roleType: 'PERSONS', roleValue: 'excluded-user' }] });
    expect(normalizeListedPackage({ ...raw, roleData }, 'FORM_PACKAGE_VIEW').roleData).toBe(roleData);
  });

  test('preserves matrix objects and their complete extension config', () => {
    const roleMembers = [{ roleType: 'MATRIX', roleValue: [{ matrixId: 'matrix', columnId: 'column-1', ext: '{"type":"DEPARTMENT"}' }] }];
    const result = normalizeListedPackage({ ...raw, roleMembers }, 'FORM_PACKAGE_VIEW');
    expect(result.roleData).toEqual({ include: roleMembers });
    expect(result.roleDataComplete).toBe(true);
  });

  test.each([false, true])('reconstructs matrix selections from key and ext.columnId (JSON: %s)', json => {
    const ext = { columnId: 'column-1' };
    const roleMembers = [{ roleType: 'MATRIX', roleValue: [{ key: 'matrix', label: 'Matrix', ext: json ? JSON.stringify(ext) : ext }] }];
    const actual = normalizeListedPackage({ ...raw, roleMembers }, 'FORM_PACKAGE_VIEW');
    expect(actual.roleData).toEqual({ include: [{ roleType: 'MATRIX', roleValue: [{ matrixId: 'matrix', columnId: 'column-1' }] }] });
    expect(actual.roleDataComplete).toBe(true);
  });

  test.each(['DEPARTMENT', 'PARAM', 'PERSONS', 'MANAGER', 'DEFAULT', 'ALL', 'ORIGINATOR'])('converts %s keys without dropping member options', roleType => {
    const result = normalizeListedPackage({ ...raw, roleMembers: [{ roleType, recursive: true,
      roleValue: [{ key: 'corp$-1', label: 'One' }, { key: 'other', label: 'Two', ext: '{}' }] }] }, 'FORM_PACKAGE_VIEW');
    expect(result.roleData).toEqual({ include: [{ roleType, recursive: true, roleValue: 'corp$-1,other' }] });
    expect(result.roleDataComplete).toBe(true);
  });

  test.each([false, true])('preserves exclusions and extensions in member envelopes (JSON: %s)', json => {
    const members = { include: raw.roleMembers, exclude: [{ roleType: 'PERSONS', roleValue: [{ key: 'excluded-user' }] }], mode: 'union' };
    const result = normalizeListedPackage({ ...raw, roleMembers: json ? JSON.stringify(members) : members }, 'FORM_PACKAGE_VIEW');
    expect(result.roleData).toEqual({ include: [{ roleType: 'ROLE', roleValue: 'ROLE-EXISTING' }],
      exclude: [{ roleType: 'PERSONS', roleValue: 'excluded-user' }], mode: 'union' });
    expect(result.roleDataComplete).toBe(true);
    expect(formatPermissions([result])[0].roleData).toEqual(result.roleData);
    expect(members.exclude[0].roleValue).toEqual([{ key: 'excluded-user' }]);
  });

  test.each([undefined, null, 'bad-json', {}, [{ roleType: 'ROLE' }],
    [{ roleType: 'UNKNOWN', roleValue: [{ key: 'unknown' }] }],
    [{ roleType: 'ROLE', roleValue: [{ key: '' }] }],
    [{ roleType: 'ROLE', roleValue: [{ key: 'a,b' }] }],
    [{ roleType: 'ROLE', roleValue: [{ key: 'role', ext: '{"exclude":true}' }] }],
    [{ roleType: 'ROLE', roleValue: [{ key: 'role', filter: 'unreadable' }] }],
    [{ roleType: 'MATRIX', roleValue: [{ key: 'matrix', ext: '{}' }] }],
    [{ roleType: 'MATRIX', roleValue: [{ key: 'matrix', ext: '{"columnId":"column-1","unknownRule":true}' }] }],
    { include: raw.roleMembers, exclude: null },
  ])('marks missing, malformed or lossy member data unreadable: %j', roleMembers => {
    const result = normalizeListedPackage({ ...raw, roleMembers }, 'FORM_PACKAGE_VIEW');
    expect(result.roleDataComplete).toBe(false);
    expect(result.roleData).toBeUndefined();
  });

  test.each(['bad-json', '{}', '{"include":null}', '{"include":[],"exclude":null}'])('does not fall back from invalid native roleData: %s', roleData => {
    const result = normalizeListedPackage({ ...raw, roleData }, 'FORM_PACKAGE_VIEW');
    expect(result.roleData).toBe(roleData);
    expect(result.roleDataComplete).toBe(false);
  });

  test('distinguishes explicit empty rules from missing members', () => {
    const actual = normalizeListedPackage({ ...raw, roleMembers: [] }, 'FORM_PACKAGE_VIEW');
    expect(actual.roleData).toEqual({ include: [] });
    expect(actual.roleDataComplete).toBe(true);
    expect(normalizeListedPackage({ ...raw, roleDataComplete: false }, 'FORM_PACKAGE_VIEW').roleDataComplete).toBe(false);
  });

});
