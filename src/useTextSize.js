import { useEffect, useState } from 'react';

// Tamaño de letra elegido por la persona; se recuerda entre sesiones.
export const TEXT_SIZES = [
  { id: 'normal', label: 'Normal', percent: 112.5 },
  { id: 'large', label: 'Grande', percent: 131.25 },
  { id: 'xlarge', label: 'Muy grande', percent: 150 },
];

const KEY = 'venova.textSize';

const readSaved = () => {
  try {
    const id = localStorage.getItem(KEY);
    const idx = TEXT_SIZES.findIndex((s) => s.id === id);
    return idx >= 0 ? idx : 0;
  } catch {
    return 0;
  }
};

export function useTextSize() {
  const [index, setIndex] = useState(readSaved);

  useEffect(() => {
    document.documentElement.style.fontSize = `${TEXT_SIZES[index].percent}%`;
    try { localStorage.setItem(KEY, TEXT_SIZES[index].id); } catch { /* sin almacenamiento: no pasa nada */ }
  }, [index]);

  return {
    size: TEXT_SIZES[index],
    canShrink: index > 0,
    canGrow: index < TEXT_SIZES.length - 1,
    shrink: () => setIndex((i) => Math.max(0, i - 1)),
    grow: () => setIndex((i) => Math.min(TEXT_SIZES.length - 1, i + 1)),
  };
}
