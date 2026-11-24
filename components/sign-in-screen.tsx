"use client"

import Image from "next/image"
import { useEffect, useState, type FormEvent } from "react"
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from "lucide-react"

export default function SignInScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem("spatial-remembered-email")
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setBusy(true)
    if (remember) window.localStorage.setItem("spatial-remembered-email", email.trim())
    else window.localStorage.removeItem("spatial-remembered-email")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) {
        setMessage(result.error || "Unable to sign in. Check your details and try again.")
        setBusy(false)
        return
      }
      window.location.assign(result.redirectTo)
    } catch {
      setMessage("We couldn't connect to the sign-in service. Please try again.")
      setBusy(false)
    }
  }

  return (
    <main className="sp-login">
      <section className="sp-brand-panel" aria-labelledby="brand-heading">
        <div className="sp-brand-content">
          <div className="sp-brand-lockup">
            <Image
              src="/spatial-planning-login-logo.png"
              alt="City of Mutare Spatial Planning Department emblem"
              width={1504}
              height={1024}
              priority
            />
            <div className="sp-brand-name">
              <span>City of Mutare</span>
              <small>Spatial Planning Department</small>
            </div>
          </div>

          <div className="sp-brand-message">
            <p className="sp-eyebrow">PLAN · DEVELOP · REGULATE · SUSTAIN</p>
            <h1 id="brand-heading">Planning for a better Mutare</h1>
            <p className="sp-brand-description">
              A clearer view of the work shaping our city. Sign in to manage applications
              and support thoughtful, sustainable development.
            </p>
          </div>

          <p className="sp-brand-footer">Planning today for a better tomorrow</p>
        </div>
      </section>

      <section className="sp-form-panel" aria-labelledby="signin-heading">
        <div className="sp-form-wrap">
          <p className="sp-form-eyebrow">STAFF PORTAL</p>
          <h2 id="signin-heading">Welcome back</h2>
          <p className="sp-form-intro">Sign in to continue to the Spatial Planning System.</p>

          <form className="sp-form" onSubmit={handleSubmit}>
            <label className="sp-label" htmlFor="staff-email">Email address</label>
            <div className="sp-input-wrap">
              <Mail className="sp-input-icon" size={18} aria-hidden="true" />
              <input
                className="sp-input"
                id="staff-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@mutarecity.co.zw"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setMessage("") }}
                required
              />
            </div>

            <div className="sp-password-label">
              <label className="sp-label" htmlFor="staff-password">Password</label>
              <button
                className="sp-forgot"
                type="button"
                onClick={() => setMessage("Please contact your Senior Officer or system administrator to reset your password.")}
              >
                Forgot password?
              </button>
            </div>
            <div className="sp-password-wrap">
              <LockKeyhole className="sp-input-icon" size={18} aria-hidden="true" />
              <input
                className="sp-input"
                id="staff-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setMessage("") }}
                required
              />
              <button
                className="sp-eye"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            <label className="sp-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>Remember my email</span>
            </label>

            <button className="sp-submit" type="submit" disabled={busy}>
              <LogIn size={19} aria-hidden="true" />
              <span>{busy ? "Signing in…" : "Sign in"}</span>
            </button>
            {message && <p className="sp-feedback" role="status">{message}</p>}
          </form>

          <p className="sp-security-note">Authorized City of Mutare personnel only</p>
        </div>
      </section>
    </main>
  )
}
