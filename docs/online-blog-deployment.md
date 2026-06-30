# 从本地博客到在线后台：一次个人博客部署记录

这几天把自己的个人博客从“本地写作、本地发布”，一步步改成了可以在线管理的版本。中间踩了不少坑，尤其是 GitHub Pages、Cloudflare Worker、GitHub Token、分享链接这些细节，记录下来，给以后折腾的人做个参考。

## 一、最初的结构

我的博客最开始是一个静态博客，托管在 GitHub Pages 上。

基本结构是：

- Markdown 写文章
- 构建脚本生成 HTML
- GitHub Pages 负责展示
- 本地后台负责新建、编辑、删除文章
- 发布时本地执行 Git 提交和推送

这种方式的好处是简单、稳定、免费，静态页面访问也很快。

但缺点也很明显：后台只能在本地用。换一台电脑，或者手机上想写文章，就不方便了。

## 二、为什么要做在线后台

我希望达到的效果很简单：

打开一个网页，就能写文章、改文章、传图片，然后自动发布到博客。

但这里有一个关键问题：在线后台如果要写入 GitHub 仓库，就需要 GitHub Token。

这个 Token 不能直接写在前端代码里。否则任何人打开网页源码，都能拿到 Token，等于把仓库写权限公开给全网。

所以最后采用的方案是：

```text
在线后台页面
    ↓
Cloudflare Worker
    ↓
GitHub API
    ↓
GitHub Pages 自动构建发布
```

前端只负责编辑内容；真正的 GitHub Token 放在 Cloudflare Worker 的环境变量里。

## 三、整体方案

最终架构如下：

1. GitHub Pages 托管博客前台
2. `/admin-online/` 作为在线后台页面
3. Cloudflare Worker 作为安全中转层
4. GitHub Token 存在 Worker Secret 中
5. 后台密码也存在 Worker Secret 中
6. 在线后台通过 Worker 创建、修改、删除文章
7. GitHub Actions 自动构建并发布

这样做的好处是：

- GitHub Token 不暴露
- 本地后台仍然保留
- 在线后台手机和电脑都能用
- 不需要服务器
- 成本基本为零

## 四、Cloudflare Worker 的作用

Cloudflare Worker 在这里主要做三件事：

1. 验证后台密码
2. 调用 GitHub API
3. 把文章和图片写入仓库

前端访问 Worker 时，只需要带一个后台密码。Worker 验证通过后，才会用保存在环境变量里的 GitHub Token 去操作仓库。

这一步很关键。不要把 GitHub Token 写进前端，也不要写进公开仓库。

## 五、需要配置的 Secret

Worker 里需要两个 Secret：

```text
GITHUB_TOKEN
ADMIN_PASSWORD
```

其中：

- `GITHUB_TOKEN` 用来写入 GitHub 仓库
- `ADMIN_PASSWORD` 是自己登录在线后台用的密码

GitHub Token 只需要给目标仓库的 Contents 读写权限即可，不要给太大权限。

推荐权限：

```text
Repository access: Only select repositories
Repository: personal-blog
Contents: Read and write
Metadata: Read-only
```

## 六、发布流程

配置完成后，写文章的流程变成：

1. 打开在线后台
2. 输入后台密码
3. 读取文章列表
4. 新建或编辑文章
5. 保存
6. Worker 写入 GitHub
7. GitHub Actions 自动构建
8. GitHub Pages 自动发布

整个过程不需要本地启动服务，也不需要手动 git push。

## 七、中间踩过的坑

### 1. GitHub Pages 不是实时更新

有时候代码已经推送了，但页面还是旧的，甚至会出现 404。

原因通常是 GitHub Pages 构建和 CDN 缓存还没刷新。

解决办法：

- 等几分钟
- 强制刷新浏览器
- 用无痕窗口测试
- 查看 GitHub Actions 是否完成

### 2. 自定义域名要统一

博客之前还显示 GitHub Pages 地址，后来统一改成了自己的域名：

```text
https://silencegate.com
```

需要同步修改：

- canonical
- og:url
- RSS 链接
- 分享链接
- 文章页 data-post-url

否则分享出去还是 GitHub 地址。

### 3. X 分享中文链接会断

中文文章名直接出现在 URL 里，分享到 X 时有可能链接只识别到 `/posts/`，后面的中文部分不能点击。

解决方式是分享时使用编码后的 URL：

```text
https://silencegate.com/posts/%E9%81%93%E4%B8%8D...
```

这样虽然不如中文直观，但整条链接可以正常点击。

### 4. Cloudflare API 偶尔超时

部署 Worker 或写入 Secret 时，Cloudflare API 有时会超时。

一般不是配置错了，重试一次就行。

## 八、为什么保留本地后台

虽然已经有在线后台，但我还是保留了本地后台。

原因很简单：

- 本地后台可以作为备用
- 大改文章时本地更稳
- 出问题时可以直接调试
- 在线后台只负责日常发布

这比完全依赖在线系统更安心。

## 九、目前的结果

现在博客已经具备：

- 静态博客前台
- GitHub Pages 自动部署
- 在线文章后台
- Cloudflare Worker 安全代理
- 图片上传
- 文章编辑和删除
- 阅读页分享
- 自定义域名
- 日夜模式
- 标签、搜索、存档

对一个个人博客来说，已经够用了。

## 十、总结

这次改造最大的体会是：

静态博客并不一定只能本地维护。只要把“写入仓库”这件事交给一个安全的后端代理，静态博客也可以拥有在线后台。

但有一条底线不能破：

不要把 GitHub Token 写进前端代码。

省事不能以公开写权限为代价。真正稳妥的做法，是把 Token 放在 Cloudflare Worker、Vercel Function 或其他服务端环境变量里。

个人博客不一定要复杂，但一定要可控。能写、能发、能维护，才是最重要的。
