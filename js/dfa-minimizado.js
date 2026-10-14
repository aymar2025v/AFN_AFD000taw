import { Automata } from './automata.js';

export function minimizarDFA(dfa) {
    const alfabeto = dfa.alfabeto;
    const alcanzables = alcanzablesDesde(dfa);

    // 1. Partición inicial: finales vs no finales (solo alcanzables)
    const finales = [];
    const noFinales = [];
    dfa.estados.forEach(e => {
        if (!alcanzables.has(e.id)) return;
        (e.final ? finales : noFinales).push(e.id);
    });

    let particiones = [];
    if (noFinales.length) particiones.push(new Set(noFinales));
    if (finales.length) particiones.push(new Set(finales));

    // 2. Refinar hasta que sea estable
    let cambio = true;
    while (cambio) {
        cambio = false;
        const nuevas = [];
        for (const bloque of particiones) {
            const subgrupos = refinarBloque(bloque, particiones, dfa, alfabeto);
            if (subgrupos.length > 1) cambio = true;
            subgrupos.forEach(s => nuevas.push(s));
        }
        particiones = nuevas;
    }

    // 3. Mapa id-original → índice de bloque
    const bloqueDe = new Map();
    particiones.forEach((b, i) => b.forEach(id => bloqueDe.set(id, i)));

    // 4. Nombres A, B, C, ..., Z, A1, ...
    const letras = generarLetras(particiones.length);
    const idInicial = dfa.estadoInicial().id;
    const bloqueInicial = bloqueDe.get(idInicial);

    // 5. Construir el DFA minimizado
    const dfaMin = new Automata();
    dfaMin.alfabeto = [...alfabeto];

    const estadosPorBloque = new Map();
    particiones.forEach((bloque, i) => {
        const id = letras[i];
        const final = [...bloque].some(eid => dfa.buscarEstado(eid).final);
        const inicial = (i === bloqueInicial);
        const estado = dfaMin.agregarEstado({
            id, x: 0, y: 0, radio: 40, inicial, final,
        });
        estadosPorBloque.set(i, estado);
    });

    // 6. Transiciones: un representante por bloque
    particiones.forEach((bloque, i) => {
        const representante = [...bloque][0];
        dfa.transiciones
            .filter(t => t.desde === representante)
            .forEach(t => {
                const bDest = bloqueDe.get(t.hacia);
                dfaMin.agregarTransicion(letras[i], letras[bDest], t.simbolo);
            });
    });

    // 7. Correspondencia para la tabla
    const correspondencia = particiones.map((bloque, i) => ({
        id: letras[i],
        miembros: [...bloque].sort(),
        inicial: i === bloqueInicial,
        final: [...bloque].some(eid => dfa.buscarEstado(eid).final),
    }));

    return { dfa: dfaMin, correspondencia };
}

// ---------- Helpers ----------

function alcanzablesDesde(dfa) {
    const inicial = dfa.estadoInicial();
    const visitados = new Set([inicial.id]);
    const pendientes = [inicial.id];
    while (pendientes.length) {
        const actual = pendientes.pop();
        dfa.transiciones
            .filter(t => t.desde === actual)
            .forEach(t => {
                if (!visitados.has(t.hacia)) {
                    visitados.add(t.hacia);
                    pendientes.push(t.hacia);
                }
            });
    }
    return visitados;
}

function refinarBloque(bloque, particiones, dfa, alfabeto) {
    const bloqueDe = new Map();
    particiones.forEach((b, i) => b.forEach(id => bloqueDe.set(id, i)));

    const grupos = new Map();
    for (const id of bloque) {
        const firma = alfabeto.map(s => {
            const t = dfa.transiciones.find(t => t.desde === id && t.simbolo === s);
            return t ? bloqueDe.get(t.hacia) : -1;
        }).join('|');

        if (!grupos.has(firma)) grupos.set(firma, new Set());
        grupos.get(firma).add(id);
    }
    return [...grupos.values()];
}

function generarLetras(n) {
    const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const out = [];
    for (let i = 0; i < n; i++) {
        const capa = Math.floor(i / 26);
        const idx = i % 26;
        out.push(L[idx] + (capa > 0 ? capa : ''));
    }
    return out;
}