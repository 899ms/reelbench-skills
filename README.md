[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-285444?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-e2e6df?style=for-the-badge&labelColor=e2e6df&color=8b938a)](README.en.md)

# reelbench-skills

视频侧的 Claude Code / Codex skill。

| skill | 干什么 |
| --- | --- |
| [video-shots](skills/video-shots/) | **拉片**：把一条成片拆成逐镜头的分析表——时长、景别、类别、运镜、画面。切点与时长由 ffmpeg 量，模型只判断该判断的四件事，14 道质量门逐条对账 |

## 先看成品

`demo-report/` 是拿 `demo-video.mp4`（202.9 秒的 AI 短片《啥是AI》）真跑出来的**完整产物**：

```
demo-report/
├── shots-report.html   ← 克隆下来双击就能开：内嵌播放器、可搜索的镜头表、统计、质量门
├── shots.json          ← 53 镜的拉片主数据
├── shots.md            ← Markdown 镜头表
├── track.json          ← 逐帧差分的运动曲线（机器证据）
└── frames/             ← 每镜首尾两张关键帧，共 106 张
```

53 镜、平均镜长 3.83 秒、每分钟 15.7 切、14 道质量门全绿。

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

## 许可

Apache-2.0。`demo-video.mp4` 与 `demo-report/frames/` 是短片《啥是AI》（导演 李幻枫）的画面，
仅作演示用途，版权归原作者所有，不适用本仓库的许可证。
