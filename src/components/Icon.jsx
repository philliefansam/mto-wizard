import React from 'react';

/**
 * Google Material Symbols Rounded Icon Component
 * https://fonts.google.com/icons
 */
export default function Icon({ name, className = '', filled = false, style = {} }) {
  return (
    <span
      className={`material-symbols-rounded ${filled ? 'filled' : ''} ${className}`}
      style={style}
    >
      {name}
    </span>
  );
}
