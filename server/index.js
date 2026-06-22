const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./middleware/auth');
const spotify = require('./spotify');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'music_discovery_super_secret_key_123';

app.use(cors());
app.use(express.json());

// ==========================================
// 1. Authentication Routes
// ==========================================

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: 'Password encryption failed' });
    }

    db.run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username, email, hash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user record' });
        }

        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({
          token,
          user: { id: this.lastID, username, email }
        });
      }
    );
  });
});

app.post('/api/auth/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  db.get(
    `SELECT * FROM users WHERE username = ? OR email = ?`,
    [usernameOrEmail, usernameOrEmail],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database search error' });
      }
      if (!user) {
        return res.status(400).json({ error: 'Invalid username/email or password' });
      }

      bcrypt.compare(password, user.password_hash, (err, result) => {
        if (err || !result) {
          return res.status(400).json({ error: 'Invalid username/email or password' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            about_me: user.about_me,
            favorite_genres: user.favorite_genres,
            favorite_artists: user.favorite_artists,
            favorite_songs: user.favorite_songs
          }
        });
      });
    }
  );
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get(
    `SELECT id, username, email, about_me, favorite_genres, favorite_artists, favorite_songs FROM users WHERE id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database retrieval error' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user });
    }
  );
});

// ==========================================
// 2. Saved Map (Graph) Routes
// ==========================================

app.post('/api/graphs', authenticateToken, (req, res) => {
  const { name, nodes, edges, isPublic } = req.body;
  const userId = req.user.id;
  const isPub = isPublic === false ? 0 : 1;

  if (!name || !nodes) {
    return res.status(400).json({ error: 'Graph name and nodes are required' });
  }

  db.serialize(() => {
    db.run(
      `INSERT INTO graphs (user_id, name, is_public) VALUES (?, ?, ?)`,
      [userId, name, isPub],
      function (err) {
        if (err) {
          console.error('Failed to create graph:', err.message);
          return res.status(500).json({ error: 'Failed to save graph metadata' });
        }
        
        const graphId = this.lastID;
        let insertErr = null;

        // Insert artists first (to satisfy FKs)
        nodes.forEach(node => {
          db.run(
            `INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)`,
            [node.id, node.data?.label || 'Unknown Artist'],
            (err) => {
              if (err) insertErr = err;
            }
          );
        });

        // Insert nodes
        nodes.forEach(node => {
          db.run(
            `INSERT INTO graph_nodes (graph_id, artist_id, x, y) VALUES (?, ?, ?, ?)`,
            [graphId, node.id, node.position?.x || 0, node.position?.y || 0],
            (err) => {
              if (err) insertErr = err;
            }
          );
        });

        // Insert edges
        if (edges && edges.length > 0) {
          edges.forEach(edge => {
            db.run(
              `INSERT INTO graph_edges (graph_id, source_id, target_id) VALUES (?, ?, ?)`,
              [graphId, edge.source, edge.target],
              (err) => {
                if (err) insertErr = err;
              }
            );
          });
        }

        // Barrier query to verify completion
        db.run(`SELECT 1`, (err) => {
          if (insertErr || err) {
            console.error('Error saving graph details:', insertErr || err);
            return res.status(500).json({ error: 'Failed to save full graph structure' });
          }
          res.json({ success: true, message: 'Graph saved successfully', graphId });
        });
      }
    );
  });
});

app.get('/api/graphs', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM graphs WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user.id],
    (err, graphs) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to query saved graphs' });
      }
      res.json(graphs);
    }
  );
});

app.get('/api/graphs/liked', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT g.id, g.name, g.created_at, g.is_public, u.username as creator_name 
     FROM liked_graphs lg 
     JOIN graphs g ON lg.graph_id = g.id 
     JOIN users u ON g.user_id = u.id 
     WHERE lg.user_id = ? 
     ORDER BY lg.created_at DESC`,
    [userId],
    (err, graphs) => {
      if (err) return res.status(500).json({ error: 'Failed to query liked graphs' });
      res.json(graphs);
    }
  );
});

