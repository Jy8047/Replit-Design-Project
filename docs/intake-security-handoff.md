# Personal Profile / Intake Layer：交付前安全告警核查

日期：2026-10-23。范围：依赖告警、公开 PDF 输入层、回归测试。仅使用合成资料。

最新依赖复扫与修复见 [20 项高危逐项复核](dependency-security-review.md)：本轮已由高危 20 降至 1，严重保持 0；本文件下文的旧计数作为历史记录保留。

后续更新：本报告第 4 节提出的绝对上传截止时间、Content-Length 提前检查和禁用压缩正文，已在后续任务实现并验证，见 [PDF 上传防护验收](pdf-upload-protection.md)。下文保留原核查时点记录；依赖告警数量并非后续任务重新扫描结果。

## 结论与边界

**可有条件内部交接，不等于公开上线安全验收通过。**

条件：本轮清理后项目不包含 RunPod/GLM 客户端；仅使用可信仓库、固定本地 OpenAPI/CSS/构建输入；团队接受下述未修复开发工具告警及匿名上传的可用性风险。若交付要求零高危告警、处理不可信构建输入，或直接向不受控公众开放上传，则尚不满足该交付标准。

本轮未新增认证、数据库或基础设施，未改匹配/学习路线/SDG/情景业务逻辑，未读取或打印 API Key，未连接真实模型、部署、推送或公开仓库。未证明平台级预览访问保护；界面 “Private workspace” 文案不构成访问控制证据。

## 1. 实际扫描结果

| 工具 | 修改前 | 修改后 | 解释 |
|---|---|---|---|
| OSV 依赖扫描 | 严重 12、高危 23、中危 14、低危 4 | 严重 0、高危 20、中危 7、低危 2 | 按告警记录计数，不等于独立可利用漏洞/依赖数量 |
| SAST | 本轮未做修改前基线 | 0 条结果，`incomplete=false` | 实际返回 `results` 数组；不表示无任何漏洞 |
| 隐私扫描 | 本轮未做修改前基线 | 0 条 `vulnerabilities` | 不替代人工审核、运行时数据审计或 GitHub 扫描 |

扫描覆盖工作区；通过完整 `pnpm -r list --depth Infinity --json` 逐级检查各工作区的生产/开发依赖链。剩余 20 条高危均在 `devDependencies` 根链下，不在当前 API 的生产依赖链中。开发依赖不是自动安全：Vite 实际运行于预览，构建工具也会执行代码。

## 2. 已修复告警与兼容性

| 受影响包 | 实际路径与原风险 | 实际修改和验证 |
|---|---|---|
| `proxy-addr` 2.0.7，严重 1 条 | API 生产依赖：Express → proxy-addr。错误的短前缀 IPv4-mapped IPv6 信任子网可导致伪造来源 IP；当前实际 app 的 `trust proxy=false`，未使用 IP 授权/按 IP 限流，未发现原触发配置 | Express 5.2.1 → 5.3.0，同主版本；实际传递依赖为 proxy-addr 2.0.8。新增行为回归验证错误子网不再信任外部 IP，同时普通/正确 mapped 子网仍正确 |
| Orval 8.20.0，严重 11、高危 1 条 | `api-spec` 开发依赖。恶意 OpenAPI 的默认值/字段名/路径等可能注入生成代码；外部 `$ref` 涉及 SSRF/文件包含。当前配置输入为仓库内 `openapi.yaml`，检查其 `$ref` 均为 `#/` 内部引用；PDF 不进入代码生成器 | Orval 8.22.0，同主版本最低覆盖这些扫描告警的版本。真实 codegen、公共库 TS 和下游回归通过；生成文件差异只有生成器版本注释，无接口/校验逻辑差异 |
| Vite 7.3.6，高危 1 条 | 前端与 sandbox 开发依赖；该高危为 Windows 编辑器启动路径的命令注入，当前 Linux 不满足操作系统条件，但团队可能使用 Windows；其他 Vite 中/低危不据此一概排除 | 共享 catalog 下限改为 7.3.7，实际解析为 7.3.7；两个前端构建、启动和主应用浏览器测试通过 |
| PostCSS 8.5.16，高危 1 条及中危告警 | Vite → PostCSS：不可信 CSS 的 sourceMappingURL 可触及本地文件读取；当前样式来自可信仓库，不是上传 PDF | Vite 更新后传递依赖变为 PostCSS 8.5.31；该链 source-map-js 更新至 1.2.2。Tailwind 链仍有另一份旧 source-map-js，不能声称该包在整个工作区已清零 |

已实际核对 proxy-addr、Orval 和 Vite 的 GitHub 公告页面。其余风险说明以本次扫描返回的公告描述与实际安装树为依据，未进行破坏性 OOM/耗尽攻击试验。

## 3. 未修复的高危：有效告警，具体暴露面仍待核实

