import { Automata } from './automata.js';
import { dibujarTransiciones } from './transicion.js';
// import { configurarInteraccion } from './interaccion.js';
import { convertirNFAaDFA, aplicarLayoutCircular } from './nfa-a-dfa.js';
import { minimizarDFA } from './dfa-minimizado.js';
import { Vista } from './vista.js';
import { configurarInteraccion, configurarVistaYArrastre } from './interaccion.js';
import { construirDFACompleto, layoutPorCapas } from './potencias.js';
import { validarCadena } from './validacion.js';

const canvasNFA     = document.getElementById('miCanvas');
const canvasDFA     = document.getElementById('canvasDFA');
const canvasDFAMin  = document.getElementById('canvasDFAMin');
const canvasPotencia = document.getElementById('canvasPotencia');

function prepararCanvas(canvas) {
    return {
        width: Number(canvas.getAttribute('width')),
        height: Number(canvas.getAttribute('height')),
        ratio: window.devicePixelRatio || 1,
    };
}

const dimensionesCanvas = new Map(
    [canvasNFA, canvasDFA, canvasDFAMin, canvasPotencia]
        .map(canvas => [canvas, prepararCanvas(canvas)])
);
const ctxNFA        = canvasNFA.getContext('2d');
const ctxDFA        = canvasDFA.getContext('2d');
const ctxDFAMin     = canvasDFAMin.getContext('2d');

const ctxPotencia    = canvasPotencia.getContext('2d');
const vistaPotencia  = new Vista(canvasPotencia);

const btnConvertir = document.getElementById('btnConvertir');

const inputAlfabeto   = document.getElementById('inputAlfabeto');
const inputEstados    = document.getElementById('inputEstados');
const btnAplicarConfig = document.getElementById('btnAplicarConfig');
const inputCadena     = document.getElementById('inputCadena');
const btnValidar      = document.getElementById('btnValidar');
const resultadoValidacion = document.getElementById('resultadoValidacion');

const vistaNFA    = new Vista(canvasNFA);
const vistaDFA    = new Vista(canvasDFA);
const vistaDFAMin = new Vista(canvasDFAMin);

// ---------- NFA de prueba ----------
const nfa = new Automata();
nfa.agregarEstado({ id: 'q0', x: 100, y: 200, inicial: true });
nfa.agregarEstado({ id: 'q1', x: 240, y: 200 });
nfa.agregarEstado({ id: 'q2', x: 380, y: 200, final: true });
nfa.agregarTransicion('q0', 'q1', 'a');
nfa.agregarTransicion('q1', 'q2', 'b');
nfa.agregarTransicion('q1', 'q1', 'a');

// ---------- Render genérico ----------
function dibujarAutomata(ctx, vista, automata, estadoResaltado = null) {
    const dimensiones = dimensionesCanvas.get(ctx.canvas);
    ctx.setTransform(dimensiones.ratio, 0, 0, dimensiones.ratio, 0, 0);
    ctx.clearRect(0, 0, dimensiones.width, dimensiones.height);
    ctx.strokeStyle = '#2c3e50';
    ctx.fillStyle = '#2c3e50';
    ctx.lineWidth = 2;

    vista.aplicar(ctx);

    const posiciones = dibujarTransiciones(
        ctx,
        automata.transiciones,
        id => automata.buscarEstado(id)
    );
    automata.estados.forEach(e => e.dibujar(ctx, e === estadoResaltado));

    vista.restaurar(ctx);
    return posiciones;
}

const redibujarNFA = (resaltado) => dibujarAutomata(ctxNFA, vistaNFA, nfa, resaltado);

// ---------- Interacción sobre el NFA ----------
const ui = configurarInteraccion({
    canvas: canvasNFA,
    automata: nfa,
    redibujar: redibujarNFA,
    vista: vistaNFA,
});

// Habilita zoom + arrastre en el canvas del DFA y del DFA minimizado.
// (Se usa `let` para poder reasignar los redibujadores cuando el DFA cambie.)
let redibujarDFA = () => {};
let redibujarDFAMin = () => {};

let dfaPotencia = null;
let redibujarPotencia = () => {};

configurarVistaYArrastre({
    canvas: canvasDFA,
    automata: {
        buscarEstadoEnPunto: (x, y) => dfa ? dfa.buscarEstadoEnPunto(x, y) : null,
    },
    redibujar: () => redibujarDFA(),
    vista: vistaDFA,
});

