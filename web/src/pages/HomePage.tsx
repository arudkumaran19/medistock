import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoEmbed } from '../components/VideoEmbed';
import styles from './HomePage.module.css';
import {
  ArrowRight,
  Package,
  TrendingDown,
  ArrowLeftRight,
  ClipboardList,
  ShieldCheck,
  UserCheck,
  FileText,
  Eye,
  Truck,
  Menu,
  X,
  CheckCircle2,
  Lock,
  Thermometer,
  Layers,
  Activity,
  MessageSquare,
  BarChart3,
  GitBranch,
  Sparkles,
  Quote,
  Star,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

/* ─── Brand mark SVG ────────────────────────────────────────── */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#0D9488" />
      <rect x="14" y="7" width="4" height="18" rx="2" fill="white" opacity="0.95" />
      <rect x="7" y="14" width="18" height="4" rx="2" fill="white" opacity="0.95" />
      <circle cx="23" cy="9" r="2.5" fill="white" opacity="0.75" />
    </svg>
  );
}

/* ─── Social Proof Avatar Stack (6 Distinct Healthcare Portraits) ─── */
interface HealthcareOfficer {
  id: string;
  name: string;
  role: string;
  image: string;
}

const HEALTHCARE_OFFICERS: HealthcareOfficer[] = [
  {
    id: 'off-1',
    name: 'Dr. Evelyn Lin, PharmD',
    role: 'Clinical Pharmacist',
    image: '/images/avatars/avatar-1.jpg',
  },
  {
    id: 'off-2',
    name: 'Dr. Marcus Thorne, MD',
    role: 'Medical Director',
    image: '/images/avatars/avatar-2.jpg',
  },
  {
    id: 'off-3',
    name: 'Sarah Lindqvist, NP',
    role: 'Clinical Nurse Specialist',
    image: '/images/avatars/avatar-3.jpg',
  },
  {
    id: 'off-4',
    name: 'Roberto Morales, RPh',
    role: 'Hospital Pharmacy Manager',
    image: '/images/avatars/avatar-4.jpg',
  },
  {
    id: 'off-5',
    name: 'Dr. Priya Sharma, MD',
    role: 'Chief Medical Officer',
    image: '/images/avatars/avatar-5.jpg',
  },
  {
    id: 'off-6',
    name: 'Dr. James Chen, PharmD',
    role: 'Supply Chain Operations Officer',
    image: '/images/avatars/avatar-6.jpg',
  },
];

function SocialProofAvatars() {
  return (
    <div className={styles.socialProof} aria-label="Designed for diverse healthcare teams">
      <div className={styles.avatarStack} role="group" aria-label="Connected healthcare professional team">
        {HEALTHCARE_OFFICERS.map((officer, i) => (
          <div
            key={officer.id}
            className={styles.avatarSlot}
            style={{ zIndex: HEALTHCARE_OFFICERS.length - i }}
            title={`${officer.name} — ${officer.role}`}
          >
            <img
              src={officer.image}
              alt={officer.name}
              className={styles.avatarImg}
              loading="eager"
            />
          </div>
        ))}
      </div>
      <div className={styles.socialProofText}>
        <span className={styles.socialProofHeadline}>Designed for connected healthcare teams</span>
        <span className={styles.socialProofSub}>
          Built for hospital pharmacists, medical directors, and supply chain operators
        </span>
      </div>
    </div>
  );
}

