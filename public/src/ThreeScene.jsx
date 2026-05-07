import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import './ThreeScene.css'

// ─── Données ──────────────────────────────────────────────────────────────────

const W = 1.2
const H = 1.2

function randomPositions(count, spread, minDist) {
  const positions = []
  let attempts = 0
  while (positions.length < count && attempts < 10000) {
    attempts++
    const x = (Math.random() - 0.5) * spread
    const y = (Math.random() - 0.5) * spread * 0.5
    const z = (Math.random() - 0.5) * spread * 0.4
    const ok = positions.every(p => {
      const dx = p.x - x, dy = p.y - y, dz = p.z - z
      return Math.sqrt(dx*dx + dy*dy + dz*dz) > minDist
    })
    if (ok) positions.push(new THREE.Vector3(x, y, z))
  }
  return positions
}

export default function ThreeScene() {
  const mountRef   = useRef(null)
  const nameInputRef = useRef(null)
  const hudCanvasRef = useRef(null)
  const handlersRef  = useRef({ checkAnswer: () => {}, closeActive: () => {} })

  const [cardVisible,  setCardVisible]  = useState(false)
  const [cardStyle,    setCardStyle]    = useState({})
  const [feedbackMsg,  setFeedbackMsg]  = useState('')
  const [feedbackType, setFeedbackType] = useState('')
  const [showCityHint, setShowCityHint] = useState(true)
  const [showRingModal, setShowRingModal] = useState(false)
  const [movieDetails, setMovieDetails] = useState(null)
  const enterRingRef = useRef(() => {})

  useEffect(() => {
    const mount = mountRef.current

    // ─── Scène ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    // Ambiance moderne : noir profond + brume bleutée subtile
    scene.background = new THREE.Color(0x2a3340)
    scene.fog = new THREE.FogExp2(0x2a3340, 0.008)

    // ─── Système Audio (Web Audio API — procédural, sans fichiers) ────────────
    let audioCtx = null
    function getAudioCtx() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      if (audioCtx.state === 'suspended') audioCtx.resume()
      return audioCtx
    }

    // Cloche de ring (victoire)
    function playBell() {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, t)
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.4)
      gain.gain.setValueAtTime(0.7, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + 2.0)
      // Harmonique
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1320, t)
      osc2.frequency.exponentialRampToValueAtTime(990, t + 0.3)
      gain2.gain.setValueAtTime(0.35, t)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 1.5)
      osc2.connect(gain2); gain2.connect(ctx.destination)
      osc2.start(t); osc2.stop(t + 1.5)
    }

    // Buzzer raté
    function playBuzzer() {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, t)
      osc.frequency.linearRampToValueAtTime(90, t + 0.3)
      gain.gain.setValueAtTime(0.5, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.35)
    }

    // Clic métal (sélection d'un objet)
    function playClick() {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2400
      filter.Q.value = 2.0
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.6, t)
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      src.start(t)
    }

    // Crowd roar (entrée dans le ring)
    function playCrowdRoar() {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const dur = 2.2
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(300, t)
      filter.frequency.linearRampToValueAtTime(900, t + dur)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0, t)
      gain.gain.linearRampToValueAtTime(0.55, t + 0.6)
      gain.gain.linearRampToValueAtTime(0.25, t + dur)
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      src.start(t)
      // Gong d'annonce
      const gong = ctx.createOscillator()
      const gGain = ctx.createGain()
      gong.type = 'sine'
      gong.frequency.setValueAtTime(220, t)
      gong.frequency.exponentialRampToValueAtTime(110, t + 1.8)
      gGain.gain.setValueAtTime(0.8, t)
      gGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0)
      gong.connect(gGain); gGain.connect(ctx.destination)
      gong.start(t); gong.stop(t + 2.0)
    }

    // Whoosh cinématique (fiche film)
    function playWhoosh() {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const dur = 0.5
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(200, t)
      filter.frequency.exponentialRampToValueAtTime(3000, t + dur)
      filter.Q.value = 0.5
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.5, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      src.start(t)
    }

    // Pas (footstep) — sol béton sourd
    let lastStepTime = 0
    function playFootstep() {
      const ctx = getAudioCtx()
      const now = ctx.currentTime
      if (now - lastStepTime < 0.32) return  // throttle
      lastStepTime = now
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.09, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 320
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.45, now)
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      src.start(now)
    }

    // Son arcade 8-bit (validation du nom)
    function playArcadeConfirm() {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      // Séquence de notes montantes façon jingle d'arcade
      const notes = [
        { freq: 523.25, start: 0.00, dur: 0.08 },  // Do5
        { freq: 659.25, start: 0.08, dur: 0.08 },  // Mi5
        { freq: 783.99, start: 0.16, dur: 0.08 },  // Sol5
        { freq: 1046.5, start: 0.24, dur: 0.18 },  // Do6 — note finale plus longue
      ]
      for (const note of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'  // timbre 8-bit carré
        osc.frequency.value = note.freq
        gain.gain.setValueAtTime(0.0, t + note.start)
        gain.gain.linearRampToValueAtTime(0.22, t + note.start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.start + note.dur)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(t + note.start)
        osc.stop(t + note.start + note.dur + 0.05)
      }
      // Coup de caisse claire synthétique (pshh)
      const nBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
      const nd = nBuf.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length)
      const nSrc = ctx.createBufferSource()
      nSrc.buffer = nBuf
      const nFilt = ctx.createBiquadFilter()
      nFilt.type = 'highpass'; nFilt.frequency.value = 6000
      const nGain = ctx.createGain()
      nGain.gain.setValueAtTime(0.15, t + 0.24)
      nSrc.connect(nFilt); nFilt.connect(nGain); nGain.connect(ctx.destination)
      nSrc.start(t + 0.24)
    }

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 3, 14)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.5
    mount.appendChild(renderer.domElement)

    // ─── Caméra 3ème personne ──────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 2
    controls.maxDistance = 20
    controls.maxPolarAngle = Math.PI / 2 - 0.05 // Empêcher de passer sous le sol

    // ─── Lumières ─────────────────────────────────────────────────────────────
    // Ambiance LED moderne — neutre, légère teinte cyan
    scene.add(new THREE.AmbientLight(0xdfe7f0, 3.4))

    // Hémisphérique : plafond clair → sol éclairé (visibilité accrue)
    scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x6a7280, 2.2))

    // Projecteur central blanc froid sur le ring
    const keyLight = new THREE.SpotLight(0xffffff, 110, 32, Math.PI / 4, 0.4)
    keyLight.position.set(0, 14, 0)
    keyLight.target.position.set(0, -3, 0)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.camera.near = 1
    keyLight.shadow.camera.far  = 30
    scene.add(keyLight)
    scene.add(keyLight.target)

    // ─── Modèle GLTF ──────────────────────────────────────────────────────────
    const gltfLoader  = new GLTFLoader()

    // ─── Sensei contrôlable (modèle GLB) ──────────────────────────────────────
    const sensei = new THREE.Group()
    const SENSEI_HEIGHT = 3.0 // hauteur cible du personnage en unités scène

    let mixer = null
    let idleAction = null
    let walkAction = null
    let activeAction = null

    // Helper pour changer d'animation de manière fluide
    function fadeToAction(action, duration) {
      if (!action || action === activeAction) return;
      let previousAction = activeAction;
      activeAction = action;
      if (previousAction) {
        previousAction.fadeOut(duration);
      }
      activeAction
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();
    }

    gltfLoader.load('assets/model/sensei.glb', (gltf) => {
      const model = gltf.scene
      // GLB authored facing +Z → on retourne pour matcher la convention Three.js (-Z)
      model.rotation.y = Math.PI
      // Auto-scale à SENSEI_HEIGHT et calage au sol
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3(); box.getSize(size)
      const k = SENSEI_HEIGHT / (size.y || 1)
      model.scale.setScalar(k)
      const box2 = new THREE.Box3().setFromObject(model)
      const center = new THREE.Vector3(); box2.getCenter(center)
      model.position.x -= center.x
      model.position.z -= center.z
      model.position.y -= box2.min.y // pieds à y=0 (au sol quand sensei.position.y = -3.5)
      model.traverse(o => { if (o.isMesh) o.castShadow = true })
      sensei.add(model)

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model)
        // L'animation 0 est supposée être Idle, la 1 ou suivante être Walk/Run
        idleAction = mixer.clipAction(gltf.animations[0])
        walkAction = gltf.animations.length > 1 ? mixer.clipAction(gltf.animations[1]) : idleAction
        activeAction = idleAction
        idleAction.play()
      }
    })

    // Plaque flottante "Maître Sho"
    const nameCanvas = document.createElement('canvas')
    nameCanvas.width = 512
    nameCanvas.height = 128
    const nctx = nameCanvas.getContext('2d')
    nctx.fillStyle = 'rgba(10, 6, 4, 0.75)'
    const pad = 14
    const rw = nameCanvas.width - pad * 2
    const rh = nameCanvas.height - pad * 2
    nctx.beginPath()
    const r = 30
    nctx.moveTo(pad + r, pad)
    nctx.arcTo(pad + rw, pad, pad + rw, pad + rh, r)
    nctx.arcTo(pad + rw, pad + rh, pad, pad + rh, r)
    nctx.arcTo(pad, pad + rh, pad, pad, r)
    nctx.arcTo(pad, pad, pad + rw, pad, r)
    nctx.closePath()
    nctx.fill()
    nctx.strokeStyle = '#c8a050'
    nctx.lineWidth = 4
    nctx.stroke()
    nctx.fillStyle = '#fff2d4'
    nctx.font = 'bold 56px "Trebuchet MS", sans-serif'
    nctx.textAlign = 'center'
    nctx.textBaseline = 'middle'
    nctx.fillText('Maître Sho', nameCanvas.width / 2, nameCanvas.height / 2 + 4)
    const nameTex = new THREE.CanvasTexture(nameCanvas)
    nameTex.anisotropy = 8
    const nameTag = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthTest: false })
    )
    nameTag.scale.set(1.8, 0.45, 1)
    nameTag.position.set(0, 3.4, 0)
    nameTag.renderOrder = 999
    sensei.add(nameTag)

    sensei.position.set(16, -3.5, 8)
    // regarde vers le ring
    sensei.rotation.y = Math.atan2(-sensei.position.x, -sensei.position.z) + Math.PI
    scene.add(sensei)

    // ─── Lumières d'ambiance (coins du ring) — accents néon ───────────────────
    const blueLight = new THREE.PointLight(0x00d4ff, 22, 26)
    blueLight.position.set(-10, 6, -10)
    scene.add(blueLight)

    const redLight = new THREE.PointLight(0xff2040, 22, 26)
    redLight.position.set(10, 6, 10)
    scene.add(redLight)

    // 2 accents supplémentaires côté murs latéraux pour souligner le volume
    const accentL = new THREE.PointLight(0x00d4ff, 9, 20)
    accentL.position.set(-26, 4, 0)
    scene.add(accentL)
    const accentR = new THREE.PointLight(0xff2040, 9, 20)
    accentR.position.set(26, 4, 0)
    scene.add(accentR)

    // ─── Sol ──────────────────────────────────────────────────────────────────
    // Béton lustré sombre, légèrement réfléchissant
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({
        color: 0x1a1d22,
        roughness: 0.45,
        metalness: 0.25,
      })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -3.5
    floor.receiveShadow = true
    scene.add(floor)

    // Grille fine (look studio moderne) — lignes claires régulières
    const gridGroup = new THREE.Group()
    const GRID_SIZE = 60
    const GRID_STEP = 4
    const gridLineMat = new THREE.MeshBasicMaterial({ color: 0x2c3138, transparent: true, opacity: 0.55 })
    for (let i = -GRID_SIZE / 2; i <= GRID_SIZE / 2; i += GRID_STEP) {
      // ligne X
      const lx = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE, 0.04), gridLineMat)
      lx.rotation.x = -Math.PI / 2
      lx.position.set(0, -3.49, i)
      gridGroup.add(lx)
      // ligne Z
      const lz = new THREE.Mesh(new THREE.PlaneGeometry(0.04, GRID_SIZE), gridLineMat)
      lz.rotation.x = -Math.PI / 2
      lz.position.set(i, -3.49, 0)
      gridGroup.add(lz)
    }
    scene.add(gridGroup)

    // ─── ÉTAPE 3 : Murs et plafond ────────────────────────────────────────────
    const ROOM = 60
    const WALL_H = 22
    const WALL_Y = -3.5 + WALL_H / 2

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1d2026,
      roughness: 0.9,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })

    const walls = [
      { pos: [0, WALL_Y, -ROOM / 2], rot: [0, 0, 0] },
      { pos: [0, WALL_Y,  ROOM / 2], rot: [0, Math.PI, 0] },
      { pos: [-ROOM / 2, WALL_Y, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [ ROOM / 2, WALL_Y, 0], rot: [0, -Math.PI / 2, 0] },
    ]
    for (const { pos, rot } of walls) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, WALL_H), wallMat)
      wall.position.set(...pos)
      wall.rotation.set(...rot)
      wall.receiveShadow = true
      scene.add(wall)
    }

    // Plinthe plus sombre + filet métal
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.85, metalness: 0.3 })
    const baseH = 1.2
    for (const { pos, rot } of walls) {
      const base = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, baseH), baseMat)
      base.position.set(pos[0], -3.5 + baseH / 2, pos[2])
      base.rotation.set(...rot)
      scene.add(base)
    }

    // Plafond noir mat
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM, ROOM),
      new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 })
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = -3.5 + WALL_H
    scene.add(ceiling)

    // Bandes LED horizontales sur les murs (look studio moderne)
    const ledStripGeo = new THREE.PlaneGeometry(ROOM - 1, 0.08)
    const ledStripMatCyan = new THREE.MeshBasicMaterial({ color: 0x00d4ff })
    const ledStripMatRed  = new THREE.MeshBasicMaterial({ color: 0xff2040 })
    const ledY = -3.5 + 7
    for (const { pos, rot, side } of [
      { pos: [0, ledY, -ROOM / 2 + 0.06], rot: [0, 0, 0],            side: 'cyan' },
      { pos: [0, ledY,  ROOM / 2 - 0.06], rot: [0, Math.PI, 0],      side: 'cyan' },
      { pos: [-ROOM / 2 + 0.06, ledY, 0], rot: [0, Math.PI / 2, 0],  side: 'cyan' },
      { pos: [ ROOM / 2 - 0.06, ledY, 0], rot: [0, -Math.PI / 2, 0], side: 'red'  },
    ]) {
      const strip = new THREE.Mesh(ledStripGeo, side === 'red' ? ledStripMatRed : ledStripMatCyan)
      strip.position.set(...pos)
      strip.rotation.set(...rot)
      scene.add(strip)
    }

    // ─── ÉTAPE 4 : Plateforme du ring ─────────────────────────────────────────
    const RING_SIZE  = 22          // grand ring pour englober la scène
    const RING_Y_BOT = -3.5        // niveau du sol
    const PLAT_H     = 0.8         // épaisseur plateforme
    const RING_TOP   = RING_Y_BOT + PLAT_H

    // Toile du ring (blanche pure, look studio)
    const ringCanvas = new THREE.Mesh(
      new THREE.BoxGeometry(RING_SIZE, PLAT_H, RING_SIZE),
      new THREE.MeshStandardMaterial({
        color: 0xf2f2f0,
        roughness: 0.85,
        metalness: 0.05,
      })
    )
    ringCanvas.position.set(0, RING_Y_BOT + PLAT_H / 2, 0)
    ringCanvas.receiveShadow = true
    ringCanvas.castShadow    = true
    scene.add(ringCanvas)

    // Jupe noire mat (épurée) avec un liseré rouge ajouté plus bas
    const SKIRT_H = 1.4
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x0d0e12,
      roughness: 0.7,
      metalness: 0.15,
    })
    // 4 panneaux au lieu d'un box pour ne pas chevaucher le sol
    const skirtY = RING_Y_BOT - SKIRT_H / 2 + 0.8
    const skirts = [
      { pos: [0, skirtY, -RING_SIZE / 2], w: RING_SIZE, rot: [0, 0, 0] },
      { pos: [0, skirtY,  RING_SIZE / 2], w: RING_SIZE, rot: [0, Math.PI, 0] },
      { pos: [-RING_SIZE / 2, skirtY, 0], w: RING_SIZE, rot: [0, Math.PI / 2, 0] },
      { pos: [ RING_SIZE / 2, skirtY, 0], w: RING_SIZE, rot: [0, -Math.PI / 2, 0] },
    ]
    for (const s of skirts) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(s.w, SKIRT_H), skirtMat)
      panel.position.set(...s.pos)
      panel.rotation.set(...s.rot)
      scene.add(panel)
    }

    // Liseré chrome au bord supérieur de la toile
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xdcdcdc,
      roughness: 0.2,
      metalness: 0.95,
    })
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(RING_SIZE + 0.1, 0.08, RING_SIZE + 0.1),
      trimMat
    )
    trim.position.set(0, RING_TOP + 0.01, 0)
    scene.add(trim)

    // Liseré rouge néon en bas de la jupe (accent visuel)
    const accentRedMat = new THREE.MeshBasicMaterial({ color: 0xff2040 })
    const accentY = RING_Y_BOT - SKIRT_H + 0.85
    for (const a of skirts) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(a.w, 0.06), accentRedMat)
      strip.position.set(a.pos[0], accentY, a.pos[2])
      strip.rotation.set(...a.rot)
      // léger offset vers l'extérieur pour éviter le z-fight
      strip.position.x += Math.sin(a.rot[1]) * 0.01
      strip.position.z += Math.cos(a.rot[1]) * 0.01
      scene.add(strip)
    }

    // ─── ÉTAPE 5 : Poteaux du ring ────────────────────────────────────────────
    const POST_H     = 6
    const POST_OFF   = RING_SIZE / 2 - 0.5
    const POST_Y_BOT = RING_TOP
    const POST_COLORS = [0xff2040, 0x00d4ff, 0x00d4ff, 0xff2040] // néon rouge / cyan

    const postCorners = [
      [ POST_OFF, POST_OFF],
      [-POST_OFF, POST_OFF],
      [-POST_OFF,-POST_OFF],
      [ POST_OFF,-POST_OFF],
    ]

    const postTopY = POST_Y_BOT + POST_H
    postCorners.forEach(([x, z], i) => {
      // Poteau principal (tube gainé)
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, POST_H, 20),
        new THREE.MeshStandardMaterial({
          color: POST_COLORS[i],
          roughness: 0.55,
          metalness: 0.25,
        })
      )
      post.position.set(x, POST_Y_BOT + POST_H / 2, z)
      post.castShadow = true
      scene.add(post)

      // Embout chromé en haut
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.9 })
      )
      cap.position.set(x, postTopY + 0.1, z)
      scene.add(cap)

      // Coussin coloré au sommet (corner pad)
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.6, 0.9),
        new THREE.MeshStandardMaterial({
          color: POST_COLORS[i],
          roughness: 0.8,
          metalness: 0,
        })
      )
      pad.position.set(x, POST_Y_BOT + 0.8, z)
      scene.add(pad)
    })

    // ─── ÉTAPE 6 : Cordes du ring ─────────────────────────────────────────────
    const ROPE_COLORS = [0xeaeaea, 0xff2040, 0x00d4ff, 0xeaeaea] // blanche, rouge néon, cyan, blanche
    const ROPE_HEIGHTS = [1.6, 2.7, 3.8, 4.9] // au-dessus du RING_TOP

    function buildRope(from, to, color) {
      const dir = new THREE.Vector3().subVectors(to, from)
      const len = dir.length()
      const geo = new THREE.CylinderGeometry(0.06, 0.06, len, 10)
      // oriente l'axe du cylindre (Y) vers la direction souhaitée
      geo.rotateX(Math.PI / 2)
      const rope = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 })
      )
      rope.position.copy(from).addScaledVector(dir, 0.5)
      rope.lookAt(to)
      rope.castShadow = true
      return rope
    }

    const sidePairs = [[0, 1], [1, 2], [2, 3], [3, 0]]
    ROPE_HEIGHTS.forEach((h, rIdx) => {
      const y = POST_Y_BOT + h
      for (const [a, b] of sidePairs) {
        const [ax, az] = postCorners[a]
        const [bx, bz] = postCorners[b]
        const from = new THREE.Vector3(ax, y, az)
        const to   = new THREE.Vector3(bx, y, bz)
        scene.add(buildRope(from, to, ROPE_COLORS[rIdx]))
      }
    })

    // Petites attaches verticales qui relient les cordes entre elles (turnbuckles)
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
    const tiePositions = [
      [0, -POST_OFF], [0, POST_OFF],
      [-POST_OFF, 0], [POST_OFF, 0],
    ]
    for (const [tx, tz] of tiePositions) {
      const tie = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025,
          ROPE_HEIGHTS[ROPE_HEIGHTS.length - 1] - ROPE_HEIGHTS[0], 6),
        tieMat
      )
      tie.position.set(
        tx,
        POST_Y_BOT + (ROPE_HEIGHTS[0] + ROPE_HEIGHTS[ROPE_HEIGHTS.length - 1]) / 2,
        tz
      )
      scene.add(tie)
    }

    // ─── ÉTAPE 7 : Décor (sacs de frappe + projecteurs) ───────────────────────
    const CEIL_Y = -3.5 + WALL_H

    function addPunchingBag(x, z, color = 0x0a0a0c, accent = 0xff2040) {
      // chaîne
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, CEIL_Y - 2, 6),
        new THREE.MeshStandardMaterial({ color: 0xc4c4c4, roughness: 0.2, metalness: 0.95 })
      )
      chain.position.set(x, (CEIL_Y + 2) / 2, z)
      scene.add(chain)

      // sac (cuir mat moderne)
      const bag = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 3.2, 24),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 })
      )
      bag.position.set(x, 0.4, z)
      bag.castShadow = true
      scene.add(bag)

      // sangles de suspension (4 brins)
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.6, 0.02),
          new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7 })
        )
        const sx = Math.cos(a) * 0.45, sz = Math.sin(a) * 0.45
        strap.position.set(x + sx, 2.3, z + sz)
        strap.lookAt(x, 2.65, z)
        scene.add(strap)
      }

      // bande couleur en haut (logo accent)
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.561, 0.561, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.3 })
      )
      band.position.set(x, 1.7, z)
      scene.add(band)

      // cerclage au milieu du sac
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.04, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.set(x, 0.4, z)
      scene.add(ring)
    }

    // Rangée de sacs derrière le ring (cuir noir, accents rouge/cyan)
    const BAG_X = RING_SIZE / 2 + 4
    addPunchingBag(-BAG_X, -10, 0x0a0a0c, 0xff2040)
    addPunchingBag(-BAG_X,  -4, 0x0a0a0c, 0x00d4ff)
    addPunchingBag(-BAG_X,   4, 0x0a0a0c, 0xff2040)
    addPunchingBag(-BAG_X,  10, 0x0a0a0c, 0x00d4ff)
    addPunchingBag( BAG_X, -10, 0x0a0a0c, 0x00d4ff)
    addPunchingBag( BAG_X,  -4, 0x0a0a0c, 0xff2040)
    addPunchingBag( BAG_X,   4, 0x0a0a0c, 0x00d4ff)
    addPunchingBag( BAG_X,  10, 0x0a0a0c, 0xff2040)

    // Projecteurs suspendus au-dessus du ring
    function addRig(x, z) {
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.5, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.5 })
      )
      housing.position.set(x, CEIL_Y - 0.4, z)
      scene.add(housing)

      const lamp = new THREE.Mesh(
        new THREE.CircleGeometry(0.6, 24),
        new THREE.MeshBasicMaterial({ color: 0xfff1c0 })
      )
      lamp.rotation.x = Math.PI / 2
      lamp.position.set(x, CEIL_Y - 0.66, z)
      scene.add(lamp)

      const beam = new THREE.SpotLight(0xfff0c0, 20, 25, Math.PI / 5, 0.5, 1.5)
      beam.position.set(x, CEIL_Y - 0.7, z)
      beam.target.position.set(x * 0.3, RING_TOP, z * 0.3)
      scene.add(beam)
      scene.add(beam.target)
    }
    addRig(-6, -6)
    addRig( 6, -6)
    addRig(-6,  6)
    addRig( 6,  6)

    // Grille de plafonniers (panneaux LED) — lumière diffuse sans ombres
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xeaf3ff })
    const panelGeo = new THREE.PlaneGeometry(3.2, 1.2)
    const CEILING_LIGHTS = [
      [-16,  16], [ 0,  16], [ 16,  16],
      [-16,   0], [ 0,   0], [ 16,   0],
      [-16, -16], [ 0, -16], [ 16, -16],
    ]
    for (const [x, z] of CEILING_LIGHTS) {
      const panel = new THREE.Mesh(panelGeo, panelMat)
      panel.rotation.x = Math.PI / 2
      panel.position.set(x, CEIL_Y - 0.02, z)
      scene.add(panel)

      const pt = new THREE.PointLight(0xeaf3ff, 18, 28, 1.8)
      pt.position.set(x, CEIL_Y - 0.3, z)
      // pas d'ombres (castShadow reste false par défaut)
      scene.add(pt)
    }

    // Néon "FIGHT CLUB" au-dessus du mur du fond
    const bannerCanvas = document.createElement('canvas')
    bannerCanvas.width = 1024
    bannerCanvas.height = 256
    const bctx = bannerCanvas.getContext('2d')
    bctx.fillStyle = '#0a0c10'
    bctx.fillRect(0, 0, 1024, 256)
    // glow stack — plusieurs passes pour simuler un néon
    bctx.textAlign = 'center'
    bctx.textBaseline = 'middle'
    bctx.font = '900 130px "Helvetica Neue", "Arial Black", sans-serif'
    const glowPasses = [
      { color: 'rgba(255, 32, 64, 0.18)', blur: 28 },
      { color: 'rgba(255, 32, 64, 0.32)', blur: 16 },
      { color: 'rgba(255, 80, 110, 0.7)', blur: 6  },
    ]
    for (const p of glowPasses) {
      bctx.shadowColor = p.color
      bctx.shadowBlur  = p.blur
      bctx.fillStyle   = '#ffe6ec'
      bctx.fillText('FIGHT  CLUB', 512, 130)
    }
    bctx.shadowBlur = 0
    bctx.fillStyle = '#fff'
    bctx.fillText('FIGHT  CLUB', 512, 130)
    // sous-titre minimaliste
    bctx.font = '500 22px "Helvetica Neue", Arial, sans-serif'
    bctx.fillStyle = 'rgba(0, 212, 255, 0.85)'
    bctx.fillText('— EST. 2026 · TRAINING FACILITY —', 512, 215)

    const bannerTex = new THREE.CanvasTexture(bannerCanvas)
    bannerTex.anisotropy = 8
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4.5),
      new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true })
    )
    banner.position.set(0, 12, -ROOM / 2 + 0.05)
    scene.add(banner)

    // ─── Casiers et bancs le long des murs ───────────────────────────────────
    const LOCKER_W = 0.9
    const LOCKER_H = 1.9
    const LOCKER_D = 0.5

    const lockerBody   = new THREE.MeshStandardMaterial({ color: 0x1f232a, roughness: 0.4, metalness: 0.7 })
    const lockerAccent = new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.45, metalness: 0.7 })
    const ventMat      = new THREE.MeshBasicMaterial({ color: 0x05060a })
    const handleMat    = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.95, roughness: 0.15 })

    function makeLocker(colorMat) {
      const grp = new THREE.Group()
      // corps
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(LOCKER_W, LOCKER_H, LOCKER_D), colorMat
      )
      body.castShadow = true
      body.receiveShadow = true
      grp.add(body)
      // porte (légèrement en saillie)
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(LOCKER_W - 0.08, LOCKER_H - 0.08, 0.03),
        colorMat
      )
      door.position.z = LOCKER_D / 2 + 0.015
      grp.add(door)
      // aérations (3 fentes horizontales en haut)
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(LOCKER_W * 0.45, 0.025, 0.005), ventMat)
        vent.position.set(0, LOCKER_H / 2 - 0.2 - i * 0.09, LOCKER_D / 2 + 0.035)
        grp.add(vent)
      }
      // poignée verticale
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), handleMat
      )
      handle.position.set(LOCKER_W * 0.3, -0.1, LOCKER_D / 2 + 0.06)
      grp.add(handle)
      // charnières (2 petits points à gauche)
      for (const hy of [0.6, -0.6]) {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), handleMat)
        hinge.rotation.z = Math.PI / 2
        hinge.position.set(-LOCKER_W * 0.45, hy, LOCKER_D / 2 + 0.035)
        grp.add(hinge)
      }
      return grp
    }

    function makeBench() {
      const grp = new THREE.Group()
      const BW = 3.2, BH = 0.1, BD = 0.45
      // assise bois sombre type chêne fumé
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(BW, BH, BD),
        new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.6, metalness: 0.1 })
      )
      top.position.y = 0.52
      top.castShadow = true
      top.receiveShadow = true
      grp.add(top)
      // 2 pieds chrome
      for (const sx of [-BW * 0.38, BW * 0.38]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.5, BD),
          new THREE.MeshStandardMaterial({ color: 0xc4c4c4, metalness: 0.95, roughness: 0.2 })
        )
        leg.position.set(sx, 0.25, 0)
        leg.castShadow = true
        grp.add(leg)
      }
      // barre transversale chrome
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(BW * 0.76, 0.03, 0.03),
        new THREE.MeshStandardMaterial({ color: 0xc4c4c4, metalness: 0.95, roughness: 0.2 })
      )
      cross.position.y = 0.12
      grp.add(cross)
      return grp
    }

    // banks de casiers placés aux positions qui évitent les blocs films
    const BANK_POSITIONS = [-20, -10, 0, 10, 20]
    const LOCKERS_PER_BANK = 4
    const LOCKER_Y = -3.5 + LOCKER_H / 2 // base au sol

    const wallLayouts = [
      { varAxis: 'x', side: -1, fixAxis: 'z', rotY: 0,            benchRotY: 0           }, // mur arrière
      { varAxis: 'x', side:  1, fixAxis: 'z', rotY: Math.PI,      benchRotY: 0           }, // mur avant
      { varAxis: 'z', side: -1, fixAxis: 'x', rotY: Math.PI / 2,  benchRotY: Math.PI / 2 }, // mur gauche
      { varAxis: 'z', side:  1, fixAxis: 'x', rotY: -Math.PI / 2, benchRotY: Math.PI / 2 }, // mur droit
    ]

    for (const layout of wallLayouts) {
      const wallCoord   = layout.side * (ROOM / 2 - LOCKER_D / 2 - 0.05)
      const benchCoord  = layout.side * (ROOM / 2 - 3.2)
      for (const center of BANK_POSITIONS) {
        // banc devant la rangée de casiers
        const bench = makeBench()
        const bpos = { x: 0, z: 0 }
        bpos[layout.varAxis] = center
        bpos[layout.fixAxis] = benchCoord
        bench.position.set(bpos.x, -3.5, bpos.z)
        bench.rotation.y = layout.benchRotY
        scene.add(bench)

        // rangée de casiers (4 côte à côte)
        for (let i = 0; i < LOCKERS_PER_BANK; i++) {
          const off = (i - (LOCKERS_PER_BANK - 1) / 2) * LOCKER_W
          const color = (i + center) % 2 === 0 ? lockerBody : lockerAccent
          const locker = makeLocker(color)
          const lpos = { x: 0, z: 0 }
          lpos[layout.varAxis] = center + off
          lpos[layout.fixAxis] = wallCoord
          locker.position.set(lpos.x, LOCKER_Y, lpos.z)
          locker.rotation.y = layout.rotY
          scene.add(locker)
        }
      }
    }

    // ─── Props gym moderne ────────────────────────────────────────────────────
    const matChrome      = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.95, roughness: 0.18 })
    const matLeatherRed  = new THREE.MeshStandardMaterial({ color: 0xb01828, roughness: 0.45, metalness: 0.25 })
    const matFabricWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeec, roughness: 0.95 })

    function makeGloves(color = 0xb01828) {
      const grp = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 })
      for (const sx of [-0.18, 0.18]) {
        const glove = new THREE.Group()
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat)
        fist.scale.set(1, 0.95, 1.15)
        glove.add(fist)
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 14), mat)
        cuff.position.set(0, -0.05, -0.18)
        cuff.rotation.x = Math.PI / 2.2
        glove.add(cuff)
        const logo = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), matFabricWhite)
        logo.position.set(0, 0.04, 0.16)
        glove.add(logo)
        glove.position.x = sx
        glove.rotation.y = sx > 0 ? -0.35 : 0.35
        glove.traverse(o => { if (o.isMesh) o.castShadow = true })
        grp.add(glove)
      }
      return grp
    }

    function makeHandwrap(color = 0xc02035) {
      const grp = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 18), mat)
      roll.rotation.x = Math.PI / 2
      roll.castShadow = true
      grp.add(roll)
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.075, 12),
        new THREE.MeshBasicMaterial({ color: 0x0a0a0c })
      )
      hub.rotation.x = Math.PI / 2
      grp.add(hub)
      const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.16), mat)
      flap.rotation.x = -Math.PI / 6
      flap.position.set(0, -0.04, 0.12)
      grp.add(flap)
      return grp
    }

    function makeTowel(color = 0xeeeeec) {
      const grp = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 })
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.32), mat)
      body.castShadow = true
      grp.add(body)
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.28), mat)
      fold.position.set(0.04, 0.045, 0)
      grp.add(fold)
      // un pli froissé qui dépasse
      const drape = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.22), mat)
      drape.rotation.x = -Math.PI / 2.2
      drape.position.set(-0.32, 0.0, 0.05)
      grp.add(drape)
      return grp
    }

    function makeBottle() {
      const grp = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 0.32, 16),
        new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.25, metalness: 0.55 })
      )
      body.position.y = 0.16
      body.castShadow = true
      grp.add(body)
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12),
        new THREE.MeshStandardMaterial({ color: 0xff2040, roughness: 0.5 })
      )
      cap.position.y = 0.35
      grp.add(cap)
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.062, 0.1, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9, side: THREE.DoubleSide })
      )
      label.position.y = 0.16
      grp.add(label)
      return grp
    }

    function makeMedicineBall(accent = 0xff2040) {
      const grp = new THREE.Group()
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 24, 18),
        new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9, metalness: 0.05 })
      )
      ball.castShadow = true
      grp.add(ball)
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.025, 10, 28),
        new THREE.MeshBasicMaterial({ color: accent })
      )
      stripe.rotation.x = Math.PI / 2
      grp.add(stripe)
      return grp
    }

    function makeSpeedBag() {
      const grp = new THREE.Group()
      // base au sol
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.45, 0.08, 20),
        matChrome
      )
      base.position.y = 0.04
      base.castShadow = true
      grp.add(base)
      // pôle vertical
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.7, 12),
        matChrome
      )
      pole.position.y = 1.4
      grp.add(pole)
      // bras horizontal
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 1.0),
        matChrome
      )
      arm.position.set(0, 2.62, 0.5)
      grp.add(arm)
      // plateforme circulaire
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.06, 28),
        new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6, metalness: 0.5 })
      )
      platform.position.set(0, 2.55, 1.0)
      grp.add(platform)
      // pivot
      const swivel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10),
        matChrome
      )
      swivel.position.set(0, 2.46, 1.0)
      grp.add(swivel)
      // poire
      const bag = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 20, 14),
        matLeatherRed
      )
      bag.scale.set(1, 1.45, 1)
      bag.position.set(0, 2.05, 1.0)
      bag.castShadow = true
      grp.add(bag)
      return grp
    }

    function makeDoubleEndBag(yTop, yBot) {
      const grp = new THREE.Group()
      const ballY = yBot + 4
      const cordMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.8 })
      const cordTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, yTop - ballY, 6),
        cordMat
      )
      cordTop.position.y = (yTop + ballY) / 2
      grp.add(cordTop)
      const cordBot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, ballY - yBot, 6),
        cordMat
      )
      cordBot.position.y = (ballY + yBot) / 2
      grp.add(cordBot)
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 20, 16),
        matLeatherRed
      )
      ball.position.y = ballY
      ball.castShadow = true
      grp.add(ball)
      // anneaux d'attache
      const ringGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16)
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xc4c4c4, metalness: 0.9, roughness: 0.2 })
      const r1 = new THREE.Mesh(ringGeo, ringMat); r1.position.y = ballY + 0.28; grp.add(r1)
      const r2 = new THREE.Mesh(ringGeo, ringMat); r2.position.y = ballY - 0.28; grp.add(r2)
      return grp
    }

    function makeWeightRack() {
      const grp = new THREE.Group()
      const RACK_W = 3.0, RACK_D = 0.7, RACK_H = 1.2
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.4, metalness: 0.85 })
      for (const fy of [0.05, 0.7]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(RACK_W, 0.05, RACK_D), frameMat)
        shelf.position.y = fy
        shelf.castShadow = true
        shelf.receiveShadow = true
        grp.add(shelf)
      }
      for (const sx of [-RACK_W / 2 + 0.05, RACK_W / 2 - 0.05]) {
        for (const sz of [-RACK_D / 2 + 0.05, RACK_D / 2 - 0.05]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, RACK_H, 0.06), frameMat)
          post.position.set(sx, RACK_H / 2, sz)
          grp.add(post)
        }
      }
      function makeDumbbell(weight) {
        const d = new THREE.Group()
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.36, 12),
          matChrome
        )
        handle.rotation.z = Math.PI / 2
        d.add(handle)
        for (const sx of [-0.2, 0.2]) {
          const r = 0.085 + weight * 0.008
          const plate = new THREE.Mesh(
            new THREE.CylinderGeometry(r, r, 0.07, 18),
            new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.5, metalness: 0.4 })
          )
          plate.rotation.z = Math.PI / 2
          plate.position.x = sx
          d.add(plate)
          const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.075, 10),
            new THREE.MeshBasicMaterial({ color: weight < 4 ? 0x00d4ff : 0xff2040 })
          )
          hub.rotation.z = Math.PI / 2
          hub.position.x = sx
          d.add(hub)
        }
        return d
      }
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 4; i++) {
          const w = (row * 4 + i) + 2
          const d = makeDumbbell(w)
          const x = -RACK_W / 2 + 0.45 + i * 0.6
          d.position.set(x, 0.13 + row * 0.65, 0)
          grp.add(d)
        }
      }
      return grp
    }

    function makeWallClock() {
      const grp = new THREE.Group()
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 36),
        new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.6 })
      )
      grp.add(face)
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.05, 14, 36),
        new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.6, roughness: 0.35 })
      )
      grp.add(rim)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const isMain = i % 3 === 0
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(isMain ? 0.06 : 0.03, isMain ? 0.12 : 0.07, 0.012),
          new THREE.MeshStandardMaterial({ color: 0x141416 })
        )
        m.position.set(Math.sin(a) * 0.55, Math.cos(a) * 0.55, 0.012)
        m.rotation.z = -a
        grp.add(m)
      }
      const handMat = new THREE.MeshStandardMaterial({ color: 0xff2040, roughness: 0.5 })
      const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.015), handMat)
      hourHand.position.set(0, 0.18, 0.022)
      grp.add(hourHand)
      const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.55, 0.015), handMat)
      minHand.position.set(0.2, -0.06, 0.027)
      minHand.rotation.z = -1.0
      grp.add(minHand)
      const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12),
        matChrome
      )
      center.rotation.x = Math.PI / 2
      center.position.z = 0.035
      grp.add(center)
      return grp
    }

    function makeMirror(w = 5, h = 4.5) {
      const grp = new THREE.Group()
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.7, roughness: 0.3 })
      )
      grp.add(frame)
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          color: 0x2a3340,
          roughness: 0.05,
          metalness: 1.0,
        })
      )
      glass.position.z = 0.045
      grp.add(glass)
      // léger reflet diagonal pour suggérer la surface vitrée
      const sheenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
      const sheen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, h * 1.4), sheenMat)
      sheen.position.z = 0.05
      sheen.rotation.z = Math.PI / 8
      grp.add(sheen)
      return grp
    }

    function makeJumpRope() {
      const grp = new THREE.Group()
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.4, 0.04, 0.0),
        new THREE.Vector3(-0.2, 0.03, 0.18),
        new THREE.Vector3( 0.0, 0.02, 0.24),
        new THREE.Vector3( 0.2, 0.03, 0.18),
        new THREE.Vector3( 0.4, 0.04, 0.0),
      ])
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 28, 0.014, 6, false),
        new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7 })
      )
      tube.castShadow = true
      grp.add(tube)
      for (const sx of [-1, 1]) {
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.16, 12),
          new THREE.MeshStandardMaterial({ color: 0xff2040, roughness: 0.5 })
        )
        handle.rotation.z = Math.PI / 2
        handle.position.set(sx * 0.48, 0.04, 0)
        grp.add(handle)
      }
      return grp
    }

    // ─── Placements props ─────────────────────────────────────────────────────

    // Speed bags : 2 rigs au sol entre la zone des sacs et le ring
    for (const [sx, sz] of [[-12, -22], [12, -22]]) {
      const sb = makeSpeedBag()
      sb.position.set(sx, -3.5, sz)
      sb.rotation.y = Math.PI // arm pointe vers le ring
      scene.add(sb)
    }

    // Double-end bags : 2 entre les rangées de sacs et le ring
    {
      const deb1 = makeDoubleEndBag(CEIL_Y - 1, -3.45)
      deb1.position.set(-9, 0, -8)
      scene.add(deb1)
      const deb2 = makeDoubleEndBag(CEIL_Y - 1, -3.45)
      deb2.position.set(9, 0, 8)
      scene.add(deb2)
    }

    // Mirrors : 2 grandes paroi miroir sur le mur de gauche, entre les casiers
    for (const mz of [-15, 15]) {
      const mir = makeMirror(7, 4.5)
      mir.position.set(-ROOM / 2 + 0.5, -3.5 + 4, mz)
      mir.rotation.y = Math.PI / 2
      scene.add(mir)
    }

    // Wall clock : sur le mur de droite, en hauteur, centré
    {
      const clk = makeWallClock()
      clk.position.set(ROOM / 2 - 0.3, -3.5 + 14, 0)
      clk.rotation.y = -Math.PI / 2
      scene.add(clk)
    }

    // Weight rack : à l'arrière à droite, près du mur arrière entre les sacs et les casiers
    {
      const rack = makeWeightRack()
      rack.position.set(18, -3.5, -22)
      rack.rotation.y = -Math.PI / 8
      scene.add(rack)
    }

    // Medicine balls : par groupes au sol près du ring
    for (let i = 0; i < 3; i++) {
      const mb = makeMedicineBall(i === 1 ? 0x00d4ff : 0xff2040)
      mb.position.set(-13.5 + i * 0.78, -3.5 + 0.34, 14)
      mb.rotation.y = Math.random() * Math.PI
      scene.add(mb)
    }
    for (let i = 0; i < 2; i++) {
      const mb = makeMedicineBall(i === 0 ? 0x00d4ff : 0xff2040)
      mb.position.set(13 - i * 0.8, -3.5 + 0.34, -13)
      scene.add(mb)
    }

    // Cordes à sauter au sol près des sacs
    for (let i = 0; i < 4; i++) {
      const rope = makeJumpRope()
      const sx = (i % 2 === 0 ? -1 : 1) * (16 - i * 0.4)
      const sz = -2 + (i - 2) * 6 + (Math.random() - 0.5) * 1.5
      rope.position.set(sx, -3.5, sz)
      rope.rotation.y = Math.random() * Math.PI
      scene.add(rope)
    }

    // Items aléatoires sur les bancs (gants, bandes, serviettes, bouteille)
    const BENCH_TOP_Y = -3.5 + 0.57
    const benchSeed = (a, b) => {
      // pseudo-aléatoire stable basé sur position pour éviter qu'un re-render change tout
      const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
      return s - Math.floor(s)
    }
    function placeOnBench(layout, center) {
      const benchCoord = layout.side * (ROOM / 2 - 3.2)
      const isXLong = layout.benchRotY === 0
      const slots = [-1.1, -0.5, 0.1, 0.7, 1.2]
      // chaque slot : on choisit un objet (ou rien)
      for (let i = 0; i < slots.length; i++) {
        const r = benchSeed(center * 7 + i, layout.side * 13 + (layout.varAxis === 'x' ? 1 : 5))
        let mesh = null
        if      (r < 0.20) mesh = makeGloves(r < 0.10 ? 0xb01828 : 0x141416)
        else if (r < 0.35) mesh = makeHandwrap(r < 0.27 ? 0xc02035 : 0x141416)
        else if (r < 0.50) mesh = makeHandwrap(0xeae5d6)
        else if (r < 0.70) mesh = makeTowel(r < 0.60 ? 0xeeeeec : 0x6c7280)
        else if (r < 0.82) mesh = makeBottle()
        // sinon : rien (slot vide)
        if (!mesh) continue
        const off = slots[i]
        const dx = isXLong ? off : 0
        const dz = isXLong ? 0   : off
        mesh.position.set(
          (layout.varAxis === 'x' ? center : benchCoord) + dx,
          BENCH_TOP_Y + 0.05,
          (layout.varAxis === 'z' ? center : benchCoord) + dz,
        )
        mesh.rotation.y = (r - 0.5) * 1.2
        scene.add(mesh)
      }
    }
    for (const layout of wallLayouts) {
      for (const center of BANK_POSITIONS) {
        placeOnBench(layout, center)
      }
    }

    // ─── Items films (GLB sur socle) ──────────────────────────────────────────
    const COLOR_DEFAULT = 0x1a1a3a
    const COLOR_OK      = 0x27ae60
    const COLOR_KO      = 0xc0392b
    const ITEM_SIZE     = 1.4                   // taille visée pour l'auto-fit

    const squares   = []
    const COUNT     = 24
    const PER_WALL  = 6                         // 6 items × 4 murs = 24
    const WALL_DIST = ROOM / 2 - 1.3
    const ITEM_Y    = 0
    const SPAN      = 50
    const STEP      = SPAN / (PER_WALL - 1)

    const GLB_FILES = [
      '4_wooden_man_3december2019.glb',
      'arcade_machine_street_fighter.glb',
      'game_of_death_nunchaku.glb',
      'mortal_kombat_logo.glb',
      'scouter.glb',
      'naruto_headband.glb',
      'tmnt_donatello_fortnite.glb',
      'boxing_glove.glb',
      'kill_bill_-_katana_sgp.glb',
    ]

    const MODEL_ANSWERS = {
      '4_wooden_man_3december2019.glb': 'Ip Man',
      'arcade_machine_street_fighter.glb': 'Street Fighter',
      'game_of_death_nunchaku.glb': 'Game of Death',
      'mortal_kombat_logo.glb': 'Mortal Kombat',
      'scouter.glb': 'Dragon Ball Z',
      'naruto_headband.glb': 'Naruto',
      'tmnt_donatello_fortnite.glb': 'Ninja Turtles',
      'boxing_glove.glb': 'Rocky',
      'kill_bill_-_katana_sgp.glb': 'Kill Bill',
    }

    const WALL_CFG = [
      { varAxis: 'x', fixed: -WALL_DIST, fixAxis: 'z', rotY: 0             },
      { varAxis: 'x', fixed:  WALL_DIST, fixAxis: 'z', rotY: Math.PI       },
      { varAxis: 'z', fixed: -WALL_DIST, fixAxis: 'x', rotY: Math.PI / 2   },
      { varAxis: 'z', fixed:  WALL_DIST, fixAxis: 'x', rotY: -Math.PI / 2  },
    ]

    for (let i = 0; i < COUNT; i++) {
      const cfg   = WALL_CFG[Math.floor(i / PER_WALL)]
      const idx   = i % PER_WALL
      const coord = -SPAN / 2 + idx * STEP

      const pos = new THREE.Vector3(
        cfg.varAxis === 'x' ? coord : cfg.fixed,
        ITEM_Y,
        cfg.varAxis === 'z' ? coord : cfg.fixed,
      )

      // Container Group — c'est LUI qui sert de "square" pour la logique et l'anim
      const container = new THREE.Group()
      container.position.copy(pos)
      container.rotation.y = cfg.rotY

      // Socle coloré (feedback visuel de la réponse)
      const pedestalMat = new THREE.MeshStandardMaterial({
        color: COLOR_DEFAULT,
        roughness: 0.4,
        metalness: 0.3,
        emissive: new THREE.Color(0x0a0a20),
        emissiveIntensity: 0.6,
      })
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.95, 0.15, 24),
        pedestalMat
      )
      pedestal.position.y = -ITEM_SIZE / 2 - 0.08
      pedestal.castShadow = true
      pedestal.receiveShadow = true
      container.add(pedestal)

      // Halo lumineux au-dessus du socle (s'intensifie quand on répond)
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 32), haloMat)
      halo.rotation.x = -Math.PI / 2
      halo.position.y = pedestal.position.y + 0.08
      container.add(halo)

      const glbFile = GLB_FILES[i % GLB_FILES.length]

      container.userData.isSquare   = true
      container.userData.originPos  = pos.clone()
      container.userData.targetPos  = pos.clone()
      container.userData.originRotX = 0
      container.userData.originRotY = cfg.rotY
      container.userData.targetRotX = 0
      container.userData.targetRotY = cfg.rotY
      container.userData.answer     = MODEL_ANSWERS[glbFile]
      container.userData.solved     = false
      container.userData.pedestalMat = pedestalMat
      container.userData.haloMat    = haloMat

      scene.add(container)
      squares.push(container)

      // Chargement async du GLB — l'auto-fit normalise chaque modèle à ITEM_SIZE
      gltfLoader.load(`assets/model/${glbFile}`, (gltf) => {
        const model = gltf.scene
        const box   = new THREE.Box3().setFromObject(model)
        const size  = box.getSize(new THREE.Vector3())
        const maxD  = Math.max(size.x, size.y, size.z) || 1
        model.scale.setScalar(ITEM_SIZE / maxD)
        // re-centre géométriquement, puis pose la base sur le socle
        box.setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.set(-center.x, -box.min.y - ITEM_SIZE / 2, -center.z)
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
        container.add(model)
      })
    }

    // ─── Logique UI card ──────────────────────────────────────────────────────
    let activeSquare  = null
    let feedbackTimer = null

    function getScreenRect(mesh) {
      const pos  = mesh.position.clone().project(camera)
      const hw   = mount.clientWidth  / 2
      const hh   = mount.clientHeight / 2
      const cx   = pos.x *  hw + hw
      const cy   = pos.y * -hh + hh
      const dist = camera.position.distanceTo(mesh.position)
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const worldH = 2 * dist * Math.tan(vFov / 2)
      const px     = (W / worldH) * mount.clientHeight
      return { cx, cy, px }
    }

    function updateCardPosition() {
      if (!activeSquare) return
      const { cx, cy, px } = getScreenRect(activeSquare)
      setCardStyle({
        left:      cx + 'px',
        top:       cy + 'px',
        width:     px + 'px',
        height:    (px * H / W) + 'px',
        transform: 'translate(-50%, -50%)',
      })
    }

    function openSquare(sq) {
      if (activeSquare && activeSquare !== sq) {
        activeSquare.userData.targetPos.copy(activeSquare.userData.originPos)
        activeSquare.userData.targetRotX = activeSquare.userData.originRotX
        activeSquare.userData.targetRotY = activeSquare.userData.originRotY
      }
      clearTimeout(feedbackTimer)
      activeSquare = sq

      playClick()

      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      activeSquare.userData.targetPos.copy(activeSquare.userData.originPos).addScaledVector(forward, -4)

      setFeedbackMsg('')
      setFeedbackType('')
      setCardVisible(true)
      updateCardPosition()
      setTimeout(() => nameInputRef.current?.focus(), 0)
    }

    function closeActive() {
      if (!activeSquare) return
      activeSquare.userData.targetPos.copy(activeSquare.userData.originPos)
      activeSquare.userData.targetRotX = activeSquare.userData.originRotX
      activeSquare.userData.targetRotY = activeSquare.userData.originRotY
      activeSquare = null
      setCardVisible(false)
      setFeedbackMsg('')
      setFeedbackType('')
    }

    function checkAnswer() {
      if (!activeSquare) return
      clearTimeout(feedbackTimer)
      playArcadeConfirm()

      const typed    = nameInputRef.current?.value.trim().toLowerCase() ?? ''
      const expected = activeSquare.userData.answer.toLowerCase()

      if (typed === expected) {
        activeSquare.userData.pedestalMat.color.setHex(COLOR_OK)
        activeSquare.userData.pedestalMat.emissive.setHex(0x0e3a18)
        activeSquare.userData.haloMat.color.setHex(COLOR_OK)
        activeSquare.userData.haloMat.opacity = 0.85
        activeSquare.userData.solved = true
        setFeedbackMsg('Recherche...')
        setFeedbackType('ok')

        const sq = activeSquare
        const query = encodeURIComponent(sq.userData.answer)
        const API_KEY = '66128f961362f8fcafe13e46e1475db1'
        
        playBell()

        fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}&language=fr-FR`)
          .then(res => res.json())
          .then(data => {
            if (data.results && data.results.length > 0) {
              setMovieDetails(data.results[0])
            } else {
              setMovieDetails({ title: sq.userData.answer, overview: 'Détails non trouvés sur TMDB.', vote_average: 'N/A' })
            }
            playWhoosh()
            closeActive()
          })
          .catch(err => {
            console.error('Erreur API TMDB', err)
            closeActive()
          })

      } else {
        if (!activeSquare.userData.solved) {
          activeSquare.userData.pedestalMat.color.setHex(COLOR_KO)
          activeSquare.userData.pedestalMat.emissive.setHex(0x3a0808)
          activeSquare.userData.haloMat.color.setHex(COLOR_KO)
          activeSquare.userData.haloMat.opacity = 0.85
        }
        playBuzzer()
        setFeedbackMsg(`C'était : ${activeSquare.userData.answer}`)
        setFeedbackType('ko')
        const sq = activeSquare
        setTimeout(() => {
          if (!sq.userData.solved) {
            sq.userData.pedestalMat.color.setHex(COLOR_DEFAULT)
            sq.userData.pedestalMat.emissive.setHex(0x0a0a20)
            sq.userData.haloMat.opacity = 0.0
          }
        }, 1800)
        feedbackTimer = setTimeout(closeActive, 1800)
      }
    }

    // Expose pour les événements React
    handlersRef.current = { checkAnswer, closeActive }

    // ─── Regroupement salle de boxe / scène ville ─────────────────────────────
    // Récupère tout ce qui a été ajouté au scene root pour la salle (objets +
    // lumières scéniques) et le déplace dans gymGroup. On laisse uniquement
    // ambient + hemisphere et le sensei à la racine.
    const gymGroup = new THREE.Group()
    const toMoveToGym = scene.children.filter(c =>
      c !== sensei && !c.isAmbientLight && !c.isHemisphereLight
    )
    for (const obj of toMoveToGym) {
      scene.remove(obj)
      gymGroup.add(obj)
    }
    scene.add(gymGroup)

    // Ville
    const cityGroup = new THREE.Group()
    scene.add(cityGroup)

    gltfLoader.load('assets/model/old_gas_station.glb', (gltf) => {
      const city = gltf.scene
      const box = new THREE.Box3().setFromObject(city)
      const size = new THREE.Vector3(); box.getSize(size)
      // Auto-scale : on vise une emprise au sol d'environ 30 unités (station-service plus compacte qu'une ville)
      const targetSpan = 30
      const span = Math.max(size.x, size.z) || 1
      const k = targetSpan / span
      city.scale.setScalar(k)
      // Recentrer + caler le sol à y = -3.5 (même niveau que la salle)
      const box2 = new THREE.Box3().setFromObject(city)
      const center = new THREE.Vector3(); box2.getCenter(center)
      city.position.x -= center.x
      city.position.z -= center.z
      city.position.y -= box2.min.y + 3.5
      cityGroup.add(city)
    })

    // ─── Bascule de mode ──────────────────────────────────────────────────────
    const modeRef = { current: 'city' }
    function setMode(mode) {
      modeRef.current = mode
      cityGroup.visible = mode === 'city'
      gymGroup.visible  = mode === 'gym'
      if (mode === 'city') {
        sensei.position.set(0, -3.5, 5)
        sensei.rotation.y = 0 // dos caméra, face vers le bâtiment (-Z)
        setShowCityHint(true)
        setShowRingModal(false)
      } else {
        sensei.position.set(16, -3.5, 8)
        sensei.rotation.y = Math.atan2(-sensei.position.x, -sensei.position.z) + Math.PI
        setShowCityHint(false)
        setShowRingModal(false)
        playCrowdRoar()
      }
    }
    enterRingRef.current = () => setMode('gym')
    setMode('city')

    // ─── Événements ───────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const pointer   = new THREE.Vector2()
    let isDragging   = false
    let pointerDownPos = { x: 0, y: 0 }

    function onPointerDown(e) {
      if (e.target !== renderer.domElement) return
      isDragging = false
      pointerDownPos = { x: e.clientX, y: e.clientY }
    }

    function onPointerMove(e) {
      if (e.target !== renderer.domElement) return
      const dx = e.clientX - pointerDownPos.x
      const dy = e.clientY - pointerDownPos.y
      if (Math.sqrt(dx*dx + dy*dy) > 4) isDragging = true
    }

    function onPointerUp(e) {
      if (e.target !== renderer.domElement) return
      if (isDragging) return

      pointer.x =  (e.clientX / mount.clientWidth)  * 2 - 1
      pointer.y = -(e.clientY / mount.clientHeight) * 2 + 1

      raycaster.setFromCamera(pointer, camera)

      if (modeRef.current === 'city') {
        const cityHits = raycaster.intersectObject(cityGroup, true)
        if (cityHits.length > 0) {
          setShowCityHint(false)
          setShowRingModal(true)
        }
        return
      }

      const hits = raycaster.intersectObjects(squares, true)
      if (hits.length > 0) {
        // On remonte la hiérarchie jusqu'au container marqué isSquare
        let obj = hits[0].object
        while (obj && !obj.userData.isSquare) obj = obj.parent
        if (obj) openSquare(obj)
        else closeActive()
      } else closeActive()
    }

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }

    // ─── Contrôles clavier du sensei ──────────────────────────────────────────
    const keys = { fwd: false, back: false, left: false, right: false }
    function setKey(e, pressed) {
      if (document.activeElement === nameInputRef.current) return
      if (modeRef.current === 'city') return // sensei figé hors du ring
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': case 'z': case 'Z':
          keys.fwd = pressed; e.preventDefault(); break
        case 'ArrowDown':  case 's': case 'S':
          keys.back = pressed; e.preventDefault(); break
        case 'ArrowLeft':  case 'a': case 'A': case 'q': case 'Q':
          keys.left = pressed; e.preventDefault(); break
        case 'ArrowRight': case 'd': case 'D':
          keys.right = pressed; e.preventDefault(); break
      }
    }
    const onKeyDown = (e) => setKey(e, true)
    const onKeyUp   = (e) => setKey(e, false)

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup',   onPointerUp)
    window.addEventListener('resize',      onResize)
    window.addEventListener('keydown',     onKeyDown)
    window.addEventListener('keyup',       onKeyUp)

    // ─── Boucle ───────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let rafId
    let walkPhase = 0

    const MOVE_SPEED = 0.15
    const ROOM_HALF  = 28

    // Init position caméra initiale
    camera.position.set(sensei.position.x, sensei.position.y + 3, sensei.position.z + 8)
    const previousSenseiPos = new THREE.Vector3().copy(sensei.position)

    function animate() {
      rafId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const delta = clock.getDelta() // Pour le mixer d'animations

      blueLight.intensity = 12 + Math.sin(t * 0.7) * 2
      redLight.intensity  = 14 + Math.sin(t * 0.5 + 1) * 2

      if (mixer) mixer.update(delta)

      // ─ Sensei : déplacement relatif à la caméra
      let moved = false
      if (modeRef.current !== 'city') {
        const moveDir = new THREE.Vector3(0, 0, 0)
        
        // Obtenir la direction de la caméra (sans axe Y)
        const camForward = new THREE.Vector3()
        camera.getWorldDirection(camForward)
        camForward.y = 0
        camForward.normalize()
        
        const camRight = new THREE.Vector3()
        camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize()

        if (keys.fwd)  moveDir.add(camForward)
        if (keys.back) moveDir.sub(camForward)
        if (keys.left) moveDir.sub(camRight)
        if (keys.right) moveDir.add(camRight)

        if (moveDir.length() > 0) {
          moveDir.normalize()
          moved = true
          
          sensei.position.addScaledVector(moveDir, MOVE_SPEED)
          sensei.position.x = THREE.MathUtils.clamp(sensei.position.x, -ROOM_HALF, ROOM_HALF)
          sensei.position.z = THREE.MathUtils.clamp(sensei.position.z, -ROOM_HALF, ROOM_HALF)
          
          // Rotation fluide du personnage (ajout de Math.PI car le modèle est retourné)
          const targetAngle = Math.atan2(moveDir.x, moveDir.z) + Math.PI
          let diff = targetAngle - sensei.rotation.y
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          sensei.rotation.y += diff * 0.15

          playFootstep()
        }
      }

      // ─ Animation GLTF (Fade in/out)
      if (moved) {
        fadeToAction(walkAction, 0.2)
      } else {
        fadeToAction(idleAction, 0.2)
      }

      for (const sq of squares) {
        sq.position.lerp(sq.userData.targetPos, 0.1)
        sq.rotation.x += (sq.userData.targetRotX - sq.rotation.x) * 0.1
        sq.rotation.y += (sq.userData.targetRotY - sq.rotation.y) * 0.1
      }

      // Mise à jour OrbitControls et Camera pour suivre le sensei
      const deltaPos = new THREE.Vector3().subVectors(sensei.position, previousSenseiPos)
      camera.position.add(deltaPos)
      controls.target.copy(sensei.position).add(new THREE.Vector3(0, 1.5, 0))
      controls.update()
      previousSenseiPos.copy(sensei.position)

      if (activeSquare) updateCardPosition()
      drawHUD()
      renderer.render(scene, camera)
    }

    // ─── HUD (canvas 2D : score + minimap) ────────────────────────────────────
    function drawHUD() {
      const c = hudCanvasRef.current
      if (!c) return
      const ctx = c.getContext('2d')
      const W_C = c.width, H_C = c.height

      ctx.clearRect(0, 0, W_C, H_C)

      // Bandeau score
      const solved = squares.filter(s => s.userData.solved).length
      ctx.fillStyle = '#e8d080'
      ctx.font = 'bold 14px "Trebuchet MS", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('FILMS TROUVÉS', W_C / 2, 20)

      ctx.fillStyle = '#fff2d4'
      ctx.font = 'bold 26px "Trebuchet MS", sans-serif'
      ctx.fillText(`${solved} / ${COUNT}`, W_C / 2, 48)

      // Séparateur
      ctx.strokeStyle = 'rgba(232,208,128,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(14, 68); ctx.lineTo(W_C - 14, 68); ctx.stroke()

      // Minimap
      const MAP_PAD = 14
      const MAP_TOP = 78
      const MAP_W   = W_C - MAP_PAD * 2
      const MAP_H   = H_C - MAP_TOP - MAP_PAD
      const SIZE    = Math.min(MAP_W, MAP_H)
      const MAP_X   = (W_C - SIZE) / 2
      const MAP_Y   = MAP_TOP

      const toMap = (wx, wz) => ({
        x: MAP_X + (wx + ROOM / 2) / ROOM * SIZE,
        y: MAP_Y + (wz + ROOM / 2) / ROOM * SIZE,
      })

      // Fond (sol)
      ctx.fillStyle = 'rgba(60,38,20,0.8)'
      ctx.fillRect(MAP_X, MAP_Y, SIZE, SIZE)
      ctx.strokeStyle = '#e8d080'
      ctx.lineWidth = 1.5
      ctx.strokeRect(MAP_X + 0.5, MAP_Y + 0.5, SIZE - 1, SIZE - 1)

      // Ring (carré crème au centre)
      const ringScale = 22 / ROOM * SIZE
      ctx.fillStyle = 'rgba(216,207,184,0.9)'
      ctx.fillRect(MAP_X + SIZE / 2 - ringScale / 2, MAP_Y + SIZE / 2 - ringScale / 2, ringScale, ringScale)
      ctx.strokeStyle = '#cc2030'
      ctx.lineWidth = 1
      ctx.strokeRect(MAP_X + SIZE / 2 - ringScale / 2, MAP_Y + SIZE / 2 - ringScale / 2, ringScale, ringScale)

      // Items (points verts si résolus, beiges sinon)
      for (const sq of squares) {
        const p = toMap(sq.userData.originPos.x, sq.userData.originPos.z)
        ctx.fillStyle = sq.userData.solved ? '#27ae60' : '#c8a050'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Sensei : triangle orienté selon rotation.y
      const s = toMap(sensei.position.x, sensei.position.z)
      ctx.save()
      ctx.translate(s.x, s.y)
      // Forward Three.js = (-sin, -cos). Sur la map, Y descend → on prend -cos inversé
      ctx.rotate(-sensei.rotation.y + Math.PI)
      ctx.fillStyle = '#ff3020'
      ctx.beginPath()
      ctx.moveTo(0, -7)
      ctx.lineTo(5, 5)
      ctx.lineTo(-5, 5)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    // ─── Musique de fond arcade / DBZ ─────────────────────────────────────────
    // Mélodie pentatonique héroïque (inspirée DBZ), générée 100% en Web Audio API
    let bgMusicStarted = false
    let bgMusicGain = null
    let bgSchedulerTimer = null

    function startBackgroundMusic() {
      if (bgMusicStarted) return
      bgMusicStarted = true

      const ctx = getAudioCtx()

      // Master gain — fade-in progressif (discret, ne couvre pas les sons de jeu)
      bgMusicGain = ctx.createGain()
      bgMusicGain.gain.setValueAtTime(0, ctx.currentTime)
      bgMusicGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 4)
      bgMusicGain.connect(ctx.destination)

      // Réverb légère via ConvolverNode synthétique
      const reverbBuf = ctx.createBuffer(2, ctx.sampleRate * 1.5, ctx.sampleRate)
      for (let c = 0; c < 2; c++) {
        const d = reverbBuf.getChannelData(c)
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5)
      }
      const reverb = ctx.createConvolver()
      reverb.buffer = reverbBuf
      const reverbGain = ctx.createGain(); reverbGain.gain.value = 0.22
      reverb.connect(reverbGain); reverbGain.connect(bgMusicGain)

      const BPM  = 126
      const beat = 60 / BPM       // durée d'un temps (s)
      const bar  = beat * 4       // durée d'une mesure (s)

      // Progression harmonique (Am → F → C → E) — feel épique DBZ
      const chords = [
        { root: 110.00, third: 130.81, fifth: 164.81 },  // Am
        {  root: 87.31, third: 110.00, fifth: 130.81 },  // F
        { root: 130.81, third: 164.81, fifth: 196.00 },  // C
        {  root: 82.41, third: 103.83, fifth: 123.47 },  // E
      ]

      // Mélodie pentatonique sol mineur — phrasé montant/descendant héroïque
      const melody = [
        392.00, 466.16, 523.25, 587.33, 659.25,  // montée
        587.33, 523.25, 466.16,                   // descente partielle
        392.00, 440.00, 523.25, 587.33,           // second motif
        659.25, 587.33, 523.25, 392.00,           // résolution
      ]

      let barIndex   = 0
      let melodyPtr  = 0
      let nextTime   = ctx.currentTime + 0.05

      function scheduleBar() {
        const chord = chords[barIndex % chords.length]
        const t     = nextTime

        // ── Pad (cordes/synthé éthéré)
        for (const freq of [chord.root, chord.third, chord.fifth, chord.fifth * 2]) {
          const osc = ctx.createOscillator()
          const g   = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(0.055, t + 0.4)
          g.gain.setValueAtTime(0.055, t + bar - 0.35)
          g.gain.linearRampToValueAtTime(0, t + bar + 0.1)
          osc.connect(g); g.connect(reverb); g.connect(bgMusicGain)
          osc.start(t); osc.stop(t + bar + 0.2)
        }

        // ── Basse (triangle, punch)
        for (const off of [0, beat * 1.5, beat * 2, beat * 3]) {
          const osc = ctx.createOscillator()
          const g   = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(chord.root, t + off)
          osc.frequency.exponentialRampToValueAtTime(chord.root * 0.9, t + off + 0.18)
          g.gain.setValueAtTime(0.32, t + off)
          g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.28)
          osc.connect(g); g.connect(bgMusicGain)
          osc.start(t + off); osc.stop(t + off + 0.32)
        }

        // ── Kick (beats 1 & 3)
        for (const off of [0, beat * 2]) {
          const osc = ctx.createOscillator()
          const g   = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(180, t + off)
          osc.frequency.exponentialRampToValueAtTime(36, t + off + 0.18)
          g.gain.setValueAtTime(0.55, t + off)
          g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.22)
          osc.connect(g); g.connect(bgMusicGain)
          osc.start(t + off); osc.stop(t + off + 0.25)
        }

        // ── Snare (beat 2 & 4)
        for (const off of [beat, beat * 3]) {
          const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
          const src  = ctx.createBufferSource(); src.buffer = buf
          const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1800; filt.Q.value = 0.7
          const g    = ctx.createGain(); g.gain.setValueAtTime(0.18, t + off); g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.1)
          src.connect(filt); filt.connect(g); g.connect(bgMusicGain)
          src.start(t + off)
        }

        // ── Hi-hat (8th notes)
        for (let n = 0; n < 8; n++) {
          const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
          const src  = ctx.createBufferSource(); src.buffer = buf
          const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 9000
          const g    = ctx.createGain()
          const vel  = n % 2 === 0 ? 0.09 : 0.05
          g.gain.setValueAtTime(vel, t + beat * n * 0.5)
          g.gain.exponentialRampToValueAtTime(0.001, t + beat * n * 0.5 + 0.035)
          src.connect(filt); filt.connect(g); g.connect(bgMusicGain)
          src.start(t + beat * n * 0.5)
        }

        // ── Mélodie (carrée, style arcade DBZ)
        for (let n = 0; n < 8; n++) {
          const freq = melody[(melodyPtr + n) % melody.length]
          const osc  = ctx.createOscillator()
          const g    = ctx.createGain()
          osc.type = 'square'
          osc.frequency.value = freq
          // Légère vibrato
          const lfo  = ctx.createOscillator()
          const lfog = ctx.createGain(); lfog.gain.value = 3
          lfo.frequency.value = 5.5
          lfo.connect(lfog); lfog.connect(osc.frequency)
          const noteT = t + beat * n * 0.5
          g.gain.setValueAtTime(0, noteT)
          g.gain.linearRampToValueAtTime(0.06, noteT + 0.015)
          g.gain.setValueAtTime(0.06, noteT + beat * 0.42)
          g.gain.exponentialRampToValueAtTime(0.001, noteT + beat * 0.48)
          osc.connect(g); g.connect(reverb); g.connect(bgMusicGain)
          lfo.start(noteT); osc.start(noteT)
          lfo.stop(noteT + beat * 0.5); osc.stop(noteT + beat * 0.5 + 0.02)
        }
        melodyPtr = (melodyPtr + 8) % melody.length

        nextTime += bar
        barIndex++
        // Re-schedule un beat à l'avance pour éviter les coupures
        bgSchedulerTimer = setTimeout(scheduleBar, (bar - beat * 0.5) * 1000)
      }

      scheduleBar()
    }

    function stopBackgroundMusic() {
      clearTimeout(bgSchedulerTimer)
      if (bgMusicGain) {
        const ctx = getAudioCtx()
        bgMusicGain.gain.setValueAtTime(bgMusicGain.gain.value, ctx.currentTime)
        bgMusicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5)
      }
    }

    // Démarrage dès la première interaction (contourne l'autoplay des navigateurs)
    const onFirstInteraction = () => {
      startBackgroundMusic()
      window.removeEventListener('keydown',     onFirstInteraction)
      window.removeEventListener('pointerdown', onFirstInteraction)
    }
    window.addEventListener('keydown',     onFirstInteraction)
    window.addEventListener('pointerdown', onFirstInteraction)

    animate()

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      stopBackgroundMusic()
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup',   onPointerUp)
      window.removeEventListener('resize',      onResize)
      window.removeEventListener('keydown',     onKeyDown)
      window.removeEventListener('keyup',       onKeyUp)
      window.removeEventListener('keydown',     onFirstInteraction)
      window.removeEventListener('pointerdown', onFirstInteraction)
      controls.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      <div className="hint">
        ZQSD / flèches pour faire courir Maître Sho · clic sur un bloc pour jouer
      </div>

      {showCityHint && !showRingModal && (
        <div className="city-hint">
          Cliquez sur la porte du bâtiment pour entrer
        </div>
      )}

      {showRingModal && (
        <div className="ring-modal-backdrop">
          <div className="ring-modal">
            <div className="ring-modal-title">Le Ring des Reliques</div>
            <div className="ring-modal-body">
              Tu vas rentrer dans le ring des reliques. Très peu de gens sont
              arrivés ici. Tu n'en ressortiras que si tu trouves à quels films
              appartiennent les reliques sacrées.
            </div>
            <button
              className="ring-modal-cta"
              onClick={() => enterRingRef.current()}
            >
              Entrer dans le ring
            </button>
          </div>
        </div>
      )}

      {movieDetails && (
        <div className="movie-modal-backdrop">
          <div className="movie-modal">
            {movieDetails.poster_path && (
              <img 
                src={`https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`} 
                alt={movieDetails.title} 
                className="movie-modal-poster"
              />
            )}
            <div className="movie-modal-info">
              <h2 className="movie-modal-title">{movieDetails.title}</h2>
              <div className="movie-modal-rating">⭐ {movieDetails.vote_average ? Number(movieDetails.vote_average).toFixed(1) : 'N/A'}/10</div>
              <p className="movie-modal-overview">{movieDetails.overview || "Aucun synopsis disponible."}</p>
              <button className="movie-modal-close" onClick={() => setMovieDetails(null)}>
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={hudCanvasRef} className="hud" width={240} height={280} />

      <div className={`card-ui${cardVisible ? ' visible' : ''}`} style={cardStyle}>
        <span className="card-label">tapez un nom</span>
        <input
          ref={nameInputRef}
          type="text"
          placeholder="…"
          autoComplete="off"
          spellCheck="false"
          onKeyDown={(e) => {
            if (e.key === 'Enter')  handlersRef.current.checkAnswer()
            if (e.key === 'Escape') handlersRef.current.closeActive()
          }}
        />
        <div className={`card-feedback${feedbackType ? ` show ${feedbackType}` : ''}`}>
          {feedbackMsg}
        </div>
      </div>
    </div>
  )
}
