'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const workflow = yaml.load(read('.github/workflows/issue-welcome.yml'));
const script = workflow.jobs.welcome.steps[0].with.script;
const executeWelcome = new (Object.getPrototypeOf(async function () {}).constructor)('github', 'context', script);

function fixture() {
  const context = {
    eventName: 'issues', repo: { owner: 'openyida', repo: 'openyida' },
    payload: { action: 'opened', issue: { number: 123, user: { type: 'User' } } },
  };
  const github = {
    paginate: jest.fn().mockResolvedValue([]),
    rest: { issues: {
      get: jest.fn().mockResolvedValue({ data: { state: 'open', locked: false } }),
      listComments: jest.fn(),
      createComment: jest.fn().mockResolvedValue({ data: { id: 1 } }),
    } },
  };
  return { context, github };
}

test('issue forms accept unknown environments and require only the core description and privacy check', () => {
  for (const name of ['bug_report', 'feature_request']) {
    const form = yaml.load(read(`.github/ISSUE_TEMPLATE/${name}.yml`));
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    expect(new Set(form.body.filter(x => x.id).map(x => x.id)).size).toBe(form.body.filter(x => x.id).length);
    expect(form.body.filter(x => x.validations?.required).map(x => x.id))
      .toEqual(name === 'bug_report' ? ['goal', 'actual'] : ['goal', 'expected']);
    expect(form.body.find(x => x.id === 'environment').validations?.required).not.toBe(true);
    expect(form.body.find(x => x.id === 'privacy').attributes.options[0].required).toBe(true);
    expect(fs.existsSync(path.join(root, `.github/ISSUE_TEMPLATE/${name}.md`))).toBe(false);
  }
});

test('welcome workflow has only issue access and never checks out or interpolates untrusted content', () => {
  expect(workflow.on).toEqual({ issues: { types: ['opened'] } });
  expect(workflow.permissions).toEqual({ issues: 'write' });
  expect(workflow.concurrency['cancel-in-progress']).toBe(false);
  expect(workflow.concurrency.group).toContain('github.event.issue.number');
  expect(workflow.jobs.welcome.steps).toHaveLength(1);
  expect(workflow.jobs.welcome.steps[0].uses).toMatch(/^actions\/github-script@[a-f0-9]{40}$/);
  expect(script).not.toContain('${{');
  expect(script).not.toMatch(/require\(|eval\(|exec\(|issue\.(?:body|title)/);
});

test('welcomes a read-back issue once, with no pressure or private content', async () => {
  const { github, context } = fixture();
  context.payload.issue.title = 'untrusted secret title';
  context.payload.issue.body = '"; throw new Error("untrusted"); // private data';
  await executeWelcome(github, context);
  expect(github.rest.issues.get).toHaveBeenCalledWith({ owner: 'openyida', repo: 'openyida', issue_number: 123 });
  expect(github.paginate).toHaveBeenCalledWith(github.rest.issues.listComments, expect.objectContaining({ per_page: 100 }));
  const comment = github.rest.issues.createComment.mock.calls[0][0];
  expect(comment.body).toContain('只反馈问题也完全可以');
  expect(comment.body).toContain('我的个人 Fork');
  expect(comment.body).not.toContain('untrusted');
  expect(comment.body).not.toContain('private data');
  github.paginate.mockResolvedValue([{ body: comment.body, user: { type: 'Bot', login: 'github-actions[bot]' } }]);
  await executeWelcome(github, context);
  expect(github.rest.issues.createComment).toHaveBeenCalledTimes(1);
});

test('does not let a user-supplied marker impersonate the welcome bot', async () => {
  const { github, context } = fixture();
  github.paginate.mockResolvedValue([{ body: '<!-- openyida-contribution-welcome-v1 -->', user: { type: 'User', login: 'someone' } }]);
  await executeWelcome(github, context);
  expect(github.rest.issues.createComment).toHaveBeenCalledTimes(1);
});

test.each(['bot', 'pullRequest', 'reopened', 'fork', 'closed', 'locked'])('skips %s without a comment', async kind => {
  const { github, context } = fixture();
  if (kind === 'bot') {context.payload.issue.user.type = 'Bot';}
  if (kind === 'pullRequest') {context.payload.issue.pull_request = {};}
  if (kind === 'reopened') {context.payload.action = 'reopened';}
  if (kind === 'fork') {context.repo.owner = 'someone';}
  if (kind === 'closed') {github.rest.issues.get.mockResolvedValue({ data: { state: 'closed' } });}
  if (kind === 'locked') {github.rest.issues.get.mockResolvedValue({ data: { state: 'open', locked: true } });}
  await executeWelcome(github, context);
  expect(github.rest.issues.createComment).not.toHaveBeenCalled();
});

test('fails before posting on read errors; uncertain writes are reconciled on rerun', async () => {
  const { github, context } = fixture();
  github.paginate.mockRejectedValueOnce(new Error('read unavailable'));
  await expect(executeWelcome(github, context)).rejects.toThrow('read unavailable');
  expect(github.rest.issues.createComment).not.toHaveBeenCalled();
  github.rest.issues.createComment.mockRejectedValueOnce(new Error('timeout'));
  await expect(executeWelcome(github, context)).rejects.toThrow('timeout');
  const body = github.rest.issues.createComment.mock.calls[0][0].body;
  github.paginate.mockResolvedValue([{ body, user: { type: 'Bot', login: 'github-actions[bot]' } }]);
  await executeWelcome(github, context);
  expect(github.rest.issues.createComment).toHaveBeenCalledTimes(1);
});

test('beginner guidance preserves consent, public-source boundaries and optional PR paths', () => {
  const interaction = read('yida-skills/skills/yida-feedback/references/user-interaction.md');
  for (const rule of ['仅在 Issue 创建成功且读回完整后', '用户已拒绝贡献时跳过', '用户未回答时', '只读分析', 'reviewDigest', '个人 Fork']) {
    expect(interaction).toContain(rule);
  }
  const contribution = read('yida-skills/skills/yida-feedback/references/github-contribution.md');
  expect(contribution).toContain('Issue 提交主流程不插入 Star/Fork 邀请');
  expect(contribution).toContain('不 force push');
  expect(contribution).toContain('不能把用户业务源码');
  expect(read('CONTRIBUTING.md')).toContain('<a id="ai-help"></a>');
  expect(read('.github/PULL_REQUEST_TEMPLATE.md').match(/^## /gm)).toHaveLength(4);
});

test('account setup reference is discoverable from each submission entry and local links resolve', () => {
  const skillDir = 'yida-skills/skills/yida-feedback';
  for (const file of ['SKILL.md', 'references/user-interaction.md', 'references/github-contribution.md']) {
    const content = read(`${skillDir}/${file}`);
    const links = [...content.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
    expect(links.some(link => link.endsWith('github-setup.md'))).toBe(true);
  }
  const files = ['SKILL.md', ...fs.readdirSync(path.join(root, skillDir, 'references'))
    .filter(file => file.endsWith('.md')).map(file => `references/${file}`)];
  for (const file of files) {
    const content = read(`${skillDir}/${file}`);
    for (const [, link] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:\/\//.test(link)) {continue;}
      expect(fs.existsSync(path.resolve(root, skillDir, path.dirname(file), link.split('#')[0]))).toBe(true);
    }
  }
});
