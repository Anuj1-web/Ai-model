// signup2.js — full-featured signup + resend verification flow
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase-login.js"; // must export auth and db

// ---- DOM
const signupForm2 = document.getElementById("signupForm2");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const resendBtn = document.getElementById("resendVerificationBtn");
const goToLoginBtn = document.getElementById("goToLoginBtn");
const googleSignupBtn = document.getElementById("googleSignupBtn");
const toastContainer = document.getElementById("toastContainer");

// ---- safety: ensure elements exist
if (!signupForm2) console.warn("signupForm2 not found in DOM.");
if (!toastContainer) {
  // create a fallback toast container if not present
  const t = document.createElement("div");
  t.id = "toastContainer";
  t.style.position = "fixed";
  t.style.top = "18px";
  t.style.right = "18px";
  t.style.zIndex = "9999";
  document.body.appendChild(t);
}

// ---- initial state for resend button
if (resendBtn) {
  resendBtn.style.display = "none";
  resendBtn.disabled = true;
}

// ---- toast (class + inline styles fallback so it's visible on white theme)
function showToast(message, success = true) {
  const el = document.createElement("div");
  el.className = `toast ${success ? "success" : "error"}`;
  el.textContent = message;

  // Inline fallback styles (ensures visibility regardless of page CSS)
  el.style.backgroundColor = success ? "#16a34a" : "#dc2626";
  el.style.color = "#fff";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "8px";
  el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  el.style.fontWeight = "600";
  el.style.marginTop = "8px";
  el.style.maxWidth = "320px";
  el.style.zIndex = "99999";

  (toastContainer || document.getElementById("toastContainer")).appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ---- resend cooldown
let cooldown = false;
let resendTimerHandle = null;
function startResendTimer() {
  if (!resendBtn) return;
  cooldown = true;
  let t = 30;
  resendBtn.disabled = true;
  resendBtn.style.display = "inline-block";
  resendBtn.textContent = `Resend in ${t}s`;

  resendTimerHandle = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(resendTimerHandle);
      cooldown = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification";
    } else {
      resendBtn.textContent = `Resend in ${t}s`;
    }
  }, 1000);
}

function showResendUI() {
  if (!resendBtn) return;
  resendBtn.style.display = "inline-block";
  startResendTimer();
}

function disableFormInputs() {
  if (!signupForm2) return;
  signupForm2.querySelectorAll("input, button").forEach((el) => {
    // keep goToLogin and googleSignup clickable
    if (el.id === "goToLoginBtn" || el.id === "googleSignupBtn") return;
    el.disabled = true;
  });
}

function enableFormInputs() {
  if (!signupForm2) return;
  signupForm2.querySelectorAll("input, button").forEach((el) => (el.disabled = false));
}

// ---- Signup submit handler
signupForm2?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = (nameInput?.value || "").trim();
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  if (!email || !password) {
    showToast("Please enter email and password.", false);
    return;
  }

  try {
    // Check whether email already has sign-in methods
    let methods = [];
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (fmErr) {
      // continue, but warn
      console.warn("fetchSignInMethodsForEmail failed:", fmErr);
    }

    if (methods && methods.length > 0) {
      // Email already exists in Auth
      // Try signing in with provided password (this matches your request)
      try {
        const signInResult = await signInWithEmailAndPassword(auth, email, password);
        const user = signInResult.user;
        if (user.emailVerified) {
          showToast("This email is already verified. Please login.", false);
          return;
        } else {
          // Unverified but correct password -> resend verification
          await sendEmailVerification(user);
          showToast("Email existed but not verified — verification link resent.", true);
          disableFormInputs();
          showResendUI();
          return;
        }
      } catch (signInErr) {
        // sign-in failed (likely wrong password) — tell user and suggest reset
        if (signInErr.code === "auth/wrong-password") {
          showToast("Email already registered. Wrong password — try password reset.", false);
        } else {
          showToast(signInErr.message || "Account exists — please login.", false);
        }
        return;
      }
    }

    // No methods -> new user: create account
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Save user in Firestore (document ID = uid)
    await setDoc(doc(db, "users", user.uid), {
      name: name || "User",
      email,
      role: "user"
    }, { merge: true });

    // Send verification email
    await sendEmailVerification(user);
    showToast(`Verification email sent to ${email}. Check inbox/spam.`, true);

    // disable inputs and show resend
    disableFormInputs();
    showResendUI();
  } catch (err) {
    console.error("Signup error:", err);
    // network or firebase errors
    if (err.code === "auth/network-request-failed") {
      showToast("Network error. Check your connection and try again.", false);
    } else {
      showToast(err.message || "Signup failed", false);
    }
  }
});

// ---- Resend click handler
resendBtn?.addEventListener("click", async () => {
  if (!resendBtn || cooldown) return;

  // Prefer currentUser if available
  let user = auth.currentUser;
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  try {
    if (!user) {
      // try to authenticate using provided credentials so we have a User object
      if (!email || !password) {
        showToast("Please re-enter your email and password to resend verification.", false);
        return;
      }
      try {
        const signInResult = await signInWithEmailAndPassword(auth, email, password);
        user = signInResult.user;
      } catch (signInErr) {
        showToast("Cannot sign in — wrong password or account missing. Use password reset.", false);
        return;
      }
    }

    // now send verification
    await sendEmailVerification(user);
    showToast("Verification email resent. Check your inbox.", true);
    startResendTimer();
  } catch (err) {
    console.error("Resend error:", err);
    if (err.code === "auth/too-many-requests") {
      showToast("Too many requests. Please wait a while before resending.", false);
      startResendTimer();
    } else {
      showToast(err.message || "Could not resend verification", false);
    }
  }
});

// ---- Google signup
googleSignupBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Save user doc (merge so existing fields not overwritten)
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName || "User",
      email: user.email || "",
      role: "user",
      verified: !!user.emailVerified
    }, { merge: true });

    showToast("Signed in with Google — redirecting...", true);
    // Redirect to index or dashboard as appropriate
    setTimeout(() => (window.location.href = "index.html"), 800);
  } catch (err) {
    console.error("Google signup error:", err);
    showToast(err.message || "Google signup failed", false);
  }
});

// ---- goToLogin button
goToLoginBtn?.addEventListener("click", () => {
  window.location.href = "login.html";
});
