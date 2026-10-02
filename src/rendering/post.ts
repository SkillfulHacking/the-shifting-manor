import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Post stack: scene -> outline (interaction) -> bloom -> grade (vignette, grain, split-tone) -> tonemap/sRGB */
export class Post {
  composer: EffectComposer;
  render: RenderPass;
  outline: OutlinePass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  private quality: 'low' | 'medium' | 'high' = 'high';

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.render = new RenderPass(scene, camera);
    this.composer.addPass(this.render);
    this.outline = new OutlinePass(new THREE.Vector2(w, h), scene, camera);
    this.outline.edgeStrength = 2.4;
    this.outline.edgeGlow = 0.35;
    this.outline.edgeThickness = 1.4;
    this.outline.pulsePeriod = 3.2;
    this.outline.visibleEdgeColor.set(0xffd9a0);
    this.outline.hiddenEdgeColor.set(0x000000);
    this.composer.addPass(this.outline);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.7, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uAspect: { value: w / h }, uTruth: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uFlash; uniform float uAspect; uniform float uTruth; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec2 c=vUv-.5; float r=length(c*vec2(uAspect,1.));
          // subtle chromatic aberration towards the edges
          vec2 off=c*r*0.0022;
          vec3 col=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
          // split tone: cool shadows, warm highlights
          float l=dot(col,vec3(.299,.587,.114));
          col=mix(col, col*vec3(.86,.95,1.12), (1.-smoothstep(.0,.35,l))*.55);
          col=mix(col, col*vec3(1.08,.98,.86), smoothstep(.25,1.,l)*.5);
          // vignette
          float v=smoothstep(1.05,.32,r);
          col*=mix(.5,1.,v);
          // grain
          float g=hash(vUv*vec2(1920.,1080.)+fract(uTime)*91.7)-.5;
          col+=g*.014;
          col+=vec3(.5,.6,.85)*uFlash*.22; col*=1.+uFlash*.45;
          gl_FragColor=vec4(col,1.);
        }`,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.grade.uniforms.uAspect.value = w / h;
  }

  setPixelRatio(pr: number) { this.composer.setPixelRatio(pr); }

  setQuality(q: 'low' | 'medium' | 'high') {
    this.quality = q;
    this.bloom.enabled = q !== 'low';
    this.outline.enabled = true;
  }

  setSelected(objs: THREE.Object3D[]) { this.outline.selectedObjects = objs; }

  frame(dt: number, t: number, flash: number) {
    this.grade.uniforms.uTime.value = t;
    this.grade.uniforms.uFlash.value = flash;
    this.composer.render(dt);
  }
}
