// signup2.js — FULL, robust, untrimmed
// Uses Firebase web SDK v12.2.1 imports (must match firebase-login.js version)

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Import auth & db instances from your firebase-login.js (must export them)
import { auth, db } from "./firebase-login.js";

/* -------------------------------------------------------------------
   DOM: Make sure your signup.html has elements with these IDs:
   - signupForm2, name, email, password
   - resendVerificationBtn, goToLoginBtn, googleSignupBtn, toastContainer
   If toastContainer or resend button missing, script creates fallbacks.
   ------------------------------------------------------------------- */
const signupForm = document.getElementById("signupForm2");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
let resendBtn = document.getElementById("resendVerificationBtn");
const goToLoginBtn = document.getElementById("goToLoginBtn");
const googleSignupBtn = document.getElementById("googleSignupBtn");
let toastContainer = document.getElementById("toastContainer");

// Create fallback toast container if missing
if (!toastContainer) {
  toastContainer = document.createElement("div");
  toastContainer.id = "toastContainer";
  toastContainer.style.position = "fixed";
  toastContainer.style.top = "18px";
  toastContainer.style.right = "18px";
  toastContainer.style.zIndex = "999999";
  document.body.appendChild(toastContainer);
}

// Create a fallback resend button if missing (keeps UI working)
if (!resendBtn) {
  resendBtn = document.createElement("button");
  resendBtn.id = "resendVerificationBtn";
  resendBtn.textContent = "Resend Verification";
  // basic inline style so it looks clickable
  resendBtn.style.display = "none";
  resendBtn.style.padding = "10px 14px";
  resendBtn.style.borderRadius = "8px";
  resendBtn.style.border = "none";
  resendBtn.style.background = "black";
  resendBtn.style.color = "white";
  resendBtn.style.marginTop = "10px";
  // Insert after the form if it exists, otherwise append to body
  if (signupForm && signupForm.parentNode) {
    signupForm.parentNode.insertBefore(resendBtn, signupForm.nextSibling);
  } else {
    document.body.appendChild(resendBtn);
  }
}

// Inline-visible toast utility (ensures visibility in white/black themes)
function showToast(message, success = true, opts = {}) {
  const el = document.createElement("div");
  el.className = `sg-toast ${success ? "success" : "error"}`;
  el.textContent = message;

  // Inline fallback styling to avoid being overridden by site CSS
  el.style.backgroundColor = success ? "#16a34a" : "#dc2626"; // green / red
  el.style.color = "#fff";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "8px";
  el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  el.style.fontWeight = "600";
  el.style.marginTop = "8px";
  el.style.maxWidth = "380px";
  el.style.zIndex = "100000";
  el.style.fontFamily = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

  (toastContainer || document.body).appendChild(el);

  const duration = opts.duration || 4500;
  setTimeout(() => {
    try { el.remove(); } catch (e) {}
  }, duration);
}

// Helper: disable/enable signup form inputs (to indicate instruction to check email)
function disableSignupFormInputs() {
  if (!signupForm) return;
  signupForm.querySelectorAll("input, button").forEach(el => {
    // keep Google & goToLogin clickable (they may be outside the form)
    if (el.id === "googleSignupBtn" || el.id === "goToLoginBtn") return;
    try { el.disabled = true; } catch(e) {}
  });
}
function enableSignupFormInputs() {
  if (!signupForm) return;
  signupForm.querySelectorAll("input, button").forEach(el => {
    try { el.disabled = false; } catch(e) {}
  });
}

// Helper: ensure Firestore user doc exists (merge to avoid overwriting)
async function ensureUserDoc(uid, payload) {
  try {
    await setDoc(doc(db, "users", uid), payload, { merge: true });
  } catch (err) {
    console.warn("Failed to write user doc:", err);
  }
}

/* -----------------------------
   Resend cooldown (30 seconds)
   ----------------------------- */
let cooldown = false;
let cooldownInterval = null;
function startResendCooldown(seconds = 30) {
  if (!resendBtn) return;
  cooldown = true;
  let t = seconds;
  resendBtn.disabled = true;
  resendBtn.style.display = "inline-block";
  resendBtn.textContent = `Resend in ${t}s`;
  resendBtn.style.background = "gray";
  clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(cooldownInterval);
      cooldown = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification";
      resendBtn.style.background = "black";
    } else {
      resendBtn.textContent = `Resend in ${t}s`;
    }
  }, 1000);
}

// Utility: polite delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/* ==========================
   CORE: Signup flow
   - never show "email already in use"
   - if registered & not verified -> resend verification
   - if registered & verified -> tell user to login
   - if registered & wrong password -> send password reset and inform
   - if new -> create, save user doc, send verification
   ========================== */
