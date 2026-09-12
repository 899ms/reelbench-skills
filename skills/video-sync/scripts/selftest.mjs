#!/usr/bin/env node
// video-sync 自测：不调模型、不碰 ffmpeg、不开浏览器。
// 查的是三件事：几何算得对不对、面板页面的数据契约全不全、ffmpeg 参数拼得对不对。

import { readFileSync } from 'node:fs';

import {
  DEFAULT_PARAMS, SHOT_SIZES, SHOT_CATEGORIES, CAMERA_MOVES, TRANSITIONS,
  plan, panelHtml, composeArgs, motionPlan, ramp, commandFile, fmtTime, paramsOf, findChrome,
} from './video-sync.mjs';

let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) passed += 1; else failures.push(label); };
const eq = (got, want, label) => ok(Object.is(got, want), `${label}（得到 ${JSON.stringify(got)}，应为 ${JSON.stringify(want)}）`);

const doc = () => ({
  source: 'clip.mp4',
  title: '测试片',
  lang: 'zh',
  meta: { durationSeconds: 10, width: 1920, height: 1080, fps: 25, hasAudio: true },
  cast: [{ id: 'P1', name: '老太太' }],
  shots: [
    {
      id: 'S01', start: 0, end: 4, seconds: 4, size: 'wide', category: 'establishing', camera: 'static',
      transitionIn: 'cut', subjects: ['P1'], frame: '雪地上一排木架挂着冻肉', onscreenText: '', audio: '', motion: 0.5,
    },
    {
      id: 'S02', start: 4, end: 10, seconds: 6, size: 'close', category: 'dialogue', camera: 'push-in',
      transitionIn: 'dissolve', subjects: ['P1'], frame: '老太太侧脸贴着柜台', onscreenText: '十分钟前', audio: '老太太：给我拿药', motion: 5,
      rhythm: 'payoff', rhythmNote: '憋了半天的那句话终于说出来',
    },
  ],
});

/* ------------------------------------------------------------------ */
/* 几何：版式只看宽高比，画面不裁不拉                                    */
/* ------------------------------------------------------------------ */
{
  const wide = plan({ width: 1920, height: 1080 });
  eq(wide.portrait, false, '横版');
  eq(wide.stack, 'vstack', '横版上下叠');
  eq(wide.video.width, 1920, '横版画面按宽上限缩');
  eq(wide.video.height, 1080, '画面高按原比例算');
  eq(wide.panel.width, 1920, '横版面板与画面同宽');
  eq(wide.panel.height, 864, '横版面板高 = 画面高 × 0.8');
  eq(wide.output.height, 1944, '输出高 = 画面 + 面板');

  const square = plan({ width: 1080, height: 1080 });
  eq(square.stack, 'vstack', '方版也走上下叠');
  eq(square.video.width, 1080, '方版不放大');

  const tall = plan({ width: 1080, height: 1920 });
  eq(tall.portrait, true, '竖版');
  eq(tall.stack, 'hstack', '竖版左右并');
  eq(tall.video.height, 1080, '竖版画面按高上限缩');
  eq(tall.video.width, 608, '竖版画面宽按原比例算（1080×1080/1920 取偶）');
  eq(tall.panel.height, 1080, '竖版面板与画面同高');
  eq(tall.panel.width, 972, '竖版面板宽 = 画面宽 × 1.6');
  eq(tall.output.width, 1580, '输出宽 = 画面 + 面板');

  // h264 要求偶数边长——奇数尺寸的原片最容易在这里炸
  const odd = plan({ width: 1281, height: 721 });
  for (const [k, v] of Object.entries({ ...odd.video, ...odd.panel, ...odd.output })) {
    ok(v % 2 === 0, `${k}=${v} 必须是偶数`);
  }

  // 小片子也得留得下字
  const tiny = plan({ width: 320, height: 240 });
  ok(tiny.panel.height >= DEFAULT_PARAMS.minPanelPx, '面板不小于下限，再小放不下字');

  // 旋钮
  eq(plan({ width: 1920, height: 1080 }, { panelRatioWide: 0.5 }).panel.height, 540, '横版面板比例可调');
  eq(plan({ width: 1080, height: 1920 }, { panelRatioTall: 1 }).panel.width, 608, '竖版面板比例可调');
  eq(plan({ width: 1920, height: 1080 }, { maxVideoWidth: 1280 }).video.width, 1280, '画面宽上限可调');
  eq(paramsOf({ syncParams: { fps: 24 } }).fps, 24, 'syncParams 能覆盖默认值');
  eq(paramsOf({}).crf, DEFAULT_PARAMS.crf, '没覆盖就用默认值');

  let threw = 0;
  try { plan({ width: 0, height: 0 }); } catch { threw = 1; }
  eq(threw, 1, '读不出宽高就报错，不瞎猜');
}

