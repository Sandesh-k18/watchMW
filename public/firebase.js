// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDpMZrupP9cwTb-JoStMtUNFoi1jLhfGNk",
  authDomain: "wchmultimedia.firebaseapp.com",
  projectId: "wchmultimedia",
  storageBucket: "wchmultimedia.firebasestorage.app",
  messagingSenderId: "537985084833",
  appId: "1:537985084833:web:c6d85810ec4345a9946fe0",
  measurementId: "G-28BWYHHFN7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);