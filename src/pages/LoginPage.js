import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const SafeTrackLogo = ({ size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#0D1F3C"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(46,204,113,0.15)" strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(46,204,113,0.25)" strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="22" fill="rgba(46,134,193,0.2)" stroke="#2E86C1" strokeWidth="1.5"/>
    <path d="M50 28 Q64 28 64 42 Q64 54 50 68 Q36 54 36 42 Q36 28 50 28 Z" fill="#2E86C1"/>
    <circle cx="50" cy="42" r="7" fill="white"/>
    <circle cx="50" cy="42" r="3" fill="#2E86C1"/>
    <circle cx="50" cy="70" r="3.5" fill="#2ECC71"/>
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please fill all fields"); return; }
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoBox}>
          <SafeTrackLogo size={80} />
        </div>
        <h1 style={styles.title}>SafeTrack</h1>
        <p style={styles.subtitle}>Real-Time Safety Dashboard</p>

        <div style={styles.form}>
          <h2 style={styles.formTitle}>
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <p style={styles.formSubtitle}>
            {isRegister ? "Monitor safely" : "Sign in to monitor"}
          </p>

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />

          {error && (
            <div style={styles.errorBox}>⚠️ {error}</div>
          )}

          <button
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>

          <p style={styles.switchText}>
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <span style={styles.switchLink} onClick={() => { setIsRegister(!isRegister); setError(""); }}>
              {isRegister ? "Sign In" : "Register"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0A1628",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
  },
  logoBox: {
    width: "90px",
    height: "90px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    filter: "drop-shadow(0 0 20px rgba(46,134,193,0.5))",
  },
  title: {
    color: "white",
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  subtitle: {
    color: "#2E86C1",
    fontSize: "14px",
    marginBottom: "40px",
  },
  form: {
    backgroundColor: "#1A2744",
    borderRadius: "16px",
    padding: "32px",
    textAlign: "left",
  },
  formTitle: {
    color: "white",
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  formSubtitle: {
    color: "#888",
    fontSize: "13px",
    marginBottom: "24px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    backgroundColor: "#0D1F3C",
    border: "1px solid rgba(46,134,193,0.3)",
    borderRadius: "10px",
    color: "white",
    fontSize: "14px",
    marginBottom: "12px",
    outline: "none",
    boxSizing: "border-box",
  },
  errorBox: {
    backgroundColor: "rgba(231,76,60,0.1)",
    border: "1px solid rgba(231,76,60,0.3)",
    borderRadius: "8px",
    padding: "12px",
    color: "#E74C3C",
    fontSize: "13px",
    marginBottom: "12px",
  },
  button: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#2E86C1",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "16px",
  },
  switchText: {
    color: "#888",
    fontSize: "13px",
    textAlign: "center",
  },
  switchLink: {
    color: "#2E86C1",
    fontWeight: "bold",
    cursor: "pointer",
  },
};