app.get('/api/graphs/:id', (req, res) => {
  const graphId = req.params.id;
  
  // Optional auth to verify ownership of private graphs
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let currentUser = null;
  if (token) {
    try {
      currentUser = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // Treat as guest if token is invalid
    }
  }

  db.get(`SELECT * FROM graphs WHERE id = ?`, [graphId], (err, graph) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to query graph metadata' });
    }
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }

    const isOwner = currentUser && currentUser.id === graph.user_id;
    if (graph.is_public === 0 && !isOwner) {
      return res.status(403).json({ error: 'Access denied. This graph is private.' });
    }

    db.all(
      `SELECT gn.artist_id as id, a.name as label, gn.x, gn.y FROM graph_nodes gn LEFT JOIN artists a ON gn.artist_id = a.id WHERE gn.graph_id = ?`,
      [graphId],
      (err, dbNodes) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to query graph nodes' });
        }

        db.all(
          `SELECT source_id as source, target_id as target FROM graph_edges WHERE graph_id = ?`,
          [graphId],
          (err, dbEdges) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to query graph edges' });
            }

            const nodes = dbNodes.map(n => ({
              id: n.id,
              data: { label: n.label || 'Unknown Artist' },
              position: { x: n.x, y: n.y },
              style: { background: '#282828', color: '#fff', borderRadius: '8px', padding: '10px', border: '1px solid #1db954' }
            }));

            const edges = dbEdges.map(e => ({
              id: `e-${e.source}-${e.target}`,
              source: e.source,
              target: e.target,
              animated: true,
              style: { stroke: '#1db954' }
            }));

            res.json({ graph, nodes, edges });
          }
        );
      }
    );
  });
});

app.put('/api/graphs/:id', authenticateToken, (req, res) => {
  const graphId = req.params.id;
  const { nodes, edges } = req.body;
  const userId = req.user.id;

  if (!nodes) {
    return res.status(400).json({ error: 'Nodes are required' });
  }

  db.get(`SELECT user_id FROM graphs WHERE id = ?`, [graphId], (err, graph) => {
    if (err) return res.status(500).json({ error: 'Database search error' });
    if (!graph) return res.status(404).json({ error: 'Graph not found' });
    if (graph.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this graph' });
    }

    db.serialize(() => {
      db.run(`DELETE FROM graph_nodes WHERE graph_id = ?`, [graphId]);
      db.run(`DELETE FROM graph_edges WHERE graph_id = ?`, [graphId]);

      let insertErr = null;

      // Insert artists first (to satisfy FKs)
      nodes.forEach(node => {
        db.run(
          `INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)`,
          [node.id, node.data?.label || 'Unknown Artist'],
          (err) => {
            if (err) insertErr = err;
          }
        );
      });

      // Insert nodes
      nodes.forEach(node => {
        db.run(
          `INSERT INTO graph_nodes (graph_id, artist_id, x, y) VALUES (?, ?, ?, ?)`,
          [graphId, node.id, node.position?.x || 0, node.position?.y || 0],
          (err) => {
            if (err) insertErr = err;
          }
        );
      });

      // Insert edges
      if (edges && edges.length > 0) {
        edges.forEach(edge => {
          db.run(
            `INSERT INTO graph_edges (graph_id, source_id, target_id) VALUES (?, ?, ?)`,
            [graphId, edge.source, edge.target],
            (err) => {
              if (err) insertErr = err;
            }
          );
        });
      }

      // Barrier query to check completion
      db.run(`SELECT 1`, (err) => {
        if (insertErr || err) {
          console.error('Failed to update graph details:', insertErr || err);
          return res.status(500).json({ error: 'Failed to update graph details' });
        }
        res.json({ success: true, message: 'Graph updated successfully' });
      });
    });
  });
});

