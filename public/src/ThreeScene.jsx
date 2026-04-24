import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import './ThreeScene.css'

// ─── Données ──────────────────────────────────────────────────────────────────
const ANSWERS = [
  'Film 1',  'Film 2',  'Film 3',  'Film 4',  'Film 5',  'Film 6',
  'Film 7',  'Film 8',  'Film 9',  'Film 10', 'Film 11', 'Film 12',
  'Film 13', 'Film 14', 'Film 15', 'Film 16', 'Film 17', 'Film 18',
  'Film 19', 'Film 20', 'Film 21', 'Film 22', 'Film 23', 'Film 24',
]

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
  const handlersRef  = useRef({ checkAnswer: () => {}, closeActive: () => {} })

  const [cardVisible,  setCardVisible]  = useState(false)
  const [cardStyle,    setCardStyle]    = useState({})
  const [feedbackMsg,  setFeedbackMsg]  = useState('')
  const [feedbackType, setFeedbackType] = useState('')

  useEffect(() => {
    const mount = mountRef.current

    // ─── Scène ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    // ÉTAPE 1 : ambiance salle de boxe — fond sombre + brume dorée légère
    scene.background = new THREE.Color(0x0c0806)
    scene.fog = new THREE.FogExp2(0x140a06, 0.022)

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 3, 14)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    mount.appendChild(renderer.domElement)

    // ─── Follow cam (désactive l'orbite) ──────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enabled = false

    // ─── Lumières ─────────────────────────────────────────────────────────────
    // Lumière d'ambiance gym (teinte chaude, plus forte)
    scene.add(new THREE.AmbientLight(0xfff0d0, 3.2))

    // Lumière hémisphérique : ciel/plafond chaud vers sol plus sombre
    scene.add(new THREE.HemisphereLight(0xfff2d4, 0x1a120a, 1.2))

    // Projecteur central sur le ring
    const keyLight = new THREE.SpotLight(0xfff1d0, 90, 30, Math.PI / 4, 0.45)
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


    const donatello  = new THREE.Group()
    scene.add(donatello)
    gltfLoader.load('assets/model/tmnt_donatello_fortnite.glb', (gltf) => {
      const model = gltf.scene
      model.scale.set(2.5, 2.5, 2.5)
      donatello.add(model)
    })

      const naruto  = new THREE.Group()
    scene.add(naruto)
    gltfLoader.load('assets/model/naruto_headband.glb', (gltf) => {
      const model = gltf.scene
      model.scale.set(3.5, 3.5, 3.5)
      naruto.add(model)
    })

    // ─── Sensei contrôlable (primitives) ──────────────────────────────────────
    const sensei = new THREE.Group()

    const giMat   = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.85 })
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.7 })
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.95 })

    // Jambes (pivot au hip pour animer la marche)
    function makeLeg(sideX) {
      const grp = new THREE.Group()
      const g   = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 10)
      g.translate(0, -0.45, 0)
      grp.add(new THREE.Mesh(g, darkMat))
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.36), darkMat)
      foot.position.set(0, -0.95, 0.08)
      grp.add(foot)
      grp.position.set(sideX, 0.9, 0)
      return grp
    }
    const leftLeg  = makeLeg(-0.18)
    const rightLeg = makeLeg( 0.18)
    sensei.add(leftLeg, rightLeg)

    // Torse kimono
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.58, 1.1, 16), giMat
    )
    torso.position.y = 1.55
    sensei.add(torso)

    // Col en V (deux bandes noires)
    for (const s of [-1, 1]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.04), darkMat)
      collar.position.set(0.12 * s, 1.72, 0.47)
      collar.rotation.z = 0.22 * s * -1
      sensei.add(collar)
    }

    // Ceinture noire
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.18, 18), darkMat
    )
    belt.position.y = 1.1
    sensei.add(belt)

    // Bras (pivot à l'épaule)
    function makeArm(sideX) {
      const grp = new THREE.Group()
      const g   = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 10)
      g.translate(0, -0.5, 0)
      grp.add(new THREE.Mesh(g, giMat))
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), skinMat)
      hand.position.y = -1.05
      grp.add(hand)
      grp.position.set(sideX, 2.0, 0)
      return grp
    }
    const leftArm  = makeArm(-0.6)
    const rightArm = makeArm( 0.6)
    sensei.add(leftArm, rightArm)

    // Cou + tête
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.22, 10), skinMat
    )
    neck.position.y = 2.2
    sensei.add(neck)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 16), skinMat)
    head.position.y = 2.55
    sensei.add(head)

    // Yeux
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101010 })
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat)
      eye.position.set(ex, 2.6, 0.3)
      sensei.add(eye)
    }
    // Sourcils blancs broussailleux
    for (const ex of [-0.11, 0.11]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.07), hairMat)
      brow.position.set(ex, 2.68, 0.28)
      sensei.add(brow)
    }
    // Moustache
    const moust = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.1), hairMat)
    moust.position.set(0, 2.48, 0.3)
    sensei.add(moust)
    // Longue barbe blanche
    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.8, 16), hairMat
    )
    beard.position.set(0, 2.1, 0.2)
    beard.rotation.x = Math.PI
    sensei.add(beard)
    // Couronne de cheveux (chauve sur le dessus)
    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.09, 10, 24), hairMat
    )
    crown.rotation.x = Math.PI / 2
    crown.position.set(0, 2.58, 0)
    sensei.add(crown)
    // Petit chignon
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), hairMat)
    bun.position.set(0, 2.82, -0.05)
    sensei.add(bun)

    // Canne de bambou
    const cane = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 2.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.85 })
    )
    cane.position.set(0.78, 1.05, 0.2)
    sensei.add(cane)

    // Ombres sur toutes les parties
    sensei.traverse(o => { if (o.isMesh) o.castShadow = true })

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

    // ─── Lumières d'ambiance (coins du ring) ──────────────────────────────────
    const blueLight = new THREE.PointLight(0x3355aa, 12, 22)
    blueLight.position.set(-10, 6, -10)
    scene.add(blueLight)

    const redLight = new THREE.PointLight(0xff3020, 14, 22)
    redLight.position.set(10, 6, 10)
    scene.add(redLight)

    // ─── Sol ──────────────────────────────────────────────────────────────────
    // ÉTAPE 2 : parquet de salle d'entraînement
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({
        color: 0x3a2515,
        roughness: 0.85,
        metalness: 0.05,
      })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -3.5
    floor.receiveShadow = true
    scene.add(floor)

    // Lattes du parquet (lignes foncées répétées)
    const plankGroup = new THREE.Group()
    const PLANK_COUNT = 30
    const PLANK_W = 60 / PLANK_COUNT
    for (let i = 0; i < PLANK_COUNT; i++) {
      const plank = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, 60),
        new THREE.MeshBasicMaterial({ color: 0x1a0f08 })
      )
      plank.rotation.x = -Math.PI / 2
      plank.position.set(-30 + i * PLANK_W, -3.49, 0)
      plankGroup.add(plank)
    }
    scene.add(plankGroup)

    // ─── ÉTAPE 3 : Murs et plafond ────────────────────────────────────────────
    const ROOM = 60
    const WALL_H = 22
    const WALL_Y = -3.5 + WALL_H / 2

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1a,
      roughness: 0.95,
      metalness: 0.02,
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

    // Bande de soubassement (plinthe plus sombre)
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 1 })
    const baseH = 1.2
    for (const { pos, rot } of walls) {
      const base = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, baseH), baseMat)
      base.position.set(pos[0], -3.5 + baseH / 2, pos[2])
      base.rotation.set(...rot)
      scene.add(base)
    }

    // Plafond sombre
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM, ROOM),
      new THREE.MeshStandardMaterial({ color: 0x080503, roughness: 1 })
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = -3.5 + WALL_H
    scene.add(ceiling)

    // ─── ÉTAPE 4 : Plateforme du ring ─────────────────────────────────────────
    const RING_SIZE  = 22          // grand ring pour englober la scène
    const RING_Y_BOT = -3.5        // niveau du sol
    const PLAT_H     = 0.8         // épaisseur plateforme
    const RING_TOP   = RING_Y_BOT + PLAT_H

    // Toile du ring (blanche / crème)
    const ringCanvas = new THREE.Mesh(
      new THREE.BoxGeometry(RING_SIZE, PLAT_H, RING_SIZE),
      new THREE.MeshStandardMaterial({
        color: 0xd8cfb8,
        roughness: 0.92,
        metalness: 0.02,
      })
    )
    ringCanvas.position.set(0, RING_Y_BOT + PLAT_H / 2, 0)
    ringCanvas.receiveShadow = true
    ringCanvas.castShadow    = true
    scene.add(ringCanvas)

    // Jupe rouge qui pend sous la toile
    const SKIRT_H = 1.4
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x8b0f1a,
      roughness: 0.75,
      metalness: 0.05,
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

    // Liseré or au bord supérieur de la toile
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc8a050,
      roughness: 0.4,
      metalness: 0.7,
    })
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(RING_SIZE + 0.1, 0.12, RING_SIZE + 0.1),
      trimMat
    )
    trim.position.set(0, RING_TOP + 0.01, 0)
    scene.add(trim)

    // ─── ÉTAPE 5 : Poteaux du ring ────────────────────────────────────────────
    const POST_H     = 6
    const POST_OFF   = RING_SIZE / 2 - 0.5
    const POST_Y_BOT = RING_TOP
    const POST_COLORS = [0x8b0f1a, 0x1e3f8a, 0x1e3f8a, 0x8b0f1a] // 2 rouges + 2 bleus

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
    const ROPE_COLORS = [0xe8dfc8, 0xcc2030, 0x1a3a8a, 0xe8dfc8] // blanche, rouge, bleue, blanche
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

    function addPunchingBag(x, z, color = 0x1a0a08) {
      // chaîne
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, CEIL_Y - 2, 6),
        new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.35, metalness: 0.9 })
      )
      chain.position.set(x, (CEIL_Y + 2) / 2, z)
      scene.add(chain)

      // sac
      const bag = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 3.2, 20),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.25 })
      )
      bag.position.set(x, 0.4, z)
      bag.castShadow = true
      scene.add(bag)

      // cerclage au milieu du sac
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.05, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.set(x, 0.4, z)
      scene.add(ring)
    }

    // Rangée de sacs derrière le ring
    const BAG_X = RING_SIZE / 2 + 4
    addPunchingBag(-BAG_X, -10, 0x200a08)
    addPunchingBag(-BAG_X,  -4, 0x10141a)
    addPunchingBag(-BAG_X,   4, 0x200a08)
    addPunchingBag(-BAG_X,  10, 0x10141a)
    addPunchingBag( BAG_X, -10, 0x10141a)
    addPunchingBag( BAG_X,  -4, 0x200a08)
    addPunchingBag( BAG_X,   4, 0x10141a)
    addPunchingBag( BAG_X,  10, 0x200a08)

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
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6 })
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

      const pt = new THREE.PointLight(0xfff1d6, 18, 28, 1.8)
      pt.position.set(x, CEIL_Y - 0.3, z)
      // pas d'ombres (castShadow reste false par défaut)
      scene.add(pt)
    }

    // Bannière "BOXING" au-dessus du mur du fond
    const bannerCanvas = document.createElement('canvas')
    bannerCanvas.width = 1024
    bannerCanvas.height = 256
    const bctx = bannerCanvas.getContext('2d')
    bctx.fillStyle = '#8b0f1a'
    bctx.fillRect(0, 0, 1024, 256)
    bctx.fillStyle = '#e8d080'
    bctx.font = 'bold 150px Impact, sans-serif'
    bctx.textAlign = 'center'
    bctx.textBaseline = 'middle'
    bctx.fillText('BOXING CLUB', 512, 128)
    const bannerTex = new THREE.CanvasTexture(bannerCanvas)
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.8 })
    )
    banner.position.set(0, 12, -ROOM / 2 + 0.05)
    scene.add(banner)

    // ─── Blocs (cartes films) ─────────────────────────────────────────────────
    const DEPTH     = 1.2
    const COLOR_DEFAULT = 0x1a1a3a
    const COLOR_OK      = 0x27ae60
    const COLOR_KO      = 0xc0392b

    const squares   = []
    const COUNT     = 24
    const PER_WALL  = 6                         // 6 blocs × 4 murs = 24
    const WALL_DIST = ROOM / 2 - 1.2            // distance du mur (ROOM = 60)
    const BLOCK_Y   = 0                         // hauteur uniforme (face caméra de Sho)
    const SPAN      = 50                        // plage -25..25 le long de chaque mur
    const STEP      = SPAN / (PER_WALL - 1)

    // Config par mur : axe variable, côté fixe, rotation Y pour regarder le centre
    const WALL_CFG = [
      { varAxis: 'x', fixed: -WALL_DIST, fixAxis: 'z', rotY: 0             }, // mur arrière
      { varAxis: 'x', fixed:  WALL_DIST, fixAxis: 'z', rotY: Math.PI       }, // mur avant
      { varAxis: 'z', fixed: -WALL_DIST, fixAxis: 'x', rotY: Math.PI / 2   }, // mur gauche
      { varAxis: 'z', fixed:  WALL_DIST, fixAxis: 'x', rotY: -Math.PI / 2  }, // mur droit
    ]

    for (let i = 0; i < COUNT; i++) {
      const cfg  = WALL_CFG[Math.floor(i / PER_WALL)]
      const idx  = i % PER_WALL
      const coord = -SPAN / 2 + idx * STEP

      const pos = new THREE.Vector3(
        cfg.varAxis === 'x' ? coord : cfg.fixed,
        BLOCK_Y,
        cfg.varAxis === 'z' ? coord : cfg.fixed,
      )

      const faceMat = new THREE.MeshStandardMaterial({
        color: COLOR_DEFAULT,
        roughness: 0.35,
        metalness: 0.25,
        emissive: new THREE.Color(0x0a0a20),
        emissiveIntensity: 0.5,
      })
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 0.7, metalness: 0.1 })
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(W, H, DEPTH),
        [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]
      )
      mesh.castShadow    = true
      mesh.receiveShadow = true
      mesh.rotation.y    = cfg.rotY

      mesh.position.copy(pos)
      mesh.userData.originPos  = pos.clone()
      mesh.userData.targetPos  = pos.clone()
      mesh.userData.originRotX = 0
      mesh.userData.originRotY = cfg.rotY
      mesh.userData.targetRotX = 0
      mesh.userData.targetRotY = cfg.rotY
      mesh.userData.answer     = ANSWERS[i] ?? `Film ${i + 1}`
      mesh.userData.solved     = false
      mesh.userData.faceMat    = faceMat

      scene.add(mesh)
      squares.push(mesh)
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

      const typed    = nameInputRef.current?.value.trim().toLowerCase() ?? ''
      const expected = activeSquare.userData.answer.toLowerCase()

      if (typed === expected) {
        activeSquare.userData.faceMat.color.setHex(COLOR_OK)
        activeSquare.userData.faceMat.emissive.setHex(0x0a2a0a)
        activeSquare.userData.solved = true
        setFeedbackMsg('Correct !')
        setFeedbackType('ok')
      } else {
        if (!activeSquare.userData.solved) {
          activeSquare.userData.faceMat.color.setHex(COLOR_KO)
          activeSquare.userData.faceMat.emissive.setHex(0x1a0505)
        }
        setFeedbackMsg(`C'était : ${activeSquare.userData.answer}`)
        setFeedbackType('ko')
        const sq = activeSquare
        setTimeout(() => {
          if (!sq.userData.solved) {
            sq.userData.faceMat.color.setHex(COLOR_DEFAULT)
            sq.userData.faceMat.emissive.setHex(0x0a0a20)
          }
        }, 1800)
      }

      feedbackTimer = setTimeout(closeActive, 1800)
    }

    // Expose pour les événements React
    handlersRef.current = { checkAnswer, closeActive }

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
      const hits = raycaster.intersectObjects(squares)
      if (hits.length > 0) openSquare(hits[0].object)
      else closeActive()
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

    const MOVE_SPEED = 0.22
    const TURN_SPEED = 0.055
    const ROOM_HALF  = 28

    // Follow cam (au-dessus et légèrement derrière le sensei)
    const CAM_DIST   = 7
    const CAM_HEIGHT = 5.5
    const camTargetPos  = new THREE.Vector3()
    const camLookTarget = new THREE.Vector3()
    const lookedAt      = new THREE.Vector3()
    // init immédiat pour éviter un flash au 1er frame
    camTargetPos.set(
      sensei.position.x + Math.sin(sensei.rotation.y) * CAM_DIST,
      sensei.position.y + CAM_HEIGHT,
      sensei.position.z + Math.cos(sensei.rotation.y) * CAM_DIST,
    )
    camera.position.copy(camTargetPos)
    lookedAt.copy(sensei.position).add(new THREE.Vector3(0, 1.8, 0))
    camera.lookAt(lookedAt)

    function animate() {
      rafId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      blueLight.intensity = 12 + Math.sin(t * 0.7) * 2
      redLight.intensity  = 14 + Math.sin(t * 0.5 + 1) * 2

      // ─ Sensei : rotation + déplacement
      if (keys.left)  sensei.rotation.y += TURN_SPEED
      if (keys.right) sensei.rotation.y -= TURN_SPEED

      let moved = false
      if (keys.fwd || keys.back) {
        const dir = keys.fwd ? 1 : -1
        const nx = sensei.position.x - Math.sin(sensei.rotation.y) * MOVE_SPEED * dir
        const nz = sensei.position.z - Math.cos(sensei.rotation.y) * MOVE_SPEED * dir
        sensei.position.x = THREE.MathUtils.clamp(nx, -ROOM_HALF, ROOM_HALF)
        sensei.position.z = THREE.MathUtils.clamp(nz, -ROOM_HALF, ROOM_HALF)
        moved = true
      }

      // ─ Animation de course
      if (moved) {
        walkPhase += 0.38
        const swing = Math.sin(walkPhase) * 0.9
        leftLeg.rotation.x  =  swing
        rightLeg.rotation.x = -swing
        leftArm.rotation.x  = -swing * 0.8
        rightArm.rotation.x =  swing * 0.8
        // rebond plus marqué
        sensei.position.y = -3.5 + Math.abs(Math.sin(walkPhase * 2)) * 0.14
      } else {
        // retour progressif à la pose neutre
        leftLeg.rotation.x  *= 0.85
        rightLeg.rotation.x *= 0.85
        leftArm.rotation.x  *= 0.85
        rightArm.rotation.x *= 0.85
        sensei.position.y += (-3.5 - sensei.position.y) * 0.2
      }

      for (const sq of squares) {
        sq.position.lerp(sq.userData.targetPos, 0.1)
        sq.rotation.x += (sq.userData.targetRotX - sq.rotation.x) * 0.1
        sq.rotation.y += (sq.userData.targetRotY - sq.rotation.y) * 0.1
      }

      // Follow cam : suit le sensei avec un lissage
      camTargetPos.set(
        sensei.position.x + Math.sin(sensei.rotation.y) * CAM_DIST,
        sensei.position.y + CAM_HEIGHT,
        sensei.position.z + Math.cos(sensei.rotation.y) * CAM_DIST,
      )
      camera.position.lerp(camTargetPos, 0.12)
      camLookTarget.copy(sensei.position).add(new THREE.Vector3(0, 1.8, 0))
      lookedAt.lerp(camLookTarget, 0.18)
      camera.lookAt(lookedAt)

      if (activeSquare) updateCardPosition()
      renderer.render(scene, camera)
    }

    animate()

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup',   onPointerUp)
      window.removeEventListener('resize',      onResize)
      window.removeEventListener('keydown',     onKeyDown)
      window.removeEventListener('keyup',       onKeyUp)
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
