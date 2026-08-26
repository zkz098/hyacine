import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://hyacine.pages.dev",
  integrations: [
    starlight({
      title: "Hyacine",
      description: "A cloud-native headless platform & AI toolchain for modern Astro blogs",
      social: {
        github: "https://github.com/zkz098/hyacine",
      },
      defaultLocale: "root",
      locales: {
        root: {
          label: "简体中文",
          lang: "zh-CN",
        },
        en: {
          label: "English",
          lang: "en",
        },
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "开始使用",
          translations: { en: "Getting Started" },
          items: [
            {
              label: "介绍",
              slug: "getting-started/introduction",
              translations: { en: "Introduction" },
            },
            {
              label: "快速上手",
              slug: "getting-started/quickstart",
              translations: { en: "Quickstart" },
            },
            {
              label: "核心架构与设计",
              slug: "getting-started/concepts",
              translations: { en: "Core Architecture" },
            },
          ],
        },
        {
          label: "博客集成指南",
          translations: { en: "Integration Guides" },
          items: [
            {
              label: "Astro Live Collections",
              slug: "guides/astro-live-collections",
              translations: { en: "Astro Live Collections" },
            },
            {
              label: "AI 向量相似图预计算",
              slug: "guides/ai-similarity-graph",
              translations: { en: "AI Similarity Graph" },
            },
            {
              label: "摘要提取与主题适配",
              slug: "guides/theme-adaptation",
              translations: { en: "Theme Adaptation" },
            },
            {
              label: "静态构建与 CI/CD 流程",
              slug: "guides/build-pipeline",
              translations: { en: "Build Pipeline & CI/CD" },
            },
          ],
        },
        {
          label: "工具套件",
          translations: { en: "Tools & Ecosystem" },
          items: [
            { label: "TypeScript SDK", slug: "tools/sdk", translations: { en: "TypeScript SDK" } },
            { label: "hyc 命令行 CLI", slug: "tools/cli", translations: { en: "CLI (hyc)" } },
            {
              label: "Tauri 桌面工作台",
              slug: "tools/desktop",
              translations: { en: "Desktop Workbench" },
            },
            {
              label: "Web 管理台 Console",
              slug: "tools/console",
              translations: { en: "Web Console" },
            },
          ],
        },
        {
          label: "部署与运维",
          translations: { en: "Deployment & Operations" },
          items: [
            {
              label: "Cloudflare 全家桶部署",
              slug: "deployment/cloudflare",
              translations: { en: "Cloudflare Deployment" },
            },
            {
              label: "Workers AI 与 BYOK 秘钥",
              slug: "deployment/ai-configuration",
              translations: { en: "AI & BYOK Setup" },
            },
            {
              label: "数据备份与迁移",
              slug: "deployment/backup-and-migration",
              translations: { en: "Backup & Migration" },
            },
          ],
        },
        {
          label: "参考与规范",
          translations: { en: "Reference & Specs" },
          items: [
            {
              label: "REST API 规范",
              slug: "reference/api-spec",
              translations: { en: "REST API Spec" },
            },
            {
              label: "CLI 参数全集",
              slug: "reference/cli-spec",
              translations: { en: "CLI Reference" },
            },
            {
              label: "Contract 类型契约",
              slug: "reference/contract",
              translations: { en: "Contract Types" },
            },
          ],
        },
        {
          label: "社区与贡献",
          translations: { en: "Community" },
          items: [
            {
              label: "贡献指南",
              slug: "community/contributing",
              translations: { en: "Contributing Guide" },
            },
          ],
        },
      ],
    }),
  ],
});
