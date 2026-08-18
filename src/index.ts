/**
 * dsh-prompt-order
 *
 * 作用：在 agent/pre-step 最终消息进入模型前，按 source.kind 重排注入消息，
 * 让静态内容（AGENTS.md、skill-catalog、固定 mnemon 提示）尽量靠前，
 * 用户动态消息放到最后，从而最大化 DeepSeek 自动前缀缓存的命中率。
 *
 * 设计要点：
 * - 使用 `prepend: true` 注册到 agent/pre-step 最外层；
 *   先 `await next()` 让其它插件完成 append，再统一排序。
 * - 排序是稳定的：同 rank 的消息保持原有相对顺序。
 */
import type { Context } from 'cordis'

export const name = 'dsh-prompt-order'
export const inject = [] as const

/** 最优缓存顺序：静态在前，动态用户消息最后。 */
const DEFAULT_ORDER = [
  'agent-instructions', // AGENTS.md / workspace instructions
  'skill-catalog',      // skill 目录
  'mnemon',             // dsh-mnemon 的固定提示
  'user',               // 用户真实消息（动态，放最后）
] as const

export interface Config {
  /** 自定义排序；未配置时使用 DEFAULT_ORDER。 */
  order?: string[]
}

/** 计算一条消息在排序中的 rank；未知来源排最后。 */
function sourceRank(message: any, order: string[]): number {
  const source = message?.source ?? {}
  // dsh-mnemon 的 source.kind 是 plugin，plugin 字段是 dsh-mnemon
  const key = source.plugin === 'dsh-mnemon' ? 'mnemon' : source.kind
  const index = order.indexOf(key)
  return index === -1 ? 99 : index
}

export function apply(ctx: Context, config: Config = {}): void {
  const order = Array.isArray(config.order) && config.order.length > 0
    ? config.order
    : [...DEFAULT_ORDER]

  // prepend: true => 当前插件成为 agent/pre-step 最外层 Waterfall 处理器。
  // 其它插件（agent-instructions / dsh-mnemon / tool-skill）先执行并 append，
  // 本插件拿到最终 decision.messages 后再排序。
  ctx.on('agent/pre-step', async (payload: any, next: () => Promise<any>) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision

    const messages = [...(decision.messages ?? [])]
      .sort((a, b) => sourceRank(a, order) - sourceRank(b, order))

    return { ...decision, messages }
  }, true)
}
