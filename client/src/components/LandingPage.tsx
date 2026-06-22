import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />

      {/* Main Hero & Description */}
      <main className="flex-grow flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto z-10 my-16">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
          Explore Music{' '}
          <span className="bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400 bg-clip-text text-transparent">
            Visually
          </span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
          Navigate the connections between your favorite artists. Discover new music through an interactive, expanding map instead of static playlists.
        </p>

        {/* CTA Button */}
        <button
          onClick={onStart}
          className="group relative px-10 py-4.5 bg-green-500 hover:bg-green-400 text-black font-bold text-lg rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_35px_rgba(34,197,94,0.6)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-slate-950 cursor-pointer"
        >
          Start Exploring
        </button>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24 text-left">
          {/* Feature 1 */}
          <div className="group bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-7 transition-all duration-300 hover:border-green-500/30 hover:bg-white/10 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-5 group-hover:bg-green-500/20 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-green-400 transition-colors">Artist Search</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Find any artist to anchor your exploration. Search feeds directly from Spotify to provide instant metadata, genres, and popularity stats.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-7 transition-all duration-300 hover:border-green-500/30 hover:bg-white/10 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-5 group-hover:bg-green-500/20 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <line x1="12" y1="8" x2="6.5" y2="16.5" />
                <line x1="12" y1="8" x2="17.5" y2="16.5" />
                <line x1="8" y1="19" x2="16" y2="19" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-green-400 transition-colors">Interactive Graph</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Pan, zoom, drag, and connect artists dynamically. Construct your custom musical web on a rich, interactive canvas.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-7 transition-all duration-300 hover:border-green-500/30 hover:bg-white/10 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-5 group-hover:bg-green-500/20 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 10l12-3" />
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-green-400 transition-colors">Endless Discovery</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Click nodes to automatically pull up detailed artist portfolios and dynamically branch out their most similar and related artists.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-gray-500 border-t border-white/5 z-10">
        &copy; {new Date().getFullYear()} Music Discovery Map. Powered by Spotify API.
      </footer>
    </div>
  );
};
