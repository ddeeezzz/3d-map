import { useEffect, useRef } from "react";
import "./App.css";
import { initScene } from "./three/initScene";
import { logInfo, logError } from "./logger/logger";

function App() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let sceneContext;
    const handleResize = () => {
      sceneContext?.resize();
    };

    try {
      sceneContext = initScene(container);
      logInfo("三维渲染", "Three.js 场景初始化完成");
      sceneContext.start();
      window.addEventListener("resize", handleResize);
    } catch (error) {
      logError("三维渲染", "Three.js 场景初始化失败", {
        错误: error?.message ?? "未知错误",
      });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      sceneContext?.stop();
      const canvas = sceneContext?.renderer?.domElement;
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="app-root">
      <div ref={containerRef} className="scene-container" />
      <div className="scene-overlay">
        <h1>西南交通大学犀浦校区</h1>
        <p>场景初始化完成后会自动加载建筑数据。</p>
      </div>
    </div>
  );
}

export default App;
