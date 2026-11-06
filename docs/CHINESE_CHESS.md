# 中国象棋 v1 交付说明

工程：Cocos Creator 3.8.8 / TypeScript / 720 × 1280，Android 竖屏。

## 开始运行

1. 用 Creator 3.8.8 打开当前目录，等待资源导入和脚本编译。
2. 在资源管理器双击 `assets/scenes/ChineseChess.scene`。
3. 点击编辑器顶部预览按钮，选择 720 × 1280 竖屏。
4. 红方先行：点击棋子选中，再点击绿色落点或带金色圆环的敌子。点击同一棋子取消选择。
5. 悔棋每次撤销一个半回合；重开恢复初始布局。动画期间暂时锁定操作。

场景已经包含 Canvas、正交 Camera 和绑定的 ChessGame 组件，无需手动拖脚本。棋盘、棋子、状态和按钮由组件在运行时创建，因此编辑状态下 Canvas 尚未显示棋子。使用 SHOW_ALL 保持棋盘完整，非标准屏幕比例可能留边。

## 文件与分层

- `assets/scenes/ChineseChess.scene` 及其 `.meta`：可打开的入口场景。
- `assets/scripts/chess/BoardView.ts`：棋盘、楚河汉界、棋子、点击坐标、落点、动画。
- `assets/scripts/chess/ChessRules.ts`：规则类型、安全适配、终局状态、ChessAI 接口。
- `assets/scripts/chess/ChessGame.ts`：回合、选子、悔棋、重开和后续 AI 接入点。
- `assets/scripts/vendor/xiangqi.js`：指定仓库原始源码。
- `assets/scripts/vendor/xiangqi-esm.ts`：相同规则源码的 ES Module 适配版。
- `assets/scripts/vendor/LICENSE.txt`、`docs/THIRD_PARTY.md`：原始许可证与版本记录。
- `settings/v2/packages/project.json`：增加 720 × 1280 设计分辨率，保留原配置版本。
- `tsconfig.chess.json`：严格检查游戏代码，跳过 Creator SDK 自身声明检查。
- `tools/prepare-chess.cjs`：可重建入口场景、缺失的 meta 和规则模块，不覆盖已有 meta。
- `tools/upstream-commit.json`：下载时的上游 commit 信息。
- `tools/test-chess.cjs`：无 DOM 环境的规则与场景引用回归验证。

所有新增资源均提供 `.meta`。没有删除现有 assets、settings、profiles、meta，没有重新初始化 Git，没有提交或推送。开发分支为 `dev/chinese-chess-v1`。

## 规则与阶段范围

复用 xiangqi.js 固定提交 `f9019ac2303d4b80ef0b82fd0515bfb55a80a62b`。BSD-2-Clause 允许修改和二进制分发；源码保留声明，APK 发行附带原完整许可证。仅替换 CommonJS/AMD 导出为 ES Module，没有 DOM、浏览器专属棋盘、npm 包或运行时联网依赖。上游纯 JavaScript 代码使用 `@ts-nocheck`，业务适配层启用严格类型检查。

实现本地双人阶段：9 × 10 棋盘、32 子、标准初局、合法走法、吃子、将军、将死、困毙判负、和棋、重开、单步悔棋。继承上游的三次重复、120 个无吃子半回合及无子可胜和棋策略；不宣称支持比赛级长将、长捉裁决。

第二阶段预留 `ChessAI.chooseMove(fen, legalMoves)` 与 `ChessGame.requestAI()`。AI 仅获得局面快照，返回后再通过规则库校验；本次没有实装搜索算法或人机模式开关。

## 验证结果

- Creator 自带 TypeScript 编译器执行 `tsc --noEmit -p tsconfig.chess.json` 通过，游戏脚本无静态错误。
- 原工程直接执行 `tsc --noEmit -p tsconfig.json` 会报 Creator SDK 自身的声明问题（TypedArray、WebGPU、内部命名空间等）；专项配置通过 skipLibCheck 跳过外部声明，仍检查游戏代码和 Cocos API 调用。
- `node tools/test-chess.cjs` 通过：32 子、初局 44 个合法走法、非法移动、蹩马腿、炮隔子吃子、回合切换、悔棋、将死、困毙、重开、60 步移动/撤销局面一致性与场景引用完整性。
- 尚未实际操作编辑器预览或 Android 真机，不能将静态检查等同于引擎构建或运行通过。

## Android APK

1. Creator 的偏好设置中配置适配 3.8.8 的 Android SDK、NDK、JDK 路径。
2. 打开构建发布，添加 Android 任务，勾选 ChineseChess 场景并设为初始场景。
3. 设置包名（例如 `com.example.chinesechess`），只启用 Portrait 竖屏方向；按目标设备选择 ARM64 等架构。
4. 执行构建、生成 APK，必要时在 Android Studio 中检查原生工程与签名配置。
5. 发布时在随包说明或许可证页面附带 vendor/LICENSE.txt 全文。

本次未生成 APK，未修改用户的签名信息、Android 工具链或远程 main。

## 人工验收

- 场景导入后 ChessGame 无 Missing Script，预览中文字体正常。
- 棋盘比例、楚河汉界、宫线、32 子布局、红黑颜色和选中效果。
- 竖屏手机的顶部/底部安全区和不同长宽比，点击位置与棋子吻合。
- 车、马、相/象、士/仕、帅/将、炮、兵/卒的阻挡、过河和应将。
- 帅将照面、自陷被将走法被禁止；将死、困毙及和棋后锁盘。
- 吃子动画、多次连续悔棋、空历史悔棋、终局悔棋、重新开始、动画中快速点击。
- Android 真机触摸、中文字体、前后台切换、APK 安装及离线运行。
