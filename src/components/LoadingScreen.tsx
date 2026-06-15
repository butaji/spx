import SPXIcon from "./SPX-icon.svg?url";

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        {/* Animated logo / waveform */}
        <div className="loading-logo-wrap">
          <div className="loading-logo">
            <img src={SPXIcon} alt="SPX" draggable={false} />
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
