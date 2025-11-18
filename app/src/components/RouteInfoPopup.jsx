// app/src/components/RouteInfoPopup.jsx

/**
 * RouteInfoPopup：显示路线距离与预计耗时的悬浮卡片
 * 依赖 highlightedRoutePath/activeRoute/transportMode 状态，自动锚定到路径包围框
 */
import React, { useEffect, useState } from "react";
import * as THREE from "three";
import "./RouteInfoPopup.css";
import { useSceneStore, SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";
import { useNavigationStore } from "../store/navigationStore";

// SPEED_KMH：不同交通方式对应的平均速度（公里/小时）
const SPEED_KMH = {
  walk: 5,
  bike: 12,
  ebike: 20,
  drive: 30,
  car: 30,
};

/**
 * formatTime：根据路线长度与交通方式预估分钟数
 * @param {number} lengthMeters - 路径总长度（米）
 * @param {string} mode - 当前交通方式
 * @returns {string} 友好化分钟文本
 */
function formatTime(lengthMeters = 0, mode = "walk") {
  const speedKmh = SPEED_KMH[mode] || SPEED_KMH.walk;
  const speedMps = speedKmh / 3.6;
  const secs = speedMps > 0 ? lengthMeters / speedMps : 0;
  const minutes = Math.round(secs / 60);
  if (minutes < 1) return "<1 分钟";
  return `${minutes} 分钟`;
}

/**
 * RouteInfoPopup 组件主体
 * @param {object} props.sceneContext - 可选 Three.js 场景上下文，若未传则回退到 window.sceneContext
 */
export default function RouteInfoPopup({ sceneContext }) {
  const highlightedPath = useSceneStore((state) => state.highlightedRoutePath);
  const activeRoute = useSceneStore((state) => state.activeRoute);
  const transportMode = useNavigationStore((state) => state.transportMode);

  const [pos, setPos] = useState({
    left: -9999,
    top: -9999,
    visible: false,
    side: "right",
  });
  const [readyScene, setReadyScene] = useState(
    sceneContext ||
      (typeof window !== "undefined" ? window.sceneContext : null)
  );

  useEffect(() => {
    const updatePos = () => {
      try {
        const scene =
          sceneContext ||
          (typeof window !== "undefined" ? window.sceneContext : null) ||
          readyScene;
        if (!scene || !scene.camera || !scene.renderer) {
          setPos({ left: -9999, top: -9999, visible: false, side: "right" });
          return;
        }
        if (!Array.isArray(highlightedPath) || highlightedPath.length < 1 || !activeRoute) {
          setPos({ left: -9999, top: -9999, visible: false, side: "right" });
          return;
        }

        const { camera, renderer } = scene;
        const width = renderer.domElement.clientWidth || window.innerWidth;
        const height = renderer.domElement.clientHeight || window.innerHeight;

        const sceneTransformState =
          useSceneStore.getState().sceneTransform || {
            rotationY: 0,
            scale: 1,
            offset: { x: 0, z: 0 },
          };
        const rotation =
          (SCENE_BASE_ALIGNMENT.rotationY || 0) +
          (sceneTransformState.rotationY || 0);
        const scaleVal =
          (SCENE_BASE_ALIGNMENT.scale || 1) *
          (sceneTransformState.scale || 1);
        const posOffsetX =
          (SCENE_BASE_ALIGNMENT.offset?.x || 0) +
          (sceneTransformState.offset?.x || 0);
        const posOffsetZ =
          (SCENE_BASE_ALIGNMENT.offset?.z || 0) +
          (sceneTransformState.offset?.z || 0);

        const toVec3 = (p) =>
          new THREE.Vector3(
            Number(p?.worldX ?? p?.x ?? 0),
            Number(p?.worldY ?? p?.y ?? 0.2),
            Number(p?.worldZ ?? p?.z ?? 0)
          );
        const projectPoint = (vector) => {
          const transformed = vector.clone();
          transformed.multiplyScalar(scaleVal);
          transformed.applyEuler(new THREE.Euler(0, rotation, 0));
          transformed.x += posOffsetX;
          transformed.z += posOffsetZ;
          const projected = transformed.clone();
          projected.project(camera);
          return {
            x: ((projected.x + 1) / 2) * width,
            y: ((-projected.y + 1) / 2) * height,
          };
        };

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        highlightedPath.forEach((point) => {
          const screenPoint = projectPoint(toVec3(point));
          if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
            return;
          }
          minX = Math.min(minX, screenPoint.x);
          maxX = Math.max(maxX, screenPoint.x);
          minY = Math.min(minY, screenPoint.y);
          maxY = Math.max(maxY, screenPoint.y);
        });

        if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
          setPos({ left: -9999, top: -9999, visible: false, side: "right" });
          return;
        }

        const bboxCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const screenMidX = width / 2;
        const preferSide = bboxCenter.x < screenMidX ? "right" : "left";
        const OFFSET_PX = 28;
        let left;
        if (preferSide === "right") {
          left = Math.min(maxX + OFFSET_PX, width - 12);
        } else {
          left = Math.max(minX - OFFSET_PX, 12);
        }
        const top = Math.min(Math.max(bboxCenter.y, 12), height - 12);
        setPos({ left, top, visible: true, side: preferSide });
      } catch (error) {
        setPos({ left: -9999, top: -9999, visible: false, side: "right" });
      }
    };

    // 初始化时立即计算
    updatePos();

    // 如未收到 props，轮询 window.sceneContext
    let pollId = null;
    if (!sceneContext) {
      const tryAttach = () => {
        const globalScene =
          typeof window !== "undefined" ? window.sceneContext : null;
        if (globalScene) {
          setReadyScene(globalScene);
          updatePos();
          if (pollId) {
            clearInterval(pollId);
            pollId = null;
          }
        }
      };
      pollId = setInterval(tryAttach, 300);
      tryAttach();
    }

    // 监听窗口变化与相机控制器变化
    window.addEventListener("resize", updatePos);
    const attachControls = (sceneRef) => {
      try {
        if (sceneRef?.controls?.addEventListener) {
          sceneRef.controls.addEventListener("change", updatePos);
          return () => sceneRef.controls.removeEventListener("change", updatePos);
        }
      } catch (err) {
        return null;
      }
      return null;
    };
    let detachControls = null;
    if (sceneContext) {
      detachControls = attachControls(sceneContext);
    } else if (readyScene) {
      detachControls = attachControls(readyScene);
    }

    return () => {
      window.removeEventListener("resize", updatePos);
      if (pollId) clearInterval(pollId);
      if (detachControls) detachControls();
    };
  }, [sceneContext, readyScene, highlightedPath, activeRoute, transportMode]);

  if (!activeRoute) {
    return null;
  }

  const length = Number(activeRoute.length ?? 0).toFixed(2);
  const timeText = formatTime(Number(activeRoute.length ?? 0), transportMode);
  const icons = { walk: "🚶", bike: "🚲", ebike: "🛵", drive: "🚗", car: "🚗" };
  const transportIcon = icons[transportMode] || icons.walk;

  return (
    <div
      className={`route-info-popup ${pos.visible ? "visible" : "hidden"} side-${
        pos.side
      }`}
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      role="status"
    >
      <div className="route-info-inner fancy">
        <div className="f-left">
          <div className="icon">{transportIcon}</div>
        </div>
        <div className="f-right">
          <div className="time">{timeText}</div>
          <div className="distance">{length} m</div>
        </div>
      </div>
    </div>
  );
}



