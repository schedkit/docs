import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Concepts',
      collapsed: false,
      items: [
        'concepts/sched-ext',
        'concepts/oci-schedulers',
        'concepts/architecture',
      ],
    },
    {
      type: 'category',
      label: 'schedctl',
      collapsed: false,
      items: [
        'schedctl/overview',
        'schedctl/installation',
        'schedctl/container-runtimes',
        'schedctl/usage',
        'schedctl/commands',
        'schedctl/packaging-a-scheduler',
        'schedctl/troubleshooting',
        'schedctl/development',
      ],
    },
    {
      type: 'category',
      label: 'sked',
      collapsed: false,
      items: [
        'sked/overview',
        'sked/installation',
        'sked/crds',
        'sked/usage',
        'sked/architecture',
        'sked/development',
      ],
    },
  ],
};

export default sidebars;
