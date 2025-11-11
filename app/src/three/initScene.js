import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function initScene(container) {
  if (!container) {
    throw new Error("必须提供容器节点以挂载 Three.js 场景");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f172a");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  camera.position.set(0, 400, 700);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 50;
  controls.maxDistance = 2500;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(300, 600, 200);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  const resize = () => {
    const width = container.clientWidth || window.innerWidth || 1;
    const height = container.clientHeight || window.innerHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  };

  const render = () => {
    controls.update();
    renderer.render(scene, camera);
  };

  let animationId = null;
  const start = () => {
    if (animationId) return;
    const loop = () => {
      render();
      animationId = window.requestAnimationFrame(loop);
    };
    loop();
  };

  const stop = () => {
    if (animationId) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  resize();

  return {
    scene,
    camera,
    renderer,
    controls,
    resize,
    render,
    start,
    stop,
  };
}
