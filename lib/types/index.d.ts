import type { Context } from 'cordis';
export declare const name = 'dsh-prompt-order';
export declare const inject: readonly [];
export interface Config {
    /** 自定义排序；未配置时使用默认顺序。 */
    order?: string[];
}
export declare function apply(ctx: Context, config?: Config): void;
