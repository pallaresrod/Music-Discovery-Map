# MUSIC DISCOVERY MAP - PROJECT SUMMARY

## 1. PROJECT DESCRIPTION
A Music Discovery Map is an interactive web application that lets users explore music by visualizing relationships between artists in a dynamic graph. It is designed for music listeners who want to discover new artists based on their tastes through an intuitive and exploratory experience rather than traditional search or playlists.

## 2. TECHNOLOGIES

### Programming Languages:
- JavaScript / TypeScript
- SQL (SQLite)

### Frontend:
- React
- React Flow
- Axios
- Tailwind CSS

### Backend:
- Node.js
- Express
- SQLite
- dotenv
- cors

### External APIs:
- Spotify Web API
- Last.fm API

## 3. MAIN FEATURES

- Artist search
- Interactive music graph
- Artist detail panel
- Similar artist recommendations
- Graph expansion
- Save and load graphs
- Music discovery paths (optional)
- Hidden gems mode (optional)

## 4. DATABASE (SQLite)

### Tables:
- users
- artists (cached Spotify data)
- graphs
- graph_nodes
- graph_edges
- favorites

## 5. API ENDPOINTS

`GET    /api/artists/search?q=artist`

`GET    /api/artists/:id`

`GET    /api/artists/:id/similar`

`GET    /api/graph/expand`

`GET    /api/graph/path`

`POST   /api/users/:id/graphs`

## 6. TARGET USERS

Music listeners who enjoy discovering new artists and exploring relationships between genres, bands, and musicians in a visual and interactive way.
