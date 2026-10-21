// Shared ground for every shot: the compositor, the look pass, the UI layer, two render targets for
// three.js, a 2D board that footage is painted on (uploaded as one texture), the clips, the Muybridge
// frames and the models. Built once in mount.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Frame, FrameSource, MountContext } from '@cueframe/core'
import { hdr, layer2d, post, type Hdr, type Layer2D, type Post } from '@cueframe/gfx'
import { look, type Look, type Rect } from './look.js'
import clipsJson from '../clips.json'
import muyJson from '../data/muybridge/frames.json'

export interface ClipMeta { id: string; src: string; in: number; dur: number; licence?: string; note?: string }
export const CLIP_META: Record<string, ClipMeta> = Object.fromEntries((clipsJson as ClipMeta[]).map((c) => [c.id, c]))

export interface Rig {
  root: THREE.Object3D
  mixer?: THREE.AnimationMixer
  action?: THREE.AnimationAction
  /** Seconds of one animation cycle as authored. */
  cycle: number
  meshes: THREE.Mesh[]
}

export interface Kit {
  W: number
  H: number
  scale: number
  comp: Hdr
  look: Look
  ui: Layer2D
  fx: Post
  gl: THREE.WebGLRenderer
  rt: THREE.WebGLRenderTarget
  rt2: THREE.WebGLRenderTarget
  env: THREE.Texture
  /** Footage board: paint clips here, then `board.upload()` and sample `board.tex`. */
  board: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; upload(): void; rect(r: Rect): Rect }
  clips: Record<string, FrameSource>
  muy: HTMLImageElement[]
  models: Record<'horse' | 'car' | 'stork' | 'parrot' | 'flamingo', Rig>
  carAO: THREE.Texture
  /** Render a three.js scene into a target with a clear colour (alpha 1). */
  render(scene: THREE.Scene, cam: THREE.Camera, target?: THREE.WebGLRenderTarget, clear?: string): THREE.Texture
}

const BOARD_W = 1920, BOARD_H = 1080

async function rig(loader: GLTFLoader, url: string): Promise<Rig> {
  const g = await loader.loadAsync(url)
  const root = g.scene
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
  const r: Rig = { root, cycle: 1, meshes }
  if (g.animations.length) {
    r.mixer = new THREE.AnimationMixer(root)
    r.action = r.mixer.clipAction(g.animations[0]!)
    r.action.play()
    r.cycle = g.animations[0]!.duration
  }
  return r
}

/** Pose an animated rig at `phase` cycles (pure: sets the mixer's absolute time). */
export function poseAt(r: Rig, phase: number): void {
  if (!r.mixer) return
  const c = ((phase % 1) + 1) % 1
  r.mixer.setTime(c * r.cycle)
  r.root.updateMatrixWorld(true)
}

export async function makeKit(ctx: MountContext): Promise<Kit> {
  const W = ctx.stage.w, H = ctx.stage.h, scale = ctx.stage.scale
  const comp = hdr(ctx)
  const lk = look(ctx)
  const ui = layer2d(ctx, 'ui')
  const fx = post(ctx, { tone: 'none', grain: { amount: 0.03 }, vignette: { amount: 0.18, inner: 0.35, outer: 1.05 }, dither: true })
  const gl = ctx.webgl<THREE.WebGLRenderer>().renderer
  const pw = Math.round(W * scale), ph = Math.round(H * scale)
  const mk = () => new THREE.WebGLRenderTarget(pw, ph, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true })
  const rt = mk(), rt2 = mk()
  const pmrem = new THREE.PMREMGenerator(gl)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const canvas = document.createElement('canvas')
  canvas.width = BOARD_W
  canvas.height = BOARD_H
  const g = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const board = {
    canvas, g, tex,
    upload() { tex.needsUpdate = true },
    /** A board rect (px) as a crop window for the look (0..1). */
    rect(r: Rect): Rect { return { x: r.x / BOARD_W, y: r.y / BOARD_H, w: r.w / BOARD_W, h: r.h / BOARD_H } },
  }

  const clips: Record<string, FrameSource> = {}
  await Promise.all(Object.keys(CLIP_META).map(async (id) => { clips[id] = await ctx.frames(`build/plates/${id}`, { cache: 4 }) }))

  const muy = await Promise.all((muyJson as { frames: { file: string }[] }).frames.map((fr) => new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => rej(new Error(`muybridge: ${fr.file}`))
    im.src = `/data/muybridge/${fr.file}`
  })))

  const draco = new DRACOLoader().setDecoderPath('/data/draco/')
  const loader = new GLTFLoader().setDRACOLoader(draco)
  const [horse, car, stork, parrot, flamingo] = await Promise.all(['Horse', 'ferrari', 'Stork', 'Parrot', 'Flamingo'].map((n) => rig(loader, `/data/models/${n}.glb`)))
  const carAO = await new THREE.TextureLoader().loadAsync('/data/models/ferrari_ao.png')

  const render = (scene: THREE.Scene, cam: THREE.Camera, target = rt, clear = '#000000') => {
    gl.setRenderTarget(target)
    gl.setClearColor(clear, 1)
    gl.clear(true, true, true)
    gl.render(scene, cam)
    gl.setRenderTarget(null)
    return target.texture
  }
  return {
    W, H, scale, comp, look: lk, ui, fx, gl, rt, rt2, env, board, clips, muy,
    models: { horse: horse!, car: car!, stork: stork!, parrot: parrot!, flamingo: flamingo! }, carAO, render,
  }
}

/** The clip frame shown `sec` seconds after the clip's chosen in-point (looping inside its range). */
export function clipFrame(k: Kit, id: string, sec: number): number {
  const m = CLIP_META[id]!
  const s = k.clips[id]!
  const local = ((sec % m.dur) + m.dur) % m.dur
  return s.frameAt(local)
}

export type { Frame }
