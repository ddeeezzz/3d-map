# 导航面板与地点搜索功能 Spec

## 背景与目标

在现有项目中集成版本3的导航面板UI，将建筑搜索改造成POI地点搜索，实现地点高亮（模型+POI标签）和路线规划可视化功能。用户可以通过搜索POI名称选择起点和终点，系统自动计算并显示路线，同时高亮对应的模型和POI标签。

## 功能概述

1. **复用版本3的导航面板UI**：NavigationPanel 和 BuildingSearchInput 组件
2. **改造为地点搜索**：将 BuildingSearchInput 改造成 LocationSearchInput，支持搜索所有POI（包括有/无parentId的）
3. **实现地点高亮**：根据POI的parentType和parentId高亮对应模型（建筑/场地/路段/水系）和POI标签
4. **路线规划集成**：将导航面板的路线规划与现有的 `roadGraph.js` 和 `buildRouteOverlay.js` 集成

## 文件清单

### 新增文件

1. **组件文件**（`app/src/components/`）：
   - `LocationSearchInput.jsx` - 地点搜索输入框（基于BuildingSearchInput改造）
   - `LocationSearchInput.css` - 地点搜索样式（复用BuildingSearchInput.css）
   - `NavigationPanel.jsx` - 导航面板（基于版本3改造）
   - `NavigationPanel.css` - 导航面板样式（复用版本3）

2. **状态管理**（`app/src/store/`）：
   - `navigationStore.js` - 导航状态管理（基于版本3改造）

### 修改文件

- `app/src/App.jsx` - 集成导航面板，添加地点高亮逻辑
- `app/src/store/useSceneStore.js` - 添加地点高亮相关状态
- `app/src/config/index.js` - 添加高亮颜色配置
- `app/src/lib/poiIndex.js` - 在 POI 数据入口补充 `parentId`/`parentType` 字段
- `app/src/three/buildPois.js` - 暴露 `getPoiDetail`/`getAllPois`，供高亮逻辑读取 Sprite 与 parent 关系
- `app/src/three/buildBuildings.js` - 返回建筑列表供后续扩展（可选）

## 详细实现

### 1. 地点搜索组件 (LocationSearchInput.jsx)

**数据源**：
- 从 `poiIndex.js` 的 `getPoiRecords()` 获取所有POI（包括有/无parentId的）
- 需要补充 `parentId` 和 `parentType` 信息（从 `buildPois.js` 返回的POI数据中获取）

**数据结构**：
```javascript
{
  poiId: string,
  name: string,
  worldX: number,
  worldZ: number,
  coordinate: [lng, lat],
  parentId: string | null,
  parentType: 'building' | 'site' | 'road' | 'water' | null
}
```

**功能**：
- 输入框自动补全（最多显示7个建议）
- 搜索时过滤：名称包含关键词的POI
- 选择后触发 `onSelectLocation` 回调
- 显示已选择的地点名称和清除按钮

**实现要点**：
- 需要扩展 `poiIndex.js` 或从 `buildPois.js` 获取完整的POI信息（包含parentId和parentType）
- 过滤掉名称以"未命名"开头的POI（可选）

### 2. 导航面板 (NavigationPanel.jsx)

**改造点**：
1. 将 `BuildingSearchInput` 替换为 `LocationSearchInput`
2. 移除 `useDebugStore` 依赖（使用 `useSceneStore` 的 `sceneTransform`）
3. 路线规划逻辑改为调用 `roadGraph.js` 的 `solveRouteBetweenPoints`
4. 路线显示使用现有的 `buildRouteOverlay` 系统
5. 移除 TransportSelector（交通方式选择器）

