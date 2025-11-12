import { useMemo } from "react";
import { useSceneStore } from "../store/useSceneStore";

const isDev = typeof import.meta !== "undefined" ? import.meta.env?.DEV !== false : true;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function DebugPanel() {
  const sceneTransform = useSceneStore((state) => state.sceneTransform);
  const updateSceneTransform = useSceneStore(
    (state) => state.updateSceneTransform
  );
  const resetSceneTransform = useSceneStore(
    (state) => state.resetSceneTransform
  );

  if (!isDev) {
    return null;
  }

  const rotationDeg = useMemo(
    () => Math.round((sceneTransform.rotationY * 180) / Math.PI),
    [sceneTransform.rotationY]
  );

  const handleRotationChange = (event) => {
    const deg = Number(event.target.value);
    updateSceneTransform({ rotationY: (deg * Math.PI) / 180 });
  };

  const handleScaleChange = (event) => {
    const value = clamp(Number(event.target.value), 0.2, 5);
    updateSceneTransform({ scale: value });
  };

  const handleOffsetChange = (axis) => (event) => {
    const value = clamp(Number(event.target.value), -500, 500);
    updateSceneTransform({
      offset: {
        ...sceneTransform.offset,
        [axis]: value,
      },
    });
  };

  return (
    <div className="debug-panel">
      <div className="debug-panel__header">
        <span>Debug Panel</span>
        <button type="button" onClick={resetSceneTransform}>
          Reset
        </button>
      </div>

      <label className="debug-panel__row">
        <span>旋转角度 (°)</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={rotationDeg}
          onChange={handleRotationChange}
        />
        <span className="debug-panel__value">{rotationDeg}</span>
      </label>

      <label className="debug-panel__row">
        <span>缩放比例</span>
        <input
          type="number"
          min={0.2}
          max={5}
          step={0.1}
          value={sceneTransform.scale}
          onChange={handleScaleChange}
        />
      </label>

      <label className="debug-panel__row">
        <span>偏移 X (m)</span>
        <input
          type="number"
          min={-500}
          max={500}
          value={sceneTransform.offset.x}
          onChange={handleOffsetChange("x")}
        />
      </label>

      <label className="debug-panel__row">
        <span>偏移 Z (m)</span>
        <input
          type="number"
          min={-500}
          max={500}
          value={sceneTransform.offset.z}
          onChange={handleOffsetChange("z")}
        />
      </label>
    </div>
  );
}

export default DebugPanel;
