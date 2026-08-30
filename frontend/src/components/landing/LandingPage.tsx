import { useState, useEffect, useRef, type ReactNode, type MouseEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePublicPlansQuery } from '../../hooks/usePublicPlansQuery'
import { type PublicPlan, type BillingCycle } from './data/plans'
import { checkoutService, type CheckoutOrderResponse } from '../../services/checkout.service'
import { openRazorpayCheckout } from '../../utils/razorpay'
import { Globe, Instagram, Linkedin, Facebook, Building2, Home, GraduationCap, BookOpen, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { FreeTrialContactModal } from './FreeTrialContactModal'
import './landing.css'

// ─── Utility hooks & Animations ─────────────────────────────────────────────

function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible')
          obs.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useFadeUp()
  return (
    <div
      ref={ref}
      className={`fade-up ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function useCounter(target: number, start: boolean, duration = 2000) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return value
}

function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${className}`}
    >
      {children}
    </div>
  )
}

// ─── Smooth Scroll Helper ───────────────────────────────────────────────────

function scrollToSectionId(id: string) {
  if (id === 'top' || !id) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  const el = document.getElementById(id)
  if (el) {
    const navOffset = 70
    const bodyRect = document.body.getBoundingClientRect().top
    const elementRect = el.getBoundingClientRect().top
    const elementPosition = elementRect - bodyRect
    const offsetPosition = elementPosition - navOffset
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
  }
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

interface NavProps {
  activeSection: string
  onOpenTrial: () => void
  onNavigateLogin: () => void
}

function Navbar({ activeSection, onOpenTrial, onNavigateLogin }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100)
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navItems = [
    { label: 'Features', id: 'features' },
    { label: 'Solutions', id: 'solutions' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Resources', id: 'resources' },
    { label: 'About', id: 'about' },
  ]

  const handleNavClick = (id: string, e: MouseEvent) => {
    e.preventDefault()
    setMenuOpen(false)
    scrollToSectionId(id)
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? 'glass border-b border-slate-200/60 shadow-sm'
          : 'bg-transparent'
        }`}
    >
      <div
        className="h-[2px] bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 transition-all duration-75"
        style={{ width: `${scrollProgress}%` }}
      />
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#top"
          onClick={(e) => handleNavClick('top', e)}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <img
            src="/logo.png"
            alt="HR Nexa Logo"
            className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-display font-800 text-lg text-slate-900 tracking-tight">
            HR <span className="text-blue-600">NEXA</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = activeSection === item.id
            return (
              <a
                key={item.label}
                href={`#${item.id}`}
                onClick={(e) => handleNavClick(item.id, e)}
                className={`text-sm font-medium transition-colors cursor-pointer ${isActive
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {item.label}
              </a>
            )
          })}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onNavigateLogin}
            className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
          >
            Login
          </button>
          <button
            onClick={onOpenTrial}
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg transition-all shadow-sm hover:shadow-md cursor-pointer animate-shimmer"
          >
            Start Free Trial
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-slate-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {menuOpen ? (
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              />
            ) : (
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden glass border-t border-slate-200/60 px-6 py-4 flex flex-col gap-3">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={`#${item.id}`}
              onClick={(e) => handleNavClick(item.id, e)}
              className={`text-sm font-medium py-1 cursor-pointer ${activeSection === item.id
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-700'
                }`}
            >
              {item.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setMenuOpen(false)
                onNavigateLogin()
              }}
              className="text-sm font-medium text-slate-700 border border-slate-200 px-4 py-2 rounded-lg flex-1 text-center"
            >
              Login
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                onOpenTrial()
              }}
              className="text-sm font-semibold text-white bg-blue-600 px-4 py-2 rounded-lg flex-1 text-center"
            >
              Free Trial
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── DashboardMockup ─────────────────────────────────────────────────────────

