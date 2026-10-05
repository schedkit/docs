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

/**
 * Illustrative `schedctl doctor` output. The command, the flag set and the
 * check IDs mirror docs/schedctl/commands.md — this is a stylised render of
 * the documented checks, not a captured transcript.
 */
type SessionKind = 'prompt' | 'check' | 'summary';

const DOCTOR_SESSION: Array<[SessionKind, string]> = [
  ['prompt', '$ sudo schedctl doctor'],
  ['check', 'kernel.version        kernel 6.12.0 ok'],
  ['check', 'kernel.sched_ext      /sys/kernel/sched_ext ok'],
  ['check', 'kernel.btf            /sys/kernel/btf/vmlinux ok'],
  ['check', 'kernel.config         CONFIG_SCHED_CLASS_EXT=y ok'],
  ['check', 'caps.cap_bpf          ok'],
  ['check', 'caps.cap_sys_admin    ok'],
  ['check', 'caps.cap_perfmon      ok'],
  ['check', 'runtime.any           podman socket ok'],
  ['summary', 'no blocking failures — host is ready'],
];

const SESSION_CLASS: Record<SessionKind, string> = {
  prompt: styles.termPrompt,
  check: styles.termCheck,
  summary: styles.termSummary,
};

function Terminal() {
  return (
    <div className={styles.terminal}>
      <div className={styles.terminalBar} aria-hidden="true">
        <span className={styles.terminalDot} />
        <span className={styles.terminalDot} />
        <span className={styles.terminalDot} />
        <span className={styles.terminalTitle}>host — sudo schedctl doctor</span>
      </div>
      <pre className={styles.terminalBody}>
        <code>
          {DOCTOR_SESSION.map(([kind, line], i) => (
            <span key={i} className={SESSION_CLASS[kind]}>
              {line}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx(styles.hero, 'sk-grid-bg')}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className="container">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              <span className={styles.statusDot} aria-hidden="true" />
              Linux 6.12+ &middot; CONFIG_SCHED_CLASS_EXT
            </p>
            <Heading as="h1" className={styles.heroTitle}>
              {siteConfig.title}
            </Heading>
            <p className={styles.heroTagline}>{siteConfig.tagline}</p>
            <p className={styles.heroBlurb}>
              The kernel already lets you attach a BPF CPU scheduler at
              runtime, without rebooting or rebuilding. schedkit handles
              everything around it: shipping a scheduler, checking whether it
              can run, reporting what is actually attached, and doing the same
              thing across a cluster.
            </p>
            <div className={styles.heroActions}>
              <Link className="button button--primary button--lg" to="/docs/intro">
                Get started
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="/docs/schedctl/overview"
              >
                Read the CLI docs
              </Link>
            </div>
            <p className={styles.heroMeta}>
              <a href="https://github.com/schedkit/schedctl">schedctl</a>
              <span aria-hidden="true"> / </span>
              <a href="https://github.com/schedkit/sked">sked</a>
              <span aria-hidden="true"> / </span>
              <a href="https://github.com/schedkit">schedkit</a>
            </p>
          </div>
          <div className={styles.heroPanel}>
            <Terminal />
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Section: the split
 * ------------------------------------------------------------------ */

function Split() {
  return (
    <section className={styles.split}>
      <div className="container">
        <div className={styles.splitGrid}>
          <div className={styles.splitCol}>
            <p className="sk-eyebrow">The kernel half</p>
            <Heading as="h2" className={styles.splitTitle}>
              Already solved
            </Heading>
            <p>
              Since Linux 6.12, a scheduler is a BPF program the kernel loads,
              verifies and unloads on demand. No custom kernel, no module, no
              maintenance window. The safety story stays with the kernel, which
              verifies a scheduler before letting it touch threads.
            </p>
          </div>
          <div className={styles.splitCol}>
            <p className="sk-eyebrow">The schedkit half</p>
            <Heading as="h2" className={styles.splitTitle}>
              The boring parts
            </Heading>
            <p>
              How do you ship a scheduler binary? How do you know whether it is
              running on a given machine? How do you roll back when it behaves
              badly? How do any of that work across more than one host? Those
              are the problems this project exists for.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Section: the two tools
 * ------------------------------------------------------------------ */

type Tool = {
  name: string;
  blurb: string;
  detail: string;
  install: string;
  href: string;
  cta: string;
};

const TOOLS: Tool[] = [
  {
    name: 'schedctl',
    blurb: 'The host-side CLI.',
    detail:
      'Verifies, pulls and runs an OCI-packaged sched_ext scheduler, with a kernel preflight and discrepancy reporting built in. Reaches for a scheduler on one machine — for the length of a build, a game session, or a test run.',
    install: 'sudo zypper in schedctl',
    href: '/docs/schedctl/overview',
    cta: 'schedctl docs',
  },
  {
    name: 'sked',
    blurb: 'The Kubernetes operator.',
    detail:
      'A SchedExt resource names the OCI scheduler image you want; sked reconciles it into a privileged DaemonSet on every node it should run on. The cluster-native path — no schedctl needed on the nodes.',
    install: 'make deploy IMG=ghcr.io/schedkit/sked:latest',
    href: '/docs/sked/overview',
    cta: 'sked docs',
  },
];

function Tools() {
  return (
    <section className={styles.tools}>
      <div className="container">
        <div className={styles.sectionHead}>
          <p className="sk-eyebrow">Two tools</p>
          <Heading as="h2" className={styles.sectionTitle}>
            Pick the one that matches your machine
          </Heading>
        </div>
        <div className={styles.toolGrid}>
          {TOOLS.map((tool) => (
            <article key={tool.name} className={styles.tool}>
              <div className={styles.toolHead}>
                <Heading as="h3" className={styles.toolName}>
                  {tool.name}
                </Heading>
                <p className={styles.toolBlurb}>{tool.blurb}</p>
              </div>
              <p className={styles.toolDetail}>{tool.detail}</p>
              <div className={styles.toolInstall}>
                <span className={styles.toolPrompt} aria-hidden="true">
                  $
                </span>
                <code>{tool.install}</code>
              </div>
              <Link
                className={clsx('button button--outline button--primary', styles.toolCta)}
                to={tool.href}
              >
                {tool.cta} →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Section: routes
 * ------------------------------------------------------------------ */

type Route = {
  when: string;
  go: string;
  href: string;
};

const ROUTES: Route[] = [
  {
    when: 'You want to understand the design before touching anything',
    go: 'Start with the Concepts section — what sched_ext is and is not, and why OCI ended up as the distribution format.',
    href: '/docs/concepts/sched-ext',
  },
  {
    when: 'You have one machine and want to try a scheduler now',
    go: 'Install schedctl, run the preflight, and attach something.',
    href: '/docs/schedctl/installation',
  },
  {
    when: 'Your nodes already live in Kubernetes',
    go: 'Install sked and declare a SchedExt resource.',
    href: '/docs/sked/installation',
  },
  {
    when: 'You are trying to package your own scheduler',
    go: 'The packaging walkthrough covers the image layout sked and schedctl both expect.',
    href: '/docs/schedctl/packaging-a-scheduler',
  },
];

function Routes() {
  return (
    <section className={styles.routes}>
      <div className="container">
        <div className={styles.sectionHead}>
          <p className="sk-eyebrow">Where to start</p>
          <Heading as="h2" className={styles.sectionTitle}>
            Four ways in
          </Heading>
        </div>
        <ul className={styles.routeList}>
          {ROUTES.map((route) => (
            <li key={route.href}>
              <Link to={route.href} className={styles.route}>
                <span className={styles.routeWhen}>{route.when}</span>
                <span className={styles.routeGo}>{route.go}</span>
                <span className={styles.routeArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Section: requirements
 * ------------------------------------------------------------------ */

const REQUIREMENTS: Array<[string, string, string]> = [
  ['kernel.version', 'Linux 6.12 or later', 'The version that shipped sched_ext upstream.'],
  ['kernel.config', 'CONFIG_SCHED_CLASS_EXT=y', 'Alongside the CONFIG_BPF* flags and CONFIG_DEBUG_INFO_BTF for CO-RE programs.'],
  ['runtime.any', 'A reachable runtime socket', 'Podman or containerd, so the scheduler can be pulled as an OCI image.'],
  ['privileges', 'CAP_BPF, CAP_SYS_ADMIN, CAP_PERFMON', 'Checked by schedctl doctor. sked instead runs each scheduler in a privileged DaemonSet.'],
];

function Requirements() {
  return (
    <section className={clsx(styles.requirements, 'sk-grid-bg')}>
      <div className="container">
        <div className={styles.sectionHead}>
          <p className="sk-eyebrow">Preflight</p>
          <Heading as="h2" className={styles.sectionTitle}>
            What a host actually needs
          </Heading>
          <p className={styles.sectionLede}>
            Every check below has an ID, because{' '}
            <code>schedctl doctor</code> reports them by ID and exits non-zero
            on any blocking failure.
          </p>
        </div>
        <dl className={styles.reqGrid}>
          {REQUIREMENTS.map(([id, what, why]) => (
            <div key={id} className={styles.req}>
              <dt className={styles.reqId}>{id}</dt>
              <dd className={styles.reqBody}>
                <span className={styles.reqWhat}>{what}</span>
                <span className={styles.reqWhy}>{why}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Section: closing CTA
 * ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <section className={styles.closing}>
      <div className="container">
        <Heading as="h2" className={styles.closingTitle}>
          Read the introduction
        </Heading>
        <p className={styles.closingText}>
          A few minutes on what sched_ext is, what schedkit adds on top, and
          what the project deliberately does not do yet.
        </p>
        <div className={styles.closingActions}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Get started
          </Link>
          <a
            className="button button--secondary button--lg"
            href="https://github.com/schedkit"
          >
            Browse the source
          </a>
        </div>
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
        <Split />
        <Tools />
        <Routes />
        <Requirements />
        <ClosingCta />
      </main>
    </Layout>
  );
}
