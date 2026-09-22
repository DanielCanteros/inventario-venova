import React, { useEffect, useRef, useState } from 'react';

/**
 * Envuelve una <table class="table table-cards"> y la apila en "tarjetas" (una fila = un
 * bloque, cada dato con su etiqueta) apenas no entra en el ancho disponible.
 *
 * No usamos un punto de quiebre fijo en píxeles de ventana: con letra grande la tabla puede
 * no entrar aunque la ventana sea ancha, y con letra chica puede entrar aunque la ventana sea
 * angosta. En vez de adivinar, medimos si el contenido realmente desborda (scrollWidth >
 * clientWidth). Importante: cuando eso pasa, el ancho de la caja que envuelve la tabla NO
 * cambia (por eso aparece la barra de scroll), así que ResizeObserver por sí solo no alcanza
 * — también reaccionamos a cambios de contenido (filas cargadas) y de tamaño de letra.
 */
export default function ResponsiveTable({ children }) {
  const ref = useRef(null);
  const [stacked, setStacked] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 900 : false));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = requestAnimationFrame(() => setStacked(el.scrollWidth > el.clientWidth + 1));
    };
    check();

    const observers = [];
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(check); // cambios de ventana/columna disponible
      ro.observe(el);
      observers.push(ro);
    }
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(check); // filas que llegan, o cambia el tamaño de letra
      mo.observe(el, { childList: true, subtree: true, characterData: true });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
      observers.push(mo);
    }
    return () => { cancelAnimationFrame(raf); observers.forEach((o) => o.disconnect()); };
  });

  return (
    <div className={`table-wrap ${stacked ? 'is-stacked' : ''}`} ref={ref}>
      {children}
    </div>
  );
}
