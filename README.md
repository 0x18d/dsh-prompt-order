# dsh-prompt-order

Reorder `agent/pre-step` injected messages by `source.kind` to keep static prompts early and dynamic user messages late, improving DeepSeek prefix cache hit rate.

按 `source.kind` 重排 `agent/pre-step` 注入消息，让静态提示靠前、用户动态消息靠后，优化 DeepSeek 自动前缀缓存命中。

## How it works / 工作原理

The plugin registers as the outermost `agent/pre-step` handler with `prepend: true`. It waits for other plugins to append their injected messages, then stably sorts them by `source.kind`:

```text
agent-instructions → skill-catalog → mnemon → user
```

- `agent-instructions`: AGENTS.md / workspace instructions
- `skill-catalog`: available skill catalog
- `mnemon`: dsh-mnemon's fixed `[MNEMON]` prompt
- `user`: real user message (dynamic, last)

## Install / 安装

```bash
dsh plugin --profile web add github:0x18d/dsh-prompt-order
```

For local development:

```bash
dev_build_plugin
dev_inject_plugin
```

## How to inspect source.kind / 如何查看 source.kind

Each injected message has a `source` object. The plugin uses `source.kind` (or `source.plugin === 'dsh-mnemon'`) as the sort key.

每条注入消息都带有一个 `source` 对象，插件用它作为排序键。

**Method 1: DSH session logs / 查看会话日志**

Plugin-injected messages are stored as `user/message` events with a `source` field. Search the session logs (DSH uses zstd-compressed JSONL):

```bash
find ~/.dsh/sessions -name '*.jsonl.zstd' -exec zstdcat {} \; 2>/dev/null | grep '"source"' | head
```

You should see entries like:

```json
{"kind":"plugin","plugin":"dsh-mnemon","form":"instructions"}
{"kind":"plugin","plugin":"hindsight","form":"recall"}
{"kind":"user"}
```

**Method 2: Temporary debug log / 临时调试日志**

Add a log in `src/index.ts` before sorting:

```ts
for (const message of decision.messages ?? []) {
  console.log('[dsh-prompt-order]', JSON.stringify(message.source))
}
```

Then rebuild and inject:

```bash
dev_build_plugin
dev_inject_plugin
```

Watch the DSH process output.

**Method 3: Read plugin source / 查看插件源码**

Each injecting plugin defines its own `source` shape, e.g.:

- dsh-mnemon: `{ kind: 'plugin', plugin: 'dsh-mnemon', form: 'instructions' }`
- Hindsight: `{ kind: 'plugin', plugin: 'hindsight', form: 'recall' }`
- real user message: `{ kind: 'user' }`

## Custom order / 自定义顺序

Add or edit the entry in `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: prompt-order
      name: dsh-prompt-order
      config:
        order:
          - agent-instructions
          - skill-catalog
          - mnemon
          - user
```

Unknown `source.kind` values are always placed last. / 未知来源始终排在最后。

## License / 许可证

BSD-3-Clause
