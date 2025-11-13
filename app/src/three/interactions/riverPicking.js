import * as THREE from "three";

const HOVER_COLOR = new THREE.Color("#5ad0ff");
const HOVER_INTENSITY = 0.5;

function computePointer(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

function highlightMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissive.copy(HOVER_COLOR);
  mesh.material.emissiveIntensity = HOVER_INTENSITY;
}

function resetMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissiveIntensity = 0;
}

export function attachRiverPicking({
  domElement,
  camera,
  riverGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !riverGroup) {
    throw new Error("attachRiverPicking 需要 domElement、camera 与 riverGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  const clearHover = () => {
    if (!hoveredMesh) return;
    resetMesh(hoveredMesh);
    hoveredMesh = null;
    onHover?.(null);
  };

  const handlePointerMove = (event) => {
    if (!riverGroup.visible) {
      clearHover();
      return;
    }

    computePointer(event, domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(riverGroup.children, true);
    const nextMesh = hits.length ? hits[0].object : null;

    if (nextMesh === hoveredMesh) {
      return;
    }

    clearHover();

    if (nextMesh) {
      hoveredMesh = nextMesh;
      highlightMesh(nextMesh);
      onHover?.(nextMesh.userData || null);
    }
  };

  const handleClick = () => {
    if (!riverGroup.visible || !hoveredMesh) {
      return;
    }
    onSelect?.(hoveredMesh.userData || null);
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
