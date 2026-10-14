import { defineConfig } from 'vitepress'
import sidebar from './sidebar.json'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'Hello Rust',
  description: 'Rust 知识手册——语言核心、类型系统、内存与并发、异步、宏、工具链、生态工程与跨语言对照',
  base: '/hello-rust/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/hello-rust/logo.svg' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Hello Rust',

    nav: [
      { text: '首页', link: '/' },
      { text: '语言核心', link: '/language-core/' },
      { text: '类型系统', link: '/type-system/' },
      { text: '内存与并发', link: '/memory-concurrency/' },
      { text: '异步', link: '/async/' },
      { text: '宏', link: '/macros/' },
      { text: '工具链', link: '/tooling/' },
      { text: '生态与工程', link: '/ecosystem/' },
      { text: '语言对照', link: '/comparison/' },
      { text: '知识点整理', link: '/knowledge' },
      { text: '术语表', link: '/glossary' }
    ],

    sidebar: sidebar as never,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cuihairu/hello-rust' }
    ],

    footer: {
      message: 'Hello Rust',
      copyright: '© 2026 cuihairu'
    },

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
  },

  markdown: {
    lineNumbers: false
  }
})
