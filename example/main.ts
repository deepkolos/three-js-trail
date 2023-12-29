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
  WebGLRenderer,
} from 'three';
import { Trail } from '../src';

const canvas = document.getElementById('canvas')!;

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
const trailBox = new Trail();
const trailLine = new Trail();
box.position.x = 5;
trailBox.position.x = 5;
// box.visible = false;
// trailBox.visible = false;
trailLine.visible = false;
ZAxis.add(box, trailBox);
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
  trailLine.position.y += 1;
  if (trailLine.position.y > 10) trailLine.position.y = 0;
  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
  // setTimeout(renderLoop, 256);
};

renderLoop();
