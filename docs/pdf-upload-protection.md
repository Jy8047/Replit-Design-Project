# PDF 上传接口：最小防护实施与验收

日期：2026-10-23。范围仅为 `POST /api/profile/extract-pdf` 及其生命周期、worker 取消和测试。

## 任务验收

| 项目 | 状态 | 实现和实际证据 |
|---|---|---|
| 约 30 秒绝对截止时间 | 通过，应用入口范围内 | 从完整请求头到达处理器后开始，正文、解析共用一次计时，不因收到数据或进入解析阶段重置。真实默认配置的 HTTP 测试持续每 100ms 发送数据，约 30 秒返回 408 `UPLOAD_TIMEOUT` |
| 结束超时连接和工作 | 通过，Node 应用范围内 | 取消信号传入正文读取器和 PDF worker；错误响应标记 Connection: close，发送完成销毁请求，并有额外 1 秒强制关闭后备。解析槽位必须等 worker 终止后才能复用 |
| Content-Length 提前拒绝 | 通过 | 声明超过 10 MiB，发送请求头但不发送正文即可得到 413 `FILE_TOO_LARGE`；不分配解析槽位、不调用提取 |
| 实际流式大小限制 | 通过 | 按实际 Buffer 字节计数；无 Content-Length 的 chunked 请求超过 10 MiB 后，即使客户端不结束正文，也返回 413。边界恰好 10 MiB 的读取测试通过 |
| 缺少 Content-Length 的正常上传 | 通过 | 真正生成的 PDF 使用 chunked 传输，提取出文件中的合成文字，不根据文件名返回资料 |
| 拒绝压缩正文 | 通过 | 仅接受未设置编码或 identity；gzip、deflate、br、混合和未知编码均在读取正文前返回 415 `UNSUPPORTED_ENCODING`，不进行解压 |
| 防止通用解析器提前解压 | 通过 | PDF 路由移到全局 JSON/urlencoded 解析器之前；实际 app 的 gzip + application/json 请求得到本接口 415，而不是先进入 JSON 解压 |
| 上传中断开 | 通过 | 停止正文读取，清理缓冲和监听器，释放槽位；后续请求仍可用 |
| 正文完成后、解析中断开 | 通过 | 通过 response close 检测断开并取消提取；等待提取终止后释放槽位 |
| 解析失败和并发回收 | 通过 | 连续真实损坏 PDF 失败后正常 PDF 可用；两个超时上传后槽位可用；受控取消测试证明旧解析未结束时不能提前复用其槽位 |
| 其他模块／付费调用边界 | 通过本轮回归 | 无匹配/规划业务修改；公开路由不接模型客户端，付费模式仍在读取正文前拒绝；未新增登录、数据库、服务或依赖 |

## 实现说明

- 保留现有 10 MiB、单进程最多 2 个并发和每分钟 10 次接收限制。
- 用端点内的有界流读取器替代 `express.raw`：不解压、不等待排空无限拒绝正文；超过限制时清理已缓存块并暂停接收。总量限制按实际正文流字节数执行，而不是只看请求头。
- 无 Content-Length 的合法 HTTP/1.1 上传使用 chunked；这不表示支持没有合法 HTTP 请求体边界的上传协议。
- 非法/超限/超时请求关闭连接，不尝试复用尚有未读正文的连接。
- 正常成功与各失败分支均清理截止时间和生命周期监听器；并发释放是幂等操作。
- worker 的现有 15 秒解析上限、256 MiB JS old-generation / 4 MiB stack、页数/文字限制、空环境变量和禁用 PDF JS 求值均保留。请求取消会终止 worker；提取 Promise 等待终止完成，避免不断断开连接绕过并发上限。
- 测试可在服务端工厂中缩短截止时间以覆盖取消时序，不能延长超过 30 秒；HTTP 客户端没有设置该值的接口。另有真正运行默认 30 秒的测试，未仅靠缩短时间或假定时器宣称通过。
- 两种输入方式、确认边界、标准 JSON、模拟来源标记和既有职业匹配接口保持不变。

### 错误响应

| HTTP | code | 含义 |
|---|---|---|
| 408 | UPLOAD_TIMEOUT | 应用层请求绝对截止时间到达 |
| 413 | FILE_TOO_LARGE | 声明或实际接收正文超过现有大小限制 |
| 415 | UNSUPPORTED_ENCODING | 不接受压缩或未知编码的请求正文 |
| 400 | INVALID_UPLOAD / UPLOAD_ABORTED | 无效／取消的上传；客户端已断开时不再尝试发送 JSON |

