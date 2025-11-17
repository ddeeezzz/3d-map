/**
 * 建筑几何体构建模块
 * 
 * 职责：
 * 从 GeoJSON 数据中提取建筑要素，转换坐标，使用 Three.js ExtrudeGeometry 拉伸为 3D 几何体
 * 应用配置中的颜色、高度、材质参数，最后挂载到场景
 * 
 * 工作流：
 * 1. 加载 GeoJSON 数据（campus.geojson）
 * 2. 查找第一个建筑作为投影原点（保证坐标稳定性）
 * 3. 对每个建筑：
 *    - 投影坐标从经纬度转为平面米制坐标
 *    - 根据 category 取颜色、根据 elevation 取高度
 *    - 使用 ExtrudeGeometry 拉伸成 3D 柱体
 *    - 添加必要的 userData（ID、名称等）以支持拾取交互
 * 4. 共享材质优化性能
 * 5. 返回 Group 便于场景管理
 * 
 * 依赖：
 * - config：颜色映射、默认高度
 * - coordinates.js：坐标投影（若直接使用 projectCoordinate 工具函数）
 */

import * as THREE from "three";
import config from "../config/index.js";
import rawGeojson from "../data/campus.geojson?raw";

/**
 * data：解析后的 GeoJSON 数据
 * 通过 ?raw 导入 GeoJSON 为文本，避免每次加载时重复解析
 */
const data = JSON.parse(rawGeojson);

/**
 * metersPerDegree：经纬度到米的近似转换系数
 * 值：111320 m/°（地球周长 40075 km / 360°）
 * 用于等距圆柱投影（Equirectangular Projection）
 * 注：此系数在赤道处准确，高纬度存在压缩，但对小范围校园数据影响微小
 */
const metersPerDegree = 111320;

/**
 * projectCoordinate：将单个经纬度点投影为平面坐标
 * 
 * 参数：
 * - [lng, lat]：WGS84 经纬度坐标
 * - origin：投影原点 { lng, lat }
 * 
 * 返回：THREE.Vector2 平面坐标（单位：米）
 * 
 * 公式：
 * x = (lng - origin.lng) * metersPerDegree * cos(origin.lat)
 * y = (lat - origin.lat) * metersPerDegree
 * 
 * 说明：
 * - x 方向乘以 cos(纬度) 以补偿地球曲率
 * - 若 origin 为空，直接返回原始经纬度（降级处理）
 */
function projectCoordinate([lng, lat], origin) {
  if (!origin) return new THREE.Vector2(lng, lat);
  const x =
    (lng - origin.lng) *
    metersPerDegree *
    Math.cos((origin.lat * Math.PI) / 180);
  const y = (lat - origin.lat) * metersPerDegree;
  return new THREE.Vector2(x, y);
}

/**
 * projectPolygon：将多边形的每个环投影为平面坐标
 * 
 * 参数：
 * - polygon：[[ring1], [ring2], ...]，其中 ring 为 [[lng, lat], ...]
 * - origin：投影原点
 * 
 * 返回：投影后的环数组结构（保持嵌套格式）
 * 
 * 用途：处理建筑外轮廓和孔洞
 */
function projectPolygon(polygon, origin) {
  return polygon.map((ring) =>
    ring.map((coord) => projectCoordinate(coord, origin))
  );
}

/**
 * convertGeometry：从 GeoJSON 要素提取几何体并投影
 * 
 * 参数：
 * - feature：GeoJSON Feature 对象
 * - origin：投影原点
 * 
 * 返回：投影后的多边形数组，或 null（若几何体类型不支持）
 * 
 * 支持类型：
 * - Polygon：返回 [投影后的多边形]
 * - MultiPolygon：返回多个投影后的多边形数组
 * - 其他：返回 null
 */
function convertGeometry(feature, origin) {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return [projectPolygon(geometry.coordinates, origin)];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) =>
      projectPolygon(polygon, origin)
    );
  }
  return null;
}