/* ------------------------------------------------------------------ */
/* 面板页面：数据契约                                                   */
/* ------------------------------------------------------------------ */
{
  const layout = plan({ width: 1920, height: 1080 });
  const html = panelHtml(doc(), layout);

  ok(!html.includes('__DATA__') && !html.includes('__LAYOUT__') && !html.includes('__TITLE__'),
    '模板占位全部被替换');
  ok(!html.includes('/*__CSS__*/'), 'panel.css 被内联进来');
  ok(html.includes('.panel{'), '样式确实在页面里');
  ok(html.includes('.panel{'), '面板样式收在 .panel 作用域里（这份 CSS 会被整段注进别的页面）');
  ok(html.includes("classList.add(LAYOUT.portrait ? 'portrait' : 'landscape')"), '版式 class 打在面板元素上');

  const data = JSON.parse(html.split('\n').find((l) => l.startsWith('const DATA = ')).slice('const DATA = '.length, -1));
  eq(data.shots.length, 2, '镜头全给到页面');
  eq(data.shots[0].size, '全景', '景别下发的是中文名，不是枚举键');
  eq(data.shots[1].camera, '推', '运镜同理');
  eq(data.shots[1].transition, '叠化', '非硬切的转场才给');
  eq(data.shots[0].transition, '', '硬切不占位置');
  eq(data.shots[0].subjects[0], '老太太', '主体下发人名，不是编号');
  eq(data.shots[0].startText, '00:00.00', '时间码在这一步算好');
  eq(data.total, 10, '片长给页面画进度条');
  eq(data.shots[1].rhythm, '兑现', '节奏角色下发中文名');
  eq(data.shots[1].rhythmKey, 'payoff', '同时下发枚举键，页面按它取色');
  eq(data.shots[1].rhythmNote, '憋了半天的那句话终于说出来', '节奏理由原样带上');
  eq(data.shots[0].rhythm, '', '没标节奏的镜头留空，不编');
  ok(Object.keys(data.rhythmColors).length === 8, '节奏色阶全量下发');
  ok(html.includes('listhead'), '面板有表头');
  ok(html.includes('rbeat') && html.includes('beat-tag'), '行里有节奏那一格，角色写成 [钩子] 在句首');
  ok(Object.keys(data.colors).length === Object.keys(SHOT_SIZES).length, '景别色阶全量下发');

  const en = JSON.parse(panelHtml(doc(), layout, { lang: 'en' }).split('\n')
    .find((l) => l.startsWith('const DATA = ')).slice('const DATA = '.length, -1));
  eq(en.shots[0].size, 'wide', '英文界面下词表跟着切');
  eq(en.shots[1].rhythm, 'payoff', '节奏角色也跟着切英文');
  eq(en.words.rhythm, 'Rhythm', '表头文案跟着切');
  eq(en.words.subjects, 'Subjects', '文案跟着切');
  eq(en.shots[0].frame, doc().shots[0].frame, '画面描述是内容，原样不动');

  // 缺关键帧就不给缩略图，不摆一个会 404 的 img
  eq(data.shots[0].thumb, '', '没给关键帧目录就没有缩略图');
  const withThumbs = JSON.parse(panelHtml(doc(), layout, { frameDir: '/tmp/f', frameExists: { S01a: true } })
    .split('\n').find((l) => l.startsWith('const DATA = ')).slice('const DATA = '.length, -1));
  eq(withThumbs.shots[0].thumb, '/tmp/f/S01a.jpg', '有图才给路径');
  eq(withThumbs.shots[1].thumb, '', '缺的那张仍然是空');

  // 模型写的字里带标签，不能原样落进页面
  const xss = doc();
  xss.shots[0].frame = '窗台上放着 <script>alert(1)</script> 的纸盒';
  const bad = panelHtml(xss, layout);
  ok(!bad.includes('<script>alert(1)</script>'), '画面描述里的标签被转义');
  ok(bad.includes('\\u003cscript'), '内嵌 JSON 的 < 转义，截不断脚本块');
}

