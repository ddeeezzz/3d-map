/**
 * 坐标变换模块：处理 WGS84（经纬度）坐标到平面投影坐标的转换
 * 
 * 职责：
 * 将 GeoJSON 中的经纬度坐标投影为平面直角坐标（米），便于 Three.js 几何体构建
 * 使用等距圆柱投影（Equirectangular Projection），适合小范围地图
 * 
 * 依赖方：
 * - buildBuildings.js、buildBoundary.js 等：批量转换要素坐标
 * 
 * 关键参数：
 * - METERS_PER_DEGREE：地球一度对应的米数（赤道处 111320 米）
 * - origin：投影原点（lng, lat），通常取校园中心
 * 
 * 坐标系约定：
 * - 输入：[经度, 纬度]（WGS84，取自 OSM）
 * - 输出：[X 米, Y 米]（平面直角坐标系，Y 向北，X 向东）
 * - Three.js 中通常映射：X → x，Y → z（y 轴竖直向上）
 */

/**
 * METERS_PER_DEGREE：地球表面一度对应的米数（等距圆柱投影下）
 * 数值：111320 m/度（地球周长 40075km 除以 360 度）
 * 用途：经纬度坐标转换的尺度因子
 */
const METERS_PER_DEGREE = 111320;

/**
 * projectCoordinate：将单个经纬度点投影为平面坐标
 * 
 * 参数：
 * - [lng, lat]：WGS84 经纬度坐标（[经度, 纬度]）
 * - origin：投影原点，格式 { lng, lat }
 * 
 * 返回：[x, y] 平面坐标（单位：米）
 * - x：向东为正方向的偏移距离
 * - y：向北为正方向的偏移距离
 * 
 * 公式：
 * x = (lng - origin.lng) * METERS_PER_DEGREE * cos(origin.lat * π/180)
 * y = (lat - origin.lat) * METERS_PER_DEGREE
 * 
 * 说明：
 * - x 方向需乘以 cos(纬度) 以补偿地球曲率在高纬度处的压缩
 * - 若 origin 为空，直接返回原始坐标（降级处理）
 * 
 * 例：
 * projectCoordinate([104.05, 30.64], { lng: 104.05, lat: 30.64 }) → [0, 0]
 */
export function projectCoordinate([lng, lat], origin) {
  // 若未提供原点，直接返回原始经纬度（应避免此情况）
  if (!origin) {
    return [lng, lat];
  }
  
  // 计算相对原点的经度差，乘以尺度因子和纬度校正余弦值
  const x =
    (lng - origin.lng) *
    METERS_PER_DEGREE *
    Math.cos((origin.lat * Math.PI) / 180);
  
  // 计算相对原点的纬度差，乘以尺度因子
  const y = (lat - origin.lat) * METERS_PER_DEGREE;
  
  return [x, y];
}

/**
 * projectPolygon：将多边形（由多个环组成）投影为平面坐标
 * 
 * 参数：
 * - polygon：多边形坐标数组，格式 [[ring1], [ring2], ...]
 *   - 第一个 ring 为外轮廓，后续 ring 为孔洞
 *   - 每个 ring 为点数组：[[lng, lat], [lng, lat], ...]
 * - origin：投影原点
 * 
 * 返回：投影后的多边形坐标结构（保持相同的嵌套结构）
 * 
 * 用途：转换建筑轮廓、水体边界等多边形要素
 * 
 * 例：
 * projectPolygon(
 *   [[[104.05, 30.64], [104.06, 30.64], [104.06, 30.65], [104.05, 30.65], [104.05, 30.64]]],
 *   { lng: 104.05, lat: 30.64 }
 * ) → [[[0, 0], [111.32, 0], [111.32, 111.32], [0, 111.32], [0, 0]]]
 */
export function projectPolygon(polygon, origin) {
  // 对每个环分别调用 projectCoordinate，保持外轮廓和孔洞的结构
  return polygon.map((ring) =>
    ring.map((coord) => projectCoordinate(coord, origin))
  );
}

/**
 * projectGeometry：通用几何体投影函数，处理 Polygon 和 MultiPolygon
 * 
 * 参数：
 * - geometry：GeoJSON geometry 对象，包含 type 和 coordinates
 * - origin：投影原点
 * 
 * 返回：投影后的 geometry 对象，结构不变但坐标更新
 * 
 * 支持的类型：
 * - "Polygon"：单个多边形
 * - "MultiPolygon"：多个多边形集合
 * - 其他类型：返回 null（未实现）
 * 
 * 例：
 * projectGeometry(
 *   { type: "Polygon", coordinates: [[[104.05, 30.64], ...]] },
 *   { lng: 104.05, lat: 30.64 }
 * ) → { type: "Polygon", coordinates: [[[0, 0], ...]] }
 */