app.put('/api/graphs/:id/privacy', authenticateToken, (req, res) => {
  const graphId = req.params.id;
  const { isPublic } = req.body;
  const isPub = isPublic === false ? 0 : 1;

  db.get(`SELECT user_id FROM graphs WHERE id = ?`, [graphId], (err, graph) => {
    if (err) return res.status(500).json({ error: 'Database search error' });
    if (!graph) return res.status(404).json({ error: 'Graph not found' });
    if (graph.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this graph' });
    }

    db.run(
      `UPDATE graphs SET is_public = ? WHERE id = ?`,
      [isPub, graphId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update graph privacy' });
        res.json({ success: true, message: `Graph visibility set to ${isPub ? 'public' : 'private'}` });
      }
    );
  });
});

app.delete('/api/graphs/:id', authenticateToken, (req, res) => {
  const graphId = req.params.id;

  db.get(`SELECT user_id FROM graphs WHERE id = ?`, [graphId], (err, graph) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!graph) return res.status(404).json({ error: 'Graph not found' });
    if (graph.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this graph' });
    }

    db.serialize(() => {
      db.run(`DELETE FROM graph_nodes WHERE graph_id = ?`, [graphId]);
      db.run(`DELETE FROM graph_edges WHERE graph_id = ?`, [graphId]);
      db.run(`DELETE FROM graphs WHERE id = ?`, [graphId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete graph record' });
        res.json({ success: true, message: 'Graph deleted successfully' });
      });
    });
  });
});

app.post('/api/graphs/:id/like', authenticateToken, (req, res) => {
  const graphId = req.params.id;
  const userId = req.user.id;

  db.get(`SELECT user_id, is_public FROM graphs WHERE id = ?`, [graphId], (err, graph) => {
    if (err) return res.status(500).json({ error: 'Database search error' });
    if (!graph) return res.status(404).json({ error: 'Graph not found' });
    if (graph.is_public === 0 && graph.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You cannot like a private map' });
    }

    db.run(
      `INSERT OR IGNORE INTO liked_graphs (user_id, graph_id) VALUES (?, ?)`,
      [userId, graphId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to like map' });
        res.json({ success: true, message: 'Map liked successfully' });
      }
    );
  });
});

app.delete('/api/graphs/:id/like', authenticateToken, (req, res) => {
  const graphId = req.params.id;
  const userId = req.user.id;

  db.run(
    `DELETE FROM liked_graphs WHERE user_id = ? AND graph_id = ?`,
    [userId, graphId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to unlike map' });
      res.json({ success: true, message: 'Map unliked successfully' });
    }
  );
});

// ==========================================
// 3. User Profile & Social Routes
// ==========================================

app.get('/api/users', (req, res) => {
  // Optional auth to verify if current user is already following listed users
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let currentUserId = null;
  if (token) {
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      currentUserId = verified.id;
    } catch (e) {
      // Treat as guest if token verification fails
    }
  }

  if (currentUserId) {
    db.all(
      `SELECT u.id, u.username, u.about_me, 
              (SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = u.id) as is_followed 
       FROM users u WHERE u.id != ? ORDER BY u.username ASC`,
      [currentUserId, currentUserId],
      (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to retrieve users' });
        res.json(users);
      }
    );
  } else {
    db.all(
      `SELECT id, username, about_me FROM users ORDER BY username ASC`,
      (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to retrieve users' });
        res.json(users);
      }
    );
  }
});

