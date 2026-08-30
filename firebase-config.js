/* ======================================================================
   Paste your own Firebase project config below (see README.md, Step 1).
   This is safe to be public — it's not a secret key, just an address
   for your database. Real access is controlled by your database Rules.
   ====================================================================== */

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
window.__marqueeConfigLoaded = true;
