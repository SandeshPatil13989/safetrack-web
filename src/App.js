import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#0A1628",
        color: "white",
        fontSize: "18px"
      }}>
        <div style={{ textAlign: "center" }}>
          <svg width="60" height="60" viewBox="0 0 100 100" style={{ marginBottom: "16px" }}>
            <circle cx="50" cy="50" r="48" fill="#0D1F3C"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(46,204,113,0.15)" strokeWidth="1.5"/>
            <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(46,204,113,0.25)" strokeWidth="1.5"/>
            <circle cx="50" cy="50" r="22" fill="rgba(46,134,193,0.2)" stroke="#2E86C1" strokeWidth="1.5"/>
            <path d="M50 28 Q64 28 64 42 Q64 54 50 68 Q36 54 36 42 Q36 28 50 28 Z" fill="#2E86C1"/>
            <circle cx="50" cy="42" r="7" fill="white"/>
            <circle cx="50" cy="42" r="3" fill="#2E86C1"/>
            <circle cx="50" cy="70" r="3.5" fill="#2ECC71"/>
          </svg>
          <div style={{
            width: "50px",
            height: "50px",
            border: "3px solid #2E86C1",
            borderTop: "3px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px"
          }}/>
          Loading SafeTrack...
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
}

export default App;