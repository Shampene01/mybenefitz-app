/**
 * One-time script to set the 'admin' custom claim on a Firebase Auth user.
 *
 * Usage:
 *   node scripts/set-admin.js <email>
 *
 * Prerequisites:
 *   1. npm install firebase-admin   (in this directory or project root)
 *   2. Download a service account key from Firebase Console:
 *      Project Settings → Service accounts → Generate new private key
 *   3. Set the path below OR use the GOOGLE_APPLICATION_CREDENTIALS env var:
 *      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 */

const admin = require('firebase-admin');

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
admin.initializeApp();

async function setAdmin(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    console.log(`✅ Successfully set admin role for ${email} (uid: ${user.uid})`);
    console.log('   The user must log out and log back in for the claim to take effect.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-admin.js <email>');
  process.exit(1);
}

setAdmin(email);