app.get('/api/users/:id/profile', (req, res) => {
  const profileId = req.params.id;
  
  // Optional auth to verify following status
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let currentUserId = null;
  if (token) {
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      currentUserId = verified.id;
    } catch (e) {
      // Ignore token if invalid
    }
  }

  db.get(
    `SELECT id, username, about_me, favorite_genres, favorite_artists, favorite_songs FROM users WHERE id = ?`,
    [profileId],
    (err, profileUser) => {
      if (err) return res.status(500).json({ error: 'Database query error' });
      if (!profileUser) return res.status(404).json({ error: 'User profile not found' });

      // Get followers count
      db.get(`SELECT COUNT(*) as count FROM follows WHERE followed_id = ?`, [profileId], (err, followers) => {
        if (err) return res.status(500).json({ error: 'Database followers count error' });

        // Get following count
        db.get(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ?`, [profileId], (err, following) => {
          if (err) return res.status(500).json({ error: 'Database following count error' });

          // Get public graphs of this user
          db.all(
            `SELECT g.id, g.name, g.created_at, g.is_public, 
                    (SELECT 1 FROM liked_graphs WHERE user_id = ? AND graph_id = g.id) as is_liked 
             FROM graphs g 
             WHERE g.user_id = ? AND g.is_public = 1 
             ORDER BY g.created_at DESC`,
            [currentUserId, profileId],
            (err, graphs) => {
              if (err) return res.status(500).json({ error: 'Database graphs error' });

              // Check if currently following
              let isFollowed = false;
              if (currentUserId && currentUserId !== parseInt(profileId)) {
                db.get(
                  `SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?`,
                  [currentUserId, profileId],
                  (err, followRecord) => {
                    isFollowed = followRecord ? true : false;
                    res.json({
                      user: profileUser,
                      followersCount: followers.count,
                      followingCount: following.count,
                      graphs,
                      isFollowed
                    });
                  }
                );
              } else {
                res.json({
                  user: profileUser,
                  followersCount: followers.count,
                  followingCount: following.count,
                  graphs,
                  isFollowed: false
                });
              }
            }
          );
        });
      });
    }
  );
});

app.put('/api/users/profile', authenticateToken, (req, res) => {
  const { aboutMe, favoriteGenres, favoriteArtists, favoriteSongs } = req.body;
  const userId = req.user.id;

  db.run(
    `UPDATE users SET about_me = ?, favorite_genres = ?, favorite_artists = ?, favorite_songs = ? WHERE id = ?`,
    [
      aboutMe,
      typeof favoriteGenres === 'object' ? JSON.stringify(favoriteGenres) : favoriteGenres,
      typeof favoriteArtists === 'object' ? JSON.stringify(favoriteArtists) : favoriteArtists,
      typeof favoriteSongs === 'object' ? JSON.stringify(favoriteSongs) : favoriteSongs,
      userId
    ],
    (err) => {
      if (err) {
        console.error('Failed to update profile:', err.message);
        return res.status(500).json({ error: 'Failed to update user profile' });
      }
      res.json({ success: true, message: 'Profile updated successfully' });
    }
  );
});

app.post('/api/users/:id/follow', authenticateToken, (req, res) => {
  const followerId = req.user.id;
  const followedId = req.params.id;

  if (parseInt(followerId) === parseInt(followedId)) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  db.run(
    `INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)`,
    [followerId, followedId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to follow user' });
      res.json({ success: true, message: 'Followed successfully' });
    }
  );
});

app.delete('/api/users/:id/follow', authenticateToken, (req, res) => {
  const followerId = req.user.id;
  const followedId = req.params.id;

  db.run(
    `DELETE FROM follows WHERE follower_id = ? AND followed_id = ?`,
    [followerId, followedId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to unfollow user' });
      res.json({ success: true, message: 'Unfollowed successfully' });
    }
  );
});

app.get('/api/users/:id/following', (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.about_me FROM follows f JOIN users u ON f.followed_id = u.id WHERE f.follower_id = ?`,
    [req.params.id],
    (err, users) => {
      if (err) return res.status(500).json({ error: 'Failed to query followed users' });
      res.json(users);
    }
  );
});

// ==========================================
// 4. Artist and Discovery Routes
// ==========================================

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Music Discovery Map API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