**路线规划流程**：
1. 获取起点和终点的POI数据（包含 worldX/worldZ）
2. 调用 `solveRouteBetweenPoints(poiA, poiB)` 获取路径（复用现有的 `roadGraph.js`）
3. 通过 `useSceneStore` 的 `setHighlightedRoutePath` 和 `setHighlightedRouteMeta` 设置路线
4. 路线显示复用现有的 `buildRouteOverlay` 系统（已在App.jsx中实现）
5. 清除路线时调用 `setHighlightedRoutePath([])` 和相关清除方法

**保留功能**：
- `window.highlightRouteByPoiNames` 控制台功能继续保留，与导航面板功能并行

### 3. 地点高亮系统

**Store状态** (`useSceneStore.js`)：
```javascript
highlightedLocationIds: Set<string>, // 高亮的POI ID集合
highlightedModelIds: Map<string, { type: string, id: string }>, // POI ID -> 模型信息的映射
```

**高亮逻辑** (`App.jsx`)：
1. 监听 `highlightedLocationIds` 变化
2. 遍历POI Group，高亮对应的POI标签（修改Sprite材质颜色）
3. 根据 `parentType` 和 `parentId` 查找并高亮对应模型：
   - `parentType === 'building'`: 在 `buildingGroup` 中查找 `stableId === parentId` 的Mesh
   - `parentType === 'site'`: 在 `sitesGroup` 中查找
   - `parentType === 'road'`: 在 `roadsGroup` 中查找
   - `parentType === 'water'`: 在 `waterGroup` 或 `waterwayGroup` 中查找
   - `parentType === null`: 只高亮POI标签，不查找模型

**高亮实现方式**：
- POI标签：修改Sprite材质的 `color` 属性为配置的高亮色
- 模型：保存原始材质颜色，临时修改为高亮色，清除时恢复
- 高亮颜色从 `config.highlight?.color` 读取（默认值：`0xffff00`）
- 高亮状态永久保持，直到调用清除方法

**性能优化**：
- 考虑为各Group建立ID到Mesh的映射表，避免遍历查找
- 在 `buildBuildings.js`、`buildSites.js` 等模块中建立映射关系

### 4. 导航Store (navigationStore.js)

**状态**：
```javascript
{
  isPanelVisible: boolean,
  panelPosition: { top: number, left: number },
  startLocation: { poiId, name, worldX, worldZ, parentId, parentType } | null,
  endLocation: { poiId, name, worldX, worldZ, parentId, parentType } | null,
}
```

**Actions**：
- `togglePanel(buttonRef)` - 切换面板显示
- `setStartLocation(location)` - 设置起点，触发高亮更新
- `setEndLocation(location)` - 设置终点，触发高亮更新
- `updateHighlights()` - 更新高亮状态到 `useSceneStore`

### 5. 配置项

**config/index.js 新增配置**：
```javascript
highlight: {
  color: 0xffff00, // 高亮颜色（黄色），可配置
  poiLabelColor: 0xffff00, // POI标签高亮颜色（可选，默认与color相同）
}
```

## 实施步骤

**步骤1：扩展POI数据访问**

- [x] **lib 层补充 parent 信息**  
   - 在 `poiIndex.js` 里，构造 `record` 时同步写入 `props.parentId ?? null`、`props.parentType ?? null`、`props.poiType ?? null`。  
   - `getPoiRecords()` 和 `findPoiByName()` 返回的对象因此具备 `parentId/parentType`，地点搜索和路线规划无需额外查询 Three.js 层。

- [x] **Three.js 层保留完整映射**  
   - `buildPois.js` 目前已有 `poiMap.set(properties.poiId, { ...properties, sprite })`；补充一个 `getPoiDetail(poiId)`（或 `getAllPois()`）接口，后续高亮逻辑可按需读取 `sprite`、parent 关系等细节。  
   - 这样，数据层（搜索/路线）用 `poiIndex.js`，渲染层（高亮 Sprite）用 `buildPois.js` 自有的映射，职责划分清晰。

**步骤2：创建LocationSearchInput组件**