export function projectGeometry(geometry, origin) {
  // 健壮性检查：若 geometry 为空返回 null
  if (!geometry) return null;
  
  // 处理单多边形
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: projectPolygon(geometry.coordinates, origin),
    };
  }
  
  // 处理多多边形：对每个多边形分别投影
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) =>
        projectPolygon(polygon, origin)
      ),
    };
  }
  
  // 其他几何类型（如 Point、LineString）暂不支持
  return null;
}

/**
 * findProjectionOrigin：从要素集合中自动识别投影原点
 * 
 * 参数：features - GeoJSON Feature 数组
 * 返回：原点坐标 { lng, lat }
 * 
 * 策略：
 * 查找第一个 featureType 为 "building" 的要素，取其几何体的第一个坐标作为原点
 * 若未找到，默认使用 [0, 0]
 * 
 * 说明：
 * - 这是一个简化实现，更稳健的做法是取所有要素的中心或中位数
 * - 当前假设校园数据已预处理，至少包含一个建筑
 * 
 * 例：
 * findProjectionOrigin([
 *   { properties: { featureType: "building" }, geometry: { coordinates: [[[104.05, 30.64], ...]]] } }
 * ]) → { lng: 104.05, lat: 30.64 }
 */
export function findProjectionOrigin(features) {
  // 查找第一个建筑要素
  const originFeature = features.find(
    (feature) => feature.properties?.featureType === "building"
  );
  
  // 安全地提取坐标，若不存在则使用 [0, 0]
  const coord = originFeature?.geometry?.coordinates?.[0]?.[0] ?? [0, 0];
  
  return { lng: coord[0], lat: coord[1] };
}

/**
 * projectFeatureCollection：批量投影 FeatureCollection 中的所有要素
 * 
 * 参数：
 * - featureCollection：GeoJSON FeatureCollection 对象
 * - origin：投影原点 { lng, lat }
 * - filterFn：可选的过滤函数，返回 true 的要素才被保留
 * 
 * 返回：投影后的 FeatureCollection，结构和属性不变，仅坐标更新
 * 
 * 流程：
 * 1. 按 filterFn 过滤要素（若未提供则全部保留）
 * 2. 投影每个要素的几何体
 * 3. 过滤掉投影失败（geometry 为 null）的要素
 * 4. 返回新的 FeatureCollection
 * 
 * 用途：
 * 从 GeoJSON 数据源读取并批量转换坐标
 * 例：projectFeatureCollection(geoJsonData, origin, (f) => f.properties?.type !== "barrier")
 */
export function projectFeatureCollection(featureCollection, origin, filterFn) {
  // 批量转换和过滤要素
  const features = featureCollection.features
    // 第一阶段过滤：按 filterFn 保留要素
    .filter((feature) => (filterFn ? filterFn(feature) : true))
    // 投影几何体并重组 Feature
    .map((feature) => {
      const geometry = projectGeometry(feature.geometry, origin);
      // 若几何投影失败，返回 null 以便后续过滤
      if (!geometry) return null;
      return {
        type: "Feature",
        // 保留原始属性
        properties: { ...feature.properties },
        // 使用投影后的几何体
        geometry,
      };
    })
    // 第二阶段过滤：移除投影失败的要素
    .filter(Boolean);

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * toCartesianCoordinates：将 2D 平面坐标转换为 3D 笛卡尔坐标
 * 
 * 参数：coordinates - 多边形坐标结构 [[ring1], [ring2], ...]
 * 返回：3D 坐标结构，每个点添加 z = 0（高度）
 * 
 * 格式转换：
 * 输入：[[[x1, y1], [x2, y2], ...], ...]
 * 输出：[[[x1, y1, 0], [x2, y2, 0], ...], ...]
 * 
 * 用途：
 * 为 Three.js 的 ShapeGeometry、ExtrudeGeometry 等提供 3D 坐标
 * Three.js 要求 z 坐标显式存在
 * 
 * 例：
 * toCartesianCoordinates([[[0, 0], [1, 0], [1, 1], [0, 1]]]) 
 * → [[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]
 */
export function toCartesianCoordinates(coordinates) {
  // 遍历每个环，为每个点添加 z = 0
  return coordinates.map((ring) =>
    ring.map(([x, y]) => [x, y, 0])
  );
}
