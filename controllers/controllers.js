const axios= require ('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const redis = ("../config/redis");
const { v4: uuidv4 } = require('uuid');

//sign up controller
const createUser=async(req,res)=>{
    const {email,name} = req.body;

    if (!email || !name)
    {
        return res.status(400).json({message:'Email and name of user are required.'})
    }

    let user = await prisma.user.findUnique({where:{email}})

    if (!user)
    {
        user = await prisma.user.create({
            data:{email,name},
        })
    }

    return res.status(200).json({message:'Success'})

}

//login controller
const login = async(req, res) => {
  const { uid, email, name } = req.user;
  try {
    res.status(200).json({ message: "User verified", uid, email, name });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
};

//saving session data to redis
const saveFormData = async(req,res)=>{
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

//need to work on this
const confirmAndStoreData = async (req, res) => {
  const { uid, email } = req.user;
  const { sessionId, selectedPlace } = req.body; 

  if (!sessionId || !selectedPlace) {
    return res.status(400).json({ message: "Session ID and selected place are required." });
  }

  const redisKey = `session:${uid}:${sessionId}`;

  try {
    const sessionData = await redis.get(redisKey);

    if (!sessionData) {
      return res.status(404).json({ message: "Session data not found or expired." });
    }

    const { mood, budget, location, status } = JSON.parse(sessionData);

    let place = await prisma.place.findUnique({ where: { id: selectedPlace.id } });

    if (!place) {
      place = await prisma.place.create({
        data: {
          id: selectedPlace.id, 
          name: selectedPlace.name,
          address: selectedPlace.address,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          category: selectedPlace.category,
        },
      });
    }

    await prisma.userPreference.create({
      data: {
        id:uuidv4(),
        uid,
        email,
        mood,
        budget,
        location,
        selectedPlace,
      },
    });

    await redis.del(redisKey);

    return res.status(201).json({ message: "User preference saved successfully." });

  } catch (err) {
    console.error("Confirm & save error:", err.message);
    return res.status(500).json({ message: "Something went wrong." });
  }
};


//prompt logic
const promptLogic = async(req,res)=>{

}

//chat logic
const chatLogic = async(req,res)=>{

}

// quip 
const quippyLineLogic = async(req,res)=>{

}

// review logic
const reviewLogic = async(req,res)=>{

}

//llm suggests outfit from unsplash
const outfitSuggester = async(req,res)=>{

}

module.exports = {login,createUser,saveFormData,confirmAndStoreData,promptLogic,chatLogic,quippyLineLogic,reviewLogic,outfitSuggester};


