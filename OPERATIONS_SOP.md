# netops.sh 博客运维 SOP

> 站点：https://joshzuonet.cloud （含 www 跳转）
> 技术栈：Astro 7 静态站 + GitHub + Cloudflare Pages 自动部署
> 本机路径：`/Users/bytedance/Documents/my-blog`
> 仓库：github.com/chargyzuo/my-blog（分支 `main`）

---

## 0. 架构与部署链路（先理解，再操作）

```
本地编辑 (macOS)  ──git push──▶  GitHub(main)  ──webhook──▶  Cloudflare Pages
                                                              ├─ npm run build
                                                              └─ 发布到 CDN 边缘
                                                                     │
                        joshzuonet.cloud / www  ◀── CNAME/SSL 自动 ──┘
```

- **唯一发布方式**：向 `main` 分支 `git push`。Cloudflare Pages 监听到提交后自动构建并上线，无需手动操作 CF 控制台。
- **DNS**：`joshzuonet.cloud` 的 NS 已托管在 Cloudflare（olof / dina）。CNAME 与 SSL 由 Pages 自动维护。
- **旧域名** `779260457.xyz` 已从本项目移除，NS 回归阿里云，仅服务 DDNS 主机（win / win2），与博客无关，勿再改动。

### 环境要求
| 项 | 要求 |
|---|---|
| Node | ≥ 22.12.0（当前本机 v24） |
| 包管理 | npm |
| Astro | ^7.1.6 |

---

## 1. 日常发布：新增一篇文章（最高频操作）

1. **进目录并同步最新代码**
   ```bash
   cd /Users/bytedance/Documents/my-blog
   git pull origin main
   ```
2. **新建文章文件**：在 `src/content/blog/` 下建 `<英文短横线标题>.md`，文件名即 URL（如 `bgp-troubleshooting.md` → `/blog/bgp-troubleshooting/`）。
3. **写 frontmatter**（字段受 `src/content.config.ts` schema 校验，写错构建会失败）：
   ```markdown
   ---
   title: '文章标题'
   description: '一句话摘要，会出现在列表页和 SEO'
   pubDate: 'Aug 29 2026'
   # updatedDate: 'Sep 01 2026'   # 可选，更新日期
   # heroImage: '../../assets/xxx.jpg'  # 可选，封面图
   ---

   正文用 Markdown……
   ```
   - `title` / `description` / `pubDate` **必填**；`updatedDate` / `heroImage` 可选。
   - `pubDate` 支持 `Mon DD YYYY` 或标准日期字符串。
4. **本地预览**（可选但推荐）
   ```bash
   npm run dev        # 打开 http://localhost:4321 检查排版
   ```
5. **本地构建自检**（关键，能提前拦截 frontmatter/语法错误）
   ```bash
   npm run build
   ```
   看到 `[build] Complete!` 且无红色报错即可。
6. **提交并发布**
   ```bash
   git add -A
   git commit -m "post: <文章标题>"
   git push origin main
   ```
7. **验证上线**（推送后约 1–2 分钟）
   ```bash
   curl -sI https://joshzuonet.cloud/blog/<文章 slug>/ | head -1   # 期望 HTTP/2 200
   ```

---

## 2. 修改现有内容 / 站点配置

| 想改什么 | 改哪里 |
|---|---|
| 站点标题、描述、作者、标语 | `src/consts.ts`（`SITE_TITLE` / `SITE_DESCRIPTION` / `AUTHOR` / `TAGLINE`） |
| GitHub / LinkedIn / 邮箱等社交链接 | `src/consts.ts` 的 `SOCIAL` 对象 |
| 站点根域名（sitemap / RSS / canonical 绝对地址） | `astro.config.mjs` 的 `site` 字段（当前 `https://joshzuonet.cloud`） |
| 页面布局 / 组件 / 样式 | `src/layouts/`、`src/components/`、`src/pages/` |
| 文章正文 | `src/content/blog/*.md` |

改完后**一律走**：`npm run build` 自检 → `git commit` → `git push origin main`。

> ⚠️ 改了根域名 `site` 后，务必确认 Cloudflare Pages 自定义域名与之一致，否则 sitemap/RSS 里的绝对链接会指向错误域名。

---

## 3. 部署状态排查

**推送后网站没更新？** 按顺序排查：

1. **确认提交已到 GitHub**
   ```bash
   git log origin/main -1 --oneline
   ```
2. **看 Cloudflare Pages 构建日志**：CF 控制台 → Workers & Pages → 对应项目 → Deployments，确认最新一次是 `Success`。构建失败通常是 frontmatter 不合 schema 或依赖问题——本地 `npm run build` 能复现。
3. **CDN 缓存未刷新**：等 1–2 分钟，或带随机参数绕过缓存验证：
   ```bash
   curl -sI "https://joshzuonet.cloud/?t=$(date +%s)" | head -1
   ```
4. **强刷缓存**（确需时）：CF 控制台 → 该域名 → Caching → Purge Everything。

---

## 4. 域名 / HTTPS / DNS 健康检查

定期（或异常时）执行：

```bash
# 主域名与 www 是否 200 且走 Cloudflare
curl -sI https://joshzuonet.cloud       | grep -iE "^HTTP|server|cf-ray"
curl -sI https://www.joshzuonet.cloud   | grep -iE "^HTTP|server"

# DNS 解析（Google DoH，免本地缓存干扰）
curl -s "https://dns.google/resolve?name=joshzuonet.cloud&type=A"
curl -s "https://dns.google/resolve?name=www.joshzuonet.cloud&type=CNAME"

# SSL 证书有效期
echo | openssl s_client -servername joshzuonet.cloud -connect joshzuonet.cloud:443 2>/dev/null | openssl x509 -noout -dates
```

- SSL 由 Cloudflare 自动续期，正常无需人工干预；若证书异常，去 CF 控制台该域名 → SSL/TLS → Edge Certificates 检查。
- Cloudflare Pages 自定义域名当前应**仅**保留 `joshzuonet.cloud` 与 `www.joshzuonet.cloud` 两条，均为 Active。

---

## 5. 依赖与版本维护（低频，季度性）

```bash
cd /Users/bytedance/Documents/my-blog
git pull origin main
npm outdated              # 查看可升级依赖
npm update                # 升级次要版本
npm run build             # 必须构建通过再提交
git add -A && git commit -m "chore: update deps" && git push origin main
```

- 升级 Astro 大版本（如 7→8）前，先读 release notes，并单开分支验证，切勿直接推 `main`。
- 保证 Node ≥ 22.12.0，否则 Astro 7 无法构建。

---

## 6. 回滚（发布出问题时的急救）

**方式 A —— Cloudflare 一键回滚（最快）**：CF 控制台 → 项目 → Deployments → 选中上一个正常版本 → `Rollback to this deployment`。立即生效，不动代码。

**方式 B —— Git 回退**：
```bash
git log --oneline -5              # 找到要回退到的 commit
git revert <坏提交的 hash>         # 生成一个反向提交（推荐，保留历史）
git push origin main             # 触发重新部署
```
> 生产分支优先用 `git revert` 而非 `reset --hard`，避免改写已推送历史。

---

## 7. 关键约定 / 红线

- **只从本机 `main` 推送发布**，不要在 CF 控制台手动传文件，以免与 Git 状态不一致。
- **每次 push 前先 `npm run build` 自检**，frontmatter 字段错误是最常见的构建失败原因。
- **文件名即 URL**：改文章文件名会改变链接并可能造成 404，重命名后注意站内引用与外链。
- **不要动旧域名 `779260457.xyz`**：它已脱离本项目，专供 DDNS。
- **敏感信息不入库**：`.md`、`consts.ts` 里不要写私人邮箱/密钥以外的敏感内容（当前联系邮箱 `hello@joshzuonet.cloud`）。

---

## 附：常用命令速查

```bash
cd /Users/bytedance/Documents/my-blog   # 进目录
git pull origin main                     # 同步
npm run dev                              # 本地预览 (localhost:4321)
npm run build                            # 构建自检
git add -A && git commit -m "msg" && git push origin main   # 发布
curl -sI https://joshzuonet.cloud | head -1                 # 验证上线
```
