import { useEffect, useState } from 'react'
import { wakeAiService } from './api/wakeApi'
import landingImg from './assets/landing-img.png'

const features = [
  {
    icon: 'description',
    title: 'Instant summarization',
    desc: 'Condense lengthy contracts into clear, actionable briefs in seconds.',
  },
  {
    icon: 'troubleshoot',
    title: 'Deep legal analysis',
    desc: 'Surface risks, obligations, and key clauses automatically.',
  },
  {
    icon: 'forum',
    title: 'Contextual chat',
    desc: 'Ask questions about any document and get cited, precise answers.',
  },
]

const trustItems = [
  { icon: 'verified_user', label: 'Enhanced security coming soon' },
  { icon: 'lock', label: 'End-to-end encrypted' },
  { icon: 'gavel', label: 'Privilege protected' },
]

function MaterialIcon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function RossLandingPage({ onSignIn, onGetStarted }) {
  const [scrolled, setScrolled] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    wakeAiService()
  }, [])

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setReady(true), 80)
    const revealElements = document.querySelectorAll('[data-ross-reveal]')

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'))
      return () => window.clearTimeout(readyTimer)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.12,
      },
    )

    revealElements.forEach((element) => observer.observe(element))

    return () => {
      window.clearTimeout(readyTimer)
      observer.disconnect()
    }
  }, [])

  return (
    <div className={`ross-liquid-page ${ready ? 'is-ready' : ''}`}>
      <div className="ross-liquid-noise" aria-hidden="true" />

      <header className={`ross-liquid-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="ross-liquid-nav-inner">
          <a className="ross-liquid-brand" href="#top">
            ROSS
          </a>

          <nav className="ross-liquid-links" aria-label="Landing page navigation">
            <a href="#intelligence">Intelligence</a>
            <a href="#features">Features</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="ross-liquid-actions">
            <button type="button" className="ross-liquid-link-action" onClick={onSignIn}>
              Sign In
            </button>
            <button type="button" className="ross-liquid-solid-action" onClick={onGetStarted}>
              Request Demo
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="ross-liquid-main">
        <section id="intelligence" className="ross-liquid-hero">
          <div className="ross-liquid-pill ross-load-in">
            <span />
            Enhanced security coming soon
          </div>

          <h1 className="ross-liquid-title">
            <span className="ross-text-load">Legal intelligence,</span>
            <br />
            <span className="ross-text-load is-delayed">built for efficiency.</span>
          </h1>

          <p className="ross-load-in is-second">
            Upload any contract or legal document and let ROSS do the heavy lifting.
            Advanced reasoning meets institutional security.
          </p>

          <div className="ross-liquid-hero-actions ross-load-in is-third">
            <button type="button" className="ross-liquid-solid-action is-large" onClick={onGetStarted}>
              Get Started Free
            </button>
            <button type="button" className="ross-liquid-glass-action is-large" onClick={onSignIn}>
              Sign In
            </button>
          </div>

          <div className="ross-liquid-app-frame ross-load-in is-fourth" aria-label="ROSS workspace preview">
            <img
              className="ross-liquid-app-image"
              src={landingImg}
              alt="ROSS legal document workspace preview"
            />
          </div>
        </section>

        <section id="features" className="ross-liquid-feature-grid">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="ross-liquid-feature-card"
              data-ross-reveal
              style={{ '--ross-reveal-delay': `${index * 110}ms` }}
            >
              <div className="ross-liquid-feature-icon">
                <MaterialIcon>{feature.icon}</MaterialIcon>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </article>
          ))}
        </section>

        <section id="security" className="ross-liquid-final" data-ross-reveal>
          <div className="ross-liquid-final-inner">
            <h2>Experience the future of legal research</h2>
            <p>
              Join legal teams using ROSS to move from dense source material to
              traceable insight faster.
            </p>
            <div className="ross-liquid-final-actions">
              <button type="button" className="ross-liquid-solid-action is-large" onClick={onGetStarted}>
                Get Started Free
              </button>
              <button type="button" className="ross-liquid-glass-action is-large" onClick={onSignIn}>
                Talk to Sales
              </button>
            </div>
            <div className="ross-liquid-trust-row">
              {trustItems.map((item) => (
                <span key={item.label}>
                  <MaterialIcon>{item.icon}</MaterialIcon>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="ross-liquid-footer">
        <div>
          <strong>ROSS</strong>
          <p>Copyright 2026 ROSS Intelligence. Enhanced security coming soon.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
          <a href="#security">Security Whitepaper</a>
          <a href="#legal">Legal Disclaimer</a>
        </nav>
      </footer>
    </div>
  )
}
