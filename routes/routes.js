const express = require('express');
const router = express.Router();
const {createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester,recommendFlowerShops,createTimeline} = require('../controllers/controllers.js');
const verifyToken = require('../middleware/verifyFirebaseToken.js');


router.post('/createUser', createUser); //route tested

router.post('/confirmAndStoreData',verifyToken, confirmAndStoreData); //route tested

router.post('/promptLogic',verifyToken, promptLogic); //route tested

router.post('/flowerVendor',verifyToken,recommendFlowerShops); //route tested

router.post('/chatLogic',verifyToken, chatLogic); //route tested but needs to be improved upon

router.post('/quippyLineLogic',verifyToken, quippyLineLogic); //route tested

router.post('/reviewLogic', verifyToken,reviewLogic);  //route tested

router.post('/outfitSuggester',verifyToken, outfitSuggester);

router.post('/generateTimeline',verifyToken,createTimeline); //route tested

module.exports = router;
