import { useMemo, useState } from 'react'

const GRAY = {
  50: '#F1EFE8',
  100: '#D3D1C7',
  200: '#B4B2A9',
  400: '#888780',
  500: '#73726D',
  600: '#5F5E5A',
  700: '#4F4E49',
  800: '#444441',
  900: '#2C2C2A',
}

const FEATURES = [
  {
    icon: 'M9 12h6M9 16h6M7 8h10M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
    label: 'Instant summarization',
    description: 'Condense lengthy contracts into clear, actionable briefs in seconds.',
  },
  {
    icon: 'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z',
    label: 'Deep legal analysis',
    description: 'Surface risks, obligations, and key clauses automatically.',
  },
  {
    icon: 'M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    label: 'Contextual chat',
    description: 'Ask questions about any document and get cited, precise answers.',
  },
]

function FeatureItem({ icon, label, description }) {
  return (
    <div style={{ display: 'flex', gap: '14px', marginBottom: '28px' }}>
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.1)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icon} />
        </svg>
      </div>
      <div>
        <p
          style={{
            margin: '0 0 3px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

function InputField({ label, type = 'text', placeholder, value, onChange, icon, rightEl }) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 500,
          color: GRAY[600],
          marginBottom: '6px',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: focused ? `1.5px solid ${GRAY[800]}` : `1px solid ${GRAY[100]}`,
          borderRadius: '10px',
          background: focused ? '#fff' : GRAY[50],
          transition: 'all 0.15s ease',
          overflow: 'hidden',
        }}
      >
        {icon && (
          <span
            style={{
              padding: '0 0 0 12px',
              color: GRAY[400],
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            padding: '11px 12px',
            fontSize: '13.5px',
            color: GRAY[900],
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        {rightEl}
      </div>
    </div>
  )
}

function PrimaryButton({ children, onClick, loading, disabled }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '12px',
        background: disabled ? GRAY[200] : hovered ? GRAY[900] : GRAY[800],
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '13.5px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '0.02em',
        transition: 'background 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {loading ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ animation: 'ross-auth-spin 1s linear infinite' }}
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0110 10" />
        </svg>
      ) : (
        children
      )}
    </button>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
      <div style={{ flex: 1, height: '0.5px', background: GRAY[100] }} />
      <span
        style={{
          fontSize: '11px',
          color: GRAY[400],
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: '0.5px', background: GRAY[100] }} />
    </div>
  )
}

function PasswordInput({ label, placeholder, value, onChange }) {
  const [show, setShow] = useState(false)

  return (
    <InputField
      label={label}
      type={show ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      icon={
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
      }
      rightEl={
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 12px',
            color: GRAY[400],
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {show ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      }
    />
  )
}

function LeftPanel() {
  return (
    <div
      className="ross-auth-left-panel"
      style={{
        width: '340px',
        minWidth: '320px',
        background: GRAY[900],
        padding: '48px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: -80,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.02)',
          pointerEvents: 'none',
        }}
      />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          
          <span style={{ fontSize: '35px', fontWeight: 900, color: '#fff', letterSpacing: '0.04em' }}>
            ROSS
          </span>
        </div>

        <p style={{ fontSize: '22px', fontWeight: 500, color: '#fff', margin: '0 0 8px', lineHeight: 1.3 }}>
          Legal intelligence,
          <br />
          built for counsel.
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 40px', lineHeight: 1.7 }}>
          Upload any contract or legal document and let ROSS do the heavy lifting.
        </p>

        {FEATURES.map((feature) => (
          <FeatureItem
            key={feature.label}
            icon={feature.icon}
            label={feature.label}
            description={feature.description}
          />
        ))}
      </div>

      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0, lineHeight: 1.7 }}>
          Enhanced security coming soon | End-to-end encrypted | Attorney-client privilege protected
        </p>
      </div>
    </div>
  )
}

function ServiceStatusPill({ label, status }) {
  const palette =
    status === 'ready'
      ? {
          background: 'rgba(29, 158, 117, 0.12)',
          color: '#1D9E75',
          dot: '#1D9E75',
        }
      : status === 'skipped'
        ? {
            background: 'rgba(95, 94, 90, 0.08)',
            color: GRAY[500],
            dot: GRAY[400],
          }
        : {
            background: 'rgba(239, 159, 39, 0.12)',
            color: '#B26E12',
            dot: '#EF9F27',
          }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderRadius: '12px',
        background: '#fff',
        border: `1px solid ${GRAY[100]}`,
        padding: '12px 14px',
      }}
    >
      <span style={{ fontSize: '13px', color: GRAY[800], fontWeight: 500 }}>{label}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          borderRadius: '999px',
          background: palette.background,
          color: palette.color,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          padding: '6px 10px',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: palette.dot,
            display: 'inline-flex',
          }}
        />
        {status === 'ready' ? 'Ready' : status === 'skipped' ? 'Skipped' : 'Waking'}
      </span>
    </div>
  )
}

