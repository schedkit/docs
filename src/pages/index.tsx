import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import SchedulerShipment from '@site/static/img/scheduler-shipment.svg';

import styles from './index.module.css';

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Linux sched_ext · OCI images</p>
        <Heading as="h1" className={styles.wordmark}>
          {siteConfig.title}
        </Heading>
        <p className={styles.tagline}>
          CPU schedulers,<br />
          <span>packaged as OCI images.</span>
        </p>
        <p className={styles.heroDescription}>
          Use schedctl on a Linux host or sked in Kubernetes to verify
          and run sched_ext scheduler images.
        </p>
        <div className={styles.heroActions}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Read the docs <span aria-hidden="true">↗</span>
          </Link>
          <Link className={styles.textLink} to="https://github.com/schedkit">
            View the source
          </Link>
        </div>
      </div>
      <figure className={styles.artwork}>
        <SchedulerShipment className={styles.schematic} />
        <figcaption>
          The scheduler arrives as an OCI image and attaches to the host
          kernel through <code>sched_ext</code>.
        </figcaption>
      </figure>
    </header>
  );
}

type Tool = {
  name: string;
  scope: string;
  alpha?: boolean;
  body: string;
  prerequisite: ReactNode;
  commands: string[];
  href: string;
};

const TOOLS: Tool[] = [
  {
    name: 'schedctl',
    scope: 'On a host',
    body: 'Run scheduler images with Podman or containerd. schedctl verifies signatures, checks host compatibility, reports which scheduler is attached, and starts and stops scheduler containers.',
    prerequisite: <>Install on openSUSE, or see the <Link to="/docs/schedctl/installation">other installation options</Link>.</>,
    commands: ['sudo zypper in schedctl', 'sudo schedctl doctor'],
    href: '/docs/schedctl/usage',
  },
  {
    name: 'sked',
    scope: 'In Kubernetes',
    alpha: true,
    body: 'Create a Scheduler resource for a node pool. sked verifies the image, creates a privileged DaemonSet, and reports rollout status. It does not require schedctl on the nodes.',
    prerequisite: <>Install <Link to="https://cert-manager.io/docs/installation/">cert-manager</Link> first, or <Link to="/docs/sked/installation#webhook-certificates">supply a webhook certificate</Link>.</>,
    commands: [
      'helm repo add schedkit https://charts.schedkit.io',
      'helm repo update',
      'helm install sked schedkit/sked \\\n  --namespace sked-system --create-namespace \\\n  --wait --timeout 5m',
    ],
    href: '/docs/sked/usage',
  },
];

function Tools() {
  return (
    <section className={styles.section} aria-labelledby="tools-title">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>01 / Deployment</p>
        <Heading as="h2" id="tools-title">Run on a host or in Kubernetes</Heading>
      </div>
      <div className={styles.tools}>
        {TOOLS.map((tool) => (
          <article key={tool.name} className={styles.tool}>
            <p className={styles.toolScope}>{tool.scope}</p>
            <div className={styles.toolNameRow}>
              <Heading as="h3" className={styles.toolName}>{tool.name}</Heading>
              {tool.alpha && (
                <span className={styles.toolBadge} title="Alpha: not recommended for production use">
                  alpha
                </span>
              )}
            </div>
            <p className={styles.toolDescription}>{tool.body}</p>
            <p className={styles.installNote}>{tool.prerequisite}</p>
            <pre className={styles.install} tabIndex={0} aria-label={`${tool.name} installation commands`}>
              <code>
                {tool.commands.map((command, index) => (
                  <span key={command}>
                    {index > 0 && '\n'}
                    <span className={styles.prompt} aria-hidden="true">$ </span>
                    {command}
                  </span>
                ))}
              </code>
            </pre>
            <Link to={tool.href} className={styles.textLink}>
              Use {tool.name} <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    name: 'Package',
    detail: 'An OCI image contains the scheduler binary and its dependencies. Publish it to a container registry.',
    label: 'OCI image',
    href: '/docs/concepts/oci-schedulers',
  },
  {
    name: 'Run',
    detail: 'schedctl or sked verifies the image signature by default. The container runtime pulls the image and starts the scheduler.',
    label: 'Container runtime',
    href: '/docs/concepts/architecture',
  },
  {
    name: 'Schedule',
    detail: 'The scheduler attaches through sched_ext and allocates CPU time to threads. When it detaches, the kernel returns to its default policy.',
    label: 'Linux kernel',
    href: '/docs/concepts/sched-ext',
  },
];

function Delivery() {
  return (
    <section className={styles.section} aria-labelledby="delivery-title">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>02 / How it works</p>
        <Heading as="h2" id="delivery-title">From registry to kernel</Heading>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.name}>
            <p className={styles.stepLabel}>
              <span>{String(index + 1).padStart(2, '0')}</span> {step.label}
            </p>
            <Heading as="h3">{step.name}</Heading>
            <p>{step.detail}</p>
            <Link to={step.href} className={styles.textLink}>
              {step.label} <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

const REQUIREMENTS = [
  ['Kernel', 'Linux 6.12 or later with CONFIG_SCHED_CLASS_EXT=y, BPF support, and BTF.'],
  ['Runtime', 'Podman or containerd on a host; the node’s container runtime in Kubernetes.'],
  ['Permissions', 'Access to load BPF programs. sked runs scheduler containers privileged.'],
  ['Compatibility', 'A scheduler image built for the host’s architecture and kernel.'],
];

function Requirements() {
  return (
    <section className={styles.section} aria-labelledby="requirements-title">
      <div className={styles.requirements}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>03 / Before you run</p>
          <Heading as="h2" id="requirements-title">Check the host</Heading>
          <p className={styles.sectionLede}>
            Run <code>schedctl doctor</code> to check the kernel, capabilities,
            and container runtime. Check the scheduler’s own requirements too.
          </p>
          <p className={styles.sectionNote}>
            sked reports DaemonSet readiness but does not check kernel
            attachment. Verify the running scheduler on each node.
          </p>
          <Link to="/docs/schedctl/troubleshooting" className={styles.textLink}>
            Check host compatibility <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <table className={styles.reqTable} aria-label="Requirements for running a scheduler">
          <tbody>
            {REQUIREMENTS.map(([name, detail]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ROUTES = [
  ['Understand sched_ext', 'How BPF-based CPU scheduling works in Linux.', '/docs/concepts/sched-ext'],
  ['Run on one machine', 'Install schedctl and try a scheduler.', '/docs/schedctl/installation'],
  ['Deploy to a node pool', 'Install sked with Helm and create a Scheduler.', '/docs/sked/installation'],
  ['Package a scheduler', 'Build an image that both tools can run.', '/docs/schedctl/packaging-a-scheduler'],
];

function Routes() {
  return (
    <section className={styles.section} aria-labelledby="routes-title">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>04 / Documentation</p>
        <Heading as="h2" id="routes-title">Where to start</Heading>
      </div>
      <ul className={styles.routes}>
        {ROUTES.map(([title, detail, href]) => (
          <li key={href}>
            <Link to={href} className={styles.route}>
              <span className={styles.routeTitle}>{title}</span>
              <span className={styles.routeDetail}>{detail}</span>
              <span className={styles.routeArrow} aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Linux CPU schedulers packaged as OCI images"
      description="Run sched_ext CPU scheduler images on Linux hosts with schedctl or on Kubernetes node pools with sked."
    >
      <main className={styles.home}>
        <Hero />
        <Tools />
        <Delivery />
        <Requirements />
        <Routes />
      </main>
    </Layout>
  );
}