- [x] 复制 `版本3/t2/app/src/components/BuildingSearchInput.jsx` 和 `.css`
- [x] 改名为 `LocationSearchInput`
- [x] 修改数据源为POI数据  
  - `const allPois = useMemo(() => getPoiRecords(), [])` 或通过 props 传入 POI 列表  
  - 搜索 / 过滤逻辑基于 `poi.name`，返回包含 `poiId、parentId、parentType` 的对象
- [x] 调整组件 props 和回调函数名称  
  - `selectedLocation`、`onSelectLocation`、`onClearLocation`（原 props：`selectedBuilding`、`onSelectBuilding`、`onClear`）  
  - 回调传递完整 `poi` 对象（含 parent 信息），供导航面板和高亮复用  
  - 需要同步更新的文件：  
    - `app/src/components/LocationSearchInput.jsx`（组件定义与 props 解构）  
    - 所有引用该组件的父级，例如 `app/src/components/NavigationPanel.jsx` 及后续可能新增的界面

**步骤3：创建NavigationPanel组件**

- [x] 复制 `版本3/t2/app/src/components/NavigationPanel.jsx` 和 `.css`
- [x] 替换 `BuildingSearchInput` 为 `LocationSearchInput`
- [x] 移除 `useDebugStore` 依赖  
  - 取消对 `useDebugStore` 的导入；统一从 `useSceneStore` 读取 `sceneTransform`（含 `SCENE_BASE_ALIGNMENT` 与调试增量）  
  - 若需要投影→场景坐标转换，复用 `useSceneStore` 中的基准姿态和调试增量即可
- [x] 改造路线规划逻辑，使用 `roadGraph.js` 和 `buildRouteOverlay`  
  - 调用 `solveRouteBetweenPoints(startPoi, endPoi)` 获取 `pointPath/roadIds/totalLength`  
  - 通过 `setHighlightedRoutePath`、`setActiveRoute`、`setHighlightedRoads` 写入 store，并触发 `buildRouteOverlay` 渲染  
  - 面板原有的“清除路线”按钮改为调用 `window.clearRouteHighlight`（或同等逻辑）恢复初始状态
- [x] 保留 TransportSelector（交通方式选择器）

**步骤4：创建navigationStore**

- [x] 复制 `版本3/t2/app/src/store/navigationStore.js`
- [x] 调整状态结构，使用POI数据而非建筑数据  
  - state 字段改为 `startLocation` / `endLocation`，存 `{ poiId, name, worldX, worldZ, parentId, parentType }`  
  - `routeInfo` 等衍生字段也需与 POI 命名保持一致（例如 `{ fromPoi, toPoi }`）
- [x] 保留 transportMode 相关逻辑（供 TransportSelector 使用）  
  - 仍保留 `transportMode`、`setTransportMode` 状态/函数  
  - 若后续有需要，可在 store 中扩展其他交通方式逻辑

**步骤5：修改useSceneStore**

- [x] 添加 `highlightedLocationIds` 状态（Set类型）  
  - 存储当前被地点搜索/导航选中的 POI ID 列表，供 App.jsx 定位对应的 POI Sprite（文字标签）并应用高亮
- [x] 添加 `highlightedModelIds` 状态（Map类型）  
  - 记录 POI 与其实体之间的映射，如 `{ poiId: { type: "building", id: "way/xxx" } }`，便于清理高亮时恢复材质
- [x] 添加 `setHighlightedLocations(poiIds)` 方法  
  - 接收 POI ID 数组，写入 `highlightedLocationIds`，同时根据可选的映射参数准备好 `highlightedModelIds`
- [x] 添加 `clearHighlightedLocations()` 方法  
  - 清空上述两个状态，供导航面板“清除选择”或路线清除时调用

**步骤6：添加配置项**

- [x] 在 `config/index.js` 中添加 `highlight` 配置项  
  - 示例：  
    ```js
    highlight: {
      navigation: {
        model: "#ffd700",     // 导航专用高亮
        poiLabel: "#ffd700"
      }
    }
    ```
  - 允许后续按需扩展 alpha、边框等参数，hover 与导航互不影响