下表并非“误报”或“已缓解完毕”。当前公共 PDF 路径未发现可达调用，但不可信构建输入、插件或未来改动下的可利用性尚未完整实测。

| 版本、数量 | 实际依赖链 | 触发条件 / 剩余处理 |
|---|---|---|
| brace-expansion 5.0.7，4 高危 | api-spec → Orval → TypeDoc → minimatch | 不可信 brace/glob 模式导致栈/内存耗尽；扫描给出的覆盖修复目标为 5.0.12 |
| braces 3.0.3，1 高危 | mockup-sandbox → fast-glob → micromatch | 深层嵌套模式导致栈耗尽；扫描未给修复版本，不擅自修改队友 sandbox 或声称已修复 |
| Browserslist 4.28.4，2 高危 | 两个前端 → plugin-react → Babel → helper-compilation-targets | 不可信自定义统计/查询导致原型写入、进程退出或缓存内存增长；候选修复 4.28.7 |
| fast-uri 3.1.3，7 高危 | api-spec → Orval → scalar/openapi-parser → ajv | 对不可信 URI 做主机/SSRF 策略判断时的解析差异；高危覆盖目标 3.1.7，连同中危为 3.1.8 |
| js-yaml 4.2.0，3 高危 | api-spec → Orval | 恶意 YAML merge/omap 导致 CPU 耗尽；覆盖目标 4.3.2 |
| markdown-it 14.3.0，2 高危 | api-spec → Orval → TypeDoc | 不可信 Markdown 触发二次复杂度；一项需要 typographer，另一项默认选项也受影响；覆盖目标 14.3.3 |
| source-map-js 1.2.1，1 高危 | 两个前端 → tailwindcss/vite → tailwindcss/node | 恶意索引 source map section offset 可阻塞事件循环；候选修复 1.2.2 |

为何未继续全量升级：已优先修复生产依赖和正在运行的 Vite；剩余链不接受当前 PDF/档案输入。尝试定向刷新间接依赖后，安装树仍保留以上旧副本，因此明确列为未修复。后续应由相关工具链负责人与模块负责人协调父包/传递版本更新并验证 codegen、CSS 与 sandbox；本轮未引入强制 override、替代 glob 库、跨主版本升级或压制告警。存在候选新版不意味着已经升级或验证兼容。

中/低危仍有 9 条，未在本轮全部修复。包括需要跨主版本评估的 postcss-selector-parser、ts-deepmerge，以及 baseline-browser-mapping、brace-expansion、fast-copy、fast-uri、markdown-it、esbuild 的告警。不将“仅开发依赖”当成忽略理由；不签署全项目告警清零结论。

### 公告索引（高危与严重）

- proxy-addr：GHSA-jqcg-44mw-7w3h。来源：https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h
- Orval：GHSA-2h9g-j24r-h63g、GHSA-2w86-xfrc-g85r、GHSA-3575-w9fc-c2j6、GHSA-6437-gxhq-pqv8、GHSA-653q-5476-x79g、GHSA-6mr6-jvcr-2f25、GHSA-88f2-fpv8-89q2、GHSA-8j6p-r8jg-mxqh、GHSA-fg9p-mrxr-hvq7、GHSA-p4cg-3328-rvfg、GHSA-w727-8j6c-2rj4；高危 GHSA-cxq5-97v7-87j8。来源示例：https://github.com/advisories/GHSA-2h9g-j24r-h63g
- Vite：GHSA-587h-7wmj-h5pm。来源：https://github.com/advisories/GHSA-587h-7wmj-h5pm
- PostCSS：GHSA-r28c-9q8g-f849。
- brace-expansion：GHSA-6j4f-fj2g-mc7p、GHSA-mh99-v99m-4gvg、GHSA-qhr7-859c-m2p7、GHSA-rgw5-rvv9-x895。
- braces：GHSA-vfj7-8cjw-p6xm。
- Browserslist：GHSA-73wf-gq98-2v4g、GHSA-c83g-rgw3-j3cx。
- fast-uri：GHSA-5jgf-p345-68v8、GHSA-7p8r-x3mc-p8w7、GHSA-f65p-4m7j-42xc、GHSA-fph4-wmhf-6fwf、GHSA-jqff-g426-hqxp、GHSA-qw65-cvwx-89v3、GHSA-v2hh-gcrm-f6hx。
- js-yaml：GHSA-2883-xcg3-v3hh、GHSA-52cp-r559-cp3m、GHSA-5p4m-2wfm-xmqj。
- markdown-it：GHSA-gfr2-rv44-r23c、GHSA-r7fv-28h4-cvq7。
- source-map-js：GHSA-68fv-2mgg-jv7q。

## 4. 匿名 PDF 上传：已有保护与最小建议

**仍是匿名接口，不是已经解决访问授权。** 同意头、跨站检查、CORS、全局限流均不是身份认证。

已检查现有实现，并通过真实 HTTP/浏览器及单元测试验证相应分支：

