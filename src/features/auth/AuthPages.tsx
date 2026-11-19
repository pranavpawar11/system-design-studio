import { useEffect, useState, type FormEvent, type HTMLInputTypeAttribute } from 'react';
import { ArrowLeft, ArrowRight, Layers, ShieldCheck, UserRound, LockKeyhole } from 'lucide-react';
import { links } from '../../app/route';
import { useAuthStore } from './authStore';
import './auth.css';
import AdminConsole from '../admin/AdminConsole';

function BrandLink() {
  return <a className="auth-brand" href={links.home}><Layers size={21}/><span>HLD Studio</span></a>;
}

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }: {
  label: string; type?: HTMLInputTypeAttribute; value: string; onChange: (value: string) => void; placeholder: string; autoComplete?: string;
}) {
  return <label className="auth-field"><span>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required /></label>;
}

export function AdminLoginPage() {
  const login = useAuthStore((s) => s.adminLogin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const restoreAdmin = useAuthStore((s) => s.restoreAdmin);

  useEffect(() => {
    let active = true;
    void restoreAdmin().then((ok) => { if (active && ok) window.location.hash = links.adminDashboard; });
    return () => { active = false; };
  }, [restoreAdmin]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login(email, password); window.location.hash = links.adminDashboard; }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return <main className="auth-page">
    <div className="auth-top"><BrandLink/><a href={links.home}><ArrowLeft size={15}/> Back to website</a></div>
    <section className="auth-card admin-auth-card">
      <div className="auth-mark"><ShieldCheck size={24}/></div>
      <div className="auth-eyebrow">PLATFORM OPERATIONS</div>
      <h1>Admin sign in</h1>
      <p className="auth-description">Sign in with your assigned platform account. Your role determines the tools available to you.</p>
      <form onSubmit={submit}>
        <Field label="Work email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" autoComplete="username"/>
        <Field label="Password" value={password} onChange={setPassword} placeholder="Enter your password" type="password" autoComplete="current-password"/>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to admin'} <ArrowRight size={16}/></button>
      </form>
      <div className="auth-note">SUPER ADMIN · ADMIN · EDITOR · REVIEWER</div>
    </section>
    <footer className="auth-footer">HLD Studio · Secure administration</footer>
  </main>;
}

export function AdminDashboardPage() {
  const { adminStatus, restoreAdmin } = useAuthStore();
  useEffect(() => {
    let active = true;
    void restoreAdmin().then((ok) => { if (active && !ok) window.location.hash = links.adminLogin; });
    return () => { active = false; };
  }, [restoreAdmin]);
  if (adminStatus !== 'authenticated') return <main className="auth-loading">Checking your admin session…</main>;
  return <AdminConsole />;
}

export function LearnerAuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const login = useAuthStore((s) => s.learnerLogin);
  const register = useAuthStore((s) => s.learnerRegister);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (isSignup && password !== confirm) { setError('Passwords do not match.'); return; }
    if (isSignup && password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    setBusy(true);
    try {
      if (isSignup) await register(name, email, password);
      else await login(email, password);
      window.location.hash = links.learn;
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return <main className="auth-page learner-auth-page">
    <div className="auth-top"><BrandLink/><a href={links.home}><ArrowLeft size={15}/> Back to website</a></div>
    <section className="auth-card">
      <div className="auth-mark"><UserRound size={23}/></div>
      <div className="auth-eyebrow">YOUR ENGINEERING WORKSPACE</div>
      <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="auth-description">{isSignup ? 'Create an account to build your learning journey.' : 'Sign in to continue learning system design.'}</p>
      <form onSubmit={submit}>
        {isSignup && <Field label="Full name" value={name} onChange={setName} placeholder="Your name" autoComplete="name"/>}
        <Field label="Email address" value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email"/>
        <Field label="Password" value={password} onChange={setPassword} placeholder={isSignup ? 'At least 10 characters' : 'Enter your password'} type="password" autoComplete={isSignup ? 'new-password' : 'current-password'}/>
        {isSignup && <Field label="Confirm password" value={confirm} onChange={setConfirm} placeholder="Enter password again" type="password" autoComplete="new-password"/>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} <ArrowRight size={16}/></button>
      </form>
      <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to HLD Studio?'} <a href={isSignup ? links.userLogin : links.userSignup}>{isSignup ? 'Sign in' : 'Create an account'}</a></p>
      <div className="auth-security"><LockKeyhole size={13}/> Passwords are securely hashed. Sessions use HTTP-only cookies.</div>
    </section>
    <footer className="auth-footer">Learn. Design. Think in systems.</footer>
  </main>;
}
