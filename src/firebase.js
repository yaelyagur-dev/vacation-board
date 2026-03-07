import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC6ggURtoOLjFDEEtkLaB8IZEWXy3-TD8Y",
  authDomain: "vacation-board-2baf5.firebaseapp.com",
  projectId: "vacation-board-2baf5",
  storageBucket: "vacation-board-2baf5.firebasestorage.app",
  messagingSenderId: "563667292749",
  appId: "1:563667292749:web:c0824faed0f27406184204"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
