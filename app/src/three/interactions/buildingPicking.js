import * as THREE from "three";

/**
 * 为了避免拾取到 ExtrudeGeometry 内部的子 Mesh，逐级往上找到挂在 buildingGroup 下的顶层 Mesh。
 */
function getTopLevelMesh(mesh, group) {
  let current = mesh;
  while (current && current.parent && current.parent !== group) {
    current = current.parent;
  }
  return current;
}

/**
 * 命中建筑时做高亮：克隆材质并加上暖色 emissive，原材质缓存到 userData 中，便于鼠标离开时恢复。
 */
function highlightMesh(mesh) {
  if (!mesh || mesh.userData.__originalMaterial) return;
  mesh.userData.__originalMaterial = mesh.material;
  const cloned = mesh.material.clone();
  if (cloned.emissive) {
    cloned.emissive = new THREE.Color("#fbbf24");
    cloned.emissiveIntensity = 0.7;
  } else if (cloned.color) {
    cloned.color = cloned.color.clone();
    cloned.color.offsetHSL(0, 0, 0.2);
  }
  mesh.material = cloned;
}

/**
 * 将高亮过的 Mesh 恢复成原材质。
 */
function restoreMesh(mesh) {
  if (mesh?.userData.__originalMaterial) {
    mesh.material.dispose?.();
    mesh.material = mesh.userData.__originalMaterial;
    mesh.userData.__originalMaterial = null;
  }
}

/**
 * 拾取回调只关心 stableId/name/category，其他材质缓存字段需要过滤掉。
 */
function extractInfo(userData) {
  if (!userData) return null;
  const { stableId, name, category } = userData;
  return { stableId, name, category };
}

/**
 * 绑定建筑拾取逻辑：监听 pointermove/click，使用 Raycaster 命中建筑并回调 hover / select。
 */
export function attachBuildingPicking({
  domElement,
  camera,
  buildingGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !buildingGroup) {
    throw new Error("attachBuildingPicking 需要 domElement、camera 和 buildingGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  const computePointer = (event) => {
    const rect = domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.set(x, y);
  };

  const pickMesh = () => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, true);
    if (!hits.length) return null;
    return getTopLevelMesh(hits[0].object, buildingGroup);
  };

  const handlePointerMove = (event) => {
    computePointer(event);
    const mesh = pickMesh();
    if (mesh === hoveredMesh) {
      return;
    }
    if (hoveredMesh) {
      restoreMesh(hoveredMesh);
      onHover?.(null);
    }
    if (mesh) {
      highlightMesh(mesh);
      hoveredMesh = mesh;
      onHover?.(extractInfo(mesh.userData));
    } else {
      hoveredMesh = null;
    }
  };

  const handleClick = () => {
    if (!hoveredMesh) return;
    onSelect?.(extractInfo(hoveredMesh.userData));
  };

  domElement.addEventListener("pointermove", handlePointerMove);
  domElement.addEventListener("click", handleClick);

  return () => {
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("click", handleClick);
    if (hoveredMesh) {
      restoreMesh(hoveredMesh);
      hoveredMesh = null;
    }
  };
}