/**
 * determineColor：根据建筑分类查表确定颜色
 * 
 * 参数：category - 分类标签（如 "教学楼"、"宿舍"）
 * 返回：十六进制颜色字符串
 * 
 * 优先级：
 * 1. config.colors[category] - 精确匹配
 * 2. config.colors.默认 - 降级到默认颜色
 * 3. "#999999" - 最终降级
 */
function determineColor(category) {
  return config.colors[category] || config.colors.默认 || "#999999";
}

/**
 * resolveBuildingOverride：根据建筑名称查找覆盖配置
 *
 * 参数：properties - GeoJSON properties
 * 返回：配置对象或 null
 */
function resolveBuildingOverride(properties) {
  const name = properties.name?.trim();
  if (!name) return null;
  const overrides = config.buildingOverrides?.byName;
  if (!overrides) return null;
  return overrides[name] || null;
}

/**
 * buildBuildings：构建所有建筑几何体
 * 
 * 参数：scene - Three.js Scene 对象
 * 返回：包含所有建筑 Mesh 的 THREE.Group
 * 
 * 流程：
 * 1. 校验 scene 参数
 * 2. 确定投影原点（第一个建筑的第一个坐标）
 * 3. 创建 Group 容器
 * 4. 维护材质缓存（相同颜色的建筑共用材质，减少 GPU 对象数）
 * 5. 遍历所有建筑要素（featureType === "building"）
 * 6. 对每个建筑：
 *    - 投影坐标
 *    - 查表确定高度（从 elevation 或 category 或默认）
 *    - 从多边形创建 THREE.Shape，支持孔洞
 *    - 使用 ExtrudeGeometry 拉伸到指定高度
 *    - 应用材质、阴影设置、userData（用于拾取）
 *    - 添加到 Group
 * 7. 将 Group 挂载到场景
 * 8. 返回 Group 引用
 * 
 * 性能优化：
 * - 材质共享：相同颜色的建筑使用同一个 MeshPhongMaterial
 * - bevelEnabled: false：禁用倒角减少顶点数
 * - 只在必要时计算顶点法线（computeVertexNormals）
 * 
 * 用户交互支持：
 * userData 包含 stableId、name、category，便于 buildingPicking.js 进行拾取和高亮
 */
