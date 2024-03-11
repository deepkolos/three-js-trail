import {
  BufferAttribute,
  DataTexture,
  Matrix4,
  RGBAFormat,
  Vector3,
  Mesh,
  StaticDrawUsage,
  DynamicDrawUsage,
  FloatType,
} from 'three';
import { TrailMaterial } from './TrailMaterial';
import { UpdatableBufferGeometry } from './UpdatableGeometry';
import { PLANE_VERTEX, getPos, TMP_V3_0, TMP_V3_1, TMP_BrushVertex } from './utils';

export class Trail extends Mesh<UpdatableBufferGeometry, TrailMaterial> {
  readonly frustumCulled = true; // 用于触发geometry更新的钩子

  length: number;
  time: number;
  emitDistance: number;
  emitting = true;
  // alignment: 'view' | 'transformZ';

  brushDataTex!: DataTexture;
  buffers!: {
    index: Uint16Array;
    position: Float32Array;
    indexAttr: BufferAttribute;
    positionAttr: BufferAttribute;
  };

  brushVertexLen!: number;
  brushFaceLen!: number;
  brushIndicesLen!: number;
  vertexLen!: number;
  faceLen!: number;

  brushVertex!: Vector3[];
  brushCursor?: { low: number; high: number; len: number };

  lastTargetPose?: Matrix4;
  currTime = 0; // 单位秒
  lastTimestamp?: number;

  constructor(
    config: { length?: number; time?: number; emitDistance?: number } = {},
    material = new TrailMaterial(),
    brushVertex = PLANE_VERTEX,
  ) {
    super(new UpdatableBufferGeometry(), material);
    this.length = config.length ?? 20;
    this.time = config.time ?? 1;
    this.emitDistance = config.emitDistance ?? 1;

    this.brushVertex = brushVertex;
    this.init();
  }

  reset() {
    delete this.brushCursor;
    delete this.lastTargetPose;
  }

  stop() {
    this.emitting = false;
  }

  init() {
    this.brushVertexLen = this.brushVertex.length;
    this.brushFaceLen = (this.brushVertexLen - 1) * 2;
    this.brushIndicesLen = this.brushFaceLen * 3;

    this.vertexLen = this.length * this.brushVertexLen;
    this.faceLen = this.length * this.brushFaceLen;

    this.material.uniforms.brushVertexLen.value = this.brushVertex.length - 1;
    this.material.uniforms.cursor.value.w = this.length - 1;

    const { length, brushVertexLen, vertexLen, faceLen } = this;
    const brushData = new Float32Array(length * 4);
    const brushDataTex = new DataTexture(brushData, length, 1, RGBAFormat, FloatType);
    brushDataTex.needsUpdate = true;
    this.brushDataTex = brushDataTex;
    this.material.uniforms.brushDataTex.value = brushDataTex;

    const index = new Uint16Array(faceLen * 3);
    const brushId = new Uint8Array(vertexLen);
    const brushVertexId = new Uint16Array(vertexLen);
    const position = new Float32Array(vertexLen * 3);
    const indexAttr = new BufferAttribute(index, 1).setUsage(DynamicDrawUsage);
    const brushIdAttr = new BufferAttribute(brushId, 1).setUsage(StaticDrawUsage);
    const positionAttr = new BufferAttribute(position, 3).setUsage(DynamicDrawUsage);
    const brushVertexIdAttr = new BufferAttribute(brushVertexId, 1).setUsage(StaticDrawUsage);

    for (let i = 0; i < vertexLen; i++) {
      brushId[i] = ~~(i / brushVertexLen);
      brushVertexId[i] = i % brushVertexLen;
    }

    this.buffers = { index, position, positionAttr, indexAttr };
    this.geometry
      .setAttribute('position', positionAttr)
      .setAttribute('brushId', brushIdAttr)
      .setAttribute('brushVertexId', brushVertexIdAttr)
      .setIndex(indexAttr);
    this.geometry.onGeometryUpdate = this.onGeometryUpdate;
  }

