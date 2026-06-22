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
  const [view, setView] = useState<'landing' | 'map' | 'explore' | 'saved-maps' | 'account'>('landing');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isDirty, setIsDirty] = useState(false);
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
  const [savedGraphs, setSavedGraphs] = useState<any[]>([]);
  const [saveMapModalOpen, setSaveMapModalOpen] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapPublic, setNewMapPublic] = useState(true);
  const [currentGraphId, setCurrentGraphId] = useState<number | null>(null);
  const [loadedGraph, setLoadedGraph] = useState<any>(null);
  const [likedGraphs, setLikedGraphs] = useState<any[]>([]);
  const [savedMapsSubTab, setSavedMapsSubTab] = useState<'my-maps' | 'liked-maps'>('my-maps');

  // Social Panel Controls
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);

  // Profile Editor Controls
  const [aboutMeInput, setAboutMeInput] = useState('');
  const [genresInput, setGenresInput] = useState('');
  const [songsInput, setSongsInput] = useState('');

  // ==========================================
  // Custom Toasts & Custom Confirm Dialog States
  // ==========================================
  interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  interface ConfirmDialogState {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (message: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmDialog({
      isOpen: true,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

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

  // Synchronize account inputs with authenticated user details
  useEffect(() => {
    if (user) {
      setAboutMeInput(user.about_me || '');
      setGenresInput(user.favorite_genres ? JSON.parse(user.favorite_genres) : '');
      setSongsInput(user.favorite_songs ? JSON.parse(user.favorite_songs) : '');
    } else {
      setAboutMeInput('');
      setGenresInput('');
      setSongsInput('');
    }
  }, [user]);

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
    setLikedGraphs([]);
    setCurrentGraphId(null);
    setLoadedGraph(null);
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

  const fetchLikedGraphs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/graphs/liked`, getAuthHeaders());
      setLikedGraphs(res.data);
    } catch (err: any) {
      console.error('Failed to load liked graphs', err.message);
    }
  };

  const handleLikeMap = async (graphId: number, isCurrentlyLiked: boolean) => {
    if (!user) {
      showToast("Please sign in to like maps", "info");
      setAuthError(null);
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    try {
      if (isCurrentlyLiked) {
        await axios.delete(`${API_BASE_URL}/graphs/${graphId}/like`, getAuthHeaders());
        showToast('Map removed from liked maps', 'info');
      } else {
        await axios.post(`${API_BASE_URL}/graphs/${graphId}/like`, {}, getAuthHeaders());
        showToast('Map added to liked maps!', 'success');
      }

      fetchLikedGraphs();
      if (selectedUserProfile) {
        const updatedGraphs = selectedUserProfile.graphs.map((g: any) => {
          if (g.id === graphId) {
            return { ...g, is_liked: isCurrentlyLiked ? 0 : 1 };
          }
          return g;
        });
        setSelectedUserProfile({
          ...selectedUserProfile,
          graphs: updatedGraphs
        });
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update map like status', 'error');
    }
  };

  const handleSaveMap = async () => {
    // In-place update check
    if (loadedGraph && user && loadedGraph.user_id === user.id) {
      try {
        await axios.put(`${API_BASE_URL}/graphs/${loadedGraph.id}`, {
          nodes,
          edges
        }, getAuthHeaders());
        
        setNodes([]);
        setEdges([]);
        setCurrentGraphId(null);
        setLoadedGraph(null);
        setSelectedArtist(null);
        setIsDirty(false);
        setSaveMapModalOpen(false);
        fetchSavedGraphs();
        showToast('Map updated successfully!', 'success');
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to update graph', 'error');
      }
      return;
    }

    // Creating new saved map
    if (!newMapName.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/graphs`, {
        name: newMapName,
        nodes,
        edges,
        isPublic: newMapPublic
      }, getAuthHeaders());
      
      setNodes([]);
      setEdges([]);
      setCurrentGraphId(null);
      setLoadedGraph(null);
      setSelectedArtist(null);
      setIsDirty(false);
      setSaveMapModalOpen(false);
      fetchSavedGraphs();
      showToast('Map saved successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save graph', 'error');
    }
  };

  const handleSaveMapClick = () => {
    if (loadedGraph && user && loadedGraph.user_id === user.id) {
      handleSaveMap();
    } else {
      setNewMapName('');
      setNewMapPublic(true);
      setSaveMapModalOpen(true);
    }
  };

  const handleLoadMap = async (graphId: number) => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/graphs/${graphId}`, getAuthHeaders());
        setNodes(res.data.nodes);
        setEdges(res.data.edges);
        setCurrentGraphId(graphId);
        setLoadedGraph(res.data.graph);
        setSelectedArtist(null);
        setIsDirty(false);
        showToast('Map loaded successfully!', 'success');
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to load graph', 'error');
      }
    };

    if (isDirty) {
      showConfirm("Are you sure? You have unsaved changes.", load);
    } else {
      await load();
    }
  };

  const handleClearMap = () => {
    const clear = () => {
      setNodes([]);
      setEdges([]);
      setCurrentGraphId(null);
      setLoadedGraph(null);
      setSelectedArtist(null);
      setIsDirty(false);
      showToast('Map cleared', 'info');
    };

    if (isDirty) {
      showConfirm("Are you sure? You have unsaved changes.", clear);
    } else {
      clear();
    }
  };



  const handleNavigation = (targetView: 'landing' | 'map' | 'explore' | 'saved-maps' | 'account') => {
    if (view === targetView) return;
    
    if (isDirty) {
      showConfirm("Are you sure? You have unsaved changes.", () => {
        navigateToView(targetView);
      });
    } else {
      navigateToView(targetView);
    }
  };

  const navigateToView = (targetView: 'landing' | 'map' | 'explore' | 'saved-maps' | 'account') => {
    if (!user && (targetView === 'saved-maps' || targetView === 'account')) {
      showToast("Please sign in to access this page", "info");
      setAuthError(null);
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }
    
    setView(targetView);
    
    if (targetView === 'saved-maps' && user) {
      fetchSavedGraphs();
      fetchLikedGraphs();
    }
    if (targetView === 'explore') {
      fetchUsersList();
    }
  };

  const handleTogglePrivacy = async (graphId: number, isCurrentlyPublic: boolean) => {
    try {
      await axios.put(`${API_BASE_URL}/graphs/${graphId}/privacy`, {
        isPublic: !isCurrentlyPublic
      }, getAuthHeaders());
      fetchSavedGraphs();
      showToast('Privacy settings updated!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update visibility', 'error');
    }
  };

  const handleDeleteMap = async (graphId: number) => {
    showConfirm('Are you sure you want to delete this map?', async () => {
      try {
        await axios.delete(`${API_BASE_URL}/graphs/${graphId}`, getAuthHeaders());
        if (currentGraphId === graphId) {
          setCurrentGraphId(null);
          setLoadedGraph(null);
        }
        fetchSavedGraphs();
        showToast('Map deleted successfully', 'success');
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to delete graph', 'error');
      }
    });
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
        showToast('Unfollowed user', 'info');
      } else {
        await axios.post(`${API_BASE_URL}/users/${targetId}/follow`, {}, getAuthHeaders());
        showToast('Followed user!', 'success');
      }
      
      if (selectedUserProfile && selectedUserProfile.user.id === targetId) {
        handleViewUserProfile(targetId);
      } else {
        fetchUsersList();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleViewUserProfile = async (targetId: number) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/users/${targetId}/profile`, getAuthHeaders());
      setSelectedUserProfile(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load profile', 'error');
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
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    }
  };

  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    const hasRealChanges = changes.some(c => c.type === 'position' || c.type === 'remove' || c.type === 'add');
    if (hasRealChanges) {
      setIsDirty(true);
    }
  };
  const onEdgesChange: OnEdgesChange = (changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    const hasRealChanges = changes.some(c => c.type === 'remove' || c.type === 'add');
    if (hasRealChanges) {
      setIsDirty(true);
    }
  };
  const onConnect = (params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
    setIsDirty(true);
  };

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

      if (newNodes.length > 0 || newEdges.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        setIsDirty(true);
      }
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
          setIsDirty(true);
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

    setIsDirty(true);
    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-white select-none overflow-hidden">
      {/* 1. Persistent Top Navigation Header */}
      <header className="px-6 py-4 bg-gray-900 border-b border-white/5 grid grid-cols-3 items-center shadow-md z-30 w-full flex-shrink-0">
        {/* Left Title */}
        <div className="flex items-center gap-2.5 cursor-pointer justify-self-start" onClick={() => handleNavigation('landing')}>
          <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30">
            <svg className="w-5 h-5 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <span className="font-semibold text-lg tracking-wider bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Music Discovery Map
          </span>
        </div>

        {/* Center Navigation Tabs */}
        <div className="flex justify-center">
          <nav className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-white/5">
            {[
              { id: 'map', label: '🗺️ Map' },
              { id: 'explore', label: '👥 Explore' },
              { id: 'saved-maps', label: '📁 Saved Maps' },
              { id: 'account', label: '👤 Account' }
            ].map((tab) => {
              const isActive = view === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleNavigation(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer select-none ${
                    isActive
                      ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Header Navigation Panel */}
        <div className="flex items-center gap-4 justify-self-end">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-300">Hello, {user.username}</span>
              <button 
                onClick={handleLogout}
                className="bg-white/5 border border-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition cursor-pointer text-gray-300"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                setAuthError(null);
                setAuthMode('login');
                setAuthModalOpen(true);
              }}
              className="bg-green-500 hover:bg-green-400 text-black px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Page Content View Routing */}
      <div className="flex-grow w-full overflow-hidden relative flex flex-col">
        {view === 'landing' && (
          <LandingPage onStart={() => handleNavigation('map')} />
        )}

        {view === 'map' && (
          <main className="flex-grow flex relative overflow-hidden h-full w-full">
            <div className="flex-grow h-full relative">
              {/* Floating Map Controls */}
              <div className="absolute top-4 left-4 z-10 flex gap-2">
                {user && (
                  <>
                    <button 
                      onClick={handleSaveMapClick}
                      className="bg-gray-800/90 hover:bg-gray-700 backdrop-blur border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-green-500 transition shadow-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      💾 Save Map
                    </button>
                    {currentGraphId && (
                      <span className="bg-gray-800/90 border border-white/10 px-3 py-2.5 rounded-xl text-[10px] font-semibold text-gray-400 backdrop-blur shadow-lg flex items-center">
                        Map ID: {currentGraphId}
                      </span>
                    )}
                  </>
                )}
                
                {/* Clear Map button (visible when there are nodes) */}
                {nodes.length > 0 && (
                  <button 
                    onClick={handleClearMap}
                    className="bg-gray-800/90 hover:bg-red-500/10 hover:text-red-400 border border-white/10 hover:border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 transition shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    🗑️ Clear Map
                  </button>
                )}
              </div>

              {/* Floating Search Controls */}
              <form 
                onSubmit={handleSearch} 
                className={`absolute top-4 z-10 flex gap-2 transition-all duration-300 ease-in-out ${
                  selectedArtist ? 'right-[26rem]' : 'right-4'
                }`}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for an artist..."
                  className="px-4 py-2.5 bg-gray-800/90 backdrop-blur border border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-green-500 w-60 text-white text-xs shadow-lg"
                />
                <button 
                  type="submit" 
                  className="bg-green-500 hover:bg-green-400 active:scale-95 text-black px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                >
                  Search
                </button>
                
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto font-medium">
                    {searchResults.map((artist) => (
                      <div 
                        key={artist.id} 
                        onClick={() => addArtistToGraph(artist)}
                        className="p-3 hover:bg-gray-700 cursor-pointer flex items-center gap-3 border-b border-gray-700 last:border-0 text-white text-xs font-medium"
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
              className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-96 bg-gray-950/95 backdrop-blur-lg border-l border-white/10 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
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
                        <div className="w-full h-48 bg-white/5 rounded-2xl animate-pulse" />
                        <div className="h-8 bg-white/5 rounded-lg w-3/4 animate-pulse" />
                        <div className="h-4 bg-white/5 rounded-lg w-1/2 animate-pulse" />
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
        )}

        {view === 'explore' && (
          <div className="flex-grow flex flex-col md:flex-row gap-6 p-6 max-w-7xl mx-auto w-full overflow-hidden h-full">
            {/* Left Side: Users List */}
            <div className="w-full md:w-[24rem] bg-gray-900/60 border border-white/5 rounded-3xl p-6 flex flex-col h-full overflow-hidden">
              <h2 className="text-xl font-black mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Social Explorer</h2>
              <div className="flex-grow overflow-y-auto space-y-3 pr-1">
                {usersList.length > 0 ? (
                  usersList.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleViewUserProfile(item.id)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        selectedUserProfile?.user.id === item.id 
                          ? 'bg-green-500/5 border-green-500/25' 
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="min-w-0 flex-grow pr-2">
                        <span className="font-bold text-sm block text-white hover:text-green-400 transition-colors">{item.username}</span>
                        <span className="text-xs text-gray-400 truncate block mt-0.5 font-medium">{item.about_me || 'No biography written.'}</span>
                      </div>
                      {user && user.id !== item.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowUser(item.id, item.is_followed === 1);
                          }}
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
            </div>

            {/* Right Side: Profile Details */}
            <div className="flex-grow bg-gray-900/40 border border-white/5 rounded-3xl p-6 flex flex-col h-full overflow-y-auto">
              {selectedUserProfile ? (
                <div className="space-y-6 w-full">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div>
                      <h3 className="text-3xl font-black text-white">{selectedUserProfile.user.username}</h3>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Registered explorer</span>
                    </div>

                    <div className="flex gap-4 border-y border-white/5 py-4 text-center">
                      <div className="flex-grow">
                        <span className="block text-2xl font-bold text-green-400">{selectedUserProfile.followersCount}</span>
                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Followers</span>
                      </div>
                      <div className="flex-grow border-l border-white/5">
                        <span className="block text-2xl font-bold text-green-400">{selectedUserProfile.followingCount}</span>
                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Following</span>
                      </div>
                    </div>

                    {selectedUserProfile.user.about_me && (
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">About Me</span>
                        <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3.5 rounded-xl border border-white/5 font-medium">{selectedUserProfile.user.about_me}</p>
                      </div>
                    )}

                    {selectedUserProfile.user.favorite_genres && (
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Favorite Genres</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUserProfile.user.favorite_genres.replace(/"/g, '').split(',').map((g: string) => (
                            <span key={g} className="text-[10px] bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full text-green-400 font-bold">
                              {g.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUserProfile.user.favorite_songs && (
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Favorite Music</span>
                        <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3.5 rounded-xl border border-white/5 font-medium">{selectedUserProfile.user.favorite_songs.replace(/"/g, '')}</p>
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

                  {/* Public maps of selected user */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Public Exploration Maps</h4>
                    {selectedUserProfile.graphs.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedUserProfile.graphs.map((graph: any) => (
                          <div key={graph.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition">
                            <div>
                              <span className="font-bold text-sm text-white block">{graph.name}</span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">Created: {new Date(graph.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLikeMap(graph.id, graph.is_liked === 1);
                                }}
                                className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1 ${
                                  graph.is_liked === 1
                                    ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                    : 'bg-transparent border-white/10 text-gray-300 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {graph.is_liked === 1 ? '❤️' : '🤍'}
                              </button>
                              <button
                                onClick={() => { handleLoadMap(graph.id); setView('map'); }}
                                className="bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                              >
                                View Map
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic bg-white/5 p-4 rounded-2xl text-center">This explorer has not saved any public maps yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Select an Explorer</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    Choose one of the registered music explorers from the left sidebar to view their profile, favorite tracks, and public graphs.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'saved-maps' && (
          <div className="flex-grow max-w-7xl mx-auto w-full p-6 overflow-y-auto flex flex-col h-full">
            <h2 className="text-3xl font-black mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Saved Maps</h2>
            
            {/* Sub-tabs for My Maps vs Liked Maps */}
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3.5">
              <button
                onClick={() => setSavedMapsSubTab('my-maps')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  savedMapsSubTab === 'my-maps'
                    ? 'bg-green-500 text-black shadow-lg shadow-green-500/10'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                📁 My Maps
              </button>
              <button
                onClick={() => setSavedMapsSubTab('liked-maps')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  savedMapsSubTab === 'liked-maps'
                    ? 'bg-green-500 text-black shadow-lg shadow-green-500/10'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                ❤️ Liked Maps
              </button>
            </div>

            {savedMapsSubTab === 'my-maps' ? (
              savedGraphs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
                  {savedGraphs.map(graph => (
                    <div 
                      key={graph.id}
                      className={`p-5 bg-white/5 border rounded-2xl flex flex-col justify-between gap-4 transition-colors ${currentGraphId === graph.id ? 'border-green-500/30 bg-green-500/5' : 'border-white/5 hover:bg-white/10'}`}
                    >
                      <div>
                        <span className="font-bold text-base block text-white">{graph.name}</span>
                        <span className="text-[10px] text-gray-400 block mt-1">Saved on: {new Date(graph.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <button 
                          onClick={() => handleTogglePrivacy(graph.id, graph.is_public === 1)}
                          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer font-semibold transition"
                        >
                          {graph.is_public === 1 ? '🔓 Public' : '🔒 Private'}
                        </button>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { handleLoadMap(graph.id); setView('map'); }}
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
                  ))}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-white/5 border border-white/5 rounded-3xl">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A9 9 0 0112 3v0.75m0 8.25V12a3 3 0 11-6 0v0.75" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No Saved Maps</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-6">
                    You haven't archived any exploration maps yet. Head to the Map tab, build a music web, and save it to see it listed here.
                  </p>
                  <button
                    onClick={() => handleNavigation('map')}
                    className="bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-6 py-2.5 rounded-xl transition cursor-pointer uppercase tracking-wider"
                  >
                    Go to Map Canvas
                  </button>
                </div>
              )
            ) : (
              likedGraphs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
                  {likedGraphs.map(graph => (
                    <div 
                      key={graph.id}
                      className="p-5 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-between gap-4 transition-colors hover:bg-white/10"
                    >
                      <div>
                        <span className="font-bold text-base block text-white">{graph.name}</span>
                        <span className="text-[10px] text-green-400 block mt-1 font-semibold">Creator: @{graph.creator_name}</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">Saved on: {new Date(graph.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <button 
                          onClick={() => handleLikeMap(graph.id, true)}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer font-semibold transition"
                        >
                          ❤️ Liked
                        </button>
                        <button 
                          onClick={() => { handleLoadMap(graph.id); setView('map'); }}
                          className="bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-4 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-white/5 border border-white/5 rounded-3xl">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-4">
                    <svg className="w-8 h-8 text-red-500/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No Liked Maps</h3>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-6">
                    You haven't liked any public maps from other music explorers yet. Head to the Explore tab to find other people's maps!
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {view === 'account' && user && (
          <div className="flex-grow max-w-2xl mx-auto w-full p-6 overflow-y-auto flex flex-col h-full justify-center">
            <div className="bg-gray-900 border border-white/5 w-full rounded-3xl p-8 shadow-2xl relative space-y-6">
              <div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Explorer Profile</h2>
                <p className="text-xs text-gray-400 mt-1">Customize details and sharing metadata for your explorer dashboard.</p>
              </div>

              {/* User Identity Info */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4.5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center font-bold text-lg select-none">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="block font-bold text-white text-base">{user.username}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">{user.email || 'No email associated'}</span>
                </div>
              </div>

              {/* Editing Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">About Me</label>
                  <textarea 
                    value={aboutMeInput}
                    onChange={e => setAboutMeInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-green-500 transition h-20 resize-none" 
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
                  className="w-full bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-3.5 rounded-xl transition duration-200 mt-2 cursor-pointer text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                >
                  Save Profile Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Auth Login/Register Modal */}
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

      {/* 4. Save Map Modal */}
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

      {/* 5. Custom Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4.5 py-3.5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slide-in-right ${
                isSuccess
                  ? 'bg-green-950/90 border-green-500/30 text-green-400'
                  : isError
                  ? 'bg-red-950/90 border-red-500/30 text-red-400'
                  : 'bg-slate-900/95 border-white/10 text-gray-200'
              }`}
            >
              {/* Icon */}
              {isSuccess && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {isError && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              {!isSuccess && !isError && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              {/* Message */}
              <span className="text-xs font-bold tracking-wide">{toast.message}</span>
            </div>
          );
        })}
      </div>

      {/* 6. Custom Confirm Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-center flex flex-col items-center animate-pulse-once">
            {/* Alert Warning Icon */}
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4 animate-bounce-subtle">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            {/* Message */}
            <h3 className="text-base font-bold text-white mb-2">Are you sure?</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              {confirmDialog.message}
            </p>

            {/* Buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={confirmDialog.onCancel}
                className="flex-grow bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 text-gray-300 hover:text-white font-bold py-2.5 rounded-xl transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-grow bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-2.5 rounded-xl transition duration-150 cursor-pointer text-xs uppercase tracking-wider hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

