export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        {/* Animated logo / waveform */}
        <div className="loading-logo-wrap">
          <div className="loading-logo">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Stylized S with audio wave */}
              <path
                className="loading-logo-path"
                d="M85 35C75 25 60 25 50 35C40 45 40 60 50 70L60 80C70 90 85 90 95 80C105 70 105 55 95 45"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              {/* Audio wave bars */}
              <rect className="loading-bar loading-bar-1" x="20" y="85" width="8" height="20" rx="2" />
              <rect className="loading-bar loading-bar-2" x="34" y="78" width="8" height="27" rx="2" />
              <rect className="loading-bar loading-bar-3" x="48" y="70" width="8" height="35" rx="2" />
              <rect className="loading-bar loading-bar-4" x="62" y="75" width="8" height="30" rx="2" />
              <rect className="loading-bar loading-bar-5" x="76" y="80" width="8" height="25" rx="2" />
            </svg>
          </div>
          {/* Glow ring */}
          <div className="loading-glow" />
        </div>

        {/* Equalizer bars */}
        <div className="loading-equalizer">
          <span className="eq-bar eq-bar-1" />
          <span className="eq-bar eq-bar-2" />
          <span className="eq-bar eq-bar-3" />
          <span className="eq-bar eq-bar-4" />
          <span className="eq-bar eq-bar-5" />
          <span className="eq-bar eq-bar-6" />
          <span className="eq-bar eq-bar-7" />
        </div>

        {/* App name */}
        <h1 className="loading-title">SPX</h1>

        {/* Status text */}
        <p className="loading-status">Restoring session<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span></p>
      </div>

      {/* Background gradient orbs */}
      <div className="loading-orb loading-orb-1" />
      <div className="loading-orb loading-orb-2" />
    </div>
  );
}
