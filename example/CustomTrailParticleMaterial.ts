import { Color, IUniform, Texture } from 'three';
import { TrailParticleMaterial } from '../src';

const VERT_SG_HEAD = /* glsl */ `varying vec2 vUV;`;
const VERT_SG_BODY = /* glsl */ `vUV = uv;`;
const FRAG_SG_HEAD = /* glsl */ `varying vec2 vUV; uniform sampler2D map; uniform vec3 color;`;
const FRAG_SG_BODY = /* glsl */ `gl_FragColor = texture2D(map, vUV) * vec4(color, 1.);`;

export class CustomTrailParticleMaterial extends TrailParticleMaterial {
  static VERT = TrailParticleMaterial.SG_VERT(VERT_SG_HEAD, VERT_SG_BODY);
  static FRAG = TrailParticleMaterial.SG_FRAG(FRAG_SG_HEAD, FRAG_SG_BODY);

  vertexShader = CustomTrailParticleMaterial.VERT;
  fragmentShader = CustomTrailParticleMaterial.FRAG;
  declare uniforms: TrailParticleMaterial['uniforms'] & {
    map: IUniform<Texture | null>;
    color: IUniform<Color | null>;
  };

  constructor(map: Texture | null = null, color: Color | null = null) {
    super();
    this.uniforms.map = { value: map };
    this.uniforms.color = { value: color };
  }
}
