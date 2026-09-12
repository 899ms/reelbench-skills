#!/usr/bin/env node
// video-sync — 把拉片数据和原片合成一条视频：画面一边，分镜信息一边，随播放切换。
// 零 npm 依赖。需要 node >= 18、ffmpeg/ffprobe，以及一个无头浏览器（面板是 HTML 渲的）。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* 常量                                                                */
/* ------------------------------------------------------------------ */
/*
 * 这个 skill 只干一件事：把 video-shots 产出的 shots.json 和原片拼成一条视频。
 *
 *   横版 / 方版原片 → 画面在上，分镜信息在下
 *   竖版原片       → 画面在左，分镜信息在右
 *
 * 信息面板是一张 HTML 页面，**一个镜头截一张图**（不是逐帧渲染）：
 * 镜头切了，面板才切——高亮和滚动本来就只在切点上变，逐帧渲染是白烧机器。
 * 面板的长相全在 panel.css 里，改它就能改布局，不用碰这个脚本。
 */

export const DEFAULT_PARAMS = {
  maxVideoWidth: 1920,   // 画面区的宽上限（横版按它缩）
  maxVideoHeight: 1080,  // 画面区的高上限（竖版按它缩）
  panelRatioWide: 0.8,   // 横版：面板高 ÷ 画面高
  panelRatioTall: 1.6,   // 竖版：面板宽 ÷ 画面宽
  minPanelPx: 260,       // 面板最短边，再小就放不下字
  fps: 30,               // 输出帧率
  crf: 20,               // x264 质量，越小越清晰
};

/** 四张词表：与 video-shots 同名同义。**本 skill 自包含，不跨目录 import。** */
export const SHOT_SIZES = {
  none: { zh: '无景别', en: 'n/a', color: '#e4e8d9' },
  'extreme-wide': { zh: '大远景', en: 'extreme wide', color: '#dae0c8' },
  wide: { zh: '全景', en: 'wide', color: '#c4cfaa' },
  'medium-wide': { zh: '中远景', en: 'medium wide', color: '#b0c091' },
  medium: { zh: '中景', en: 'medium', color: '#94aa74' },
  'medium-close': { zh: '中近景', en: 'medium close', color: '#788f58' },
  close: { zh: '特写', en: 'close-up', color: '#526f45' },
  'extreme-close': { zh: '大特写', en: 'extreme close-up', color: '#345136' },
};

export const SHOT_CATEGORIES = {
  establishing: { zh: '定场', en: 'establishing' },
  subject: { zh: '主体', en: 'subject' },
  dialogue: { zh: '对话', en: 'dialogue' },
  reaction: { zh: '反应', en: 'reaction' },
  insert: { zh: '插入特写', en: 'insert' },
  pov: { zh: '主观', en: 'POV' },
  empty: { zh: '空镜', en: 'empty' },
  product: { zh: '产品展示', en: 'product' },
  'text-card': { zh: '字卡', en: 'text card' },
  transition: { zh: '转场镜头', en: 'transition' },
  archive: { zh: '引用素材', en: 'archive' },
};

export const CAMERA_MOVES = {
  static: { zh: '固定', en: 'static' },
  'push-in': { zh: '推', en: 'push in' },
  'pull-out': { zh: '拉', en: 'pull out' },
  'zoom-in': { zh: '变焦推', en: 'zoom in' },
  'zoom-out': { zh: '变焦拉', en: 'zoom out' },
  'pan-left': { zh: '左摇', en: 'pan left' },
  'pan-right': { zh: '右摇', en: 'pan right' },
  'tilt-up': { zh: '上摇', en: 'tilt up' },
  'tilt-down': { zh: '下摇', en: 'tilt down' },
  'truck-left': { zh: '左移', en: 'truck left' },
  'truck-right': { zh: '右移', en: 'truck right' },
  'pedestal-up': { zh: '升', en: 'pedestal up' },
  'pedestal-down': { zh: '降', en: 'pedestal down' },
  tracking: { zh: '跟拍', en: 'tracking' },
  arc: { zh: '环绕', en: 'arc' },
  'whip-pan': { zh: '甩镜', en: 'whip pan' },
  handheld: { zh: '手持微晃', en: 'handheld' },
  shake: { zh: '剧烈晃动', en: 'shake' },
  'rack-focus': { zh: '变焦点', en: 'rack focus' },
  'micro-push': { zh: '微推', en: 'micro push' },
  roll: { zh: '旋转', en: 'roll' },
  drone: { zh: '航拍移动', en: 'drone' },
};

