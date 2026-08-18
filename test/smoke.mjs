/**
 * dsh-prompt-order 冒烟测试
 *
 * 模拟 cordis 的 ctx.on('agent/pre-step', handler, prepend) 注册方式，
 * 验证：
 * 1. 插件确实以 prepend:true 注册为最外层 Waterfall 处理器；
 * 2. 按 source.kind / dsh-mnemon 插件来源稳定排序；
 * 3. 未知来源排在最后；
 * 4. reject 决策原样透传，不排序；
 * 5. 自定义 order 生效。
 */
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

/** 构造最小 ctx：只记录事件注册信息。 */
function createMockContext() {
  const listeners = []
  return {
    listeners,
    on(event, handler, prepend) {
      listeners.push({ event, handler, prepend })
    },
  }
}

/** 从 mock ctx 中取出 agent/pre-step 处理器。 */
function getPreStepHandler(mock) {
  const entry = mock.listeners.find((l) => l.event === 'agent/pre-step')
  assert.ok(entry, '应当注册 agent/pre-step 监听器')
  assert.equal(entry.prepend, true, '监听器必须使用 prepend:true')
  return entry.handler
}

/** 运行一轮排序，返回排序后的消息 id 列表。 */
async function runSort(handler, messages, decisionKind = 'enter') {
  const decision = { kind: decisionKind, messages }
  const result = await handler({}, async () => decision)
  return result
}

// 用例 1：默认顺序排序
{
  const ctx = createMockContext()
  apply(ctx) // 不传 config，使用代码内默认顺序
  const handler = getPreStepHandler(ctx)

  const input = [
    { id: 'user', source: { kind: 'user' } },
    { id: 'skill', source: { kind: 'skill-catalog' } },
    { id: 'mnemon', source: { kind: 'plugin', plugin: 'dsh-mnemon' } },
    { id: 'unknown', source: { kind: 'other' } },
    { id: 'agent', source: { kind: 'agent-instructions' } },
  ]

  const result = await runSort(handler, input)
  assert.deepEqual(
    result.messages.map((m) => m.id),
    ['agent', 'skill', 'mnemon', 'user', 'unknown'],
    '默认顺序应为 agent-instructions → skill-catalog → mnemon → user → 未知',
  )
  assert.equal(result.kind, 'enter', 'enter 决策应被保留')
}

// 用例 2：reject 决策透传，不排序
{
  const ctx = createMockContext()
  apply(ctx)
  const handler = getPreStepHandler(ctx)

  const rejectDecision = { kind: 'reject', reason: 'deny' }
  const result = await handler({}, async () => rejectDecision)
  assert.equal(result, rejectDecision, 'reject 决策应原样返回')
}

// 用例 3：同 rank 保持稳定（不改变原有相对顺序）
{
  const ctx = createMockContext()
  apply(ctx)
  const handler = getPreStepHandler(ctx)

  const input = [
    { id: 'user-1', source: { kind: 'user' } },
    { id: 'skill-1', source: { kind: 'skill-catalog' } },
    { id: 'user-2', source: { kind: 'user' } },
    { id: 'skill-2', source: { kind: 'skill-catalog' } },
  ]

  const result = await runSort(handler, input)
  assert.deepEqual(
    result.messages.map((m) => m.id),
    ['skill-1', 'skill-2', 'user-1', 'user-2'],
    '同 rank 消息应保持原有顺序',
  )
}

// 用例 4：自定义 order 生效
{
  const ctx = createMockContext()
  apply(ctx, { order: ['user', 'mnemon', 'skill-catalog', 'agent-instructions'] })
  const handler = getPreStepHandler(ctx)

  const input = [
    { id: 'agent', source: { kind: 'agent-instructions' } },
    { id: 'user', source: { kind: 'user' } },
    { id: 'mnemon', source: { kind: 'plugin', plugin: 'dsh-mnemon' } },
    { id: 'skill', source: { kind: 'skill-catalog' } },
  ]

  const result = await runSort(handler, input)
  assert.deepEqual(
    result.messages.map((m) => m.id),
    ['user', 'mnemon', 'skill', 'agent'],
    '自定义 order 应按配置排序',
  )
}

// 用例 5：空消息列表不报错
{
  const ctx = createMockContext()
  apply(ctx)
  const handler = getPreStepHandler(ctx)

  const result = await runSort(handler, [])
  assert.deepEqual(result.messages, [], '空消息列表应原样返回')
}

console.log('PASS: dsh-prompt-order 冒烟测试全部通过')