export function buildBuildings(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  /**
   * 查找投影原点：第一个 building 要素的第一个坐标
   * 保证所有建筑都使用同一个原点，坐标值的数量级稳定
   */
  const originFeature = data.features.find(
    (f) => f.properties?.featureType === "building"
  );
  const originCoord =
    originFeature?.geometry?.coordinates?.[0]?.[0] || [0, 0];
  const origin = { lng: originCoord[0], lat: originCoord[1] };

  /**
   * 创建 Group 作为建筑集合的容器
   * name 便于在调试工具中识别
   */
  const group = new THREE.Group();
  group.name = "buildings";

  /**
   * 材质缓存：避免重复创建相同颜色的材质
   * Map<color: string, MeshPhongMaterial>
   */
  const materialCache = new Map();

  /**
   * 遍历所有 GeoJSON 要素，筛选建筑并构建 3D 几何体
   */
  for (const feature of data.features) {
    const props = feature.properties || {};
    // 筛选建筑类型要素
    if (props.featureType !== "building") continue;

    // 投影坐标
    const projectedPolygons = convertGeometry(feature, origin);
    if (!projectedPolygons) continue;

    const override = resolveBuildingOverride(props);

    /**
     * 确定建筑高度
     * 优先级：
     * 1. config.buildingOverrides.byName：elevation、heightOffset（最高优先）
     * 2. config.heights：先尝试按分类查表（若不存在则跳过）
     * 3. properties.elevation：数据清洗阶段写入的高度
     * 4. config.heights.默认：全局默认高度（最低优先级）
     * 5. 10：兜底，防止高度缺失
     */
    const category = props.category || "默认";
    let height;
    if (Number.isFinite(override?.elevation)) {
      height = Number(override.elevation);
    }
    if (!Number.isFinite(height)) {
      const categoryHeight = config.heights?.[category];
      if (Number.isFinite(categoryHeight)) {
        height = Number(categoryHeight);
      }
    }
    if (!Number.isFinite(height)) {
      const elevationFromData = Number(props.elevation);
      if (Number.isFinite(elevationFromData) && elevationFromData > 0) {
        height = elevationFromData;
      }
    }
    if (!Number.isFinite(height) || height <= 0) {
      const defaultHeight = Number(config.heights?.默认);
      height = Number.isFinite(defaultHeight) && defaultHeight > 0 ? defaultHeight : 10;
    }
    if (Number.isFinite(override?.heightOffset)) {
      height += Number(override.heightOffset);
    }
    if (!Number.isFinite(height) || height <= 0) {
      height = 10;
    }

    /**
     * 确定建筑分类和颜色
     * 用于统计报告和渲染时的视觉区分
     * 覆盖配置 color 优先
     */
    const color = override?.color || determineColor(category);

    /**
     * 自定义透明度（默认 0.5）
     */
    let opacity = 0.5;
    if (
      typeof override?.opacity === "number" &&
      override.opacity >= 0 &&
      override.opacity <= 1
    ) {
      opacity = override.opacity;
    }

    /**
     * 从缓存或新建材质
     * MeshPhongMaterial 配置说明：
     * - color：基础颜色
     * - transparent: true + opacity: 0.75：支持透明度效果
     * - side: THREE.DoubleSide：双面渲染（避免背面不可见）
     */
    const materialKey = `${color}-${opacity}`;
    let material = materialCache.get(materialKey);
    if (!material) {
      material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      materialCache.set(materialKey, material);
    }

    /**
     * 对每个投影后的多边形构建 Mesh
     * 建筑可能由多个不相连的多边形组成（MultiPolygon）
     */
    projectedPolygons.forEach((polygon) => {
      if (!polygon.length) return;

      /**
       * 构建 THREE.Shape
       * polygon[0] 为外轮廓，polygon[1...] 为孔洞
       */
      const shape = new THREE.Shape(polygon[0]);
      const holes = polygon.slice(1).map((ring) => new THREE.Path(ring));
      holes.forEach((hole) => shape.holes.push(hole));

      /**
       * 使用 ExtrudeGeometry 拉伸成 3D 几何体
       * depth：拉伸高度（米）
       * bevelEnabled: false：禁用倒角（减少顶点数）
       */
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
      });

      /**
       * 坐标系转换
       * GeoJSON 中的 Shape 在 XY 平面，需要旋转 -90° 使其沿 Z 轴（高度方向）向上
       * rotateX(-π/2)：将 Shape 从 XY 平面旋转到 XZ 平面，Z 轴向上
       */
      geometry.computeVertexNormals();
      geometry.rotateX(-Math.PI / 2);

      /**
       * 创建 Mesh 并配置
       */
      const mesh = new THREE.Mesh(geometry, material);

      /**
       * 阴影设置
       * castShadow: true：建筑投射阴影到其他物体
       * receiveShadow: true：建筑表面接收其他物体的阴影
       */
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      /**
       * userData：用于拾取和交互的元数据
       * - stableId：唯一标识符（用于 store 中的 selectedBuilding）
       * - name：建筑名称（显示在信息卡片）
       * - category：分类（用于统计和过滤）
       */
      mesh.userData = {
        stableId:
          props.stableId ||
          props.id ||
          feature.id ||
          `building-${mesh.uuid}`,
        name: props.name || "未命名建筑",
        category,
      };

      group.add(mesh);
    });
  }

  /**
   * 将建筑 Group 挂载到场景
   */
  scene.add(group);
  return group;
}