**步骤7：修改App.jsx**

- [x] 导入导航面板组件  
  - `import NavigationPanel from "./components/NavigationPanel";`
- [x] 添加导航面板到渲染树  
  - 在 `App` 组件的 JSX 中（例如 `<DebugPanel />` 上方）插入 `<NavigationPanel />`
- [x] 实现地点高亮逻辑（useEffect监听 highlightedLocationIds）  
  - 当 `highlightedLocationIds` 变化时：  
    - 遍历 POI Sprite（来自 `buildPois`）匹配 POI ID → 修改材质颜色/发光  
    - 根据 `highlightedModelIds` 中记录的 parent 信息，为对应建筑/场地/道路/水系 Mesh 改色，并在清理时恢复  
    - 高亮颜色从 `config.highlight` 读取，与 hover 颜色解耦，便于导航专用配色
- [x] 集成路线规划到导航面板（复用现有逻辑）  
  - 保留 `window.highlightRouteByPoiNames`，但新增由 NavigationPanel 触发的路线计算与 `buildRouteOverlay` 渲染流程

**步骤8：修改buildBuildings.js（可选）**

- [ ] 返回结构改为 `{ group, buildingsList }`  
  - `buildingsList` 数组包含 `{ stableId, name, category, mesh }` 等关键字段，便于搜索/高亮
- [ ] 在 `App.jsx` 中调用 `useSceneStore.getState().setAllBuildings(buildingsList)`  
  - 仅在需要建筑搜索或其他依赖时写入 store，当前版本可先跳过该步骤
- [ ] 为未来扩展保留  
  - 若后续要支持“建筑搜索”或“建筑高亮”，可直接复用此返回结构

## 注意事项

1. **POI数据完整性**：需要扩展 `poiIndex.js` 或 `buildPois.js` 以返回包含 `parentId` 和 `parentType` 的完整POI数据

2. **模型查找性能**：考虑为各Group建立ID到Mesh的映射表，避免遍历查找

3. **高亮颜色**：从 `config.highlight.color` 读取，不硬编码

4. **高亮持久性**：高亮状态永久保持，直到用户主动清除（清除路线或清除选择）

5. **路线清除**：导航面板清除路线时，可选择是否同时清除地点高亮（建议不同时清除，让用户手动控制）

6. **控制台功能**：保留 `window.highlightRouteByPoiNames`，与导航面板功能并行

7. **样式兼容性**：确保导航面板样式与现有UI风格协调

## 测试要点

1. **地点搜索功能**：
   - 输入关键词，验证自动补全和选择
   - 验证所有POI（包括有/无parentId的）都能被搜索到

2. **地点高亮**：
   - 选择地点后，验证模型和POI标签是否正确高亮
   - 验证高亮颜色从配置读取
   - 验证高亮状态永久保持

3. **路线规划**：
   - 选择起点和终点，验证路线是否正确显示
   - 验证路线使用现有的 `buildRouteOverlay` 系统

4. **路线清除**：
   - 清除路线后，验证路线是否正确清除
   - 验证高亮是否按预期保留或清除

5. **无模型POI**：
   - 选择没有parentId的POI，验证只高亮标签

6. **控制台功能**：
   - 验证 `window.highlightRouteByPoiNames` 仍然可用

## 日志记录

- 地点选择：`logInfo("地点搜索", "选择地点", { poiId, name, parentType })`
- 路线规划：`logInfo("路线规划", "路径渲染完成", { from, to, length })`
- 高亮更新：`logInfo("地点高亮", "更新高亮", { count: highlightedLocationIds.size })`

## 未来扩展

- 支持多地点选择和高亮
- 支持地点收藏和历史记录
- 支持地点分类筛选
- 支持路线规划参数调整（如避开某些路段）
- 支持路线动画和导航提示
