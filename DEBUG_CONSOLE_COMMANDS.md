# 浏览器控制台调试命令

> 用于在浏览器开发者工具（F12 → Console）中检查各类地理特征的实际 y 坐标和配置中的地面 y，便于验证几何体位置和配置参数是否一致。

## 前置准备

1. 启动项目：`pnpm run dev`
2. 打开浏览器：`http://localhost:5173/`
3. 按 `F12` 打开开发者工具，切换到 **Console** 选项卡
4. 复制下方命令粘贴到控制台执行

---

## 1. 检查水系（Water）的实际 y 和配置 baseY

```javascript
(() => {
  console.log("=== 水系几何体分析 ===");
  
  // 配置中的水系参数
  const waterConfig = window.__WATER_CONFIG__ || {
    baseY: -0.3,
    height: 0.3,
    description: "从 config.waterway.river 读取"
  };
  console.log("📋 配置水系参数:", waterConfig);
  
  // 获取场景中的水体网格
  const waterGroup = window.__SCENE__.getObjectByName("water");
  if (!waterGroup) {
    console.warn("⚠️ 场景中未找到水体（water group）");
    return;
  }
  
  console.log(`✅ 找到水体组，包含 ${waterGroup.children.length} 个水面`);
  
  waterGroup.children.forEach((mesh, idx) => {
    if (mesh.isMesh) {
      const geometry = mesh.geometry;
      const positions = geometry.attributes.position.array;
      
      // 找出最小和最大的 Y 坐标
      let minY = Infinity, maxY = -Infinity;
      for (let i = 1; i < positions.length; i += 3) {
        const y = positions[i];
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      
      const depth = maxY - minY;
      console.log(`  水面 #${idx}:`);
      console.log(`    - 实际最小 Y: ${minY.toFixed(2)}m`);
      console.log(`    - 实际最大 Y: ${maxY.toFixed(2)}m`);
      console.log(`    - 实际深度: ${depth.toFixed(2)}m`);
      console.log(`    - 名称: ${mesh.userData?.name || '未命名'}`);
    }
  });
  
  console.log("💡 说明: 配置 baseY 为地面底部相对于地面(0)的偏移，负值表示下陷");
})();
```

## 2. 检查建筑（Buildings）的实际高度和位置

```javascript
(() => {
  console.log("=== 建筑几何体分析 ===");
  
  // 配置中的建筑高度参数
  const heightConfig = {
    "1层": 4,
    "2层": 8,
    "3层": 12,
    教学楼: 18,
    宿舍: 15,
    体育馆: 12,
    默认: 10,
    description: "从 config.heights 读取"
  };
  console.log("📋 配置建筑高度:", heightConfig);
  
  const buildingGroup = window.__SCENE__.getObjectByName("buildings");
  if (!buildingGroup) {
    console.warn("⚠️ 场景中未找到建筑（buildings group）");
    return;
  }
  
  console.log(`✅ 找到建筑组，包含 ${buildingGroup.children.length} 个建筑`);
  
  const summary = {};
  buildingGroup.children.slice(0, 10).forEach((mesh, idx) => {
    if (mesh.isMesh) {
      const geometry = mesh.geometry;
      const positions = geometry.attributes.position.array;
      
      let minY = Infinity, maxY = -Infinity;
      for (let i = 1; i < positions.length; i += 3) {
        const y = positions[i];
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      
      const height = maxY - minY;
      const category = mesh.userData?.category || '未知';
      
      console.log(`  建筑 #${idx}: ${mesh.userData?.name || '未命名'}`);
      console.log(`    - 分类: ${category}`);
      console.log(`    - 实际地面 Y: ${minY.toFixed(2)}m`);
      console.log(`    - 实际顶部 Y: ${maxY.toFixed(2)}m`);
      console.log(`    - 实际高度: ${height.toFixed(2)}m`);
      console.log(`    - 配置该分类的高度: ${heightConfig[category] || '无'}m`);
      
      summary[category] = (summary[category] || 0) + 1;
    }
  });
  
  console.log("\n📊 分类统计:", summary);
  console.log("💡 说明: 实际 Y 坐标是通过 ExtrudeGeometry 生成的几何顶点坐标");
})();
```

## 3. 检查道路（Roads）的实际高度和地面 baseY

```javascript
(() => {
  console.log("=== 道路几何体分析 ===");
  
  // 配置中的道路参数
  const roadConfig = {
    baseY: -0.1,
    height: 0.3,
    description: "从 config.road 读取"
  };
  console.log("📋 配置道路参数:", roadConfig);
  
  const roadGroup = window.__SCENE__.getObjectByName("roads");
  if (!roadGroup) {
    console.warn("⚠️ 场景中未找到道路（roads group）");
    return;
  }
  
  console.log(`✅ 找到道路组，包含 ${roadGroup.children.length} 条道路`);
  
  roadGroup.children.slice(0, 10).forEach((mesh, idx) => {
    if (mesh.isMesh) {
      const geometry = mesh.geometry;
      const positions = geometry.attributes.position.array;
      
      let minY = Infinity, maxY = -Infinity;
      for (let i = 1; i < positions.length; i += 3) {
        const y = positions[i];
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      
      const depth = maxY - minY;
      console.log(`  道路 #${idx}:`);
      console.log(`    - 实际地面 Y: ${minY.toFixed(2)}m`);
      console.log(`    - 实际顶部 Y: ${maxY.toFixed(2)}m`);
      console.log(`    - 实际厚度: ${depth.toFixed(2)}m`);
      console.log(`    - 配置 baseY: ${roadConfig.baseY}m`);
      console.log(`    - 配置 height: ${roadConfig.height}m`);
    }
  });
  
  console.log("💡 说明: 道路是条带状，baseY 为下边界的偏移，height 为上升高度");
})();
```

## 4. 检查绿化（Greenery）的实际高度和配置

```javascript
(() => {
  console.log("=== 绿化几何体分析 ===");
  
  // 配置中的绿化参数
  const greeneryConfig = {
    treeRow: {
      width: 2,
      height: 0.3,
      baseY: 0,
    },
    faceHeight: 0.5,
    description: "从 config.greenery 读取"
  };
  console.log("📋 配置绿化参数:", greeneryConfig);
  
  const greeneryGroup = window.__SCENE__.getObjectByName("greenery");
  if (!greeneryGroup) {
    console.warn("⚠️ 场景中未找到绿化（greenery group）");
    return;
  }
  
  console.log(`✅ 找到绿化组，包含 ${greeneryGroup.children.length} 个绿化要素`);
  
  greeneryGroup.children.slice(0, 10).forEach((mesh, idx) => {
    if (mesh.isMesh) {
      const geometry = mesh.geometry;
      const positions = geometry.attributes.position.array;
      
      let minY = Infinity, maxY = -Infinity;
      for (let i = 1; i < positions.length; i += 3) {
        const y = positions[i];
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      
      const thickness = maxY - minY;
      const featureType = mesh.userData?.featureType || '未知';
      
      console.log(`  绿化 #${idx}: ${featureType}`);
      console.log(`    - 实际地面 Y: ${minY.toFixed(2)}m`);
      console.log(`    - 实际顶部 Y: ${maxY.toFixed(2)}m`);
      console.log(`    - 实际厚度: ${thickness.toFixed(2)}m`);
      
      if (featureType === 'tree_row') {
        console.log(`    - 配置树行宽度: ${greeneryConfig.treeRow.width}m`);
        console.log(`    - 配置树行高度: ${greeneryConfig.treeRow.height}m`);
        console.log(`    - 配置树行 baseY: ${greeneryConfig.treeRow.baseY}m`);
      } else {
        console.log(`    - 配置面绿化厚度: ${greeneryConfig.faceHeight}m`);
      }
    }
  });
  
  console.log("💡 说明: 面状绿化使用厚度，线状绿化（树行）使用宽度和高度");
})();
```

## 5. 综合对比：所有几何体的地面位置分布

```javascript
(() => {
  console.log("=== 综合地面位置分析 ===\n");
  
  const config = {
    water: { baseY: -0.3, description: "水系（下陷）" },
    buildings: { baseY: 0, description: "建筑（贴地）" },
    roads: { baseY: -0.1, description: "道路（略微下沉）" },
    greenery: { baseY: 0, description: "绿化（贴地）" },
    boundary: { baseY: 0.08, description: "围墙（浮起）" },
  };
  
  const groups = ["water", "buildings", "roads", "greenery", "boundary"];
  const analysis = {};
  
  groups.forEach(groupName => {
    const group = window.__SCENE__.getObjectByName(groupName);
    if (!group || group.children.length === 0) {
      console.log(`⚠️ ${groupName}: 未找到或为空`);
      return;
    }
    
    let minY = Infinity, maxY = -Infinity;
    
    group.children.forEach(mesh => {
      if (mesh.isMesh) {
        const positions = mesh.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          const y = positions[i];
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    });
    
    if (minY !== Infinity) {
      analysis[groupName] = {
        minY: minY.toFixed(2),
        maxY: maxY.toFixed(2),
        configBaseY: config[groupName].baseY,
        description: config[groupName].description
      };
    }
  });
  
  console.table(analysis);
  console.log("\n📊 说明:");
  console.log("  - minY: 该类型几何体中最低点的 Y 坐标");
  console.log("  - maxY: 该类型几何体中最高点的 Y 坐标");
  console.log("  - configBaseY: 配置文件中规定的地面偏移量");
  console.log("  - baseY > 0 表示浮起，< 0 表示下沉，= 0 表示贴地");
})();
```

## 6. 实时监测：某个特定几何体的坐标

```javascript
(() => {
  console.log("=== 实时监测模式 ===\n");
  
  const groupName = "buildings"; // 可改为 "water", "roads", "greenery", "boundary"
  const group = window.__SCENE__.getObjectByName(groupName);
  
  if (!group) {
    console.warn(`⚠️ 未找到 ${groupName} 组`);
    return;
  }
  
  const firstMesh = group.children[0];
  if (!firstMesh || !firstMesh.isMesh) {
    console.warn(`⚠️ ${groupName} 组中没有有效的网格`);
    return;
  }
  
  console.log(`正在监测: ${groupName}\n`);
  
  // 定期更新
  const positions = firstMesh.geometry.attributes.position.array;
  
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    const y = positions[i];
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  
  console.log(`当前 ${firstMesh.userData?.name || '对象'} 的 Y 坐标:`);
  console.log(`  地面: ${minY.toFixed(3)}m`);
  console.log(`  顶部: ${maxY.toFixed(3)}m`);
  console.log(`  厚度: ${(maxY - minY).toFixed(3)}m`);
  console.log(`  中心: ${((minY + maxY) / 2).toFixed(3)}m`);
  
  // 按键刷新（需手动调用，按 Enter 执行）
  window.__MONITOR__ = () => {
    const newPositions = firstMesh.geometry.attributes.position.array;
    let newMinY = Infinity, newMaxY = -Infinity;
    for (let i = 1; i < newPositions.length; i += 3) {
      const y = newPositions[i];
      newMinY = Math.min(newMinY, y);
      newMaxY = Math.max(newMaxY, y);
    }
    console.log(`[刷新] 地面: ${newMinY.toFixed(3)}, 顶部: ${newMaxY.toFixed(3)}, 厚度: ${(newMaxY - newMinY).toFixed(3)}`);
  };
  
  console.log("\n💡 提示: 调用 __MONITOR__() 实时刷新数据");
})();
```

---

## 使用说明

### 前置条件

需要在 `app/src/main.jsx` 或 `app/src/App.jsx` 中暴露必要的全局变量：

```javascript
// 在初始化时
window.__SCENE__ = scene;  // Three.js Scene 对象

// 或通过 store
import useSceneStore from './store/useSceneStore';
window.__SCENE__ = useSceneStore.getState().scene;
```

### 执行步骤

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 复制对应的命令脚本
4. 粘贴后按 Enter 执行
5. 查看输出结果

### 输出说明

- **minY**: 几何体中最低顶点的 Y 坐标（米）
- **maxY**: 几何体中最高顶点的 Y 坐标（米）
- **baseY**: 配置文件中定义的地面偏移（米）
  - 负值：在地面以下（如水系下陷）
  - 零值：贴地（如建筑）
  - 正值：在地面以上（如围墙）
- **高度/厚度**: 垂直方向跨度（maxY - minY）

### 常见问题

**Q: 提示 `window.__SCENE__ is undefined`**  
A: 需要在渲染代码中暴露 scene 对象到全局作用域

**Q: 水系显示的 minY 为负数，是否正常？**  
A: 正常。这表示水系的配置 `baseY: -0.3` 使其下陷到地面以下

**Q: 建筑的高度和配置中的值不一致**  
A: 检查 GeoJSON 数据的 `elevation` 字段是否被正确清洗，或查看是否按分类应用了高度

---

## 参考配置值

来自 `config/index.js`：

| 类型 | baseY | height | 说明 |
|------|-------|--------|------|
| 水系 (river) | -0.3 | 0.3 | 河流下陷 |
| 道路 | -0.1 | 0.3 | 道路略微下沉 |
| 围墙 | 0.08 | 20 | 围墙浮起 |
| 树行 | 0 | 0.3 | 树行贴地 |
| 绿化面 | 0 | 0.5 | 面状绿化贴地 |
| 建筑 | 0 | 可变 | 建筑贴地 |
