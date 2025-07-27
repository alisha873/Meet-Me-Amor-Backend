const express = require('express');
const router = express.Router();
const {createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester} = require('../controllers/controllers.js');
const verifyToken = require('../middleware/verifyFirebaseToken.js');


router.post('/createUser', createUser); //route tested 

router.post('/saveFormData',verifyToken, saveFormData); //route tested

router.post('/confirmAndStoreData',verifyToken, confirmAndStoreData); //route tested

router.post('/promptLogic',verifyToken, promptLogic);

router.post('/chatLogic',verifyToken, chatLogic);

router.post('/quippyLineLogic',verifyToken, quippyLineLogic);

router.post('/reviewLogic', verifyToken,reviewLogic);

router.post('/outfitSuggester',verifyToken, outfitSuggester);

module.exports = router;
