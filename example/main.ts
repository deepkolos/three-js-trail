import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { Trail } from '../src';
import TrailParticle from '../src/TrailParticle';
import { CustomTrailMaterial } from './CustomTrailMaterial';
import trail from './textures/trail.png';
import particle from './textures/particle.png';
import { CustomTrailParticleMaterial } from './CustomTrailParticleMaterial';

const canvas = document.getElementById('canvas')!;
const textureLoader = new TextureLoader();
const trailTexture = await textureLoader.loadAsync(trail);
const particleTexture = await textureLoader.loadAsync(particle);
trailTexture.generateMipmaps = false;
particleTexture.generateMipmaps = false;

const scene = new Scene();
scene.background = new Color(0x123456);

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);

const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 20);

// const control = new OrbitControls(camera, canvas);
// control.enableDamping = true;

const YAxis = new Object3D();
const ZAxis = new Object3D();
const box = new Mesh(new BoxGeometry(1, 1), new MeshLambertMaterial({ color: 0xffffff }));
const trailBox = new Trail(undefined, new CustomTrailMaterial(trailTexture));
// 或者
// const trailBox = new Trail(
//   undefined,
//   new TrailMaterial({
//     uniforms: { map: { value: trailTexture } },
//     vertexShader: CustomTrailMaterial.VERT,
//     fragmentShader: CustomTrailMaterial.FRAG,
//    }),
// );
const trailLine = new Trail(undefined, new CustomTrailMaterial(trailTexture));
const trailParticle = new TrailParticle(
  { size: 1, velocity: 2 },
  new CustomTrailParticleMaterial(particleTexture, new Color(0xffc107)),
);
box.position.x = 5;
trailBox.position.x = 5;
trailParticle.position.x = 5;
trailBox.scale.setScalar(0.25);
box.visible = false;
// trailBox.visible = false;
// trailParticle.visible = false;
// trailLine.visible = false;
ZAxis.add(box, trailBox, trailParticle);
YAxis.add(ZAxis);
scene.add(YAxis, camera, trailLine);
scene.add(new AmbientLight(0xffffff, 0.2));
camera.add(new DirectionalLight(0xffffff, 1));

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const speed = 0.04;
const renderLoop = () => {
  ZAxis.rotation.z += speed;
  YAxis.rotation.y += speed * 0.35;
  trailLine.position.y += 0.3;
  if (trailLine.position.y > 10) {
    trailLine.position.y = -10;
    trailLine.reset();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
  // setTimeout(renderLoop, 256);
};

renderLoop();
