# @hyacine/plugin-article-age-warning

## 0.2.1

### Patch Changes

- fix(plugins): 修复插件系统全链路不生效问题

  - plugin-astro: 使用 jiti 安全加载 hyacine.plugin.ts 配置，修复原生 ESM import 因 TS 源文件抛错被静默吞掉的问题
  - plugin-astro: AST 注入器支持复合选择器（article.post）与后代选择器（#footer .status），修复 Windows CRLF 偏移定位
  - plugin-astro: 虚拟 .astro 插槽组件去除 \0 前缀确保 Astro 编译器正常编译，AST 注入迁移至 load 钩子
  - plugin-astro: 纯 runtime-only 插槽正确生成 DOM 挂载容器，运行时导入路径规范化（file:// → 绝对路径）
  - plugin-astro: 通过 injectScript 自动注入客户端 Runtime 初始化脚本
  - plugin-article-age-warning: 兼容 Astro 5 Content Collections 中 Date 实例类型
  - plugin-site-uptime: 默认目标选择器增加 #footer .status

## 0.2.0

### Minor Changes

- feat(plugins): introduce next-gen dual-track plugin system and official plugins

### Patch Changes

- Updated dependencies
  - @hyacine/contract@0.1.1
  - @hyacine/plugin-core@0.2.0
