import { sigilTexture } from '../rendering/textures';
import { DOORS, ROOM_BY_ID, OBJECTS } from '../data/manor';
import type { GameState } from '../game/state';
import type { Settings } from '../core/settings';
import { PHASE_LABELS } from '../game/types';
import { whisper } from '../game/hint';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface MenuHandlers {
  newGame(): void;
  cont(): void;
  resume(): void;
  restart(): void;
  toTitle(): void;
  settingsChanged(s: Settings): void;
}

const WALL_NAME = { N: 'north', E: 'east', S: 'south', W: 'west' } as const;

/** All DOM UI: HUD, menus, notes, journal, ending. */
export class UI {
  private noticeTimer = 0;
  private chimeTimer = 0;
  private roomTimer = 0;
  private overlay: 'none' | 'title' | 'pause' | 'settings' | 'credits' | 'note' | 'journal' | 'ending' | 'controls' = 'none';
  private settingsFrom: 'title' | 'pause' = 'title';
  private sigCache = new Map<string, string>();
  onNoteClosed: (() => void) | null = null;

  constructor(root: HTMLElement, private h: MenuHandlers, private settings: Settings, private stateRef: () => GameState) {
    root.innerHTML = `
      <canvas id="view" tabindex="-1"></canvas>
      <div id="hud" class="layer hidden">
        <div id="vignetteEcho"></div>
        <div id="crosshair"></div>
        <div id="hint"></div>
        <div id="notice"></div>
        <div id="roomName"></div>
        <div id="clockTag"></div>
        <div id="echoHud" class="hidden"></div>
        <div id="mirrorHud" class="hidden">glass raised</div>
        <div id="chime"><div class="t"></div><div class="s"></div></div>
      </div>
      <div id="debug" class="hidden layer"></div>
      <div id="fade" class="layer"></div>
      <div id="screens"></div>
    `;
    this.buildScreens();
  }

  get canvas() { return $<HTMLCanvasElement>('view'); }

  private screens() { return $('screens'); }

  private mount(html: string, cls = 'screen dim') {
    const s = this.screens();
    s.innerHTML = `<div class="${cls}">${html}</div>`;
    return s;
  }

  buildScreens() { /* built on demand */ }

  // ------------------------------------------------------------------ overlay control
  get overlayOpen() { return this.overlay !== 'none'; }
  get overlayName() { return this.overlay; }

  clear() { this.screens().innerHTML = ''; this.overlay = 'none'; }

  showLoading() {
    this.mount(`<div id="loading" class="screen" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050305;color:#a89670;letter-spacing:.3em;text-transform:uppercase;font-size:22px">The house is waking<div class="bar" style="width:220px;height:2px;background:rgba(217,180,90,.2);margin-top:22px;overflow:hidden"><i style="display:block;height:100%;width:40%;background:#d9b45a;animation:slide 1.2s infinite ease-in-out"></i></div></div>`, 'screen');
  }