其余既有错误码继续使用。正文从文件字节提取，错误不回显 CV 内容、密钥或内部异常。前端未新增 UI，未知错误沿用既有通用提示。

## 实际测试与构建

新增 `cv-upload-protection.test.ts` 共 **14 项**：

1. 超大 Content-Length，只有请求头即可拒绝。
2. 无 Content-Length、chunked + identity 的真实 PDF。
3. 超限 chunked 正文尚未结束即拒绝。
4. 读取器恰好 10 MiB 边界。
5. gzip/deflate/br/混合/未知编码拒绝。
6. 实际 app 中错误 JSON 类型不绕过拒绝，普通 PDF 仍工作。
7. 默认 30 秒下持续慢速发送，仍触发绝对截止时间。
8. 两个不完整上传超时后，两个槽位均恢复。
9. 上传中断开不触发提取，后续可用。
10. 提取超时传递取消信号，提取尚未结束前不提前释放槽位。
11. 正文完成后断开，取消提取并回收槽位。
12. 上传及解析共用一个计时，不在解析开始时重置。
13. 连续损坏 PDF 解析失败后真实正常 PDF 仍可提取。
14. 真实 PDF worker 取消可结束，预先取消的提取不启动工作。

其中资源调度的受控提取替身仅用于观察槽位与取消时序，明确使用合成数据；边界字节数组并不冒充有效 PDF 或真实 AI 结果。正常 PDF、损坏 PDF 和 worker 取消均有真实解析测试。

| 命令／检查 | 实际结果 |
|---|---|
| `pnpm --filter @workspace/api-server run test:cv` | **37/37 通过**，含新增 14 项 |
| `pnpm --filter @workspace/api-server run test:ocr` | **14/14 通过**；离线适配器，不等于真实 OCR |
| `pnpm --filter @workspace/career-pathways test` | **33/33 通过** |
| 自动化总计 | **84 通过，失败／取消／跳过均为 0** |
| `pnpm run typecheck` | 全工作区通过 |
| `pnpm --filter @workspace/api-server run build` | 通过 |
| `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/career-pathways run build` | 通过；既有 tooltip.tsx source-map 警告仍存在 |
| API 工作流重启、日志 | 重新打包后正常启动 |
| `profile-handoff.e2e.mjs` | **4 条完整浏览器旅程通过**，PDF/在线 × 应届/转行；4 次真实本地 API 上传，0 RunPod 请求、0 运行时异常，无伪造成功响应 |
| `/profile` 截图 | 页面正常显示 |

## 实际修改文件

- `artifacts/api-server/src/routes/cv-extraction.ts`：有界流读取、提前检查、全请求计时、取消和幂等槽位释放。
- `artifacts/api-server/src/lib/pdf-extraction.ts`：接受可选取消信号，等待 worker 实际终止再结束提取。
- `artifacts/api-server/src/app.ts`：仅将 PDF 路由挂载到通用正文解析器之前。
- `artifacts/api-server/src/routes/index.ts`：移除原来的 PDF 重复挂载；其他路由保留。
- `artifacts/api-server/tests/cv-upload-protection.test.ts`：14 项测试。
- 本报告与原安全交接报告的后续链接。

无包升级、接口 JSON 结构变更或其他队友业务逻辑修改。

## 遗留风险／未验证

1. **不覆盖请求头尚未完整到达应用的阶段。** 计时起点是 Node 向 Express 交付完整请求头。慢请求头、TCP 握手、代理排队/缓冲、代理自身超时和外部网络中的实际关闭时延未在本轮验证。不能把本地 30 秒测试当作平台全链路保证。
2. **不是硬实时或完整内存隔离。** Node 事件循环严重阻塞可能延迟定时器；JS 堆限制不是进程整体 RSS/原生内存限制，worker 也不是 OS 沙箱。恶意 PDF 的内存峰值、原生调用异常和公众压力表现未做破坏性试验。
3. **仍然匿名。** 单进程全局名额可以被一个客户端消耗，且重启重置、不是分布式限额。本轮改善单请求占用，不等于实现按用户授权或防御所有 DoS。
4. **付费模型仍断开。** 未调用真实 RunPod/GLM、未读取或打印 API Key、未新增基础设施、未部署/推送/公开发布。不能因为上传防护通过就启用付费映射。
5. 上一轮依赖扫描遗留高危不在本次修复范围；未重新扫描或声称它们已修复，见原安全交接报告。

**交付判断：本次约定的 PDF 应用层最小防护已实现并通过验证，可以用于有条件内部交接；不构成公网抗压或平台级安全验收。**
