import { CONFIG } from '../config/siteConfig.js';

/* Exports of the SAVED block (exactly what the athlete sees in the app — check-in adjustments, the
   "This week (continues)" bridge and rest days included), as a print-ready PDF and a styled Excel workbook. */

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LIFT = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };

const RULES = [
  ['Warm-up', 'Bar ×8 → 40% ×5 → 55% ×3 → 70% ×2 → 80% ×1 → work sets. Warm-ups should never tire you.'],
  ['RPE', 'RPE 7 = 3 reps left · RPE 8 = 2 left · RPE 9 = 1 left · RPE 10 = nothing left. The % is the plan; RPE is the judge.'],
  ['Adjust in the session', 'RPE 1+ above target → next sets 5% lighter. RPE 1.5+ below → +2.5 kg. Missed reps → lighter, never grind.'],
  ['Rest', 'Main lifts 3–5 min · accessories 1.5–2 min.'],
  ['Pain', 'Pain ends the set — it is a signal, not effort. Two painful sets → stop that lift for the day.'],
  ['Missed a day?', 'Never double up. Do the next session; the plan keeps going.'],
  ['Standard', 'Every rep competition-legal: depth, pause, lockout. A rep you could not repeat on the platform is not volume.'],
];

/** Everything the exports need, from the saved snapshot. */
export function blockSummary(snap, athlete) {
  const weeks = snap?.weeks || [];
  const days = weeks.flatMap((w) => w.days || []);
  const sessions = days.filter((d) => !d.rest && !d.meetDay).length;
  const first = days.find((d) => d.date)?.date || '';
  const last = [...days].reverse().find((d) => d.date)?.date || '';
  const maxes = snap?.meta?.maxes || {};
  const meet = days.find((d) => d.meetDay);
  return {
    athlete: athlete || snap?.meta?.form?.name || 'Athlete',
    block: snap?.blockType || 'Training Block',
    range: first && last ? `${first} – ${last}` : '',
    weeks: weeks.length, sessions,
    freq: snap?.meta?.freq || '',
    maxes: ['squat', 'bench', 'deadlift'].filter((l) => maxes[l]).map((l) => `${LIFT[l]} ${maxes[l]} kg`).join(' · '),
    meet: meet ? `${meet.weekday} ${meet.date}` : null,
    notes: snap?.meta?.notes || [],
  };
}

const exLoad = (e) => (e.weight !== '' && e.weight !== null && e.weight !== undefined ? `${e.weight} kg` : e.type === 'Main' ? '—' : 'pick a weight');
const exPct = (e) => (e.pct ? `${e.pct}%` : '');
const exRpe = (e) => (e.rpe && e.rpe !== '—' ? (String(e.rpe).startsWith('RPE') ? e.rpe : `RPE ${e.rpe}`) : '');
/** Day notes minus the ones already printed under an exercise. */
const dayExtraNotes = (d) => {
  const shown = new Set((d.exercises || []).map((e) => e.note).filter(Boolean));
  return String(d.notes || '').split(' · ').filter((n) => n && !shown.has(n)).join(' · ');
};
const weekTag = (w) => (w.bridge ? 'Continues previous block' : w.meetWeek ? 'Meet week' : w.taper ? 'Taper' : w.deload ? 'Deload' : '');