function WakePanel({ wakeScreen }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '48px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: '420px',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          background: GRAY[900],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '22px',
          boxShadow: '0 16px 28px rgba(44, 44, 42, 0.14)',
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          style={{ animation: 'ross-auth-spin 1s linear infinite' }}
        >
          <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
          <path d="M12 3a9 9 0 0 1 9 9" />
        </svg>
      </div>

      <p style={{ fontSize: '24px', fontWeight: 500, color: GRAY[900], margin: '0 0 8px' }}>
        Waking free-tier servers
      </p>
      <p style={{ fontSize: '13px', color: GRAY[500], margin: '0 0 28px', lineHeight: 1.75 }}>
        Ross is pinging the gateway and AI service before sign-in so the first authenticated action
        feels smoother on Render&apos;s free plan.
      </p>

      <div
        style={{
          borderRadius: '18px',
          background: GRAY[50],
          border: `1px solid ${GRAY[100]}`,
          padding: '18px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: GRAY[500], letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Estimated wake window
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: GRAY[900] }}>
            {wakeScreen.remaining}s
          </span>
        </div>

        <div
          style={{
            marginTop: '14px',
            height: '8px',
            width: '100%',
            borderRadius: '999px',
            overflow: 'hidden',
            background: '#E6E2D9',
          }}
        >
          <div
            style={{
              width: `${((45 - wakeScreen.remaining) / 45) * 100}%`,
              height: '100%',
              borderRadius: '999px',
              background: `linear-gradient(90deg, ${GRAY[700]}, ${GRAY[900]})`,
              transition: 'width 0.9s linear',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <ServiceStatusPill label="Gateway service" status={wakeScreen.gatewayStatus} />
        <ServiceStatusPill label="AI service" status={wakeScreen.aiStatus} />
      </div>

      <p style={{ margin: '18px 0 0', fontSize: '12px', color: GRAY[400], lineHeight: 1.7 }}>
        The login form will appear automatically once the warm-up completes or the countdown ends.
      </p>
    </div>
  )
}

function LoginForm({
  form,
  error,
  loading,
  restoringSession,
  onFieldChange,
  onSubmit,
  onSwitch,
}) {
  const [remember, setRemember] = useState(false)

  return (
    <div
      style={{
        flex: 1,
        padding: '48px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: '420px',
      }}
    >
      <p style={{ fontSize: '22px', fontWeight: 500, color: GRAY[900], margin: '0 0 6px' }}>
        Welcome back
      </p>
      <p style={{ fontSize: '13px', color: GRAY[400], margin: '0 0 32px' }}>
        Sign in to your ROSS workspace
      </p>

      <form onSubmit={onSubmit}>
        <InputField
          label="Work email"
          type="email"
          placeholder="you@lawfirm.com"
          value={form.email}
          onChange={(event) => onFieldChange('email', event.target.value)}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          }
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(event) => onFieldChange('password', event.target.value)}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              style={{ accentColor: GRAY[800], width: '14px', height: '14px' }}
            />
            <span style={{ fontSize: '12.5px', color: GRAY[600] }}>Remember me for 30 days</span>
          </label>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12.5px',
              color: GRAY[800],
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}
        {restoringSession && <p className="status-note">Restoring your session...</p>}

        <PrimaryButton loading={loading} disabled={loading || restoringSession}>
          {!loading && (
            <>
              Sign in
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </PrimaryButton>
      </form>

      <Divider label="or continue with" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
        {['Google', 'Microsoft'].map((provider) => (
          <button
            key={provider}
            type="button"
            style={{
              padding: '10px',
              background: '#fff',
              border: `1px solid ${GRAY[100]}`,
              borderRadius: '10px',
              fontSize: '13px',
              color: GRAY[700],
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {provider === 'Google' ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="8" height="8" />
                  <rect x="13" y="3" width="8" height="8" />
                  <rect x="3" y="13" width="8" height="8" />
                  <rect x="13" y="13" width="8" height="8" />
                </>
              )}
            </svg>
            {provider}
          </button>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: '13px', color: GRAY[400], margin: 0 }}>
        No account yet?{' '}
        <button
          type="button"
          onClick={onSwitch}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 500,
            color: GRAY[900],
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {'Create one ->'}
        </button>
      </p>
    </div>
  )
}

function RegisterForm({
  form,
  error,
  loading,
  onFieldChange,
  onSubmit,
  onSwitch,
}) {
  const [agree, setAgree] = useState(false)

  const passwordStrength = useMemo(() => {
    if (form.password.length === 0) {
      return 0
    }
    if (form.password.length < 6) {
      return 1
    }
    if (form.password.length < 10) {
      return 2
    }
    return 3
  }, [form.password])

  const strengthColors = ['transparent', '#E24B4A', '#EF9F27', '#1D9E75']
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong']

  return (
    <div
      style={{
        flex: 1,
        padding: '40px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: '420px',
      }}
    >
      <p style={{ fontSize: '22px', fontWeight: 500, color: GRAY[900], margin: '0 0 6px' }}>
        Create your account
      </p>
      <p style={{ fontSize: '13px', color: GRAY[400], margin: '0 0 28px' }}>
        Create an account to get started with your own legal assistant!
      </p>

      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <InputField
            label="First name"
            placeholder="Jane"
            value={form.firstName}
            onChange={(event) => onFieldChange('firstName', event.target.value)}
          />
          <InputField
            label="Last name"
            placeholder="Smith"
            value={form.lastName}
            onChange={(event) => onFieldChange('lastName', event.target.value)}
          />
        </div>

        <InputField
          label="Work email"
          type="email"
          placeholder="you@lawfirm.com"
          value={form.email}
          onChange={(event) => onFieldChange('email', event.target.value)}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          }
        />

        <InputField
          label="Firm or organisation"
          placeholder="Smith & Partners LLP"
          value={form.firm}
          onChange={(event) => onFieldChange('firm', event.target.value)}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
            </svg>
          }
        />

        <PasswordInput
          label="Password"
          placeholder="Min. 10 characters"
          value={form.password}
          onChange={(event) => onFieldChange('password', event.target.value)}
        />

        {form.password.length > 0 && (
          <div style={{ marginTop: '-10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    height: '3px',
                    borderRadius: '2px',
                    background:
                      index <= passwordStrength ? strengthColors[passwordStrength] : GRAY[100],
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
            <p
              style={{
                fontSize: '11px',
                color: strengthColors[passwordStrength],
                margin: 0,
                fontWeight: 500,
              }}
            >
              {strengthLabels[passwordStrength]}
            </p>
          </div>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '24px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
            style={{ accentColor: GRAY[800], marginTop: '2px', flexShrink: 0 }}
          />
          <span style={{ fontSize: '12px', color: GRAY[500], lineHeight: 1.6 }}>
            I agree to the <span style={{ color: GRAY[800], fontWeight: 500 }}>Terms of Service</span>{' '}
            and <span style={{ color: GRAY[800], fontWeight: 500 }}>Privacy Policy</span>
          </span>
        </label>

        {error && <p className="error-banner">{error}</p>}

        <PrimaryButton loading={loading} disabled={loading || !agree}>
          {!loading && (
            <>
              Create account
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </PrimaryButton>
      </form>

      <p style={{ textAlign: 'center', fontSize: '13px', color: GRAY[400], margin: '20px 0 0' }}>
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitch}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 500,
            color: GRAY[900],
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {'Sign in ->'}
        </button>
      </p>
    </div>
  )
}

export default function RossAuth(props) {
  const {
    mode,
    form,
    error,
    loading,
    restoringSession,
    wakeScreen,
    onBackToLanding,
    onModeChange,
    onFieldChange,
    onSubmit,
  } = props

  return (
    <>
      <style>{`
        @keyframes ross-auth-spin { to { transform: rotate(360deg); } }
        .ross-auth-root * { box-sizing: border-box; }
        .ross-auth-root input::placeholder { color: #B4B2A9; }
        @media (max-width: 900px) {
          .ross-auth-shell {
            min-height: auto !important;
          }
          .ross-auth-card {
            flex-direction: column;
            max-width: 440px !important;
          }
          .ross-auth-left-panel {
            width: 100% !important;
            min-width: 0 !important;
            padding: 32px 28px !important;
          }
        }
      `}</style>

      <div
        className="ross-auth-root"
        style={{
          minHeight: '100vh',
          background: GRAY[50],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: 'relative',
        }}
      >
        {onBackToLanding ? (
          <button
            type="button"
            onClick={onBackToLanding}
            aria-label="Back to landing page"
            title="Back to landing page"
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              width: '42px',
              height: '42px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${GRAY[100]}`,
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.84)',
              color: GRAY[800],
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(44, 44, 42, 0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : null}

        <div
          className="ross-auth-shell"
          style={{
            display: 'flex',
            borderRadius: '18px',
            overflow: 'hidden',
            border: `1px solid ${GRAY[100]}`,
            background: '#fff',
            width: '100%',
            maxWidth: '780px',
            minHeight: '580px',
            boxShadow: '0 24px 60px rgba(44, 44, 42, 0.08)',
          }}
        >
          <div className="ross-auth-card" style={{ display: 'flex', width: '100%' }}>
            <LeftPanel />

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflowY: 'auto' }}>
              {wakeScreen?.visible ? (
                <WakePanel wakeScreen={wakeScreen} />
              ) : mode === 'login' ? (
                <LoginForm
                  form={form}
                  error={error}
                  loading={loading}
                  restoringSession={restoringSession}
                  onFieldChange={onFieldChange}
                  onSubmit={onSubmit}
                  onSwitch={() => onModeChange('register')}
                />
              ) : (
                <RegisterForm
                  form={form}
                  error={error}
                  loading={loading}
                  onFieldChange={onFieldChange}
                  onSubmit={onSubmit}
                  onSwitch={() => onModeChange('login')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
