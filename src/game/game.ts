import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameState } from './state';
import { DOORS, OBJECTS, ROOM_BY_ID, START_DOOR, DANCE } from '../data/manor';
import { danceState, resetDance, updateDance, analyzeRoute } from './dance';
import type { GameEvent, Phase, RoomId } from './types';
import { PHASE_LABELS } from './types';
import { Player, type InputState } from '../player/player';
import { RoomView, type Interactable } from '../world/room';
import { THEMES } from '../world/themes';
import { Weather } from '../world/weather';
import { Post } from '../rendering/post';
import { GameAudio } from '../audio/audio';
import { HandMirror } from '../world/handMirror';
import { Echo } from './echo';
import { UI } from '../ui/ui';
import { clearSave, loadSettings, readSave, saveSettings, writeSave, type Settings } from '../core/settings';
import { ENDING_LINES, CHIME_TEXT } from '../data/story';

type Mode = 'loading' | 'title' | 'play' | 'paused' | 'note' | 'journal' | 'transition' | 'ending';

const MOON_TINT: number[] = [0x8fa8ff, 0x8fb0ff, 0x9ba6ff, 0xa898ff, 0xc088ff];
const PLATE_R = 0.62;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(78, 1, 0.05, 80);
  post: Post;
  state = new GameState();
  settings: Settings = (() => { const s = loadSettings(); const q = new URLSearchParams(location.search).get('q'); if (q === 'low' || q === 'medium' || q === 'high') s.quality = q; return s; })();
  audio = new GameAudio();
  weather = new Weather();
  player = new Player();
  ui: UI;
  echo = new Echo();
  handMirror = new HandMirror();
  rooms = new Map<RoomId, RoomView>();
  current: RoomView | null = null;
  mode: Mode = 'loading';
  debugOn = new URLSearchParams(location.search).has('debug');
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private target: Interactable | null = null;
  private clock = new THREE.Clock();
  private time = 0;
  private timeline: { t: number; fn: () => void }[] = [];
  private shake = 0;
  private lastSave = 0;
  private hasStarted = false;
  private titleT = 0;
  private hintText: string | null = null;
  private pmrem: THREE.PMREMGenerator;
  private tickT = 0;
  private echoRoomSeen: RoomId | null = null;
  private fps = 60;
  private endingStarted = false;
  private pointerWanted = false;
  skipRender = false;

  constructor(root: HTMLElement) {
    this.ui = new UI(root, {
      newGame: () => this.newGame(),
      cont: () => this.continueGame(),
      resume: () => this.resume(),
      restart: () => this.restart(),
      toTitle: () => this.toTitle(),
      settingsChanged: (s) => this.applySettings(s),
    }, this.settings, () => this.state);
    this.ui.hasSave = () => !!readSave();
    const canvas = this.ui.canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x05060b);
    this.scene.fog = new THREE.FogExp2(0x0a0d18, 0.022);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;
    this.scene.add(this.camera);
    this.post = new Post(this.renderer, this.scene, this.camera, 1280, 720);
    this.applySettings(this.settings, false);
    this.resize();
    this.bindEvents();
    this.weather.onThunder = (d) => this.audio.thunder(d);
    (window as unknown as { __game: Game }).__game = this;
  }

  // ------------------------------------------------------------------ boot
  async boot() {
    this.ui.showLoading();
    await new Promise((r) => setTimeout(r, 30));
    // warm the hall so the title has something to look at, and pre-compile
    this.state.reset();
    this.mountRoom('hall', START_DOOR, true);
    await this.prewarm();
    this.toTitle();
    this.clock.start();
    this.loop();
  }

  private async prewarm() {
    const ids = ['hall', 'library', 'dining', 'kitchen', 'mirrors'] as RoomId[];
    for (const id of ids) {
      this.getRoom(id);
      await new Promise((r) => setTimeout(r, 0));
    }
    // compile shaders for the current rig
    this.renderer.compile(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ settings
  applySettings(s: Settings, persist = true) {
    this.settings = s;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.audio.setMaster(s.master);
    this.audio.setMusic(s.music);
    this.audio.setSfx(s.sfx);
    this.post.setQuality(s.quality);
    const pr = s.quality === 'low' ? 0.75 : s.quality === 'medium' ? Math.min(1.25, devicePixelRatio) : Math.min(2, devicePixelRatio);
    this.renderer.setPixelRatio(pr);
    this.post.setPixelRatio(pr);
    this.resize();
    for (const r of this.rooms.values()) this.applyQualityToRoom(r);
    if (persist) saveSettings(s);
  }

  private applyQualityToRoom(r: RoomView) {
    const q = this.settings.quality;
    r.moon.shadow.mapSize.set(q === 'low' ? 512 : q === 'medium' ? 1024 : 2048, q === 'low' ? 512 : q === 'medium' ? 1024 : 2048);
    r.moon.shadow.map?.dispose();
    r.moon.shadow.map = null;
    r.pointLights[0].castShadow = q !== 'low';
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
  }

  // ------------------------------------------------------------------ input
  private bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.setMirror(false); if (this.mode === 'play') this.pause(); });
    document.addEventListener('mousemove', (e) => {
      if (this.mode !== 'play') return;
      // pointer lock preferred; if the browser refuses it, dragging with the left button looks around
      if (document.pointerLockElement !== this.ui.canvas && !(this.dragLook && e.buttons & 1)) return;
      const k = 0.0022 * this.settings.sensitivity;
      const mx = Math.abs(e.movementX) > 250 ? 0 : e.movementX, my = Math.abs(e.movementY) > 250 ? 0 : e.movementY;
      this.player.yaw -= mx * k;
      this.player.pitch -= my * k * (this.settings.invertY ? -1 : 1);
      this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch));
    });
    document.addEventListener('mousedown', (e) => {
      if (this.mode === 'play' && e.button === 2) this.setMirror(true);
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2 && this.mode === 'play' && this.mirrorHeld) this.setMirror(false);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.ui.canvas;
      if (!locked && this.mode === 'play' && this.pointerWanted) this.pause();
    });
    this.ui.canvas.addEventListener('click', () => {
      if (this.mode === 'play' && document.pointerLockElement !== this.ui.canvas) this.lockPointer();
    });
    this.ui.onNoteClosed = () => { if (this.mode === 'note') { this.mode = 'play'; this.lockPointer(); } };
  }

  private mirrorHeld = false;
  private seenRestless = false;
  private lockNagT = 0;
  private dragLook = true;
  private setMirror(on: boolean) {
    if (on && !this.state.flags.has('hasMirror')) return;
    this.mirrorHeld = on;
    this.handMirror.target = on ? 1 : 0;
    if (on) this.audio.mirrorRaise(); else this.audio.mirrorRaise(true);
    this.ui.mirrorHud(on);
  }

  lockPointer() {
    this.pointerWanted = true;
    try {
      const p = this.ui.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => { /* user gesture required; click will retry */ });
    } catch { /* ignore */ }
  }
  private unlockPointer() {
    this.pointerWanted = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.code;
    if (down && ['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    if (down) {
      if (e.repeat) { if (this.mode === 'play' && !['Tab', 'Escape'].includes(k)) this.keys.add(k); return; }
      if (this.endingStarted) return; // the ending cannot be paused or broken out of
      if (k === 'F3') { this.debugOn = !this.debugOn; this.ui.debug(this.debugOn ? '' : null); return; }
      if (this.mode === 'title') {
        if (k === 'Escape' && ['settings', 'controls', 'credits'].includes(this.ui.overlayName)) this.ui.showTitle(this.hasSave());
        return;
      }
      if (this.mode === 'note') {
        if (k === 'KeyE' || k === 'Escape' || k === 'Space' || k === 'Enter') this.ui.closeNote();
        return;
      }
      if (this.mode === 'journal') {
        if (k === 'Tab' || k === 'Escape') this.resume();
        return;
      }
      if (this.mode === 'play' || this.mode === 'transition') {
        if (k === 'Escape') { this.pause(); return; }
      } else if (this.mode === 'paused') {
        if (k === 'Escape' || (k === 'Tab' && this.ui.overlayName === 'journal')) { if (this.ui.overlayName === 'pause') this.resume(); else this.ui.showPause(); }
        return;
      }
      if (this.mode === 'play') {
        if (k === 'KeyE') this.interact();
        else if (k === 'KeyF') this.setMirror(true);
        else if (k === 'KeyQ') this.toggleEcho();
        else if (k === 'Tab') this.openJournal();
      }
    }
    if (down) this.keys.add(k); else { this.keys.delete(k); if (k === 'KeyF' && this.mirrorHeld) this.setMirror(false); }
  }

  private readInput(): InputState {
    const k = this.keys;
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const right = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    return { fwd, right, sprint: k.has('ShiftLeft') || k.has('ShiftRight') };
  }

  // ------------------------------------------------------------------ game flow
  hasSave() { return !!readSave(); }

  newGame() {
    this.timeline.length = 0;
    clearSave();
    this.state.reset();
    this.echo.clear();
    this.beginPlay(true);
  }

  continueGame() {
    const raw = readSave();
    if (!raw) return this.newGame();
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data.room !== 'string' || !Object.prototype.hasOwnProperty.call(ROOM_BY_ID, data.room) || ![0, 1, 2, 3, 4].includes(data.phase)) throw new Error('bad save');
      if (!DOORS.some((d) => d.id === data.arriveDoor && d.room === data.room)) data.arriveDoor = DOORS.find((d) => d.room === data.room)!.id;
      const e = data.echo;
      if (e && !(Array.isArray(e.path) && e.path.length >= 3 && Array.isArray(e.final) && e.final.length === 2 && typeof e.room === 'string' && Object.prototype.hasOwnProperty.call(ROOM_BY_ID, e.room))) data.echo = null;
      for (const k of ['lit', 'flags', 'visited', 'learned', 'notes']) if (!Array.isArray(data[k])) data[k] = [];
      if (!data.ptr || typeof data.ptr !== 'object') data.ptr = {};
      this.state.load(data);
      this.echo.load(this.state.echo);
      this.beginPlay(false).catch(() => { clearSave(); this.hasStarted = false; this.toTitle(); });
    } catch {
      this.newGame();
    }
  }

  restart() {
    this.newGame();
  }

  private async beginPlay(isNew: boolean) {
    await this.audio.resume();
    this.weather.calm = false;
    this.audio.startAmbience();
    this.audio.uiClick();
    this.endingStarted = false;
    this.ui.clear();
    this.ui.hud(true);
    this.ui.debug(this.debugOn ? '' : null);
    this.setMirror(false);
    this.timeline.length = 0;
    this.hasStarted = true;
    if (!isNew) this.handleEvents(this.state.enterRoom(this.state.room));
    this.mountRoom(this.state.room, this.state.arriveDoor ?? START_DOOR, true);
    this.audio.setClockPhase(this.state.phase);
    this.audio.setTension(this.state.phase / 5);
    this.ui.clockTag(this.state.phase);
    this.mode = 'play';
    this.ui.fade(1);
    this.ui.fade(0, 1400);
    this.lockPointer();
    if (isNew) {
      this.after(1.6, () => this.ui.notice('The front door shut behind you. It will not open again.', 5200));
      this.after(7.5, () => { if (this.state.room === 'hall' && !this.state.notes.has('n_intro')) this.ui.softNotice('A letter waits on the hall table.', 4200); });
    } else this.ui.roomName(ROOM_BY_ID[this.state.room].name);
    this.save();
  }

  pause() {
    if (this.mode !== 'play' && this.mode !== 'transition') return;
    this.prevMode = this.mode;
    this.mode = 'paused';
    this.keys.clear();
    this.unlockPointer();
    this.ui.setHint(null);
    this.ui.showPause();
  }
  private prevMode: Mode = 'play';

  resume() {
    if (this.mode !== 'paused' && this.mode !== 'journal') return;
    this.mode = this.prevMode === 'transition' ? 'transition' : 'play';
    this.ui.clear();
    this.lockPointer();
  }

  openJournal() {
    if (this.mode !== 'play') return;
    this.mode = 'journal';
    this.prevMode = 'play';
    this.keys.clear();
    this.unlockPointer();
    this.ui.setHint(null);
    this.ui.showJournal(false);
  }

  toTitle() {
    this.save();
    this.hasStarted = false;
    this.timeline.length = 0;
    this.endingStarted = false;
    this.ui.chime('', '', 1);
    this.mode = 'title';
    this.unlockPointer();
    this.setMirror(false);
    this.ui.hud(false);
    this.ui.echoHud(null);
    this.audio.stopAmbience();
    this.audio.ghostAmbience(false);
    this.ui.fade(0);
    this.state.reset();
    this.echo.clear();
    this.mountRoom('hall', START_DOOR, true);
    this.ui.showTitle(this.hasSave());
    this.audio.startAmbience();
  }

  save() {
    if (!this.hasStarted || this.state.flags.has('ending')) return;
    this.state.echo = this.echo.data;
    writeSave(JSON.stringify(this.state.serialize()));
  }

  after(sec: number, fn: () => void) { this.timeline.push({ t: this.time + sec, fn }); }

  // ------------------------------------------------------------------ rooms
  getRoom(id: RoomId): RoomView {
    let r = this.rooms.get(id);
    if (!r) {
      r = new RoomView(ROOM_BY_ID[id], THEMES[id], this.weather);
      this.applyQualityToRoom(r);
      this.rooms.set(id, r);
    }
    return r;
  }

  mountRoom(id: RoomId, doorId: string, instant: boolean) {
    this.ui.clearNotice();
    const prev = this.current;
    if (prev) {
      this.scene.remove(prev.group);
      if (this.echo.ghost) prev.group.remove(this.echo.ghost);
    }
    const room = this.getRoom(id);
    this.current = room;
    this.scene.add(room.group);
    this.handMirror.group.visible = false;
    this.targetInteractables = room.interactables.map((i) => i.hit);
    const sp = room.spawnFor(doorId);
    this.player.teleport(sp.x, sp.z, sp.yaw, sp.y);
    room.openDoor(doorId, true, true);
    if (!instant) this.after(0.9, () => room.openDoor(doorId, false));
    else this.after(0.4, () => room.openDoor(doorId, false));
    this.applyPhaseLook(room);
    if (id === 'ballroom') {
      const hadProgress = danceState.progress > 0 && !danceState.done;
      resetDance(this.state.flags.has('danceDone'));
      if (!this.state.flags.has('danceDone')) this.after(2.2, () => this.ui.softNotice(hadProgress ? 'The figure begins again from the first pair.' : 'Eight sigils are laid in mirrored pairs. A duet cannot be danced alone.', 6000));
    } else this.audio.ghostAmbience(false);
    room.sync(this.state, this.state.platesHeld);
    this.audio.setIndoor(id === 'conservatory' ? 0.05 : id === 'hall' ? 0.5 : id === 'cellar' || id === 'crypt' ? 1 : id === 'attic' ? 0.25 : 0.75);
    this.audio.hearthLoop(false);
    if (room.hearthPos) this.audio.hearthLoop(true, room.hearthPos);
    this.updateFog(room);
    this.ui.roomName(ROOM_BY_ID[id].name);
    this.camera.position.set(sp.x, 1.66 + sp.y, sp.z);
    this.player.applyToCamera(this.camera);
    this.echoRoomSeen = null;
  }

  private targetInteractables: THREE.Object3D[] = [];

  private applyPhaseLook(room: RoomView) {
    const p = this.state.phase;
    room.moon.color.setHex(MOON_TINT[p]);
    room.moon.intensity = 2.6 + p * 0.12;
    room.baseMoon = room.moon.intensity;
    room.baseHemi = room.hemi.intensity;
  }

  private updateFog(room: RoomView) {
    const f = this.scene.fog as THREE.FogExp2;
    const p = this.state.phase;
    const c = new THREE.Color(0x0a0d18).lerp(new THREE.Color(0x140a1e), p / 4);
    f.color.copy(c);
    this.scene.background = c;
    f.density = 0.02 + p * 0.0025;
    void room;
  }

  // ------------------------------------------------------------------ interaction
  private updateTarget() {
    this.target = null;
    if (!this.current || this.mode !== 'play') return this.setHint(null);
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 3.1;
    const hits = this.raycaster.intersectObjects(this.targetInteractables, false);
    if (hits.length) {
      const id = hits[0].object.userData.interactId as string;
      const kind = hits[0].object.userData.interactKind as string;
      const it = this.current.interactables.find((i) => i.id === id && i.kind === kind);
      if (it && hits[0].distance < 2.9) this.target = it;
      if (this.target?.kind === 'door' && !this.seenRestless && this.state.isRestless(this.state.door(this.target.id))) {
        this.seenRestless = true;
        this.ui.notice('The lit lantern shows where this door leads. Every time you pass a restless door, all of them turn one.', 5000);
      }
    }
    // the Seer's Glass teaches: any restless door seen through it is learned (cycle recorded in the journal)
    if (this.handMirror.raised > 0.7) {
      let found = 0;
      for (const d of DOORS) {
        if (d.room === this.state.room && this.state.isRestless(d) && !this.state.hasLearned(d.id)) { this.state.learn(d.id); found++; }
      }
      if (found) { this.ui.notice(found > 1 ? 'The glass shows where these doors lead. You note them in your journal.' : 'The glass shows where it leads. You note it in your journal.', 3600); this.audio.pickup(); }
      this.raycaster.far = 16;
      const far = this.raycaster.intersectObjects(this.targetInteractables, false);
      if (far.length && far[0].object.userData.interactKind === 'door') {
        const did = far[0].object.userData.interactId as string;
        const dd = this.state.door(did);
        if (this.state.isRestless(dd) && !this.state.hasLearned(did)) {
          this.state.learn(did);
          this.ui.notice('The glass shows where it leads. You note it in your journal.', 3200);
          this.audio.pickup();
        }
      }
    }
    let sel = this.target ? this.target.glow : [];
    if (!this.target && this.current.def.id === 'hall' && !this.state.notes.has('n_intro')) sel = this.current.interactables.find((i) => i.id === 'n_intro')?.glow ?? [];
    this.post.setSelected(sel);
    this.setHint(this.target ? this.promptFor(this.target) : null);
  }

  private setHint(t: string | null) {
    if (t !== this.hintText) { this.hintText = t; this.ui.setHint(t); }
  }

  private promptFor(it: Interactable): string | null {
    const st = this.state;
    if (it.kind === 'door') {
      const d = st.door(it.id);
      if (d.id === 'hall.s' || (d.kind === 'shifting' && this.state.cycle(d).length === 0)) return null;
      return st.isBoarded(d) ? 'Try the door' : 'Open the door';
    }
    const o = st.object(it.id);
    switch (o.type) {
      case 'candle': if (st.cycle(st.door(o.door!)).length === 0) return null; return st.flags.has('hasMatches') ? (st.lit.has(o.id) ? 'Snuff the candle' : 'Light the candle') : null;
      case 'note': return 'Read';
      case 'matches': return st.flags.has('hasMatches') ? null : 'Take the matches';
      case 'handMirror': return st.flags.has('hasMirror') ? null : "Take the Seer's Glass";
      case 'clockWind': return st.flags.has('clockWound') ? null : 'Wind the clock';
      case 'coffin': return st.flags.has('lordFreed') ? null : 'Lift the lid';
      case 'atticThrone': return st.flags.has('ending') ? null : 'Wind the music box';
      default: return null;
    }
  }

  private interact() {
    if (!this.target || !this.current) return;
    const it = this.target;
    if (it.kind === 'door') return this.tryDoor(it.id);
    const o = this.state.object(it.id);
    const res = this.state.interact(it.id);
    if (!res.ok) { if (res.msg) this.ui.notice(res.msg, 3200); return; }
    if (o.type === 'note' || o.type === 'matches') {
      const title = o.title ?? 'Note';
      let text = o.text ?? '';
      if (o.type === 'matches') text = 'A box of matches, half empty. You pocket it.\nA lit candle beside a restless door might steady it.';
      this.audio.pickup();
      this.mode = 'note';
      this.unlockPointer();
      this.ui.setHint(null);
      this.ui.showNote(title, text);
    }
    this.handleEvents(res.events, it);
    this.current.sync(this.state, this.state.platesHeld);
    this.save();
  }

  private tryDoor(id: string) {
    const view = this.current!;
    const door = this.state.door(id);
    if (door.id === 'hall.s') {
      this.audio.creak();
      this.ui.notice(door.lock!.msg, 4200);
      return;
    }
    const res = this.state.useDoor(id);
    if (!res.ok) {
      this.audio.creak();
      this.ui.notice(res.msg ?? 'It will not open.', 4200);
      return;
    }
    const restless = res.events.some((e) => e.type === 'shift');
    const enterEvents = this.state.enterRoom(res.room!); // story beats apply atomically with the move, so an autosave can never skip them
    this.mode = 'transition';
    this.setHint(null);
    this.post.setSelected([]);
    view.openDoor(id, true);
    this.audio.doorOpen(restless);
    if (this.echo.recording) { this.echo.cancel(); this.ui.echoHud(null); this.ui.notice('The echo frays as you leave the room.', 3000); }
    this.after(0.55, () => this.ui.fade(1, 380));
    this.after(1.0, () => {
      this.mountRoom(res.room!, res.dest!, false);
      this.ui.fade(0, 650);
      if (restless) { this.audio.shiftRumble(); this.shake = 0.6; }
      this.handleEvents([...res.events, ...enterEvents]);
      this.current!.sync(this.state, this.state.platesHeld);
      this.save();
      this.after(0.5, () => { if (this.mode === 'transition') this.mode = 'play'; });
    });
  }

  private handleEvents(events: GameEvent[], src?: Interactable) {
    for (const e of events) {
      switch (e.type) {
        case 'candle': {
          const cv = this.current!.candles.get(e.id);
          if (e.lit) { if (cv) this.audio.playAt('candleLight', cv.anchor); else this.audio.candleLight(); }
          else { if (cv) this.audio.playAt('candleSnuff', cv.anchor); else this.audio.candleSnuff(); }
          break;
        }
        case 'flag': this.onFlag(e.name); break;
        case 'chime': this.onChime(e.phase); break;
        case 'snuff': this.after(2.2, () => { this.audio.candleSnuff(); this.ui.notice('Every flame in the house gutters out.', 3600); }); break;
        case 'ending': this.startEnding(); break;
        default: break;
      }
    }
    void src;
  }

  private onFlag(name: string) {
    switch (name) {
      case 'hasMatches': this.ui.notice('Matches. You can light the candles beside restless doors.', 4600); break;
      case 'hasMirror': this.after(7.0, () => this.ui.softNotice("The Seer's Glass. Hold F (or right mouse) to raise it.", 6000)); this.audio.pickup(); break;
      case 'clockWound': this.audio.pickup(); break;
      case 'danceDone': this.ui.notice('The great doors unbar. Somewhere above, an orchestra begins to tune.', 6000); break;
      case 'echoGranted': this.after(8.5, () => this.ui.notice('Press Q to begin an echo of yourself; press Q again to release it.', 7000)); break;
    }
  }

  private onChime(phase: Phase) {
    this.ui.clockTag(phase);
    const strikes = phase === 1 ? 10 : phase === 2 ? 11 : phase === 3 ? 1 : 12;
    const txt = CHIME_TEXT[phase];
    this.after(1.6, () => {
      this.audio.clockChime(strikes);
      this.ui.chime(PHASE_LABELS[phase], txt, phase === 4 ? 9000 : 6600);
      this.ui.clockTag(phase);
      this.weather.strike(0.95);
      this.shake = 1.1;
      this.audio.setClockPhase(phase);
      this.audio.setTension(phase / 5);
      if (this.current) { this.applyPhaseLook(this.current); this.updateFog(this.current); }
      this.audio.stingerReveal();
      this.current?.sync(this.state, this.state.platesHeld);
    });
    this.after(9, () => {
      if (phase === 1) this.ui.softNotice('The doors have forgotten everything they knew. Raise the glass (hold F) to map them again.', 6000);
      else if (phase === 2 || phase === 4) this.ui.softNotice('The house changed its mind. Raise the glass (hold F) to map the doors it holds now.', 6000);
      else if (phase === 3) this.ui.softNotice('Far above, in the entrance hall, a sealed door has come unnailed.', 6000);
    });
  }

  // ------------------------------------------------------------------ echo
  private toggleEcho() {
    if (!this.state.flags.has('echoGranted')) { this.ui.notice('You have no echo to give. Not yet.', 2600); return; }
    if (this.echo.recording) {
      const d = this.echo.stop(this.player.pos.x, this.player.pos.z);
      if (d) {
        this.state.echo = d;
        this.audio.echoEnd();
        this.ui.echoHud(null);
        if (d.room === 'ballroom') {
          const r = analyzeRoute(d.path);
          danceState.bad = !r.ok;
          danceState.demoT = 0;
          this.ui.notice(r.message, 7000);
          if (!r.ok) this.audio.creak();
        } else this.ui.notice('Your echo walks your steps, and waits where you stopped.', 4600);
        this.save();
      }
    } else {
      if (this.echo.data) this.ui.notice('Recording a new echo. The old one stays until you release this one.', 3200);
      this.audio.echoStart();
      this.echo.start(this.state.room, this.player.pos.x, this.player.pos.z, this.player.yaw);
      this.ui.notice(this.state.room === 'ballroom' ? 'Walk the left-hand sigils in order and stand still on each for about a second. Press Q again.' : 'Walk. Stand where you want your echo to wait. Press Q again.', 5200);
    }
  }

  private prevHeld = new Set<string>();
  private computePlates() {
    const held = this.state.platesHeld;
    this.prevHeld = new Set(held);
    held.clear();
    const ep = this.echo.data ? this.echo.position() : null;
    for (const o of OBJECTS) {
      if (o.type !== 'plate') continue;
      if (this.state.room === o.room) {
        const dx = this.player.pos.x - o.x, dz = this.player.pos.z - o.z;
        if (dx * dx + dz * dz < PLATE_R * PLATE_R) held.add(o.id);
      }
      if (ep && this.echo.data!.room === o.room) {
        const dx = ep.x - o.x, dz = ep.z - o.z;
        if (dx * dx + dz * dz < PLATE_R * PLATE_R) held.add(o.id);
      }
    }
    if (this.mode === 'play' || this.mode === 'transition') {
      for (const id of held) if (!this.prevHeld.has(id) && OBJECTS.find((o) => o.id === id)?.room === this.state.room) this.audio.plate(true);
      for (const id of this.prevHeld) if (!held.has(id) && OBJECTS.find((o) => o.id === id)?.room === this.state.room) this.audio.plate(false);
    }
  }


  // ------------------------------------------------------------------ ending
  private startEnding() {
    if (this.endingStarted) return;
    this.endingStarted = true;
    this.mode = 'transition';
    this.keys.clear();
    this.setHint(null);
    this.setMirror(false);
    this.audio.stingerReveal();
    this.audio.ghostAmbience(true);
    this.weather.calm = true;
    clearSave();
    // turn to face Ismene at the window while the music box plays
    const px = 0.5, pz = 0.6, gx = 0.0, gz = -4.3;
    this.player.teleport(px, pz, Math.atan2(-(gx - px), -(gz - pz)));
    this.player.pitch = 0.08;
    this.after(4.0, () => { this.unlockPointer(); const mins = Math.max(1, Math.round(this.state.playTime / 60));
      const lines = [...ENDING_LINES];
      lines.splice(lines.length - 2, 0, `You spent ${mins} minute${mins === 1 ? '' : 's'} in the house.`);
      this.ui.showEnding(lines, () => this.toTitle()); });
  }

  // ------------------------------------------------------------------ frame
  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.frame(dt);
  };

  frame(dtRaw: number) {
    const frozen = this.mode === 'paused' || this.mode === 'journal' || this.mode === 'loading';
    const dt = frozen ? 0 : dtRaw;
    this.fps += (1 / Math.max(dtRaw, 1e-4) - this.fps) * 0.05;
    this.time += dt;
    // timeline
    for (let i = this.timeline.length - 1; i >= 0; i--) {
      if (this.timeline[i].t <= this.time) { const f = this.timeline[i].fn; this.timeline.splice(i, 1); f(); }
    }
    this.weather.update(dtRaw > 0 ? dt : 0);
    const room = this.current;
    if (!room) return;

    if (this.mode === 'title') {
      this.titleT += dtRaw;
      this.titleCamera(this.titleT);
    } else if (this.mode === 'play') {
      this.state.playTime += dt;
      const stepped = this.player.update(dt, this.readInput(), room.colliders);
      if (stepped) this.audio.footstep(room.theme.footstep);
      this.player.applyToCamera(this.camera);
      if (!this.settings.headBob) this.camera.position.y = this.player.pos.y + 1.66;
      // keyboard look (arrow keys) for accessibility
      const lk = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
      const lv = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0);
      if (lk || lv) {
        this.player.yaw += lk * dt * 1.9 * this.settings.sensitivity;
        this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch + lv * dt * 1.5 * this.settings.sensitivity));
      }
      this.echoUpdate(dt);
      if (this.pointerWanted && document.pointerLockElement !== this.ui.canvas) { this.lockNagT += dt; if (this.lockNagT > 1.2) { this.lockNagT = -6; this.ui.notice('Click the game to capture the mouse (or drag to look, or use the arrow keys).', 4000); } } else this.lockNagT = 0;
      this.updateTarget();
    } else if (this.mode === 'transition') {
      if (this.endingStarted) {
        // slow, reverent walk towards the window during the ending
        const gx = 0.0, gz = -3.0, sp = 0.16 * dt;
        const dx = gx - this.player.pos.x, dz = gz - this.player.pos.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 1.4) { this.player.pos.x += (dx / dl) * sp * 3; this.player.pos.z += (dz / dl) * sp * 3; }
      }
      this.player.update(dt, { fwd: 0, right: 0, sprint: false }, room.colliders);
      this.player.applyToCamera(this.camera);
    }
    if (this.mode === 'play' || this.mode === 'transition') {
      this.tickT += dt;
      if (this.tickT > 1) { this.tickT -= 1; if (room.def.id === 'clock' && this.state.flags.has('clockWound')) this.audio.playAt('clockTick', room.clockPos ?? this.camera.position); }
    }
    // screen shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.012;
      this.camera.rotation.x += (Math.random() - 0.5) * s;
      this.camera.rotation.z += (Math.random() - 0.5) * s * 1.2;
    }
    // the ballroom waltz
    if (room.def.id === 'ballroom' && (this.mode === 'play' || this.mode === 'transition')) {
      const ep = this.echo.data && this.echo.data.room === 'ballroom' ? this.echo.position() : null;
      const ev = updateDance(dt, { x: this.player.pos.x, z: this.player.pos.z }, ep ? { x: ep.x, z: ep.z } : null);
      if (ev.demoStart) this.audio.clockChime(1);
      if (ev.step) { this.audio.pickup(); this.ui.notice(ev.step < 4 ? `Step ${ev.step} of 4. The Lady smiles.` : 'The last step.', 2200); }
      if (ev.finished) {
        const evs: GameEvent[] = [];
        this.state.setFlag('danceDone', evs);
        this.handleEvents(evs);
        this.audio.stingerReveal();
        this.weather.strike(0.8);
      }
    }
    // echo/ghost/plates
    this.computePlates();
    this.echo.update(dt);
    this.syncGhost(room);
    // lightning on the room lights
    const fl = this.weather.flash;
    room.moon.intensity = room.baseMoon + fl * 42;
    room.hemi.intensity = room.baseHemi + fl * 7;
    // world tick
    room.sync(this.state, this.state.platesHeld);
    room.cameraQuat.copy(this.camera.quaternion);
    room.tick(this.time, dt);
    this.handMirror.update(dtRaw, this.camera);
    this.audio.update(dtRaw, this.camera);
    // reflection hook: spectral visibility for the wall mirror is handled by the room
    room.spectral.visible = false;
    if (this.handMirror.visible) this.handMirror.renderTruth(this.renderer, this.scene, this.camera, room.spectral);
    if (!this.skipRender) this.post.frame(dtRaw, this.time, fl);
    // autosave heartbeat
    if (this.mode === 'play' && this.time - this.lastSave > 20) { this.lastSave = this.time; this.save(); }
    if (this.debugOn) this.drawDebug();
  }

  private echoUpdate(dt: number) {
    if (this.echo.recording) {
      const over = this.echo.sample(dt, this.player.pos.x, this.player.pos.z, this.player.yaw);
      this.ui.echoHud(`ECHO  ●  ${Math.ceil(30 - this.echo.recTime)}s`);
      if (over) this.toggleEcho();
    }
  }

  private syncGhost(room: RoomView) {
    const data = this.echo.data;
    if (!data) { if (this.echo.ghost?.parent) this.echo.ghost.parent.remove(this.echo.ghost); return; }
    const ghost = this.echo.getGhost();
    if (data.room !== room.def.id) { ghost.visible = false; if (ghost.parent) ghost.parent.remove(ghost); return; }
    if (ghost.parent !== room.group) room.group.add(ghost);
    const p = this.echo.position();
    if (!p) return;
    ghost.visible = true;
    ghost.position.set(p.x, 0, p.z);
    ghost.rotation.y = p.yaw + Math.PI;
    this.echo.animate(this.time);
  }

  private titleCamera(t: number) {
    const cam = this.camera;
    const a = t * 0.07;
    cam.position.set(Math.sin(a) * 0.9, 1.65 + Math.sin(t * 0.3) * 0.03, 4.3 + Math.cos(a * 0.7) * 0.5);
    cam.lookAt(0.3 + Math.sin(a * 1.3) * 0.6, 2.1, -3.6);
  }

  private drawDebug() {
    const s = this.state;
    const room = this.current!;
    let doorInfo = '-';
    if (this.target && this.target.kind === 'door') {
      const d = s.door(this.target.id);
      doorInfo = `${d.id} (${d.kind}) -> ${d.kind === 'shifting' ? s.cycle(d).join(' | ') + ' [ptr ' + s.ptr[d.id] + ']' : d.to}`;
    }
    this.ui.debug([
      `FPS ${this.fps.toFixed(0)}  mode ${this.mode}  draw ${this.renderer.info.render.calls} tris ${this.renderer.info.render.triangles}`,
      `room ${room.def.id}   clock ${PHASE_LABELS[s.phase]} (${s.phase})`,
      `pos ${this.player.pos.x.toFixed(2)}, ${this.player.pos.y.toFixed(2)}, ${this.player.pos.z.toFixed(2)}  yaw ${this.player.yaw.toFixed(2)}`,
      `door ${doorInfo}`,
      `flags ${[...s.flags].join(',')}`,
      `lit ${[...s.lit].join(',')}`,
      `plates ${[...s.platesHeld].join(',')}  echo ${this.echo.data ? this.echo.data.room : '-'}`,
      `ptr ${JSON.stringify(Object.fromEntries(Object.entries(s.ptr).filter(([k]) => s.isRestless(s.door(k)))))}`,
    ].join('\n'));
  }

  // ------------------------------------------------------------------ debug helpers (used by tests)
  /** run the simulation without drawing (automated playthroughs) */
  debugAdvance(seconds: number, step = 0.05) {
    const prev = this.skipRender;
    this.skipRender = true;
    for (let t = 0; t < seconds; t += step) this.frame(step);
    this.skipRender = prev;
  }
  /** stand in front of an interactable of the current room, look at it and press E */
  debugInteract(id: string) {
    const room = this.current!;
    const it = room.interactables.find((i) => i.id === id);
    if (!it) throw new Error(`no interactable ${id} in ${room.def.id}`);
    const c = it.center.clone();
    // stand 1.6m from it toward the room centre
    const dir = new THREE.Vector3(-c.x, 0, -c.z).setLength(1.6);
    const px = c.x + dir.x, pz = c.z + dir.z;
    this.player.teleport(px, pz, Math.atan2(-(c.x - px), -(c.z - pz)), it.kind === 'door' ? this.state.door(id).elev ?? 0 : (this.player.pos.y));
    this.player.pitch = 0;
    this.player.applyToCamera(this.camera);
    this.camera.updateMatrixWorld(true);
    this.camera.lookAt(c.x, c.y, c.z);
    this.player.yaw = this.camera.rotation.y;
    this.player.pitch = this.camera.rotation.x;
    this.scene.updateMatrixWorld(true);
    this.computePlates();
    this.updateTarget();
    if (!this.target || this.target.id !== id) throw new Error(`cannot target ${id}; looking at ${this.target?.id}`);
    this.interact();
  }
  danceTiles() { return { e: DANCE.echoTiles.map((t) => ({ x: t.x, z: t.z })), p: DANCE.playerTiles.map((t) => ({ x: t.x, z: t.z })) }; }
  /** close a note overlay if open */
  debugClose() { this.ui.closeNote(); if (this.mode === 'note') this.mode = 'play'; }

  debugTeleport(room: RoomId, doorId?: string) {
    const d = doorId ?? DOORS.find((x) => x.room === room)!.id;
    this.state.room = room;
    this.state.arriveDoor = d;
    this.state.visited.add(room);
    this.mountRoom(room, d, true);
    if (this.mode !== 'play') { this.mode = 'play'; this.ui.clear(); this.ui.hud(true); }
  }
}
