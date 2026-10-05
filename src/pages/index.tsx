import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

/*
 * PLACEHOLDER — DO NOT SHIP.
 *
 * The command, the check IDs and the flags below are real and taken from
 * docs/schedctl/commands.md. The output values are not real: no sched_ext
 * host was consulted, and `schedctl doctor` output has never been captured.
 * Replace this block with the verbatim output of
 *
 *     sudo schedctl doctor
 *
 * on a Linux 6.12+ host with CONFIG_SCHED_CLASS_EXT=y. Keep the real wording
 * and check IDs verbatim — the value of this block is that it is a true
 * screenshot of the tool, not a flattering impression of it.
 */
const DOCTOR_TRANSCRIPT: string[] = [
  '$ sudo schedctl doctor',
  '',
  '[ PLACEHOLDER ]',
  '[ Paste real output from a sched_ext-capable host. ]',
  '[ Command + check IDs are real; this output is not. ]',
];

/** Single right-aligned button, old-school Linux titlebar. Not macOS dots. */
function Transcript() {
  return (
    <figure className={styles.transcript}>
      <div className={styles.transcriptBar}>
        <figcaption className={styles.transcriptTitle}>
          schedctl doctor
        </figcaption>
        <span className={styles.transcriptButton} aria-hidden="true" />
      </div>
      <pre className={styles.transcriptBody}>
        <code>{DOCTOR_TRANSCRIPT.join('\n')}</code>
      </pre>
    </figure>
  );
}

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className="container">
        <Heading as="h1" className={styles.wordmark}>
          {siteConfig.title}
        </Heading>
        <p className={styles.tagline}>{siteConfig.tagline}</p>

        <div className={styles.heroLower}>
          <div className={styles.heroProse}>
            <p>
              Linux 6.12 made the CPU scheduler a BPF program the kernel loads,
              verifies and unloads on demand — no custom kernel, no module, no
              maintenance window.
            </p>
            <p>
              schedkit handles everything around that: shipping a scheduler as
              an OCI image, checking whether a host can run one, reporting what
              is actually attached, and doing the same across a cluster.
            </p>
            <div className={styles.heroActions}>
              <Link className="button button--primary button--lg" to="/docs/intro">
                Introduction
              </Link>
              <Link
                className="button button--outline button--lg"
                to="/docs/concepts/sched-ext"
              >
                What is sched_ext?
              </Link>
            </div>
          </div>
          <div className={styles.heroAside}>
            <Transcript />
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'schedctl',
    line: 'The host-side CLI.',
    body: 'Verifies, pulls and runs an OCI-packaged sched_ext scheduler on a single machine, with a kernel preflight built in. Reaches for one scheduler for the length of a build, a game session, or a test run.',
    install: 'sudo zypper in schedctl',
    href: '/docs/schedctl/overview',
  },
  {
    name: 'sked',
    line: 'The Kubernetes operator.',
    body: 'A SchedExt resource names the OCI scheduler image; sked reconciles it into a privileged DaemonSet on every node it should run on. The cluster-native path — schedctl is not installed on the nodes.',
    install: 'make deploy IMG=ghcr.io/schedkit/sked:latest',
    href: '/docs/sked/overview',
  },
];

function Tools() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Two tools
        </Heading>
        <dl className={styles.tools}>
          {TOOLS.map((tool) => (
            <div key={tool.name} className={styles.tool}>
              <dt className={styles.toolHead}>
                <span className={styles.toolName}>{tool.name}</span>
                <span className={styles.toolLine}>{tool.line}</span>
              </dt>
              <dd className={styles.toolBody}>
                <p>{tool.body}</p>
                <pre className={styles.install}>
                  <code>
                    <span className={styles.prompt}>$ </span>
                    {tool.install}
                  </code>
                </pre>
                <Link to={tool.href} className={styles.toolLink}>
                  {tool.name} documentation
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Requirements
 * ------------------------------------------------------------------ */

/* Check IDs are the real ones from `schedctl doctor` (see commands.md). */
const REQUIREMENTS: Array<[string, string, string]> = [
  ['kernel.version', 'Linux 6.12 or later', 'The release that shipped sched_ext upstream.'],
  ['kernel.config', 'CONFIG_SCHED_CLASS_EXT=y', 'With the CONFIG_BPF* flags and CONFIG_DEBUG_INFO_BTF for CO-RE programs.'],
  ['caps.*', 'CAP_BPF, CAP_SYS_ADMIN, CAP_PERFMON', 'Verified by schedctl doctor. Under sked each scheduler runs in a privileged DaemonSet instead.'],
  ['runtime.any', 'A reachable runtime socket', 'Podman or containerd, so the scheduler can be pulled as an OCI image.'],
];

function Requirements() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          What a host needs
        </Heading>
        <p className={styles.sectionLede}>
          Each of these is a check ID that <code>schedctl doctor</code> reports
          by name, and exits non-zero on when one fails.
        </p>
        <table className={styles.reqTable}>
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Requires</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {REQUIREMENTS.map(([id, needs, note]) => (
              <tr key={id}>
                <td>
                  <code>{id}</code>
                </td>
                <td>{needs}</td>
                <td className={styles.reqNote}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Where to start
 * ------------------------------------------------------------------ */

const ROUTES: Array<[string, string, string]> = [
  [
    'Understand the design first',
    'What sched_ext is and is not, and why OCI ended up as the distribution format.',
    '/docs/concepts/sched-ext',
  ],
  [
    'One machine, right now',
    'Install schedctl, run the preflight, attach a scheduler.',
    '/docs/schedctl/installation',
  ],
  [
    'Nodes already in Kubernetes',
    'Install sked and declare a SchedExt resource.',
    '/docs/sked/installation',
  ],
  [
    'Package your own scheduler',
    'The image layout that schedctl and sked both expect.',
    '/docs/schedctl/packaging-a-scheduler',
  ],
];

function Routes() {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Where to start
        </Heading>
        <ul className={styles.routes}>
          {ROUTES.map(([when, what, href]) => (
            <li key={href}>
              <Link to={href} className={styles.route}>
                <span className={styles.routeWhen}>{when}</span>
                <span className={styles.routeWhat}>{what}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="OCI-packaged sched_ext schedulers, plus the tools to run them anywhere"
    >
      <Hero />
      <main>
        <Tools />
        <Requirements />
        <Routes />
      </main>
    </Layout>
  );
}
