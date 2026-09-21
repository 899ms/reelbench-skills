# video-scrub 跑出来长什么样

这里是 [`video-scrub`](../skills/video-scrub/) 的**真实产出**，四段文字，不是手写的示意。

成品视频没放进来——**video-scrub 的成品和源片肉眼完全一样**，那正是它的设计目标。
值得看的从来不是视频，是下面这几段对账。

| 文件 | 是什么 |
| --- | --- |
| [`before.txt`](before.txt) | 一条普通片子的体检 |
| [`dirty-before.txt`](dirty-before.txt) | 注入了真实世界那种脏数据之后的体检 |
| [`dirty-after.txt`](dirty-after.txt) | 清完的验收：12 道门全过 |
| [`naive.txt`](naive.txt) | **反例**：天真的 `-c copy`，7 道门红 |
| [`half.txt`](half.txt) | **最值得看的一份**：教科书答案，`ffprobe` 一片干净，门照样红 |

---

## 先看 half.txt

这份是整个 skill 存在的理由。

用的是网上教你的标准做法——`-map_metadata -1`、只挑视频和音频两条流、清掉章节。
跑完之后 `ffprobe` 的输出**一片干净**：没有 GPS、没有邮箱、没有账号 ID、没有章节。

然后本 skill 说：

```
  ✗ 码流身份串
      码流里有「x264 - core」4 处（首现 @73）
      码流里有「Lavc」8 处（首现 @146686）
```

那是 x264 写在 **SEI** 里的完整编码参数串（`cabac=1 ref=3 … crf=23.0`），
和 ffmpeg 的 AAC 编码器写在 **DSE** 里的版本号。两处都在码流内部，
**任何 `ffprobe` 命令都看不见它们**。

所以「我清干净了」这个判断本身可能是假的。这就是为什么验收要做字节级扫描，
而不是看一眼 `ffprobe` 就收工。

## dirty-before.txt → dirty-after.txt

脏样本注入的是真实世界会有的东西：

| 注入 | 代表什么 |
| --- | --- |
| `location = +31.2304+121.4737/` | 拍摄地点（上海） |
| `artist = wesley@yogatummee.com` | 邮箱 |
| `comment = vid:v1e00fgi0000da64usvog65t9bk1rqgg` | 平台的视频 ID |
| `album = iPhone 15 Pro` | 设备型号 |
| `creation_time = 2025-03-14T08:22:11Z` | 拍摄时间 |
| 一条 `data` 轨 | GoPro / DJI 的遥测轨长这样 |
| 一个章节 | 剪辑软件留下的 |

验收拿 **14 根针**去扫输出，全部落空，12 道门全过。

那条 `data` 轨值得单独说一句：**GoPro 和 DJI 的 GPS 不在任何 tag 里**，
在一条独立的定时元数据轨上（整条 GPMF 遥测流：轨迹、速度、陀螺仪）。
清 tag 清不掉它，只有「只挑视频和音频两条流」挡得住——这就是「流构成」单独占一道门的原因。

## naive.txt

天真的 `-c copy`，7 道门红。邮箱、设备名、平台 ID、GPS、章节标题全部原样躺在输出里，
连字节偏移都报给你。

---

## 自己跑一遍

源片 `demo2.mp4` 没进仓库（开发期素材，`.gitignore` 里排掉了），
但这套演示**换任何一条视频都能复现**：

```bash
V=skills/video-scrub/scripts/video-scrub.mjs

# 体检
node $V inspect 你的视频.mp4

# 清 + 验收一条龙
node $V run 你的视频.mp4 -o clean.mp4
```

想复现脏样本那一组，先往一条干净片子里注入隐私信息：

```bash
ffmpeg -i 你的视频.mp4 -c copy \
  -metadata "location=+31.2304+121.4737/" \
  -metadata "artist=someone@example.com" \
  -metadata "comment=vid:xxxxxxxxxxxxxx" \
  -metadata "album=iPhone 15 Pro" \
  -metadata "creation_time=2025-03-14T08:22:11Z" \
  dirty.mp4

node $V run dirty.mp4 -o clean.mp4
```

想看 `half.txt` 那个反例——教科书答案为什么不够：

```bash
ffmpeg -i dirty.mp4 -map 0:v:0 -map "0:a:0?" \
  -map_metadata -1 -map_chapters -1 -c copy half.mp4

ffprobe -v error -show_entries format_tags:stream_tags -of json half.mp4   # 看着很干净
node $V verify dirty.mp4 half.mp4                                          # 门不这么认为
```
