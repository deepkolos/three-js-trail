import { IUniform, Texture } from 'three';
import { TrailMaterial } from '../src';

export class CustomTrailMaterial extends TrailMaterial {
  static VERT = TrailMaterial.SG_VERT(/* glsl */ `varying vec2 vUV;`, /* glsl */ `vUV = uv;`);
  static FRAG = TrailMaterial.SG_FRAG(
    /* glsl */ `varying vec2 vUV; uniform sampler2D map;`,
    /* glsl */ `gl_FragColor.a = texture2D(map, vUV).r;`,
  );

  vertexShader = CustomTrailMaterial.VERT;
  fragmentShader = CustomTrailMaterial.FRAG;
  declare uniforms: TrailMaterial['uniforms'] & { map: IUniform<Texture | null> };

  constructor(map: Texture | null = null) {
    super();
    this.uniforms.map = { value: map };
  }
}
