const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let accessToken = '';
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) {
    return accessToken;
  }

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    method: 'post',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: 'grant_type=client_credentials'
  };

  try {
    const response = await axios(authOptions);
    accessToken = response.data.access_token;
    tokenExpiry = now + (response.data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    console.error('Error getting Spotify access token', error.response ? error.response.data : error.message);
    throw new Error('Failed to authenticate with Spotify');
  }
}

async function searchArtists(query) {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`https://api.spotify.com/v1/search`, {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { q: query, type: 'artist', limit: 10 }
    });
    return response.data.artists.items;
  } catch (error) {
    console.error('Error searching artists', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getArtistDetails(id) {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting artist details', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getSimilarArtists(id) {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`https://api.spotify.com/v1/artists/${id}/related-artists`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data.artists;
  } catch (error) {
    console.error('Error getting similar artists', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getArtistTopTracks(id) {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`https://api.spotify.com/v1/artists/${id}/top-tracks`, {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { market: 'US' }
    });
    return response.data.tracks;
  } catch (error) {
    console.error('Error getting artist top tracks', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  searchArtists,
  getArtistDetails,
  getSimilarArtists,
  getArtistTopTracks
};