  onGeometryUpdate = () => {
    if (!this.visible) return;
    // 更新时间
    const now = Date.now();
    if (this.lastTimestamp !== undefined) this.currTime += (now - this.lastTimestamp) * 0.001;
    this.lastTimestamp = now;
    this.material.uniforms.timeInfo.value.x = this.currTime;
    this.material.uniforms.timeInfo.value.y = this.time;

    const { geometry, material, emitting, currTime } = this;
    if (!emitting) return;

    const currPose = this.matrixWorld;

    if (!this.brushCursor) this.brushCursor = { low: 0, high: 0, len: 0 };
    if (!this.lastTargetPose) {
      this.lastTargetPose = currPose.clone();
      this.setBrush(0, currPose, currTime);
      geometry.drawRange.count = 0;
      return;
    }

    const lastPosition = getPos(this.lastTargetPose, TMP_V3_0);
    const currPosition = getPos(currPose, TMP_V3_1);
    const distanceSq = lastPosition.distanceToSquared(currPosition);
    const distancePass = distanceSq > this.emitDistance;
    let { brushCursor, length } = this;

    if (distancePass) {
      this.lastTargetPose.copy(currPose);
      const nextHigh = (brushCursor.high + 1) % length;
      // 压入新的brush
      this.setBrush(nextHigh, currPose, currTime);
      // 更新链接
      this.linkBrush(brushCursor.high, nextHigh);
      this.unlinkBrush(nextHigh);
      // 更新指针
      brushCursor.high = nextHigh;
      if (brushCursor.len === length - 1) brushCursor.low = (brushCursor.low + 1) % length;
      if (brushCursor.len < length - 1) {
        brushCursor.len++;
        geometry.drawRange.count = (brushCursor.len + 1) * this.brushIndicesLen;
      }
    } else {
      // 更新最后生成的brush
      this.setBrush(brushCursor.high, currPose, currTime);
    }

    // 更新材质
    material.uniforms.cursor.value.x = brushCursor.low;
    material.uniforms.cursor.value.y = brushCursor.high;
    material.uniforms.cursor.value.z = brushCursor.len;
  };

  onBeforeRender(): void {
    this.geometry.updated = false;
  }

  setBrush(index: number, pose: Matrix4, time: number) {
    const { buffers, brushVertexLen, brushVertex, brushDataTex } = this;
    const center = getPos(pose, TMP_V3_0);
    const stride = brushVertexLen * 3;
    const posOffset = index * stride;

    // 设置姿态
    for (let i = 0; i < brushVertexLen; i++) {
      const v3 = TMP_BrushVertex[i]!;
      v3.copy(brushVertex[i]!);
      v3.applyMatrix4(pose);
      buffers.position[posOffset + i * 3] = v3.x;
      buffers.position[posOffset + i * 3 + 1] = v3.y;
      buffers.position[posOffset + i * 3 + 2] = v3.z;
    }
    this.updateAttr(buffers.positionAttr, posOffset, stride);

    // 当有多个texture uniform时 有bug...
    // TMP_F32_4[0] = center.x;
    // TMP_F32_4[1] = center.y;
    // TMP_F32_4[2] = center.z;
    // TMP_F32_4[3] = time;
    // TMP_V2.x = index;
    // renderer.copyTextureToTexture(TMP_V2, TMP_DataTexture, brushDataTex);
    const offset = index * 4;
    brushDataTex.image.data[offset] = center.x;
    brushDataTex.image.data[offset + 1] = center.y;
    brushDataTex.image.data[offset + 2] = center.z;
    brushDataTex.image.data[offset + 3] = time;
    brushDataTex.needsUpdate = true;
  }

  linkBrush(indexA: number, indexB: number) {
    const { buffers, brushVertexLen, brushFaceLen } = this;
    const offsetA = indexA * brushVertexLen;
    const offsetB = indexB * brushVertexLen;
    const offsetFace = indexA * brushFaceLen;
    for (let i = 0, il = brushVertexLen - 1; i < il; i++) {
      const a = offsetA + i;
      const b = offsetB + i;
      const face = (offsetFace + i * 2) * 3;
      buffers.index[face] = a;
      buffers.index[face + 1] = b;
      buffers.index[face + 2] = a + 1;
      buffers.index[face + 3] = b;
      buffers.index[face + 4] = b + 1;
      buffers.index[face + 5] = a + 1;
    }
    this.updateAttr(buffers.indexAttr, offsetFace * 3, brushFaceLen * 3);
  }

  unlinkBrush(indexA: number) {
    const { buffers, brushVertexLen, brushFaceLen } = this;
    const offsetFace = indexA * brushFaceLen;
    for (let i = 0, il = brushVertexLen - 1; i < il; i++) {
      const face = (offsetFace + i * 2) * 3;
      buffers.index[face] = 0;
      buffers.index[face + 1] = 0;
      buffers.index[face + 2] = 0;
      buffers.index[face + 3] = 0;
      buffers.index[face + 4] = 0;
      buffers.index[face + 5] = 0;
    }
    this.updateAttr(buffers.indexAttr, offsetFace * 3, brushFaceLen * 3);
  }

  updateAttr(attr: BufferAttribute, start: number, count: number) {
    attr.needsUpdate = true;
    attr.updateRanges.push({ start, count });
  }

  dispose(): void {
    this.material.dispose();
    this.geometry.dispose();
    this.brushDataTex.dispose();
    this.visible = false;
  }
}
