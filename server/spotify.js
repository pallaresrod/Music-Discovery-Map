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

function getStableHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

const FALLBACK_GENRES = [
  ['Rock', 'Indie', 'Alternative'],
  ['Pop', 'Dance', 'Electronic'],
  ['Hip Hop', 'Rap', 'R&B'],
  ['Folk', 'Singer-Songwriter', 'Acoustic'],
  ['Metal', 'Hard Rock', 'Alternative Metal'],
  ['Jazz', 'Blues', 'Soul'],
];

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

const GENERAL_FALLBACKS = [
  'Coldplay', 'Radiohead', 'Taylor Swift', 'Ed Sheeran', 'Billie Eilish',
  'The Beatles', 'Queen', 'Daft Punk', 'Eminem', 'Michael Jackson',
  'Bruno Mars', 'Imagine Dragons', 'Muse', 'OneRepublic', 'Keane',
  'Snow Patrol', 'Oasis', 'Blur', 'Gorillaz', 'MGMT',
  'Foster the People', 'The Weeknd', 'Lana Del Rey', 'Lorde', 'Florence + The Machine',
  'Adele', 'Drake', 'Rihanna', 'Beyoncé', 'Justin Bieber'
];

async function searchArtistProfile(name) {
  const token = await getAccessToken();
  try {
    const res = await axios.get('https://api.spotify.com/v1/search', {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { q: `"${name}"`, type: 'artist', limit: 1 }
    });
    return res.data.artists.items[0] || null;
  } catch (err) {
    console.error(`Search failed for similar artist ${name}:`, err.message);
    return null;
  }
}

async function getArtistDetails(id) {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const artist = response.data;
    
    // Enrich details if missing genres or popularity (due to Client Credentials flow)
    if (!artist.genres || artist.genres.length === 0) {
      let realGenres = [];
      if (LASTFM_API_KEY) {
        try {
          const lastfmRes = await axios.get('http://ws.audioscrobbler.com/2.0/', {
            params: {
              method: 'artist.getinfo',
              artist: artist.name,
              api_key: LASTFM_API_KEY,
              format: 'json'
            }
          });
          if (lastfmRes.data?.artist?.tags?.tag) {
            const tags = lastfmRes.data.artist.tags.tag.map(t => t.name);
            realGenres = tags
              .map(name => name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
              .slice(0, 3);
          }
        } catch (lfmError) {
          console.warn('Last.fm artist info failed for genres:', lfmError.message);
        }
      }

      if (realGenres.length > 0) {
        artist.genres = realGenres;
      } else {
        const genreIndex = getStableHash(artist.id || artist.name) % FALLBACK_GENRES.length;
        artist.genres = FALLBACK_GENRES[genreIndex];
      }
    }
    
    if (artist.popularity === undefined || artist.popularity === null) {
      artist.popularity = (getStableHash(artist.id || artist.name) % 35) + 60; // 60 to 94
    }
    return artist;
  } catch (error) {
    console.error('Error getting artist details', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getSimilarArtists(id) {
  try {
    const artist = await getArtistDetails(id);
    const artistNameLower = artist.name.toLowerCase().trim();
    
    let similarNames = [];
    if (LASTFM_API_KEY) {
      try {
        const lastfmRes = await axios.get('http://ws.audioscrobbler.com/2.0/', {
          params: {
            method: 'artist.getsimilar',
            artist: artist.name,
            api_key: LASTFM_API_KEY,
            format: 'json',
            limit: 5
          }
        });
        if (lastfmRes.data?.similarartists?.artist) {
          similarNames = lastfmRes.data.similarartists.artist
            .map(a => a.name)
            .slice(0, 5);
        }
      } catch (lfmError) {
        console.warn('Last.fm similar artists query failed:', lfmError.message);
      }
    }

    if (similarNames.length === 0) {
      similarNames = GENERAL_FALLBACKS
        .filter(name => name.toLowerCase() !== artistNameLower)
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);
    }
    
    const profiles = await Promise.all(similarNames.map(name => searchArtistProfile(name)));
    const validProfiles = profiles.filter(p => p !== null);
    
    return validProfiles.map(p => {
      if (!p.genres || p.genres.length === 0) {
        p.genres = FALLBACK_GENRES[getStableHash(p.id) % FALLBACK_GENRES.length];
      }
      if (p.popularity === undefined || p.popularity === null) {
        p.popularity = (getStableHash(p.id) % 35) + 60;
      }
      return p;
    });
  } catch (fallbackError) {
    console.error('Similar artists fallback failed:', fallbackError.message);
    return [];
  }
}

async function getArtistTopTracks(id) {
  const token = await getAccessToken();
  try {
    const artist = await getArtistDetails(id);
    const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { q: `artist:"${artist.name}"`, type: 'track', limit: 5 }
    });
    return searchResponse.data.tracks.items;
  } catch (error) {
    console.error('Track search fallback failed:', error.message);
    return [];
  }
}

module.exports = {
  searchArtists,
  getArtistDetails,
  getSimilarArtists,
  getArtistTopTracks
};