/* ─── Illustrative Healthcare Organization Marks ────────────── */
const PARTNER_LOGOS = [
  {
    id: 'northgate',
    name: 'Northgate Health',
    sub: 'University Hospital Network',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#0D9488" />
        <rect x="15" y="8" width="4" height="18" rx="2" fill="white" />
        <rect x="8" y="15" width="18" height="4" rx="2" fill="white" />
        <circle cx="25" cy="9" r="2.5" fill="#5EEAD4" />
      </svg>
    ),
  },
  {
    id: 'silverline',
    name: 'Silverline Health',
    sub: 'Regional Authority',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#0284C7" />
        <path d="M7 17H12L15 10L19 24L22 17H27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'cardiopath',
    name: 'CardioPath Specialist',
    sub: 'Critical Care Institute',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#7C3AED" />
        <path d="M17 25S10 19.5 10 14.5A4.5 4.5 0 0117 12a4.5 4.5 0 017 2.5C24 19.5 17 25 17 25Z" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 16H15L17 13.5L19 18.5L20.5 16H22" stroke="#DDD6FE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'biomed',
    name: 'BioMed Central',
    sub: 'Central Pharmacy Stores',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#059669" />
        <polygon points="17,7 26,12 26,22 17,27 8,22 8,12" fill="none" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="17" cy="17" r="3" fill="#A7F3D0" />
      </svg>
    ),
  },
  {
    id: 'meridian',
    name: 'Meridian District',
    sub: 'Health System Network',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#D97706" />
        <circle cx="17" cy="17" r="9.5" stroke="white" strokeWidth="2" />
        <path d="M17 7.5V26.5M7.5 17H26.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17" cy="17" r="3.5" fill="#FDE68A" />
      </svg>
    ),
  },
  {
    id: 'pharmcore',
    name: 'PharmCore Logistics',
    sub: 'Distribution Hub',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#DC2626" />
        <path d="M17 8L26 13V21L17 26L8 21V13L17 8Z" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M17 14V20M14 17H20" stroke="#FECACA" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'stjude',
    name: 'St. Jude Regional',
    sub: 'Tertiary Referral Hospital',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#4F46E5" />
        <circle cx="17" cy="17" r="10" stroke="#C7D2FE" strokeWidth="1.8" strokeDasharray="3 2" />
        <path d="M17 11V23M11 17H23" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'apexcare',
    name: 'Apex Care Alliance',
    sub: 'Integrated Healthcare Group',
    renderMark: () => (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#0F766E" />
        <path d="M17 8L26 24H8L17 8Z" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="17" cy="18" r="2.5" fill="#5EEAD4" />
      </svg>
    ),
  },
];

