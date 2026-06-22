const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const spotify = require('./spotify');

app.use(cors());
app.use(express.json());

// Artist routes
app.get('/api/artists/search', async (req, res) => {
  const { q } = req.query;
  try {
    const artists = await spotify.searchArtists(q);
    res.json(artists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search artists' });
  }
});

app.get('/api/artists/:id', async (req, res) => {
  try {
    const artist = await spotify.getArtistDetails(req.params.id);
    res.json(artist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get artist details' });
  }
});

app.get('/api/artists/:id/similar', async (req, res) => {
  try {
    const artists = await spotify.getSimilarArtists(req.params.id);
    res.json(artists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get similar artists' });
  }
});

app.get('/api/artists/:id/top-tracks', async (req, res) => {
  try {
    const tracks = await spotify.getArtistTopTracks(req.params.id);
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get artist top tracks' });
  }
});

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Music Discovery Map API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
