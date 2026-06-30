# Personal Blog

一个用 Markdown 写文章、自动部署到 GitHub Pages 的个人博客。

## 本地预览

```bash
npm run build
```

构建后的网页在 `dist/` 目录。

## 本地写作后台

```bash
npm run studio
```

打开 `http://127.0.0.1:4173/admin/`，可以新建、编辑、删除文章。每次保存或删除后，都会更新 `content/posts/*.md`，并重新构建 `dist/`。

编辑文章时点击“插入图片”，图片会保存到 `uploads/`，并自动把 Markdown 图片语法插入正文。构建后图片会复制到 `dist/uploads/`。

后台支持：

- 标签：多个标签用英文逗号分隔。
- 草稿：状态选择“草稿”后不会出现在前台。
- 自动摘要：摘要留空时从正文自动摘取。
- 阅读量：本地 Studio 运行时会记录文章阅读量，并显示在后台文章列表。
- 一键发布：点击“发布到 GitHub”会执行构建、提交并推送。

前台支持搜索页、标签页、文章目录、RSS 订阅和基础 SEO/Open Graph 信息。

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
