---
title: 手把手部署我的静态博客：GitHub Pages、Cloudflare Worker 与在线后台
date: 2026-07-05
description: 这是一篇从零到上线的部署记录：如何把一个 Markdown 静态博客放到 GitHub Pages，再用 Cloudflare Worker 做在线后台，让写文章、传图片、发布更新都可以在网页里完成。
readingTime: 8
tags: [技术]
status: published
publishedAt: 2026-07-05T10:45:00.000Z
---

这篇文章记录我现在这套博客的部署方式。它不是最复杂的方案，也不是最省步骤的方案，但有一个好处：所有东西都摊开在明处，文章是 Markdown，页面是静态 HTML，部署靠 GitHub Pages，后台写入靠 Cloudflare Worker，中间没有一台需要长期维护的服务器。

适合的读者是：想自己搭一个个人博客，又希望以后能在浏览器里写文章、改文章、传图片，而不是每次都打开编辑器、敲命令、手动提交。

## 一、最终效果

部署完成后，整套系统大概是这样：

```text
读者访问
  ↓
silencegate.com
  ↓
GitHub Pages 静态页面
  ↓
HTML / CSS / JS / 图片 / RSS
```

后台发布文章时，则是另一条路径：

```text
在线后台页面
  ↓  输入后台密码
Cloudflare Worker
  ↓  使用 GitHub Token
GitHub API 写入仓库
  ↓
GitHub Actions / Pages 自动部署
  ↓
博客页面更新
```

前台和后台分开，是这套方案最重要的地方。前台只负责展示，后台负责写入，GitHub Token 永远不放进前端代码。

## 二、准备仓库

先准备一个 GitHub 仓库，用来放博客源码。我的仓库里大致是这样的结构：

```text
personal-blog/
  content/
    posts/              # Markdown 文章源文件
  uploads/              # 原始图片
  posts/                # 构建后的文章 HTML
  tags/                 # 构建后的标签页
  dist/                 # 完整构建产物
  scripts/
    build.js            # 静态站点生成脚本
  cloudflare-worker/
    src/index.js        # 在线后台 API
    wrangler.jsonc      # Worker 配置
  index.html
  blog.html
  rss.xml
```

文章源文件放在 `content/posts/`。每篇文章都是 Markdown，并带一段 frontmatter：

```markdown
---
title: 示例文章
date: 2026-07-05
description: 这里写摘要。
readingTime: 3
tags: [技术]
status: published
publishedAt: 2026-07-05T10:00:00.000Z
---

这里开始写正文。
```

其中 `date` 是页面显示和排序用的发布日期。以后想调整文章顺序，改这个日期即可。

## 三、生成静态页面

静态博客的核心是构建脚本。它做几件事：

- 读取 `content/posts/*.md`
- 解析标题、日期、标签、正文
- 把 Markdown 转成 HTML
- 生成首页、博客列表、文章页、标签页、RSS、站点地图
- 把 `dist/` 里的文件同步到仓库根目录

本地构建只需要一条命令：

```bash
npm run build
```

如果要手动提交和推送，可以这样：

```bash
git add .
git commit -m "Update blog"
git push origin main
```

GitHub Pages 会从 `main` 分支读取这些静态文件。只要仓库设置正确，推送后页面会自动更新。

## 四、配置 GitHub Pages

进入 GitHub 仓库设置：

```text
Settings
  → Pages
  → Build and deployment
  → Source: Deploy from a branch
  → Branch: main
  → Folder: /root
```

如果使用自定义域名，需要在 Pages 设置里填入域名，例如：

```text
silencegate.com
```

同时在 DNS 里把域名指向 GitHub Pages。常见做法是：

```text
A     @      185.199.108.153
A     @      185.199.109.153
A     @      185.199.110.153
A     @      185.199.111.153
CNAME www    username.github.io
```

DNS 生效后，GitHub Pages 会自动签发 HTTPS 证书。这个过程有时需要等几分钟到几十分钟，不用反复改配置。

## 五、为什么需要 Cloudflare Worker

如果只是本地写文章，GitHub Pages 已经够用。但我要的是在线后台：打开网页就能写文章、传图片、发布。

问题在于，在线后台要写 GitHub 仓库，就必须有 GitHub Token。这个 Token 不能放在浏览器里，否则任何人都能从前端源码里拿到写权限。

所以中间加一层 Cloudflare Worker：

```text
浏览器后台
  ↓  只提交文章内容和后台密码
Cloudflare Worker
  ↓  校验密码，通过后调用 GitHub API
GitHub 仓库
```

浏览器不知道 GitHub Token，只有 Worker 知道。这样即使别人打开后台页面，也拿不到仓库密钥。

## 六、创建 GitHub Token

