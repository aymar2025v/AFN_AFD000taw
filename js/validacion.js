const EPSILON = 'ε';

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

// Tokeniza la cadena respetando símbolos multi-carácter (por si acaso).
// Si un carácter no pertenece a Σ, se emite como token suelto (no reconocido).
function tokenizar(cadena, alfabeto) {
    const ordenado = [...alfabeto].sort((a, b) => b.length - a.length);
    const tokens = [];
    let i = 0;
    while (i < cadena.length) {
        let encontrado = false;
        for (const s of ordenado) {
            if (s && cadena.startsWith(s, i)) {
                tokens.push({ valor: s, reconocido: true });
                i += s.length;
                encontrado = true;
                break;
            }
        }
        if (!encontrado) {
            tokens.push({ valor: cadena[i], reconocido: false });
            i++;
        }
    }
    return tokens;
}

// ---------- API pública ----------

export function validarCadena(nfa, cadena) {
    const inicial = nfa.estadoInicial();
    if (!inicial) {
        return { aceptada: false, error: 'El NFA no tiene estado inicial marcado.' };
    }
    const alfabeto = nfa.calcularAlfabeto();

    // Estado inicial = ε-clausura({inicial})
    let actuales = epsilonClausura(nfa, [inicial.id]);
    const pasos = [];
    pasos.push({
        etiqueta: `ε-clausura(${inicial.id})`,
        conjunto: [...actuales].sort(),
        tipo: 'inicial',
    });

    const tokens = tokenizar(cadena, alfabeto);
    let muerto = false;

    for (const tok of tokens) {
        if (muerto) {
            pasos.push({
                etiqueta: `leer '${tok.valor}'`,
                conjunto: [],
                tipo: 'muerto',
                reconocido: tok.reconocido,
            });
            continue;
        }

        const mov = mover(nfa, actuales, tok.valor);
        if (mov.size === 0) {
            muerto = true;
            pasos.push({
                etiqueta: `leer '${tok.valor}'`,
                conjunto: [],
                tipo: 'muerto',
                reconocido: tok.reconocido,
            });
            continue;
        }

        actuales = epsilonClausura(nfa, mov);
        pasos.push({
            etiqueta: `leer '${tok.valor}'`,
            conjunto: [...actuales].sort(),
            tipo: 'paso',
            reconocido: tok.reconocido,
        });
    }

    const finales = new Set(nfa.estadosFinales().map(e => e.id));
    const aceptada = !muerto && [...actuales].some(id => finales.has(id));

    return {
        aceptada,
        cadena,
        pasos,
        estadoFinal: [...actuales].sort(),
    };
}