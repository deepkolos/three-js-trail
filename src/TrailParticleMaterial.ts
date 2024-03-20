import {
  Camera,
  Matrix4,
  RawShaderMaterial,
  Scene,
  ShaderMaterialParameters,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three';

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
  // 不渲染已消亡粒子
  if (timeInfo.x - timeInfo.y >= instanceData.y) {
    gl_Position = vec4(-2,0,0,0);
  } else {
    // 粒子生命百分比[0,1]
    float percent = smoothstep(timeInfo.x - timeInfo.y, timeInfo.x, instanceData.y);
    // 随机速度方向
    vec3 dir = normalize(vec3(instanceData.x, rand(instanceData.x * 5.0), rand(instanceData.x * 2.0)) * 2.0 - 1.0);
    // 随机速度值
    float currVelocity = rand((instanceData.x + 1.) * 2.) * velocity * 2.0;
    // 根据时间计算出位移
    vec3 movement = dir * currVelocity * (timeInfo.x - instanceData.y);
    vec4 positionV4 = vec4(position * size * percent + instancePosition + movement, 1.0);
    // 支持ShaderGraph自定义增加更多效果
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
  static FRAG = FRAG;
  static VERT = VERT;
  static SG_FRAG = (head: string, body: string) =>
    FRAG.replace('#define SG_HEAD', head).replace('#define SG_BODY', body);
  static SG_VERT = (head: string, body: string) =>
    VERT.replace('#define SG_HEAD', head).replace('#define SG_BODY', body);

  declare uniforms: {
    viewMatrix: { value: Matrix4 | null };
    projection: { value: Matrix4 | null };
    cursor: { value: Vector4 };
    timeInfo: { value: Vector2 };
    size: { value: number };
    velocity: { value: number };
  };

  vertexShader = VERT;
  fragmentShader = FRAG;
  transparent = true;
  depthWrite = false;

  constructor(
    params?: ShaderMaterialParameters & { uniforms: Partial<TrailParticleMaterial['uniforms']> },
  ) {
    super(params);
    this.uniforms.viewMatrix = { value: null };
    this.uniforms.projection = { value: null };
    this.uniforms.cursor = { value: new Vector4() };
    this.uniforms.timeInfo = { value: new Vector2() };
    this.uniforms.size = { value: 0 };
    this.uniforms.velocity = { value: 0 };
    this.vertexShader = params?.vertexShader ?? VERT;
    this.fragmentShader = params?.fragmentShader ?? FRAG;
  }

  onBeforeRender(_renderer: WebGLRenderer, _scene: Scene, camera: Camera) {
    this.uniforms.viewMatrix.value = camera.matrixWorldInverse;
    this.uniforms.projection.value = camera.projectionMatrix;
  }
}
