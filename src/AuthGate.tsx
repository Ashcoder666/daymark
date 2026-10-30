import { createContext, useContext, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { ArrowRight, CheckCircle2, Cloud, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { firebaseAuth, firebaseConfigured } from './firebase'
import './AuthGate.css'

type AuthContextValue = {
  user: User
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useDaymarkAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useDaymarkAuth must be used inside AuthGate')
  return context
}

function friendlyAuthError(code?: string) {
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.'
  if (code === 'auth/network-request-failed') return 'Daymark could not reach Firebase. Check your connection.'
  if (code === 'auth/user-disabled') return 'This account has been disabled in Firebase.'
  return 'The email or password is incorrect.'
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!firebaseAuth || !email.trim() || !password) return
    setBusy(true)
    setMessage('')
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence)
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined
      setIsError(true)
      setMessage(friendlyAuthError(code))
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!firebaseAuth || !email.trim()) {
      setIsError(true)
      setMessage('Enter your email first, then choose Reset password.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim())
      setIsError(false)
      setMessage('Password reset email sent. Check your inbox.')
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined
      setIsError(true)
      setMessage(friendlyAuthError(code))
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <div className="auth-glow auth-glow-one" />
    <div className="auth-glow auth-glow-two" />
    <section className="auth-story">
      <div className="auth-logo"><span className="auth-mark"><i /></span><div><strong>daymark</strong><small>MAKE TODAY COUNT</small></div></div>
      <div className="auth-story-copy"><span className="auth-kicker">YOUR PRIVATE DAILY SPACE</span><h1>Your day,<br/>wherever you are<span>.</span></h1><p>Sign in once to keep your plans, progress, and routines connected across Windows, phone, and tablet.</p><div className="auth-points"><span><ShieldCheck size={17}/>Private to your account</span><span><Cloud size={17}/>Ready for multi-device sync</span><span><CheckCircle2 size={17}/>Offline-friendly by design</span></div></div>
      <p className="auth-quote">“A little progress, every day.”</p>
    </section>
    <main className="auth-panel"><form className="auth-card" onSubmit={submit}>
      <span className="auth-lock"><LockKeyhole size={21}/></span>
      <span className="auth-kicker">WELCOME BACK</span>
      <h2>Sign in to Daymark<span>.</span></h2>
      <p>Use the private account you created in Firebase.</p>
      {!firebaseConfigured && <div className="auth-setup"><strong>Firebase setup needed</strong><span>Create the Firebase project, then add its Web App configuration to <code>.env.local</code>.</span></div>}
      <label className="auth-field"><span>Email</span><div><Mail size={16}/><input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" disabled={!firebaseConfigured||busy} required/></div></label>
      <label className="auth-field"><span>Password</span><div><LockKeyhole size={16}/><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Your password" disabled={!firebaseConfigured||busy} required/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} disabled={!firebaseConfigured}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
      {message && <div className={`auth-message ${isError?'error':'success'}`} role="status">{message}</div>}
      <button className="auth-submit" type="submit" disabled={!firebaseConfigured||busy}>{busy?'Signing in…':<>Sign in <ArrowRight size={16}/></>}</button>
      <button className="auth-reset" type="button" onClick={()=>void resetPassword()} disabled={!firebaseConfigured||busy}>Reset password</button>
      <div className="auth-divider"><span/>Private personal workspace<span/></div>
      <p className="auth-security">Daymark does not offer public registration. New accounts are created only from your Firebase Console.</p>
    </form></main>
  </div>
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(firebaseConfigured)

  useEffect(() => {
    if (!firebaseAuth) return
    return onAuthStateChanged(firebaseAuth, currentUser => {
      setUser(currentUser)
      setChecking(false)
    })
  }, [])

  if (checking) return <div className="auth-loading"><span className="auth-mark"><i /></span><p>Opening your workspace…</p></div>
  if (!user || !firebaseAuth) return <LoginScreen />
  const auth = firebaseAuth

  return <AuthContext.Provider value={{ user, signOut: () => signOut(auth) }}>{children}</AuthContext.Provider>
}
