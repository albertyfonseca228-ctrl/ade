# V2 离线 AI 开源审查

审查日期：2026-11-06。仅引用项目原始仓库及许可证，不将网站展示的棋力描述视为实测等级。

| 项目 | 许可证与 APK 分发 | 算法与依赖 | 本次结论 |
| --- | --- | --- | --- |
| [xqbase/xqwlight](https://github.com/xqbase/xqwlight) | 仓库 GPL-2.0；[search.js](https://github.com/xqbase/xqwlight/blob/master/JavaScript/search.js) 声明 GPL-2.0-or-later。商业销售并非禁止，但分发派生程序有 GPL 授权及对应源码等义务，不能当作宽松许可证代码直接并入闭源 APK。 | 搜索包含 Alpha-Beta、置换表、历史/杀手启发等；搜索与 position 分离，网页 board 使用浏览器界面。搜索是同步调用；无服务器才能运行的要求，直接并入本项目仍需模块、局面及分帧适配。项目自称较强，未在本项目测棋力。 | 已审查，不复制、不打包任何 GPL 代码或数据。 |
| [lhttjdr/xiangqi](https://github.com/lhttjdr/xiangqi) | [MIT](https://github.com/lhttjdr/xiangqi/blob/master/LICENSE)，允许商用、修改和出售，复制代码时须保留版权与许可全文。审查时 master 源码树 SHA 为 `273ebe7505119aedbc4815cb64a53c6b31b5af1a`（Git tree 对象，不是 commit）。 | TypeScript 原型项目，包含 Negamax、Alpha-Beta、迭代加深等。[迭代加深搜索](https://github.com/lhttjdr/xiangqi/blob/master/src/AI/SearchEngines/IterativeDeepeningAlphaBeta.ts) 为同步递归/循环，并依赖自己的 Board、Move、Evaluator、MoveGenerator 与 Rule；网页 UI 使用 HTML5 canvas。搜索核心没有必须依赖 Node 或服务端的设计，但不能直接替代现有 ChessAI 后保持分帧。README 说明评估较弱，未实测棋力。 | 许可证可用，但直接集成将引入第二套规则与较大异步改造。本次仅参考迭代加深这一通用算法思路，没有复制源码、评估表或开局库。 |
| [lengyanyu258/xiangqi.js](https://github.com/lengyanyu258/xiangqi.js) | BSD-2-Clause，沿用 V1 固定提交和完整 LICENSE。商用二进制分发须在附带材料中重现版权、条款和免责声明。 | 纯 JS 规则引擎，FEN、合法走法、将军/终局、移动/撤销；无 AI。现有 ES Module 适配无需 DOM、Node 或网络。 | 继续复用，作为搜索和实盘唯一规则来源。 |

## 最终来源边界

`OfflineAI.ts` 的搜索实现、评估公式及分帧逻辑，`FrameGate.ts` 的调度桥，`GameSession.ts` 的对局状态与取消机制，以及 V2 界面与测试均为本次原创代码。没有新增第三方 AI 源码或许可证依赖；通用的 Negamax、Alpha-Beta、迭代加深、吃子排序和静态评估属于本次自行实现的算法。

第三方代码仍只有 V1 的 xiangqi.js 及其 ES Module 适配。保留 `assets/scripts/vendor/LICENSE.txt`，商业 APK 发布时继续随发行材料附带其全文。当前没有采用或宣称兼容 GPL 引擎的二进制组合方案。

## Cocos / Android 兼容设计

运行时代码只使用 TypeScript/ECMAScript 与 Cocos API。搜索通过可暂停的 generator 保留调用栈和局面，`Component.update()` 驱动 `FrameGate`，让出每一帧；不是在 async 内执行一次完整同步搜索。没有 Worker、DOM、Node、服务器或网络 API，测试中的 Node、VM 和定时器只用于开发验证。

目标为 Creator 3.8.8 的 Web 与 Android JSB；目前完成 SDK 类型检查、真实源码运行与模拟引擎边界测试，尚无 Android 原生构建和真机性能数据，不能据此宣称已经真机认证。
