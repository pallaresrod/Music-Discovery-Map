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
  console.log('Re-initializing database schema fresh...');
  
  // Drop tables to re-initialize schema fresh as requested
  db.run(`DROP TABLE IF EXISTS favorites`);
  db.run(`DROP TABLE IF EXISTS graph_edges`);
  db.run(`DROP TABLE IF EXISTS graph_nodes`);
  db.run(`DROP TABLE IF EXISTS graphs`);
  db.run(`DROP TABLE IF EXISTS follows`);
  db.run(`DROP TABLE IF EXISTS artists`);
  db.run(`DROP TABLE IF EXISTS users`);

  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    about_me TEXT,
    favorite_genres TEXT, -- comma-separated or JSON
    favorite_artists TEXT, -- JSON
    favorite_songs TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Follows table
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER,
    followed_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users (id),
    FOREIGN KEY (followed_id) REFERENCES users (id)
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
    is_public INTEGER DEFAULT 1, -- 1 = public, 0 = private
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
    FOREIGN KEY (graph_id) REFERENCES graphs (id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists (id)
  )`);

  // Graph Edges
  db.run(`CREATE TABLE IF NOT EXISTS graph_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id INTEGER,
    source_id TEXT,
    target_id TEXT,
    FOREIGN KEY (graph_id) REFERENCES graphs (id) ON DELETE CASCADE
  )`);

  // Favorites
  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    artist_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (artist_id) REFERENCES artists (id)
  )`);
  
  console.log('Database schema re-initialized successfully.');
});

module.exports = db;
