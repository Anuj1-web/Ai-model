import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase-login.js";

// ---- DOM
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const toastContainer = document.getElementById("toastContainer");

// ---- Toast
function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  (toastContainer || document.body).appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ---- Add Google button if missing
let googleBtn = document.getElementById("googleLoginBtn");
if (!googleBtn) {
  const box = document.querySelector(".auth-form-box");
  if (box) {
    googleBtn = document.createElement("button");
    googleBtn.id = "googleLoginBtn";
    googleBtn.className = "btn w-full mt-4";
    googleBtn.textContent = "Continue with Google";
    box.appendChild(googleBtn);
  }
}

// ---- Email/Password Login
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (emailInput?.value || "").trim();
    const password = passwordInput?.value || "";

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      showToast("✅ Logged in successfully!");
      await applyAccessRules(result.user.uid);
    } catch (err) {
      console.error(err);
      showToast("❌ " + (err.message || "Login failed"), "error");
    }
  });
}

// ---- Forgot Password
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("📧 Enter your email for password reset:");
    if (!email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("📬 Password reset email sent!");
    } catch (err) {
      console.error(err);
      showToast("❌ " + (err.message || "Could not send reset email"), "error");
    }
  });
}

// ---- Google Sign-in
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Ensure user doc exists
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          email: user.email || "",
          name: user.displayName || "User",
          role: "user"
        });
      }

      showToast("✅ Google login successful!");
      await applyAccessRules(user.uid);
    } catch (err) {
      console.error(err);
      showToast("❌ " + (err.message || "Google login failed"), "error");
    }
  });
}

// ---- Access rules you requested
// If NOT logged in => block wizardmaker.html (redirect to login)
// If role == "user" => full site EXCEPT library.html
// If role == "admin" => unrestricted
async function applyAccessRules(uid) {
  const current = window.location.pathname.split("/").pop() || "index.html";
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    const role = userDoc.data()?.role || "user";

    if (role === "admin") {
      // Admin: let them go anywhere; if they are on login page after login, a useful redirect:
      if (["login.html", "signup.html", "index.html"].includes(current)) {
        window.location.href = "library.html";
      }
      return;
    }

    // role: user
    if (current === "library.html") {
      showToast("⚠️ You don't have access to Library.", "error");
      window.location.href = "index.html";
      return;
    }
    // otherwise allow everything (including wizardmaker.html since they are logged in)
  } catch (err) {
    console.error("Role check failed:", err);
    showToast("❌ Failed to verify user role", "error");
  }
}

// ---- Gate pages on load
onAuthStateChanged(auth, async (user) => {
  const current = window.location.pathname.split("/").pop() || "index.html";

  if (!user) {
    // Not logged in → block wizardmaker.html
    if (current === "wizardmaker.html") {
      showToast("⚠️ Please log in to use the wizard.", "error");
      window.location.href = "login.html";
    }
    return;
  }

  await applyAccessRules(user.uid);
});