/* ---------------- PDF (print-ready HTML → browser "Save as PDF") ---------------- */
export function blockPrintHTML(snap, athlete) {
  const s = blockSummary(snap, athlete);
  const weekPages = (snap.weeks || []).map((w) => {
    const training = w.days.filter((d) => !d.rest);
    const rest = w.days.filter((d) => d.rest);
    const tag = weekTag(w);
    return `
    <section class="page">
      <header class="wk">
        <div><p class="eyebrow">${esc(s.block)}</p><h2>${esc(w.label || `Week ${w.week}`)}</h2></div>
        ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
      </header>
      ${(w.weekNotes || []).map((n) => `<p class="wnote">${esc(n)}</p>`).join('')}
      ${training.map((d) => d.meetDay ? `
        <div class="day meet"><div class="dh"><b>${esc(d.weekday)} ${esc(d.date)}</b><span>${esc(d.focus)}</span></div>
        ${d.notes ? `<p class="dnote">${esc(d.notes)}</p>` : ''}</div>` : `
        <div class="day">
          <div class="dh"><b>${esc(d.weekday)} ${esc(d.date || '')}</b><span>${esc(d.focus)}${d.optional ? ' · optional' : ''}</span></div>
          <table>
            <thead><tr><th class="ex">Exercise</th><th>Sets × reps</th><th>Load</th><th>%</th><th>RPE</th><th class="log">Done: kg × reps @RPE</th></tr></thead>
            <tbody>${(d.exercises || []).map((e) => `
              <tr class="${e.type === 'Main' ? 'main' : 'acc'}"><td class="ex">${esc(e.name)}${e.note && e.type === 'Main' ? `<small>${esc(e.note)}</small>` : ''}</td>
              <td>${esc(e.sets)} × ${esc(e.reps)}</td><td>${esc(exLoad(e))}</td><td>${esc(exPct(e))}</td><td>${esc(exRpe(e))}</td><td class="log"></td></tr>`).join('')}
            </tbody>
          </table>
          ${dayExtraNotes(d) ? `<p class="dnote">${esc(dayExtraNotes(d))}</p>` : ''}
        </div>`).join('')}
      ${rest.length ? `<p class="rest"><b>Rest days:</b> ${rest.map((d) => `${esc(d.weekday.slice(0, 3))} ${esc(d.date || '')}`).join(' · ')} — walk, mobility, sleep 7–9 h, protein. Rest is when you get stronger.</p>` : ''}
      <footer>${esc(CONFIG.brand)} · Iron Engine · ${esc(s.athlete)}</footer>
    </section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.athlete)} — ${esc(s.block)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;600;700&display=swap">
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 10.5pt/1.45 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #16181d; background: #fff; }
  h1, h2, .brand { font-family: 'Archivo Black', 'Arial Black', Impact, sans-serif; font-weight: 400; letter-spacing: -.01em; margin: 0; }
  .page { page-break-after: always; break-after: page; padding: 4mm 2mm; position: relative; min-height: 268mm; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .cover { background: #111318; color: #edeae2; padding: 18mm 14mm; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { font-size: 22pt; } .brand span { color: #c8102e; }
  .cover h1 { font-size: 34pt; line-height: 1.05; margin-top: 30mm; }
  .cover .who { font-size: 14pt; color: #9ba1ac; margin-top: 4mm; }
  .facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm 10mm; margin-top: 14mm; }
  .facts div { border-top: 1px solid #313742; padding-top: 2.5mm; }
  .facts p { margin: 0; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; color: #9ba1ac; }
  .facts b { font-size: 12.5pt; }
  .redbar { height: 3mm; background: #c8102e; width: 40mm; margin-top: 8mm; }
  .eyebrow { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: #c8102e; margin: 0 0 1mm; font-weight: 700; }
  .wk { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #16181d; padding-bottom: 2mm; margin-bottom: 3mm; }
  .wk h2 { font-size: 18pt; }
  .tag { background: #f8e3e7; color: #b80f2a; font-weight: 700; font-size: 8pt; padding: 1mm 2.5mm; border-radius: 1mm; text-transform: uppercase; letter-spacing: .06em; }
  .wnote { background: #f4f3f0; padding: 2mm 3mm; margin: 0 0 3mm; font-size: 9pt; }
  .day { margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
  .dh { display: flex; gap: 3mm; align-items: baseline; background: #111318; color: #edeae2; padding: 1.6mm 3mm; }
  .dh b { font-size: 10pt; } .dh span { color: #c9c4b8; font-size: 9pt; }
  .meet .dh { background: #c8102e; color: #fff; } .meet .dh span { color: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: #5d636e; border-bottom: 1px solid #dcdad4; padding: 1.4mm 2mm; font-weight: 700; }
  td { border-bottom: 1px solid #ecebe7; padding: 1.6mm 2mm; vertical-align: top; font-variant-numeric: tabular-nums; }
  td.ex, th.ex { width: 36%; } td:not(.ex):not(.log) { white-space: nowrap; } td small { display: block; color: #5d636e; font-size: 7.5pt; margin-top: .5mm; }
  tr.main td.ex { font-weight: 700; } tr.acc td { color: #3a3f48; }
  td.log, th.log { width: 26%; } td.log { border-left: 1px dashed #c9c6be; }
  .dnote { font-size: 8.5pt; color: #5d636e; margin: 1.5mm 0 0; }
  .rest { font-size: 8.5pt; color: #5d636e; border-top: 1px solid #dcdad4; padding-top: 2mm; }
  footer { position: absolute; bottom: 0; left: 2mm; right: 2mm; font-size: 7pt; color: #9ba1ac; text-transform: uppercase; letter-spacing: .12em; border-top: 1px solid #ecebe7; padding-top: 1.5mm; }
  .rules dt { font-weight: 700; margin-top: 3mm; } .rules dd { margin: .5mm 0 0; color: #3a3f48; }
  .notes li { margin: 1.2mm 0; color: #3a3f48; font-size: 9.5pt; }
  @media screen { body { background: #e9e7e2; } .page { background: #fff; max-width: 210mm; margin: 6mm auto; box-shadow: 0 2px 12px rgba(0,0,0,.12); padding: 12mm; } .cover { background: #111318; } }
</style></head><body>
  <section class="page cover">
    <div><p class="brand">LALIT<span>LIFTS</span></p><p style="margin:2mm 0 0;color:#9ba1ac;letter-spacing:.14em;font-size:8pt;text-transform:uppercase">Iron Engine · Personal training block</p></div>
    <div>
      <h1>${esc(s.block)}</h1>
      <p class="who">${esc(s.athlete)}</p>
      <div class="redbar"></div>
      <div class="facts">
        <div><p>Dates</p><b>${esc(s.range)}</b></div>
        <div><p>Length</p><b>${s.weeks} weeks · ${s.sessions} sessions</b></div>
        ${s.freq ? `<div><p>Frequency</p><b>${esc(s.freq)}</b></div>` : ''}
        ${s.maxes ? `<div><p>Working maxes</p><b>${esc(s.maxes)}</b></div>` : ''}
        ${s.meet ? `<div><p>Meet day</p><b>${esc(s.meet)}</b></div>` : ''}
      </div>
    </div>
    <p style="font-size:8pt;color:#6b7280">Built from your assessment by Iron Engine. Log every session in the app — the next block is built from your results. Coaching: @${esc(CONFIG.insta)}</p>
  </section>
  <section class="page">
    <header class="wk"><div><p class="eyebrow">Before you start</p><h2>How to run this block</h2></div></header>
    <dl class="rules">${RULES.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${s.notes.length ? `<h3 style="margin:8mm 0 2mm;font-size:11pt">Why this plan</h3><ul class="notes">${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <footer>${esc(CONFIG.brand)} · Iron Engine · ${esc(s.athlete)}</footer>
  </section>
  ${weekPages}
</body></html>`;
}

/** Opens the print view in a new tab; the athlete taps Print → Save as PDF. Must run inside a click handler. */
export function printBlock(snap, athlete) {
  const html = blockPrintHTML(snap, athlete);
  const win = window.open('', '_blank');
  if (!win) {
    // Popup blocked: download the HTML instead (opens in any browser, prints the same).
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'iron-engine-block.html' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  win.document.open(); win.document.write(html); win.document.close();
  // Let the web fonts load before the print dialog takes its snapshot.
  const go = () => { try { win.focus(); win.print(); } catch { /* user can still use the browser's print */ } };
  if (win.document.fonts?.ready) win.document.fonts.ready.then(() => setTimeout(go, 150)); else setTimeout(go, 600);
}

/* ---------------- Excel (styled, one sheet per week + overview) ---------------- */
const INK = 'FF111318', RED = 'FFC8102E', CHALK = 'FFEDEAE2', LINE = 'FFDCDAD4', SOFT = 'FFF4F3F0', MUTED = 'FF5D636E';

export async function downloadBlockXlsx(snap, athlete) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = buildBlockWorkbook(ExcelJS, snap, athlete);
  const s = blockSummary(snap, athlete);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const file = `${s.athlete.trim().toLowerCase().replace(/\s+/g, '-') || 'athlete'}-${s.block.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.xlsx`;
  const a = Object.assign(document.createElement('a'), { href: url, download: file });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** The styled workbook (no DOM — also used by tests). */
export function buildBlockWorkbook(ExcelJS, snap, athlete) {
  const s = blockSummary(snap, athlete);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LalitLifts Iron Engine';
  wb.created = new Date();

  // Overview
  const ov = wb.addWorksheet('Overview', { views: [{ showGridLines: false }] });
  ov.columns = [{ width: 24 }, { width: 90 }];
  ov.mergeCells('A1:B1');
  Object.assign(ov.getCell('A1'), { value: `${CONFIG.brand} · IRON ENGINE`, font: { bold: true, size: 11, color: { argb: 'FFC9A24B' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } } });
  ov.mergeCells('A2:B2');
  Object.assign(ov.getCell('A2'), { value: s.block, font: { bold: true, size: 22, color: { argb: CHALK } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } } });
  ov.getRow(2).height = 34;
  ov.mergeCells('A3:B3');
  Object.assign(ov.getCell('A3'), { value: s.athlete, font: { size: 12, color: { argb: 'FF9BA1AC' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } } });
  ov.getRow(4).height = 6;
  ov.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  ov.getCell('B4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  const facts = [['Dates', s.range], ['Length', `${s.weeks} weeks · ${s.sessions} sessions`], ['Frequency', s.freq], ['Working maxes', s.maxes], ...(s.meet ? [['Meet day', s.meet]] : [])].filter(([, v]) => v);
  let r = 6;
  for (const [k, v] of facts) { ov.getCell(`A${r}`).value = k; ov.getCell(`A${r}`).font = { bold: true, color: { argb: MUTED } }; ov.getCell(`B${r}`).value = v; ov.getCell(`B${r}`).font = { bold: true, size: 12 }; r++; }
  r++;
  ov.getCell(`A${r}`).value = 'HOW TO RUN THIS BLOCK'; ov.getCell(`A${r}`).font = { bold: true, color: { argb: RED } }; r++;
  for (const [k, v] of RULES) { ov.getCell(`A${r}`).value = k; ov.getCell(`A${r}`).font = { bold: true }; Object.assign(ov.getCell(`B${r}`), { value: v, alignment: { wrapText: true, vertical: 'top' } }); r++; }
  if (s.notes.length) {
    r++; ov.getCell(`A${r}`).value = 'WHY THIS PLAN'; ov.getCell(`A${r}`).font = { bold: true, color: { argb: RED } }; r++;
    for (const n of s.notes) { Object.assign(ov.getCell(`B${r}`), { value: n, alignment: { wrapText: true, vertical: 'top' } }); r++; }
  }
  r++; ov.getCell(`A${r}`).value = `Coaching: @${CONFIG.insta}`; ov.getCell(`A${r}`).font = { italic: true, color: { argb: MUTED } };

  // One sheet per week
  const used = new Set();
  const HEAD = ['Day', 'Session', 'Exercise', 'Sets', 'Reps', 'Load (kg)', '%1RM', 'RPE', 'Notes', 'Your kg', 'Your reps', 'Your RPE', '✓'];
  for (const w of snap.weeks || []) {
    let name = (w.label || `Week ${w.week}`).replace(/[\\/?*[\]:]/g, '').slice(0, 28);
    while (used.has(name)) name = `${name.slice(0, 26)} ${used.size}`;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    ws.columns = [{ width: 14 }, { width: 26 }, { width: 38 }, { width: 6 }, { width: 8 }, { width: 10 }, { width: 7 }, { width: 9 }, { width: 44 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 4 }];
    ws.mergeCells('A1:M1');
    const tag = weekTag(w);
    Object.assign(ws.getCell('A1'), { value: `${w.label || `Week ${w.week}`}${tag ? ` · ${tag}` : ''} — ${s.block}`, font: { bold: true, size: 14, color: { argb: CHALK } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }, alignment: { vertical: 'middle' } });
    ws.getRow(1).height = 26;
    ws.mergeCells('A2:M2');
    Object.assign(ws.getCell('A2'), { value: (w.weekNotes || []).join('  ') || `${s.athlete} · ${s.range}`, font: { italic: true, size: 9, color: { argb: MUTED } }, alignment: { wrapText: true } });
    const head = ws.getRow(3);
    HEAD.forEach((h, i) => { const c = head.getCell(i + 1); c.value = h; c.font = { bold: true, size: 9, color: { argb: i >= 9 ? RED : MUTED } }; c.border = { bottom: { style: 'medium', color: { argb: INK } } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i >= 9 ? 'FFF8E3E7' : SOFT } }; });

    for (const d of w.days || []) {
      const dayLabel = `${(d.weekday || '').slice(0, 3)} ${d.date || ''}`.trim();
      if (d.rest) {
        const row = ws.addRow([dayLabel, 'Rest', '', '', '', '', '', '', d.notes || 'Walk, mobility, sleep.']);
        row.font = { italic: true, size: 9, color: { argb: 'FF9BA1AC' } };
        continue;
      }
      const band = ws.addRow([dayLabel, d.focus + (d.optional ? ' (optional)' : '')]);
      band.eachCell((c) => { c.font = { bold: true, color: { argb: d.meetDay ? 'FFFFFFFF' : CHALK } }; });
      for (let i = 1; i <= 13; i++) band.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: d.meetDay ? RED : 'FF2A2F38' } };
      for (const e of d.exercises || []) {
        const row = ws.addRow(['', '', e.name, Number(e.sets) || e.sets, e.reps, e.weight === '' || e.weight === null || e.weight === undefined ? '' : Number(e.weight) || e.weight, e.pct ? `${e.pct}%` : '', exRpe(e), e.type === 'Main' ? (e.note || '') : '']);
        row.font = { bold: e.type === 'Main', size: 10 };
        row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
        for (let i = 1; i <= 13; i++) row.getCell(i).border = { bottom: { style: 'hair', color: { argb: LINE } } };
        for (let i = 10; i <= 13; i++) row.getCell(i).border = { ...row.getCell(i).border, left: { style: 'hair', color: { argb: 'FFC9C6BE' } } };
      }
      if (dayExtraNotes(d) && !d.meetDay) { const n = ws.addRow(['', '', dayExtraNotes(d)]); n.font = { italic: true, size: 9, color: { argb: MUTED } }; ws.mergeCells(n.number, 3, n.number, 9); n.getCell(3).alignment = { wrapText: true }; }
      if (d.meetDay && d.notes) { const n = ws.addRow(['', '', d.notes]); n.font = { size: 9 }; ws.mergeCells(n.number, 3, n.number, 13); n.getCell(3).alignment = { wrapText: true }; }
      ws.addRow([]);
    }
  }

  return wb;
}
