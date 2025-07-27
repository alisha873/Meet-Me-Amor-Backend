const admin = require("firebase-admin");
const serviceAccount = require("../config/firebaseAdmin.json");
console.log("log: verifyFirebaseToken middleware loaded");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization?.split("Bearer ")[1]; //extracting the token passed from frontend
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token); //verifying the token passed 
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed:", err); // ⬅️ add this
    return res.status(403).json({ error: "Invalid token" });
  }
};

module.exports = verifyFirebaseToken;