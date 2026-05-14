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

  test('writes QR image for Codex handoff when qrcode supports toFile', async () => {
    const toFile = jest.fn(async () => {});

    const result = await __test__.writeQrCodeImage('https://login.example/qr?code=abc', '/tmp/qr.png', {
      qrcode: { toFile },
    });

    expect(result).toBe(true);
    expect(toFile).toHaveBeenCalledWith('/tmp/qr.png', 'https://login.example/qr?code=abc', {
      type: 'png',
      margin: 2,
      width: 360,
      errorCorrectionLevel: 'M',
    });
  });

  test('builds Codex native single-select interaction for organizations', () => {
    const interaction = __test__.buildCodexCorpInteraction([
      { corpId: 'ding-main', corpName: 'Main Org', mainOrg: true },
      { corpId: 'ding-alt', corpName: 'Alt Org' },
    ]);

    expect(interaction).toEqual({
      type: 'single_select',
      title: '选择宜搭组织',
      options: [
        { label: 'Main Org（主组织）', value: 'ding-main', description: 'ding-main' },
        { label: 'Alt Org', value: 'ding-alt', description: 'ding-alt' },
      ],
    });
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

  test('builds OAuth post data with corpId organization selection parameter', () => {
    const postData = __test__.buildOAuthPostData(
      'https://login.dingtalk.com/oauth2/challenge?client_id=abc&scope=openid%20corpid',
      { code: 'qr-code', corpId: 'ding-main', stayLogin: false }
    );

    const params = new URLSearchParams(postData);
    expect(params.get('client_id')).toBe('abc');
    expect(params.get('scope')).toBe('openid corpid');
    expect(params.get('code')).toBe('qr-code');
    expect(params.get('corpId')).toBe('ding-main');
    expect(params.has('exclusiveCorpId')).toBe(false);
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

  test('confirms OAuth auth with selected corpId without requiring a second QR scan', async () => {
    const loginResult = {
      chooseOrganization: true,
      secondaryValidationResult: 'secondary-ok',
      orgList: [
        { corpId: 'ding-main', name: 'Main Org', mainOrg: true },
        { corpId: 'ding-alt', name: 'Alt Org' },
      ],
    };
    const context = {
      loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge.htm?client_id=abc&redirect_uri=https%3A%2F%2Fwww.aliwork.com%2Fdingtalk_sso_call_back',
      origin: 'https://login.dingtalk.com',
      code: 'qr-code',
    };
    const selectCorp = jest.fn(async (corpList) => corpList[1]);
    const fetchPost = jest.fn(async () => ({
      cookies: ['dd_sso=next; Path=/; HttpOnly'],
      body: JSON.stringify({
        success: true,
        result: {
          url: 'https://www.aliwork.com/oauth/callback?ticket=ok',
        },
      }),
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
      { selectCorp, fetchPost, fetchGetFollowRedirects }
    );

    expect(selectCorp).toHaveBeenCalledWith([
      { corpId: 'ding-main', corpName: 'Main Org', mainOrg: true },
      { corpId: 'ding-alt', corpName: 'Alt Org', mainOrg: false },
    ]);
    expect(fetchPost).toHaveBeenCalledTimes(1);
    expect(fetchPost).toHaveBeenCalledWith(
      'https://login.dingtalk.com/oauth2/confirm_auth',
      expect.any(String),
      {
        cookieHeader: 'sid=old',
        referer: context.loginPageUrl,
        origin: context.origin,
      }
    );
    const confirmParams = new URLSearchParams(fetchPost.mock.calls[0][1]);
    expect(confirmParams.get('client_id')).toBe('abc');
    expect(confirmParams.get('corpId')).toBe('ding-alt');
    expect(confirmParams.get('secondaryValidationResult')).toBe('secondary-ok');
    expect(fetchGetFollowRedirects).toHaveBeenCalledWith(
      'https://www.aliwork.com/oauth/callback?ticket=ok',
      {
        cookieHeader: 'sid=old; dd_sso=next',
        referer: context.loginPageUrl,
      }
    );
    expect(result).toEqual({
      cookieHeader: 'tianshu_csrf_token=token; tianshu_corp_user=ding-alt_user',
      baseUrl: 'https://www.aliwork.com',
      selectedCorp: { corpId: 'ding-alt', corpName: 'Alt Org', mainOrg: false },
    });
  });

  test('confirms OAuth auth with explicit corpId when provided', async () => {
    const selectCorp = jest.fn();
    const fetchPost = jest.fn(async () => ({
      cookies: ['dd_sso=next; Path=/; HttpOnly'],
      body: JSON.stringify({
        success: true,
        result: {
          url: 'https://www.aliwork.com/oauth/callback?ticket=ok',
        },
      }),
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
        loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge.htm?client_id=abc&redirect_uri=https%3A%2F%2Fwww.aliwork.com%2Fdingtalk_sso_call_back',
        origin: 'https://login.dingtalk.com',
        code: 'qr-code',
      },
      {
        corpId: 'ding-main',
        selectCorp,
        fetchPost,
        fetchGetFollowRedirects,
      }
    );

    expect(selectCorp).not.toHaveBeenCalled();
    expect(fetchPost).toHaveBeenCalledTimes(1);
    const confirmParams = new URLSearchParams(fetchPost.mock.calls[0][1]);
    expect(confirmParams.get('client_id')).toBe('abc');
    expect(confirmParams.get('corpId')).toBe('ding-main');
    expect(result.selectedCorp).toEqual({
      corpId: 'ding-main',
      corpName: 'Main Org',
      mainOrg: false,
    });
  });

  test('confirms OAuth auth when QR login returns pass result without redirect URL', async () => {
    const loginResult = {
      pass: true,
      corpId: 'ding-main',
      secondaryValidationResult: 'secondary-ok',
      nick: 'Tester',
    };
    const context = {
      loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge.htm?client_id=abc&redirect_uri=https%3A%2F%2Fwww.aliwork.com%2Fdingtalk_sso_call_back%3Fcontinue%3Dhttps%253A%252F%252Fwww.aliwork.com%252FworkPlatform',
      origin: 'https://login.dingtalk.com',
      code: 'qr-code',
    };
    const fetchPost = jest.fn(async () => ({
      cookies: ['dd_sso=next; Path=/; HttpOnly'],
      body: JSON.stringify({
        success: true,
        result: {
          url: 'https://www.aliwork.com/dingtalk_sso_call_back?code=ok',
        },
      }),
    }));
    const fetchGetFollowRedirects = jest.fn(async () => ({
      cookieHeader: 'tianshu_csrf_token=token; tianshu_corp_user=ding-main_user',
      finalUrl: 'https://www.aliwork.com/workPlatform',
    }));

    const result = await __test__.exchangeDingtalkOAuthResult(
      'https://www.aliwork.com',
      loginResult,
      'sid=old',
      context,
      { fetchPost, fetchGetFollowRedirects }
    );

    expect(fetchPost).toHaveBeenCalledWith(
      'https://login.dingtalk.com/oauth2/confirm_auth',
      expect.any(String),
      {
        cookieHeader: 'sid=old',
        referer: context.loginPageUrl,
        origin: context.origin,
      }
    );
    const confirmParams = new URLSearchParams(fetchPost.mock.calls[0][1]);
    expect(confirmParams.get('client_id')).toBe('abc');
    expect(confirmParams.get('corpId')).toBe('ding-main');
    expect(confirmParams.get('secondaryValidationResult')).toBe('secondary-ok');
    expect(confirmParams.get('redirect_uri')).toBe(
      'https://www.aliwork.com/dingtalk_sso_call_back?continue=https%3A%2F%2Fwww.aliwork.com%2FworkPlatform'
    );
    expect(fetchGetFollowRedirects).toHaveBeenCalledWith(
      'https://www.aliwork.com/dingtalk_sso_call_back?code=ok',
      {
        cookieHeader: 'sid=old; dd_sso=next',
        referer: context.loginPageUrl,
      }
    );
    expect(result).toEqual({
      cookieHeader: 'tianshu_csrf_token=token; tianshu_corp_user=ding-main_user',
      baseUrl: 'https://www.aliwork.com',
      selectedCorp: null,
    });
  });

  test('uses explicit corpId on the first OAuth polling request', async () => {
    const context = {
      loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge?client_id=abc',
      origin: 'https://login.dingtalk.com',
      code: 'qr-code',
    };
    const postLoginWithQr = jest.fn(async () => ({
      cookieHeader: 'sid=next',
      parsed: {
        success: true,
        result: 'https://www.aliwork.com/oauth/callback?ticket=ok',
      },
    }));

    const result = await __test__.pollDingtalkQrCodeStatus(
      'qr-code',
      'sid=old',
      null,
      context,
      {
        corpId: 'ding-main',
        maxAttempts: 1,
        pollIntervalMs: 0,
        postLoginWithQr,
      }
    );

    expect(postLoginWithQr).toHaveBeenCalledWith(context, 'sid=old', {
      code: 'qr-code',
      corpId: 'ding-main',
      stayLogin: false,
    });
    expect(result).toEqual({
      loginResult: 'https://www.aliwork.com/oauth/callback?ticket=ok',
      cookieHeader: 'sid=next',
    });
  });

  test('keeps polling when explicit corpId is waiting for matching organization scan', async () => {
    const context = {
      loginPageUrl: 'https://login.dingtalk.com/oauth2/challenge?client_id=abc',
      origin: 'https://login.dingtalk.com',
      code: 'qr-code',
    };
    const postLoginWithQr = jest.fn()
      .mockResolvedValueOnce({
        cookieHeader: 'sid=waiting',
        parsed: {
          success: false,
          errorMsg: '请以对应组织的企业账号进行扫码认证',
        },
      })
      .mockResolvedValueOnce({
        cookieHeader: 'sid=next',
        parsed: {
          success: true,
          result: 'https://www.aliwork.com/oauth/callback?ticket=ok',
        },
      });
    const onWaiting = jest.fn();

    const result = await __test__.pollDingtalkQrCodeStatus(
      'qr-code',
      'sid=old',
      onWaiting,
      context,
      {
        corpId: 'ding-main',
        maxAttempts: 2,
        pollIntervalMs: 0,
        postLoginWithQr,
      }
    );

    expect(onWaiting).toHaveBeenCalledWith('scanned');
    expect(postLoginWithQr).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      loginResult: 'https://www.aliwork.com/oauth/callback?ticket=ok',
      cookieHeader: 'sid=next',
    });
  });

  test('derives internal Yida base URL from Alibaba intranet OAuth redirect', () => {
    expect(__test__.deriveAliworkBaseUrl(
      'https://www.aliwork.com',
      'https://yida-group.alibaba-inc.com/workPlatform'
    )).toBe('https://yida-group.alibaba-inc.com');
  });

  test('keeps configured base URL when redirect is not a Yida service host', () => {
    expect(__test__.deriveAliworkBaseUrl(
      'https://yida.company.example',
      'https://login.dingtalk.com/oauth2/challenge'
    )).toBe('https://yida.company.example');
  });
});
