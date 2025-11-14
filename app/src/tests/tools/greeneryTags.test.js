import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { detectGreeneryType } = require("../../../../tools/greenery-tags.js");

describe("绿化标签匹配", () => {
  it("landuse = forest 视为绿化", () => {
    const result = detectGreeneryType({ landuse: "forest" });
    expect(result).toBe("forest");
  });

  it("natural = forest 不再命中", () => {
    const result = detectGreeneryType({ natural: "forest" });
    expect(result).toBeNull();
  });
});
