export const config = {
  colors: {
    教学楼: "#4A90E2", // 教学楼立面颜色
    宿舍: "#F5A623", // 学生宿舍颜色
    体育馆: "#50E3C2", // 体育设施颜色
    行政楼: "#B8E986", // 行政办公楼颜色
    默认: "#999999", // 未分类建筑使用的默认颜色
  }, // 建筑/设施分类颜色映射
  heights: {
    "1层": 4, // 单层建筑默认高度
    "2层": 8, // 双层建筑默认高度
    "3层": 12, // 三层建筑默认高度
    教学楼: 18, // 教学楼常规高度
    宿舍: 15, // 宿舍楼常规高度
    体育馆: 12, // 体育馆常规高度
    默认: 10, // 无匹配时的兜底高度
  }, // 用于数据管线补全高度
  layers: [
    { name: "建筑", key: "buildings", visible: true, order: 10 }, // 主建筑体层
    { name: "道路", key: "roads", visible: true, order: 20 }, // 道路网络层
    { name: "热点", key: "pois", visible: false, order: 30 }, // 校园热点/POI 层
  ], // deck.gl 图层配置
  dataPath: "/src/data/campus.geojson", // GeoJSON 默认加载路径
};

export default config;