configurarVistaYArrastre({
    canvas: canvasDFAMin,
    automata: {
        buscarEstadoEnPunto: (x, y) => dfaMin ? dfaMin.buscarEstadoEnPunto(x, y) : null,
    },
    redibujar: () => redibujarDFAMin(),
    vista: vistaDFAMin,
});

configurarVistaYArrastre({
    canvas: canvasPotencia,
    automata: {
        buscarEstadoEnPunto: (x, y) =>
            dfaPotencia ? dfaPotencia.buscarEstadoEnPunto(x, y) : null,
    },
    redibujar: () => redibujarPotencia(),
    vista: vistaPotencia,
});

// ---------- Estado del pipeline ----------
let dfa = null;
let dfaMin = null;

const configuracionesCanvas = new Map([
    [canvasNFA, { vista: vistaNFA, automata: () => nfa }],
    [canvasDFA, { vista: vistaDFA, automata: () => dfa }],
    [canvasDFAMin, { vista: vistaDFAMin, automata: () => dfaMin }],
    [canvasPotencia, { vista: vistaPotencia, automata: () => dfaPotencia }],
]);
const vistasGuardadas = new Map();

function encuadrarCanvas(canvas) {
    const configuracion = configuracionesCanvas.get(canvas);
    const automata = configuracion?.automata();
    if (!automata || automata.estados.length === 0) return;

    const dimensiones = dimensionesCanvas.get(canvas);
    const estados = automata.estados;
    const minX = Math.min(...estados.map(estado => estado.x - estado.radio));
    const maxX = Math.max(...estados.map(estado => estado.x + estado.radio));
    const minY = Math.min(...estados.map(estado => estado.y - estado.radio));
    const maxY = Math.max(...estados.map(estado => estado.y + estado.radio));
    const ancho = Math.max(maxX - minX, 1);
    const alto = Math.max(maxY - minY, 1);
    const margen = 64;
    const vista = configuracion.vista;

    vista.escala = Math.min(
        vista.escalaMax,
        Math.max(vista.escalaMin, Math.min(
            (dimensiones.width - margen * 2) / ancho,
            (dimensiones.height - margen * 2) / alto
        ))
    );
    vista.offsetX = dimensiones.width / 2 - ((minX + maxX) / 2) * vista.escala;
    vista.offsetY = dimensiones.height / 2 - ((minY + maxY) / 2) * vista.escala;
}

function redibujarTodosLosCanvas() {
    ui.actualizar();
    redibujarDFA();
    redibujarDFAMin();
    redibujarPotencia();
}

btnConvertir.addEventListener('click', () => {
    try {
        // ---------- 1. NFA → DFA (subconjuntos) ----------
        const { dfa: nuevoDFA, calculos } = convertirNFAaDFA(nfa);
        dfa = nuevoDFA;
        const dimensionesDFA = dimensionesCanvas.get(canvasDFA);
        aplicarLayoutCircular(dfa, dimensionesDFA.width, dimensionesDFA.height);
        vistaDFA.reset();

        redibujarDFA = () => dibujarAutomata(ctxDFA, vistaDFA, dfa);
        redibujarDFA();

        renderizarTabla(calculos);

        // ---------- 2. DFA → DFA minimizado ----------
        const { dfa: nuevoMin, correspondencia } = minimizarDFA(dfa);
        dfaMin = nuevoMin;
        const dimensionesDFAMin = dimensionesCanvas.get(canvasDFAMin);
        aplicarLayoutCircular(dfaMin, dimensionesDFAMin.width, dimensionesDFAMin.height);
        vistaDFAMin.reset();

        redibujarDFAMin = () => dibujarAutomata(ctxDFAMin, vistaDFAMin, dfaMin);
        redibujarDFAMin();

        renderizarTablaMinimizada(correspondencia);

        // ---------- 3. Conjunto potencia completo (2^n) ----------
        try {
            dfaPotencia = construirDFACompleto(nfa);
            const dimensionesPotencia = dimensionesCanvas.get(canvasPotencia);
            layoutPorCapas(dfaPotencia, dimensionesPotencia.width, dimensionesPotencia.height);
            vistaPotencia.reset();

            redibujarPotencia = () =>
                dibujarAutomata(ctxPotencia, vistaPotencia, dfaPotencia);
            redibujarPotencia();
        } catch (err) {
            // Si 2^n es demasiado grande, limpiamos el canvas y avisamos por consola
            const dimensionesPotencia = dimensionesCanvas.get(canvasPotencia);
            ctxPotencia.setTransform(
                dimensionesPotencia.ratio, 0, 0, dimensionesPotencia.ratio, 0, 0
            );
            ctxPotencia.clearRect(0, 0, dimensionesPotencia.width, dimensionesPotencia.height);
            dfaPotencia = null;
            redibujarPotencia = () => {};
            console.warn('Conjunto potencia no dibujado:', err.message);
        }

    } catch (err) {
        alert('No se pudo convertir: ' + err.message);
    }
});

