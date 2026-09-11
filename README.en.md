[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-e2e6df?style=for-the-badge&labelColor=e2e6df&color=8b938a)](README.md)
[![English](https://img.shields.io/badge/English-285444?style=for-the-badge)](README.en.md)

# reelbench-skills

Claude Code / Codex skills for working with video.

| skill | what it does |
| --- | --- |
| [video-shots](skills/video-shots/README.en.md) | **Shot breakdown**: turns a finished film into a shot-by-shot table — duration, shot size, category, camera move, frame description. Cuts and durations are measured by ffmpeg; the model only judges the four things it should; 14 quality gates check every call. |

## See the output first

`demo-report/` is the **real output** of running the skill on `demo-video.mp4`
(a 202.9-second AI-generated short film, *啥是AI*):

```
demo-report/
├── shots-report.html   ← clone and double-click: embedded player, searchable shot list, stats, gates
├── shots.json          ← the breakdown data for all 53 shots
├── shots.md            ← Markdown shot list
├── track.json          ← frame-difference motion curve (the machine's evidence)
└── frames/             ← first and last keyframe of every shot, 106 files
```

53 shots, 3.83 s average shot length, 15.7 cuts per minute, all 14 gates green.

## Install

Each skill is self-contained — copy the directory and it works:

```bash
# per project
mkdir -p .claude/skills && cp -r skills/video-shots .claude/skills/

# or per user
mkdir -p ~/.claude/skills && cp -r skills/video-shots ~/.claude/skills/
```

Requirements: `node` >= 18 and `ffmpeg` / `ffprobe` (`brew install ffmpeg`).
**No npm dependencies, no API keys** — it runs on your current session.

## How these skills are written

The style is learned from [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills)
(Apache-2.0). Three rules carried over:

1. **Compute everything that can be computed.** The model only makes the judgements
   a model should make; the rest belongs to deterministic scripts.
2. **A checklist the model polices itself against is worthless.** Every rule has to be
   a gate that actually runs — and every gate has a **breaking test case** in the self-test,
   proving it really blocks.
3. **A skill must be self-contained.** No dependency on third-party skills; external
   methodology is internalised into the skill's own `references/`, with the source credited.

## Licence

Apache-2.0. `demo-video.mp4` and `demo-report/frames/` are stills from the short film
*啥是AI* (directed by 李幻枫), included for demonstration only. They remain the property
of their author and are not covered by this repository's licence.
