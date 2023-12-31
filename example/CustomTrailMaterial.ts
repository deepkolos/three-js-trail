import { IUniform, Texture } from 'three';
import { TrailMaterial } from '../src';

const VERT_SG_HEAD = /* glsl */ `varying vec2 vUV;`;
const VERT_SG_BODY = /* glsl */ `vUV = uv;`;
const FRAG_SG_HEAD = /* glsl */ `varying vec2 vUV; uniform sampler2D map;`;
const FRAG_SG_BODY = /* glsl */ `gl_FragColor.a = texture2D(map, vUV).r;`;

export class CustomTrailMaterial extends TrailMaterial {
  static VERT = TrailMaterial.SG_VERT(VERT_SG_HEAD, VERT_SG_BODY);
  static FRAG = TrailMaterial.SG_FRAG(FRAG_SG_HEAD, FRAG_SG_BODY);

  vertexShader = CustomTrailMaterial.VERT;
  fragmentShader = CustomTrailMaterial.FRAG;
  declare uniforms: TrailMaterial['uniforms'] & { map: IUniform<Texture | null> };

  constructor(map: Texture | null = null) {
    super();
    this.uniforms.map = { value: map };
  }
}
