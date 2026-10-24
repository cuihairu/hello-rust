import { defineConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress'
import enSidebar from './sidebar.en.json'
import zhSidebar from './sidebar.zh.json'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  // review/ holds raw archival records (pasted tool logs); not site pages and
  // their relative links resolve outside the doc root, so keep them out.
  srcExclude: ['review/**'],
  title: 'Hello Rust',
  description:
    'Rust notes and hands-on measurements by a game developer: language core, type system, memory and concurrency, async, macros, toolchain, ecosystem engineering and cross-language comparison.',
  base: '/hello-rust/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  // English lives on the root, Chinese under /zh/.
  locales: {
    root: { label: 'English', lang: 'en-US' },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description:
        '游戏开发者的 Rust 笔记与实测——语言核心、类型系统、内存与并发、异步、宏、工具链、生态工程与跨语言对照'
    }
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/hello-rust/logo.svg' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Hello Rust',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/cuihairu/hello-rust' }
    ],
    footer: {
      message: 'Hello Rust',
      copyright: '© 2026 cuihairu'
    },
    locales: {
      root: {
        label: 'English',
        lang: 'en-US',
        themeConfig: {
          nav: [
            { text: 'Home', link: '/' },
            { text: 'Language Core', link: '/language-core/' },
            { text: 'Type System', link: '/type-system/' },
            { text: 'Memory & Concurrency', link: '/memory-concurrency/' },
            { text: 'Async', link: '/async/' },
            { text: 'Macros', link: '/macros/' },
            { text: 'Toolchain', link: '/tooling/' },
            { text: 'Ecosystem', link: '/ecosystem/' },
            { text: 'Comparison', link: '/comparison/' },
            { text: 'Notes Index', link: '/knowledge' },
            { text: 'Glossary', link: '/glossary' }
          ],
          sidebar: enSidebar as DefaultTheme.SidebarItem[],
          search: { provider: 'local' },
          outline: {
            label: 'On this page',
            level: [2, 3]
          },
          docFooter: {
            prev: 'Previous page',
            next: 'Next page'
          },
          lastUpdated: {
            text: 'Last updated'
          }
        }
      },
      zh: {
        label: '简体中文',
        lang: 'zh-CN',
        link: '/zh/',
        themeConfig: {
          nav: [
            { text: '首页', link: '/zh/' },
            { text: '语言核心', link: '/zh/language-core/' },
            { text: '类型系统', link: '/zh/type-system/' },
            { text: '内存与并发', link: '/zh/memory-concurrency/' },
            { text: '异步', link: '/zh/async/' },
            { text: '宏', link: '/zh/macros/' },
            { text: '工具链', link: '/zh/tooling/' },
            { text: '生态与工程', link: '/zh/ecosystem/' },
            { text: '语言对照', link: '/zh/comparison/' },
            { text: '项目笔记索引', link: '/zh/knowledge' },
            { text: '术语表', link: '/zh/glossary' }
          ],
          sidebar: zhSidebar as DefaultTheme.SidebarItem[],
          search: {
            provider: 'local',
            options: {
              translations: {
                button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
                modal: {
                  noResultsText: '没有找到结果',
                  resetButtonTitle: '清除查询条件',
                  footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
                }
              }
            }
          },
          outline: {
            label: '页面导航',
            level: [2, 3]
          },
          docFooter: {
            prev: '上一篇',
            next: '下一篇'
          },
          lastUpdated: {
            text: '最后更新'
          },
          returnToTopLabel: '回到顶部',
          sidebarMenuLabel: '菜单',
          darkModeSwitchLabel: '外观',
          lightModeSwitchTitle: '切换到浅色模式',
          darkModeSwitchTitle: '切换到深色模式'
        }
      }
    }
  },

  markdown: {
    lineNumbers: false
  }
})