export const TRANSITIONS = {
  cut: { zh: '硬切', en: 'cut' },
  dissolve: { zh: '叠化', en: 'dissolve' },
  'fade-in': { zh: '淡入', en: 'fade in' },
  'fade-out': { zh: '淡出', en: 'fade out' },
  whip: { zh: '甩切', en: 'whip' },
  'match-cut': { zh: '匹配剪辑', en: 'match cut' },
  wipe: { zh: '划像', en: 'wipe' },
  morph: { zh: '特效转场', en: 'morph' },
};

const I18N = {
  zh: {
    shots: '镜头', shot: '镜号', of: '共', duration: '时长', size: '景别', category: '类别',
    camera: '运镜', transition: '转场', frame: '画面', subjects: '主体', text: '画面文字',
    audio: '声音', motion: '实测运动', now: '当前镜头', sec: '秒',
  },
  en: {
    shots: 'Shots', shot: 'Shot', of: 'of', duration: 'Duration', size: 'Size', category: 'Category',
    camera: 'Camera', transition: 'Transition', frame: 'Frame', subjects: 'Subjects', text: 'On-screen text',
    audio: 'Audio', motion: 'Measured motion', now: 'Now playing', sec: 's',
  },
};

const tOf = (lang) => I18N[lang === 'en' ? 'en' : 'zh'];
const labelOf = (table, key, lang) => (table[key] ? (lang === 'en' ? table[key].en : table[key].zh) : (key || '—'));
const even = (n) => Math.max(2, Math.round(n / 2) * 2); // h264 要偶数边长
const r2 = (n) => Math.round(n * 100) / 100;

export function paramsOf(doc) {
  return { ...DEFAULT_PARAMS, ...(doc?.syncParams ?? {}) };
}

export function fmtTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ------------------------------------------------------------------ */
/* plan：先把几何算清楚，再动 ffmpeg                                    */
/* ------------------------------------------------------------------ */
/*
 * 版式只看原片的宽高比，不看别的：
 *   宽 ≥ 高（横版、方版）→ 上下叠（vstack），画面在上
 *   宽 <  高（竖版）     → 左右并（hstack），画面在左
 * 两个方向都保证画面**原样缩放、不裁不拉**，面板补足剩下的地方。
 */
export function plan(meta, opts = {}) {
  const p = { ...DEFAULT_PARAMS, ...opts };
  const w = Number(meta.width) || 0;
  const h = Number(meta.height) || 0;
  if (!(w > 0 && h > 0)) throw new Error('plan：原片宽高读不出来');
  const portrait = h > w;

  let videoW;
  let videoH;
  if (portrait) {
    videoH = Math.min(h, p.maxVideoHeight);
    videoW = (w / h) * videoH;
  } else {
    videoW = Math.min(w, p.maxVideoWidth);
    videoH = (h / w) * videoW;
  }
  videoW = even(videoW);
  videoH = even(videoH);

  const panel = portrait
    ? { width: even(Math.max(p.minPanelPx, videoW * p.panelRatioTall)), height: videoH }
    : { width: videoW, height: even(Math.max(p.minPanelPx, videoH * p.panelRatioWide)) };

  return {
    portrait,
    stack: portrait ? 'hstack' : 'vstack',
    video: { width: videoW, height: videoH },
    panel,
    output: portrait
      ? { width: even(videoW + panel.width), height: videoH }
      : { width: videoW, height: even(videoH + panel.height) },
    fps: p.fps,
    crf: p.crf,
  };
}

