const express = require('express');
const router = express.Router();
const {createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester,recommendFlowerShops,createTimeline} = require('../controllers/controllers.js');
const verifyToken = require('../middleware/verifyFirebaseToken.js');

//integrated
router.post('/createUser', createUser); //route tested

//integrated
router.post('/confirmAndStoreData',verifyToken, confirmAndStoreData); //route tested

//integrated
router.post('/promptLogic',verifyToken, promptLogic); //route tested

//integrated
router.post('/flowerVendor',verifyToken,recommendFlowerShops); //route tested

//integrated
router.post('/chatLogic',verifyToken, chatLogic); //route tested but needs to be improved upon

//integrated
router.post('/quippyLineLogic',verifyToken, quippyLineLogic); //route tested

//integrated
router.post('/reviewLogic', verifyToken,reviewLogic);  //route tested

//integrated
router.post('/outfitSuggester',verifyToken, outfitSuggester); //route tested, improve output

//integrated
router.post('/generateTimeline',verifyToken,createTimeline); //route tested

module.exports = router;