function DashboardMockup() {
  const [transform, setTransform] = useState(
    'perspective(1000px) rotateX(0deg) rotateY(0deg)'
  )

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    const rotateX = (-y / rect.height) * 10
    const rotateY = (x / rect.width) * 10
    setTransform(
      `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`
    )
  }

  const handleMouseLeave = () => {
    setTransform(
      'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
    )
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transition: 'transform 0.15s ease-out' }}
      className="relative w-full max-w-xl mx-auto cursor-pointer"
    >
      <div className="absolute inset-0 bg-blue-500/15 blur-3xl rounded-3xl -z-10 animated-orb" />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
          </div>
          <div className="flex-1 mx-4 bg-slate-700 rounded-md h-5 flex items-center px-3">
            <span className="text-slate-400 text-xs">
              app.hrnexa.io/dashboard
            </span>
          </div>
        </div>
        <div className="bg-slate-50 flex">
          <div className="w-14 bg-slate-900 flex flex-col items-center py-4 gap-4">
            {[
              <path
                key="1"
                d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />,
              <>
                <circle key="2a" cx="12" cy="8" r="4" />
                <path key="2b" d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              </>,
              <>
                <rect key="3" x="3" y="4" width="18" height="18" rx="2" />
                <line key="3a" x1="16" y1="2" x2="16" y2="6" />
                <line key="8" x1="8" y1="2" x2="8" y2="6" />
                <line key="3c" x1="3" y1="10" x2="21" y2="10" />
              </>,
              <>
                <line key="4a" x1="12" y1="1" x2="12" y2="23" />
                <path
                  key="4b"
                  d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                />
              </>,
              <polyline key="5" points="22 12 18 12 15 21 9 3 6 12 2 12" />,
            ].map((d, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${i === 0 ? 'bg-blue-600' : 'hover:bg-slate-700'
                  }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {d}
                </svg>
              </div>
            ))}
          </div>
          <div className="flex-1 p-3 min-w-0">
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                {
                  label: 'Employees',
                  value: '248',
                  change: '+4',
                  color: 'blue',
                },
                { label: 'On Leave', value: '12', change: '-2', color: 'orange' },
                {
                  label: 'Present',
                  value: '231',
                  change: '93%',
                  color: 'green',
                },
                {
                  label: 'Open Roles',
                  value: '7',
                  change: '+3',
                  color: 'purple',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl p-2.5 border border-slate-100"
                >
                  <p className="text-slate-400 text-[9px] font-medium uppercase tracking-wide">
                    {s.label}
                  </p>
                  <p className="text-slate-900 text-base font-bold leading-tight">
                    {s.value}
                  </p>
                  <span
                    className={`text-[9px] font-semibold ${s.color === 'green'
                        ? 'text-green-500'
                        : s.color === 'orange'
                          ? 'text-orange-400'
                          : s.color === 'purple'
                            ? 'text-purple-500'
                            : 'text-blue-500'
                      }`}
                  >
                    {s.change}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-[9px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Attendance This Week
                </p>
                <div className="flex items-end gap-1 h-12">
                  {[85, 92, 78, 96, 88, 94, 91].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end"
                    >
                      <div
                        className="rounded-t-sm"
                        style={{
                          height: `${h * 0.48}px`,
                          background: i === 3 ? '#2563EB' : '#DBEAFE',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <span key={i} className="text-[7px] text-slate-400">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-[9px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                  Payroll Split
                </p>
                <div className="flex items-center gap-2">
                  <svg width="42" height="42" viewBox="0 0 42 42">
                    <circle
                      cx="21"
                      cy="21"
                      r="16"
                      fill="none"
                      stroke="#DBEAFE"
                      strokeWidth="6"
                    />
                    <circle
                      cx="21"
                      cy="21"
                      r="16"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="6"
                      strokeDasharray="65 35"
                      strokeDashoffset="25"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="21"
                      cy="21"
                      r="16"
                      fill="none"
                      stroke="#06B6D4"
                      strokeWidth="6"
                      strokeDasharray="20 80"
                      strokeDashoffset="-40"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="flex flex-col gap-1">
                    {[
                      { c: '#2563EB', l: 'Base', v: '65%' },
                      { c: '#06B6D4', l: 'Bonus', v: '20%' },
                      { c: '#DBEAFE', l: 'Other', v: '15%' },
                    ].map((i) => (
                      <div key={i.l} className="flex items-center gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: i.c }}
                        />
                        <span className="text-[8px] text-slate-500">
                          {i.l}
                        </span>
                        <span className="text-[8px] font-semibold text-slate-700 ml-auto">
                          {i.v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wide">
                  Recent Activity
                </p>
                <span className="text-[8px] text-blue-600 font-semibold">
                  View all
                </span>
              </div>
              {[
                {
                  name: 'Sarah Chen',
                  role: 'Product Design',
                  status: 'Active',
                  avatar: 'SC',
                },
                {
                  name: 'James Park',
                  role: 'Engineering',
                  status: 'On Leave',
                  avatar: 'JP',
                },
                {
                  name: 'Maria Santos',
                  role: 'HR Manager',
                  status: 'Active',
                  avatar: 'MS',
                },
              ].map((e) => (
                <div
                  key={e.name}
                  className="px-3 py-1.5 flex items-center gap-2 border-b border-slate-50 last:border-0"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                    {e.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-semibold text-slate-800 leading-tight truncate">
                      {e.name}
                    </p>
                    <p className="text-[8px] text-slate-400 truncate">
                      {e.role}
                    </p>
                  </div>
                  <span
                    className={`text-[7px] font-semibold px-1.5 py-0.5 rounded-full ${e.status === 'Active'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-orange-50 text-orange-500'
                      }`}
                  >
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        className="absolute -right-4 xl:-right-8 top-16 bg-white rounded-xl shadow-xl border border-slate-100 p-3 w-36 hidden sm:block"
        style={{ animation: 'landingFloat 4s ease-in-out infinite' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22C55E"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-800">
              Payroll Processed
            </p>
            <p className="text-[8px] text-slate-400">248 employees</p>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg px-2 py-1 text-center">
          <span className="text-[10px] font-bold text-green-600">₹ 42.8L</span>
        </div>
      </div>
      <div
        className="absolute -left-4 xl:-left-8 bottom-24 bg-white rounded-xl shadow-xl border border-slate-100 p-3 w-32 hidden sm:block"
        style={{ animation: 'landingFloat 4s ease-in-out 2s infinite' }}
      >
        <p className="text-[8px] text-slate-400 mb-1">Attrition Rate</p>
        <p className="text-xl font-extrabold text-slate-900">2.4%</p>
        <div className="flex items-center gap-1 mt-1">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2.5"
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <span className="text-[8px] text-green-500 font-semibold">
            -0.8% vs last qtr
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  onOpenTrial,
}: {
  onOpenTrial: () => void
}) {
  return (
    <section id="hero" className="pt-28 sm:pt-32 lg:pt-36 pb-20 px-6 hero-bg overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Text Content */}
          <div className="lg:col-span-6 text-center lg:text-left">
            <FadeUp delay={0}>
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200/60 text-blue-700 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                HR NEXA 3.0 Live — AI-Driven Workforce Platform
              </div>
            </FadeUp>
            <FadeUp delay={80}>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900 tracking-tight leading-[1.18] mb-5">
                The Complete HR &amp; Payroll{' '}
                <span className="gradient-text">Operating System</span>
              </h1>
            </FadeUp>
            <FadeUp delay={160}>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-7 max-w-lg mx-auto lg:mx-0">
                Automate payroll, track attendance with biometric &amp; geo-fencing,
                manage performance reviews, and empower employees with a modern
                self-service portal.
              </p>
            </FadeUp>
            <FadeUp delay={240}>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <button
                  onClick={onOpenTrial}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer animate-shimmer"
                >
                  Start 14-Day Free Trial
                </button>
                <button
                  onClick={() => scrollToSectionId('features')}
                  className="w-full sm:w-auto text-slate-700 hover:text-slate-900 font-semibold text-sm px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                  Explore Features
                </button>
              </div>
            </FadeUp>
            <FadeUp delay={300}>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 mt-8 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Setup in under 5 minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Cancel anytime
                </span>
              </div>
            </FadeUp>
          </div>

          {/* Right Column: Interactive Dashboard Animation */}
          <div className="lg:col-span-6 relative mt-8 lg:mt-0">
            <FadeUp delay={350}>
              <DashboardMockup />
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── TrustedBy ────────────────────────────────────────────────────────────────

function TrustedBy() {
  const logos = [
    'Zomato',
    'Swiggy',
    'Razorpay',
    'CRED',
    'Groww',
    'Zepto',
    'Urban Company',
    'PhonePe',
  ]
  return (
    <section className="py-12 border-y border-slate-100 bg-slate-50/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-6 text-center">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Trusted by 500+ High-Growth Companies &amp; Enterprise Teams
        </p>
      </div>
      <div className="flex overflow-hidden">
        <div className="flex gap-12 animate-marquee shrink-0 items-center">
          {[...logos, ...logos].map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-slate-400 font-bold text-lg hover:text-slate-600 transition-colors whitespace-nowrap px-4"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500/60" />
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FeatureGrid ─────────────────────────────────────────────────────────────

const features = [
  {
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    title: 'Core HR & Employee Directory',
    desc: 'Centralized employee profiles, org charts, document management, and seamless digital onboarding in minutes.',
    color: 'blue',
  },
  {
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ),
    title: 'Automated 1-Click Payroll',
    desc: 'Statutory compliance (PF, ESI, TDS, PT), automated tax calculations, custom salary structures, and instant payslip generation.',
    color: 'green',
  },
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    title: 'Attendance & Time Tracking',
    desc: 'Biometric device sync, GPS geo-fenced mobile check-ins, shift scheduling, overtime rules, and regularization flows.',
    color: 'purple',
  },
  {
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    title: 'Leave & Absence Management',
    desc: 'Configurable leave policies (Casual, Sick, Earned, Maternity), multi-level approval matrices, and holiday calendars.',
    color: 'orange',
  },
  {
    icon: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
    title: 'People Analytics & Reports',
    desc: 'Real-time dashboards on attrition, headcount growth, diversity metrics, salary benchmarking, and customizable exports.',
    color: 'cyan',
  },
  {
    icon: (
      <>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </>
    ),
    title: 'Performance & 360° Reviews',
    desc: 'OKRs, goal tracking, continuous 1-on-1s, 360-degree peer feedback, appraisal cycles, and self-assessment workflows.',
    color: 'rose',
  },
]

function FeatureGrid() {
  return (
    <section id="features" className="py-24 bg-white px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-4">
            Everything You Need
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            Built for modern teams,<br />designed for total simplicity
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
            From hire to retire, HR NEXA consolidates your entire workforce stack
            into a single, unified interface.
          </p>
        </FadeUp>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeUp key={f.title} delay={i * 80}>
              <SpotlightCard className="bg-slate-50/70 rounded-2xl p-7 border border-slate-100 hover:border-slate-200 transition-all card-hover h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-6 shadow-sm">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {f.icon}
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed flex-1">
                  {f.desc}
                </p>
              </SpotlightCard>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── ProductShowcase ─────────────────────────────────────────────────────────

function ShowcaseTab({ active }: { active: string }) {
  if (active === 'payroll') {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h4 className="font-bold text-slate-900">Payroll Run — March 2026</h4>
            <p className="text-xs text-slate-400">
              248 employees · Automatic statutory deductions
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-green-50 text-green-600 rounded-full">
            Ready to Disburse
          </span>
        </div>
        <div className="space-y-3">
          {[
            { item: 'Gross Salary', val: '₹ 51,20,000' },
            { item: 'PF Deduction (12%)', val: '- ₹ 3,45,600' },
            { item: 'ESI Deduction (0.75%)', val: '- ₹ 38,400' },
            { item: 'TDS / Professional Tax', val: '- ₹ 4,56,000' },
            { item: 'Net Payout', val: '₹ 42,80,000', bold: true },
          ].map((r) => (
            <div
              key={r.item}
              className={`flex justify-between text-sm ${r.bold ? 'font-bold text-slate-900 pt-2 border-t border-slate-100 text-base' : 'text-slate-600'}`}
            >
              <span>{r.item}</span>
              <span className={r.bold ? 'text-blue-600' : ''}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (active === 'attendance') {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h4 className="font-bold text-slate-900">Today's Attendance Matrix</h4>
            <p className="text-xs text-slate-400">
              Live Biometric &amp; Geo-Checkin Feed
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
            93.1% Present
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div className="bg-green-50 p-3 rounded-xl">
            <p className="text-xs text-green-600 font-semibold">Present</p>
            <p className="text-xl font-bold text-green-700">231</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-xl">
            <p className="text-xs text-orange-600 font-semibold">On Leave</p>
            <p className="text-xl font-bold text-orange-700">12</p>
          </div>
          <div className="bg-red-50 p-3 rounded-xl">
            <p className="text-xs text-red-600 font-semibold">Absent / Late</p>
            <p className="text-xl font-bold text-red-700">5</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Sync status: Last synced with Biometric devices 12 seconds ago.
        </p>
      </div>
    )
  }

  if (active === 'performance') {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h4 className="font-bold text-slate-900">Q1 OKR Progress</h4>
            <p className="text-xs text-slate-400">
              Engineering &amp; Product Department
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-purple-50 text-purple-600 rounded-full">
            87% Completed
          </span>
        </div>
        <div className="space-y-4">
          {[
            { title: 'Launch Payroll 3.0 module', progress: 95 },
            { title: 'Achieve 99.9% Attendance Sync SLA', progress: 88 },
            { title: 'SOC 2 Type II Audit Certification', progress: 78 },
          ].map((okr) => (
            <div key={okr.title}>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700">{okr.title}</span>
                <span className="text-blue-600">{okr.progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${okr.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg text-center py-12">
      <h4 className="font-bold text-slate-900 mb-2">Real-time HR Analytics</h4>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        Interactive reports for voluntary attrition risk, gender diversity, and
        compensation benchmarks.
      </p>
    </div>
  )
}

function ProductShowcase() {
  const [activeTab, setActiveTab] = useState('payroll')
  const tabs = [
    { id: 'payroll', label: 'Payroll & Tax' },
    { id: 'attendance', label: 'Attendance & Geo' },
    { id: 'performance', label: 'OKRs & Appraisals' },
    { id: 'analytics', label: 'People Analytics' },
  ]

  return (
    <section id="solutions" className="py-24 bg-slate-50 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-3.5 shadow-xs">
            Product In Action
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            Interactive Product Deep-Dive
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
            Experience the unified interface trusted by growing enterprises.
          </p>
        </FadeUp>

        <div className="flex justify-center mb-10 overflow-x-auto pb-2">
          <div className="inline-flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <ShowcaseTab active={activeTab} />
        </div>
      </div>
    </section>
  )
}

// ─── WhyNEXA ──────────────────────────────────────────────────────────────────

function WhyNEXA() {
  const points = [
    {
      title: '10x Faster Processing',
      desc: 'Complete full payroll and attendance sync for 500+ employees in less than 60 seconds.',
      badge: 'Speed',
    },
    {
      title: 'AI-Powered Anomaly Detection',
      desc: 'Automatically flag attendance mismatches, duplicate claims, and salary calculation discrepancies before payroll runs.',
      badge: 'Intelligence',
    },
    {
      title: '100% Statutory Compliance',
      desc: 'Built specifically for Indian & Global labor regulations with automatic PF, ESI, PT, and TDS tax slabs.',
      badge: 'Security',
    },
  ]

  return (
    <section id="about" className="py-24 bg-white px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <FadeUp>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
              Why HR NEXA
            </div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-6">
              Engineered for speed,<br />built for scale
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Legacy HR systems are clunky, siloed, and slow. HR NEXA was built
              from the ground up with modern software design, instant load times,
              and seamless multi-entity capabilities.
            </p>
            <div className="space-y-4">
              {points.map((p) => (
                <div
                  key={p.title}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md shrink-0 mt-0.5">
                    {p.badge}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">
                      {p.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={150}>
            <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <h3 className="text-2xl font-bold mb-4">Enterprise Grade SLA</h3>
              <p className="text-blue-100 text-sm leading-relaxed mb-6">
                Our infrastructure guarantees 99.9% uptime, end-to-end AES-256
                encryption, automated daily backups, and strict RBAC controls.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
                  <p className="text-3xl font-extrabold">99.9%</p>
                  <p className="text-xs text-blue-100 mt-1">Uptime SLA</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
                  <p className="text-3xl font-extrabold">&lt; 100ms</p>
                  <p className="text-xs text-blue-100 mt-1">API Response</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
                  <p className="text-3xl font-extrabold">256-bit</p>
                  <p className="text-xs text-blue-100 mt-1">AES Encryption</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
                  <p className="text-3xl font-extrabold">24 / 7</p>
                  <p className="text-xs text-blue-100 mt-1">Live Support</p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline() {
  const steps = [
    {
      day: 'Day 1',
      title: 'Company Setup',
      desc: 'Configure departments, designations, shifts, and leave policies in minutes.',
    },
    {
      day: 'Day 3',
      title: 'Import Employee Data',
      desc: 'Bulk upload employee profiles, salary structures, and leave balances via Excel or API.',
    },
    {
      day: 'Day 7',
      title: 'Go Live & Device Sync',
      desc: 'Connect biometric machines and enable geo-fenced mobile attendance for all staff.',
    },
    {
      day: 'Day 14',
      title: 'Automated 1st Payroll',
      desc: 'Generate, approve, and disburse your first error-free payroll run with automatic payslips.',
    },
  ]

  return (
    <section id="roadmap" className="py-24 bg-slate-50 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
            Implementation Roadmap
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Go live in less than two weeks
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Our white-glove onboarding team ensures a seamless transition from
            your existing HRMS.
          </p>
        </FadeUp>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <FadeUp key={step.day} delay={i * 90}>
              <div className="bg-white rounded-2xl p-6 border border-slate-200 card-hover h-full flex flex-col">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 block">
                  {step.day}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed flex-1">
                  {step.desc}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function StatCounter({
  target,
  suffix,
  label,
  started,
}: {
  target: number
  suffix: string
  label: string
  started: boolean
}) {
  const val = useCounter(target, started)
  return (
    <div>
      <p className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
        {val}
        {suffix}
      </p>
      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">{label}</p>
    </div>
  )
}

function Statistics() {
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          obs.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-16 bg-white border-y border-slate-100 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <StatCounter
            target={100}
            suffix="K+"
            label="Employees Managed"
            started={started}
          />
          <StatCounter
            target={500}
            suffix="Cr+"
            label="₹ Payroll Processed"
            started={started}
          />
          <StatCounter
            target={99}
            suffix=".9%"
            label="Attendance Accuracy"
            started={started}
          />
          <StatCounter
            target={98}
            suffix="%"
            label="Customer Retention"
            started={started}
          />
        </div>
      </div>
    </section>
  )
}

// ─── ModulesGrid ──────────────────────────────────────────────────────────────

const allModules = [
  {
    title: 'Core Employee Directory',
    desc: 'Centralized employee database with customizable profiles and secure document storage.',
    icon: '👥',
  },
  {
    title: 'Attendance & Geo-Tracking',
    desc: 'Biometric device sync, GPS mobile check-ins with geo-fencing, and live shift schedules.',
    icon: '📍',
  },
  {
    title: 'Automated Payroll Engine',
    desc: '1-click payroll processing with built-in PF, ESI, TDS, PT calculations and bank transfer sheets.',
    icon: '💳',
  },
  {
    title: 'Smart Leave Management',
    desc: 'Multi-level approval workflows, leave quota trackers, and automated compensatory off rules.',
    icon: '🌴',
  },
  {
    title: 'Performance & OKR Reviews',
    desc: 'Quarterly OKRs, 360° peer reviews, manager appraisal cycles, and continuous feedback.',
    icon: '🎯',
  },
  {
    title: 'Recruitment & ATS Pipeline',
    desc: 'Candidate pipeline stages, interview evaluations, and automated offer letter generators.',
    icon: '📋',
  },
  {
    title: 'Employee Document Vault',
    desc: 'End-to-end document management with digital verification, expiry alerts, and category tagging.',
    icon: '📁',
  },
  {
    title: 'Workforce Analytics',
    desc: 'Department headcount breakdown, attendance rate tracking, and payroll distribution metrics.',
    icon: '📊',
  },
]

function ModulesGrid() {
  return (
    <section id="resources" className="py-24 bg-slate-50 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-3.5">
            Unified Suite
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            8 Powerful Modules, One Login
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
            Say goodbye to 5 different tools for HR, payroll, attendance, and
            performance.
          </p>
        </FadeUp>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {allModules.map((m, i) => (
            <FadeUp key={m.title} delay={i * 60}>
              <div className="bg-white rounded-2xl p-6 border border-slate-200 card-hover h-full flex flex-col">
                <span className="text-3xl mb-4 block">{m.icon}</span>
                <h3 className="font-bold text-slate-900 text-base mb-2">
                  {m.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed flex-1">
                  {m.desc}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── ComparisonTable ──────────────────────────────────────────────────────────

function ComparisonTable() {
  const rows = [
    {
      feature: 'Payroll Processing Time',
      nexa: 'Under 1 minute',
      traditional: '2–3 days',
      sheets: '5+ days',
    },
    {
      feature: 'Biometric & GPS Mobile Sync',
      nexa: 'Instant Live Sync',
      traditional: 'Manual CSV import',
      sheets: 'Not possible',
    },
    {
      feature: 'Statutory Compliance (PF, ESI, TDS)',
      nexa: '100% Automated',
      traditional: 'Semi-automated',
      sheets: 'Manual risk of errors',
    },
    {
      feature: 'Employee Self-Service Portal',
      nexa: 'Web & Mobile App',
      traditional: 'Legacy portal',
      sheets: 'Email / WhatsApp',
    },
    {
      feature: 'Setup & Implementation',
      nexa: 'Less than 7 days',
      traditional: '2–3 months',
      sheets: 'Ongoing maintenance',
    },
  ]

  return (
    <section className="py-24 bg-white px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-3.5">
            Comparison
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            How HR NEXA Compares
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            See why modern companies switch to HR NEXA for their workforce operations.
          </p>
        </FadeUp>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-4 px-6 text-sm font-bold text-slate-900">
                  Feature / Capability
                </th>
                <th className="py-4 px-6 text-sm font-bold text-blue-600 bg-blue-50/70 rounded-t-xl">
                  HR NEXA
                </th>
                <th className="py-4 px-6 text-sm font-bold text-slate-600">
                  Traditional HRMS
                </th>
                <th className="py-4 px-6 text-sm font-bold text-slate-400">
                  Excel &amp; Spreadsheets
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.feature}
                  className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/30' : ''
                    }`}
                >
                  <td className="py-4 px-6 text-sm font-semibold text-slate-800">
                    {r.feature}
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-blue-700 bg-blue-50/50">
                    ✓ {r.nexa}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600">
                    {r.traditional}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-400">
                    {r.sheets}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote:
      'HR NEXA reduced our monthly payroll processing time from 3 full days to less than 15 minutes. The biometric device sync has been 100% reliable.',
    author: 'Priya Sharma',
    role: 'VP of Human Resources',
    company: 'Fintech Scaleup (350+ Employees)',
    avatar: 'PS',
  },
  {
    quote:
      'The employee self-service portal is slick. Our team can apply for leaves, download payslips, and check reimbursement status without sending a single HR email.',
    author: 'Rahul Verma',
    role: 'Director of People Operations',
    company: 'Logistics Tech (500+ Employees)',
    avatar: 'RV',
  },
  {
    quote:
      'Switching to HR NEXA was painless. We were completely live with attendance, shifts, and leave matrices in under a week.',
    author: 'Ananya Deshmukh',
    role: 'Chief Human Resource Officer',
    company: 'Healthcare Group (1,200+ Staff)',
    avatar: 'AD',
  },
]

function Testimonials() {
  return (
    <section className="py-24 bg-slate-50 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
            Customer Stories
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Loved by HR Leaders &amp; Employees
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Here is what high-growth businesses say about HR NEXA.
          </p>
        </FadeUp>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <FadeUp key={t.author} delay={i * 90}>
              <div className="bg-white rounded-2xl p-8 border border-slate-200 card-hover h-full flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-yellow-400 mb-4">
                    {'★★★★★'.split('').map((s, idx) => (
                      <span key={idx} className="text-base">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    "{t.quote}"
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200/60">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {t.author}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {t.role} · {t.company}
                    </p>
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function PricingSkeleton() {
  return (
    <div className="grid lg:grid-cols-3 gap-6 items-stretch">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-8 border border-slate-200 bg-slate-50/50 h-96 flex flex-col justify-between animate-pulse"
        >
          <div>
            <div className="h-6 bg-slate-200 rounded-md w-1/3 mb-3" />
            <div className="h-4 bg-slate-200 rounded-md w-2/3 mb-6" />
            <div className="h-10 bg-slate-200 rounded-md w-1/2 mb-8" />
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded-md w-full" />
              <div className="h-4 bg-slate-200 rounded-md w-4/5" />
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
            </div>
          </div>
          <div className="h-12 bg-slate-200 rounded-xl w-full" />
        </div>
      ))}
    </div>
  )
}

function Pricing({
  onSelectPlan,
}: {
  onSelectPlan: (plan: PublicPlan, cycle: BillingCycle) => void
}) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('Monthly')
  const { data, isLoading, isError, refetch } = usePublicPlansQuery()

  const plans = data?.plans || []

  return (
    <section id="pricing" className="py-24 bg-white px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-4">
            Pricing
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            Transparent pricing,<br />no surprises
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
            Start free. Scale as you grow. Cancel anytime.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setBillingCycle('Monthly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${billingCycle === 'Monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('Annual')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${billingCycle === 'Annual'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <span>Annual Billing</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${billingCycle === 'Annual'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-green-100 text-green-700'
                  }`}
              >
                Save ~15-20%
              </span>
            </button>
          </div>
        </FadeUp>

        {isLoading && plans.length === 0 ? (
          <PricingSkeleton />
        ) : isError && plans.length === 0 ? (
          <div className="text-center py-12 px-6 border border-slate-200 rounded-2xl bg-slate-50 max-w-lg mx-auto">
            <p className="text-slate-700 font-semibold mb-2">
              Unable to load live pricing plans
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Please check your connection or retry to fetch latest pricing.
            </p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No published plans available at this moment.
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((p, i) => {
              const isFree = (p.monthlyPrice ?? 0) === 0
              const priceDisplay = isFree
                ? '₹ 0'
                : billingCycle === 'Monthly'
                  ? `₹ ${p.monthlyPrice.toLocaleString('en-IN')}`
                  : `₹ ${Math.round((p.yearlyPrice || 0) / 12).toLocaleString('en-IN')}`
              const periodDisplay = isFree
                ? 'forever'
                : billingCycle === 'Monthly'
                  ? '/ month'
                  : `/ month (billed ₹${p.yearlyPrice.toLocaleString('en-IN')}/yr)`

              const includedFeatures = (p.features || []).filter((f) => f.included)

              return (
                <FadeUp key={p.id || p.code} delay={i * 100}>
                  <div
                    className={`relative rounded-2xl p-8 border h-full flex flex-col ${p.isPopular
                        ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-500/25 scale-105'
                        : 'bg-white border-slate-200'
                      }`}
                  >
                    {p.isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-cyan-400 text-slate-900 text-xs font-bold px-4 py-1 rounded-full shadow-xs">
                        Most Popular
                      </div>
                    )}
                    <div className="mb-6">
                      <h3
                        className={`text-xl font-extrabold mb-1 ${p.isPopular ? 'text-white' : 'text-slate-900'
                          }`}
                      >
                        {p.name}
                      </h3>
                      <p
                        className={`text-sm mb-4 ${p.isPopular ? 'text-blue-200' : 'text-slate-500'
                          }`}
                      >
                        {p.description || 'Full workforce management module.'}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-4xl font-extrabold ${p.isPopular ? 'text-white' : 'text-slate-900'
                              }`}
                          >
                            {priceDisplay}
                          </span>
                          <span
                            className={`text-xs pb-1 font-medium ${p.isPopular ? 'text-blue-200' : 'text-slate-500'
                              }`}
                          >
                            / mo
                          </span>
                        </div>
                        {isFree ? (
                          <span className="text-xs text-slate-400">No credit card required</span>
                        ) : billingCycle === 'Annual' ? (
                          <span
                            className={`text-[11px] font-semibold ${p.isPopular ? 'text-blue-200' : 'text-blue-600'
                              }`}
                          >
                            Billed annually: ₹{p.yearlyPrice.toLocaleString('en-IN')} / year
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <ul className="space-y-3 flex-1 mb-8">
                      {p.limits && (
                        <li className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${p.isPopular ? 'bg-blue-500' : 'bg-green-50'
                              }`}
                          >
                            <svg
                              width="8"
                              height="8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={p.isPopular ? 'white' : '#22C55E'}
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span
                            className={`text-sm font-semibold ${p.isPopular ? 'text-white' : 'text-slate-800'
                              }`}
                          >
                            Up to {p.limits.employeeLimit} employees
                          </span>
                        </li>
                      )}
                      {includedFeatures.map((f) => (
                        <li key={f.key || f.name} className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${p.isPopular ? 'bg-blue-500' : 'bg-green-50'
                              }`}
                          >
                            <svg
                              width="8"
                              height="8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={p.isPopular ? 'white' : '#22C55E'}
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span
                            className={`text-sm ${p.isPopular ? 'text-blue-100' : 'text-slate-600'
                              }`}
                          >
                            {f.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => onSelectPlan(p, billingCycle)}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${p.isPopular
                          ? 'bg-white text-blue-600 hover:bg-blue-50'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                    >
                      {isFree ? 'Start 14-Day Free Trial' : `Get Started with ${p.name}`}
                    </button>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Security ─────────────────────────────────────────────────────────────────

const securityItems = [
  {
    icon: '🔒',
    title: 'SSL / TLS Encryption',
    desc: 'All data in transit is encrypted with bank-grade TLS 1.3 protocols.',
  },
  {
    icon: '👥',
    title: 'Role-Based Access',
    desc: 'Fine-grained permissions ensure employees only see what they should.',
  },
  {
    icon: '☁️',
    title: 'Automated Cloud Backup',
    desc: 'Daily encrypted backups with 99-day retention and instant restore.',
  },
  {
    icon: '🔐',
    title: 'Data Encryption at Rest',
    desc: 'AES-256 encryption for all stored employee and payroll data.',
  },
  {
    icon: '📋',
    title: 'Complete Audit Logs',
    desc: 'Every action is timestamped and logged for full accountability.',
  },
  {
    icon: '✅',
    title: 'Compliance Certified',
    desc: 'SOC 2 Type II, ISO 27001, and GDPR-ready infrastructure.',
  },
]

function Security() {
  return (
    <section id="security" className="py-24 bg-slate-50 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-4">
            Security &amp; Trust
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            Enterprise-grade security,<br />from day one
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
            Your employee data deserves the highest level of protection. HR NEXA
            is built with security at every layer.
          </p>
        </FadeUp>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {securityItems.map((s, i) => (
            <FadeUp key={s.title} delay={i * 60}>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 card-hover h-full">
                <span className="text-3xl mb-4 block">{s.icon}</span>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {s.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'How fast can we migrate from our current HRMS or Excel?',
    a: 'Most companies migrate in 3 to 7 days using our Excel bulk import templates or direct API connectors. Our onboarding team assists you throughout.',
  },
  {
    q: 'Does HR NEXA support biometric device integration?',
    a: 'Yes, HR NEXA seamlessly connects with popular biometric attendance machines (eSSL, ZKTeco, Matrix) as well as geo-fenced mobile check-ins.',
  },
  {
    q: 'Is statutory compliance (PF, ESI, TDS, PT) calculated automatically?',
    a: 'Yes, statutory deductions and tax rules are built-in and updated whenever government slabs change.',
  },
  {
    q: 'Can we customize leave policies and approval hierarchies?',
    a: 'Absolutely. You can define custom leave types, multi-level approval hierarchies by department or designation, and rollover policies.',
  },
  {
    q: 'Is there a long-term contract or setup fee?',
    a: 'No hidden setup fees and no lock-in contracts. You can pay month-to-month or save with annual billing.',
  },
]

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 bg-white px-6">
      <div className="max-w-4xl mx-auto">
        <FadeUp className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-3.5">
            Frequently Asked Questions
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
            Got Questions? We Have Answers.
          </h2>
          <p className="text-sm sm:text-base text-slate-500">
            Everything you need to know about getting started with HR NEXA.
          </p>
        </FadeUp>

        <div className="space-y-4">
          {faqs.map((faq, i) => {
            const isOpen = openIdx === i
            return (
              <FadeUp key={faq.q} delay={i * 50}>
                <div className="border border-slate-200 rounded-2xl overflow-hidden transition-colors">
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    className="w-full px-6 py-4 text-left font-semibold text-slate-900 flex justify-between items-center cursor-pointer hover:bg-slate-50 text-sm sm:text-base"
                  >
                    <span>{faq.q}</span>
                    <span className="text-blue-600 text-lg font-bold ml-4">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              </FadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── FinalCTA ─────────────────────────────────────────────────────────────────

function FinalCTA({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="py-24 bg-slate-950 text-white px-6 relative overflow-hidden">
      {/* High-tech ambient grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:28px_28px] opacity-15 pointer-events-none" />

      {/* Central Pulsing Ambient Core Glow */}
      <div
        className="absolute top-1/2 left-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-blue-600/40 via-indigo-500/35 to-cyan-400/30 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ animation: 'ctaPulseGlow 5s ease-in-out infinite' }}
      />

      {/* Orbiting Dynamic Glowing Orbs */}
      <div
        className="absolute top-[-10%] right-[10%] w-[420px] h-[420px] bg-blue-500/40 rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'ctaOrbit1 5.5s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-[-10%] left-[10%] w-[440px] h-[440px] bg-cyan-400/35 rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'ctaOrbit2 5s ease-in-out infinite' }}
      />
      <div
        className="absolute top-[20%] left-[45%] w-[380px] h-[380px] bg-violet-600/30 rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'ctaOrbit3 4.5s ease-in-out infinite' }}
      />

      <div className="max-w-3xl mx-auto text-center relative z-10">
        <FadeUp>
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-[11px] sm:text-xs font-semibold px-3.5 py-1 rounded-full mb-5 border border-blue-400/30 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Get Started Today
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 leading-snug text-white">
            Ready to transform your HR &amp; Payroll operations?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mb-7 max-w-xl mx-auto leading-relaxed">
            Join hundreds of forward-thinking companies running frictionless HR
            on HR NEXA. Start your 14-day free trial now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenTrial}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-7 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/40 hover:shadow-blue-500/60 cursor-pointer animate-shimmer"
            >
              Start 14-Day Free Trial
            </button>
            <button
              onClick={() => scrollToSectionId('pricing')}
              className="w-full sm:w-auto text-white hover:bg-white/10 font-semibold text-sm px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 transition-all cursor-pointer backdrop-blur-sm"
            >
              View Pricing Plans
            </button>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

interface FooterLinkItem {
  label: string
  action?: () => void
  href?: string
  icon?: LucideIcon
}

interface FooterSectionItem {
  title: string
  links: FooterLinkItem[]
}

function Footer({
  onNavigateLogin,
  onOpenTrial,
}: {
  onNavigateLogin: () => void
  onOpenTrial: () => void
}) {
  const footerSections: FooterSectionItem[] = [
    {
      title: 'Products',
      links: [
        {
          label: 'Company CRM',
          href: 'https://www.dezocrm.com/',
          icon: Building2,
        },
        {
          label: 'Real-estate CRM',
          href: 'https://www.estatycore.com/',
          icon: Home,
        },
        {
          label: 'School ERP',
          href: 'https://www.schoolycore.com/',
          icon: GraduationCap,
        },
        {
          label: 'School ERP Lite',
          href: 'https://www.schoolycorelite.com/',
          icon: BookOpen,
        },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', action: () => scrollToSectionId('about') },
        { label: 'Security & Compliance', action: () => scrollToSectionId('security') },
        { label: 'Roadmap', action: () => scrollToSectionId('roadmap') },
        { label: 'Careers', action: () => scrollToSectionId('about') },
      ],
    },
    {
      title: 'Access',
      links: [
        { label: 'Sign In', action: onNavigateLogin },
        { label: 'Start Free Trial', action: onOpenTrial },
        { label: 'FAQ', action: () => scrollToSectionId('faq') },
      ],
    },
  ]

  return (
    <footer className="bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 pb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/logo.png"
                alt="HR Nexa Logo"
                className="h-7 w-auto object-contain"
              />
              <span className="font-display font-extrabold text-lg text-white tracking-tight">
                HR <span className="text-blue-500">NEXA</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
              The all-in-one HR, payroll, and workforce operating system built
              for high-growth startups and global enterprises.
            </p>
          </div>

          {footerSections.map((sec) => (
            <div key={sec.title}>
              <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                {sec.title}
              </p>
              <ul className="space-y-2.5">
                {sec.links.map((link) => {
                  const Icon = link.icon
                  return (
                    <li key={link.label}>
                      {link.href ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-all duration-200"
                        >
                          {Icon && (
                            <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors duration-200 shrink-0" />
                          )}
                          <span className="group-hover:translate-x-0.5 transition-transform duration-200">
                            {link.label}
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-blue-400 transition-all duration-200 -ml-0.5" />
                        </a>
                      ) : (
                        <button
                          onClick={link.action}
                          className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          {link.label}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            © 2026 HR NEXA. All rights reserved. Built for modern HR teams.
          </p>
          <div className="flex items-center gap-2">
            {[
              {
                label: 'Website',
                href: 'https://www.dezoryntechnology.com/',
                icon: Globe,
              },
              {
                label: 'Instagram',
                href: 'https://www.instagram.com/dezoryn_technology/',
                icon: Instagram,
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/in/dezoryn-technology-a69727405/',
                icon: Linkedin,
              },
              {
                label: 'Facebook',
                href: 'https://www.facebook.com/p/Dezoryn-Technology-61582299157480/',
                icon: Facebook,
              },
            ].map((social) => {
              const Icon = social.icon
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all duration-200 inline-flex items-center justify-center group"
                >
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Checkout & Registration Modal (Phase B2.2) ──────────────────────────────

type CheckoutStep =
  | 'FORM'
  | 'CREATING_ORDER'
  | 'PAYMENT_OPEN'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'ERROR'

function CheckoutModal({
  initialPlan,
  initialCycle = 'Monthly',
  onClose,
}: {
  initialPlan?: PublicPlan | null
  initialCycle?: BillingCycle
  onClose: () => void
}) {
  const { data: publicPlansData } = usePublicPlansQuery()
  const availablePlans = publicPlansData?.plans || []

  // Resolve active selected plan
  const [selectedPlan, setSelectedPlan] = useState<PublicPlan | null>(() => {
    if (initialPlan) return initialPlan
    // Default to popular plan or first available plan
    return availablePlans.find((p) => p.isPopular) || availablePlans[0] || null
  })

  // Sync if initialPlan updates or plans load
  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan)
    } else if (!selectedPlan && availablePlans.length > 0) {
      setSelectedPlan(availablePlans.find((p) => p.isPopular) || availablePlans[0])
    }
  }, [initialPlan, availablePlans])

  const [cycle, setCycle] = useState<BillingCycle>(initialCycle)
  const [step, setStep] = useState<CheckoutStep>('FORM')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdOrder, setCreatedOrder] = useState<CheckoutOrderResponse | null>(null)
  const [successResult, setSuccessResult] = useState<{
    company: string
    ownerEmail: string
    planName: string
    cycle: string
    message?: string
  } | null>(null)

  const [formData, setFormData] = useState({
    company: '',
    ownerName: '',
    ownerEmail: '',
    contact: '',
    gst: '',
    address: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedPlan) {
      setErrorMessage('Please select a plan before proceeding.')
      return
    }

    if (!formData.company.trim() || !formData.ownerName.trim() || !formData.ownerEmail.trim()) {
      setErrorMessage('Company Name, Owner Name, and Work Email are required.')
      return
    }

    try {
      setIsSubmitting(true)
      setStep('CREATING_ORDER')

      // 1. Create server-authoritative checkout order (B1 API)
      const order = await checkoutService.createCheckoutOrder({
        company: formData.company.trim(),
        plan: selectedPlan.code || selectedPlan.name,
        cycle,
        ownerName: formData.ownerName.trim(),
        ownerEmail: formData.ownerEmail.trim().toLowerCase(),
        contact: formData.contact.trim() || undefined,
        gst: formData.gst.trim() || undefined,
        address: formData.address.trim() || undefined,
      })

      setCreatedOrder(order)
      setStep('PAYMENT_OPEN')

      // 2. Launch Razorpay Standard Checkout
      await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amountMinor,
        currency: order.currency || 'INR',
        name: 'HR NEXA',
        description: `${order.planName} Plan (${order.cycle})`,
        image: '/logo.png',
        order_id: order.orderId,
        prefill: {
          name: formData.ownerName,
          email: formData.ownerEmail,
          contact: formData.contact || '',
        },
        notes: {
          company: order.company,
          plan: order.planName,
          cycle: order.cycle,
        },
        theme: {
          color: '#2563EB',
        },
        handler: async (response) => {
          // 3. Payment captured on gateway -> Submit tokens for verification
          setStep('VERIFYING')
          try {
            const verifyResult = await checkoutService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })

            setSuccessResult({
              company: order.company,
              ownerEmail: formData.ownerEmail,
              planName: order.planName,
              cycle: order.cycle,
              message: verifyResult.message,
            })
            setStep('SUCCESS')
          } catch (verifyErr: any) {
            setStep('ERROR')
            setErrorMessage(
              verifyErr?.message ||
              'Payment received, finalizing workspace setup. Please check your email for confirmation.',
            )
          }
        },
        onDismiss: () => {
          setStep('FORM')
          setErrorMessage('Payment was cancelled. You can review your details and proceed whenever ready.')
        },
        onPaymentFailed: (failure) => {
          setStep('FORM')
          setErrorMessage(
            failure?.error?.description ||
            'Payment failed at the gateway. Please try another card, NetBanking, or UPI.',
          )
        },
      })
    } catch (err: any) {
      setStep('FORM')
      const msg = err?.message || 'Failed to initialize checkout. Please try again.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 relative overflow-hidden my-8">
        {step !== 'VERIFYING' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-2">
          <img src="/logo.png" alt="HR Nexa Logo" className="h-6 w-auto object-contain" />
          <span className="font-display font-bold text-slate-900 tracking-tight">HR NEXA</span>
        </div>

        {/* ─── SUCCESS VIEW ─── */}
        {step === 'SUCCESS' && successResult ? (
          <div className="py-4 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xs">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              Your workspace is ready!
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Your HR NEXA tenant instance has been successfully provisioned.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Company:</span>
                <span className="font-bold text-slate-900">{successResult.company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Owner Email:</span>
                <span className="font-bold text-slate-900">{successResult.ownerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Plan:</span>
                <span className="font-bold text-blue-600">
                  {successResult.planName} ({successResult.cycle})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className="font-bold text-green-600">Active / Provisioned</span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-left text-xs text-blue-900 mb-6 flex items-start gap-2.5">
              <span className="text-base">🚀</span>
              <div>
                <p className="font-bold mb-0.5">Welcome Email Sent!</p>
                <p className="text-blue-700">
                  Your login URL and initial password have been sent to{' '}
                  <span className="font-semibold text-blue-950">{successResult.ownerEmail}</span>. Please check your inbox.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                window.location.href = '/login'
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Go to HR NEXA Login
            </button>
          </div>
        ) : step === 'VERIFYING' ? (
          /* ─── VERIFYING VIEW ─── */
          <div className="py-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Verifying Payment</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Validating transaction signature and provisioning your tenant database workspace...
            </p>
          </div>
        ) : step === 'CREATING_ORDER' ? (
          /* ─── CREATING ORDER VIEW ─── */
          <div className="py-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Preparing Secure Checkout</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Connecting with payment gateway...
            </p>
          </div>
        ) : (
          /* ─── REGISTRATION & CHECKOUT FORM VIEW ─── */
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-1">
              Set Up Your Workspace
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Enter your organization details to initialize your workspace and start your subscription.
            </p>

            {/* Selected Plan Summary Card */}
            {selectedPlan && (
              <div className="mb-5 p-3.5 bg-blue-50/80 border border-blue-100 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-900 text-sm">{selectedPlan.name} Plan</span>
                    {selectedPlan.isPopular && (
                      <span className="text-[10px] font-bold bg-cyan-400 text-slate-950 px-2 py-0.5 rounded-full">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div className="flex items-center bg-white rounded-lg p-0.5 border border-blue-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setCycle('Monthly')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${cycle === 'Monthly' ? 'bg-blue-600 text-white' : 'text-slate-600'
                        }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setCycle('Annual')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${cycle === 'Annual' ? 'bg-blue-600 text-white' : 'text-slate-600'
                        }`}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-blue-950 pt-1 border-t border-blue-100">
                  <span className="text-slate-600">
                    Up to {selectedPlan.limits?.employeeLimit ?? 50} employees
                  </span>
                  <span className="font-bold text-blue-800">
                    {selectedPlan.monthlyPrice === 0
                      ? 'Free (₹ 0)'
                      : cycle === 'Monthly'
                        ? `₹ ${selectedPlan.monthlyPrice.toLocaleString('en-IN')} / mo`
                        : `₹ ${Math.round((selectedPlan.yearlyPrice || 0) / 12).toLocaleString('en-IN')} / mo (₹${(selectedPlan.yearlyPrice || 0).toLocaleString('en-IN')}/yr)`}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <span className="font-bold text-sm">⚠️</span>
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleStartPayment} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Acme Innovations Pvt Ltd"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="Alex Morgan"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    placeholder="alex@acme.com"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GST Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                    placeholder="29AAAAA0000A1Z5"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Business Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Bengaluru, Karnataka, India"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Proceed to Payment</span>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-400">
                <span>🔒 256-Bit SSL Encrypted</span>
                <span>•</span>
                <span>Powered by Razorpay</span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Landing Page Component ──────────────────────────────────────────────

export default function LandingPage() {
  const [checkoutModalState, setCheckoutModalState] = useState<{
    open: boolean
    plan?: PublicPlan | null
    cycle?: BillingCycle
  }>({ open: false })
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')
  const navigate = useNavigate()

  const handleNavigateLogin = () => {
    navigate({ to: '/login' })
  }

  const handleOpenCheckout = (plan?: PublicPlan | null, cycle: BillingCycle = 'Monthly') => {
    setCheckoutModalState({ open: true, plan, cycle })
  }

  const handleOpenTrialContact = () => {
    setIsContactModalOpen(true)
  }

  useEffect(() => {
    const sections = ['hero', 'features', 'solutions', 'about', 'pricing', 'resources']
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.3 }
    )

    sections.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page min-h-screen bg-white">
      <Navbar
        activeSection={activeSection}
        onOpenTrial={handleOpenTrialContact}
        onNavigateLogin={handleNavigateLogin}
      />
      <Hero onOpenTrial={handleOpenTrialContact} />
      <TrustedBy />
      <FeatureGrid />
      <ProductShowcase />
      <WhyNEXA />
      <Timeline />
      <Statistics />
      <ModulesGrid />
      <ComparisonTable />
      <Testimonials />
      <Pricing
        onSelectPlan={(plan, cycle) => {
          const isFree = (plan?.monthlyPrice ?? 0) === 0
          if (isFree) {
            handleOpenTrialContact()
          } else {
            handleOpenCheckout(plan, cycle)
          }
        }}
      />
      <Security />
      <FAQ />
      <FinalCTA onOpenTrial={handleOpenTrialContact} />
      <Footer
        onNavigateLogin={handleNavigateLogin}
        onOpenTrial={handleOpenTrialContact}
      />

      <FreeTrialContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {checkoutModalState.open && (
        <CheckoutModal
          initialPlan={checkoutModalState.plan}
          initialCycle={checkoutModalState.cycle}
          onClose={() => setCheckoutModalState({ open: false })}
        />
      )}
    </div>
  )
}