// ---------- Tabla de conversión ----------
function renderizarTabla(calculos) {
    const cont = document.getElementById('tablaContenido');
    const set = arr => arr.length ? '{' + arr.join(', ') + '}' : '∅';

    let html = `
        <div class="tabla-seccion mb-4 rounded-md border-l-4 border-sky-500 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <p><strong>Alfabeto:</strong> <code class="rounded bg-white px-1.5 py-0.5 font-mono text-rose-700">Σ = { ${calculos.alfabeto.join(', ')} }</code></p>
            <p><strong>ε-clausura del estado inicial</strong> =
               <code class="rounded bg-white px-1.5 py-0.5 font-mono text-rose-700">ε-clausura(${calculos.clausuraInicial.estadoNFA}) =
               ${set(calculos.clausuraInicial.clausura)}</code></p>
        </div>
        <table class="tabla-dfa w-full border-collapse text-sm">
            <thead>
                <tr>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">Estado DFA</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">Símbolo</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">mover(S, a)</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">ε-clausura( mover(S, a) )</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">→ Estado DFA</th>
                </tr>
            </thead>
            <tbody>
    `;

    calculos.pasos.forEach(paso => {
        paso.porSimbolo.forEach((fila, i) => {
            html += '<tr class="hover:bg-slate-50">';
            if (i === 0) {
                html += `<td class="estado-dfa border-r-2 border-sky-500 bg-sky-50 px-3 py-2 align-middle font-mono text-sm font-bold text-sky-700" rowspan="${paso.porSimbolo.length}">
                            ${paso.estadoDFA}
                         </td>`;
            }
            html += `<td class="simbolo border-b border-slate-100 px-3 py-2 text-center font-mono text-[13px] font-bold text-rose-700">${fila.simbolo}</td>`;
            html += `<td class="border-b border-slate-100 px-3 py-2 font-mono text-[13px]">${set(fila.mover)}</td>`;
            html += `<td class="border-b border-slate-100 px-3 py-2 font-mono text-[13px]">${set(fila.clausura)}</td>`;
            html += `<td class="destino border-b border-slate-100 px-3 py-2 font-mono text-[13px] font-bold text-emerald-600">${fila.destino || '—'}`;
            if (fila.esNuevo) html += ' <span class="nuevo ml-1.5 inline-block rounded-full bg-amber-500 px-1.5 py-px align-middle font-sans text-[10px] font-bold text-white">nuevo</span>';
            html += '</td></tr>';
        });
    });

    html += '</tbody></table>';
    cont.innerHTML = html;
}

