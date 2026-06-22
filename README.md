# Music Discovery Map

An interactive web application that enables users to explore music visually by traversing relationships between artists on a dynamic node-edge graph. Users can search for starting artists, expand connection lines, listen to audio track previews, save customized maps, follow other explorers, and like/clone shared maps.

---

## Requirements

To run this application locally, you will need:
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (Node Package Manager, installed automatically with Node.js)
- **Spotify Web API Credentials**: A Spotify Developer Client ID and Client Secret (can be obtained by registering an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)).
- **Last.fm API Key** (optional, used as a fallback for artist recommendation queries).

---

## Configuration Setup

Before starting the server, you need to configure your environment variables. 

Create a `.env` file in the `server` directory (`server/.env`) and add the following keys:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
LASTFM_API_KEY=your_lastfm_api_key
PORT=5001
JWT_SECRET=your_jwt_signing_key_secret_here
```

---

## Installation & Running the Application

There are two ways to install dependencies and run the application:

### Option A: Using the Automated Script (Recommended)

In the root directory, there is a shell script `run_app.sh` that checks for Node.js, installs both client and server dependencies, and starts both services concurrently.

1. Open your terminal and navigate to the project root.
2. Run the script:
   ```bash
   ./run_app.sh
   ```
3. Open your browser and navigate to the client local address shown in the terminal (usually `http://localhost:5173/` or `http://localhost:5174/`).

### Option B: Manual Steps

If you prefer to run the client and server processes in separate terminals:

#### 1. Backend Server Setup
Navigate to the `server` directory, install dependencies, and start the node server:
```bash
cd server
npm install
npm start
```
The server will run on port `5001`. The SQLite database file (`music_discovery.db`) will be created and schema-initialized automatically on startup.

#### 2. Frontend Client Setup
Open a new terminal window, navigate to the `client` directory, install dependencies, and start the Vite dev server:
```bash
cd client
npm install
npm run dev
```
The client server will spin up on port `5173` or `5174`. Open the returned address in your browser to start exploring!

---

## Tech Stack Overview

- **Frontend**: React (Hooks, Context), React Flow (canvas graphs), Axios (HTTP queries), Tailwind CSS (glassmorphism/styling).
- **Backend**: Node.js, Express.js (REST API design), JSON Web Tokens (JWT authentication), bcryptjs (password hashing).
- **Database**: SQLite3 (cached artist recommendations, graph topologies, user metadata, follower relations, liked maps).
- **Third-Party APIs**: Spotify Web API (artist searches, top tracks, images), Last.fm API (similar artist fallbacks).
