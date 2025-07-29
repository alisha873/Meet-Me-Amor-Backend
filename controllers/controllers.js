const axios= require ('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { v4: uuidv4 } = require('uuid');
const { getMapplsAccessToken, getNearbyPlaces } = require('../utils/mappls');
const {generateWithGemini, simplifyForMappls,pickBestItem,generateUnsplashPrompt,generateQuip,generateDateTimeline } = require('../utils/gemini'); 

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

//permanently storing data
const confirmAndStoreData = async (req, res) => {
  const { uid } = req.user;
  const { selectedPlace, mood, budget, location } = req.body;

  if (!selectedPlace || !mood || !budget || !location) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  const requiredFields = ["id", "name", "address", "latitude", "longitude", "category"];
  const isValidPlace = requiredFields.every(key => selectedPlace.hasOwnProperty(key));
  if (!isValidPlace) {
    return res.status(400).json({ message: "Incomplete selectedPlace data." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { uid },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

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

    await prisma.userPreference.create({
      data: {
        id: uuidv4(),
        mood,
        budget,
        location,
        selectedPlace: selectedPlace.id,
        userId: user.id,
      },
    });

    return res.status(201).json({ message: "User preference saved successfully." });

  } catch (err) {
    console.error("Confirm & save error:", err.message);
    return res.status(500).json({ message: "Something went wrong." });
  }
};

//reccs place
const promptLogic = async (req, res, next) => {
  try {
    const { mood, budget, occasion, locationType, latitude, longitude } = req.body;

    if (!mood || !budget || !occasion || !locationType || !latitude || !longitude) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 🧠 Fetch user's past preferences for personalization
    const pastPrefs = await prisma.userPreference.findMany({
      where: { user: { uid: req.user.uid } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const pastPlaces = pastPrefs.map(p => p.selectedPlace?.name).filter(Boolean).join(', ');
    const pastMoods = [...new Set(pastPrefs.map(p => p.mood))].join(', ');

    // 📦 Step 1: Convert input to keyword using Gemini (optionally use history here)
    const keyword = await simplifyForMappls({ mood, occasion, locationType });

    // 📍 Step 2: Query Mappls for places using that keyword
    const rawSuggestions = await getNearbyPlaces({ keyword, latitude, longitude });
    const places = rawSuggestions?.suggestedLocations || [];

    if (!places.length) {
      return res.status(404).json({ message: 'No nearby places found' });
    }

    // 🧠 Step 3: Use Gemini to rank & pick based on history + input
    const options = places.map(p => `${p.placeName}, ${p.address}`);

    const best = await pickBestItem({
      items: options,
      mood,
      budget,
      occasion,
      locationType,
      history: {
        pastPlaces,
        pastMoods,
      }
    });

    const final = places.find(p =>
      p.placeName.toLowerCase().includes(best.toLowerCase()) ||
      best.toLowerCase().includes(p.placeName.toLowerCase())
    ) || places[0]; // fallback

    const formatted = {
      name: final.placeName,
      address: final.placeAddress,
      latitude: final.latitude,
      longitude: final.longitude,
      category: final.category || keyword,
    };

    console.log("Gemini picked:", best);
    console.log("Final Match:", formatted.name);
    console.log("Final Match:", formatted.address);

    return res.status(200).json({ place: formatted });

  } catch (error) {
    console.error("Error in promptLogic:", error.message);
    next(error);
  }
};


//flower shop nearby 
const recommendFlowerShops = async (req, res) => {
  const { lat, lng } = req.body;

  try {
    const data = await getNearbyPlaces({
      keyword: 'flower shop',
      latitude: lat,
      longitude: lng,
    });

    const shops = data?.suggestedLocations?.slice(0, 2) || [];

    const topShops = shops.map(shop => ({
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

//chat logic
const chatLogic = async (req, res) => {
  const { uid } = req.user;
  const { isSatisfied, selectedPlace, mood, budget, occasion, locationType, latitude, longitude } = req.body;

  if (!selectedPlace || !mood || !budget || !occasion || !locationType || !latitude || !longitude) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    let chatMessage = '';
    let newSuggestions = [];

    // OPTIONAL: fetch user's past preferences to personalize response
    const pastPrefs = await prisma.userPreference.findMany({
      where: { user: { uid } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { place: true },
    });

    const recentLocations = pastPrefs.map(p => p.place?.name).filter(Boolean).join(', ');
    const usedMoods = [...new Set(pastPrefs.map(p => p.mood))].join(', ');

    if (isSatisfied === false) {
      const query = await refineSearchQuery({ mood, budget, occasion, locationType });

      const suggestions = await placeSuggestions(query + " more options", latitude, longitude);

      newSuggestions = suggestions.map((place) => ({
        name: place.placeName,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      }));

      chatMessage = `Got it! Here are a few more places that match your vibe. Let me know which one you like.`;
    } else {
      const prompt = `
        The user is planning a ${occasion} and is feeling "${mood}". 
        They picked a place called "${selectedPlace.name}" at "${selectedPlace.address}".
        ${recentLocations ? `They’ve previously liked places like ${recentLocations}.` : ""}
        ${usedMoods ? `Their mood trends have included: ${usedMoods}.` : ""}
        Generate a short and friendly 2-line message acknowledging this and asking if they want more options or want to go with it.
      `;

      chatMessage = await generateWithGemini(prompt);
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
    const { mood, occasion } = req.body;

    if (!mood || !occasion) {
      return res.status(400).json({ message: "Mood and occasion are required." });
    }

    const line = await generateQuip({ mood, occasion });

    return res.status(200).json({ quip: line });
  } catch (err) {
    console.error("Error generating quip:", err.message);
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
    const user = await prisma.user.findUnique({
      where: { uid },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,  
        placeId,          
        comment
      },
    });

    return res.status(200).json({ message: 'Review submitted', review });
  } catch (err) {
    console.error('Error submitting review:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


// llm suggests outfit from unsplash
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
    const { mood, occasion } = req.body;

    if (!mood || !occasion) {
      return res.status(400).json({ message: "Mood and occasion are required." });
    }

    const geminiOutput = await generateUnsplashPrompt({ mood, occasion });
    let outfitPhrase = geminiOutput?.toLowerCase().trim();

    if (!isValidOutfitPhrase(outfitPhrase)) {
      outfitPhrase = fallbackKeywords[Math.floor(Math.random() * fallbackKeywords.length)];
    }

    const unsplashResponse = await axios.get("https://api.unsplash.com/search/photos", {
      params: {
        query: outfitPhrase,
        per_page: 4,
        orientation: "portrait",
      },
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
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

//create timeline for the date
const createTimeline = async (req, res) => {
  try {
    const { uid } = req.user;
    const { selectedPlace, selectedOutfit, mood, budget, occasion } = req.body;

    if (!selectedPlace || !selectedOutfit || !mood || !budget || !occasion) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const timeline = await generateDateTimeline({
      place: selectedPlace.name,
      outfit: selectedOutfit,
      mood,
      occasion,
      budget,
    });

    return res.status(200).json({ timeline });
  } catch (err) {
    console.error("Timeline generation error:", err);
    return res.status(500).json({ message: "Failed to generate date timeline" });
  }
};


module.exports = {createUser,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester,recommendFlowerShops,createTimeline};


