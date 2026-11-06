# Missing Class 修复记录

## 根因与证据

本地日志 `temp/logs/project.log` 的 Missing Class 为 `60xkJ5dLtKgpzwg5pvvwY9`。用户粘贴的字符串在个别字符上与本地日志不同，本次以实际场景、meta 和 Creator 编译产物三方核对为准。

ChessGame.ts 正确使用 `@ccclass('ChessGame')` 并继承 Component。脚本 meta 的 UUID 是 `60c64279-74bb-4a82-9cf0-839a6fbf063d`，从未更换。

Creator 已成功编译脚本；其 `temp/programming/packer-driver/targets/editor` 下的 ChessGame chunk 包含：

```js
_cclegacy._RF.push({}, "60c64J5dLtKgpzwg5pvvwY9", "ChessGame", undefined);
```

引擎 `cocos/core/data/class.ts` 使用当前 RF frame.uuid 注册组件的 Class ID。因此问题不是缺少 ccclass，也不是普通 UUID 本身不一致，而是之前的场景生成器错误使用了保留 UUID 前两位的 22 字符压缩格式。Creator 的脚本注册使用保留前五位的 23 字符格式。两者即使可还原到同一个 UUID，在组件类查询时也不是相同的字符串。

## 修改文件

- `assets/scenes/ChineseChess.scene`：只将 Canvas 上现有组件的 `__type__` 修正为 Creator 的实际脚本 Class ID；节点和组件索引不变。
- `tools/cocos-class-id.cjs`：新增脚本 Class ID 编解码，区分资源 UUID 压缩格式。
- `tools/prepare-chess.cjs`：修复根源编码算法；读取已有脚本、场景 meta 的 UUID。对已有场景只修正绑定，保留节点 ID 和其他数据。
- `tools/test-scene-registration.cjs`：新增元数据、绑定、编译产物注册、构造器、ESM 引擎初始化、导入和循环依赖检查。
- `tools/test-chess.cjs`：将新测试纳入原回归入口。
- `docs/MISSING_CLASS_FIX.md`：本报告。

`ChineseChess.scene.meta`、`ChessGame.ts.meta`、ChessGame.ts、ChessRules.ts、BoardView.ts、tsconfig.chess.json 均已检查，本次无需改动。保留全部已有功能和许可证，没有删除缓存或安装文件，没有 Git 提交或 Push。

## 验证

1. 新测试在修复前稳定复现 Canvas Class ID 不一致，修复后通过。
2. `node tools/test-chess.cjs` 通过。测试直接读取 Creator 实际生成的 System.register chunk，在模拟的引擎注册边界中执行 decorator 和构造器，确认场景 ID 能找到 ChessGame，继承 Component，原 ESM 规则引擎正常初始化为 32 子和 44 个合法走法。这不是完整 Cocos 渲染测试。
3. `tsc --noEmit -p tsconfig.chess.json` 通过，无游戏代码静态错误。沿用原专项配置跳过 SDK 自身的声明检查；上游规则适配保留原 `@ts-nocheck`。
4. 相对模块导入全部存在，无循环依赖；ESM 适配不使用 DOM，不依赖 CommonJS 全局。原象棋规则和场景引用测试通过。
5. 尚未实际操纵 Creator UI 重新预览；需按以下步骤验证运行画面。

## EEXIST 独立诊断

日志中此错误发生于引擎包启动：尝试从安装目录的 `engine/native` 创建 `engine-native` 链接时，目标名字已存在。

只读检查发现：

- 现有 `C:\xunlei1\cocos\Creator\3.8.8\resources\resources\3d\engine-native` 是 Junction。
- Junction 指向旧位置 `C:\迅雷下载\cocos\Creator\3.8.8\resources\resources\3d\engine\native\`，该目标不存在。
- 当前安装下 `engine/native` 是存在的普通目录。

这说明存在安装路径迁移后遗留的失效链接，导致启动时创建链接碰撞。它先于本次场景错误发生，不能通过改场景 JSON 修复。该诊断不代表整个引擎安装已完成验证；本次没有删除、重建或修改安装目录中的任何内容。若后续处理，应先关闭使用该安装的所有 Creator 实例，再单独确认修复失效 Junction 或通过 Dashboard 修复对应安装，勿递归删除其目标目录。

## Creator 重新预览

1. 停止预览。如果场景在编辑器中仍打开且显示旧的 Missing Script，先关闭该场景，不要保存旧内存版本覆盖磁盘修复。
2. 等待资源自动刷新；必要时在资源管理器对 `ChineseChess.scene` 执行重新导入。
3. 双击打开 `assets/scenes/ChineseChess.scene`，检查 Canvas 上组件显示为 ChessGame。
4. 清空控制台后重新预览，选择 720 × 1280 竖屏；核对 32 子、合法走法、吃子动画、轮流走棋、悔棋和重新开始。
5. 如果编辑器保留旧场景状态，可正常关闭并重新打开项目，无需删除 assets、library、temp。
6. EEXIST 可能在重启时继续出现，需按上述独立诊断处理；若仍有 Missing Class，应记录清空后最新 Class ID 和首条脚本错误，避免把历史日志当成修复后错误。
