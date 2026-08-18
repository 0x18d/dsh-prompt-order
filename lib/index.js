/**
 * dsh-prompt-order
 *
 * 在 agent/pre-step 最终消息进入模型前，按 source.kind 重排注入消息。
 * 静态内容靠前，用户动态消息靠后，最大化 DeepSeek 自动前缀缓存命中。
 */
export const name = 'dsh-prompt-order';
export const inject = [];
/** 最优缓存顺序：静态在前，动态用户消息最后。 */
const DEFAULT_ORDER = [
    'agent-instructions',
    'skill-catalog',
    'mnemon',
    'user',
];
/** 计算一条消息在排序中的 rank；未知来源排最后。 */
function sourceRank(message, order) {
    const source = message?.source ?? {};
    // dsh-mnemon 的 source.kind 是 plugin，plugin 字段是 dsh-mnemon
    const key = source.plugin === 'dsh-mnemon' ? 'mnemon' : source.kind;
    const index = order.indexOf(key);
    return index === -1 ? 99 : index;
}
export function apply(ctx, config = {}) {
    const order = Array.isArray(config.order) && config.order.length > 0
        ? config.order
        : [...DEFAULT_ORDER];
    // prepend: true => 当前插件成为 agent/pre-step 最外层 Waterfall 处理器。
    ctx.on('agent/pre-step', async (payload, next) => {
        const decision = await next();
        if (decision.kind === 'reject')
            return decision;
        const messages = [...(decision.messages ?? [])]
            .sort((a, b) => sourceRank(a, order) - sourceRank(b, order));
        return { ...decision, messages };
    }, true);
}