/* ------------------------------------------------------------------ */
/* 面板页面：一张 HTML，靠 #S07 这样的 hash 决定高亮哪一镜               */
/* ------------------------------------------------------------------ */

const readAsset = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

export function panelHtml(doc, layout, ctx = {}) {
  const lang = ctx.lang ?? doc.lang ?? 'zh';
  const t = tOf(lang);
  const shots = doc.shots ?? [];
  const total = Number(doc?.meta?.durationSeconds) || shots.reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  const frameDir = ctx.frameDir ?? null;
  const has = ctx.frameExists ?? {};

  const data = {
    title: doc.title || doc.source || '',
    source: doc.source ?? '',
    total,
    lang,
    words: t,
    frameDir,
    cast: Object.fromEntries((doc.cast ?? []).map((c) => [c.id, c.name])),
    colors: Object.fromEntries(Object.entries(SHOT_SIZES).map(([k, x]) => [k, x.color])),
    shots: shots.map((s) => ({
      id: s.id,
      start: Number(s.start),
      end: Number(s.end),
      seconds: Number(s.seconds),
      size: labelOf(SHOT_SIZES, s.size, lang),
      sizeKey: s.size,
      category: labelOf(SHOT_CATEGORIES, s.category, lang),
      camera: labelOf(CAMERA_MOVES, s.camera, lang),
      transition: s.transitionIn && s.transitionIn !== 'cut' ? labelOf(TRANSITIONS, s.transitionIn, lang) : '',
      frame: s.frame ?? '',
      subjects: (s.subjects ?? []).map((id) => (doc.cast ?? []).find((c) => c.id === id)?.name ?? id),
      onscreenText: s.onscreenText ?? '',
      audio: s.audio ?? '',
      motion: s.motion ?? null,
      thumb: frameDir && has[`${s.id}a`] ? `${frameDir}/${s.id}a.jpg` : '',
      startText: fmtTime(s.start),
      endText: fmtTime(s.end),
    })),
  };

  return readAsset('panel.html')
    .replace('/*__CSS__*/', readAsset('panel.css'))
    .replace('"__DATA__"', JSON.stringify(data).replace(/</g, '\\u003c'))
    .replace('"__LAYOUT__"', JSON.stringify(layout))
    .replace('__TITLE__', esc(data.title || 'panel'))
    .replace('__LANG__', lang === 'en' ? 'en' : 'zh-CN');
}

/* ------------------------------------------------------------------ */
/* ffmpeg / 浏览器                                                     */
/* ------------------------------------------------------------------ */

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
];

export function findChrome(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`--chrome ${explicit} 不存在`);
    return explicit;
  }
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (found) return found;
  throw new Error('没找到无头浏览器（面板是 HTML 渲的）。装 Chrome/Chromium，或用 --chrome 指路径');
}

