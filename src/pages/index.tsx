import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.hero)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Get started
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/concepts/sched-ext">
            What's sched_ext?
          </Link>
        </div>
      </div>
    </header>
  );
}

function Projects() {
  return (
    <section className={styles.projects}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">schedctl</Heading>
            <p>
              The host-side CLI. Verifies, pulls, and runs an OCI-packaged
              sched_ext scheduler, with built-in kernel preflight
              (<code>schedctl doctor</code>) and discrepancy reporting
              (<code>schedctl status</code>). Available on openSUSE Tumbleweed
              and the AUR.
            </p>
            <Link className="button button--outline button--primary" to="/docs/schedctl/overview">
              Read the docs
            </Link>
          </div>
          <div className="col col--6">
            <Heading as="h2">sked</Heading>
            <p>
              The Kubernetes operator. A <code>SchedExt</code> resource names
              the OCI scheduler image you want to run; sked creates a
              privileged DaemonSet that runs it on the cluster. Early-stage
              and minimal today — the place to start if your nodes already
              live in Kubernetes.
            </p>
            <Link className="button button--outline button--primary" to="/docs/sked/overview">
              Read the docs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="OCI-packaged sched_ext schedulers, plus the tools to run them anywhere">
      <Hero />
      <main>
        <Projects />
      </main>
    </Layout>
  );
}
