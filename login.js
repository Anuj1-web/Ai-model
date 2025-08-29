import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ Use the separate Firebase config only for login-related features
import { auth, db } from './firebase-login.js';

// ✅ DOM References
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const toastContainer = document.getElementById("toastContainer");

// ✅ Toast Utility
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ✅ Email/Password Login
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      showToast("✅ Logged in successfully!");
      checkUserRole(result.user.uid);
    } catch (error) {
      console.error("Login Error:", error);
      showToast("❌ " + error.message, "error");
    }
  });
}

// ✅ Forgot Password
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("📧 Enter your email for password reset:");
    if (!email) return;

    try {
      await sendPasswordResetEmail(auth, email);
      showToast("📬 Password reset email sent!");
    } catch (error) {
      console.error("Password Reset Error:", error);
      showToast("❌ " + error.message, "error");
    }
  });
}

// ✅ Google Sign-In
let googleBtn = document.getElementById("googleLoginBtn");
if (!googleBtn) {
  googleBtn = document.createElement("button");
  googleBtn.textContent = "Continue with Google";
  googleBtn.className = "btn hoverbox w-full mt-4";
  googleBtn.id = "googleLoginBtn";
  document.querySelector(".auth-form-box").appendChild(googleBtn);
}

googleBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // ✅ Save user to Firestore if not exists
    const userDoc = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDoc);
    if (!docSnap.exists()) {
      await setDoc(userDoc, {
        email: user.email,
        name: user.displayName || "User",
        role: "user"
      });
    }

    showToast("✅ Google login successful!");
    checkUserRole(user.uid);
  } catch (error) {
    console.error("Google Login Error:", error);
    showToast("❌ " + error.message, "error");
  }
});

// ✅ Role Check & Redirect
async function checkUserRole(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    const role = userDoc.data()?.role;

    if (role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error("Role check failed:", error);
    showToast("❌ Failed to verify user role", "error");
  }
}

// ✅ Optional Auto-Redirect If Already Logged In
onAuthStateChanged(auth, (user) => {
  if (user) {
    checkUserRole(user.uid);
  }
});
