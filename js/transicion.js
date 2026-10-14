import { dibujarPunta, dibujarEtiqueta } from './lienzo.js';

export class Transicion {
    constructor(desde, hacia, simbolo) {
        this.desde = desde;   // id del estado origen
        this.hacia = hacia;   // id del estado destino
        this.simbolo = simbolo;
    }
}

// ---------- Dibujo ----------

function dibujarFlechaRecta(ctx, e1, e2) {
    const ang = Math.atan2(e2.y - e1.y, e2.x - e1.x);
    const sx = e1.x + Math.cos(ang) * e1.radio;
    const sy = e1.y + Math.sin(ang) * e1.radio;
    const ex = e2.x - Math.cos(ang) * e2.radio;
    const ey = e2.y - Math.sin(ang) * e2.radio;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    dibujarPunta(ctx, ex, ey, ang);
    return { x: (sx + ex) / 2, y: (sy + ey) / 2 };
}

function dibujarFlechaCurva(ctx, e1, e2, curvatura) {
    const ang = Math.atan2(e2.y - e1.y, e2.x - e1.x);
    const mx = (e1.x + e2.x) / 2;
    const my = (e1.y + e2.y) / 2;
    const cx = mx + Math.cos(ang + Math.PI / 2) * curvatura;
    const cy = my + Math.sin(ang + Math.PI / 2) * curvatura;

    const angIni = Math.atan2(cy - e1.y, cx - e1.x);
    const sx = e1.x + Math.cos(angIni) * e1.radio;
    const sy = e1.y + Math.sin(angIni) * e1.radio;

    const angFin = Math.atan2(cy - e2.y, cx - e2.x);
    const ex = e2.x + Math.cos(angFin) * e2.radio;
    const ey = e2.y + Math.sin(angFin) * e2.radio;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    dibujarPunta(ctx, ex, ey, Math.atan2(ey - cy, ex - cx));

    return {
        x: 0.25 * sx + 0.5 * cx + 0.25 * ex,
        y: 0.25 * sy + 0.5 * cy + 0.25 * ey,
    };
}

function dibujarSelfLoop(ctx, estado) {
    const { x, y, radio } = estado;
    const apertura = 18, ancho = 60, alto = 50;
    const yBase = y - Math.sqrt(radio * radio - apertura * apertura);
    const x1 = x - apertura, x2 = x + apertura;

    ctx.beginPath();
    ctx.moveTo(x1, yBase);
    ctx.bezierCurveTo(x - ancho, yBase - alto,
                      x + ancho, yBase - alto,
                      x2, yBase);
    ctx.stroke();

    dibujarPunta(ctx, x2, yBase, Math.atan2(alto, -ancho + apertura));

    return { x, y: 0.25 * yBase + 0.75 * (yBase - alto) };
}

// ---------- Agrupación ----------

function agrupar(transiciones) {
    const grupos = new Map();
    transiciones.forEach(t => {
        const k = `${t.desde}|${t.hacia}`;
        if (!grupos.has(k)) {
            grupos.set(k, { desde: t.desde, hacia: t.hacia, simbolos: [] });
        }
        grupos.get(k).simbolos.push(t.simbolo);
    });
    return Array.from(grupos.values());
}

function hayReversa(transiciones, desde, hacia) {
    return transiciones.some(t => t.desde === hacia && t.hacia === desde);
}

// ---------- API pública ----------

// Dibuja todas las transiciones agrupadas. Devuelve un array con
// { desde, hacia, x, y } de cada etiqueta, para hit-testing.
export function dibujarTransiciones(ctx, transiciones, buscarEstado) {
    const posiciones = [];

    agrupar(transiciones).forEach(g => {
        const origen = buscarEstado(g.desde);
        const destino = buscarEstado(g.hacia);
        if (!origen || !destino) return;

        let pt;
        if (origen === destino) {
            pt = dibujarSelfLoop(ctx, origen);
        } else if (hayReversa(transiciones, g.desde, g.hacia)) {
            pt = dibujarFlechaCurva(ctx, origen, destino, 45);
        } else {
            pt = dibujarFlechaRecta(ctx, origen, destino);
        }

        // Internamente ε representa la transición vacía; en el lienzo la
        // mostramos como λ, que es la notación solicitada en el editor.
        const etiqueta = g.simbolos.map(s => s === 'ε' ? 'λ' : s).join(', ');
        dibujarEtiqueta(ctx, etiqueta, pt.x, pt.y);
        posiciones.push({ desde: g.desde, hacia: g.hacia, x: pt.x, y: pt.y });
    });

    return posiciones;
}
