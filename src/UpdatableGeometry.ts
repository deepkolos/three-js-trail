import { BufferGeometry, InstancedBufferGeometry, Sphere, Vector3 } from 'three';
const SPHERE = new Sphere(new Vector3(0, 0, 0), -1);

export class UpdatableBufferGeometry extends BufferGeometry {
  updated?: boolean;
  onGeometryUpdate?: () => void;

  // @ts-ignore
  get boundingSphere() {
    return this.updated ? SPHERE : null;
  }
  set boundingSphere(_: null | Sphere) {}

  computeBoundingSphere() {
    this.updated = true;
    this.onGeometryUpdate?.();
  }
}

export class UpdatableInstancedBufferGeometry extends InstancedBufferGeometry {
  updated?: boolean;
  onGeometryUpdate?: () => void;

  // @ts-ignore
  get boundingSphere() {
    return this.updated ? SPHERE : null;
  }
  set boundingSphere(_: null | Sphere) {}

  computeBoundingSphere() {
    this.updated = true;
    this.onGeometryUpdate?.();
  }
}
