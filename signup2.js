// signup2.js
import { auth } from "./firebase-login.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// ✅ Toast utility
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// ✅ Handle Signup
const signupForm = document.getElementById("signupForm2");
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Save display name
    userCredential.user.displayName = name;

    // Send verification email
    await sendEmailVerification(userCredential.user);
    showToast("Signup successful! Verification email sent.", "success");

    // Enable Resend Button
    document.getElementById("resendVerificationBtn").disabled = false;

  } catch (error) {
    showToast(error.message, "error");
  }
});

// ✅ Resend verification email
document.getElementById("resendVerificationBtn").addEventListener("click", async () => {
  if (auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser);
      showToast("Verification email resent.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }
});

// ✅ Google Signup
document.getElementById("googleSignupBtn").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    showToast("Google signup successful!", "success");
    window.location.href = "library.html"; // redirect to dashboard
  } catch (error) {
    showToast(error.message, "error");
  }
});

// ✅ Go to login
document.getElementById("goToLoginBtn").addEventListener("click", () => {
  window.location.href = "login.html";
});
