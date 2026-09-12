---
name: video-sync
version: 1.0.0
description: |
  把拉片数据和原片合成一条**能直接看的视频**：一边是画面，一边是这一镜的分镜信息
  （镜号、起止、时长、景别、类别、运镜、画面描述、台词），**镜头切了信息跟着切**，
  镜头表自动滚动并高亮当前这一镜。
  版式只看原片的宽高比：**横版 / 方版 → 画面在上、信息在下；竖版 → 画面在左、信息在右**，
  画面永远原样缩放，不裁不拉。
  信息面板是一张 HTML 页面、一个镜头截一张图（高亮和滚动本来就只在切点上变，
  逐帧渲染是白烧机器），**布局全在 scripts/panel.css 里，改它就能改版式**，不用碰脚本。
  吃 video-shots 产出的 shots.json（有 frames/ 就把关键帧当缩略图用）。
  零 npm 依赖，用 ffmpeg 合成、无头浏览器渲面板。
  Use when asked to 导出视频、合成视频、分镜视频、带分镜信息的视频、解说版视频、
  video with shot info、annotated shot video。
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
triggers:
  - video-sync
  - 导出视频
  - 合成视频
  - 分镜视频
  - 拉片视频
  - 解说视频
  - 带分镜信息
  - shot info video
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node      # >= 18，只用标准库，无 npm 依赖
      - ffmpeg    # 合成
      - ffprobe   # 读原片宽高与音轨
      - chrome    # 或 Chromium / Edge，面板是 HTML 渲的；--chrome 可指路径
  runtimes:
    - claude-code
    - codex
---

## video-sync

把 **shots.json + 原片** 合成一条视频：画面一边，**当前镜头的分镜信息**另一边，
镜头切了信息跟着切，镜头表自动滚动并高亮。

**版式只看宽高比，不看别的：**

| 原片 | 版式 | 合成方式 |
| --- | --- | --- |
| 横版（宽 > 高）、方版 | **画面在上，信息在下** | `vstack` |
| 竖版（高 > 宽） | **画面在左，信息在右** | `hstack` |

两个方向都保证**画面原样缩放、不裁不拉**，面板补足剩下的地方。

**面板一个镜头截一张图，不是逐帧渲染。** 高亮和滚动本来就只在切点上变——53 个镜头
就是 53 张 PNG，按镜头时长排进 concat 清单，时间对齐交给 ffmpeg 的时间戳，
不靠 53 条 `enable=between(t,…)`（写错一条没人看得出来）。

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/video-sync.mjs`，零依赖，`node` 直接跑。

**边界（不做的事）**：不做拉片（那是 `video-shots` 的活，本 skill 吃它的 shots.json）、
不剪辑不转场不配乐、不烧字幕到画面上、不做逐帧动画（面板在切点上跳变，不做平滑滚动动画）。

---

### Step 0 — 先有拉片数据

要一份 `shots.json`（`video-shots` 的产出）和**对应的原片**。有 `frames/`（每镜关键帧）
更好——镜头表里会用起手帧当缩略图，没有就留空格。

**shots.json 必须和这条片子对得上**：`meta.durationSeconds` 与原片不符就别合，
先回去把拉片做对。

### Step 1 — 先看几何，再动视频

```bash
node {baseDir}/scripts/video-sync.mjs plan shots.json --video <片>
```

只算不合成，几秒出结果：版式、画面区、面板区、输出尺寸。**先确认这三个数字合理再往下走**——
合成一条 3 分钟的片子要一两分钟，算错了再重来不值。

不满意就调：`--panel <比例>`（横版是面板高÷画面高，默认 0.8；竖版是面板宽÷画面宽，默认 1.6）、
`--width` / `--height`（画面区的上限，默认 1920 / 1080）。

### Step 2 — 渲面板

```bash
node {baseDir}/scripts/video-sync.mjs panels shots.json --video <片> \
  --frames frames --lang zh|en [--out panels] [--chrome <路径>]
```

一个镜头一张 PNG（`panels/S01.png`…），外加一张 `panels/panel.html`——
**用浏览器打开它就能预览面板**，`#S07` 换镜头看效果。

**改布局就改 `{baseDir}/scripts/panel.css`**，改完重跑 `panels` 就是新版面，
不用碰脚本、不用重新想截图逻辑。样式约定见 `{baseDir}/references/panel-style.md`。

### Step 3 — 合成

```bash
node {baseDir}/scripts/video-sync.mjs compose shots.json --video <片> \
  [--panels panels] [-o out.mp4] [--crf 20]
```

音轨照搬原片（无声片自动不接音轨）。合成完 stderr 会报输出尺寸、时长、版式，**核对一眼**。

两步也可以一条龙：

```bash
node {baseDir}/scripts/video-sync.mjs export shots.json --video <片> -o out.mp4 --frames frames
```

### Step 4 — 抽帧验收 ⛔ 不能跳

**不要只看合成没报错就交。** 至少抽三帧看看信息对不对得上画面：

```bash
for t in 5 30 60; do ffmpeg -v error -y -ss $t -i out.mp4 -frames:v 1 -q:v 3 /tmp/check-$t.jpg; done
```

看三件事：**这一帧的画面属于哪一镜、面板上的镜号是不是同一个、高亮行有没有跟着走**。
对不上通常是 shots.json 和原片不是同一条，或者 `--video` 指错了。

汇报一句话说清：输出路径、尺寸、时长、版式、多少镜、面板哪几张没渲出来（如果有）。

---

## 边界

- **面板在切点上跳变，不做平滑滚动动画。** 要平滑就得逐帧渲染，成本涨几十倍，不值
- **需要一个无头浏览器**（Chrome / Chromium / Edge）。这是「布局能随便改」的代价：
  换成 ffmpeg 的 `drawtext` 画面板，中文换行、缩略图、高亮全得自己实现，改个版式要改滤镜图
- 词表（景别 / 类别 / 运镜 / 转场）在本 skill 里**自带一份**，不跨目录 import——
  skill 要能整个拷走。`video-shots` 那边加了新词，这边也要加，不然显示成枚举键
- 一个镜头一张截图，一张约 0.5–1 秒。百镜以上的片子渲面板要一两分钟，正常

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

73 项断言，不碰 ffmpeg、不开浏览器：几何（横/方/竖、偶数边长、上下限、旋钮）、
面板页面的数据契约（词表下发、缩略图有没有才给、转义）、concat 清单、ffmpeg 参数。
改完脚本先跑这个。
