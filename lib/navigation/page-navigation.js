'use strict';

// Portable: publish injects this exact implementation into the page utility bridge.
function createPageNavigation(win) {
  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  function normalize(input, options) {
    const value = input && typeof input === 'object' && !Array.isArray(input) ? input.url : input;
    if (typeof value !== 'string' || !value.trim()) { fail('PAGE_URL_INVALID'); }
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) { fail('PAGE_OPEN_OPTIONS_INVALID'); }
    const mode = (options && options.mode) || 'auto';
    if (!['auto', 'dingtalk', 'browser'].includes(mode)) { fail('PAGE_OPEN_MODE_INVALID'); }
    let url;
    try { url = new URL(value, win.location.href || win.location.origin); } catch { fail('PAGE_URL_INVALID'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) { fail('PAGE_URL_INVALID'); }
    const inDingTalk = /dingtalk/i.test((win.navigator && win.navigator.userAgent) || '');
    const useDingTalk = mode === 'dingtalk' || (mode === 'auto' && inDingTalk);
    if (useDingTalk) { url.searchParams.set('ddtab', 'true'); }
    return { url: url.href, mode, inDingTalk, useDingTalk };
  }
  function invokeNative(invoke, url) {
    return new Promise((resolve, reject) => {
      function success(value) { clearTimeout(timer); resolve(value); }
      function rejectOpen(reason) {
        clearTimeout(timer);
        const error = new Error('DINGTALK_OPEN_FAILED');
        error.code = 'DINGTALK_OPEN_FAILED';
        error.cause = reason;
        reject(error);
      }
      const timer = setTimeout(() => rejectOpen('timeout'), 15000);
      try {
        const result = invoke({ url, onSuccess: success, onFail: rejectOpen });
        if (result && typeof result.then === 'function') { result.then(success, rejectOpen); }
      } catch (error) { rejectOpen(error); }
    });
  }
  async function open(input, options) {
    const target = normalize(input, options);
    if (!target.useDingTalk) {
      win.open(target.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!target.inDingTalk) { fail('DINGTALK_ENV_REQUIRED'); }
    // Use the publishing host's bridge. Do not scan parent DOM or cross-origin windows.
    const dd = win.dd;
    if (dd && dd.env && dd.env.platform === 'notInDingTalk') { fail('DINGTALK_API_UNAVAILABLE'); }
    if (dd && dd.biz && dd.biz.util && typeof dd.biz.util.openLink === 'function') {
      return invokeNative(options => dd.biz.util.openLink(options), target.url);
    }
    if (win.Ali && typeof win.Ali.pushWindow === 'function') {
      return invokeNative(options => win.Ali.pushWindow(options), target.url);
    }
    fail('DINGTALK_API_UNAVAILABLE');
  }
  return { normalize, open };
}

module.exports = { createPageNavigation };
