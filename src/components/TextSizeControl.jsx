import React from 'react';

export default function TextSizeControl({ textSize }) {
  return (
    <div className="textsize" role="group" aria-label="Tamaño de letra">
      <span className="textsize-label">Letra</span>
      <button type="button" className="btn btn-sm" onClick={textSize.shrink} disabled={!textSize.canShrink} aria-label="Letra más pequeña" title="Letra más pequeña">
        <span className="textsize-a small">A</span>
      </button>
      <button type="button" className="btn btn-sm" onClick={textSize.grow} disabled={!textSize.canGrow} aria-label="Letra más grande" title="Letra más grande">
        <span className="textsize-a big">A</span>
      </button>
    </div>
  );
}
