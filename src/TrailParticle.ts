import {
  Matrix4,
  PlaneGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  InstancedMesh,
  BufferGeometry,
  DynamicDrawUsage,
} from 'three';
import { UpdatableInstancedBufferGeometry } from './UpdatableGeometry';
import { TrailParticleMaterial } from './TrailParticleMaterial';
import { TMP_V3_0, TMP_V3_1, TMP_V3_2, getPos } from './utils';

export default class TrailParticle extends InstancedMesh<
  UpdatableInstancedBufferGeometry,
  TrailParticleMaterial
> {
  readonly frustumCulled = true; // 用于触发geometry更新的钩子
  // 配置
  length: number;
  time: number;
  size: number;
  velocity: number;
  emitOverDistance: number;
  spawnRadius: number;
  emitting = true;

  // 实例
  buffers?: {
    buffer: Float32Array;
    bufferAttr: InterleavedBufferAttribute;
  };

  lastTargetPose?: Matrix4;
  currTime = 0; // 单位s
  emittedCount = 0;
  unEmitDistance = 0; // 上次未触发emit的距离
  cursor?: { low: number; high: number; len: number; absLen: number };
  // avgEmitCount = -1;
  shape: BufferGeometry;
  lastTimestamp?: number;

  constructor(
    config: {
      length?: number;
      time?: number;
      size?: number;
      velocity?: number;
      emitOverDistance?: number;
      spawnRadius?: number;
    } = {},
    material = new TrailParticleMaterial(),
    shape: BufferGeometry = new PlaneGeometry(1, 1),
  ) {
    // instanceMatrix没有被使用, 不生成16*count*4字节内存
    super(new UpdatableInstancedBufferGeometry(), material, 0);
    this.time = config.time ?? 1;
    this.size = config.size ?? 0.2;
    this.velocity = config.velocity ?? 1;
    this.spawnRadius = config.spawnRadius ?? 0.1;
    this.emitOverDistance = config.emitOverDistance ?? 10;
    this.length = config.length ?? 128;
    this.count = this.length;
    this.shape = shape;
    this.boundingSphere = undefined as any;
    this.currTime = this.time; // 消除buffer默认数据的渲染
    this.init();
  }

  reset() {
    delete this.cursor;
    delete this.lastTargetPose;
    this.emitting = true;
    // this.avgEmitCount = -1;
  }

  init() {
    // seed birthTime position.x position.y position.z
    const buffer = new Float32Array(this.length * 5);
    const interleaveBuffer = new InstancedInterleavedBuffer(buffer, 5).setUsage(DynamicDrawUsage);
    const instancedDataAttr = new InterleavedBufferAttribute(interleaveBuffer, 2, 0);
    const instancedPositionAttr = new InterleavedBufferAttribute(interleaveBuffer, 3, 2);

    this.buffers = { buffer, bufferAttr: instancedDataAttr };
    this.geometry
      .setAttribute('position', this.shape.getAttribute('position')!)
      .setAttribute('uv', this.shape.getAttribute('uv')!)
      // .setAttribute('normal', this.shape.getAttribute('normal'))
      .setAttribute('instanceData', instancedDataAttr)
      .setAttribute('instancePosition', instancedPositionAttr)
      .setIndex(this.shape.index);
    this.geometry.instanceCount = this.length;
    this.geometry.onGeometryUpdate = this.onGeometryUpdate;
  }

  onGeometryUpdate = () => {
    if (!this.visible) return;
    // 更新时间
    const now = Date.now();
    if (this.lastTimestamp !== undefined) this.currTime += (now - this.lastTimestamp) * 0.001;
    this.lastTimestamp = now;
    this.material.uniforms.timeInfo.value.x = this.currTime;

    const { emitting, buffers } = this;
    if (!emitting || !buffers) return;

    const currPose = this.matrixWorld;

    if (!this.cursor) this.cursor = { low: 0, high: 0, len: 0, absLen: 0 };
    if (!this.lastTargetPose) {
      this.lastTargetPose = currPose.clone();
      return;
    }

    const lastPosition = getPos(this.lastTargetPose, TMP_V3_0);
    const currPosition = getPos(currPose, TMP_V3_1);
    const distance = lastPosition.distanceTo(currPosition);

    const emitCountF32 = (this.unEmitDistance + distance) * this.emitOverDistance;
    let emitCountU32 = emitCountF32 | 0;
    this.unEmitDistance = (emitCountF32 - emitCountU32) / this.emitOverDistance;
    this.lastTargetPose.copy(currPose);

    if (emitCountU32 < 1) return;
    emitCountU32 = Math.min(this.length, emitCountU32);
    // emitCountU32 =
    //   this.avgEmitCount === -1
    //     ? emitCountU32
    //     : ((Math.min(emitCountU32, this.avgEmitCount * 1.45) + this.avgEmitCount) * 0.5) | 0;
    // this.avgEmitCount = emitCountU32;

    const { cursor, length, currTime, material } = this;
    const oldHigh = cursor.high;
    for (let i = 0 | 0; i < emitCountU32; i++) {
      // 更新粒子数据
      const offset = cursor.high * 5;
      // data
      buffers.buffer[offset] = Math.random();
      buffers.buffer[offset + 1] = currTime;
      // position 均匀在轨迹上出现粒子
      TMP_V3_2.lerpVectors(lastPosition, currPosition, (i + 1) / emitCountU32);
      buffers.buffer[offset + 2] = TMP_V3_2.x + (Math.random() * 2 - 1) * this.spawnRadius;
      buffers.buffer[offset + 3] = TMP_V3_2.y + (Math.random() * 2 - 1) * this.spawnRadius;
      buffers.buffer[offset + 4] = TMP_V3_2.z + (Math.random() * 2 - 1) * this.spawnRadius;
      // 更新指针
      cursor.high = (cursor.high + 1) % length;
    }
    cursor.len = Math.min(cursor.len + emitCountU32, this.length);
    cursor.absLen += emitCountU32;

    if (oldHigh > cursor.high) {
      // 两个range
      //   |old + 3
      // 0123
      //  |new
      // old - len
      const tailLen = length - oldHigh;
      this.updateInterleavedAttr(buffers.bufferAttr, oldHigh * 5, tailLen * 5);
      // 0 - new
      const headLen = cursor.high;
      headLen > 0 && this.updateInterleavedAttr(buffers.bufferAttr, 0, headLen * 5);
    } else {
      // 一个range
      // |old + 3
      // 0123
      //    |new
      this.updateInterleavedAttr(buffers.bufferAttr, oldHigh * 5, emitCountU32 * 5);
    }

    material.uniforms.cursor.value.x = cursor.low;
    material.uniforms.cursor.value.y = cursor.high;
    material.uniforms.cursor.value.z = cursor.len;
    material.uniforms.cursor.value.w = cursor.absLen;
    material.uniforms.timeInfo.value.y = this.time;
    material.uniforms.size.value = this.size;
    material.uniforms.velocity.value = this.velocity;
  };

  onBeforeRender(): void {
    this.geometry.updated = false;
  }

  updateInterleavedAttr(attr: InterleavedBufferAttribute, start: number, count: number) {
    attr.data.needsUpdate = true;
    attr.data.updateRanges.push({ start, count });
  }

  onDestroy(): void {
    this.material.dispose();
    this.geometry.dispose();
  }
}
