import * as THREE from "three";

const HOVER_EMISSIVE_COLOR = new THREE.Color("#ffffff");
const HOVER_EMISSIVE_INTENSITY = 0.4;

function computePointerPosition(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

function enableHover(mesh) {
  if (mesh?.material?.emissive) {
    mesh.material.emissive.copy(HOVER_EMISSIVE_COLOR);
    mesh.material.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
  }
}

function disableHover(mesh) {
  if (mesh?.material?.emissive) {
    mesh.material.emissiveIntensity = 0;
  }
}

function pickRoadMesh(raycaster, pointer, camera, roadsGroup) {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(roadsGroup.children, true);
  if (!hits.length) {
    return null;
  }
  return hits[0].object;
}

export function attachRoadPicking({
  domElement,
  camera,
  roadsGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !roadsGroup) {
    throw new Error("attachRoadPicking 需要 domElement、camera 和 roadsGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  const clearHover = () => {
    if (!hoveredMesh) return;
    disableHover(hoveredMesh);
    hoveredMesh = null;
    onHover?.(null);
  };

  const handlePointerMove = (event) => {
    if (!roadsGroup.visible) {
      clearHover();
      return;
    }

    computePointerPosition(event, domElement, pointer);
    const mesh = pickRoadMesh(raycaster, pointer, camera, roadsGroup);

    if (mesh === hoveredMesh) {
      return;
    }

    clearHover();

    if (mesh) {
      hoveredMesh = mesh;
      enableHover(mesh);
      onHover?.(mesh.userData || null);
    }
  };

  const handleClick = () => {
    if (!roadsGroup.visible || !hoveredMesh) {
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
