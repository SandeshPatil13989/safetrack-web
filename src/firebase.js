import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBFd0GfDL89yemaBPTxtDdLIP5mKjMsB98",
  authDomain: "safetrack-3742c.firebaseapp.com",
  databaseURL: "https://safetrack-3742c-default-rtdb.firebaseio.com",
  projectId: "safetrack-3742c",
  storageBucket: "safetrack-3742c.firebasestorage.app",
  messagingSenderId: "380285552019",
  appId: "1:380285552019:web:c9778804fe0c888bcdd466"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);