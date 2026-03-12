import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Konfigurasi ini akan mengambil data rahasia dari file .env nantinya
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Mencegah Next.js melakukan inisialisasi Firebase berulang kali (agar tidak error)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Mengekspor fungsi database (Firestore) agar bisa dipanggil di halaman lain
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };