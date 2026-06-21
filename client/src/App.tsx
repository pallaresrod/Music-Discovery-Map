import React, { useState } from 'react';
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

const API_BASE_URL = 'http://localhost:5001/api';

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);

  const onNodesChange: OnNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange: OnEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

  const onNodeClick = async (_event: React.MouseEvent, node: Node) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/artists/${node.id}`);
      setSelectedArtist(response.data);
    } catch (error) {
      console.error('Error getting artist details', error);
    }
  };

  const expandArtist = async (artistId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/artists/${artistId}/similar`);
      const similarArtists = response.data.slice(0, 5);
      
      const sourceNode = nodes.find(n => n.id === artistId);
      if (!sourceNode) return;

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      similarArtists.forEach((artist: any, index: number) => {
        if (nodes.find(n => n.id === artist.id)) return;

        const angle = (index / similarArtists.length) * 2 * Math.PI;
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

  const addArtistToGraph = (artist: any) => {
    const newNode: Node = {
      id: artist.id,
      data: { label: artist.name },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      style: { background: '#1db954', color: '#fff', borderRadius: '8px', padding: '10px' }
    };
    setNodes((nds) => [...nds, newNode]);
    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-white">
      {/* Header / Search */}
      <header className="p-4 bg-gray-800 flex items-center justify-between shadow-md z-10">
        <h1 className="text-2xl font-bold text-green-500">Music Discovery Map</h1>
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
        {selectedArtist && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 p-6 overflow-y-auto shadow-2xl z-20">
            <button 
              onClick={() => setSelectedArtist(null)}
              className="mb-4 text-gray-400 hover:text-white"
            >
              ✕ Close
            </button>
            {selectedArtist.images && selectedArtist.images[0] && (
              <img 
                src={selectedArtist.images[0].url} 
                alt={selectedArtist.name} 
                className="w-full h-48 object-cover rounded-lg mb-4 shadow-lg" 
              />
            )}
            <h2 className="text-2xl font-bold mb-2">{selectedArtist.name}</h2>
            <div className="flex flex-wrap gap-1 mb-4">
              {selectedArtist.genres.slice(0, 3).map((genre: string) => (
                <span key={genre} className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                  {genre}
                </span>
              ))}
            </div>
            <div className="mb-6">
              <span className="text-green-500 font-semibold">Popularity: </span>
              <span>{selectedArtist.popularity}%</span>
            </div>
            
            <button 
              onClick={() => expandArtist(selectedArtist.id)}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition mb-4 shadow-lg"
            >
              Expand Related Artists
            </button>

            <a 
              href={selectedArtist.external_urls.spotify} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-center text-sm text-gray-400 hover:text-green-500"
            >
              Open in Spotify ↗
            </a>
          </div>
        )}
        
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
