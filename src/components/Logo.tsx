import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'icon';
}

export const Logo: React.FC<LogoProps> = ({ className, size = 40, variant = 'full' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div 
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center shrink-0"
      >
        {/* Main Circular Background */}
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xl"
        >
          <circle cx="50" cy="50" r="48" fill="#2563eb" />
          <circle cx="50" cy="50" r="44" stroke="white" strokeWidth="2" strokeDasharray="2 4" opacity="0.3" />
          
          {/* Building/Hospital Silhouette */}
          <path
            d="M30 45H70V75H30V45Z"
            fill="white"
            fillOpacity="0.2"
          />
          <path
            d="M45 35H55V45H45V35Z"
            fill="white"
            fillOpacity="0.3"
          />
          
          {/* Cross Icon */}
          <rect x="47" y="37" width="6" height="2" fill="white" />
          <rect x="49" y="35" width="2" height="6" fill="white" />

          {/* Bottom Banner/Curve */}
          <path
            d="M10 70C20 85 80 85 90 70"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>

        {/* Shield with Checkmark (Floating) */}
        <div className="absolute -right-1 -bottom-1 w-1/2 h-1/2 bg-white rounded-lg shadow-lg flex items-center justify-center border-2 border-blue-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-blue-600"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
      </div>

      {variant === 'full' && (
        <div className="flex flex-col">
          <span className="text-xl font-black text-white tracking-tighter leading-none">
            Mant <span className="text-blue-500">SC Pro</span>
          </span>
        </div>
      )}
    </div>
  );
};
