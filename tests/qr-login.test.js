'use strict';

jest.mock('../lib/core/i18n', () => ({
  t: (key, ...args) => args.length > 0 ? `${key}: ${args.join(', ')}` : key,
}));

jest.mock('../lib/core/chalk', () => ({
  warn: jest.fn(),
}));

const { __test__ } = require('../lib/auth/qr-login');

describe('terminal QR code rendering', () => {
  test('renders QR code directly to stderr without warning prefix', async () => {
    const toString = jest.fn(async () => 'QR_CODE_TEXT');
    const writeFn = jest.fn();
    const warnFn = jest.fn();

    await __test__.renderQrCodeInTerminal('https://login.example/qr?code=abc', {
      qrcode: { toString },
      writeFn,
      warnFn,
    });

    expect(toString).toHaveBeenCalledWith('https://login.example/qr?code=abc', {
      type: 'terminal',
      small: true,
      errorCorrectionLevel: 'M',
    });
    expect(writeFn).toHaveBeenCalledWith('QR_CODE_TEXT\n');
    expect(warnFn).not.toHaveBeenCalled();
  });

  test('preserves qrcode trailing newline when present', async () => {
    const writeFn = jest.fn();

    await __test__.renderQrCodeInTerminal('https://login.example/qr?code=abc', {
      qrcode: { toString: jest.fn(async () => 'QR_CODE_TEXT\n') },
      writeFn,
      warnFn: jest.fn(),
    });

    expect(writeFn).toHaveBeenCalledWith('QR_CODE_TEXT\n');
  });

  test('falls back to URL when qrcode package is unavailable', async () => {
    const writeFn = jest.fn();
    const warnFn = jest.fn();

    await __test__.renderQrCodeInTerminal('https://login.example/qr?code=abc', {
      qrcode: null,
      writeFn,
      warnFn,
    });

    expect(writeFn).not.toHaveBeenCalled();
    expect(warnFn).toHaveBeenCalledWith('qr_login.qrcode_fallback');
    expect(warnFn).toHaveBeenCalledWith('  https://login.example/qr?code=abc');
  });

  test('falls back to URL when qrcode rendering throws', async () => {
    const writeFn = jest.fn();
    const warnFn = jest.fn();

    await __test__.renderQrCodeInTerminal('https://login.example/qr?code=abc', {
      qrcode: { toString: jest.fn(async () => { throw new Error('render failed'); }) },
      writeFn,
      warnFn,
    });

    expect(writeFn).not.toHaveBeenCalled();
    expect(warnFn).toHaveBeenCalledWith('qr_login.qrcode_render_failed: render failed');
    expect(warnFn).toHaveBeenCalledWith('  https://login.example/qr?code=abc');
  });

  test('resolveQrcodeModule tries package name before adjacent install paths', () => {
    const qrcode = { toString: jest.fn() };
    const requireFn = jest.fn((request) => {
      if (request === 'qrcode') {return qrcode;}
      throw new Error(`unexpected request: ${request}`);
    });

    expect(__test__.resolveQrcodeModule(requireFn)).toBe(qrcode);
    expect(requireFn).toHaveBeenCalledWith('qrcode');
    expect(requireFn).toHaveBeenCalledTimes(1);
  });
});

