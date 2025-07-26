const admin = require("firebase-admin")

const serviceAccount = require ("../serviceAccountKey.json")

if (!admin.apps.length)
{
    admin.initializeApp({                                           //initialises firebase sdk            
        credential:admin.credential.cert(serviceAccount)            //uses service account json file for auth
    })
}

module.exports=admin