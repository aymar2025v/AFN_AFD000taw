import { Automata } from './automata.js';

const EPSILON = 'ε';

// ---------- Operaciones sobre conjuntos de ids ----------

// ε-clausura de un conjunto: todos los estados alcanzables usando solo ε
function epsilonClausura(nfa, idsIniciales) {
    const resultado = new Set(idsIniciales);
    const pendientes = [...idsIniciales];

    while (pendientes.length > 0) {
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

// mover(S, a): estados alcanzables desde S consumiendo 'a' (sin ε-clausura aún)
function mover(nfa, ids, simbolo) {
    const resultado = new Set();
    ids.forEach(id => {
        nfa.transiciones
            .filter(t => t.desde === id && t.simbolo === simbolo)
            .forEach(t => resultado.add(t.hacia));
    });
    return resultado;
}

// Clave canónica de un conjunto, para usar como key de Map
function claveDeConjunto(ids) {
    return [...ids].sort().join(',');
}

// Nombre visible del estado del DFA a partir de su clave
function nombrarConjunto(clave) {
    return clave ? '{' + clave + '}' : '∅';
}

// Radio apropiado según la longitud del nombre (para que el texto quepa)
function radioParaLabel(label) {
    return Math.max(38, Math.min(120, label.length * 7));
}

// ---------- Eliminación de transiciones λ ----------

// Construye un AFND equivalente sin transiciones vacías.
// δ'(p,a) = ε-clausura(mover(ε-clausura({p}), a)).
export function eliminarTransicionesLambda(afndLambda) {
    const afnd = new Automata();
    const alfabeto = afndLambda.calcularAlfabeto();
    const finalesOriginales = new Set(afndLambda.estadosFinales().map(e => e.id));

    afnd.alfabeto = [...alfabeto];

    // Un estado es final si desde él se alcanza un final usando solo λ.
    afndLambda.estados.forEach(estado => {
        const clausura = epsilonClausura(afndLambda, [estado.id]);
        afnd.agregarEstado({
            id: estado.id,
            x: estado.x,
            y: estado.y,
            radio: estado.radio,
            inicial: estado.inicial,
            final: [...clausura].some(id => finalesOriginales.has(id)),
        });
    });

    afndLambda.estados.forEach(estado => {
        const clausuraOrigen = epsilonClausura(afndLambda, [estado.id]);
        alfabeto.forEach(simbolo => {
            const destinos = epsilonClausura(
                afndLambda,
                mover(afndLambda, clausuraOrigen, simbolo)
            );
            destinos.forEach(destino => {
                afnd.agregarTransicion(estado.id, destino, simbolo);
            });
        });
    });

    return afnd;
}

// ---------- Conversión ----------

export function convertirNFAaDFA(nfa) {
    const alfabeto = nfa.calcularAlfabeto();
    const inicialNFA = nfa.estadoInicial();

    if (!inicialNFA) {
        throw new Error('El NFA no tiene estado inicial marcado.');
    }
    if (alfabeto.length === 0) {
        throw new Error('El NFA no tiene símbolos en sus transiciones (solo ε).');
    }

    const dfa = new Automata();
    dfa.alfabeto = alfabeto;

    const mapaConjuntos = new Map();

    // Estructura que alimentará la tabla HTML
    const calculos = {
        alfabeto,
        clausuraInicial: null,
        pasos: [],   // un paso por cada estado del DFA procesado
    };

    // ----- Estado inicial del DFA = ε-clausura({inicial del NFA}) -----
    const conjInicial = epsilonClausura(nfa, [inicialNFA.id]);
    const claveInicial = claveDeConjunto(conjInicial);
    const idInicial = nombrarConjunto(claveInicial);

    calculos.clausuraInicial = {
        estadoNFA: inicialNFA.id,
        clausura: [...conjInicial].sort(),
    };

    dfa.agregarEstado({
        id: idInicial,
        x: 0, y: 0,
        radio: radioParaLabel(idInicial),
        inicial: true,
        final: [...conjInicial].some(id => nfa.buscarEstado(id).final),
    });
    mapaConjuntos.set(claveInicial, idInicial);

    // ----- Worklist -----
    const pendientes = [{ conjunto: conjInicial, idDFA: idInicial }];
    const procesados = new Set();

    while (pendientes.length > 0) {
        const { conjunto, idDFA } = pendientes.shift();
        const claveActual = claveDeConjunto(conjunto);

        if (procesados.has(claveActual)) continue;
        procesados.add(claveActual);

        const paso = {
            estadoDFA: idDFA,
            conjunto: [...conjunto].sort(),
            porSimbolo: [],
        };

        for (const simbolo of alfabeto) {
            const alcanzables = mover(nfa, conjunto, simbolo);

            // Un DFA completo debe definir una transición por cada símbolo.
            // Cuando mover(S,a)=∅, se crea/usa el estado muerto ∅.
            const clausura = alcanzables.size === 0
                ? new Set()
                : epsilonClausura(nfa, alcanzables);
            const clave = claveDeConjunto(clausura);

            let idDestino = mapaConjuntos.get(clave);
            let esNuevo = false;

            if (!idDestino) {
                idDestino = nombrarConjunto(clave);
                esNuevo = true;
                dfa.agregarEstado({
                    id: idDestino,
                    x: 0, y: 0,
                    radio: radioParaLabel(idDestino),
                    inicial: false,
                    final: [...clausura].some(id => nfa.buscarEstado(id)?.final),
                });
                mapaConjuntos.set(clave, idDestino);
                pendientes.push({ conjunto: clausura, idDFA: idDestino });
            }

            dfa.agregarTransicion(idDFA, idDestino, simbolo);

            paso.porSimbolo.push({
                simbolo,
                mover: [...alcanzables].sort(),
                clausura: [...clausura].sort(),
                destino: idDestino,
                esNuevo,
            });
        }

        calculos.pasos.push(paso);
    }

    return { dfa, calculos };
}

// ---------- Layout ----------

export function aplicarLayoutCircular(automata, canvasWidth, canvasHeight) {
    const n = automata.estados.length;
    if (n === 0) return;

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    if (n === 1) {
        automata.estados[0].x = cx;
        automata.estados[0].y = cy;
        return;
    }

    // Ordenar: inicial primero, resto por radio ascendente
    const inicial = automata.estados.find(e => e.inicial);
    const resto = automata.estados.filter(e => e !== inicial).sort((a, b) => a.radio - b.radio);
    const lista = inicial ? [inicial, ...resto] : resto;

    const rMin = Math.min(...lista.map(e => e.radio));
    const rMax = Math.max(...lista.map(e => e.radio));
    const dispares = rMax > rMin * 1.5 && n >= 4;

    if (!dispares) {
        // ---- Una sola órbita ----
        const rOrbita = Math.max(
            80,
            Math.min(canvasWidth, canvasHeight) / 2 - rMax - 40
        );
        lista.forEach((e, i) => {
            const ang = (2 * Math.PI * i) / n - Math.PI / 2;
            e.x = cx + Math.cos(ang) * rOrbita;
            e.y = cy + Math.sin(ang) * rOrbita;
        });
        return;
    }

    // ---- Dos órbitas: chicos dentro, grandes fuera ----
    const umbral = (rMin + rMax) / 2;
    const chicos = lista.filter(e => e.radio <= umbral);
    const grandes = lista.filter(e => e.radio > umbral);

    const rMaxChico = Math.max(...chicos.map(e => e.radio), 0);
    const rMaxGrande = Math.max(...grandes.map(e => e.radio), 0);

    // Radio mínimo interior por perímetro disponible
    const perimChicos = chicos.reduce((s, e) => s + 2 * e.radio + 15, 0);
    const rIntMin = perimChicos / (2 * Math.PI);
    const rInterior = Math.max(80, rIntMin, rMaxChico + 30);

    // Radio mínimo exterior
    const perimGrandes = grandes.reduce((s, e) => s + 2 * e.radio + 20, 0);
    const rExtMin = perimGrandes / (2 * Math.PI);
    const rExterior = Math.max(
        rInterior + rMaxChico + rMaxGrande + 30,
        rExtMin
    );

    chicos.forEach((e, i) => {
        const ang = (2 * Math.PI * i) / chicos.length - Math.PI / 2;
        e.x = cx + Math.cos(ang) * rInterior;
        e.y = cy + Math.sin(ang) * rInterior;
    });
    grandes.forEach((e, i) => {
        const ang = (2 * Math.PI * i) / grandes.length - Math.PI / 2;
        e.x = cx + Math.cos(ang) * rExterior;
        e.y = cy + Math.sin(ang) * rExterior;
    });
}
