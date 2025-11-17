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
    默认: "#606060",
    道路: "#bcbcbc",
    水系: "#4fc3f7",
    围墙: "#f5deb3",
    绿化: "#4caf50",
    site: {
      默认: "#d3b6b6",
      stadium: "#50E3C2",
      track: "#ff8800",
      swimming_pool: "#4FC3F7",
      parking: "#ff7777",
      construction: "#d3b6b6",
    },
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
    site: 2,
  },

  /**
   * buildingOverrides：按建筑名称精确匹配的渲染覆盖
   * - byName：键为 properties.name（需与数据完全一致），值为覆盖项
   * - 支持字段：
   *   - color：自定义颜色
   *   - elevation：绝对高度（米），覆盖 properties.elevation
   *   - heightOffset：在最终高度上叠加的增量（米，可正可负）
   *   - opacity：材质透明度（0-1）
   * 默认留空，按需在部署环境中添加“图书馆”“行政楼”等特殊建筑
   */
  buildingOverrides: {
    byName: {
      "图书馆": { color: "#8B5CF6", elevation: 32, opacity: 0.65 },
    },
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
    { name: "场地", key: "sites", visible: true, order: 16 },
    { name: "绿化", key: "greenery", visible: true, order: 18 },
    { name: "道路", key: "roads", visible: true, order: 20 },
    { name: "热点", key: "pois", visible: true, order: 30 },
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
   * - height: 围墙的垂直高度（米）
   * - baseY: 围墙整体抬升量
   * - holeInset: 闭合墙体内缩量，避免主空腔贴在外缘
   * - gateWidth: 默认门洞净宽（米），用于 boundaryGates 缺省值
   * - gateDepth: 默认门洞进深（米）
   */
  boundary: {
    width: 1,
    height: 20,
    baseY: -11,
    holeInset: 0.35,
    gateWidth: 6,
    gateDepth: 3,
  },

  /**
   * waterway：水系统一参数（线状 + 面状）
   * 字段：
   * - width: 线状水系条带宽度（米）
   * - height: 线状水系挤出高度（米）
   * - baseY: 线状水系整体抬升/下沉量（米）
   * - surfaceDepth: 面状水体挤出厚度（米）
   * - surfaceBaseY: 面状水体底部偏移（米）
   * 说明：所有 `featureType = "river"` 共享 width/height/baseY；所有 `featureType = "lake"` 共享 surfaceDepth/surfaceBaseY
   */
  waterway: {
    width: 5,
    height: 5,
    baseY: -5.7,
    surfaceDepth: 5,
    surfaceBaseY: -5.75,
  },

  /**
   * greenery：绿地/树行统一参数（线状 + 面状）
   * 字段：
   * - width: 线状绿化条带宽度（米）
   * - height: 线状绿化挤出高度（米）
   * - baseY: 线状绿化整体抬升/下沉量（米）
   * - surfaceDepth: 面状绿化挤出厚度（米）
   * - surfaceBaseY: 面状绿化底部偏移（米）
   * 说明：所有 `featureType = "greenery"` 共用该组配置，如需特例需先在 spec 中扩展
   */
  greenery: {
    width: 3,
    height: 4,
    baseY: -5,
    surfaceDepth: 4,
    surfaceBaseY: -5,
  },

  /**
   * ground：校园地面（淡黄色平面）
   * 字段：
   * - color：平面颜色
   * - baseY：平面放置的 y 坐标（米）
   */
  ground: {
    color: "#fef3c7",
    baseY: -10,
  },

  /**
   * highlight：交互高亮配置
   * - hover：鼠标悬停时的颜色
   * - navigation：导航面板选中地点时的颜色
   */
  highlight: {
    navigation: {
      model: "#ffd700",
      poiLabel: "#ffd700",
    },
  },

  /**
   * site：场地矮柱统一参数
   * 字段：
   * - height：Three.js 场地矮柱的高度（单位：米）
   * - baseY：矮柱整体的基准 Y 偏移，保持与道路顶面一致
   */
  site: {
    height: 2,
    baseY: -5.5,
    categoryHeights: {
      track: 7,
    },
  },

  /**
   * poiRoute：POI 路径高亮相关配置
   * - maxSnapDistance：POI 吸附到道路边的最大距离（米）
   */
  poiRoute: {
    maxSnapDistance: 200,
    highlightMesh: {
      width: 10,
      height: 5,
      yOffset: 0,
      color: "#FF5252",
      opacity: 0.85,
      // 渲染层级：高于道路，低于 POI 标签
      renderOrder: 200,
    },
  },

  /**
   * poi：POI 图层的文字与样式设定
   * 字段：
   * - labelFont：Sprite Canvas 的字体
   * - labelColor：文字颜色
   * - labelBackground：文字背景色
   * - labelBorderColor：边框颜色
   * - labelBorderWidth：边框线宽（px）
   * - labelPadding：左右/上下内边距（px）
   * - labelHeight：Sprite 相对地面的抬升高度（米）
   * - spriteScale：像素到世界坐标的缩放系数
   * - scaleReferenceDistance：镜头距离基准，用于自动缩放
   * - minScale/maxScale：自动缩放的上下限
   */
  poi: {
    labelFont: "24px 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
    labelColor: "#ffffff",
    labelBackground: "rgba(15, 23, 42, 0.85)",
    labelBorderColor: "rgba(56, 189, 248, 0.9)",
    labelBorderWidth: 2,
    labelPadding: { x: 14, y: 8 },
    labelHeight: 8,
    spriteScale: 0.25,
    scaleReferenceDistance: 400,
    minScale: 0.5,
    maxScale: 2,
    // 渲染层级：最高，保证覆盖路线与道路
    renderOrder: 300,
  },

  /**
   * road：道路线框场景的边框偏移高度
   * 字段：
   * - baseY：条形顶点方向和后续前进下面上抬的边距，通过小数调整防止 z-fighting
   * - height：条形的挺立参数，由 Three.js ExtrudeGeometry depth 设置
   */
  road: {
    baseY: -2.15,
    height: 2,
  },

  /**
   * dataPath：GeoJSON 数据文件路径（相对于 public/）
   * 使用场景：
   * - 各个 build*.js 模块通过 fetch(config.dataPath) 获取数据
   * - Vite 开发服务器会在此路径提供文件
   * 
   * 说明：
   * - 不建议直接引用 /src/data/campus.geojson（会被 Vite 处理）
   * - 推荐放置在 public/data/ 并通过绝对路径访问
   * - 也可通过相对导入：import campusData from "../data/campus.geojson"
   */
  dataPath: "/src/data/campus.geojson",
  
  /**
   * environment：软模式下环境描述
   * 字段说明：
   * - enabled：开启人眼认知的 HDR 背景、光态和饱和效果
   * - skybox：重视自定义天空盒图片的 HDR 文件名称，子目录地址一定应存在 `/app/public/textures/skyboxes/`
   * - exposure：亮度、灵活量并描述
   * - toneMapping：支持实业用的 renderer.toneMapping 的过滤任何亮度
   * - skyboxes：表示可选化的 HDR 集合，主初始名称
   */
  environment: {
    enabled: true,
    skybox: "citrus_orchard_road_puresky_4k.hdr",
    exposure: 1,
    toneMapping: "ACESFilmic",
    skyboxes: [
      {
        label: "柑橘果园晴空（4K HDR）",
        value: "citrus_orchard_road_puresky_4k.hdr",
      },
    ],
  },

};

export default config;