describe('DingTalk OAuth organization selection', () => {
  test('normalizes OAuth organization list', () => {
    expect(__test__.normalizeDingtalkOAuthOrgList([
      { corpId: 'ding-main', name: 'Main Org', mainOrg: true },
      { id: 'ding-alt', corpName: 'Alt Org' },
      { name: 'Missing ID' },
    ])).toEqual([
      { corpId: 'ding-main', corpName: 'Main Org', mainOrg: true },
      { corpId: 'ding-alt', corpName: 'Alt Org', mainOrg: false },
    ]);
  });

  test('detects OAuth responses that require organization selection', () => {
    expect(__test__.shouldChooseDingtalkOAuthOrganization({
      chooseOrganization: true,
      orgList: [{ corpId: 'ding-main' }],
    })).toBe(true);

    expect(__test__.shouldChooseDingtalkOAuthOrganization({
      chooseOrganization: false,
      orgList: [{ corpId: 'ding-main' }],
    })).toBe(false);
  });

  test('selects OAuth organization by explicit corpId without prompting', async () => {
    const selectCorp = jest.fn();
    await expect(__test__.resolveCorpSelection([
      { corpId: 'ding-main', corpName: 'Main Org' },
      { corpId: 'ding-alt', corpName: 'Alt Org' },
    ], {
      corpId: 'ding-alt',
      selectCorp,
    })).resolves.toEqual({ corpId: 'ding-alt', corpName: 'Alt Org' });

    expect(selectCorp).not.toHaveBeenCalled();
  });

  test('fails when explicit corpId is not in OAuth organization list', async () => {
    await expect(__test__.resolveCorpSelection([
      { corpId: 'ding-main', corpName: 'Main Org' },
    ], {
      corpId: 'ding-missing',
      selectCorp: jest.fn(),
    })).rejects.toThrow('qr_login.target_corp_not_found: ding-missing');
  });

  test('retries OAuth login with selected exclusiveCorpId before following redirect', async () => {
    const loginResult = {
      chooseOrganization: true,
      orgList: [
        { corpId: 'ding-main', name: 'Main Org', mainOrg: true },
        { corpId: 'ding-alt', name: 'Alt Org' },
      ],
    };
    const context = {
      loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge?client_id=abc',
      origin: 'https://login.dingtalk.com',
      code: 'qr-code',
    };
    const selectCorp = jest.fn(async (corpList) => corpList[1]);
    const postLoginWithQr = jest.fn(async () => ({
      cookieHeader: 'sid=next',
      parsed: {
        success: true,
        result: 'https://www.aliwork.com/oauth/callback?ticket=ok',
      },
    }));
    const fetchGetFollowRedirects = jest.fn(async () => ({
      cookieHeader: 'tianshu_csrf_token=token; tianshu_corp_user=ding-alt_user',
      finalUrl: 'https://www.aliwork.com/workPlatform',
    }));

    const result = await __test__.exchangeDingtalkOAuthResult(
      'https://www.aliwork.com',
      loginResult,
      'sid=old',
      context,
      { selectCorp, postLoginWithQr, fetchGetFollowRedirects }
    );

    expect(selectCorp).toHaveBeenCalledWith([
      { corpId: 'ding-main', corpName: 'Main Org', mainOrg: true },
      { corpId: 'ding-alt', corpName: 'Alt Org', mainOrg: false },
    ]);
    expect(postLoginWithQr).toHaveBeenCalledWith(context, 'sid=old', {
      exclusiveCorpId: 'ding-alt',
    });
    expect(fetchGetFollowRedirects).toHaveBeenCalledWith(
      'https://www.aliwork.com/oauth/callback?ticket=ok',
      {
        cookieHeader: 'sid=next',
        referer: context.loginPageUrl,
      }
    );
    expect(result).toEqual({
      cookieHeader: 'tianshu_csrf_token=token; tianshu_corp_user=ding-alt_user',
      baseUrl: 'https://www.aliwork.com',
      selectedCorp: { corpId: 'ding-alt', corpName: 'Alt Org', mainOrg: false },
    });
  });

  test('retries OAuth login with explicit corpId when provided', async () => {
    const selectCorp = jest.fn();
    const postLoginWithQr = jest.fn(async () => ({
      cookieHeader: 'sid=next',
      parsed: {
        success: true,
        result: 'https://www.aliwork.com/oauth/callback?ticket=ok',
      },
    }));
    const fetchGetFollowRedirects = jest.fn(async () => ({
      cookieHeader: 'tianshu_csrf_token=token; tianshu_corp_user=ding-main_user',
      finalUrl: 'https://www.aliwork.com/workPlatform',
    }));

    const result = await __test__.exchangeDingtalkOAuthResult(
      'https://www.aliwork.com',
      {
        chooseOrganization: true,
        orgList: [
          { corpId: 'ding-main', name: 'Main Org' },
          { corpId: 'ding-alt', name: 'Alt Org' },
        ],
      },
      'sid=old',
      {
        loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge?client_id=abc',
        origin: 'https://login.dingtalk.com',
        code: 'qr-code',
      },
      {
        corpId: 'ding-main',
        selectCorp,
        postLoginWithQr,
        fetchGetFollowRedirects,
      }
    );

    expect(selectCorp).not.toHaveBeenCalled();
    expect(postLoginWithQr).toHaveBeenCalledWith(expect.any(Object), 'sid=old', {
      exclusiveCorpId: 'ding-main',
    });
    expect(result.selectedCorp).toEqual({
      corpId: 'ding-main',
      corpName: 'Main Org',
      mainOrg: false,
    });
  });
});
