const express = require('express');
const router = express.Router();
const {login,createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester} = require('../controllers/controllers.js');
const verifyToken = require('./middleware/verifyFirebaseToken');

router.post('/login', login);

router.post('/createUser', createUser);

router.post('/saveFormData', saveFormData);

router.post('/confirmAndStoreData', confirmAndStoreData);

router.post('/promptLogic',verifyToken, promptLogic);

router.post('/chatLogic',verifyToken, chatLogic);

router.post('/quippyLineLogic',verifyToken, quippyLineLogic);

router.post('/reviewLogic', verifyToken,reviewLogic);

router.post('/outfitSuggester',verifyToken, outfitSuggester);

module.exports = router;
