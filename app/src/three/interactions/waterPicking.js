import * as THREE from "three";

const HOVER_COLOR = new THREE.Color("#5ad0ff");
const HOVER_INTENSITY = 0.5;

/** 将鼠标位置转换为 NDC，供 Raycaster 使用。 */
function computePointer(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

/** 启用 emissive 高亮效果。 */
function highlightMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissive.copy(HOVER_COLOR);
  mesh.material.emissiveIntensity = HOVER_INTENSITY;
}

/** 还原 emissive。 */
function resetMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissiveIntensity = 0;
}

/**
 * 绑定水系拾取逻辑，返回 dispose/clearHover 供外部控制。
 */
export function attachWaterPicking({
  domElement,
  camera,
  waterGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !waterGroup) {
    throw new Error("attachWaterPicking 需要 domElement、camera 与 waterGroup");
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
    if (!waterGroup.visible) {
      clearHover();
      return;
    }

    computePointer(event, domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(waterGroup.children, true);
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
    if (!waterGroup.visible || !hoveredMesh) {
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
