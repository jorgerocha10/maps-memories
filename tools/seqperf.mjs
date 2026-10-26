// Phone hero smoothness: scroll through the hero at a steady pace on a throttled phone
// profile and report frame pacing, long tasks and how far the shown frame lags the wanted one.
// node tools/seqperf.mjs [cpuThrottle=4] [url]
import {chromium} from 'playwright-core';
const [rate = '4', url = 'http://localhost:4500/?debug=1'] = process.argv.slice(2);
const b = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const ctx = await b.newContext({viewport:{width:412,height:915},deviceScaleFactor:2.6,isMobile:true,hasTouch:true});
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(url, {waitUntil:'networkidle'}); await p.waitForTimeout(2500);   // let all frames download
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', {rate:+rate});
await p.evaluate(() => {
  const s = window.__perf = {dt: [], lag: [], long: [], last: 0};
  new PerformanceObserver(l => l.getEntries().forEach(e => s.long.push(Math.round(e.duration)))).observe({type:'longtask', buffered:false});
  const tick = t => { if (s.last) s.dt.push(t - s.last); s.last = t; const q = window.__seq; if (q && q.shown >= 0) s.lag.push(Math.abs(q.want - q.shown)); s.raf = requestAnimationFrame(tick); };
  s.raf = requestAnimationFrame(tick);
});
// Scroll down the whole hero in ~4 s, like a steady thumb, then back up faster.
await cdp.send('Performance.enable'); const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const m0 = await met();
const total = await p.evaluate(() => document.querySelector('#top').offsetHeight - innerHeight);
const step = async (from, to, ms) => { const n = Math.round(ms / 16); for (let i = 1; i <= n; i++) { await p.evaluate(y => scrollTo(0, y), from + (to - from) * i / n); await p.waitForTimeout(16); } };
await step(0, total, 4000); await step(total, 0, 2000);
const m1 = await met(); const d = k => Math.round(m1[k] - m0[k]);
console.log(`layouts ${d('LayoutCount')}  style recalcs ${d('RecalcStyleCount')}  layout ms ${Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000)}  style ms ${Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000)}  script ms ${Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000)}`);
const r = await p.evaluate(() => { cancelAnimationFrame(window.__perf.raf); return window.__perf; });
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(f * (s.length - 1))] : 0; };
console.log(`cpu x${rate}  frames ${r.dt.length}  frame ms p50 ${q(r.dt,.5).toFixed(1)} p90 ${q(r.dt,.9).toFixed(1)} p99 ${q(r.dt,.99).toFixed(1)}  >50ms: ${r.dt.filter(d=>d>50).length}`);
console.log(`shown-vs-wanted lag (frames) p50 ${q(r.lag,.5)} p90 ${q(r.lag,.9)} max ${Math.max(0,...r.lag)}`);
console.log(`long tasks: ${r.long.length}  ${r.long.slice(0,15).join(' ')}`);
console.log(errs.join('\n') || 'no errors'); await b.close();
