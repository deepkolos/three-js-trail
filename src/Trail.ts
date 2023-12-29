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
  WebGLRenderer,
  Vector2,
} from 'three';
import { TrailMaterial } from './TrailMaterial';
import { TrailGeometry } from './TrialGeometry';

const TMP_V2 = new Vector2();
const TMP_V3_0 = new Vector3();
const TMP_V3_1 = new Vector3();
const TMP_F32_4 = new Float32Array(4);
const TMP_BrushVertex: Vector3[] = new Array(64).fill(0).map(_ => new Vector3());
const TMP_DataTexture = new DataTexture(TMP_F32_4, 1, 1, RGBAFormat, FloatType);

function getPos(mat4: Matrix4, v3: Vector3) {
  return v3.set(mat4.elements[12], mat4.elements[13], mat4.elements[14]);
}

const PLANE_VERTEX = [new Vector3(-1.0, 0.0, 0.0), new Vector3(1.0, 0.0, 0.0)];

export class Trail extends Mesh<TrailGeometry, TrailMaterial> {
  readonly frustumCulled = true; // 用于触发geometry更新的钩子
  length = 20;
  time = 0.8;
  emitDistance = 0.1;
  emitting = true;
  // color = new Color(0xffffff);
  // alignment: 'view' | 'transformZ' = 'view';
  // textureMode: 'stretch' | 'tile' = 'stretch';

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
  renderer?: WebGLRenderer;

  constructor(material = new TrailMaterial(), brushVertex = PLANE_VERTEX) {
    super(new TrailGeometry(), material);

    this.brushVertex = brushVertex;
    this.brushVertexLen = brushVertex.length;
    this.brushFaceLen = (this.brushVertexLen - 1) * 2;
    this.brushIndicesLen = this.brushFaceLen * 3;

    this.vertexLen = this.length * this.brushVertexLen;
    this.faceLen = this.length * this.brushFaceLen;

    this.material.uniforms.brushVertexLen.value = brushVertex.length - 1;
    this.material.uniforms.cursor.value.w = this.length - 1;
    this.material.uniforms.timeInfo.value.y = this.time;
    this.initGeometry();
  }

  reset() {
    delete this.brushCursor;
    delete this.lastTargetPose;
    this.emitting = true;
  }

  stop() {
    this.emitting = false;
  }

  initGeometry() {
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
    if (!this.visible || !this.renderer) return;
    // 更新时间
    const now = Date.now();
    if (this.lastTimestamp !== undefined) this.currTime += (now - this.lastTimestamp) * 0.001;
    this.lastTimestamp = now;
    this.material.uniforms.timeInfo.value.x = this.currTime;

    const { geometry, material, emitting, currTime, renderer } = this;
    if (!emitting) return;

    const currPose = this.matrixWorld;

    if (!this.brushCursor) this.brushCursor = { low: 0, high: 0, len: 0 };
    if (!this.lastTargetPose) {
      this.lastTargetPose = currPose.clone();
      this.setBrush(0, currPose, currTime, renderer);
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
      this.setBrush(nextHigh, currPose, currTime, renderer);
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
      this.setBrush(brushCursor.high, currPose, currTime, renderer);
    }

    // 更新材质
    material.uniforms.cursor.value.x = brushCursor.low;
    material.uniforms.cursor.value.y = brushCursor.high;
    material.uniforms.cursor.value.z = brushCursor.len;
    material.uniforms.timeInfo.value.y = this.time;
  };

  onBeforeRender(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    this.geometry.updated = false;
  }

  setBrush(index: number, pose: Matrix4, time: number, renderer: WebGLRenderer) {
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

    TMP_F32_4[0] = center.x;
    TMP_F32_4[1] = center.y;
    TMP_F32_4[2] = center.z;
    TMP_F32_4[3] = time;
    TMP_V2.x = index;
    renderer.copyTextureToTexture(TMP_V2, TMP_DataTexture, brushDataTex);
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
  }
}