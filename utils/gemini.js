const axios = require('axios');
const apiKey = process.env.GEMINI_API_KEY;

// GENERAL GEMINI WRAPPER
const generateWithGemini = async (prompt, fallbackText) => {
  try {
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }], //req format for gemini
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: apiKey },
      }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallbackText;  //parsing to get response 
  } catch (error) {
    try {
      const res = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        {
          headers: { 'Content-Type': 'application/json' },
          params: { key: apiKey },
        }
      );
      return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallbackText;
    } catch (fallbackError) {
      console.error('Fallback Gemini API error:', fallbackError.message);
      return fallbackText;
    }
  }
};

// 1. MAPPLS LOCATION QUERY GENERATOR
const refineSearchQuery = async ({ mood, budget, occasion, locationType }) => {
  const prompt = 
`You're a GenZ-style city explorer assistant. Convert the following vibes into a short, 3–6 word search-friendly location query (no full sentences, just phrases) for Mappls.

Input:
- Mood: ${mood}
- Budget: ${budget}
- Occasion: ${occasion}
- Location Type: ${locationType}

Examples: 
"romantic rooftop dinner", "affordable art cafes", "sunset beach walk", "lux brunch spots"

Give just the phrase.`;
  return await generateWithGemini(prompt, 'cafe nearby');
};

// 2. UNSPLASH OUTFIT PROMPT
const generateUnsplashPrompt = async ({ mood, occasion }) => {
  const prompt = 
`You're helping a photo search engine find a date outfit matching the mood and occasion. Based on the inputs, return a 3–6 word image prompt for Unsplash.
Keep it GenZ, dreamy, or aesthetic.

Input:
- Mood: ${mood}
- Occasion: ${occasion}

Examples:
"sunset picnic vibes", "cozy aesthetic brunch", "moody rainy cafe", "sunny dance on the beach"

Respond with only the image prompt`;
  return await generateWithGemini(prompt, 'date outfit');
};

// 3. QUIRKY ONE-LINER GENERATOR
const generateQuip = async ({ mood, occasion }) => {
  const prompt = 
`You're a flirty GenZ assistant writing a one-liner for a date. Keep it short, playful, and cheeky. Based on the mood and occasion, come up with a human-sounding one-liner under 15 words.

Input:
- Mood: ${mood}
- Occasion: ${occasion}

Examples:
"I'm dressed for your attention, not the weather."
"Warning: I match your vibe too well."

Respond with only the line.`;

  return await generateWithGemini(prompt, "I'm not lost, not when i'm with you.");
};

// 4. BEST ITEM PICKER (from a list)
const pickBestItem = async ({ items, mood, budget, occasion, locationType }) => {
  const formattedItems = items.map((item, i) => `${i + 1}. ${item}`).join('\n');

  const prompt = 
`You're a Gen-Z AI assistant helping someone choose the best option for their perfect day.

Inputs:
- Mood: ${mood}
- Budget: ${budget}
- Occasion: ${occasion}
- Location Type: ${locationType}

Options:
${formattedItems}

Choose the one that fits best. Return only the number (1-${items.length}).`;

  
  const response = await generateWithGemini(prompt, '1'); 
  const index = parseInt(response, 10) - 1;

  return items[index] || items[0]; 
};

// 5. DATE TIMELINE CREATOR
const generateDateTimeline = async ({ place, outfit, mood, occasion, budget }) => {
  const prompt = 
`You're a Gen-Z style AI date planner.

Inputs:
- Mood: ${mood}
- Occasion: ${occasion}
- Budget: ${budget}
- Chosen place: ${place}
- Outfit suggestion: ${outfit}

Create a carousel-worthy timeline. Format:

1:00 PM – Arrive at [place name], take cute pics 💅  
2:30 PM – Share dessert and talk about [mood-related topic]  
...

Use 4–6 steps. Make it feel aesthetic and human.`;

  return await generateWithGemini(prompt, 'Timeline generation failed 😞');
};

module.exports = {
  refineSearchQuery,
  generateUnsplashPrompt,
  generateQuip,
  pickBestItem,
  generateDateTimeline,
};