  showTitle(hasSave: boolean) {
    this.overlay = 'title';
    this.hud(false);
    this.mount(`
      <div class="menu">
        <h1 class="title-name">THE SHIFTING MANOR</h1>
        <div class="title-sub">Halloween night &nbsp;·&nbsp; the house is awake</div>
        ${hasSave ? '<button class="btn" data-a="continue">Continue</button>' : ''}
        <button class="btn" data-a="new">New Game</button>
        <button class="btn" data-a="settings">Settings</button>
        <button class="btn" data-a="controls">Controls</button>
        <button class="btn" data-a="credits">Credits</button>
      </div>`, 'screen');
    this.bind({
      continue: () => this.h.cont(),
      new: () => {
        const b = this.screens().querySelector<HTMLElement>('[data-a="new"]')!;
        if (!this.hasSave() || b.dataset.armed) return this.h.newGame();
        b.dataset.armed = '1'; b.textContent = 'Erase save & begin?';
        window.setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'New Game'; } }, 3500);
      },
      settings: () => { this.settingsFrom = 'title'; this.showSettings(); },
      controls: () => this.showControls('title'),
      credits: () => this.showCredits(),
    });
    (this.screens().querySelector('.btn') as HTMLElement)?.focus();
  }

  showPause() {
    this.overlay = 'pause';
    this.mount(`
      <div class="menu">
        <h1 class="title-name" style="font-size:clamp(38px,5vw,64px);margin-bottom:34px">PAUSED</h1>
        <button class="btn" data-a="resume">Resume</button>
        <button class="btn" data-a="journal">Journal</button>
        <button class="btn" data-a="settings">Settings</button>
        <button class="btn" data-a="controls">Controls</button>
        <button class="btn" data-a="restart">Restart</button>
        <button class="btn" data-a="title">Main Menu</button>
      </div>`);
    this.bind({
      resume: () => this.h.resume(),
      journal: () => this.showJournal(true),
      settings: () => { this.settingsFrom = 'pause'; this.showSettings(); },
      controls: () => this.showControls('pause'),
      restart: () => {
        const b = this.screens().querySelector<HTMLElement>('[data-a="restart"]')!;
        if (b.dataset.armed) this.h.restart();
        else { b.dataset.armed = '1'; b.textContent = 'Really restart?'; window.setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Restart'; } }, 3500); }
      },
      title: () => this.h.toTitle(),
    });
    (this.screens().querySelector('.btn') as HTMLElement)?.focus();
  }

  private bind(map: Record<string, () => void>) {
    this.screens().querySelectorAll<HTMLElement>('[data-a]').forEach((el) => {
      el.addEventListener('click', (e) => { e.stopPropagation(); map[el.dataset.a!]?.(); });
    });
  }

  showControls(from: 'title' | 'pause') {
    this.overlay = 'controls';
    this.mount(`
      <div class="panel"><h2>Controls</h2>
        <div class="controls">
          <b>W A S D</b><span>Walk</span>
          <b>Mouse</b><span>Look (click the game to capture the mouse)</span>
          <b>Arrow keys</b><span>Look, if you would rather not use the mouse</span>
          <b>Shift</b><span>Walk faster</span>
          <b>E</b><span>Open doors · light or snuff candles · read · use</span>
          <b>F &nbsp;/&nbsp; Right mouse</b><span>Raise the Seer's Glass (once you find it)</span>
          <b>Q</b><span>Begin / end an echo of yourself (once the dead grant it)</span>
          <b>Tab</b><span>Journal: what you have learned about the house</span>
          <b>Esc</b><span>Pause</span>
        </div>
        <div style="text-align:center;margin-top:26px"><button class="btn small" data-a="back">Back</button></div>
      </div>`);
    this.bind({ back: () => (from === 'title' ? this.showTitle(this.hasSave()) : this.showPause()) });
  }

  hasSave = () => false;

  showCredits() {
    this.overlay = 'credits';
    this.mount(`
      <div class="panel credits" style="text-align:center"><h2>Credits</h2>
        <h3>Design &amp; Code</h3><p>Built with Three.js, TypeScript and Vite.</p>
        <h3>Art</h3><p>Every texture, sigil, painting and model is generated procedurally at runtime.</p>
        <h3>Sound</h3><p>All sound and music is synthesised live with the Web Audio API.</p>
        <h3>Licences</h3><p>No third-party art or audio assets are used. Three.js is MIT licensed. See ASSETS.md.</p>
        <div style="margin-top:26px"><button class="btn small" data-a="back">Back</button></div>
      </div>`);
    this.bind({ back: () => this.showTitle(this.hasSave()) });
  }

  showSettings() {
    this.overlay = 'settings';
    const s = this.settings;
    const slider = (id: string, label: string, min: number, max: number, step: number, v: number, fmt = (n: number) => n.toFixed(2)) =>
      `<div class="row"><label>${label}</label><input type="range" id="s_${id}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="val" id="v_${id}">${fmt(v)}</span></div>`;
    this.mount(`
      <div class="panel" style="width:min(680px,92vw)"><h2>Settings</h2>
        ${slider('sens', 'Mouse sensitivity', 0.2, 3, 0.05, s.sensitivity)}
        ${slider('fov', 'Field of view', 60, 105, 1, s.fov, (n) => Math.round(n) + '°')}
        ${slider('master', 'Master volume', 0, 1, 0.01, s.master, (n) => Math.round(n * 100) + '%')}
        ${slider('music', 'Music volume', 0, 1, 0.01, s.music, (n) => Math.round(n * 100) + '%')}
        ${slider('sfx', 'Effects volume', 0, 1, 0.01, s.sfx, (n) => Math.round(n * 100) + '%')}
        <div class="row"><label>Graphics quality</label>
          <select id="s_quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        <div class="row"><label>Head bob</label><input type="checkbox" id="s_bob" ${s.headBob ? 'checked' : ''} style="width:22px;height:22px;accent-color:#d9b45a"></div>
        <div class="row"><label>Invert mouse Y</label><input type="checkbox" id="s_inv" ${s.invertY ? 'checked' : ''} style="width:22px;height:22px;accent-color:#d9b45a"></div>
        <div style="text-align:center;margin-top:26px"><button class="btn small" data-a="back">Back</button></div>
      </div>`);
    const sel = $<HTMLSelectElement>('s_quality');
    sel.value = s.quality;
    const wire = (id: string, key: 'sensitivity' | 'fov' | 'master' | 'music' | 'sfx', fmt: (n: number) => string) => {
      const el = $<HTMLInputElement>('s_' + id);
      el.addEventListener('input', () => {
        s[key] = parseFloat(el.value);
        $('v_' + id).textContent = fmt(s[key]);
        this.h.settingsChanged(s);
      });
    };
    wire('sens', 'sensitivity', (n) => n.toFixed(2));
    wire('fov', 'fov', (n) => Math.round(n) + '°');
    wire('master', 'master', (n) => Math.round(n * 100) + '%');
    wire('music', 'music', (n) => Math.round(n * 100) + '%');
    wire('sfx', 'sfx', (n) => Math.round(n * 100) + '%');
    sel.addEventListener('change', () => { s.quality = sel.value as Settings['quality']; this.h.settingsChanged(s); });
    $<HTMLInputElement>('s_bob').addEventListener('change', (e) => { s.headBob = (e.target as HTMLInputElement).checked; this.h.settingsChanged(s); });
    $<HTMLInputElement>('s_inv').addEventListener('change', (e) => { s.invertY = (e.target as HTMLInputElement).checked; this.h.settingsChanged(s); });
    this.bind({ back: () => (this.settingsFrom === 'title' ? this.showTitle(this.hasSave()) : this.showPause()) });
  }

  // ------------------------------------------------------------------ notes & journal
  showNote(title: string, text: string) {
    this.overlay = 'note';
    this.mount(`<div class="paper"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="close">E or Esc to put it down</div></div>`, 'screen dim');
    this.screens().firstElementChild!.addEventListener('click', () => this.closeNote());
  }

  closeNote() {
    if (this.overlay !== 'note') return;
    this.clear();
    this.onNoteClosed?.();
  }

  sigImg(name: string): string {
    let u = this.sigCache.get(name);
    if (!u) {
      const tex = sigilTexture(name as never, '#d9b45a', 128);
      u = (tex.image as HTMLCanvasElement).toDataURL();
      this.sigCache.set(name, u);
    }
    return u;
  }

  private journalTab: 'doors' | 'notes' | 'rooms' = 'doors';

  showJournal(fromPause = false) {
    this.overlay = 'journal';
    const st = this.stateRef();
    const tab = this.journalTab;
    let body = '';
    if (tab === 'doors') {
      const rows: string[] = [];
      for (const d of DOORS) {
        if (d.kind !== 'shifting') continue;
        const c = st.cycle(d);
        if (c.length < 2 || !st.hasLearned(d.id)) continue;
        const ptr = st.ptr[d.id] % c.length;
        const rn = ROOM_BY_ID[d.room].name;
        const sigs = c.map((did, i) => {
          const r = ROOM_BY_ID[st.door(did).room];
          return `<div class="sig ${i === ptr ? 'now' : ''}"><img src="${this.sigImg(r.sigil ?? 'star')}">${r.name}</div>`;
        }).join('');
        rows.push(`<div class="doorrow"><div class="lbl">The ${WALL_NAME[d.wall]} door of the ${rn}${st.isHeld(d) ? ' <span style="color:#ffb866">(held by candle)</span>' : ''}</div><div class="sigs">${sigs}</div></div>`);
      }
      body = `<div class="entry" style="border-color:rgba(217,180,90,.4)"><h4>Where you are going</h4><p>${esc(goalText(st))}</p><p style="margin-top:6px;color:#ffb866;font-size:0.9em">The house has turned ${st.turns} time${st.turns === 1 ? '' : 's'} since the last chime.</p></div>` + (rows.length
        ? `<p class="empty jhint" style="margin-top:0">What you have learned about the restless doors, and where each will lead in turn. The glowing sigil is where it leads now.</p>${rows.join('')}`
        : `<p class="empty">You have not learned where any restless door leads. Raise the Seer\'s Glass (hold F) in a room, or read Ismene\'s pages, and the house will remember for you.</p>`);
    } else if (tab === 'notes') {
      const es = OBJECTS.filter((o) => (o.type === 'note' || o.type === 'matches') && st.notes.has(o.id)).map(
        (o) => `<div class="entry"><h4>${esc(o.title ?? '')}</h4><p>${esc(o.text ?? '')}</p></div>`,
      );
      body = es.length ? es.join('') : `<p class="empty">Nothing yet.</p>`;
    } else {
      const rs = [...st.visited].map((id) => {
        const r = ROOM_BY_ID[id];
        return `<div class="doorrow"><div class="sigs"><div class="sig" style="width:60px"><img src="${this.sigImg(r.sigil ?? 'star')}"></div></div><div class="lbl">${r.name}</div></div>`;
      });
      body = rs.join('') || '<p class="empty">Nowhere.</p>';
    }
    this.mount(`
      <div class="panel journal"><h2>Journal</h2>
        <div class="tabs">
          <button class="tab ${tab === 'doors' ? 'on' : ''}" data-a="t_doors">Restless doors</button>
          <button class="tab ${tab === 'notes' ? 'on' : ''}" data-a="t_notes">Notes</button>
          <button class="tab ${tab === 'rooms' ? 'on' : ''}" data-a="t_rooms">Sigils</button>
        </div>
        <div class="jbody">${body}</div>
        <div id="whisper" style="text-align:center;margin-top:8px">${tab === 'doors' && (st.turns >= 3 || st.phase === 3) && !st.flags.has('ending') ? '<button class="btn small" data-a="whisper" style="font-size:15px;padding:4px 14px">Ask the house for a whisper (a hint)</button>' : ''}</div>
        <div style="text-align:center;margin-top:14px"><button class="btn small" data-a="back">${fromPause ? 'Back' : 'Close (Tab)'}</button></div>
      </div>`);
    const jb = this.screens().querySelector<HTMLElement>('.jbody');
    if (jb) {
      const more = document.createElement('div');
      more.className = 'jmore';
      more.textContent = 'scroll for more \u25BE';
      jb.parentElement!.insertBefore(more, jb.nextSibling);
      const upd = () => { more.style.display = jb.scrollHeight - jb.scrollTop - jb.clientHeight > 24 ? 'block' : 'none'; };
      jb.addEventListener('scroll', upd);
      more.style.display = 'none';
      requestAnimationFrame(() => requestAnimationFrame(upd));
    }
    this.bind({
      whisper: () => {
        const w = whisper(this.stateRef());
        const box = this.screens().querySelector<HTMLElement>('#whisper')!;
        box.innerHTML = w && w.length ? `<div style="text-align:left;margin:6px 24px;font-style:italic;color:#ffb866;font-size:16px;line-height:1.35"><b>The house whispers:</b><br>${w.map((x, i) => `${i + 1}. ${esc(x)}`).join('<br>')}</div>` : '<div style="font-style:italic;color:#a89670">The house has nothing to whisper just now.</div>';
      },
      t_doors: () => { this.journalTab = 'doors'; this.showJournal(fromPause); },
      t_notes: () => { this.journalTab = 'notes'; this.showJournal(fromPause); },
      t_rooms: () => { this.journalTab = 'rooms'; this.showJournal(fromPause); },
      back: () => { if (fromPause) this.showPause(); else this.h.resume(); },
    });
  }

  // ------------------------------------------------------------------ HUD
  hud(on: boolean) { $('hud').classList.toggle('hidden', !on); }

  setHint(text: string | null, kbd = 'E') {
    const el = $('hint');
    if (text) { el.innerHTML = `<kbd>${kbd}</kbd>${esc(text)}`; el.classList.add('on'); } else el.classList.remove('on');
    $('crosshair').classList.toggle('on', !!text);
  }

  /** a notice is currently on screen */
  get noticeActive() { return $('notice').classList.contains('on'); }

  /** show only if nothing more important is already being shown */
  softNotice(text: string, ms = 4200) { if (!this.noticeActive) this.notice(text, ms); }

  notice(text: string, ms = 4200) {
    const el = $('notice');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => el.classList.remove('on'), ms);
  }

  clearNotice() { $('notice').classList.remove('on'); }

  roomName(name: string) {
    const el = $('roomName');
    el.textContent = name;
    el.classList.add('on');
    clearTimeout(this.roomTimer);
    this.roomTimer = window.setTimeout(() => el.classList.remove('on'), 3400);
  }

  clockTag(phase: number) { $('clockTag').textContent = PHASE_LABELS[phase]; }

  chime(title: string, sub: string, ms = 5200) {
    const el = $('chime');
    el.querySelector('.t')!.textContent = title;
    el.querySelector('.s')!.textContent = sub;
    el.classList.add('on');
    clearTimeout(this.chimeTimer);
    this.chimeTimer = window.setTimeout(() => el.classList.remove('on'), ms);
  }

  fade(a: number, ms = 0) {
    const el = $('fade');
    el.style.transition = ms ? `opacity ${ms}ms linear` : 'none';
    el.style.opacity = String(a);
  }

  echoHud(text: string | null) {
    const el = $('echoHud');
    el.classList.toggle('hidden', !text);
    if (text) el.textContent = text;
    $('vignetteEcho').classList.toggle('on', !!text && text.startsWith('ECHO'));
  }

  mirrorHud(on: boolean) { $('mirrorHud').classList.toggle('hidden', !on); }

  debug(text: string | null) {
    const el = $('debug');
    el.classList.toggle('hidden', text === null);
    if (text !== null) el.textContent = text;
  }

  // ------------------------------------------------------------------ ending
  showEnding(lines: string[], onDone: () => void) {
    this.overlay = 'ending';
    this.hud(false);
    const s = this.screens();
    s.innerHTML = `<div class="screen" id="ending"><div id="endLines"></div></div>`;
    const box = $('endLines');
    requestAnimationFrame(() => $('ending').classList.add('on'));
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        const b = document.createElement('div');
        b.innerHTML = `<button class="btn" data-a="again" style="margin-top:28px">Return to the Title</button>`;
        box.appendChild(b);
        b.querySelector('button')!.addEventListener('click', onDone);
        return;
      }
      const big = lines[i].startsWith('#');
      if (big) { $('ending').classList.add('black'); box.innerHTML = ''; }
      else if (box.children.length > 2) box.removeChild(box.firstChild!);
      const p = document.createElement('div');
      p.className = 'line' + (big ? ' big' : '');
      p.textContent = big ? lines[i].slice(1) : lines[i];
      box.appendChild(p);
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
      i++;
      timer = window.setTimeout(next, big ? 3600 : 4200);
    };
    let timer = window.setTimeout(next, 1500);
    const skip = () => {
      if (this.overlay !== 'ending' || i >= lines.length) return;
      window.clearTimeout(timer);
      i = Math.max(i, lines.length - 2); // jump to the title card
      next();
    };
    $('ending').addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) skip(); });
    const key = (e: KeyboardEvent) => { if (this.overlay !== 'ending') { document.removeEventListener('keydown', key); return; } if (e.code === 'Space' || e.code === 'Enter') skip(); };
    document.addEventListener('keydown', key);
  }
}

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function goalText(st: GameState): string {
  if (st.flags.has('ending')) return 'It is over.';
  switch (st.phase) {
    case 0: return 'Ismene wrote of a glass that tells the truth. Somewhere in this house there is a hall of mirrors (the eye). Doors hung with lanterns are restless: learn how they move.';
    case 1: return 'The great clock has to be wound. Find the room of the Bell. Raise the Seer\'s Glass (F) in a room to learn where its restless doors lead; the great mirror in the Hall of Mirrors also writes what it knows, in writing only the glass can read.';
    case 2: return 'Ambrose lies below the cellar. Find the room of the Skull. Candles hold restless doors still while the rest of the house turns.';
    case 3: return st.flags.has('danceDone') ? 'The ballroom doors are unbarred. Climb through to the Upper Hall.' : st.room === 'ballroom' || st.visited.has('ballroom') ? 'The Lady\'s waltz is a duet of four mirrored steps. Record your echo walking the LEFT-hand sigils in the Lady\'s order (Q to begin, Q to release); it will keep dancing. Then take the matching RIGHT-hand sigil of each pair, in step with it. The lit pair is the next step.' : 'The crypt\'s iron gate is held by two plates, and you have only one pair of feet. Press Q to leave an echo of yourself on one of them. Beyond it lies the ballroom; the grand stair in the hall leads there too.';
    default: return 'Reach the Attic Stair (the star) and the attic beyond it. The house is tearing itself open: hold what you need with a candle, trust the glass, and leave an echo where you cannot be.';
  }
}
