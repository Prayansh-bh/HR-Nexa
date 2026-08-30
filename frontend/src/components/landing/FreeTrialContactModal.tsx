import { useState, useEffect, type FormEvent } from 'react'
import {
  X,
  User,
  Mail,
  Phone,
  Building2,
  Users,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Lock,
} from 'lucide-react'
import { trialRequestService } from '../../services/trialRequest.service'

interface FreeTrialContactModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ContactFormData {
  fullName: string
  workEmail: string
  phoneNumber: string
  companyName: string
  teamSize: string
  selectedModules: string[]
  message: string
}

const MODULE_OPTIONS = [
  'Payroll & Statutory',
  'Attendance & Biometrics',
  'Leave Management',
  'Performance & Reviews',
  'Recruitment & ATS',
  'Employee Self-Service',
]

const TEAM_SIZE_OPTIONS = [
  '1 - 10 Employees',
  '11 - 50 Employees',
  '51 - 200 Employees',
  '201 - 500 Employees',
  '500+ Enterprise',
]

export function FreeTrialContactModal({ isOpen, onClose }: FreeTrialContactModalProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: '',
    workEmail: '',
    phoneNumber: '',
    companyName: '',
    teamSize: '11 - 50 Employees',
    selectedModules: ['Payroll & Statutory', 'Attendance & Biometrics'],
    message: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const toggleModule = (module: string) => {
    setFormData((prev) => {
      const exists = prev.selectedModules.includes(module)
      if (exists) {
        return {
          ...prev,
          selectedModules: prev.selectedModules.filter((m) => m !== module),
        }
      }
      return {
        ...prev,
        selectedModules: [...prev.selectedModules, module],
      }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!formData.fullName.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }
    if (!formData.workEmail.trim() || !formData.workEmail.includes('@')) {
      setErrorMsg('Please enter a valid work email address.')
      return
    }
    if (!formData.companyName.trim()) {
      setErrorMsg('Please enter your company name.')
      return
    }
    if (!formData.phoneNumber.trim()) {
      setErrorMsg('Please enter your phone number.')
      return
    }

    setIsSubmitting(true)

    try {
      await trialRequestService.submitTrialRequest({
        fullName: formData.fullName.trim(),
        workEmail: formData.workEmail.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        companyName: formData.companyName.trim(),
        teamSize: formData.teamSize,
        selectedModules: formData.selectedModules,
        message: formData.message.trim() || undefined,
      })
      setIsSubmitted(true)
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Something went wrong while submitting your request. Please try again or contact support.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 my-8 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-gradient-to-br from-blue-500/15 to-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-gradient-to-tr from-purple-500/15 to-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        {isSubmitted ? (
          /* ─── SUCCESS VIEW ─── */
          <div className="py-6 text-center animate-in fade-in zoom-in-95 duration-300 relative">
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Trial Request Received
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              Welcome aboard, {formData.fullName.split(' ')[0]}!
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
              We have received your 14-day free trial request for{' '}
              <strong className="text-slate-900 dark:text-white">{formData.companyName}</strong>. Our onboarding team is preparing your dedicated workspace.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 text-left text-xs space-y-2.5 mb-6 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Work Email:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formData.workEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Team Size:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formData.teamSize}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Duration:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">14 Days (Full Pro Access)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Setup Fee:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹0 (Free Trial)</span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 rounded-xl text-left text-xs text-blue-900 dark:text-blue-200 mb-6 max-w-md mx-auto flex items-start gap-3">
              <span className="text-base">📬</span>
              <div>
                <p className="font-bold mb-0.5">Check your inbox shortly</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Your tenant URL and temporary login credentials will be dispatched to{' '}
                  <span className="font-semibold">{formData.workEmail}</span>.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full max-w-md mx-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 cursor-pointer flex items-center justify-center gap-2"
            >
              Done & Return to Site
            </button>
          </div>
        ) : (
          /* ─── CONTACT FORM VIEW ─── */
          <div>
            {/* Modal Top Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="HR Nexa Logo" className="h-6 w-auto object-contain" />
                  <span className="font-display font-extrabold text-slate-900 dark:text-white tracking-tight text-base">
                    HR <span className="text-blue-600">NEXA</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200/70 dark:border-blue-800/50 whitespace-nowrap shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    14-Day Free Trial
                  </span>
                  <button
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                Experience HR NEXA for Free
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Get full access to automated payroll, attendance, and compliance. No credit card required.
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Name & Work Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Priya Sharma"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={formData.workEmail}
                      onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                      placeholder="priya@company.com"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Company Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. Acme Technologies"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Team Size */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Team / Employee Count
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={formData.teamSize}
                    onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                    className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all cursor-pointer appearance-none"
                  >
                    {TEAM_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Modules of Interest */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Modules you want to explore:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MODULE_OPTIONS.map((mod) => {
                    const isSelected = formData.selectedModules.includes(mod)
                    return (
                      <button
                        type="button"
                        key={mod}
                        onClick={() => toggleModule(mod)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {mod}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Requirements Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Specific Requirements or Message <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <textarea
                    rows={2}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="e.g. We are switching from another HRMS and need migration assistance..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Setting Up Your Trial...</span>
                  </>
                ) : (
                  <>
                    <span>Submit &amp; Start 14-Day Free Trial</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              {/* Trust Badges */}
              <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  No Credit Card Required
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-blue-600" />
                  256-Bit SSL Encrypted
                </span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
