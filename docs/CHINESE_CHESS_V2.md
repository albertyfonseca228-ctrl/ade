# 中国象棋 V2 离线人机交付

基础：V1 提交 `c817532`（Complete Chinese Chess V1）。开发前工作区干净，从 `dev/chinese-chess-v1` 创建 `dev/chinese-chess-v2-ai`；没有提交、Push 或移动 V1/main 的引用。

## 预览

1. 用 Cocos Creator 3.8.8 打开当前工程，等待新增脚本导入。
2. 双击原来的 `assets/scenes/ChineseChess.scene`，运行预览，选择 720 × 1280。
3. 首页选择初级/中级/高级，再选择人机对战，或者进入本地双人。首页及对局 UI 由同一场景中已绑定的 ChessGame 生成，不需要重新绑定组件。
4. 人机时玩家执红，红子动画完成后显示黑方思考状态，AI 返回后播放黑子动画。思考及动画期间禁止棋盘操作；按钮仍可重开、悔棋或返回首页。
5. 返回首页可切换模式与难度。重开沿用当前模式与难度。人机悔棋撤销红黑一轮；若红方刚走完而 AI 尚未落子，只撤销该红方一步。本地双人仍每次撤销一步。

场景、已有 meta、组件 UUID、注册名称与 BSD 许可证保持不变。本次无需创建重复场景，也不改动 V1 Missing Class 修复的脚本 Class ID。

## AI

继续复用 BSD-2-Clause xiangqi.js 的规则，AI 搜索为原创 TypeScript。开源候选及未采用原因见 [AI_RESEARCH.md](AI_RESEARCH.md)。

搜索采用 Negamax + Alpha-Beta 剪枝、迭代加深、吃子优先排序、棋子价值、兵卒推进/过河奖励、车马炮基础位置奖励与将军惩罚。将死和困毙使用远高于物质分的终局分，并优先更短的获胜路径。中高级加入有限吃子延伸，受将时搜索应将；没有随机选子冒充高级算法。

| 难度 | 主搜索深度上限（半回合） | 总耗时预算 | 节点上限 | 战术延伸上限 |
| --- | --- | --- | --- | --- |
| 初级 | 1 | 350 ms | 800 | 0 |
| 中级 | 2 | 1200 ms | 5000 | 1 |
| 高级 | 4 | 2800 ms | 18000 | 2 |

耗时为墙钟预算，包含分帧等待。实际完成深度由设备和局面决定，不保证高级每步都到 4 层。到时优先返回最后完整迭代的最佳走法；若一层都未完成，返回已评估的根节点最佳走法，最坏情况下使用按吃子排序的合法候选。不同档位不是棋力等级认证，没有开局库、残局库或专业等级分。

每帧目标运行不超过 4 ms 或 32 次 generator 恢复，之后必须等待下一次 update。规则库单次生成/移动调用不可中断，因而时间片是软预算，不能承诺所有 Android 设备绝对不超过 4 ms；低端机需真机测量。搜索可以取消并释放暂停栈，不会继续走旧局面。

## 稳定性

- GameSession 以 ready、animating、thinking、menu、disposed 管理输入与异步回合，拒绝重复 AI 请求。
- 每次重开、悔棋、返回首页或销毁递增 epoch。AI 回调须同时匹配 epoch、阶段与原始 FEN；旧任务不会修改新局面或清除新任务状态。
- AI 使用独立 FEN 规则实例；每次搜索移动在 finally 中撤销。
- 返回走法再与实盘合法走法核对，经规则库执行。空值、非法落点或异常时使用合法备用走法并显示说明，不锁死对局。
- 重开/悔棋/切换时停止旧棋子 Tween，动画完成回调也核对 epoch。
- 场景销毁先使任务失效，释放 FrameGate 等待者并停止动画；异步返回后不再访问已销毁节点。

## 新增与修改

新增：

- `assets/scripts/chess/OfflineAI.ts`：分帧搜索与评估。
- `assets/scripts/chess/GameSession.ts`：纯逻辑对局状态机。
- `assets/scripts/chess/FrameGate.ts`：由 Cocos update 驱动的等待桥。
- 以上三者的 `.meta`，只为新增资源分配 UUID。
- `tools/chess-test-runtime.cjs`：以 Creator 自带 TypeScript 加载真实源码的测试工具。
- `tools/test-ai.cjs`、`tools/test-ai-controller.cjs`：逻辑、搜索及控制器测试。
- `tools/check-chess-v2.cjs`：统一检查入口。
- `docs/AI_RESEARCH.md`、`docs/CHINESE_CHESS_V2.md`、`tools/ai-research-tree.json`：审查与交付记录。

修改：

- `ChessGame.ts`：首页、难度、模式、人机控制与动画衔接。
- `ChessRules.ts`：支持独立 FEN 实例和可选取消上下文，保持原 ChessAI 调用方式兼容。
- `BoardView.ts`：停止动画及类型导入。
- `tools/test-scene-registration.cjs`：保留 V1 场景注册验证，支持控制器新增依赖，不再硬编码依赖数量。可用的编辑器缓存可能仍为 V1，当前 V2 源码由新增控制器测试执行。

## 自动化验证

运行 `node tools/check-chess-v2.cjs`，依次执行：

1. `tsc --noEmit -p tsconfig.chess.json`：严格检查通过；沿用 skipLibCheck 跳过 SDK 自身声明，上游规则适配保留原 ts-nocheck。
2. `node tools/test-chess.cjs`：全部 V1 棋盘/规则/移动撤销/终局/场景引用/UUID 注册回归通过。
3. `node tools/test-ai.cjs`：三难度、红黑初局、合法坐标、禁止吃己子、吃子机会、将军应将、将死优先、时间预算、跨帧、整轮悔棋、重开、模式切换、旧新任务竞态、非法/异常返回、销毁与终局锁盘通过。
4. `node tools/test-ai-controller.cjs`：真实 ChessGame 源码在模拟 Cocos 边界下执行，覆盖菜单、玩家动画后自动 AI、思考输入锁定、AI 动画、整轮悔棋、动画取消、首页切换与销毁。附带真实时钟搜索测量。

本机实测一次高级搜索（黑方首回合，模拟 60 Hz update）：约 2816 ms，102 帧，1076 搜索节点，完整深度 2，最长搜索时间片 4 ms。该记录不是 Android 真机数据，重复运行会有波动。测试代码使用 Node，游戏运行时代码不依赖 Node。

测试工具默认使用本机 Creator 3.8.8 内置 TypeScript；换机器可设置 `COCOS_TYPESCRIPT` 为其 typescript 包目录，无需将其装入游戏依赖。

## 尚需人工验收

- 在 Creator 中重新预览首页与中文字体，检查 Canvas 无 Missing Script。
- 三档各完成多轮走棋，检查选择提示、吃子动画、将军/胜负与本地双人功能。
- 思考或动画时连续点击悔棋/重开/返回，切换难度，确认无旧棋子移动或状态残留。
- Android 原生构建、APK 离线安装运行、前后台切换、低端机时间片/帧率、屏幕安全区及中文字形。
- V1 已记录的安装路径 Junction / EEXIST 属于安装环境问题，本次没有触碰安装目录，若仍出现需独立处理。

本次没有生成 APK，也未实际操作 Creator UI 或 Android 真机；不把模拟引擎测试等同于原生构建通过。仍沿用上游重复局面/自然限着和棋规则，不新增比赛级长将长捉裁决。
