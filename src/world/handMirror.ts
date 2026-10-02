import * as THREE from 'three';
import * as P from './props';

/**
 * The Seer's Glass. When raised, a second camera renders the current view with the "spectral" layer visible
 * (sigils above restless doors, hidden writing) into the hand mirror's glass.
 */
export class HandMirror {
  group = new THREE.Group();
  raised = 0;
  target = 0;
  private rt: THREE.WebGLRenderTarget;
  private cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private glass: THREE.Mesh;
  private model: THREE.Group;

  constructor() {
    this.model = P.handMirror();
    this.model.scale.setScalar(1.5);
    this.group.add(this.model);
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
    const center: THREE.Vector3 = this.model.userData.glassCenter ?? new THREE.Vector3(0, 0.22, 0);
    const radius: number = this.model.userData.glassRadius ?? 0.085;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: this.rt.texture } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `uniform sampler2D tMap; varying vec2 vUv;
        void main(){ vec2 uv=vec2(1.-vUv.x, vUv.y); vec3 c=texture2D(tMap, uv).rgb;
          float l=dot(c,vec3(.3,.59,.11));
          c=mix(vec3(l)*vec3(.85,1.0,1.0), c, .75)*1.45 + vec3(.01,.02,.02);
          float r=length(vUv-.5)*2.; c*=smoothstep(1.02,.7,r)*.5+.5;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      toneMapped: true,
    });
    this.glass = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
    this.glass.position.copy(center).add(new THREE.Vector3(0, 0, 0.004));
    this.model.add(this.glass);
    this.group.traverse((o) => { o.frustumCulled = false; });
    this.group.renderOrder = 10;
    this.group.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
  }

  get visible() { return this.raised > 0.02; }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.raised += (this.target - this.raised) * Math.min(1, dt * 9);
    const r = this.raised;
    // resting: below screen; raised: lower-right, tilted towards the viewer
    this.group.position.set(0.19 + (1 - r) * 0.2, -0.36 - (1 - r) * 0.55, -0.42);
    this.group.rotation.set(-0.15 - (1 - r) * 0.7, -0.22, 0.12);
    this.group.visible = r > 0.02;
    if (this.group.parent !== camera) camera.add(this.group);
  }

  /** render the truth view; caller provides scene + spectral groups and the renderer */
  renderTruth(renderer: THREE.WebGLRenderer, scene: THREE.Scene, main: THREE.PerspectiveCamera, spectral: THREE.Object3D) {
    if (!this.visible) return;
    this.cam.position.copy(main.position);
    this.cam.quaternion.copy(main.quaternion);
    this.cam.fov = Math.max(18, main.fov * 0.3);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    const wasVisible = this.group.visible;
    this.group.visible = false;
    const prev = spectral.visible;
    spectral.visible = true;
    const prevRT = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, this.cam);
    renderer.setRenderTarget(prevRT);
    spectral.visible = prev;
    this.group.visible = wasVisible;
  }
}
