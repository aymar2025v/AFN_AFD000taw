import { Automata } from './automata.js';

const EPSILON = 'ε';

// ---------- Helpers de conjuntos ----------

function epsilonClausura(nfa, ids) {
    const resultado = new Set(ids);
    const pendientes = [...ids];
    while (pendientes.length) {
        const actual = pendientes.pop();
        nfa.transiciones
            .filter(t => t.desde === actual && t.simbolo === EPSILON)
            .forEach(t => {
                if (!resultado.has(t.hacia)) {
                    resultado.add(t.hacia);
                    pendientes.push(t.hacia);
                }
            });
    }
    return resultado;
}

function mover(nfa, ids, simbolo) {
    const resultado = new Set();
    ids.forEach(id => {
        nfa.transiciones
            .filter(t => t.desde === id && t.simbolo === simbolo)
            .forEach(t => resultado.add(t.hacia));
    });
    return resultado;
}

function claveDe(ids) {
    return [...ids].sort().join(',');
}

function nombrar(ids) {
    if (ids.length === 0) return '∅';
    return '{' + [...ids].sort().join(',') + '}';
}

function radioParaLabel(label) {
    // Los nombres son cortos pero pueden crecer: ∅, {q0}, {q0,q1,q2,q3}
    return Math.max(22, Math.min(50, 6 + label.length * 3.5));
}

// ---------- Construcción ----------

export function construirDFACompleto(nfa) {
    const Q = nfa.estados.map(e => e.id).sort();
    const alfabeto = nfa.calcularAlfabeto();
    const inicialId = nfa.estadoInicial() ? nfa.estadoInicial().id : null;
    const finales = new Set(nfa.estadosFinales().map(e => e.id));

    if (Q.length === 0) throw new Error('El NFA no tiene estados.');
    if (alfabeto.length === 0) throw new Error('El NFA no tiene símbolos en sus transiciones.');

    const totalSubsets = 1 << Q.length;
    if (totalSubsets > 64) {
        throw new Error(
            `El conjunto potencia tendría ${totalSubsets} estados ` +
            `(2^${Q.length}). Demasiado para dibujar con claridad.`
        );
    }

    // Todos los subconjuntos vía máscara de bits
    const subsets = [];
    for (let mask = 0; mask < totalSubsets; mask++) {
        subsets.push(Q.filter((_, i) => mask & (1 << i)));
    }

    // Ordenar por cardinalidad y luego alfabéticamente (para dibujar ordenado)
    subsets.sort((a, b) =>
        a.length - b.length || a.join(',').localeCompare(b.join(','))
    );

    const dfa = new Automata();
    dfa.alfabeto = alfabeto;

    const clausuraInicial = inicialId ? epsilonClausura(nfa, [inicialId]) : new Set();
    const claveInicial = claveDe(clausuraInicial);

    const mapa = new Map(); // clave -> Estado

    // Crear todos los estados
    subsets.forEach(ids => {
        const label = nombrar(ids);
        const estado = dfa.agregarEstado({
            id: label,
            x: 0, y: 0,
            radio: radioParaLabel(label),
            inicial: claveDe(ids) === claveInicial,
            final: ids.some(id => finales.has(id)),
        });
        mapa.set(claveDe(ids), estado);
    });

    // Crear todas las transiciones
    subsets.forEach(ids => {
        const desdeLabel = nombrar(ids);
        alfabeto.forEach(simbolo => {
            const mov = mover(nfa, ids, simbolo);
            const destinoIds = mov.size === 0
                ? []
                : [...epsilonClausura(nfa, mov)].sort();
            const destino = mapa.get(claveDe(destinoIds));
            if (destino) {
                dfa.agregarTransicion(desdeLabel, destino.id, simbolo);
            }
        });
    });

    return dfa;
}

// ---------- Layout en capas concéntricas ----------

export function layoutPorCapas(dfa, canvasWidth, canvasHeight) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    // Agrupar por cardinalidad
    const grupos = new Map();
    dfa.estados.forEach(e => {
        const card = (e.id.match(/q\d+/g) || []).length; // ∅ → 0
        if (!grupos.has(card)) grupos.set(card, []);
        grupos.get(card).push(e);
    });

    const cards = [...grupos.keys()].sort((a, b) => a - b);
    const radiosMax = {};
    cards.forEach(c => {
        radiosMax[c] = Math.max(...grupos.get(c).map(e => e.radio), 0);
    });

    let rAnterior = 0;
    let rAnteriorMax = 0;

    cards.forEach((card, idx) => {
        const estados = grupos.get(card);
        const rMax = radiosMax[card];
        const n = estados.length;

        // Estado vacío (cardinalidad 0) → centro
        if (card === 0) {
            estados[0].x = cx;
            estados[0].y = cy;
            rAnterior = 0;
            rAnteriorMax = rMax;
            return;
        }

        // Radio mínimo para que no se toquen entre ellos
        const perim = estados.reduce((s, e) => s + 2 * e.radio + 20, 0);
        const rPorPerim = n > 1 ? perim / (2 * Math.PI) : 0;

        // Radio mínimo para separarse de la capa anterior
        const rMin = rAnterior + rAnteriorMax + rMax + 25;

        const rCapa = Math.max(rMin, rPorPerim, 70);
        rAnterior = rCapa;
        rAnteriorMax = rMax;

        estados.forEach((e, i) => {
            const ang = (2 * Math.PI * i) / n - Math.PI / 2;
            e.x = cx + Math.cos(ang) * rCapa;
            e.y = cy + Math.sin(ang) * rCapa;
        });
    });

    // Ajuste final: escalar posiciones (no radios) para que quepa
    const margen = 30;
    const minX = Math.min(...dfa.estados.map(e => e.x - e.radio));
    const maxX = Math.max(...dfa.estados.map(e => e.x + e.radio));
    const minY = Math.min(...dfa.estados.map(e => e.y - e.radio));
    const maxY = Math.max(...dfa.estados.map(e => e.y + e.radio));

    const ancho = Math.max(1, maxX - minX);
    const alto  = Math.max(1, maxY - minY);
    const escala = Math.min(
        1,
        (canvasWidth  - 2 * margen) / ancho,
        (canvasHeight - 2 * margen) / alto
    );

    if (escala < 1) {
        dfa.estados.forEach(e => {
            e.x = cx + (e.x - cx) * escala;
            e.y = cy + (e.y - cy) * escala;
        });
    }
}