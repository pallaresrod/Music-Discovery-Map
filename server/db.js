const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'music_discovery.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Artists table (cached Spotify data)
  db.run(`CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT,
    genres TEXT,
    popularity INTEGER,
    image_url TEXT,
    spotify_url TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Graphs table
  db.run(`CREATE TABLE IF NOT EXISTS graphs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Graph Nodes
  db.run(`CREATE TABLE IF NOT EXISTS graph_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id INTEGER,
    artist_id TEXT,
    x REAL,
    y REAL,
    FOREIGN KEY (graph_id) REFERENCES graphs (id),
    FOREIGN KEY (artist_id) REFERENCES artists (id)
  )`);

  // Graph Edges
  db.run(`CREATE TABLE IF NOT EXISTS graph_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id INTEGER,
    source_id TEXT,
    target_id TEXT,
    FOREIGN KEY (graph_id) REFERENCES graphs (id)
  )`);

  // Favorites
  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    artist_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (artist_id) REFERENCES artists (id)
  )`);
});

module.exports = db;
