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

  // New Details State
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [similarArtists, setSimilarArtists] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audio] = useState(() => new Audio());

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
      // Set basic structure so panel slides open right away
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
          // If the node already exists, ensure there is an edge
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

  if (view === 'landing') {
    return <LandingPage onStart={() => setView('map')} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-white">
      {/* Header / Search */}
      <header className="p-4 bg-gray-800 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-green-500">Music Discovery Map</h1>
          <button 
            onClick={() => setView('landing')} 
            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white transition font-medium cursor-pointer"
          >
            ← Back to Home
          </button>
        </div>
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
      </header>

      {/* Main Content */}
      <main className="flex-grow flex relative overflow-hidden">
        <div className="flex-grow h-full">
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
            <p className="text-gray-500 text-xl">Search and add an artist to start your map</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