// ---------- Tabla de minimización ----------
function renderizarTablaMinimizada(correspondencia) {
    const cont = document.getElementById('tablaContenido');

    // Se agrega como sección adicional debajo de la tabla de subconjuntos
    const set = arr => '{' + arr.join(', ') + '}';

    let html = `
        <div class="tabla-seccion mb-4 mt-6 rounded-md border-l-4 border-sky-500 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <p><strong>Correspondencia DFA → DFA minimizado</strong></p>
        </div>
        <table class="tabla-dfa tabla-corresp w-full border-collapse text-sm">
            <thead>
                <tr>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">Estado</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">Conjunto de estados del DFA</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">Inicial</th>
                    <th class="bg-slate-700 px-3 py-2.5 text-left font-bold tracking-wide text-white">Final</th>
                </tr>
            </thead>
            <tbody>
    `;

    correspondencia.forEach(c => {
        html += '<tr class="hover:bg-slate-50">';
        html += `<td class="estado-dfa border-b border-slate-100 border-r-2 border-r-sky-500 bg-sky-50 px-3 py-2 align-middle font-mono text-sm font-bold text-sky-700">${c.id}</td>`;
        html += `<td class="border-b border-slate-100 px-3 py-2 font-mono text-[13px]">${set(c.miembros)}</td>`;
        html += `<td class="corresp-inicial border-b border-slate-100 px-3 py-2 text-center font-bold text-emerald-600">${c.inicial ? '✓' : ''}</td>`;
        html += `<td class="corresp-final border-b border-slate-100 px-3 py-2 text-center font-bold text-emerald-600">${c.final ? '✓' : ''}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    cont.insertAdjacentHTML('beforeend', html);
}

// ============================================================
// CONFIGURACIÓN: aplicar Σ y Q
// ============================================================

// Lee "q0, q1, q2" → ['q0','q1','q2']  (tolera comas, espacios, punto y coma)
function parsearLista(texto) {
    return texto
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

// Sincroniza Q con los estados actuales. Conserva los que existan.
function aplicarQ(listaIds) {
    const ids = new Set(listaIds);

    // 1. Borrar los que ya no están
    const aBorrar = nfa.estados.filter(e => !ids.has(e.id));
    aBorrar.forEach(e => nfa.eliminarEstado(e));

    // 2. Agregar los nuevos
    const existentes = new Set(nfa.estados.map(e => e.id));
    const nuevos = [...ids].filter(id => !existentes.has(id));

    if (nuevos.length > 0) {
        // Los repartimos alrededor del centro, formando un círculo
        const dimensionesNFA = dimensionesCanvas.get(canvasNFA);
        const cx = dimensionesNFA.width / 2;
        const cy = dimensionesNFA.height / 2;
        const r = 160;
        nuevos.forEach((id, i) => {
            const ang = (2 * Math.PI * i) / nuevos.length - Math.PI / 2;
            nfa.agregarEstado({
                id,
                x: cx + Math.cos(ang) * r,
                y: cy + Math.sin(ang) * r,
                radio: 40,
            });
        });
    }

    // 3. Si no hay inicial y hay al menos un estado, marcar el primero
    if (!nfa.estados.some(e => e.inicial) && nfa.estados.length > 0) {
        // Mantenemos el orden de la lista del usuario: el primero será inicial
        const primero = listaIds.find(id => nfa.buscarEstado(id));
        if (primero) nfa.buscarEstado(primero).inicial = true;
    }
}

btnAplicarConfig.addEventListener('click', () => {
    const alfabeto = parsearLista(inputAlfabeto.value);
    const estados  = parsearLista(inputEstados.value);

    if (alfabeto.length > 0) {
        nfa.alfabeto = alfabeto;
    } else {
        nfa.alfabeto = [];
    }

    if (estados.length > 0) {
        aplicarQ(estados);
    }

    ui.actualizar();
});

// ============================================================
// VALIDACIÓN DE CADENAS
// ============================================================

function renderizarResultado(res) {
    if (res.error) {
        resultadoValidacion.innerHTML = `
            <div class="resumen error flex items-center gap-3 rounded-md border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-xl font-bold text-amber-700">⚠ ${res.error}</div>
        `;
        return;
    }

    const clase = res.aceptada ? 'aceptada' : 'rechazada';
    const icono = res.aceptada ? '✓' : '✗';
    const verbo = res.aceptada ? 'ACEPTADA' : 'RECHAZADA';
    const mostrarCadena = res.cadena === '' ? 'ε (cadena vacía)' : `"${res.cadena}"`;

    let html = `
        <div class="resumen ${clase} mb-4 flex items-center gap-3 rounded-md border-l-4 px-4 py-3 text-xl font-bold ${res.aceptada ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-rose-500 bg-rose-50 text-rose-800'}">
            <span style="font-size: 26px;">${icono}</span>
            <span>${verbo}</span>
            <span style="font-weight: normal; opacity: 0.7;">— ${mostrarCadena}</span>
        </div>
        <div class="trazo font-mono text-sm text-slate-700">
    `;

    res.pasos.forEach(p => {
        const conjunto = p.conjunto.length === 0
            ? '∅'
            : '{' + p.conjunto.join(', ') + '}';
        html += `
            <div class="linea ${p.tipo} flex items-baseline gap-3 rounded-md border-b border-dashed border-slate-100 px-2.5 py-1.5 ${p.tipo === 'muerto' ? 'bg-rose-50' : p.tipo === 'inicial' ? 'bg-sky-50' : ''}">
                <span class="etiqueta min-w-[180px] font-bold text-slate-400">${p.etiqueta}</span>
                <span class="conjunto font-bold ${p.tipo === 'muerto' ? 'text-rose-700' : 'text-sky-700'}">${conjunto}</span>
            </div>
        `;
    });

    html += '</div>';
    resultadoValidacion.innerHTML = html;
}

btnValidar.addEventListener('click', () => {
    const cadena = inputCadena.value;
    const res = validarCadena(nfa, cadena);
    renderizarResultado(res);
});

inputCadena.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnValidar.click();
});

// ============================================================
// Inicializar los inputs con lo que ya hay en el NFA
// ============================================================
inputAlfabeto.value = nfa.calcularAlfabeto().join(', ');
inputEstados.value  = nfa.estados.map(e => e.id).join(', ');

function actualizarDimensionesCanvas() {
    let cambio = false;
    const ratio = window.devicePixelRatio || 1;

    dimensionesCanvas.forEach((dimensiones, canvas) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const width = rect.width;
        const height = rect.height;
        const anchoBitmap = Math.round(width * ratio);
        const altoBitmap = Math.round(height * ratio);
        if (dimensiones.width === width &&
            dimensiones.height === height &&
            dimensiones.ratio === ratio &&
            canvas.width === anchoBitmap &&
            canvas.height === altoBitmap) {
            return;
        }

        dimensiones.width = width;
        dimensiones.height = height;
        dimensiones.ratio = ratio;
        canvas.width = anchoBitmap;
        canvas.height = altoBitmap;
        cambio = true;
    });

    if (cambio) {
        redibujarTodosLosCanvas();
    }
}

const botonesPantallaCompleta = document.querySelectorAll('.boton-pantalla-completa');
let canvasEnPantallaCompleta = null;
botonesPantallaCompleta.forEach(boton => {
    const panel = boton.closest('.canvas-panel');
    boton.addEventListener('click', async () => {
        try {
            if (document.fullscreenElement === panel) {
                await document.exitFullscreen();
            } else {
                await panel.requestFullscreen();
            }
        } catch (error) {
            console.error('No se pudo cambiar a pantalla completa:', error);
            alert('No se pudo abrir el gráfico en pantalla completa.');
        }
    });
});

function actualizarInterfazPantallaCompleta() {
    const panel = document.fullscreenElement;
    if (panel) {
        const canvas = panel.querySelector('canvas');
        if (canvas && canvas !== canvasEnPantallaCompleta) {
            const vista = configuracionesCanvas.get(canvas).vista;
            vistasGuardadas.set(canvas, {
                escala: vista.escala,
                offsetX: vista.offsetX,
                offsetY: vista.offsetY,
            });
            canvasEnPantallaCompleta = canvas;
        }
    } else if (canvasEnPantallaCompleta) {
        const vista = configuracionesCanvas.get(canvasEnPantallaCompleta).vista;
        const guardada = vistasGuardadas.get(canvasEnPantallaCompleta);
        if (guardada) Object.assign(vista, guardada);
        vistasGuardadas.delete(canvasEnPantallaCompleta);
        canvasEnPantallaCompleta = null;
    }

    botonesPantallaCompleta.forEach(boton => {
        const panel = boton.closest('.canvas-panel');
        const activa = document.fullscreenElement === panel;
        boton.textContent = activa ? '×' : '⛶';
        boton.setAttribute(
            'aria-label',
            activa ? 'Salir de pantalla completa' : 'Ver gráfico en pantalla completa'
        );
        boton.title = activa ? 'Salir de pantalla completa' : 'Ver en pantalla completa';
    });
    requestAnimationFrame(() => {
        actualizarDimensionesCanvas();
        if (canvasEnPantallaCompleta) encuadrarCanvas(canvasEnPantallaCompleta);
        redibujarTodosLosCanvas();
    });
}

document.addEventListener('fullscreenchange', actualizarInterfazPantallaCompleta);
window.addEventListener('resize', () => {
    actualizarDimensionesCanvas();
    if (canvasEnPantallaCompleta) {
        encuadrarCanvas(canvasEnPantallaCompleta);
        redibujarTodosLosCanvas();
    }
});

// ---------- Primer render ----------
actualizarDimensionesCanvas();
ui.actualizar();