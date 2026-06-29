# Personal Blog

一个用 Markdown 写文章、自动部署到 GitHub Pages 的个人博客。

## 本地预览

```bash
npm run build
```

构建后的网页在 `dist/` 目录。

## 发布文章

在 `content/posts/` 新建一个 `.md` 文件，例如 `my-new-post.md`：

```md
---
title: 文章标题
date: 2026-06-29
description: 文章摘要
readingTime: 3 分钟阅读
---

这里写正文。

## 小标题

- 列表项
- 列表项
```

提交到 `main` 分支后，GitHub Actions 会自动生成首页和文章页并发布。

## GitHub Pages

仓库的 Settings -> Pages 使用 GitHub Actions 作为发布来源。工作流会执行 `npm run build`，并发布 `dist/`。
