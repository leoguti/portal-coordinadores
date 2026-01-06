"use client";

import { useState } from "react";

interface ProxiedImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export default function ProxiedImage({ src, alt, className, onClick }: ProxiedImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const proxiedSrc = `/api/image-proxy?url=${encodeURIComponent(src)}`;

  if (error) {
    return (
      <div className={`${className} bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center`}>
        <span className="text-red-400 text-2xl mb-1">⚠️</span>
        <span className="text-red-600 text-xs text-center px-2">Error cargando imagen</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className={`${className} bg-gray-200 animate-pulse`} />
      )}
      <img
        src={proxiedSrc}
        alt={alt}
        className={`${className} ${loading ? 'hidden' : ''}`}
        onClick={onClick}
        onLoad={() => setLoading(false)}
        onError={(e) => {
          console.error("❌ Failed to load image:", {
            proxiedSrc,
            originalSrc: src,
            target: e.currentTarget.src
          });
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
}