export function probe(video) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_entries', 'format=duration',
    '-show_entries', 'stream=codec_type,width,height,r_frame_rate',
    video,
  ], { encoding: 'utf8' });
  const j = JSON.parse(out);
  const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`${video} 里没有视频流`);
  const [num, den] = String(v.r_frame_rate ?? '0/1').split('/').map(Number);
  return {
    durationSeconds: r2(Number(j.format?.duration ?? 0)),
    width: v.width ?? 0,
    height: v.height ?? 0,
    fps: den ? r2(num / den) : 0,
    hasAudio: (j.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `video-sync.mjs — 把拉片数据和原片合成一条视频

  plan <shots.json> [--video <片>] [--panel <比例>] [--width N] [--height N]
      只算几何：版式、画面区、面板区、输出尺寸（JSON 到 stdout），不碰视频

  panels <shots.json> --video <片> [--out panels] [--frames <关键帧目录>]
         [--lang zh|en] [--chrome <路径>] [--panel <比例>]
      生成面板页面并**一个镜头截一张图** → <out>/S01.png…（外加 panel.html 供预览调样式）

  compose <shots.json> --video <片> [--panels panels] [-o out.mp4] [--crf 20]
      把画面与面板合成一条视频：横版上下叠、竖版左右并，音轨照搬原片

  export <shots.json> --video <片> [-o out.mp4] [其余同上]
      panels + compose 一条龙

  面板的长相全在 scripts/panel.css 里，改它就能改布局，不用碰这个脚本。
`;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  if (i === -1) return fallback;
  const v = rest[i + 1];
  return v == null || v.startsWith('--') ? true : v;
}

function geometryOf(rest, doc, video) {
  const meta = video ? probe(video) : doc.meta;
  const opts = {};
  const panelRatio = flag(rest, '--panel');
  const width = flag(rest, '--width');
  const height = flag(rest, '--height');
  if (typeof panelRatio === 'string') {
    const portrait = (Number(meta.height) || 0) > (Number(meta.width) || 0);
    opts[portrait ? 'panelRatioTall' : 'panelRatioWide'] = Number(panelRatio);
  }
  if (typeof width === 'string') opts.maxVideoWidth = Number(width);
  if (typeof height === 'string') opts.maxVideoHeight = Number(height);
  const crf = flag(rest, '--crf');
  if (typeof crf === 'string') opts.crf = Number(crf);
  return { meta, layout: plan(meta, { ...paramsOf(doc), ...opts }) };
}

function frameCtx(rest, doc) {
  const dir = flag(rest, '--frames');
  const frameDir = typeof dir === 'string' ? dir : 'frames';
  const frameExists = {};
  if (existsSync(frameDir)) {
    for (const f of readdirSync(frameDir)) {
      const m = /^(S\d+[ab])\.jpg$/.exec(f);
      if (m) frameExists[m[1]] = true;
    }
  }
  return { frameDir: existsSync(frameDir) ? resolve(frameDir) : null, frameExists };
}

/**
 * 面板序列：concat 解复用器按镜头时长排好每一张面板图。
 * 时间对齐交给 ffmpeg 的时间戳，不靠 N 个 overlay 的 enable 表达式——
 * 53 个镜头就是 53 条 enable，写错一条没人看得出来。
 * 末尾必须重复最后一张：concat 不给最后一条 duration 记时长。
 */
export function sequenceLines(shots, panelDir) {
  const lines = [];
  for (const s of shots) {
    lines.push(`file '${resolve(panelDir, `${s.id}.png`)}'`);
    lines.push(`duration ${r2(Number(s.end) - Number(s.start))}`);
  }
  lines.push(`file '${resolve(panelDir, `${shots[shots.length - 1].id}.png`)}'`);
  return lines;
}

/** ffmpeg 的完整参数。抽出来是为了能在不跑 ffmpeg 的情况下断言它。 */
export function composeArgs({ video, listFile, out, layout, hasAudio }) {
  const { width: vw, height: vh } = layout.video;
  const { width: pw, height: ph } = layout.panel;
  const filter = [
    `[0:v]scale=${vw}:${vh}:flags=lanczos,setsar=1,fps=${layout.fps}[v]`,
    `[1:v]scale=${pw}:${ph},setsar=1,fps=${layout.fps}[p]`,
    `[v][p]${layout.stack}=inputs=2[out]`,
  ].join(';');
  const args = [
    '-v', 'error', '-y',
    '-i', video,
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-filter_complex', filter,
    '-map', '[out]',
  ];
  if (hasAudio) args.push('-map', '0:a', '-c:a', 'aac', '-b:a', '160k');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(layout.crf), '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-shortest', out);
  return args;
}

