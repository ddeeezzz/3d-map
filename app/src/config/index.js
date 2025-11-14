/**
 * 全局配置文件：校园导航场景的颜色、高度、图层、道路宽度等参数
 * 
 * 职责：
 * 集中管理所有可配置参数，便于与大屏联动、参数调优和维护
 * 所有数值单位：颜色采用十六进制、长度采用米
 * 
 * 依赖方：
 * - buildBuildings.js：使用 colors、heights 为建筑着色和拉伸
 * - buildRoads.js：使用 roadWidths 控制道路宽度
 * - buildBoundary.js：使用 boundary 参数
 * - buildWaterway.js：使用 waterway 参数
 */

export const config = {
  /**
   * colors：建筑物分类颜色映射
   * 格式：{ 分类标签: #十六进制颜色 }
   * 使用场景：buildBuildings.js 根据建筑 properties.type 字段查表着色
   * 示例值：
   * - 教学楼: 蓝色（#4A90E2）
   * - 宿舍: 橙色（#F5A623）
   * - 体育馆: 青色（#50E3C2）
   * - 行政楼: 绿色（#B8E986）
   * - 默认: 灰色（#999999）- 未分类建筑的降级方案
   */
  colors: {
    教学楼: "#4A90E2",
    宿舍: "#F5A623",
    体育馆: "#50E3C2",
    行政楼: "#B8E986",
    默认: "#999999",
    道路: "#d0d0d0",
    水系: "#4fc3f7",
    围墙: "#f5deb3",
    绿化: "#4caf50",
  },

  /**
   * heights：建筑物高度映射（单位：米）
   * 格式：{ 分类标签或层数标记: 高度 } 
   * 使用场景：
   * - buildBuildings.js 根据 properties.type 和 properties.levels 双重查表确定拉伸高度
   * - 优先使用 type 查找，退化到 levels、再到默认值
   * 示例逻辑：如果 type 为"教学楼"，取 18m；否则按层数（"2层" = 8m）
   * 
   * 说明：
   * - 每层约 4m（包含层高和楼板厚度）
   * - 默认: 10m - 未知建筑的保守估计
   */
  heights: {
    "1层": 4,
    "2层": 8,
    "3层": 12,
    教学楼: 18,
    宿舍: 15,
    体育馆: 12,
    默认: 10,
  },

  /**
   * layers：图层列表和初始可见性
   * 格式：[{ name, key, visible, order }]
   * 使用场景：
   * - UI 导航面板显示图层切换按钮
   * - App.jsx 初始化图层可见性到 store
   * 字段说明：
   * - name: 用户界面显示的中文名称
   * - key: store 中的标识符（layerVisibility 的键）
   * - visible: 初始可见性（true = 默认显示）
   * - order: 渲染顺序（较大值后渲染，覆盖较小值）
   * 
   * 示例：order 20 的道路会覆盖 order 15 的水系
   */
  layers: [
    { name: "建筑", key: "buildings", visible: true, order: 10 },
    { name: "围墙", key: "boundary", visible: true, order: 12 },
    { name: "水系", key: "water", visible: true, order: 15 },
    { name: "绿化", key: "greenery", visible: true, order: 18 },
    { name: "道路", key: "roads", visible: true, order: 20 },
    { name: "热点", key: "pois", visible: false, order: 30 },
  ],

  /**
   * roadWidths：道路分类宽度映射（单位：米）
   * 格式：{ 道路等级: 宽度 }
   * 使用场景：
   * - buildRoads.js 根据 properties.highway 字段查表设置道路宽度
   * - 优先级：精确匹配 → 默认值
   * 
   * 等级说明（OSM 标准）：
   * - motorway: 高速公路（18m）
   * - trunk: 主干道（14m）
   * - primary: 一级道路（12m）
   * - secondary: 二级道路（10m）
   * - tertiary: 三级道路（8m）
   * - residential: 居住区道路（6m）
   * - service: 服务道路（4m）
   * - footway: 人行道（3m）
   */
  roadWidths: {
    motorway: 18,
    trunk: 14,
    primary: 12,
    secondary: 10,
    tertiary: 8,
    residential: 6,
    service: 4,
    footway: 3,
    默认: 6,
  },

  /**
   * boundary：边界（围墙）几何参数
   * 字段：
   * - width: 围墙在地面上的宽度（米），通常为 1m
   * - height: 围墙的垂直高度（米），通常为 20m
   */
  boundary: {
    width: 1,
    height: 20,
    baseY: 0.08,
  },

  /**
   * waterway：河流和溪流的参数
   * 结构：{ 水系类型: { width, height } }
   * 使用场景：buildWaterway.js 拉伸线性水系
   * 示例：
   * - river: 河流，通常 5m 宽度、1m 深度（用负高度表示凹陷）
   */
  waterway: {
    river: {
      width: 5,
      height: 0.3,
      baseY: -0.3,
    },
  },

  /**
   * greenery：绿地和树木的参数（可选扩展）
   * 结构：{ 植被类型: { width, height } }
   * 使用场景：未来可能的绿化层渲染
   */
  greenery: {
    treeRow: {
      width: 2,
      height: 0.3,
      baseY: 0,
    },
  },

  /**
   * road：道路线框场景的边框偏移高度
   * 字段：
   * - baseY：条形顶点方向和后续前进下面上抬的边距，通过小数调整防止 z-fighting
   * - height：条形的挺立参数，由 Three.js ExtrudeGeometry depth 设置
   */
  road: {
    baseY: -0.4,
    height: 0.3,
  },

  /**
   * dataPath：GeoJSON 数据文件路径（相对于 public/ 或项目根）
   * 使用场景：
   * - 各个 build*.js 模块通过 fetch(config.dataPath) 获取数据
   * - Vite 开发服务器会在此路径提供文件
   * 
   * 说明：
   * - 绝对路径 /src/data/campus.geojson 不推荐（会被 Vite 处理）
   * - 建议改为 /data/campus.geojson 并放在 public/ 目录
   * - 或使用相对导入：import campusData from '../data/campus.geojson'
   */
  dataPath: "/src/data/campus.geojson",
};

export default config;
