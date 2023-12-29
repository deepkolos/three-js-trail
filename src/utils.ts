import { Vector2, Vector3, DataTexture, RGBAFormat, FloatType, Matrix4 } from 'three';

export const TMP_V2 = new Vector2();
export const TMP_V3_0 = new Vector3();
export const TMP_V3_1 = new Vector3();
export const TMP_F32_4 = new Float32Array(4);
export const TMP_BrushVertex: Vector3[] = new Array(64).fill(0).map(_ => new Vector3());
export const TMP_DataTexture = new DataTexture(TMP_F32_4, 1, 1, RGBAFormat, FloatType);

export function getPos(mat4: Matrix4, v3: Vector3) {
  return v3.set(mat4.elements[12], mat4.elements[13], mat4.elements[14]);
}

export const PLANE_VERTEX = [new Vector3(-1.0, 0.0, 0.0), new Vector3(1.0, 0.0, 0.0)];
