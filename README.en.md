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

```bash
git clone https://github.com/eternityspring/reelbench-skills.git
cd reelbench-skills
./scripts/install.sh
```

This symlinks the skills into `~/.claude/skills/` and/or `~/.codex/skills/` (whichever exists),
so **`git pull` takes effect immediately**.

```bash
./scripts/install.sh --claude      # Claude Code only
./scripts/install.sh --codex       # codex only
./scripts/install.sh video-shots   # one skill only
./scripts/install.sh --uninstall   # remove the symlinks
```

Requirements: `node` >= 18 and `ffmpeg` / `ffprobe` (macOS: `brew install node ffmpeg`).
**No npm dependencies, no API keys** — it runs on your current session.

Prefer a copy over a symlink? `cp -r skills/video-shots ~/.claude/skills/` —
each skill is self-contained.

## Licence

Apache-2.0. `demo-video.mp4` and `demo-report/frames/` are stills from the short film
*啥是AI* (directed by 李幻枫), included for demonstration only. They remain the property
of their author and are not covered by this repository's licence.
