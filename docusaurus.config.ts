import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'schedkit',
  tagline: 'OCI-packaged sched_ext schedulers, from your laptop to a cluster',
  favicon: 'img/favicon.ico',

  url: 'https://schedkit.github.io',
  baseUrl: '/',

  organizationName: 'schedkit',
  projectName: 'schedkit.github.io',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/schedkit/schedkit-docs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'schedkit',
      logo: {
        alt: 'schedkit',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/schedctl/overview',
          label: 'schedctl',
          position: 'left',
        },
        {
          to: '/docs/sked/overview',
          label: 'sked',
          position: 'left',
        },
        {
          href: 'https://github.com/schedkit',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/docs/intro'},
            {label: 'schedctl', to: '/docs/schedctl/overview'},
            {label: 'sked', to: '/docs/sked/overview'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'schedctl on GitHub', href: 'https://github.com/schedkit/schedctl'},
            {label: 'sked on GitHub', href: 'https://github.com/schedkit/sked'},
            {label: 'Issues', href: 'https://github.com/schedkit/schedctl/issues'},
          ],
        },
        {
          title: 'Background',
          items: [
            {label: 'sched_ext kernel docs', href: 'https://docs.kernel.org/scheduler/sched-ext.html'},
            {label: 'scx schedulers', href: 'https://github.com/sched-ext/scx'},
            {label: 'OCI image spec', href: 'https://github.com/opencontainers/image-spec'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} the schedkit authors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'toml', 'go', 'docker'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
