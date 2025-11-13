export const config = {
  colors: {
    教学楼: "#4A90E2",
    宿舍: "#F5A623",
    体育馆: "#50E3C2",
    行政楼: "#B8E986",
    默认: "#999999",
    道路: "#d0d0d0",
    水系: "#4fc3f7",
  },
  heights: {
    "1层": 4,
    "2层": 8,
    "3层": 12,
    教学楼: 18,
    宿舍: 15,
    体育馆: 12,
    默认: 10,
  },
  layers: [
    { name: "建筑", key: "buildings", visible: true, order: 10 },
    { name: "水系", key: "water", visible: true, order: 15 },
    { name: "道路", key: "roads", visible: true, order: 20 },
    { name: "热点", key: "pois", visible: false, order: 30 },
  ],
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
  dataPath: "/src/data/campus.geojson",
};

export default config;
