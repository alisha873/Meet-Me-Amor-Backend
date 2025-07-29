const express = require('express');
const router = express.Router();
const {createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester,recommendFlowerShops,createTimeline} = require('../controllers/controllers.js');
const verifyToken = require('../middleware/verifyFirebaseToken.js');

//need to add personalisation set up 

router.post('/createUser', createUser); //route tested 

router.post('/confirmAndStoreData',verifyToken, confirmAndStoreData); //route tested

router.post('/promptLogic',verifyToken, promptLogic); //route tested, add google map output

router.post('/flowerVendor',verifyToken,recommendFlowerShops); //route tested, add google map output

router.post('/chatLogic',verifyToken, chatLogic);

router.post('/quippyLineLogic',verifyToken, quippyLineLogic); //route tested,add multiple lines output

router.post('/reviewLogic', verifyToken,reviewLogic);

router.post('/outfitSuggester',verifyToken, outfitSuggester);

router.post('/generateTimeline',verifyToken,createTimeline);

module.exports = router;
