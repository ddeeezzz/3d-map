# spec 索引

> 当前协作模式：先完善 spec，再进入开发。所有功能必须拥有独立文档，并在此索引登记。

## 文档列表

- [应用目录结构](app-structure.md)：`t2/app/src/` 目录划分、职责与 TODO。
- [日志方案](logging.md)：`logger.js` 输出格式、API、使用策略。
- [配置策略](config.md)：`src/config/` 文件结构、加载方式、与各模块的关系。
- [数据流程](data-pipeline.md)：OSM → GeoJSON 转换、清洗、回归报告。
- [渲染层次](rendering.md)：Three.js 体块、deck.gl 图层（暂不考虑）、共用 WebGL 能力。
- [Store 规范](store.md)：Zustand 状态结构、字段职责及实现建议。
- [UI 结构](ui.md)：React 导航面板、信息卡片、状态管理。
- [POI 标注](poi.md)：POI 数据转换、Three.js 图层渲染与交互控制。

## 待补项

- 导航算法与数据来源

> 添加新功能前，请先创建对应 `spec/<feature>.md` 并在此列表中登记。
