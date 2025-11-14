/**
 * 绿化标签匹配规则，供数据清洗脚本与测试共用
 */

const GREENERY_NATURAL = new Set(["wood", "tree_row", "scrub", "grass", "meadow"]);
const GREENERY_LANDUSE = new Set(["grass", "forest"]);

function detectGreeneryType(props = {}) {
  const natural = (props.natural || "").toLowerCase();
  if (natural && GREENERY_NATURAL.has(natural)) {
    return natural;
  }

  const landuse = (props.landuse || "").toLowerCase();
  if (landuse && GREENERY_LANDUSE.has(landuse)) {
    return landuse;
  }

  return null;
}

module.exports = {
  GREENERY_NATURAL,
  GREENERY_LANDUSE,
  detectGreeneryType,
};