function PartnerLogoMarquee() {
  // Duplicate for seamless 50% translateX loop — duplicates are aria-hidden
  return (
    <div
      className={styles.partnerMarqueeViewport}
      aria-label="Illustrative healthcare network — conceptual facility marks"
    >
      <div className={styles.partnerMarqueeTrack}>
        {/* Primary items — accessible */}
        {PARTNER_LOGOS.map((logo) => (
          <div key={logo.id} className={styles.partnerMarqueeCard}>
            <div className={styles.partnerLogoEmblem}>{logo.renderMark()}</div>
            <div className={styles.partnerLogoDetails}>
              <span className={styles.partnerLogoName}>{logo.name}</span>
              <span className={styles.partnerLogoSub}>{logo.sub}</span>
            </div>
          </div>
        ))}
        {/* Duplicate set — hidden from accessibility tree */}
        {PARTNER_LOGOS.map((logo) => (
          <div key={`dup-${logo.id}`} className={styles.partnerMarqueeCard} aria-hidden="true">
            <div className={styles.partnerLogoEmblem}>{logo.renderMark()}</div>
            <div className={styles.partnerLogoDetails}>
              <span className={styles.partnerLogoName}>{logo.name}</span>
              <span className={styles.partnerLogoSub}>{logo.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Illustrative Testimonials (Claymorphism) ───────────────── */
const TESTIMONIALS = [
  {
    quote:
      "Having all our inter-hospital transfer requests in one place, with clear approval chains, changed how our regional pharmacy team coordinates. We catch potential shortages days in advance now.",
    role: 'Regional Pharmacy Director',
    institution: 'Multi-site Teaching Hospital Network',
    initials: 'P.O.',
    color: '#0D9488',
  },
  {
    quote:
      "The audit trail alone justified the system. Before MediStock, reconciling a disputed transfer could take two days of phone calls. Now the full chain of custody is accessible in seconds.",
    role: 'Clinical Pharmacist & RBAC Administrator',
    institution: 'Tertiary Referral Hospital',
    initials: 'S.K.',
    color: '#0891B2',
  },
  {
    quote:
      "Our store operators used to manually track buffer stock in spreadsheets. The automated threshold alerts mean we're always ahead of shortages rather than reacting to them.",
    role: 'Medical Stores Manager',
    institution: 'Provincial Health Department',
    initials: 'A.M.',
    color: '#7C3AED',
  },
];

function TestimonialsSection() {
  return (
    <section className={styles.testimonialsSection} aria-labelledby="testimonials-heading">
      <div className={styles.container}>
        <div className={styles.secHeaderCenter}>
          <span className={styles.secLabel}>Illustrative Feedback Concepts</span>
          <h2 id="testimonials-heading" className={styles.secH2}>
            What healthcare teams tell us
          </h2>
          <p className={`${styles.secLeadCenter} ${styles.testimonialsDisclaimer}`}>
            The following are illustrative scenarios based on real operational challenges in healthcare inventory management.
            They represent typical feedback themes, not verified testimonials from specific named institutions.
          </p>
        </div>

        <div className={styles.testimonialsGrid}>
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              className={styles.testimonialCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ '--clay-accent': t.color } as React.CSSProperties}
            >
              <div className={styles.clayTop}>
                <div className={styles.clayQuoteIcon} aria-hidden="true">
                  <Quote size={16} />
                </div>
                <div className={styles.clayStars} aria-hidden="true">
                  {[...Array(5)].map((_, si) => (
                    <Star key={si} size={12} fill={t.color} color={t.color} />
                  ))}
                </div>
              </div>
              <p className={styles.testimonialQuote}>{t.quote}</p>
              <div className={styles.testimonialAuthor}>
                <div
                  className={styles.testimonialInitials}
                  style={{ background: t.color }}
                  aria-hidden="true"
                >
                  {t.initials}
                </div>
                <div>
                  <div className={styles.testimonialRole}>{t.role}</div>
                  <div className={styles.testimonialInstitution}>{t.institution}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Healthcare Partner Ecosystem ──────────────────────────── */
function EcosystemMarquee() {
  return (
    <section
      id="ecosystem"
      className={styles.ecosystemSection}
      aria-labelledby="ecosystem-heading"
    >
      <div className={styles.container}>
        <div className={styles.ecosystemHeader}>
          <span className={styles.secLabel}>Connected Healthcare Ecosystem</span>
          <h2 id="ecosystem-heading" className={styles.secH2}>
            A Connected Healthcare Supply Chain
          </h2>
          <p className={styles.secLeadCenter}>
            Bringing healthcare facilities, pharmacy operations, pharmaceutical suppliers,
            and intelligent inventory coordination into one connected ecosystem.{' '}
            <em className={styles.ecosystemNote}></em>
          </p>
        </div>
      </div>

      {/* Full-bleed partner logo marquee */}
      <PartnerLogoMarquee />
    </section>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dashHref = isAuthenticated ? '/dashboard' : '/login';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={styles.page}>
      {/* ══════════════════════════════════════════
          FIXED NAVBAR
      ══════════════════════════════════════════ */}
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}
      >
        <div className={styles.container}>
          <div className={styles.navRow}>
            <Link to="/" className={styles.brand} aria-label="MediStock — healthcare inventory and supply chain intelligence">
              <BrandMark size={34} />
              <span className={styles.brandName}>MediStock</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className={styles.desktopNav} aria-label="Main navigation">
              <a href="#capabilities" className={styles.navLink}>Capabilities</a>
              <a href="#solutions" className={styles.navLink}>Solutions</a>
              <a href="#ecosystem" className={styles.navLink}>Network</a>
              <a href="#tracking-overview" className={styles.navLink}>Logistics &amp; Tracking</a>
              <a href="#trust" className={styles.navLink}>Clinical Trust</a>
              <a href="#ai-coordinator" className={styles.navLink}>AI Coordinator</a>
            </nav>

            <div className={styles.navEnd}>
              <Link to="/login" className={styles.navSignIn}>Sign In</Link>
              <Link to={dashHref} className={styles.navCta}>
                Access Platform <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className={styles.mobileMenuBtn}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((o) => !o)}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={styles.mobileMenu}
              aria-label="Mobile navigation"
            >
              <a href="#capabilities" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Capabilities</a>
              <a href="#solutions" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Solutions</a>
              <a href="#ecosystem" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Network</a>
              <a href="#tracking-overview" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Logistics &amp; Tracking</a>
              <a href="#trust" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Clinical Trust</a>
              <a href="#ai-coordinator" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>AI Coordinator</a>
              <Link to="/login" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>Sign In to Facility</Link>
              <Link to={dashHref} className={styles.mobileCta} onClick={() => setMobileMenuOpen(false)}>
                Access MediStock Platform
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ══════════════════════════════════════════
          SECTION 1: HERO
      ══════════════════════════════════════════ */}
      <section className={styles.hero} aria-label="Platform introduction">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            {/* Left Value Proposition */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className={styles.heroCopy}
            >
              <div className={styles.heroEyebrow}>
                <span className={styles.eyebrowPip} aria-hidden="true" />
                Clinical Intelligence &amp; Supply Chain Platform
              </div>

              <h1 className={styles.heroH1}>
                Essential medicines. Available when they matter most.
              </h1>

              <p className={styles.heroLead}>
                MediStock connects hospital pharmacies, monitors medicine stock levels, anticipates
                critical shortages, and coordinates inter-facility transfers in one seamless, secure workspace.
              </p>

              <div className={styles.heroActions}>
                <Link to={dashHref} className={styles.btnPrimary} id="hero-cta-primary">
                  Access Platform <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link to="/login" className={styles.btnGhost} id="hero-cta-signin">
                  <Lock size={16} aria-hidden="true" /> Sign In to Facility
                </Link>
              </div>

              {/* ── Social Proof below CTAs ── */}
              <SocialProofAvatars />
            </motion.div>

            {/* Right Hero Visual */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={styles.heroVisualCol}
            >
              <div className={styles.heroImageCard}>
                <img
                  src="/images/hero-inventory-officer.jpg"
                  alt="Clinical inventory officer reviewing verified medicine records in hospital store"
                  className={styles.heroOfficerImg}
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2: HIGHLIGHTS TRANSITION BAR
      ══════════════════════════════════════════ */}
      <section className={styles.highlightsSection} aria-label="Key operational indicators">
        <div className={styles.container}>
          <div className={styles.highlightsGrid}>
            <div className={styles.highlightItem}>
              <span className={styles.highlightTitle}>Network Visibility</span>
              <span className={styles.highlightText}>Unified telemetry across regional and teaching hospital pharmacies.</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightTitle}>Shortage Prevention</span>
              <span className={styles.highlightText}>Anticipate emerging stock deficits before clinical treatments are impacted.</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightTitle}>Verified Custody</span>
              <span className={styles.highlightText}>Digital transfer approvals with milestone cold-chain integrity tracking.</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightTitle}>Institutional Governance</span>
              <span className={styles.highlightText}>Role-based security boundaries with complete traceable audit logs.</span>
            </div>
          </div>
        </div>
      </section>



      {/* ══════════════════════════════════════════
          SECTION 3: CORE CAPABILITIES
      ══════════════════════════════════════════ */}
      <section id="capabilities" className={styles.secNeutral} aria-labelledby="cap-heading">
        <div className={styles.container}>
          <div className={styles.secHeaderCenter}>
            <span className={styles.secLabel}>Core Capabilities</span>
            <h2 id="cap-heading" className={styles.secH2}>
              Purpose-built for clinical inventory and logistics
            </h2>
            <p className={styles.secLeadCenter}>
              Replace fragmented phone calls, paper slips, and delayed reports with one unified, authoritative system.
            </p>
          </div>

          <div className={styles.capabilitiesGrid}>
            <div className={styles.capabilityCard}>
              <div className={styles.capabilityIconWrap}>
                <Package size={22} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Inventory Telemetry</h3>
              <p className={styles.capabilityDesc}>
                Real-time visibility across on-hand stock, allocated reserves, and batch expiries in every hospital unit.
              </p>
            </div>

            <div className={styles.capabilityCard}>
              <div className={styles.capabilityIconWrap}>
                <TrendingDown size={22} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Shortage Prevention</h3>
              <p className={styles.capabilityDesc}>
                Detect stock depletion risks early based on historical consumption trends and critical safety thresholds.
              </p>
            </div>

            <div className={styles.capabilityCard}>
              <div className={styles.capabilityIconWrap}>
                <ArrowLeftRight size={22} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Hospital Redistribution</h3>
              <p className={styles.capabilityDesc}>
                Transfer surplus inventory between hospitals to balance supplies rapidly without commercial procurement lag.
              </p>
            </div>

            <div className={styles.capabilityCard}>
              <div className={styles.capabilityIconWrap}>
                <ClipboardList size={22} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Supplier Procurement</h3>
              <p className={styles.capabilityDesc}>
                Streamlined purchase order lifecycle with structured multi-level human review and budget checks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4: SOLUTIONS OVERVIEW
      ══════════════════════════════════════════ */}
      <section id="solutions" className={styles.secWhite} aria-labelledby="sol-heading">
        <div className={styles.container}>
          <div className={styles.solutionsLayout}>
            {/* Feature Card */}
            <div className={styles.solutionFeatureCol}>
              <div className={styles.solutionFeatureCard}>
                <span className={styles.featurePill}>Centralized Intelligence</span>
                <h3 className={styles.featureHeading}>
                  Authoritative Hospital Medicine Control
                </h3>
                <p className={styles.featureText}>
                  MediStock harmonizes inventory data across tertiary hospitals, regional clinics, and central medical stores.
                  Stock balances, batch quarantines, and restock alerts remain strictly protected by role-based permissions.
                </p>
                <div className={styles.featureTags}>
                  <div className={styles.featureTagItem}>
                    <CheckCircle2 size={16} className={styles.tagCheckIcon} aria-hidden="true" />
                    <span>Real-time safety stock and buffer threshold alerts</span>
                  </div>
                  <div className={styles.featureTagItem}>
                    <CheckCircle2 size={16} className={styles.tagCheckIcon} aria-hidden="true" />
                    <span>Batch quarantine protocols for expiring or recalled lots</span>
                  </div>
                  <div className={styles.featureTagItem}>
                    <CheckCircle2 size={16} className={styles.tagCheckIcon} aria-hidden="true" />
                    <span>Multi-facility stock reserve allocation compliance</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Narrative Column */}
            <div className={styles.solutionNarrativeCol}>
              <span className={styles.secLabel}>Operational Clarity</span>
              <h2 id="sol-heading" className={styles.secH2}>
                A clear, reliable view of hospital medicine supply
              </h2>
              <p className={styles.secLead}>
                Give pharmacy managers and healthcare directors complete confidence in their supply data.
                Identify critical stockouts early, coordinate inter-facility transfers, and eliminate administrative bottlenecks.
              </p>

              <div className={styles.benefitList}>
                <div className={styles.benefitItem}>
                  <CheckCircle2 size={18} className={styles.benefitCheck} aria-hidden="true" />
                  <span>Real-time visibility across all hospital storage locations</span>
                </div>
                <div className={styles.benefitItem}>
                  <CheckCircle2 size={18} className={styles.benefitCheck} aria-hidden="true" />
                  <span>Automated alerts when stock drops below safety thresholds</span>
                </div>
                <div className={styles.benefitItem}>
                  <CheckCircle2 size={18} className={styles.benefitCheck} aria-hidden="true" />
                  <span>Direct links to inter-hospital transfers and procurement orders</span>
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <Link to={dashHref} className={styles.btnPrimary}>
                  Sign In to Access Inventory <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 5: HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section id="how-it-works" className={styles.secNeutral} aria-labelledby="hiw-heading">
        <div className={styles.container}>
          <div className={styles.secHeaderCenter}>
            <span className={styles.secLabel}>Operational Workflow</span>
            <h2 id="hiw-heading" className={styles.secH2}>
              Three steps to coordinated medicine supply
            </h2>
            <p className={styles.secLeadCenter}>
              A transparent, accountable workflow that preserves clinical judgment at every decision gate.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            <div className={styles.stepItem}>
              <div className={styles.stepBadge}>01</div>
              <h3 className={styles.stepHeading}>Monitor Availability</h3>
              <p className={styles.stepDescription}>
                Review medicine stock, recent consumption rates, and expiry schedules across your regional hospital network.
              </p>
            </div>

            <div className={styles.stepItem}>
              <div className={styles.stepBadge}>02</div>
              <h3 className={styles.stepHeading}>Evaluate Options</h3>
              <p className={styles.stepDescription}>
                Assess recommended inter-facility transfers from hospitals with surplus stock, or generate verified purchase orders.
              </p>
            </div>

            <div className={styles.stepItem}>
              <div className={styles.stepBadge}>03</div>
              <h3 className={styles.stepHeading}>Approve &amp; Track</h3>
              <p className={styles.stepDescription}>
                Authorise medicine transfers with human sign-off, follow transit milestones, and confirm dock receipt digitally.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 6: DELIVERY TRACKING & LOGISTICS
      ══════════════════════════════════════════ */}
      <section id="tracking-overview" className={styles.secNavy} aria-labelledby="trk-heading">
        <div className={styles.container}>
          <div className={styles.trkGrid}>
            <div className={styles.trkCopy}>
              <span className={styles.secLabelLight}>Inter-Hospital Logistics</span>
              <h2 id="trk-heading" className={`${styles.secH2} ${styles.secH2Light}`}>
                Know where your medicines are moving
              </h2>
              <p className={styles.secLeadLight}>
                Follow authorised transfers between facilities with verified transit corridors, milestone tracking,
                and digital delivery confirmations. Ensure temperature compliance and authoritative custody.
              </p>
              <div style={{ marginTop: '2rem' }}>
                <Link to="/tracking" className={styles.btnPrimary}>
                  Access Delivery Tracking <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className={styles.logisticsFeaturesGrid}>
              <div className={styles.logisticsFeatureBox}>
                <div className={styles.logisticsIcon}>
                  <Truck size={20} aria-hidden="true" />
                </div>
                <h4 className={styles.logisticsFeatureTitle}>Optimized Corridors</h4>
                <p className={styles.logisticsFeatureDesc}>
                  Calculated road corridors connecting teaching, provincial, and district health centers.
                </p>
              </div>

              <div className={styles.logisticsFeatureBox}>
                <div className={styles.logisticsIcon}>
                  <Thermometer size={20} aria-hidden="true" />
                </div>
                <h4 className={styles.logisticsFeatureTitle}>Cold-Chain Monitoring</h4>
                <p className={styles.logisticsFeatureDesc}>
                  Strict temperature integrity monitoring (2°C – 8°C) for vaccines, insulins, and critical serums.
                </p>
              </div>

              <div className={styles.logisticsFeatureBox}>
                <div className={styles.logisticsIcon}>
                  <ShieldCheck size={20} aria-hidden="true" />
                </div>
                <h4 className={styles.logisticsFeatureTitle}>Chain of Custody</h4>
                <p className={styles.logisticsFeatureDesc}>
                  Digital dispatch manifests, departure check-ins, and verified dock receipt signatures.
                </p>
              </div>

              <div className={styles.logisticsFeatureBox}>
                <div className={styles.logisticsIcon}>
                  <Layers size={20} aria-hidden="true" />
                </div>
                <h4 className={styles.logisticsFeatureTitle}>Authoritative Lifecycle</h4>
                <p className={styles.logisticsFeatureDesc}>
                  Real-time status updates reflecting physical milestone transitions with full audit history.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HEALTHCARE ECOSYSTEM MARQUEE
      ══════════════════════════════════════════ */}
      <EcosystemMarquee />

      {/* ══════════════════════════════════════════
          ILLUSTRATIVE TESTIMONIALS
      ══════════════════════════════════════════ */}
      <TestimonialsSection />

      {/* ══════════════════════════════════════════
          SECTION 7: TRUST & GOVERNANCE
      ══════════════════════════════════════════ */}
      <section id="trust" className={styles.secWhite} aria-labelledby="trust-heading">
        <div className={styles.container}>
          <div className={styles.trustLayout}>
            <div className={styles.trustPhotoWrap}>
              <img
                src="/images/clinical-governance.jpg"
                alt="Hospital clinical pharmacist and administrator reviewing digital medicine allocation records"
                className={styles.trustImage}
                decoding="async"
                loading="lazy"
              />
            </div>

            <div className={styles.trustContent}>
              <span className={styles.secLabel}>Governance &amp; Oversight</span>
              <h2 id="trust-heading" className={styles.secH2}>
                Built-in accountability at every clinical step
              </h2>
              <p className={styles.secLead}>
                Healthcare operations require traceable decisions and structured oversight. MediStock is
                designed around institutional safety principles.
              </p>

              <div className={styles.governanceGrid}>
                <div className={styles.govItem}>
                  <UserCheck size={20} className={styles.govIcon} aria-hidden="true" />
                  <div>
                    <strong>Role-Based Access Control</strong>
                    <p>Users only access features their role permits — pharmacy staff, store operators, and medical directors work within clear clinical boundaries.</p>
                  </div>
                </div>

                <div className={styles.govItem}>
                  <Eye size={20} className={styles.govIcon} aria-hidden="true" />
                  <div>
                    <strong>Human Approval Gates</strong>
                    <p>No transfer or purchase order is finalized without authorized human verification. The platform advises; clinicians decide.</p>
                  </div>
                </div>

                <div className={styles.govItem}>
                  <ShieldCheck size={20} className={styles.govIcon} aria-hidden="true" />
                  <div>
                    <strong>Policy Validation</strong>
                    <p>Redistribution plans are automatically evaluated against facility reserve thresholds to prevent accidental local shortages.</p>
                  </div>
                </div>

                <div className={styles.govItem}>
                  <FileText size={20} className={styles.govIcon} aria-hidden="true" />
                  <div>
                    <strong>Traceable Audit Logs</strong>
                    <p>Every inventory adjustment, status transition, and approval timestamp is immutably logged for institutional compliance.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 8: AI COORDINATOR & VIDEO DEMO
      ══════════════════════════════════════════ */}
      <section id="ai-coordinator" className={styles.aiSection} aria-labelledby="ai-heading">
        <div className={styles.container}>
          <div className={styles.aiHeader}>
            <div className={styles.aiEyebrow}>
              <Sparkles size={14} color="var(--teal)" aria-hidden="true" />
              Intelligent Healthcare Operations
            </div>
            <h2 id="ai-heading" className={styles.secH2}>
              Meet your intelligent supply chain coordinator
            </h2>
            <p className={styles.secLeadCenter}>
              Ask questions in plain language. Inspect real-time stock balances across facilities,
              detect emerging shortages, evaluate redistribution pathways, and track orders seamlessly.
            </p>
          </div>

          {/* Configurable Video Demonstration Container */}
          <div className={styles.videoWrapper}>
            <VideoEmbed
              title="MediStock AI Coordinator Demonstration"
              description="Watch natural language queries convert into verified medicine inventory telemetry and coordinated multi-hospital transfers."
            />
          </div>

          {/* AI Capability Grid */}
          <div className={styles.aiFeaturesGrid}>
            <div className={styles.aiFeatureCard}>
              <div className={styles.aiFeatureIcon}>
                <MessageSquare size={20} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Clinical Natural Language</h3>
              <p className={styles.capabilityDesc}>
                Query stock levels, expiring batches, and transfer history using everyday healthcare terminology.
              </p>
            </div>

            <div className={styles.aiFeatureCard}>
              <div className={styles.aiFeatureIcon}>
                <BarChart3 size={20} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Real-time Analytics</h3>
              <p className={styles.capabilityDesc}>
                Receive interactive visualizations, stock level comparisons, and threshold alerts directly in chat.
              </p>
            </div>

            <div className={styles.aiFeatureCard}>
              <div className={styles.aiFeatureIcon}>
                <GitBranch size={20} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Multi-Agent Delegation</h3>
              <p className={styles.capabilityDesc}>
                Specialized sub-agents handle inventory, demand forecasting, redistribution, and procurement in parallel.
              </p>
            </div>

            <div className={styles.aiFeatureCard}>
              <div className={styles.aiFeatureIcon}>
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <h3 className={styles.capabilityTitle}>Strict RBAC Enforcement</h3>
              <p className={styles.capabilityDesc}>
                The AI Coordinator enforces role-based restrictions before retrieving data or proposing actions.
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link to="/coordinator" className={styles.btnPrimary}>
              Access AI Coordinator <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 9: FINAL CALL TO ACTION
      ══════════════════════════════════════════ */}
      <section className={styles.ctaSection} aria-label="Access MediStock">
        <div className={styles.ctaInner}>
          <div className={styles.ctaBg}>
            <img
              src="/images/medicine-logistics.jpg"
              alt=""
              className={styles.ctaBgImg}
              aria-hidden="true"
            />
            <div className={styles.ctaBgOverlay} />
          </div>

          <div className={styles.container} style={{ position: 'relative', zIndex: 1 }}>
            <div className={styles.ctaBox}>
              <h2 className={styles.ctaH2}>
                Better visibility. More coordinated medicine supply.
              </h2>
              <p className={styles.ctaLead}>
                Bring inventory, redistribution, procurement, and delivery oversight into one connected,
                compliant workspace for your healthcare network.
              </p>
              <div className={styles.ctaActions}>
                <Link to={dashHref} className={styles.btnPrimary} id="cta-section-primary">
                  Access MediStock Platform <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link to="/login" className={styles.btnGhost} id="cta-section-signin">
                  <Lock size={16} aria-hidden="true" /> Sign In to Facility
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 10: ENTERPRISE FOOTER
      ══════════════════════════════════════════ */}
      <footer className={styles.footer} aria-label="Site footer">
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrandCol}>
              <Link to="/" className={styles.footerBrandLink} aria-label="MediStock homepage">
                <BrandMark size={28} />
                <span className={styles.footerBrandName}>MediStock</span>
              </Link>
              <p className={styles.footerTagline}>
                Clinical intelligence and supply chain management for hospital networks, pharmacy directors, and logistics operators.
              </p>
            </div>

            <div>
              <p className={styles.footerColTitle}>Platform</p>
              <ul className={styles.footerLinks}>
                <li><Link to={dashHref} className={styles.footerLink}>Dashboard</Link></li>
                <li><Link to="/inventory" className={styles.footerLink}>Inventory Telemetry</Link></li>
                <li><Link to="/redistribution/transfers" className={styles.footerLink}>Redistribution Transfers</Link></li>
                <li><Link to="/procurement/orders" className={styles.footerLink}>Procurement Orders</Link></li>
              </ul>
            </div>

            <div>
              <p className={styles.footerColTitle}>Operations</p>
              <ul className={styles.footerLinks}>
                <li><Link to="/tracking" className={styles.footerLink}>Delivery Tracking</Link></li>
                <li><Link to="/demand/shortages" className={styles.footerLink}>Shortage Alerts</Link></li>
                <li><Link to="/demand/forecasts" className={styles.footerLink}>Demand Forecasting</Link></li>
                <li><Link to="/coordinator" className={styles.footerLink}>AI Operations Coordinator</Link></li>
              </ul>
            </div>

            <div>
              <p className={styles.footerColTitle}>Account &amp; Access</p>
              <ul className={styles.footerLinks}>
                <li><Link to="/login" className={styles.footerLink}>Sign In</Link></li>
                <li><Link to="/register" className={styles.footerLink}>Create Account</Link></li>
                <li><Link to="/admin/users" className={styles.footerLink}>User Administration</Link></li>
              </ul>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerCopy}>
              &copy; {new Date().getFullYear()} MediStock. Enterprise healthcare supply chain intelligence platform.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#64748B' }}>
              <span>WCAG 2.2 AA Compliant</span>
              <span>NHS Design Standards</span>
              <span>Zero-Slop Healthcare UX</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
