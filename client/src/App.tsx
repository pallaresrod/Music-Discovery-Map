import React, { useState, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  type Node, 
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { LandingPage } from './components/LandingPage';

const API_BASE_URL = 'http://localhost:5001/api';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'map'>('landing');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);

  // Details State
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [similarArtists, setSimilarArtists] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audio] = useState(() => new Audio());

  // ==========================================
  // User Authentication & Social States
  // ==========================================
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(null);
  
  // Auth Form Controls
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Saved Graph Controls
  const [myMapsOpen, setMyMapsOpen] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState<any[]>([]);
  const [saveMapModalOpen, setSaveMapModalOpen] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapPublic, setNewMapPublic] = useState(true);
  const [currentGraphId, setCurrentGraphId] = useState<number | null>(null);

  // Social Panel Controls
  const [socialPanelOpen, setSocialPanelOpen] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);

  // Profile Editor Controls
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [aboutMeInput, setAboutMeInput] = useState('');
  const [genresInput, setGenresInput] = useState('');
  const [songsInput, setSongsInput] = useState('');

  // ==========================================
  // Helpers & API Calls
  // ==========================================

  const getAuthHeaders = () => {
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  // Auto-login on load
  useEffect(() => {
    if (token) {
      axios.get(`${API_BASE_URL}/auth/me`, getAuthHeaders())
        .then(res => {
          setUser(res.data.user);
        })
        .catch(err => {
          console.error("Auto login expired or failed:", err.message);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        });
    }
  }, [token]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'login') {
        const res = await axios.post(`${API_BASE_URL}/auth/login`, {
          usernameOrEmail: emailInput,
          password: passwordInput
        });
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);
        setAuthModalOpen(false);
      } else {
        const res = await axios.post(`${API_BASE_URL}/auth/register`, {
          username: usernameInput,
          email: emailInput,
          password: passwordInput
        });
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);
        setAuthModalOpen(false);
      }
      setUsernameInput('');
      setEmailInput('');
      setPasswordInput('');
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setSavedGraphs([]);
    setCurrentGraphId(null);
  };

  // Saved Maps Graph Actions
  const fetchSavedGraphs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/graphs`, getAuthHeaders());
      setSavedGraphs(res.data);
    } catch (err: any) {
      console.error('Failed to load graphs', err.message);
    }
  };

  const handleSaveMap = async () => {
    if (!newMapName.trim()) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/graphs`, {
        name: newMapName,
        nodes,
        edges,
        isPublic: newMapPublic
      }, getAuthHeaders());
      
      setCurrentGraphId(res.data.graphId);
      setSaveMapModalOpen(false);
      fetchSavedGraphs();
      alert('Map saved successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save graph');
    }
  };

  const handleLoadMap = async (graphId: number) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/graphs/${graphId}`, getAuthHeaders());
      setNodes(res.data.nodes);
      setEdges(res.data.edges);
      setCurrentGraphId(graphId);
      setSelectedArtist(null);
      setMyMapsOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to load graph');
    }
  };

  const handleTogglePrivacy = async (graphId: number, isCurrentlyPublic: boolean) => {
    try {
      await axios.put(`${API_BASE_URL}/graphs/${graphId}/privacy`, {
        isPublic: !isCurrentlyPublic
      }, getAuthHeaders());
      fetchSavedGraphs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update visibility');
    }
  };

  const handleDeleteMap = async (graphId: number) => {
    if (!confirm('Are you sure you want to delete this map?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/graphs/${graphId}`, getAuthHeaders());
      if (currentGraphId === graphId) {
        setCurrentGraphId(null);
      }
      fetchSavedGraphs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete graph');
    }
  };

  // Social / Followers Actions
  const fetchUsersList = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/users`, getAuthHeaders());
      setUsersList(res.data);
    } catch (err: any) {
      console.error('Failed to load user list', err.message);
    }
  };

  const handleFollowUser = async (targetId: number, isFollowed: boolean) => {
    try {
      if (isFollowed) {
        await axios.delete(`${API_BASE_URL}/users/${targetId}/follow`, getAuthHeaders());
      } else {
        await axios.post(`${API_BASE_URL}/users/${targetId}/follow`, {}, getAuthHeaders());
      }
      
      if (selectedUserProfile && selectedUserProfile.user.id === targetId) {
        handleViewUserProfile(targetId);
      } else {
        fetchUsersList();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Action failed');
    }
  };

  const handleViewUserProfile = async (targetId: number) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/users/${targetId}/profile`, getAuthHeaders());
      setSelectedUserProfile(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to load profile');
    }
  };

  // Profile Editor Actions
  const handleUpdateProfile = async () => {
    try {
      await axios.put(`${API_BASE_URL}/users/profile`, {
        aboutMe: aboutMeInput,
        favoriteGenres: genresInput,
        favoriteSongs: songsInput
      }, getAuthHeaders());
      
      setUser((prev: any) => ({
        ...prev,
        about_me: aboutMeInput,
        favorite_genres: genresInput,
        favorite_songs: songsInput
      }));
      setProfileEditorOpen(false);
      alert('Profile updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const onNodesChange: OnNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange: OnEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

  // Audio Playback Listeners & Cleanup
  useEffect(() => {
    const handleEnded = () => {
      setPlayingTrackId(null);
    };
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audio]);

  useEffect(() => {
    audio.pause();
    setPlayingTrackId(null);
  }, [selectedArtist, audio]);

  const handlePlayPreview = (previewUrl: string, trackId: string) => {
    if (playingTrackId === trackId) {
      audio.pause();
      setPlayingTrackId(null);
    } else {
      audio.pause();
      audio.src = previewUrl;
      audio.play().catch((err) => console.error('Audio playback failed:', err));
      setPlayingTrackId(trackId);
    }
  };

  const selectArtistById = async (artistId: string) => {
    try {
      setLoadingDetails(true);
      setSelectedArtist({ id: artistId, name: 'Loading...', genres: [], popularity: 0 });
      setTopTracks([]);
      setSimilarArtists([]);

      const [detailsRes, tracksRes, similarRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/artists/${artistId}`),
        axios.get(`${API_BASE_URL}/artists/${artistId}/top-tracks`),
        axios.get(`${API_BASE_URL}/artists/${artistId}/similar`),
      ]);

      setSelectedArtist(detailsRes.data);
      setTopTracks(tracksRes.data.slice(0, 5));
      setSimilarArtists(similarRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error selecting artist', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const onNodeClick = async (_event: React.MouseEvent, node: Node) => {
    await selectArtistById(node.id);
  };

  const expandArtist = async (artistId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/artists/${artistId}/similar`);
      const similar = response.data.slice(0, 5);
      
      const sourceNode = nodes.find((n) => n.id === artistId);
      if (!sourceNode) return;

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      similar.forEach((artist: any, index: number) => {
        if (nodes.find((n) => n.id === artist.id)) {
          const edgeId = `e-${artistId}-${artist.id}`;
          const reverseEdgeId = `e-${artist.id}-${artistId}`;
          if (!edges.some((e) => e.id === edgeId || e.id === reverseEdgeId)) {
            newEdges.push({
              id: edgeId,
              source: artistId,
              target: artist.id,
              animated: true,
              style: { stroke: '#1db954' },
            });
          }
          return;
        }

        const angle = (index / similar.length) * 2 * Math.PI;
        const radius = 200;
        const newNode: Node = {
          id: artist.id,
          data: { label: artist.name },
          position: { 
            x: sourceNode.position.x + radius * Math.cos(angle), 
            y: sourceNode.position.y + radius * Math.sin(angle) 
          },
          style: { background: '#282828', color: '#fff', borderRadius: '8px', padding: '10px', border: '1px solid #1db954' }
        };
        newNodes.push(newNode);

        const newEdge: Edge = {
          id: `e-${artistId}-${artist.id}`,
          source: artistId,
          target: artist.id,
          animated: true,
          style: { stroke: '#1db954' }
        };
        newEdges.push(newEdge);
      });

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
    } catch (error) {
      console.error('Error expanding artist', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/artists/search?q=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching artists', error);
    }
  };

  const addArtistToGraph = (artist: any, parentId?: string) => {
    const nodeExists = nodes.some((n) => n.id === artist.id);

    if (nodeExists) {
      if (parentId) {
        const edgeId = `e-${parentId}-${artist.id}`;
        const reverseEdgeId = `e-${artist.id}-${parentId}`;
        const edgeExists = edges.some((e) => e.id === edgeId || e.id === reverseEdgeId);
        
        if (!edgeExists) {
          const newEdge: Edge = {
            id: edgeId,
            source: parentId,
            target: artist.id,
            animated: true,
            style: { stroke: '#1db954' }
          };
          setEdges((eds) => [...eds, newEdge]);
        }
      }
      return;
    }

    let position = { x: Math.random() * 400, y: Math.random() * 400 };
    if (parentId) {
      const parentNode = nodes.find((n) => n.id === parentId);
      if (parentNode) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = 180;
        position = {
          x: parentNode.position.x + radius * Math.cos(angle),
          y: parentNode.position.y + radius * Math.sin(angle)
        };
      }
    }

    const newNode: Node = {
      id: artist.id,
      data: { label: artist.name },
      position,
      style: parentId 
        ? { background: '#282828', color: '#fff', borderRadius: '8px', padding: '10px', border: '1px solid #1db954' }
        : { background: '#1db954', color: '#fff', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
    };

    setNodes((nds) => [...nds, newNode]);

    if (parentId) {
      const newEdge: Edge = {
        id: `e-${parentId}-${artist.id}`,
        source: parentId,
        target: artist.id,
        animated: true,
        style: { stroke: '#1db954' }
      };
      setEdges((eds) => [...eds, newEdge]);
    }

    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <>
      {view === 'landing' ? (
        <LandingPage 
          onStart={() => setView('map')} 
          user={user}
          onLoginClick={() => {
            setAuthError(null);
            setAuthMode('login');
            setAuthModalOpen(true);
          }}
          onLogout={handleLogout}
        />
      ) : (
        <div className="flex flex-col h-screen w-screen bg-gray-900 text-white select-none">
          {/* Header / Search */}
      <header className="p-4 bg-gray-800 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <h1 
            onClick={() => setView('landing')} 
            className="text-2xl font-bold text-green-500 cursor-pointer hover:text-green-400 transition"
          >
            Music Discovery Map
          </h1>
        </div>
        
        {/* Right Header Navigation Panel */}
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="relative flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for an artist..."
              className="px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-64 text-white"
            />
            <button type="submit" className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-semibold transition">
              Search
            </button>
            
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {searchResults.map((artist) => (
                  <div 
                    key={artist.id} 
                    onClick={() => addArtistToGraph(artist)}
                    className="p-3 hover:bg-gray-700 cursor-pointer flex items-center gap-3 border-b border-gray-700 last:border-0 text-white"
                  >
                    {artist.images && artist.images[0] && (
                      <img src={artist.images[0].url} alt={artist.name} className="w-8 h-8 rounded-full" />
                    )}
                    <span>{artist.name}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* User Auth Dropdown */}
          {user && (
            <div className="relative group">
              <button className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition cursor-pointer">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                {user.username}
                <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition duration-150 z-50">
                <button 
                  onClick={() => {
                    setAboutMeInput(user.about_me || '');
                    setGenresInput(user.favorite_genres ? JSON.parse(user.favorite_genres) : '');
                    setSongsInput(user.favorite_songs ? JSON.parse(user.favorite_songs) : '');
                    setProfileEditorOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition"
                >
                  👤 Edit Profile
                </button>
                <button 
                  onClick={() => {
                    fetchSavedGraphs();
                    setMyMapsOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition"
                >
                  📁 My Saved Maps
                </button>
                <button 
                  onClick={() => {
                    fetchUsersList();
                    setSocialPanelOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition"
                >
                  👥 Social Explorer
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-red-400 hover:text-red-300 transition"
                >
                  ✕ Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex relative overflow-hidden">
        <div className="flex-grow h-full relative">
          
          {/* Floating Saved Map Info for Authenticated Users */}
          {user && (
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <button 
                onClick={() => {
                  setNewMapName('');
                  setNewMapPublic(true);
                  setSaveMapModalOpen(true);
                }}
                className="bg-gray-800/90 hover:bg-gray-700 backdrop-blur border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-green-500 transition shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                💾 Save Map
              </button>
              {currentGraphId && (
                <span className="bg-gray-800/90 border border-white/10 px-3 py-2.5 rounded-xl text-[10px] font-semibold text-gray-400 backdrop-blur shadow-lg flex items-center">
                  Map ID: {currentGraphId}
                </span>
              )}
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background color="#333" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Sidebar / Detail Panel */}
        <div 
          className={`fixed top-0 right-0 h-full w-96 bg-gray-950/95 backdrop-blur-lg border-l border-white/10 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
            selectedArtist ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedArtist && (
            <>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <span className="font-semibold text-gray-400">Artist Details</span>
                <button 
                  onClick={() => setSelectedArtist(null)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Sidebar Body */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6">
                {loadingDetails ? (
                  <div className="space-y-6 animate-pulse">
                    <div className="w-full h-48 bg-white/5 rounded-2xl" />
                    <div className="h-8 bg-white/5 rounded-lg w-3/4" />
                    <div className="h-4 bg-white/5 rounded-lg w-1/2" />
                    <div className="space-y-3">
                      <div className="h-6 bg-white/5 rounded-lg w-1/3" />
                      <div className="h-10 bg-white/5 rounded-lg" />
                      <div className="h-10 bg-white/5 rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Cover & Basic Info */}
                    <div className="text-center">
                      {selectedArtist.images && selectedArtist.images[0] ? (
                        <div className="relative w-full h-56 rounded-2xl overflow-hidden shadow-2xl mb-4 group border border-white/10">
                          <img 
                            src={selectedArtist.images[0].url} 
                            alt={selectedArtist.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60" />
                        </div>
                      ) : (
                        <div className="w-full h-56 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                          <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      
                      <h2 className="text-2xl font-black bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent truncate pb-1">
                        {selectedArtist.name}
                      </h2>

                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        {selectedArtist.genres && selectedArtist.genres.length > 0 ? (
                          selectedArtist.genres.slice(0, 3).map((genre: string) => (
                            <span key={genre} className="text-xs font-semibold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full text-green-400">
                              {genre}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No genres specified</span>
                        )}
                      </div>
                    </div>

                    {/* Popularity Tracker */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Popularity</span>
                        <span className="text-sm font-bold text-green-400">{selectedArtist.popularity}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500" 
                          style={{ width: `${selectedArtist.popularity}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2.5">
                      <button 
                        onClick={() => expandArtist(selectedArtist.id)}
                        className="flex-grow bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-3 px-4 rounded-xl transition duration-200 shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Expand Map
                      </button>
                      
                      {selectedArtist.external_urls?.spotify && (
                        <a 
                          href={selectedArtist.external_urls.spotify} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 text-white font-bold p-3 rounded-xl transition flex items-center justify-center"
                          title="Open in Spotify"
                        >
                          <svg className="w-5 h-5 text-[#1DB954]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.434-5.305-1.76-8.786-.965-.336.077-.67-.135-.747-.472-.078-.337.136-.67.473-.748 3.82-.873 7.085-.493 9.71 1.11.294.18.388.563.207.857.001 0 0 0 0 0zm1.225-2.72c-.227.367-.707.487-1.074.26-2.69-1.653-6.79-2.135-9.97-1.17-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.637-1.104 8.163-.566 11.236 1.32.368.228.488.708.26 1.075v-.001zm.105-2.836C14.483 8.78 8.712 8.59 5.378 9.602c-.513.156-1.05-.133-1.206-.646-.156-.513.133-1.05.646-1.207 3.828-1.162 10.205-.944 14.28 1.477.462.275.613.87.338 1.333-.275.463-.87.614-1.333.34l.001-.001z"/>
                          </svg>
                        </a>
                      )}
                    </div>

                    {/* Top Tracks */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Top Tracks</h3>
                      {topTracks.length > 0 ? (
                        <div className="space-y-2 bg-white/5 border border-white/5 rounded-2xl p-3">
                          {topTracks.map((track: any) => {
                            const isPlaying = playingTrackId === track.id;
                            const durationMinSec = () => {
                              const mins = Math.floor(track.duration_ms / 60000);
                              const secs = Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0');
                              return `${mins}:${secs}`;
                            };

                            return (
                              <div 
                                key={track.id} 
                                className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition duration-150 group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {track.album?.images?.[0]?.url ? (
                                    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                                      <img src={track.album.images[0].url} alt={track.name} className="w-full h-full object-cover" />
                                      {track.preview_url && (
                                        <button
                                          onClick={() => handlePlayPreview(track.preview_url, track.id)}
                                          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                        >
                                          {isPlaying ? (
                                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                            </svg>
                                          ) : (
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M8 5v14l11-7z"/>
                                            </svg>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 10l12-3" />
                                      </svg>
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-white truncate group-hover:text-green-400 transition-colors">
                                      {track.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                      {track.album?.name}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">{durationMinSec()}</span>
                                  {track.preview_url && (
                                    <button
                                      onClick={() => handlePlayPreview(track.preview_url, track.id)}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                                        isPlaying 
                                          ? 'bg-green-500/10 border-green-500 text-green-500' 
                                          : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                      }`}
                                    >
                                      {isPlaying ? (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8 5v14l11-7z"/>
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                          No top tracks found
                        </p>
                      )}
                    </div>

                    {/* Similar Artists */}
                    <div className="space-y-3 pb-8">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Similar Artists</h3>
                      {similarArtists.length > 0 ? (
                        <div className="space-y-2 bg-white/5 border border-white/5 rounded-2xl p-3">
                          {similarArtists.map((artist: any) => {
                            const isInGraph = nodes.some((n) => n.id === artist.id);
                            return (
                              <div 
                                key={artist.id}
                                className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition duration-150 group"
                              >
                                <div 
                                  onClick={() => selectArtistById(artist.id)}
                                  className="flex items-center gap-3 cursor-pointer min-w-0 flex-grow"
                                >
                                  {artist.images?.[0]?.url ? (
                                    <img 
                                      src={artist.images[0].url} 
                                      alt={artist.name} 
                                      className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0" 
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-white/10 flex-shrink-0">
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="text-sm font-bold text-white truncate block group-hover:text-green-400 transition-colors">
                                      {artist.name}
                                    </span>
                                    <span className="text-xs text-gray-400 block truncate">
                                      {artist.genres?.slice(0, 2).join(', ') || 'Alternative'}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => addArtistToGraph(artist, selectedArtist.id)}
                                  disabled={isInGraph}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer flex-shrink-0 ${
                                    isInGraph
                                      ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-not-allowed opacity-60'
                                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                                  }`}
                                  title={isInGraph ? "Already on map" : "Add connection to map"}
                                >
                                  {isInGraph ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                          No similar artists found
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-500 text-xl font-medium">Search and add an artist to start your map</p>
          </div>
        )}
      </main>
    </div>
      )}

      {/* ==========================================
          Modals & Drawer Subcomponents
      ========================================== */}

      {/* 1. Auth Login/Register Modal */}
        {authModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-950 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
              <button 
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white text-sm"
              >
                ✕
              </button>
              <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                {authMode === 'login' ? 'Access your saved maps and profiles.' : 'Join to save maps and connect with others.'}
              </p>
              
              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs mb-4">
                  {authError}
                </div>
              )}
              
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Username</label>
                    <input 
                      type="text" 
                      required
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition" 
                      placeholder="yourusername"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    {authMode === 'login' ? 'Username or Email' : 'Email Address'}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition" 
                    placeholder={authMode === 'login' ? 'username or email' : 'you@example.com'}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Password</label>
                  <input 
                    type="password" 
                    required
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition" 
                    placeholder="••••••••"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-3 rounded-xl transition duration-200 mt-2 cursor-pointer text-sm shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                >
                  {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              </form>
              
              <div className="text-center mt-6 text-xs text-gray-400 font-medium">
                {authMode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button 
                      onClick={() => { setAuthError(null); setAuthMode('register'); }} 
                      className="text-green-400 hover:text-green-300 font-semibold"
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button 
                      onClick={() => { setAuthError(null); setAuthMode('login'); }} 
                      className="text-green-400 hover:text-green-300 font-semibold"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. Save Map Modal */}
        {saveMapModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-950 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
              <button 
                onClick={() => setSaveMapModalOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Save Current Map</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Map Title</label>
                  <input 
                    type="text" 
                    value={newMapName}
                    onChange={e => setNewMapName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition" 
                    placeholder="My Awesome Exploration"
                  />
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                  <div>
                    <span className="text-sm font-semibold block">Public Visibility</span>
                    <span className="text-xs text-gray-400 block">Followers and other users can view this map.</span>
                  </div>
                  <button 
                    onClick={() => setNewMapPublic(!newMapPublic)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${newMapPublic ? 'bg-green-500' : 'bg-gray-700'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${newMapPublic ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button 
                  onClick={handleSaveMap}
                  className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-3 rounded-xl transition duration-200 mt-2 cursor-pointer text-sm shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                >
                  Confirm Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. My Saved Maps Panel (Left Drawer) */}
        {myMapsOpen && (
          <div className="fixed top-0 left-0 h-full w-96 bg-gray-950/95 backdrop-blur-lg border-r border-white/10 shadow-2xl z-40 flex flex-col transform transition-transform duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="font-bold text-gray-300">My Saved Maps</span>
              <button 
                onClick={() => setMyMapsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {savedGraphs.length > 0 ? (
                savedGraphs.map(graph => (
                  <div 
                    key={graph.id}
                    className={`p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-between gap-3 transition-colors ${currentGraphId === graph.id ? 'border-green-500/30 bg-green-500/5' : 'hover:bg-white/10'}`}
                  >
                    <div>
                      <span className="font-bold text-sm block text-white">{graph.name}</span>
                      <span className="text-[10px] text-gray-400 block mt-1">Saved on: {new Date(graph.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <button 
                        onClick={() => handleTogglePrivacy(graph.id, graph.is_public === 1)}
                        className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        {graph.is_public === 1 ? '🔓 Public' : '🔒 Private'}
                      </button>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleLoadMap(graph.id)}
                          className="bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Load
                        </button>
                        <button 
                          onClick={() => handleDeleteMap(graph.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/20 transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 italic text-center p-4">No saved maps. Create a map and hit "Save Map" to start archiving them here.</p>
              )}
            </div>
          </div>
        )}

        {/* 4. Profile Editor Modal */}
        {profileEditorOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-950 border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
              <button 
                onClick={() => setProfileEditorOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                ✕
              </button>
              <h2 className="text-2xl font-black mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Customize Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">About Me</label>
                  <textarea 
                    value={aboutMeInput}
                    onChange={e => setAboutMeInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition h-20 resize-none" 
                    placeholder="Describe your musical tastes..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Favorite Genres</label>
                  <input 
                    type="text"
                    value={genresInput}
                    onChange={e => setGenresInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition" 
                    placeholder="Indie Rock, Electronic, R&B"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Favorite Artists & Songs</label>
                  <input 
                    type="text"
                    value={songsInput}
                    onChange={e => setSongsInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition" 
                    placeholder="Radiohead - Weird Fishes, Daft Punk - One More Time"
                  />
                </div>
                <button 
                  onClick={handleUpdateProfile}
                  className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-3 rounded-xl transition duration-200 mt-2 cursor-pointer text-sm shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                >
                  Save Profile Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Social Explorer & Followers Panel (Right Drawer) */}
        {socialPanelOpen && (
          <div className="fixed top-0 right-0 h-full w-[26rem] bg-gray-950/95 backdrop-blur-lg border-l border-white/10 shadow-2xl z-40 flex flex-col transform transition-transform duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="font-bold text-gray-300">Social Explorer</span>
              <button 
                onClick={() => { setSocialPanelOpen(false); setSelectedUserProfile(null); }}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 flex flex-col">
              {selectedUserProfile ? (
                /* Detailed Profile View */
                <div className="space-y-6 flex-grow">
                  <button 
                    onClick={() => setSelectedUserProfile(null)}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1 font-semibold"
                  >
                    ← Back to Explorer
                  </button>
                  
                  {/* User profile card */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                    <div>
                      <h3 className="text-2xl font-black text-white">{selectedUserProfile.user.username}</h3>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Registered explorer</span>
                    </div>
                    
                    <div className="flex gap-4 border-y border-white/5 py-3 text-center">
                      <div className="flex-grow">
                        <span className="block text-xl font-bold text-green-400">{selectedUserProfile.followersCount}</span>
                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Followers</span>
                      </div>
                      <div className="flex-grow border-l border-white/5">
                        <span className="block text-xl font-bold text-green-400">{selectedUserProfile.followingCount}</span>
                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Following</span>
                      </div>
                    </div>

                    {selectedUserProfile.user.about_me && (
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">About Me</span>
                        <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 font-medium">{selectedUserProfile.user.about_me}</p>
                      </div>
                    )}

                    {selectedUserProfile.user.favorite_genres && (
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Favorite Genres</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUserProfile.user.favorite_genres.replace(/"/g, '').split(',').map((g: string) => (
                            <span key={g} className="text-[10px] bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full text-green-400 font-bold">
                              {g.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUserProfile.user.favorite_songs && (
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Favorite Music</span>
                        <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 font-medium">{selectedUserProfile.user.favorite_songs.replace(/"/g, '')}</p>
                      </div>
                    )}

                    {user && user.id !== selectedUserProfile.user.id && (
                      <button 
                        onClick={() => handleFollowUser(selectedUserProfile.user.id, selectedUserProfile.isFollowed)}
                        className={`w-full py-2.5 rounded-xl font-bold text-sm transition ${selectedUserProfile.isFollowed ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-white' : 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/10'}`}
                      >
                        {selectedUserProfile.isFollowed ? '✓ Unfollow' : 'Follow User'}
                      </button>
                    )}
                  </div>

                  {/* Saved maps of selected user */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Public Exploration Maps</h4>
                    {selectedUserProfile.graphs.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUserProfile.graphs.map((graph: any) => (
                          <div key={graph.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition">
                            <div>
                              <span className="font-bold text-sm text-white block">{graph.name}</span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">Created: {new Date(graph.created_at).toLocaleDateString()}</span>
                            </div>
                            <button
                              onClick={() => { handleLoadMap(graph.id); setSocialPanelOpen(false); setSelectedUserProfile(null); }}
                              className="bg-green-500 text-black text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            >
                              View Map
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic bg-white/5 p-4 rounded-2xl text-center">This explorer has not saved any public maps yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* List View of All Registered Users */
                <div className="space-y-3 flex-grow">
                  {usersList.length > 0 ? (
                    usersList.map(item => (
                      <div key={item.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition">
                        <div onClick={() => handleViewUserProfile(item.id)} className="cursor-pointer min-w-0 flex-grow pr-2">
                          <span className="font-bold text-sm block text-white hover:text-green-400 transition-colors">{item.username}</span>
                          <span className="text-xs text-gray-400 truncate block mt-0.5 font-medium">{item.about_me || 'No biography written.'}</span>
                        </div>
                        {user && (
                          <button
                            onClick={() => handleFollowUser(item.id, item.is_followed === 1)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                              item.is_followed === 1 
                                ? 'bg-transparent border-white/10 text-gray-300 hover:text-white hover:bg-white/5' 
                                : 'bg-green-500 border-green-500 text-black hover:bg-green-400'
                            }`}
                          >
                            {item.is_followed === 1 ? 'Unfollow' : 'Follow'}
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 italic text-center p-4">No other explorers registered yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
    </>
  );
};

export default App;

