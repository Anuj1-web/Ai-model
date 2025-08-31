// firebase-login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAc5c2Xogx4p2U0vYvOXZXpK9t9Wuir830",
  authDomain: "sitegen-47707.firebaseapp.com",
  projectId: "sitegen-47707",
  storageBucket: "sitegen-47707.firebasestorage.app",
  messagingSenderId: "111877204452",
  appId: "1:111877204452:web:d63661a96da882c93afff1",
  measurementId: "G-92RELFWJW2"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Export so other scripts can use it
export { app, auth, analytics };