function cmdPlan(rest) {
  const doc = readJson(rest[0]);
  const video = flag(rest, '--video');
  const { meta, layout } = geometryOf(rest, doc, typeof video === 'string' ? video : null);
  process.stdout.write(`${JSON.stringify({ source: { width: meta.width, height: meta.height }, ...layout }, null, 2)}\n`);
}

function cmdPanels(rest) {
  const doc = readJson(rest[0]);
  const video = flag(rest, '--video');
  if (typeof video !== 'string') throw new Error('panels 要 --video <片>');
  const { layout } = geometryOf(rest, doc, video);
  const outDir = typeof flag(rest, '--out') === 'string' ? flag(rest, '--out') : 'panels';
  const lang = flag(rest, '--lang');
  const chrome = findChrome(typeof flag(rest, '--chrome') === 'string' ? flag(rest, '--chrome') : null);
  mkdirSync(outDir, { recursive: true });

  const html = panelHtml(doc, layout, { lang: typeof lang === 'string' ? lang : undefined, ...frameCtx(rest, doc) });
  const page = join(outDir, 'panel.html');
  writeFileSync(page, html);

  const shots = doc.shots ?? [];
  let n = 0;
  for (const s of shots) {
    const out = join(outDir, `${s.id}.png`);
    try {
      execFileSync(chrome, [
        '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        `--window-size=${layout.panel.width},${layout.panel.height}`,
        '--virtual-time-budget=3000',
        `--screenshot=${resolve(out)}`,
        `file://${resolve(page)}#${s.id}`,
      ], { stdio: 'ignore' });
      n += 1;
    } catch {
      process.stderr.write(`[panels] ${s.id} 截图失败，跳过\n`);
    }
  }
  process.stderr.write(`[panels] ${n}/${shots.length} 张 ${layout.panel.width}×${layout.panel.height} → ${outDir}/\n`);
  process.stderr.write(`[panels] 面板页面 → ${page}（浏览器打开它调样式，改 panel.css 重跑即可）\n`);
}

function cmdCompose(rest) {
  const doc = readJson(rest[0]);
  const video = flag(rest, '--video');
  if (typeof video !== 'string') throw new Error('compose 要 --video <片>');
  const { meta, layout } = geometryOf(rest, doc, video);
  const panelDir = typeof flag(rest, '--panels') === 'string' ? flag(rest, '--panels') : 'panels';
  const out = typeof flag(rest, '-o') === 'string' ? flag(rest, '-o')
    : typeof flag(rest, '--out') === 'string' ? flag(rest, '--out')
      : `${basename(video).replace(/\.[^.]+$/, '')}-sync.mp4`;
  const shots = doc.shots ?? [];
  const missing = shots.filter((s) => !existsSync(join(panelDir, `${s.id}.png`)));
  if (missing.length) throw new Error(`${panelDir}/ 里缺 ${missing.length} 张面板（${missing.slice(0, 3).map((s) => s.id).join(' ')}…），先跑 panels`);

  const listFile = join(panelDir, '.sequence.txt');
  writeFileSync(listFile, sequenceLines(shots, panelDir).join('\n'));
  const args = composeArgs({ video, listFile, out, layout, hasAudio: meta.hasAudio });

  execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  rmSync(listFile, { force: true });
  const done = probe(out);
  process.stderr.write(`[compose] ${out} — ${done.width}×${done.height} / ${done.durationSeconds}s / ${layout.stack === 'vstack' ? '画面在上' : '画面在左'}\n`);
}

export function main(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'plan': return cmdPlan(rest);
    case 'panels': return cmdPanels(rest);
    case 'compose': return cmdCompose(rest);
    case 'export': { cmdPanels(rest); return cmdCompose(rest); }
    default:
      process.stdout.write(USAGE);
      if (cmd && cmd !== '--help' && cmd !== '-h') process.exitCode = 1;
      return undefined;
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0); });
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}
