const textureRoot = 'https://threejs.org/examples/textures/planets/';
const bodies = [
  ['Sun', 0, 0.82, null, '#f3b45e', 0],
  ['Mercury', 2.5, .055, 'moon_1024.jpg', '#9b9a94', 88],
  ['Venus', 3.6, .09, 'earth_atmos_2048.jpg', '#d2a266', 225],
  ['Earth', 4.8, .1, 'earth_atmos_2048.jpg', '#5aaac3', 365],
  ['Mars', 6.2, .075, 'mars_1k_color.jpg', '#ad5c4c', 687],
  ['Jupiter', 8.6, .38, 'jupiter.jpg', '#c79a73', 4333],
  ['Saturn', 11.2, .32, 'saturn.jpg', '#cdb481', 10759],
  ['Uranus', 13.5, .22, 'uranus.jpg', '#82c8ca', 30687],
  ['Neptune', 15.6, .21, 'neptune.jpg', '#416bb0', 60190],
  ['Pluto', 17.6, .04, 'moon_1024.jpg', '#b69f8d', 90560]
];
const moonData = [['Moon', 'Earth', .19, 'moon_1024.jpg'], ['Io', 'Jupiter', .08, 'jupiter.jpg'], ['Europa', 'Jupiter', .105, 'moon_1024.jpg'], ['Ganymede', 'Jupiter', .14, 'moon_1024.jpg'], ['Titan', 'Saturn', .12, 'moon_1024.jpg'], ['Enceladus', 'Saturn', .06, 'moon_1024.jpg']];
let sceneState = null;