signupForm?.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  // read & sanitize inputs
  const name = (nameInput?.value || "").trim();
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  if (!email || !password) {
    showToast("Please enter email and password.", false);
    return;
  }

  try {
    // Step 1: check if email already has sign-in methods
    let methods = [];
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (fetchErr) {
      // network or other — inform user but continue attempt to create
      if (fetchErr?.code === "auth/network-request-failed") {
        showToast("Network error checking account. Try again.", false);
        return;
      }
      // else continue, because fetch sometimes fails in some environments
      console.warn("fetchSignInMethodsForEmail error:", fetchErr);
    }

    // If methods exist => email already present in Auth
    if (methods && methods.length > 0) {
      // If it supports password sign-in, try to sign in with given password
      if (methods.includes("password")) {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email, password);
          const user = signInCred.user;

          // If user exists and is unverified -> send verification again
          if (!user.emailVerified) {
            try {
              await sendEmailVerification(user);
              showToast("Account exists but not verified — verification email resent. Check inbox & spam.", true);
              // ensure user doc exists
              await ensureUserDoc(user.uid, { name: name || user.displayName || "User", email, role: "user" });
              // disable inputs & enable resend cooldown
              disableSignupFormInputs();
              startResendCooldown(30);
              // Start short polling to detect verification (we'll also auto-redirect in onAuthStateChanged)
              pollForVerification(user);
              return;
            } catch (verr) {
              showToast("Could not resend verification: " + (verr.message || verr), false);
              return;
            }
          } else {
            // Verified already - instruct to login
            showToast("This account is already verified. Please login.", false);
            return;
          }
        } catch (signErr) {
          // sign-in failed — likely wrong password
          if (signErr?.code === "auth/wrong-password") {
            // Instead of showing email-in-use, help them recover: send password reset
            try {
              await sendPasswordResetEmail(auth, email);
              showToast("Account exists. Wrong password — a password reset email has been sent. Use it to regain access & verify.", true);
              startResendCooldown(30);
              return;
            } catch (resetErr) {
              if (resetErr?.code === "auth/network-request-failed") {
                showToast("Network error while sending reset email. Try again later.", false);
                return;
              }
              // fallback message
              showToast("Account exists. Could not sign you in. Try 'Forgot password' from login page.", false);
              return;
            }
          } else if (signErr?.code === "auth/network-request-failed") {
            showToast("Network error while signing in. Try again.", false);
            return;
          } else {
            // other sign-in errors (2FA, disabled etc.)
            showToast(signErr.message || "Account exists — please login or reset password.", false);
            return;
          }
        }
      }

      // If account exists but password provider not present (for example google-only)
      if (methods.includes("google.com") && !methods.includes("password")) {
        showToast("An account for this email uses Google sign-in. Use 'Sign up with Google' (or log in with Google).", false);
        return;
      }

      // Generic fallback when some other provider exists
      try {
        await sendPasswordResetEmail(auth, email);
        showToast("Account exists. Sent password-reset email so you can regain access and verify.", true);
        startResendCooldown(30);
      } catch (fallbackErr) {
        if (fallbackErr?.code === "auth/network-request-failed") {
          showToast("Network error sending reset email. Try later.", false);
        } else {
          showToast("Account exists — please try to sign in or use password reset.", false);
        }
      }
      return;
    }

    // No methods -> fresh email. Create account.
    let newUserCredential;
    try {
      newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (createErr) {
      // network or other create failure
      if (createErr?.code === "auth/network-request-failed") {
        showToast("Network error - account not created. Try again.", false);
        return;
      }
      // If create fails but not due to 'already in use' (we handled that above), show message
      showToast("Could not create account: " + (createErr.message || createErr), false);
      return;
    }

    const newUser = newUserCredential.user;

    // Save user doc in Firestore
    try {
      await setDoc(doc(db, "users", newUser.uid), {
        name: name || "User",
        email: email,
        role: "user"
      }, { merge: true });
    } catch (fsErr) {
      console.warn("Could not write user doc:", fsErr);
      // not blocking — user is created and we continue
    }

    // Send verification email to new user
    try {
      await sendEmailVerification(newUser);
      showToast("Verification email sent. Please check your inbox & spam.", true);
      disableSignupFormInputs();
      startResendCooldown(30);
      pollForVerification(newUser);
      return;
    } catch (verr2) {
      if (verr2?.code === "auth/network-request-failed") {
        showToast("Network error sending verification email. Try again.", false);
        return;
      }
      showToast("Could not send verification: " + (verr2.message || verr2), false);
      return;
    }
  } catch (outerErr) {
    console.error("Unhandled signup flow error:", outerErr);
    showToast("Signup failed: " + (outerErr.message || outerErr), false);
  }
});

/* ----------------------
   Resend button click
   ---------------------- */
