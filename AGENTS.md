# Coding Agent 指南

## 基本约定
- 全程使用中文表达（包含思维链），所有文件统一采用 UTF-8 编码。
- 项目定位：西南交通大学犀浦校区校园导航，面向 web 大数据可视化。
- 技术栈：JavaScript + pnpm + Vite + React，导航面板与 UI 组件全部使用 React（不混用 Vue）。
- 项目范围严格限定在 `t2/` 文件夹：所有源码、脚本、配置与文档只能位于 `t2/` 内，禁止改动仓库其他目录。

## 目录结构
- `t2/`：根目录
  - `AGENTS.md`：本指南
  - `spec/`：方案文档目录，每个功能独立一个 spec，`spec/README.md` 作为索引
  - `map.osm`：原始校园 OSM 数据
  - `data/`（可选）：转换后的 GeoJSON、统计报告等中间成果
  - `tools/`（可选）：脚本
  - `app/`：Vite + React 工程
    - `public/`
    - `src/`
      - `main.jsx`、`App.jsx`：入口
      - `components/`：React 导航面板、信息卡片等
      - `deck/`：deck.gl 图层
      - `three/`：Three.js 场景
      - `logger/`：日志模块
      - `config/`：参数配置
      - `data/`：转换后的 GeoJSON
      - `lib/`：数据处理与工具
      - `tests/`：全局测试目录（Vitest 单测与后续集成测试）

## 数据处理
- 数据来源固定为 `t2/map.osm`；使用 `osmtogeojson` 转换为 GeoJSON，保留 `building`、`height`、`building:levels` 等属性。
- 清洗：修复拓扑、补全高度（写入 `properties.elevation`）、添加建筑 ID 与分类标签。
- 如需更大范围或增量更新，再评估 `osmium`、`osmosis` 等工具。

## 渲染方案
- Three.js + deck.gl：
  - `@deck.gl/geo-layers` 解析 GeoJSON、管理属性与交互。
  - Three.js 使用 `ExtrudeGeometry` 拉伸建筑，负责相机、光照、动画与导航效果。
  - deck.gl 承载路径、热点、统计等图层，与 Three.js 共享 WebGL 或分层渲染。
- React 通过 `@deck.gl/react` 承载场景，并与导航面板联动。

## 构建与运行
- 统一使用 `pnpm`，提交 `pnpm-lock.yaml`。
- 使用 Vite 作为开发/构建工具，配置在 `vite.config.js`，入口 `src/main.jsx` 如需调整需先写 spec。

## 协作流程规范
- **默认模式：方案协作**
  - 所有需求先写入 `t2/spec` 对应文档，达到可执行粒度但避免过度工程。
  - 每个功能单独 spec，`spec/README.md` 负责目录与索引。
  - spec 更新获批后才允许编码。
- **模式二：严格执行文档**（双方确认后启用）
  - 直接按 `t2/spec` 最新内容实施，若发现缺口先补 spec。

## 测试规范
- **命令**：`pnpm run lint` + `pnpm run test`；涉及三维/交互的页面还需 `pnpm run dev` 本地验证。
- **单元测试**：集中在 `src/tests/`，使用 Vitest 覆盖数据解析、配置函数、日志模块等纯逻辑。
- **端到端测试**：在 `t2/tests/e2e/` 使用 Playwright/Cypress 覆盖场景初始化、建筑拉伸、导航交互。
- **数据回归**：更新 `map.osm` 或脚本后生成报告（特征数量等），放在 `t2/data/reports/`。
- **日志验证**：测试阶段检查 `logger.js` 输出，确保前缀为 `INFO/DEBUG/WARN/ERROR`，模块名和内容为中文。
- **无法执行测试**：如遇限制需在提交说明中写明原因与补测计划。

## 注释规范
- 适用范围：`t2/` 目录内所有源码、脚本与文档，提交前需保证注释完整。
- 语言与格式：注释统一使用简体中文，优先采用可解析的块注释（如 JSDoc `/** */`），必要时补充行内注释。
- 函数要求：
  - 每个函数定义前写明用途、参数、返回值、可能的异常或副作用。
  - 每次函数调用前（或同行尾部）说明调用原因、关键入参来源与期望结果，避免重复堆砌无效信息。
- 变量要求：每个变量（含常量、解构字段、状态切片）在定义处说明含义、单位／取值范围及与业务的关系，可与声明同行。
- 导入导出要求：所有 `import`、`export` 在语句上方说明模块职责、暴露内容或被依赖模块原因，确保依赖链清晰。
- 实用指引：
  - 注释重点描述“意图 / 约束 / 数据形态”，避免逐行翻译代码。
  - 复杂逻辑块、异步流程或外部依赖需额外段落解释上下游影响。
  - 如果依赖外部资料或数据源，必须附上出处或文件路径。

## 日志规范
- `src/logger/logger.js` 提供 `logInfo/logDebug/logWarn/logError`，除等级前缀外全中文。
- 任何可能出错但非逐帧调用的流程（网络/IO/解析/初始化）至少记录一条 `logInfo`。

## 其他要求
- 仅处理校园范围数据，避免加载全国 OSM。
- 颜色映射、默认层高、交互参数集中在配置文件，便于与大屏联动与维护。
