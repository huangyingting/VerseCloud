# 诗云 · Verse Cloud

一个可运行的诗词空间应用：在真实高程塑造的三维山河上游历中国古典诗词，并让长安、江南和西域三层程序化音景随地图中心自然交融。

## 本地运行

```bash
npm install
npm run dev
```

质量检查：

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

端到端测试默认使用本机 Chrome，并由 Playwright 自动启动 Vite 开发服务器。

## 当前版本

- React、TypeScript、MapLibre GL 三维地形和 D3 音景空间投影。
- Natural Earth 地表影像、OpenFreeMap / OpenStreetMap 水系，以及 Mapzen Terrain Tiles 真实高程。
- 正式采用的 742 年唐代概念疆域，以半透明图层贴合真实山河，并放置 8 个诗词空间节点。
- 朱雀仿宋自托管网页字体，以及从右向左的古籍式竖排诗卷。
- 可俯仰、旋转、缩放的地图漫游，以及从全域山河自然落向诗词节点的入场镜头。
- 更醒目的暗金诗词节点、仿宋地点标注、地图内简式竖排诗签，以及默认收纳考据内容的诗卷界面。
- 为八首诗分别设计花影烽烟、彩云轻舟、月落渔火、烟渚江月、白日黄河、黄鹤白云、紫烟瀑布和朝雨柳色动画。
- 选诗后镜头会平滑聚焦并主动避让桌面诗卷或移动端底部面板，让地点和意象特效保持可见。
- 移动端“山河 / 诗卷”双模式，避免诗词面板长期遮挡真实地形。
- 基于 Web Audio / Tone.js 的长安、江南、西域三路实时音景。
- 诗词地点关系、证据说明和置信度字段。
- 桌面及移动端布局、减少动态效果偏好和浏览器自动播放授权流程。

## 创作定位

`src/data/mapSnapshots.ts` 中的唐代边界是 VerseCloud 正式采用的艺术化概念疆域。它以盛唐空间意象和诗词游历体验为目标，不主张复原任一具体年份的学术政区边界，也不需要替换为学术 GIS 才能发布。界面以“概念疆域”和“艺术化空间演绎”说明这一创作定位。

诗词文本目前以 `chinese-poetry` 项目为种子，并附有概念版人工地点说明。地点分为创作地、作品场景、行旅节点、诗中提及和人物关联地，不能互相混用。

## 目录

```text
src/components/VerseScene.tsx  MapLibre 三维地形、诗词节点、地图交互
src/data/poems.ts              诗词及地理证据样本
src/data/mapSnapshots.ts       年代快照与概念边界
src/lib/geo.ts                 D3 音景空间投影
src/lib/soundscape.ts          音景权重与 Web Audio 调度
tests/e2e/                     浏览器验收测试
```

## 下一阶段

1. 按同一艺术语言绘制宋、元、明概念疆域，建立多朝代空间快照。
2. 建立 PostgreSQL/PostGIS 数据库及诗人、作品、历史地点实体关联管线。
3. 将程序化音景替换或叠加为经过审核的 AI 音乐 stems。
4. 继续压缩和按需加载自托管仿宋字体，降低首次访问体积。
5. 增加编辑审核后台，记录每一处地理判断的证据和版本。

## 地图与字体来源

- 地表晕渲：Natural Earth，经 OpenFreeMap 提供。
- 水系矢量瓦片：OpenFreeMap / OpenStreetMap contributors。
- 高程：Mapzen Terrain Tiles；其公开数据来源包含 NASA、USGS 等机构。
- 中文字体：朱雀仿宋（Zhuque Fangsong），按 SIL Open Font License 1.1 使用并随应用自托管。

地图中的唐代边界是艺术化概念图层；真实高程不代表边界具有学术复原精度。
