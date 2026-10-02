import * as THREE from 'three';

/**
 * The storm outside: a shared unlit shader for the panes behind every window
 * (clouds, moon, swaying trees, wind-driven rain) plus the lightning schedule.
 */
export class Weather {
  /** 0..1 lightning brightness (double-flash envelope) */
  flash = 0;
  private timer = 6 + Math.random() * 6;
  private seq: { at: number; amp: number }[] = [];
  private seqT = 0;
  onThunder: ((distance01: number) => void) | null = null;
  /** the storm has passed (ending) */
  calm = false;
  private material: THREE.ShaderMaterial;
  private thunderQueue: { t: number; d: number }[] = [];
  private time = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uIntensity: { value: 1 }, uCalm: { value: 0 } },
      vertexShader: `
        attribute vec2 aOff; varying vec2 vUv; varying vec2 vOff;
        void main(){ vUv=uv; vOff=aOff; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `
        varying vec2 vUv; varying vec2 vOff; uniform float uTime; uniform float uFlash; uniform float uIntensity; uniform float uCalm;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);}
        float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5;} return s; }
        void main(){
          vec2 uv=vUv;
          vec2 p=vec2((uv.x+vOff.x)*2.4, uv.y*1.6+vOff.y);
          // sky
          float clouds=fbm(p*vec2(1.2,2.0)+vec2(uTime*.035,0.));
          float dark=smoothstep(.25,.75,clouds);
          vec3 skyLow=vec3(.05,.07,.12), skyHigh=vec3(.015,.02,.045);
          vec3 col=mix(skyLow,skyHigh,uv.y);
          col=mix(col, vec3(.09,.10,.15), dark*.6);
          // moon behind cloud
          vec2 mp=(uv-vec2(.72-vOff.x*.15,.72));
          float m=smoothstep(.09,.0,length(mp*vec2(1.,1.5)));
          float mg=smoothstep(.5,.0,length(mp));
          col+= (vec3(.55,.62,.8)*m*.8+vec3(.12,.16,.26)*mg)*(1.-dark*.85);
          // lightning lights the cloud belly
          col+= vec3(.55,.62,.85)*uFlash*(.35+.9*clouds)*1.6;
          // tree silhouettes
          float sway=sin(uTime*.9+uv.x*6.+vOff.x*9.)*.012+sin(uTime*1.7+uv.y*9.)*.006;
          float treeEdge=.22+.16*fbm(vec2((uv.x+sway+vOff.x)*5.,3.))+ .12*sin((uv.x+vOff.x)*11.)*.5;
          float tree=smoothstep(treeEdge+.01,treeEdge-.01,uv.y+sway*1.5);
          float br=fbm(vec2((uv.x+vOff.x)*18.+sway*30., uv.y*14.));
          float branches=smoothstep(.55,.7,br)*smoothstep(.85,.28,uv.y)*step(.18,uv.y);
          float sil=max(tree,branches*.9);
          vec3 treeCol=vec3(.008,.011,.018)+vec3(.35,.4,.55)*uFlash*.25;
          col=mix(col,treeCol,sil);
          // rain: slanted streaks, two depths
          float rain=0.;
          for(int i=0;i<3;i++){
            float fi=float(i);
            vec2 q=uv*vec2(38.+fi*24., 5.+fi*2.);
            float roof=step(2.5,vOff.x);
            q.x+=q.y*.25*(1.+fi*.2)*(1.-roof);
            q.y+=uTime*(9.+fi*4.)+fi*3.3+vOff.y*7.;
            vec2 id=floor(q); vec2 f=fract(q);
            float r=hash(id+fi*17.+floor(vOff.x*10.));
            f.x+=(hash(id*1.7+fi)-.5)*.5*roof; f.y=fract(f.y+hash(id.yx+fi)*roof);
            float streak=step(.62,r)*smoothstep(.06,.0,abs(f.x-.5))*smoothstep(.0,.35,f.y)*smoothstep(1.,.5,f.y);
            rain+=streak*(.45-fi*.1);
          }
          col+=vec3(.55,.65,.85)*rain*(.42+uFlash*1.6)*(1.-uCalm);
          col+=vec3(.16,.12,.1)*uCalm*(1.-uv.y*.6);
          col*=uIntensity;
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      fog: false,
    });
  }

  makeBackdrop(w: number, h: number, seed: number, roof = false): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, h);
    const off = new Float32Array(8);
    const ox = roof ? 5 : (seed * 0.37) % 1, oy = (seed * 0.61) % 1;
    for (let i = 0; i < 4; i++) { off[i * 2] = ox; off[i * 2 + 1] = oy; }
    geo.setAttribute('aOff', new THREE.BufferAttribute(off, 2));
    const m = new THREE.Mesh(geo, this.material);
    m.position.z = 0;
    m.userData.noShadow = true;
    m.castShadow = false;
    return m;
  }

  update(dt: number) {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
    this.timer -= dt;
    if (this.timer <= 0) { if (this.calm) this.timer = 999; else this.strike(Math.random() < 0.5 ? 0.6 : 0.9); }
    this.material.uniforms.uCalm.value += ((this.calm ? 1 : 0) - this.material.uniforms.uCalm.value) * Math.min(1, dt * 0.35);
    this.material.uniforms.uIntensity.value += ((this.calm ? 0.45 : 1) - this.material.uniforms.uIntensity.value) * Math.min(1, dt * 0.4);
    if (this.seq.length) {
      this.seqT += dt;
      let f = 0;
      for (const s of this.seq) {
        const x = this.seqT - s.at;
        if (x > 0) f = Math.max(f, s.amp * Math.exp(-x * 9) * Math.min(1, x * 60));
      }
      this.flash = f;
      if (this.seqT > 1.6) { this.seq = []; this.flash = 0; }
    }
    for (let i = this.thunderQueue.length - 1; i >= 0; i--) {
      this.thunderQueue[i].t -= dt;
      if (this.thunderQueue[i].t <= 0) { this.onThunder?.(this.thunderQueue[i].d); this.thunderQueue.splice(i, 1); }
    }
    this.material.uniforms.uFlash.value = this.flash;
  }

  /** Trigger a lightning strike. `near` 0..1 : bigger flash, shorter thunder delay. */
  strike(near = 0.6) {
    this.seq = [
      { at: 0, amp: 0.7 + near * 0.4 },
      { at: 0.13 + Math.random() * 0.08, amp: 0.4 + Math.random() * 0.4 },
      ...(Math.random() < 0.4 ? [{ at: 0.5 + Math.random() * 0.2, amp: 0.9 }] : []),
    ];
    this.seqT = 0;
    this.timer = 22 + Math.random() * 30;
    this.thunderQueue.push({ t: 0.25 + (1 - near) * 2.6, d: 1 - near });
  }
}
