import { Color, IUniform, Texture } from 'three';
import { TrailParticleMaterial } from '../src';

export class CustomTrailParticleMaterial extends TrailParticleMaterial {
  static VERT = TrailParticleMaterial.SG_VERT(
    /* glsl */ `varying vec2 vUV;`,
    /* glsl */ `vUV = uv;`,
  );
  static FRAG = TrailParticleMaterial.SG_FRAG(
    /* glsl */ `varying vec2 vUV; uniform sampler2D map; uniform vec3 color;`,
    /* glsl */ `gl_FragColor = texture2D(map, vUV) * vec4(color, 1.);`,
  );

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
