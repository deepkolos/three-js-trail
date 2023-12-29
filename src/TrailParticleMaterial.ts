import { Camera, Matrix4, RawShaderMaterial, Scene, Vector2, Vector4, WebGLRenderer } from 'three';

const VERT = /* glsl */ `
attribute float id;
attribute vec3 position;
attribute vec2 uv;
attribute vec2 instanceData;// seed birthTime
attribute vec3 instancePosition;
uniform mat4 viewMatrix;
uniform mat4 projection;
uniform vec4 cursor; // low high len absLen
uniform vec2 timeInfo; // currTime time
uniform float size;
uniform float velocity;
varying float vPercent;
// TODO 数据和SG联动

float rand(float co){
  return fract(sin(dot(vec2(co), vec2(12.9898, 78.233))) * 8.5453);
}

#define SG_HEAD

void main() {
  if (timeInfo.x - timeInfo.y >= instanceData.y) {
    gl_Position = vec4(-2,0,0,0);
  } else {
    float percent = smoothstep(timeInfo.x - timeInfo.y, timeInfo.x, instanceData.y);
    vec3 dir = normalize(vec3(instanceData.x, rand(instanceData.x * 5.0), rand(instanceData.x * 2.0)) * 2.0 - 1.0);
    // 计算不太科学和现有效果复刻为主
    float currVelocity = rand((instanceData.x + 1.) * 2.) * velocity * 2.0;
    vec3 movement = dir * currVelocity * (timeInfo.x - instanceData.y);
    vec4 positionV4 = vec4(position * size * percent + instancePosition + movement, 1.0);
    #define SG_BODY
    gl_Position = projection * viewMatrix * positionV4;
    vPercent = percent;
  }
}`;

const FRAG = /* glsl */ `
precision highp float;
varying float vPercent;

#define SG_HEAD

void main() {
  gl_FragColor = vec4(1);
  #define SG_BODY
  gl_FragColor.a *= vPercent;
}`;

export class TrailParticleMaterial extends RawShaderMaterial {
  uniforms = {
    viewMatrix: { value: null } as { value: Matrix4 | null },
    projection: { value: null } as { value: Matrix4 | null },
    cursor: { value: new Vector4() },
    timeInfo: { value: new Vector2() },
    size: { value: 1 },
    velocity: { value: 1 },
  };

  vertexShader = VERT;
  fragmentShader = FRAG;
  transparent = true;
  depthWrite = false;

  onBeforeRender(_renderer: WebGLRenderer, _scene: Scene, camera: Camera) {
    this.uniforms.viewMatrix.value = camera.matrixWorldInverse;
    this.uniforms.projection.value = camera.projectionMatrix;
  }

  static FRAG = FRAG;
  static VERT = VERT;
}
