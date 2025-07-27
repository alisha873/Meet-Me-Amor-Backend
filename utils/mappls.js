const axios = require('axios');

const placeSuggestions = async (queryText, lat, lon) => {
  const apiKey = process.env.MAPPLS_API_KEY;

  const response = await axios.get('https://atlas.mappls.com/places/auto-complete', {
    params: {
      keywords: queryText,
      max: 5,
      refLocation: `${lat},${lon}`, 
    },
    headers: {
      Authorization: `bearer ${apiKey}`,
    },
  });

  return response.data.suggestedLocations || [];
};

module.exports = { placeSuggestions };
