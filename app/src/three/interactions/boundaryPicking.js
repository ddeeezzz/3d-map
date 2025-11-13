import * as THREE from "three";
import { logInfo } from "../../logger/logger.js";

const HOVER_COLOR = new THREE.Color("#ffe082");
const HOVER_INTENSITY = 0.5;
const emissiveCache = new WeakMap();

function computePointer(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

function applyHover(mesh) {
  if (!mesh?.material?.emissive) return;
  if (!emissiveCache.has(mesh)) {
    emissiveCache.set(mesh, {
      color: mesh.material.emissive.clone(),
      intensity: mesh.material.emissiveIntensity ?? 0,
    });
  }
  mesh.material.emissive.copy(HOVER_COLOR);
  mesh.material.emissiveIntensity = Math.max(
    mesh.material.emissiveIntensity ?? 0,
    HOVER_INTENSITY,
  );
}

function resetHover(mesh) {
  const cache = emissiveCache.get(mesh);
  if (!cache || !mesh?.material?.emissive) return;
  mesh.material.emissive.copy(cache.color);
  mesh.material.emissiveIntensity = cache.intensity;
  emissiveCache.delete(mesh);
}

export function attachBoundaryPicking({ domElement, camera, boundaryGroup }) {
  if (!domElement || !camera || !boundaryGroup) {
    throw new Error("attachBoundaryPicking 需要 domElement、camera 与 boundaryGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  const clearHover = () => {
    if (!hoveredMesh) return;
    resetHover(hoveredMesh);
    hoveredMesh = null;
  };

  const handlePointerMove = (event) => {
    if (!boundaryGroup.visible) {
      clearHover();
      return;
    }
    computePointer(event, domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(boundaryGroup.children, true);
    const nextMesh = hits.length ? hits[0].object : null;
    if (nextMesh === hoveredMesh) {
      return;
    }
    clearHover();
    if (nextMesh) {
      hoveredMesh = nextMesh;
      applyHover(nextMesh);
    }
  };

  const handleClick = () => {
    if (!boundaryGroup.visible || !hoveredMesh) {
      return;
    }
    const data = hoveredMesh.userData || {};
    const title = data.name ?? data.stableId ?? "未命名围墙";
    logInfo("围墙交互", `点击 ${title}`, {
      stableId: data.stableId,
      boundaryType: data.boundaryType,
    });
  };

  domElement.addEventListener("pointermove", handlePointerMove);
  domElement.addEventListener("click", handleClick);

  const dispose = () => {
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("click", handleClick);
    clearHover();
  };

  return { dispose, clearHover };
}
