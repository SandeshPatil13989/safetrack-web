import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Please fill all fields");
      return;
    }
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
          <span style={styles.logoIcon}>📍</span>
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
            <div style={styles.errorBox}>
              ⚠️ {error}
            </div>
          )}

          <button
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>

          <p style={styles.switchText}>
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <span
              style={styles.switchLink}
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
            >
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
    width: "80px",
    height: "80px",
    backgroundColor: "#1A3C6E",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 0 30px rgba(46,134,193,0.4)",
  },
  logoIcon: {
    fontSize: "36px",
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