function initSolar3D() {
  const mount = document.querySelector('#solar-3d');
  if (!mount || mount.dataset.ready) return;
  mount.dataset.ready = 'true';
  const canvas = document.createElement('canvas');
  const labelLayer = document.createElement('div');
  labelLayer.className = 'solar3d-label-layer';
  mount.querySelector('.solar3d-viewport').append(canvas, labelLayer);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.querySelector('.solar3d-viewport').clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const world = new THREE.Scene();
  world.background = new THREE.Color('#010205');
  world.fog = new THREE.FogExp2('#010205', .008);
  const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.querySelector('.solar3d-viewport').clientHeight, .01, 400);
  camera.position.set(17, 12, 23);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .06;
  controls.minDistance = 1.1;
  controls.maxDistance = 90;
  controls.target.set(0, 0, 0);
  const ambient = new THREE.HemisphereLight('#b5c8ff', '#050609', .22);
  world.add(ambient);
  const sunlight = new THREE.PointLight('#fff4d6', 5.6, 0, 1.6);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  world.add(sunlight);
  addStars(world);
  const loader = new THREE.TextureLoader();
  const meshMap = new Map();
  const orbitGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  world.add(orbitGroup, bodyGroup);
  const labelData = [];
  bodies.forEach(([name, distance, radius, texture, tint, period]) => {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = name === 'Sun' ? new THREE.MeshBasicMaterial({ color: '#f7bd67', map: load(loader, texture), toneMapped: false }) : new THREE.MeshStandardMaterial({ color: tint, map: load(loader, texture), roughness: name === 'Earth' ? .72 : .88, metalness: 0, bumpMap: load(loader, texture), bumpScale: .018 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.x = distance;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bodyGroup.add(mesh);
    meshMap.set(name, mesh);
    if (name === 'Sun') {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.16, 48, 48), new THREE.MeshBasicMaterial({ color: '#f5a84d', transparent: true, opacity: .13, side: THREE.BackSide }));
      mesh.add(glow);
    }
    if (name === 'Earth') {
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 48, 48), new THREE.MeshPhongMaterial({ color: '#58b9e0', transparent: true, opacity: .17, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
      atmosphere.name = 'atmosphere';
      mesh.add(atmosphere);
    }
    if (name === 'Saturn') addRings(mesh, radius);
    if (name === 'Uranus') addRings(mesh, radius * .9);
    if (name !== 'Sun') addOrbit(orbitGroup, distance);
    const label = document.createElement('button');
    label.className = 'solar3d-label';
    label.textContent = name;
    label.dataset.body = name;
    label.addEventListener('click', () => focusBody(name));
    labelLayer.appendChild(label);
    labelData.push({ label, mesh });
  });
  moonData.forEach(([name, parent, radius, texture]) => {
    const parentMesh = meshMap.get(parent);
    if (!parentMesh) return;
    const moon = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 40), new THREE.MeshStandardMaterial({ color: '#aaa9a3', map: load(loader, texture), roughness: .95 }));
    moon.name = name;
    moon.position.set(parentMesh.geometry.parameters.radius * 2.2, .1, parentMesh.geometry.parameters.radius * 1.3);
    parentMesh.add(moon);
  });
  addAsteroidBelt(world);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected = 'Earth';
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(bodyGroup.children, true).filter(hit => hit.object.name && meshMap.has(hit.object.name));
    if (hits[0]) focusBody(hits[0].object.name);
  }
  canvas.addEventListener('click', pick);
  canvas.addEventListener('dblclick', pick);
  mount.querySelectorAll('[data-3d-scale]').forEach(button => button.addEventListener('click', () => {
    mount.querySelectorAll('[data-3d-scale]').forEach(item => item.classList.toggle('active', item === button));
    const realistic = button.dataset['3dScale'] === 'realistic';
    bodyGroup.userData.distanceFactor = realistic ? 1.2 : 1;
    bodies.forEach(([name, distance]) => { if (meshMap.has(name)) meshMap.get(name).position.x = distance * bodyGroup.userData.distanceFactor; });
    mount.querySelector('.solar3d-mode').textContent = realistic ? 'Distance spacing expanded · planetary sizes enhanced' : 'Educational spacing · true planetary proportions enhanced';
  }));
  mount.querySelectorAll('[data-3d-view]').forEach(button => button.addEventListener('click', () => {
    mount.querySelectorAll('[data-3d-view]').forEach(item => item.classList.toggle('active', item === button));
    const vertical = button.dataset['3dView'] === 'vertical';
    camera.position.set(vertical ? 2 : 17, vertical ? 22 : 12, vertical ? 16 : 23);
  }));
  mount.querySelector('[data-3d-paths]').addEventListener('click', event => { event.currentTarget.classList.toggle('active'); orbitGroup.visible = event.currentTarget.classList.contains('active'); });
  mount.querySelector('[data-3d-labels]').addEventListener('click', event => { event.currentTarget.classList.toggle('active'); labelLayer.classList.toggle('hidden', !event.currentTarget.classList.contains('active')); });
  mount.querySelector('[data-3d-atmosphere]').addEventListener('click', event => { event.currentTarget.classList.toggle('active'); const atmosphere = meshMap.get('Earth')?.getObjectByName('atmosphere'); if (atmosphere) atmosphere.visible = event.currentTarget.classList.contains('active'); });
  mount.querySelector('[data-3d-focus]').addEventListener('click', () => focusBody(selected));
  function focusBody(name) { selected = name; const mesh = meshMap.get(name); if (!mesh) return; document.querySelector('.solar3d-status').textContent = `${name} selected · drag to orbit · scroll to zoom`; const target = new THREE.Vector3(); mesh.getWorldPosition(target); controls.target.copy(target); camera.position.copy(target).add(new THREE.Vector3(1.7, 1.1, 2.4).multiplyScalar(Math.max(mesh.geometry.parameters.radius * 5, 1))); }
  function animate() { requestAnimationFrame(animate); bodyGroup.children.forEach(mesh => { mesh.rotation.y += mesh.name === 'Sun' ? .0018 : .0032; }); controls.update(); labelData.forEach(({ label, mesh }) => { const position = new THREE.Vector3(); mesh.getWorldPosition(position); position.project(camera); label.style.transform = `translate(${(position.x * .5 + .5) * mount.clientWidth}px,${(-position.y * .5 + .5) * mount.querySelector('.solar3d-viewport').clientHeight}px)`; label.style.display = position.z > 1 ? 'none' : ''; }); renderer.render(world, camera); }
  new ResizeObserver(() => { const viewport = mount.querySelector('.solar3d-viewport'); renderer.setSize(viewport.clientWidth, viewport.clientHeight); camera.aspect = viewport.clientWidth / viewport.clientHeight; camera.updateProjectionMatrix(); }).observe(mount.querySelector('.solar3d-viewport'));
  sceneState = { renderer, world, camera, controls, focusBody };
  mount.querySelector('[data-3d-paths]').classList.add('active');
  mount.querySelector('[data-3d-labels]').classList.add('active');
  mount.querySelector('[data-3d-atmosphere]').classList.add('active');
  focusBody('Earth');
  animate();
}
function load(loader, file) { if (!file) return null; const fallback = ['mars_1k_color.jpg', 'jupiter.jpg', 'saturn.jpg', 'uranus.jpg', 'neptune.jpg'].includes(file) ? 'earth_atmos_2048.jpg' : file; const texture = loader.load(`${textureRoot}${fallback}`); if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; return texture; }
function addOrbit(group, radius) { const points = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); } group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#425269', transparent: true, opacity: .42 }))); }
function addRings(parent, radius) { const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.25, radius * 2.1, 128), new THREE.MeshBasicMaterial({ color: '#b7a47d', side: THREE.DoubleSide, transparent: true, opacity: .62 })); ring.rotation.x = Math.PI / 2.3; parent.add(ring); }
function addStars(world) { const count = 6500; const positions = new Float32Array(count * 3); for (let i = 0; i < count * 3; i += 3) { const radius = 80 + Math.random() * 120; const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); positions[i] = radius * Math.sin(phi) * Math.cos(theta); positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta); positions[i + 2] = radius * Math.cos(phi); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); world.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#e8edf7', size: .16, sizeAttenuation: true, transparent: true, opacity: .82 }))); }
function addAsteroidBelt(world) { const positions = []; for (let i = 0; i < 850; i++) { const radius = 7.1 + Math.random() * 1.1; const angle = Math.random() * Math.PI * 2; positions.push(Math.cos(angle) * radius, (Math.random() - .5) * .16, Math.sin(angle) * radius); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); world.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#958777', size: .035, transparent: true, opacity: .76 }))); }
window.initSolar3D = initSolar3D;
if (document.querySelector('#solar-3d')) initSolar3D();
