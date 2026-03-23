import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Corydora',
  description: 'Provider-neutral overnight AI code scrubbing CLI',
  base: '/corydora/',

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/corydora/logo.png' }],
    ['meta', { property: 'og:title', content: 'Corydora' }],
    ['meta', { property: 'og:description', content: 'Cleaning Your Code While You Sleep' }],
    ['meta', { property: 'og:image', content: '/corydora/logo.png' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'Corydora',

    nav: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Quickstart', link: '/quickstart' },
          { text: 'How It Works', link: '/how-it-works' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI Reference', link: '/cli-reference' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Providers', link: '/providers/' },
          { text: 'Agents', link: '/agents/' },
        ],
      },
      { text: 'Security', link: '/security' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Quickstart', link: '/quickstart' },
            { text: 'How It Works', link: '/how-it-works' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'CLI Reference', link: '/cli-reference' },
            { text: 'Configuration', link: '/configuration' },
          ],
        },
        {
          text: 'Providers',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/providers/' },
            { text: 'Claude CLI', link: '/providers/claude-cli' },
            { text: 'Codex CLI', link: '/providers/codex-cli' },
            { text: 'Gemini CLI', link: '/providers/gemini-cli' },
            { text: 'Anthropic API', link: '/providers/anthropic-api' },
            { text: 'OpenAI API', link: '/providers/openai-api' },
            { text: 'Google AI API', link: '/providers/google-api' },
            { text: 'AWS Bedrock', link: '/providers/bedrock' },
            { text: 'Ollama', link: '/providers/ollama' },
          ],
        },
        {
          text: 'Agents',
          collapsed: false,
          items: [
            { text: 'Agent Catalog', link: '/agents/' },
            { text: 'Bug Investigator', link: '/agents/bug-investigator' },
            { text: 'Performance Engineer', link: '/agents/performance-engineer' },
            { text: 'Test Hardener', link: '/agents/test-hardener' },
            { text: 'Todo Triager', link: '/agents/todo-triager' },
            { text: 'Feature Scout', link: '/agents/feature-scout' },
            { text: 'Security Auditor', link: '/agents/security-auditor' },
            { text: 'Database Reviewer', link: '/agents/database-reviewer' },
            { text: 'Refactoring Engineer', link: '/agents/refactoring-engineer' },
          ],
        },
        {
          text: 'More',
          items: [
            { text: 'Security Model', link: '/security' },
            { text: 'Contributing', link: '/contributing' },
            { text: 'Changelog', link: '/changelog' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/glorioustephan/corydora' }],

    editLink: {
      pattern: 'https://github.com/glorioustephan/corydora/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026 James Lee Baker',
    },
  },
});
