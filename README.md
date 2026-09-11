[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-285444?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-e2e6df?style=for-the-badge&labelColor=e2e6df&color=8b938a)](README.en.md)

# reelbench-skills

视频侧的 Claude Code / Codex skill。

| skill | 干什么 |
| --- | --- |
| [video-shots](skills/video-shots/) | **拉片**：把一条成片拆成逐镜头的分析表——时长、景别、类别、运镜、画面。切点与时长由 ffmpeg 量，模型只判断该判断的四件事，14 道质量门逐条对账 |

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

## 示例

`demo-report/` 是拿 `demo-video.mp4`（202.9 秒的 AI 短片《啥是AI》）真跑出来的**完整产物**：
53 镜、平均镜长 3.83 秒、每分钟 15.7 切、14 道质量门全绿。
`demo-report-en/` 是同一套流程跑一条 30 秒英文广告片的产物（`--lang en`，报告全英文）。

[![拉片报告](skills/video-shots/assets/report.png)](demo-report/shots-report.html)

报告是**单文件交互页**：内嵌播放器（播放时同步高亮镜头、点镜头跳转）、镜头节奏带、
可搜索可筛选可排序的镜头表（列表 / 卡片两种视图、首尾关键帧并排、点图开大图）、
统计分布、出场人物、质量检查。零外部依赖，离线双击能开。

<img src="skills/video-shots/assets/report-mobile.png" width="360" alt="窄屏下的镜头表">

```
demo-report/
├── shots-report.html   ← 克隆下来双击就能开
├── shots.json          ← 53 镜的拉片主数据
├── shots.md            ← Markdown 镜头表
├── track.json          ← 逐帧差分的运动曲线（机器证据）
└── frames/             ← 每镜首尾两张关键帧，共 106 张
```
