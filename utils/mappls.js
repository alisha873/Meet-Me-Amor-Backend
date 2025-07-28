const axios = require('axios');

// STEP 1: Get access token using OAuth
const getMapplsAccessToken = async () => {
  const clientId = process.env.MAPPLS_CLIENT_ID;
  const clientSecret = process.env.MAPPLS_CLIENT_SECRET;

  const response = await axios.post('https://outpost.mappls.com/api/security/oauth/token', null, {
    params: {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data.access_token;
};

// STEP 2: Get nearby places using keywords and refLocation

const getNearbyPlaces = async ({keyword, latitude, longitude,  }) => {
  try {
    const accessToken = await getMapplsAccessToken();
    console.log("🧪 Access Token:", accessToken);
    console.log("📍 Params:", {
      keywords: keyword,
      refLocation: `${latitude},${longitude}`,
    });

    const response = await axios.get('https://atlas.mappls.com/api/places/nearby/json', {
      params: {
        keywords: keyword,
        refLocation: `${latitude},${longitude}`,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("📦 Mappls API response:", response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Nearby Places API error:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error.message,
    });
    throw error;
  }
};

module.exports = {
  getMapplsAccessToken,
  getNearbyPlaces,
};
