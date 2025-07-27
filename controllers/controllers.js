const axios= require ('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const redis = require("../config/redisClient");
const { v4: uuidv4 } = require('uuid');
const { placeSuggestions } = require('../utils/mappls');
const { refineSearchQuery } = require('../utils/gemini'); 
const { generateUnsplashPrompt } = require("../utils/gemini");
const { generateQuip } = require("../utils/gemini");
const { generateDateTimeline } = require('../utils/gemini');

//sign up controller
const createUser=async(req,res)=>{
    console.log('req.body:', req.body);
    const {uid,email,name} = req.body;

    if (!uid|| !email || !name)
    {
        return res.status(400).json({message:'Email and name of user are required.'})
    }

    let user = await prisma.user.findUnique({where:{uid}})

    if (!user)
    {
        user = await prisma.user.create({
            data:{uid,email,name},
        })
    }

    return res.status(200).json({message:'Success'})

}

//saving session data to redis
const saveFormData = async(req,res)=>{
    console.log("hit /saveFormData");
    const {uid,email}=req.user;
    const {mood,budget,location,status}=req.body;

    if (!mood || !budget || !location || !status ){
        return res.status(400).json({message:"All fields are required."});
    }

    const sessionId=uuidv4();

    try{
        await redis.setex(
            `session:${uid}:${sessionId}`,7200,JSON.stringify({mood,budget,location,status})
        );

        return res.status(200).json({message:"Form data saved to redis for current session",sessionId})
    }catch(err){
        return res.status(500).json({ message: "Failed to save form data." });
    }

}

//permanently storing data
const confirmAndStoreData = async (req, res) => {
  const { uid } = req.user;
  const { sessionId, selectedPlace } = req.body;

  if (!sessionId || !selectedPlace) {
    return res.status(400).json({ message: "Session ID and selected place are required." });
  }

  const requiredFields = ["id", "name", "address", "latitude", "longitude", "category"];
  const isValidPlace = requiredFields.every(key => selectedPlace.hasOwnProperty(key));
  if (!isValidPlace) {
    return res.status(400).json({ message: "Incomplete selectedPlace data." });
  }

  const redisKey = `session:${uid}:${sessionId}`;

  try {
    const sessionData = await redis.get(redisKey);
    if (!sessionData) {
      return res.status(404).json({ message: "Session data not found or expired." });
    }

    const { mood, budget, location } = JSON.parse(sessionData);

    // 1. Find user by uid
    const user = await prisma.user.findUnique({
      where: { uid },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 2. Upsert the place
    await prisma.place.upsert({
      where: { id: selectedPlace.id },
      update: {
        name: selectedPlace.name,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        category: selectedPlace.category,
      },
      create: {
        id: selectedPlace.id,
        name: selectedPlace.name,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        category: selectedPlace.category,
      },
    });

    // 3. Create the userPreference linked with user
    await prisma.userPreference.create({
      data: {
        id: uuidv4(),
        mood,
        budget,
        location,
        selectedPlace: selectedPlace.id,
        userId: user.id, // Connect using user.id
      },
    });

    // 4. Delete session from Redis
    await redis.del(redisKey);

    return res.status(201).json({ message: "User preference saved successfully." });

  } catch (err) {
    console.error("Confirm & save error:", err.message);
    return res.status(500).json({ message: "Something went wrong." });
  }
};


//get place recs logic
const promptLogic = async (req, res, next) => {
  try {
    const { uid } = req.user; // make sure it's set by verifyFirebaseToken
    const sessionId = req.body.sessionId;

    const redisKey = `session:${uid}:${sessionId}`;
    console.log("🔑 Redis key being fetched:", redisKey);

    const formDataRaw = await redis.get(redisKey);

    if (!formDataRaw) {
      return res.status(404).json({ message: 'Form data not found' });
    }

    const { mood, budget, occasion, locationType, latitude, longitude } = JSON.parse(formDataRaw);
    console.log("📝 Parsed form data:", { mood, budget, occasion, locationType, latitude, longitude });
    const queryText = await refineSearchQuery({ mood, budget, occasion, locationType });
     console.log("🔍 Refined search query:", queryText);

    // Fetch Mappls suggestions
    const suggestions = await placeSuggestions(queryText, latitude, longitude);
    console.log("📍 Suggestions from Mappls:", suggestions);

    const formatted = suggestions.map((place) => ({                     //formatting output so that only req fields reach frontend
      name: place.placeName,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    }));

    return res.status(200).json({ places: formatted });
  } catch (error) {
    next(error);
  }
};

//flower shop nearby 
const recommendFlowerShops = async (req, res) => {
  const { lat, lng } = req.body; 
  const mapplsKey = process.env.MAPPLS_API_KEY;

  try {
    const response = await axios.get(`https://atlas.mappls.com/places/geo?keywords=flower shop&refLocation=${lat},${lng}&key=${mapplsKey}`);
    
    const shops = response.data?.suggestedLocations || [];

    const topShops = shops.slice(0, 5).map(shop => ({
      name: shop.placeName,
      address: shop.placeAddress,
      lat: shop.latitude,
      lng: shop.longitude,
      distance: shop.distance,
    }));

    res.status(200).json({ results: topShops });
  } catch (err) {
    console.error('Error fetching flower shops:', err.message);
    res.status(500).json({ error: 'Failed to fetch flower shops.' });
  }
};

//chat logic (need to work on this more)
const chatLogic = async (req, res) => {
  const { uid } = req.user;
  const { isSatisfied, selectedPlace } = req.body;

  if (!selectedPlace) {
    return res.status(400).json({ message: "Selected place is required." });
  }

  try {
    // Get session data from Redis
    const sessionRaw = await redis.get(uid);
    if (!sessionRaw) return res.status(404).json({ message: "Session data not found." });

    const { mood, budget, occasion, locationType, latitude, longitude } = JSON.parse(sessionRaw);

    let chatMessage = '';
    let newSuggestions = [];

    // If user is NOT satisfied, return fresh Mappls suggestions
    if (isSatisfied === false) {
      const query = await refineSearchQuery({ mood, budget, occasion, locationType });

      const suggestions = await placeSuggestions(query + " more options", latitude, longitude);

      newSuggestions = suggestions.map((place) => ({
        name: place.placeName,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      }));

      chatMessage = `Got it! Here are a few more places that match your vibe. Let me know which one you prefer this time.`;
    } else {
      // If satisfied or first time, generate friendly response
      const prompt = `
      The user is planning a ${occasion} and is feeling "${mood}". They picked a place called "${selectedPlace.name}" at "${selectedPlace.address}".
      Generate a short and friendly 2-line message acknowledging this, and ask if they'd like more options or go with this one.
      `;

      chatMessage = await generateChatMessage(prompt);
    }

    return res.status(200).json({
      message: chatMessage,
      morePlaces: isSatisfied === false ? newSuggestions : null,
    });

  } catch (error) {
    console.error("Chat generation failed:", error.message);
    return res.status(500).json({ message: "Could not generate chat message." });
  }
};


// quip 
const quippyLineLogic = async (req, res) => {
  try {
    const uid = req.user.uid;
    const formDataRaw = await redis.get(uid);

    if (!formDataRaw) {
      return res.status(404).json({ message: "Form data not found" });
    }

    const { mood, occasion } = JSON.parse(formDataRaw);

    const line = await generateQuip({ mood, occasion });

    return res.status(200).json({ quip: line });
  } catch (err) {
    return res.status(500).json({ message: "Failed to generate line" });
  }
};

// review logic
const reviewLogic = async (req, res) => {
  const { uid, placeId, comment, rating } = req.body;

  if (!uid || !placeId || !comment) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const review = await prisma.review.create({
      data: {
        uid,
        placeId,
        comment,
        rating: rating || null,
      },
    });

    return res.status(200).json({ message: 'Review submitted', review });
  } catch (err) {
    console.error('Error submitting review:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

//llm suggests outfit from unsplash
const fallbackKeywords = [
  "white tshirt",
  "straight blue jeans",
  "blue jeans and t-shirt",
  "floral summer dress",
  "high waist jeans and crop top",
];

const isValidOutfitPhrase = (phrase) => {
  const bannedWords = ["stylish", "trendy", "outfit", "look", "elegant"];
  return (
    phrase.split(" ").length <= 6 &&
    !bannedWords.some((word) => phrase.toLowerCase().includes(word)) &&
    /dress|shirt|jacket|blazer|kurta|sari|sweater|coat|pants|jeans|jumpsuit|skirt|hoodie|t-shirt/.test(
      phrase.toLowerCase()
    )
  );
};

const outfitSuggester = async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const formDataRaw = await redis.get(uid);

    if (!formDataRaw) {
      return res.status(404).json({ message: "Form data not found" });
    }

    const { mood, occasion } = JSON.parse(formDataRaw);

    const geminiOutput = await generateUnsplashPrompt({ mood, occasion });
    let outfitPhrase = geminiOutput?.toLowerCase().trim();

    if (!isValidOutfitPhrase(outfitPhrase)) {
      outfitPhrase =fallbackKeywords[Math.floor(Math.random() * fallbackKeywords.length)];
    }

    const unsplashResponse = await axios.get("https://api.unsplash.com/search/photos", {
      params: {
        query: outfitPhrase,
        per_page: 4,
        orientation: "portrait",
      },
      headers: {
        Authorization: `Client-ID SEiMIGT7oP7Bvge3rxsbzYw-K8T_7ybFMDkrXZjDFeE`,
      },
    });

    const images = unsplashResponse.data.results.map((img) => ({
      url: img.urls.small,
      alt_description: img.alt_description || outfitPhrase,
      photographer: img.user.name,
      photographer_url: img.user.links.html,
    }));

    return res.status(200).json({
      searchQuery: outfitPhrase,
      images,
    });
  } catch (error) {
    next(error);
  }
};


//create tim
const createTimeline = async (req, res) => {
  try {
    const { uid } = req.user;
    const { selectedPlace, selectedOutfit } = req.body;

    if (!selectedPlace || !selectedOutfit) {
      return res.status(400).json({ message: "Place and outfit are required" });
    }

    const formDataRaw = await redis.get(uid);
    if (!formDataRaw) {
      return res.status(404).json({ message: "Form data not found" });
    }

    const { mood, budget, occasion } = JSON.parse(formDataRaw);

    const timeline = await generateDateTimeline({
      place: selectedPlace.name,
      outfit: selectedOutfit,
      mood,
      occasion,
      budget,
    });

    return res.status(200).json({ timeline });
  } catch (err) {
    return res.status(500).json({ message: "Failed to generate date timeline" });
  }
};

//personalise 

module.exports = {createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester,recommendFlowerShops,createTimeline};


