# reelbench-skills

视频侧的 Claude Code / Codex skill。

| skill | 干什么 |
| --- | --- |
| [video-shots](skills/video-shots/) | **拉片**：把一条成片拆成逐镜头的分析表——时长、景别、类别、运镜、画面。切点与时长由 ffmpeg 量，模型只判断该判断的四件事，14 道质量门逐条对账 |

`skills/video-shots/examples/demo-shots.json` 是拿一条 202.9 秒的短片真跑出来的完整拉片
（53 镜，14 道门全绿），报告长什么样见 skill 的 README。**原片和渲染产物不进版本控制**——
`render` 随时能重新生成。

## 安装

skill 自包含，拷走整个目录就能用：

```bash
# 项目级
mkdir -p .claude/skills && cp -r skills/video-shots .claude/skills/

# 或用户级
mkdir -p ~/.claude/skills && cp -r skills/video-shots ~/.claude/skills/
```

依赖只有 `node` >= 18 和 `ffmpeg` / `ffprobe`（`brew install ffmpeg`）。
**零 npm 依赖、零 API key**，用当前会话额度。

## 写法

skill 的写法学自 [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills)（Apache-2.0），
三条规矩照搬：

1. **能算的都算掉。** 模型只做模型该做的判断，其余交给确定性脚本。
2. **checklist 交给模型自觉是靠不住的。** 每条规则都得是一道跑得起来的门，
   而且每道门在自测里都有**击穿用例**——证明它真的会拦。
3. **skill 必须自包含。** 不依赖任何第三方 skill；外部方法论学完内化成自己的 `references/`，
   注明来源。
