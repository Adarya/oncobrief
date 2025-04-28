// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
// IMPORTANT: Replace these values with your actual Firebase project details
// You can find these values in your Firebase console -> Project settings
const firebaseConfig = {
  // For testing purposes, you can use this temporary configuration
  // But for production, please replace with your own Firebase project details
  apiKey: "AIzaSyBm1eVd4Y5HfC1PGZXWpjQQSf4CrFTbj6o",
  authDomain: "oncobrief-demo.firebaseapp.com",
  projectId: "oncobrief-demo",
  storageBucket: "oncobrief-demo.appspot.com",
  messagingSenderId: "367174296186",
  appId: "1:367174296186:web:e3b21e9ebd43c0c4e9fcf1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

export { app, db, auth, functions }; 