在 GitHub 创建一个细粒度 Token，权限只给这个博客仓库。至少需要允许写入内容：

```text
Repository permissions
  Contents: Read and write
```

Token 创建后只显示一次，先保存好。后面会放进 Cloudflare Worker 的 Secret。

## 七、部署 Cloudflare Worker

进入 Worker 目录：

```bash
cd cloudflare-worker
```

先确认 Wrangler 可用：

```bash
npx wrangler --version
```

第一次部署前，需要登录 Cloudflare：

```bash
npx wrangler login
```

然后设置两个密钥：

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_PASSWORD
```

`GITHUB_TOKEN` 是刚才创建的 GitHub Token。`ADMIN_PASSWORD` 是后台登录密码。

再部署 Worker：

```bash
npx wrangler deploy
```

部署成功后，会得到一个地址，类似：

```text
https://silencegate-blog-admin.example.workers.dev
```

在线后台调用的 API 就指向这个 Worker。

## 八、Worker 负责什么

Worker 不负责页面展示，它只做后台 API。核心职责有四个：

```text
1. 校验后台密码
2. 读取 GitHub 仓库里的 Markdown 文章
3. 新增、修改、删除文章和图片
4. 调用 GitHub API 提交到 main 分支
```

简化后的逻辑大概如下：

```js
async function handleSavePost(request, env) {
  const payload = await request.json();
  verifyPassword(payload.password, env.ADMIN_PASSWORD);
  const markdown = serializePost(payload);
  await putGitHubFile({
    token: env.GITHUB_TOKEN,
    path: `content/posts/${payload.slug}.md`,
    content: markdown,
    message: `Update post: ${payload.title}`
  });
  return Response.json({ ok: true });
}
```

真实代码会多处理权限、分页、图片上传、已有文件 sha、错误返回等细节，但主线就是这样。

## 九、发布一篇文章时发生了什么

从点击“发布”到页面更新，中间流程如下：

```text
点击发布
  ↓
后台把标题、日期、标签、正文发给 Worker
  ↓
Worker 校验密码
  ↓
Worker 把内容写成 Markdown
  ↓
Worker 调用 GitHub API 提交
  ↓
GitHub Pages 重新部署
  ↓
读者看到新文章
```

如果文章里有图片，图片会先上传到 `uploads/`，正文里引用相对路径：

```markdown
![一张图片](../uploads/image-20260705000123.png)
```

构建脚本会把图片复制或压缩到输出目录，最终文章页正常显示。

## 十、常见坑

**1. 不要把 Token 写进前端。**

只要写进前端，就等于公开。Token 只能放在 Worker Secret、GitHub Actions Secret 或服务器环境变量里。

**2. 文章地址最好不要用中文。**

中文标题可以保留，但文件名和最终 URL 建议用英文或拼音首字母。例如：

```text
手把手部署我的博客 → deploy-blog-guide.html
一片叶子 → ypyz.html
```

这样分享到微信、Facebook、WhatsApp 时更稳定，也少一些编码问题。

**3. 404 页面资源要用绝对路径。**

如果用户访问 `/posts/missing.html`，GitHub Pages 会返回 404 页面。这个页面里的 CSS 不能写成：

```html
<link rel="stylesheet" href="./styles.css">
```

因为浏览器会去找 `/posts/styles.css`。应该写成：

```html
<link rel="stylesheet" href="/styles.css">
```

**4. 排序要按显示日期。**

博客列表最好按 frontmatter 里的 `date` 排序，而不是按文件修改时间。这样你在后台改发布日期后，文章顺序会自动变化。

**5. 生成文件不要手改。**

真正该改的是 `content/posts/*.md`、`styles.css`、`scripts/build.js`。`posts/*.html`、`tags/*.html`、`rss.xml` 这些都应该由构建脚本生成。

## 十一、最后的部署清单

照着做一遍，大概就是：

```text
1. 建 GitHub 仓库
2. 放入静态博客源码
3. 写好 build.js
4. 开启 GitHub Pages
5. 配好自定义域名
6. 创建 GitHub Token
7. 部署 Cloudflare Worker
8. 把 Token 和后台密码放进 Worker Secret
9. 后台调用 Worker API
10. 每次发布后由 GitHub Pages 自动更新
```

我的体会是，不要一开始就追求“平台化”。个人博客最重要的是可控、稳定、可迁移。文章用 Markdown 保存，页面生成成静态文件，后台只是辅助写入。哪一天不想用在线后台了，仓库里的文章仍然完整；哪一天不想用 GitHub Pages 了，也可以把整站搬到任何静态托管服务。

这样，博客就不只是一个网页，而是一套自己能理解、能修、能慢慢生长的写作系统。