resendBtn?.addEventListener("click", async (ev) => {
  ev?.preventDefault();
  if (cooldown) return;

  let user = auth.currentUser;
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  try {
    if (!user) {
      // Attempt to sign in silently using provided credentials to get a user object
      if (email && password) {
        try {
          const signIn = await signInWithEmailAndPassword(auth, email, password);
          user = signIn.user;
        } catch (signErr) {
          // If wrong password, send password reset and tell the user
          if (signErr?.code === "auth/wrong-password") {
            try {
              await sendPasswordResetEmail(auth, email);
              showToast("Wrong password. Sent password reset email so you can login & verify.", true);
              startResendCooldown(30);
              return;
            } catch (resetErr) {
              showToast("Could not send reset email: " + (resetErr.message || resetErr), false);
              return;
            }
          } else {
            showToast("Cannot sign you in to resend. Please login first.", false);
            return;
          }
        }
      } else {
        showToast("Enter your email and password above to resend verification.", false);
        return;
      }
    }

    if (!user) {
      showToast("Unable to locate account for resending verification.", false);
      return;
    }

    if (user.emailVerified) {
      showToast("Email already verified. Please login.", true);
      return;
    }

    await sendEmailVerification(user);
    showToast("Verification email resent. Check inbox & spam.", true);
    startResendCooldown(30);
    // ensure user doc exists if possible
    try { await ensureUserDoc(user.uid, { email: user.email, name: user.displayName || "User", role: "user" }); } catch(e){}
  } catch (err) {
    console.error("Resend click error:", err);
    if (err?.code === "auth/network-request-failed") {
      showToast("Network error. Try again later.", false);
    } else {
      showToast("Could not resend verification: " + (err.message || err), false);
    }
  }
});

/* ----------------------
   Google signup
   ---------------------- */
googleSignupBtn?.addEventListener("click", async (ev) => {
  ev?.preventDefault();
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Ensure a users/uid doc exists
    try {
      await ensureUserDoc(user.uid, { name: user.displayName || "User", email: user.email || "", role: "user", verified: !!user.emailVerified });
    } catch (e) { console.warn("Could not write google user doc:", e); }

    showToast("Signed in with Google. Redirecting...", true);
    await delay(700);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Google signup error:", err);
    if (err?.code === "auth/network-request-failed") {
      showToast("Network error when signing with Google. Try again.", false);
    } else {
      showToast("Google sign-in failed: " + (err.message || err), false);
    }
  }
});

/* ----------------------
   Auto detect verification:
   - If user is signed in and verifies via email link, user.emailVerified becomes true once we reload user.
   - We'll poll current user.reload() up to a limit and then redirect to login when verified.
   ---------------------- */
let verificationPollHandle = null;
async function pollForVerification(user, intervalMs = 3000, maxAttempts = 40) {
  // stop previous poll if any
  if (verificationPollHandle) {
    clearInterval(verificationPollHandle);
    verificationPollHandle = null;
  }
  let attempts = 0;
  verificationPollHandle = setInterval(async () => {
    attempts++;
    try {
      // reload user to refresh emailVerified flag
      await user.reload();
      if (user.emailVerified) {
        clearInterval(verificationPollHandle);
        verificationPollHandle = null;
        showToast("Email verified! Redirecting to login...", true);
        // sign out so next flow is clean (optional)
        try { await auth.signOut(); } catch(e){}
        await delay(1200);
        window.location.href = "login.html";
      } else {
        // if exceeded attempts, stop polling silently
        if (attempts >= maxAttempts) {
          clearInterval(verificationPollHandle);
          verificationPollHandle = null;
          // allow user to manually click resend later
          showToast("Still not verified. If you clicked the link, try logging in; otherwise resend.", false);
        }
      }
    } catch (reloadErr) {
      console.warn("Error reloading user for verification poll:", reloadErr);
      // network issues or token issues — don't spam user with toasts, but stop if network error
      if (reloadErr?.code === "auth/network-request-failed") {
        showToast("Network issue while checking verification. Try again later.", false);
        clearInterval(verificationPollHandle);
        verificationPollHandle = null;
      }
    }
  }, intervalMs);
}

/* ----------------------
   onAuthStateChanged: keep UX responsive
   - if user signs in elsewhere or auto-signed in, and is verified -> redirect
   ---------------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // if already verified, guide to login/dashboard
    if (user.emailVerified) {
      // sign out and redirect to login (so they can login normally)
      showToast("Verified. Redirecting to login...", true);
      try { await auth.signOut(); } catch(e){}
      await delay(900);
      window.location.href = "login.html";
    } else {
      // user signed in but not verified: ensure UI shows resend button
      resendBtn.style.display = "inline-block";
    }
  } else {
    // not signed in — nothing to do
  }
});