/* ------------------------------------------------------------------ */
/* 动画：每个镜头一条 sendcmd 命令                                       */
/* ------------------------------------------------------------------ */
{
  eq(ramp(10, 10, 0, 0.45), '10', '起止相同就是个常数，不生成表达式');
  eq(ramp(0, 100, 4, 0.5), 'clip(0+100*(t-4)/0.5,0,100)', '一段缓动：从 a 到 b，之后夹住');
  eq(ramp(100, 0, 4, 0.5), 'clip(100+-100*(t-4)/0.5,0,100)', '往回滚也夹得住');
  ok(ramp(0, 5000, 0, 0.45).length < 60,
    '**表达式必须短**：ffmpeg 的解析器在一百来项上直接配置失败（踩过）');

  const shots = [{ id: 'S01', start: 0, end: 4 }, { id: 'S02', start: 4, end: 40 }];
  const rows = [{ id: 'S01', top: 0, height: 110 }, { id: 'S02', top: 117, height: 110 }];
  const m = motionPlan({ shots, rows, view: { x: 27, y: 66, width: 600, height: 463 }, content: 6171 });

  eq(m.commands.length, 6, '两镜 × 三个目标（视窗、亮条、亮条位置）');
  eq(m.commands[0].target, 'crop@win', '第一条驱动滚动窗口');
  eq(m.commands[1].target, 'crop@band', '第二条驱动亮条从长图哪儿裁');
  eq(m.commands[2].target, 'overlay@band', '第三条驱动亮条盖在屏幕哪儿');
  eq(m.commands[3].time, 4, '命令挂在切点上');
  ok(m.commands[4].arg.includes('/0.45'), '默认缓动 0.45 秒');
  ok(m.commands.every((c) => c.arg.length < 120), '每条命令都很短——这是换 sendcmd 的全部理由');
  eq(m.rowHeight, 110, '亮条高度取最高的一行');

  // 长镜头：36 秒的 S02 只在头 0.45 秒里滚，之后 clip 夹住不动
  ok(m.commands[4].arg.startsWith('clip('), '滚完就被夹住，长镜头里纹丝不动');
  eq(m.initial.offset, 0, '首帧的滚动位置');
  eq(m.initial.screenY, 66, '首帧高亮条贴在列表顶边');

  const text = commandFile(m.commands);
  eq(text.split('\n').length, 6, '一行一条命令');
  ok(/^0 crop@win y '/.test(text), 'sendcmd 的格式：时刻 目标 参数 表达式');
  ok(text.trim().endsWith(';'), '每条以分号收尾');

  const custom = motionPlan({ shots, rows, view: { x: 0, y: 0, width: 600, height: 463 }, content: 6171, easeSeconds: 0.8 });
  ok(custom.commands[4].arg.includes('/0.8'), '--ease 能调这段秒数');

  const flat = motionPlan({ shots, rows, view: { x: 0, y: 0, width: 600, height: 463 }, content: 200 });
  eq(flat.maxOffset, 0, '内容没超出视窗就不滚');
  eq(flat.commands[3].arg, '0', '不滚的时候命令就是个常数 0');
}

/* ------------------------------------------------------------------ */
/* ffmpeg 参数：不跑 ffmpeg 也能断言                                     */
/* ------------------------------------------------------------------ */
{
  const layout = plan({ width: 1920, height: 1080 });
  const view = { x: 12, y: 40, width: 1896, height: 700 };
  const motion = motionPlan({
    shots: [{ id: 'S01', start: 0, end: 4 }, { id: 'S02', start: 4, end: 10 }],
    rows: [{ id: 'S01', top: 0, height: 50 }, { id: 'S02', top: 50, height: 60 }],
    view, content: 2000,
  });
  ok(motion.commands.length === 6, '动画命令生成好了再拼参数');
  const args = composeArgs({
    video: 'in.mp4', still: 'static.png', listDim: 'dim.png', listLit: 'lit.png', out: 'out.mp4',
    layout, motion, view, commands: '/tmp/motion.cmd', hasAudio: true,
  });
  const filter = args[args.indexOf('-filter_complex') + 1];

  ok(filter.includes('scale=1920:1080'), '画面按算好的尺寸缩');
  ok(filter.includes('scale=1920:864'), '底板按面板尺寸缩');
  ok(filter.includes(`crop@win=w=${view.width}:h=${view.height}`), '暗底长图按列表视窗裁');
  ok(filter.includes(`crop@band=w=${view.width}:h=${motion.rowHeight}`), '亮条长图只裁一行高');
  ok(filter.includes("sendcmd=f='/tmp/motion.cmd'"), '动画由 sendcmd 驱动');
  ok(filter.includes('crop@win=') && filter.includes('crop@band=') && filter.includes('overlay@band='),
    '三个被驱动的滤镜都起了名字，sendcmd 靠名字找它们');
  ok(filter.includes(`overlay@win=x=${view.x}:y=${view.y}`), '窗口盖回列表的位置');
  eq((filter.match(/overlay@/g) ?? []).length, 2, '两次 overlay：滚动窗口 + 高亮条');
  ok(!filter.includes('drawbox'),
    '不用 drawbox——它的表达式只在初始化时算一次，做不了动画（踩过）');
  ok(filter.includes('vstack=inputs=2'), '横版用 vstack');
  ok(filter.includes('setsar=1'), '两路都压平像素比，否则叠不上');
  ok(filter.includes(`fps=${layout.fps}`), '各路统一帧率');

  eq(args.filter((a) => a === '-loop').length, 3, '三张静态图都要 -loop，否则只有一帧');
  eq(args[args.indexOf('-i') + 1], 'in.mp4', '原片是 0 号输入——换了顺序就成了面板在上');
  ok(args.includes('-map') && args.includes('0:a'), '有声就把原片音轨接过来');
  ok(args.includes('-shortest'), '静态图是无限长的，按原片收');
  ok(args.includes('yuv420p'), '像素格式按通用播放器来');
  eq(args[args.length - 1], 'out.mp4', '输出文件在最后');

  const mute = composeArgs({
    video: 'in.mp4', still: 's.png', listDim: 'd.png', listLit: 'l.png', out: 'o.mp4',
    layout, motion, view, commands: '/tmp/m.cmd', hasAudio: false,
  });
  ok(!mute.includes('0:a'), '无声片不去接不存在的音轨');

  const tall = composeArgs({
    video: 'in.mp4', still: 's.png', listDim: 'd.png', listLit: 'l.png', out: 'o.mp4',
    motion, view, commands: '/tmp/m.cmd', hasAudio: false,
    layout: plan({ width: 1080, height: 1920 }),
  });
  ok(tall[tall.indexOf('-filter_complex') + 1].includes('hstack=inputs=2'), '竖版用 hstack');
}

/* ------------------------------------------------------------------ */
/* 杂项                                                                */
/* ------------------------------------------------------------------ */
{
  eq(fmtTime(0), '00:00.00', '零点');
  eq(fmtTime(75.25), '01:15.25', '过一分钟');
  ok(Object.keys(SHOT_CATEGORIES).length >= 11, '类别词表齐');
  ok(Object.keys(CAMERA_MOVES).length >= 20, '运镜词表齐');
  ok(Object.keys(TRANSITIONS).length >= 8, '转场词表齐');

  let threw = 0;
  try { findChrome('/nope/chrome'); } catch { threw = 1; }
  eq(threw, 1, '指的浏览器不存在就报错，不静默降级');

  // 面板资产必须跟着 skill 走
  for (const asset of ['panel.html', 'panel.css']) {
    const text = readFileSync(new URL(`./${asset}`, import.meta.url), 'utf8');
    ok(text.length > 200, `${asset} 在，且不是空壳`);
  }
}

if (failures.length) {
  process.stderr.write(`\n${failures.length} 项没过：\n`);
  for (const f of failures) process.stderr.write(`  ✗ ${f}\n`);
  process.stderr.write(`\n通过 ${passed}／${passed + failures.length}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`✅ ${passed} 项断言全部通过\n`);
}