- `POST /api/profile/extract-pdf` 的 `map_profile=true` 在解析前返回 403；伪造身份/配置头不能打开付费路径。公开路由只依赖本地提取和规则模拟，无真实客户端入口；服务端模型配置保持禁用、不读取密钥。
- 原始 PDF 最大 10 MiB；实际校验字节而不是文件名。扫描/空白文件返回需要 OCR，不编造文字。
- 单进程并发最多 2 个，每分钟最多接收 10 次；已有 429 和释放并发槽测试。这是全局可用性后备，不是每用户配额。
- 解析 worker 为 15 秒截止、256 MiB JS old-generation / 4 MiB stack、空环境变量、最多 30 页及 60,000 字符；禁用 PDF JS 求值，不渲染图片。此堆限制不是整个进程 RSS 限制，worker 也不是操作系统沙箱。
- 响应不缓存；日志不记录档案正文、原始请求头或解析器堆栈。

**剩余风险**：任何 HTTP 客户端仍可消耗匿名解析预算；单个客户端可耗尽全局名额影响他人；限制随进程重启重置、非分布式；未设置输入层专用的绝对上传截止时间；慢速请求可占槽；未验证总体 RSS 峰值、平台请求超时和公网压力下表现。body parser 当前默认支持解压，解压发生于 worker 之外，不应误称所有预处理均受 worker 超时约束。

不加登录/数据库的最小后续建议（本轮未实施，不写为已通过）：

1. 给此路由增加约 30 秒的绝对上传截止时间，超时中止请求并正确释放槽位；仅 idle timeout 不足以防持续慢速发送。
2. 在读取正文前拒绝明确超限的 Content-Length，并保留流式 10 MiB 限制以覆盖 chunked/错误声明；拒绝非 identity Content-Encoding，避免不需要的压缩预处理成本。
3. 保留并发/频率上限，仅在受控团队环境用合成数据演示；若需要公众压力保障，再评估基础设施，不把本轮结果作为其证明。
4. 真实模型继续关闭且不连接匿名入口；未来启用前另行完成可靠调用授权、调用额度/费用上限与异常中止设计。不能仅靠开关、同意头或 CORS 开通付费 API。

## 5. 实际回归证据

| 检查 | 本轮结果 |
|---|---|
| `pnpm --filter @workspace/api-server run test:cv` | 23/23，通过；新增 2 项为真实 app 信任配置、真实 Express 传递依赖的子网回归 |
| `pnpm --filter @workspace/api-server run test:ocr` | 14/14，通过；离线适配器测试，不证明真实 OCR 已接通 |
| `pnpm --filter @workspace/career-pathways test` | 33/33，通过；含档案、存储与现有匹配/规划回归 |
| 自动化测试总计 | 70，通过 70，失败/跳过均为 0 |
| `pnpm run typecheck` | 通过：公共库及 API、主前端、sandbox、scripts |
| Orval codegen | 通过；生成接口/校验业务代码无差异 |
| API、主前端、sandbox 构建 | 均通过；主前端仍有既有 tooltip.tsx source-map 警告，不阻塞构建 |
| 重启现有 3 个工作流 | 均启动；Vite 实际运行版本 7.3.7，API 使用重新打包产物 |
| `profile-handoff.e2e.mjs` | 4 条完整旅程通过：PDF/在线 × 应届/转行；实际 PDF → 规则模拟 → 编辑 → 未确认隔离 → 确认 → 匹配 → 刷新保持 |
| 同一浏览器回归的附加断言 | 非 PDF/空/超限/假 PDF 拒绝；未确认存储不进入匹配；4 次真实本地 API 上传，0 RunPod 请求、0 运行时异常、未拦截伪造成功响应 |
| 页面截图 | 正确路由 `/profile` 正常显示；`/my-profile` 不是现有路由，不新增别名 |

本地秘密模式检查：248 个当前候选文件、37 个本地提交、333 个可达 blob；0 疑似秘密，15 处已知虚构测试占位，0 跳过。只报告计数/路径，不读环境密钥值。GitHub 远端告警、权限、Push Protection、远端独有历史未验证。启发式本地扫描不等于仓库完全无秘密的保证。

## 6. 实际改动文件

- `artifacts/api-server/package.json`：Express 最低版本提高至 ^5.3.0。
- `lib/api-spec/package.json`：Orval 最低版本提高至 ^8.22.0。
- `pnpm-workspace.yaml`：共享 Vite 最低版本提高至 ^7.3.7；现有平台二进制排除配置保留。
- `pnpm-lock.yaml`：实际依赖树更新；未手工编辑 lock。
- `lib/api-client-react/src/generated/*`、`lib/api-zod/src/generated/*`：仅生成器版本注释更新；清除了 codegen 自动追加的重复导出，原导出接口不变。
- `artifacts/api-server/tests/cv-dependency-security.test.ts`：2 项新回归测试。
- 本报告及原验收报告的后续核查链接。无应用业务源代码修改。
