import {
  Camera,
  Color,
  DataTexture,
  DoubleSide,
  Matrix4,
  RawShaderMaterial,
  Scene,
  ShaderMaterialParameters,
  Texture,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three';

const VERT = /* glsl */ `
attribute vec3 position;
attribute float brushId;
attribute float brushVertexId;
uniform mat4 viewMatrix;
uniform mat4 projection;
uniform vec4 cursor; // low high len segment
uniform sampler2D brushDataTex; // center birthTime
uniform float brushVertexLen;
uniform vec2 timeInfo; // currTime time
varying float vBirthTime;

vec2 uv; // SG使用
#ifndef BRUSH_DATA
  #define BRUSH_DATA
  vec4 brushData;
#endif

#define SG_HEAD

void main() {
  brushData = texture2D(brushDataTex, vec2(brushId / cursor.w, 0));
  float fraction = (timeInfo.x - brushData.w) / (timeInfo.y * (cursor.z / cursor.w));
  vBirthTime = brushData.w;
  uv = vec2(fraction, brushVertexId / brushVertexLen);

  vec4 positionV4 = vec4(position, 1.0);
  #define SG_BODY
  gl_Position = projection * viewMatrix * positionV4;

  // vec3 realPosition = mix(positionV4.xyz, brushData.xyz, fraction);
  // gl_Position = projection * viewMatrix * vec4(realPosition, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec2 timeInfo; // currTime time
uniform vec3 color;
varying float vBirthTime;

#define SG_HEAD

void main() {
  if ((timeInfo.x - timeInfo.y) > vBirthTime) discard;
  gl_FragColor = vec4(color, 1);
  #define SG_BODY
}`;

export class TrailMaterial extends RawShaderMaterial {
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
    brushDataTex: { value: DataTexture | null };
    brushVertexLen: { value: number };
    timeInfo: { value: Vector2 };
    color: { value: Color | null };
  };

  transparent = true;
  depthWrite = false;
  depthTest = false;
  side = DoubleSide;
  // wireframe = true;

  constructor(
    params?: ShaderMaterialParameters & { uniforms: Partial<TrailMaterial['uniforms']> },
  ) {
    super(params);
    this.uniforms.viewMatrix = { value: null };
    this.uniforms.projection = { value: null };
    this.uniforms.cursor = { value: new Vector4() };
    this.uniforms.brushDataTex = { value: null };
    this.uniforms.brushVertexLen = { value: 0 };
    this.uniforms.timeInfo = { value: new Vector2() };
    this.uniforms.color ??= { value: new Color(0xffffff) };
    this.vertexShader ??= TrailMaterial.VERT;
    this.fragmentShader ??= TrailMaterial.FRAG;
  }

  onBeforeRender(_renderer: WebGLRenderer, _scene: Scene, camera: Camera) {
    this.uniforms.viewMatrix.value = camera.matrixWorldInverse;
    this.uniforms.projection.value = camera.projectionMatrix;
  }
}
