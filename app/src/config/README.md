# config

- `index.js` 是唯一入口，导出 `config` 对象，包含颜色映射、默认高度、图层开关、数据路径等。
- 前端（Three.js、deck.gl、UI）都通过 `import config from "./config/index.js"` 获取参数；不得直接散落常量。
- 若需要新增字段（如主题、API 地址），先更新 `spec/config.md`，再扩展 `index.js`。
