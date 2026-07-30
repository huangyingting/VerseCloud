# 诗云 · Verse Cloud

一个可运行的诗词空间应用：在 3D 概念疆域上游历中国古典诗词，并让长安、江南和西域三层程序化音景随镜头中心自然交融。

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

- React、TypeScript、D3 地理投影和 Three.js 3D 场景。
- Natural Earth / `world-atlas` 地理底层。
- 正式采用的 742 年唐代概念疆域、江河意象和 8 个诗词空间节点。
- SDF 中文 3D 文字、镜头漫游、点击选择及诗词详情卡片。
- 基于 Web Audio / Tone.js 的长安、江南、西域三路实时音景。
- 诗词地点关系、证据说明和置信度字段。
- 桌面及移动端布局、减少动态效果偏好和浏览器自动播放授权流程。

## 创作定位

`src/data/mapSnapshots.ts` 中的唐代边界是 VerseCloud 正式采用的艺术化概念疆域。它以盛唐空间意象和诗词游历体验为目标，不主张复原任一具体年份的学术政区边界，也不需要替换为学术 GIS 才能发布。界面以“概念疆域”和“艺术化空间演绎”说明这一创作定位。

诗词文本目前以 `chinese-poetry` 项目为种子，并附有概念版人工地点说明。地点分为创作地、作品场景、行旅节点、诗中提及和人物关联地，不能互相混用。

## 目录

```text
src/components/VerseScene.tsx  3D 地图、诗词节点、镜头交互
src/data/poems.ts              诗词及地理证据样本
src/data/mapSnapshots.ts       年代快照与概念边界
src/lib/geo.ts                 D3 投影及 Three.js 几何转换
src/lib/soundscape.ts          音景权重与 Web Audio 调度
tests/e2e/                     浏览器验收测试
```

## 下一阶段

1. 按同一艺术语言绘制宋、元、明概念疆域，建立多朝代空间快照。
2. 建立 PostgreSQL/PostGIS 数据库及诗人、作品、历史地点实体关联管线。
3. 将程序化音景替换或叠加为经过审核的 AI 音乐 stems。
4. 自托管中文字体子集，减少首次生成 3D 字形的等待。
5. 增加编辑审核后台，记录每一处地理判断的证据和版本。
