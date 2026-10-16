import React from 'react';
import { MEDISTOCK_AI_DEMO_EMBED_URL, isValidEmbedUrl, formatEmbedUrl } from '../config/videoConfig';

interface VideoEmbedProps {
  embedUrl?: string;
  title: string;
  description: string;
  className?: string;
}

export function VideoEmbed({
  embedUrl = MEDISTOCK_AI_DEMO_EMBED_URL,
  title,
  description,
  className = '',
}: VideoEmbedProps) {
  const hasValidUrl = embedUrl && isValidEmbedUrl(embedUrl);
  const formattedSrc = hasValidUrl ? formatEmbedUrl(embedUrl) : '';

  if (hasValidUrl) {
    // Render actual video embed
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#0f172a',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-2xl)',
        }}
      >
        <iframe
          src={formattedSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </div>
    );
  }

  // Render premium placeholder
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: 'var(--radius-2xl)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'var(--shadow-2xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'default',
      }}
      role="img"
      aria-label={`${title} - ${description}`}
    >
      {/* Subtle grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(79, 70, 229, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79, 70, 229, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: 0.5,
        }}
        aria-hidden="true"
      />

      {/* Glow effect */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(79, 70, 229, 0.3) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        aria-hidden="true"
      />

      {/* Play button */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-ai-600) 0%, var(--color-ai-700) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(79, 70, 229, 0.4)',
          border: '2px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <svg width={32} height={32} viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>

      {/* Label */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 24, textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: 8 }}>
          {title}
        </p>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
          {description}
        </p>
      </div>
    </div>
  );
}
