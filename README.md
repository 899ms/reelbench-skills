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

```bash
git clone https://github.com/eternityspring/reelbench-skills.git
cd reelbench-skills
./scripts/install.sh
```

软链到 `~/.claude/skills/` 和/或 `~/.codex/skills/`（哪个装了就装到哪），**`git pull` 之后立刻生效**。

```bash
./scripts/install.sh --claude      # 只装到 Claude Code
./scripts/install.sh --codex       # 只装到 codex
./scripts/install.sh video-shots   # 只装某一个 skill
./scripts/install.sh --uninstall   # 取消软链
```

依赖只有 `node` >= 18 和 `ffmpeg` / `ffprobe`（macOS：`brew install node ffmpeg`）。
**零 npm 依赖、零 API key**，用当前会话额度。

不想软链就直接拷：`cp -r skills/video-shots ~/.claude/skills/`——skill 自包含，拷走就能用。

## 许可

Apache-2.0。`demo-video.mp4` 与 `demo-report/frames/` 是短片《啥是AI》（导演 李幻枫）的画面，
仅作演示用途，版权归原作者所有，不适用本仓库的许可证。
