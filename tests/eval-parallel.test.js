'use strict';

const parallel = require('../scripts/eval/parallel');
const path = require('path');
const fs = require('fs');

describe('parallel module', function () {
  describe('cacheKey', function () {
    it('should produce consistent hash for same inputs', function () {
      const k1 = parallel.cacheKey('context-a', 'prompt-a');
      const k2 = parallel.cacheKey('context-a', 'prompt-a');
      expect(k1).toBe(k2);
      expect(k1.length).toBe(16); // 16-char hex
    });

    it('should produce different hashes for different inputs', function () {
      const k1 = parallel.cacheKey('context-a', 'prompt-a');
      const k2 = parallel.cacheKey('context-a', 'prompt-b');
      const k3 = parallel.cacheKey('context-b', 'prompt-a');
      expect(k1).not.toBe(k2);
      expect(k1).not.toBe(k3);
    });

    it('should handle empty strings', function () {
      const k = parallel.cacheKey('', '');
      expect(k.length).toBe(16);
    });
  });

  describe('buildBatchRoutingPrompt', function () {
    it('should build a prompt containing all scenarios', function () {
      const prompt = parallel.buildBatchRoutingPrompt({
        scenarios: [
          { id: 'test-1', prompt: '帮我创建一个表单' },
          { id: 'test-2', prompt: '创建一个审批流程' },
          { id: 'test-3', prompt: '做一个数据看板' },
        ],
        routingContext: '这是路由说明...',
        skillNames: ['yida-form', 'yida-process', 'yida-dashboard'],
      });

      expect(prompt).toContain('路由说明文档');
      expect(prompt).toContain('这是路由说明...');
      expect(prompt).toContain('3 条');
      expect(prompt).toContain('test-1');
      expect(prompt).toContain('test-2');
      expect(prompt).toContain('test-3');
      expect(prompt).toContain('帮我创建一个表单');
      expect(prompt).toContain('JSON 数组');
      expect(prompt).toContain('yida-form');
    });

    it('should handle single scenario', function () {
      const prompt = parallel.buildBatchRoutingPrompt({
        scenarios: [{ id: 's-1', prompt: '创建应用' }],
        routingContext: '',
        skillNames: ['yida-app'],
      });
      expect(prompt).toContain('1 条');
      expect(prompt).toContain('s-1');
    });

    it('should handle empty scenarios', function () {
      const prompt = parallel.buildBatchRoutingPrompt({
        scenarios: [],
        routingContext: '',
        skillNames: [],
      });
      expect(prompt).toContain('0 条');
    });
  });

  describe('parseBatchRoutingResponse', function () {
    it('should parse JSON array from response text', function () {
      const text = '```json\n[{"id":"t1","skill":"yida-form"},{"id":"t2","skill":"yida-dashboard"}]\n```';
      const results = parallel.parseBatchRoutingResponse(text);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('t1');
      expect(results[0].skill).toBe('yida-form');
      expect(results[1].id).toBe('t2');
      expect(results[1].skill).toBe('yida-dashboard');
    });

    it('should parse JSON array without fenced block', function () {
      const text = 'Here are the results:\n[{"id":"a","skill":"yida-app","reason":"test"}]';
      const results = parallel.parseBatchRoutingResponse(text);
      expect(results).toHaveLength(1);
      expect(results[0].skill).toBe('yida-app');
    });

    it('should handle empty/null input', function () {
      expect(parallel.parseBatchRoutingResponse(null)).toEqual([]);
      expect(parallel.parseBatchRoutingResponse('')).toEqual([]);
    });

    it('should handle malformed JSON gracefully', function () {
      const results = parallel.parseBatchRoutingResponse('not json at all');
      expect(results).toEqual([]);
    });

    it('should extract individual JSON objects as fallback', function () {
      const text = 'Result 1: {"id":"x","skill":"yida-form"} and Result 2: {"id":"y","skill":"yida-app"}';
      const results = parallel.parseBatchRoutingResponse(text);
      expect(results).toHaveLength(2);
    });
  });

  describe('runWithConcurrency', function () {
    it('should run tasks in parallel with limited concurrency', async function () {
      const order = [];
      const tasks = [1, 2, 3, 4, 5].map(function (n) {
        return function () {
          return new Promise(function (resolve) {
            order.push('start-' + n);
            setTimeout(function () {
              order.push('end-' + n);
              resolve(n * 10);
            }, 10);
          });
        };
      });

      const results = await parallel.runWithConcurrency(tasks, 2);
      expect(results).toEqual([10, 20, 30, 40, 50]);
      // First 2 should start before any end
      expect(order.indexOf('start-1')).toBeLessThan(order.indexOf('end-1'));
      expect(order.indexOf('start-2')).toBeLessThan(order.indexOf('end-2'));
    });

    it('should handle empty task list', async function () {
      const results = await parallel.runWithConcurrency([], 4);
      expect(results).toEqual([]);
    });

    it('should preserve order regardless of completion time', async function () {
      const tasks = [
        function () { return new Promise(function (r) { setTimeout(function () { r('slow'); }, 30); }); },
        function () { return new Promise(function (r) { setTimeout(function () { r('fast'); }, 5); }); },
        function () { return new Promise(function (r) { setTimeout(function () { r('mid'); }, 15); }); },
      ];
      const results = await parallel.runWithConcurrency(tasks, 3);
      expect(results).toEqual(['slow', 'fast', 'mid']);
    });

    it('should respect concurrency limit', async function () {
      let active = 0;
      let maxActive = 0;
      const tasks = Array.from({ length: 8 }, function (_, i) {
        return function () {
          active++;
          maxActive = Math.max(maxActive, active);
          return new Promise(function (resolve) {
            setTimeout(function () {
              active--;
              resolve(i);
            }, 10);
          });
        };
      });

      await parallel.runWithConcurrency(tasks, 3);
      expect(maxActive).toBeLessThanOrEqual(3);
    });
  });

  describe('cache operations', function () {
    const testKey = '__test_cache_' + Date.now();

    afterAll(function () {
      // Cleanup test cache file
      try {
        fs.unlinkSync(path.join(parallel.CACHE_DIR, testKey + '.json'));
      } catch (_e) { /* ignore */ }
    });

    it('should return null for missing cache', function () {
      expect(parallel.loadCached('nonexistent-key-xyz')).toBeNull();
    });

    it('should save and load cached results', function () {
      const data = { id: 'test', skill: 'yida-app', status: 'ok' };
      parallel.saveToCache(testKey, data);
      const loaded = parallel.loadCached(testKey);
      expect(loaded).toBeDefined();
      expect(loaded.id).toBe('test');
      expect(loaded.skill).toBe('yida-app');
      expect(loaded._ts).toBeDefined();
    });
  });

  describe('runParallelRouting', function () {
    it('should return immediately if all results are cached', async function () {
      const scenarios = [
        { id: 'cached-1', prompt: 'test prompt 1', expectedSkill: 'yida-form' },
      ];
      const ctx = '__test_routing_context__';

      // Pre-populate cache
      const key = parallel.cacheKey(ctx, 'test prompt 1');
      parallel.saveToCache(key, { id: 'cached-1', expected: 'yida-form', actual: 'yida-form', hit: true, status: 'ok' });

      const { results, stats } = await parallel.runParallelRouting({
        scenarios: scenarios,
        routingContext: ctx,
        skillNames: ['yida-form'],
        useCache: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0]._cached).toBe(true);
      expect(stats.cached).toBe(1);
      expect(stats.agentCalls).toBe(0);

      // Cleanup
      try { fs.unlinkSync(path.join(parallel.CACHE_DIR, key + '.json')); } catch (_e) { /* */ }
    });

    it('should handle agent unavailable with early bail', async function () {
      const scenarios = [
        { id: 'u-1', prompt: 'p1', expectedSkill: 'yida-form' },
        { id: 'u-2', prompt: 'p2', expectedSkill: 'yida-app' },
      ];

      const { results } = await parallel.runParallelRouting({
        scenarios: scenarios,
        routingContext: '',
        skillNames: ['yida-form', 'yida-app'],
        agentCommand: 'nonexistent-agent-command-xyz',
        useCache: false,
        batchSize: 1,
        concurrency: 1,
      });

      expect(results).toHaveLength(2);
      // Both should be agent-unavailable or agent-error
      for (let i = 0; i < results.length; i++) {
        expect(['agent-unavailable', 'agent-error']).toContain(results[i].status);
      }
    });
  });

  describe('constants', function () {
    it('should export expected defaults', function () {
      expect(parallel.DEFAULT_BATCH_SIZE).toBe(5);
      expect(parallel.DEFAULT_CONCURRENCY).toBe(4);
    });
  });
});
