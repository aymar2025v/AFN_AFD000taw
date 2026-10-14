// ============================================================
// interaccion.js
// Contiene dos configuradores independientes:
//   - configurarInteraccion: canvas editable (NFA)
//   - configurarVistaYArrastre: canvas de solo-lectura (DFA, DFA min)
// ============================================================

// ------------------------------------------------------------
// 1) Canvas editable: crear transiciones, menú contextual,
//    arrastrar estados, zoom con rueda.
// ------------------------------------------------------------
function puntoEnCanvas(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function aplicarZoomRueda(e, canvas, vista, redibujar) {
    e.preventDefault();
    const factorDelta = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    vista.zoomEn(puntoEnCanvas(canvas, e), Math.exp(-e.deltaY * factorDelta * 0.001));
    redibujar();
}

export function configurarInteraccion({ canvas, automata, redibujar, vista }) {
    const ui = {
        estadoArrastrado: null,
        offsetArrastre: { x: 0, y: 0 },
        mouseDownInfo: null,
        estadoOrigenTransicion: null,
        posicionesEtiquetas: [],
    };

    function actualizar() {
        ui.posicionesEtiquetas = redibujar(ui.estadoOrigenTransicion);
    }

    function buscarEtiquetaEnPunto(px, py) {
        for (let i = ui.posicionesEtiquetas.length - 1; i >= 0; i--) {
            const p = ui.posicionesEtiquetas[i];
            if (Math.hypot(px - p.x, py - p.y) <= 22) return p;
        }
        return null;
    }

    // ---------- Crear transiciones ----------

    async function procesarClicEnEstado(estado) {
        if (ui.estadoOrigenTransicion === null) {
            ui.estadoOrigenTransicion = estado;
        } else if (ui.estadoOrigenTransicion === estado) {
            await pedirSimboloYCrear(estado.id, estado.id);
            ui.estadoOrigenTransicion = null;
        } else {
            await pedirSimboloYCrear(ui.estadoOrigenTransicion.id, estado.id);
            ui.estadoOrigenTransicion = null;
        }
        actualizar();
    }

    async function pedirSimboloYCrear(desdeId, haciaId) {
        const simbolo = await pedirSimbolo(`Símbolo para ${desdeId} → ${haciaId}:`, 'a');
        if (simbolo === null) return;
        const s = simbolo.trim();
        if (s === '') return;
        automata.agregarTransicion(desdeId, haciaId, s);
    }

    function pedirSimbolo(textoInvitacion, valorInicial = '') {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.id = 'modalOverlay';
            overlay.className = 'fixed inset-0 z-[2000] hidden items-center justify-center bg-slate-900/40 backdrop-blur-sm [&.visible]:flex';
            overlay.innerHTML = `
                <div id="modalSimbolo" class="min-w-[300px] rounded-2xl bg-white px-6 py-5 shadow-2xl ring-1 ring-slate-200">
                    <label class="mb-2 block text-sm font-bold text-slate-700">${textoInvitacion}</label>
                    <input type="text" id="inputSimbolo" value="${valorInicial}" class="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                    <p class="mb-4 text-xs text-slate-500">Escribe un símbolo o usa λ (también se acepta ε). λ no pertenece al alfabeto Σ.</p>
                    <div class="botones flex justify-end gap-2">
                        <button class="secundario rounded-lg bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100" id="btnLambda" type="button">λ</button>
                        <button class="secundario rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200" id="btnCancelar">Cancelar</button>
                        <button class="primario rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600" id="btnAceptar">Aceptar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            const input = overlay.querySelector('#inputSimbolo');
            const cerrar = v => { overlay.remove(); resolve(v); };

            overlay.querySelector('#btnAceptar').addEventListener('click', () => cerrar(input.value));
            overlay.querySelector('#btnCancelar').addEventListener('click', () => cerrar(null));
            overlay.querySelector('#btnLambda').addEventListener('click', () => cerrar('λ'));
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter')  cerrar(input.value);
                if (e.key === 'Escape') cerrar(null);
            });
            overlay.addEventListener('mousedown', e => {
                if (e.target === overlay) cerrar(null);
            });

            input.focus();
            input.select();
        });
    }

    // ---------- Menú contextual ----------

    const menu = document.createElement('div');
    menu.id = 'menuContextual';
    menu.className = 'fixed z-[1000] hidden min-w-[200px] overflow-hidden rounded-xl bg-white py-1 text-sm shadow-xl ring-1 ring-slate-200';
    document.body.appendChild(menu);

    function mostrarMenu(cx, cy, items) {
        menu.innerHTML = '';
        items.forEach(it => {
            const div = document.createElement('div');
            div.className = 'menu-item cursor-pointer whitespace-nowrap px-4 py-2 text-slate-700 transition hover:bg-emerald-500 hover:text-white';
            div.textContent = it.label;
            div.addEventListener('click', () => { it.action(); ocultarMenu(); });
            menu.appendChild(div);
        });
        menu.style.display = 'block';
        menu.style.left = cx + 'px';
        menu.style.top = cy + 'px';
    }

    function ocultarMenu() { menu.style.display = 'none'; }

    document.addEventListener('click', e => {
        if (!menu.contains(e.target)) ocultarMenu();
    });

    // ---------- Ratón ----------

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        ocultarMenu();

        const { x, y } = vista.mouseEnMundo(e);
        const estadoBajo = automata.buscarEstadoEnPunto(x, y);
        ui.mouseDownInfo = {
            estado: estadoBajo,
            x,
            y,
            movido: false,
            pantalla: puntoEnCanvas(canvas, e),
            offsetX: vista.offsetX,
            offsetY: vista.offsetY,
        };

        if (estadoBajo) {
            ui.estadoArrastrado = estadoBajo;
            ui.offsetArrastre = { x: x - estadoBajo.x, y: y - estadoBajo.y };
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', e => {
        if (!ui.mouseDownInfo) return;
        const pantalla = puntoEnCanvas(canvas, e);

        if (!ui.estadoArrastrado) {
            if (Math.hypot(
                pantalla.x - ui.mouseDownInfo.pantalla.x,
                pantalla.y - ui.mouseDownInfo.pantalla.y
            ) > 4) {
                ui.mouseDownInfo.movido = true;
                vista.offsetX = ui.mouseDownInfo.offsetX + pantalla.x - ui.mouseDownInfo.pantalla.x;
                vista.offsetY = ui.mouseDownInfo.offsetY + pantalla.y - ui.mouseDownInfo.pantalla.y;
                canvas.style.cursor = 'grabbing';
                actualizar();
            }
            return;
        }

        const { x, y } = vista.mouseEnMundo(e);

        if (Math.hypot(x - ui.mouseDownInfo.x, y - ui.mouseDownInfo.y) > 4) {
            ui.mouseDownInfo.movido = true;
        }
        if (!ui.mouseDownInfo.movido) return;

        ui.estadoArrastrado.x = x - ui.offsetArrastre.x;
        ui.estadoArrastrado.y = y - ui.offsetArrastre.y;
        actualizar();
    });

    window.addEventListener('mouseup', e => {
        if (e.button !== 0) return;

        if (ui.mouseDownInfo && !ui.mouseDownInfo.movido) {
            if (ui.mouseDownInfo.estado) {
                procesarClicEnEstado(ui.mouseDownInfo.estado);
            } else {
                ui.estadoOrigenTransicion = null;
                actualizar();
            }
        }
        ui.estadoArrastrado = null;
        ui.mouseDownInfo = null;
        canvas.style.cursor = 'grab';
    });

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && ui.estadoOrigenTransicion) {
            ui.estadoOrigenTransicion = null;
            actualizar();
        }
    });

    // ---------- Zoom con rueda ----------

    canvas.addEventListener('wheel', e => {
        aplicarZoomRueda(e, canvas, vista, actualizar);
    }, { passive: false });

    // Doble clic en vacío → reset de la vista
    canvas.addEventListener('dblclick', e => {
        const { x, y } = vista.mouseEnMundo(e);
        if (automata.buscarEstadoEnPunto(x, y)) return;
        vista.reset();
        actualizar();
    });

    // ---------- Menú contextual ----------

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        const { x, y } = vista.mouseEnMundo(e);
        const estadoBajo = automata.buscarEstadoEnPunto(x, y);
        const etiqueta = buscarEtiquetaEnPunto(x, y);
        const items = [];

        if (estadoBajo) {
            items.push({
                label: estadoBajo.inicial ? 'Quitar estado inicial' : 'Marcar como inicial',
                action: () => {
                    const eraInicial = estadoBajo.inicial;
                    automata.estados.forEach(e2 => (e2.inicial = false));
                    estadoBajo.inicial = !eraInicial;
                    actualizar();
                },
            });
            items.push({
                label: estadoBajo.final ? 'Quitar estado final' : 'Marcar como final',
                action: () => {
                    estadoBajo.final = !estadoBajo.final;
                    actualizar();
                },
            });
            items.push({
                label: 'Eliminar estado',
                action: () => {
                    automata.eliminarEstado(estadoBajo);
                    if (ui.estadoOrigenTransicion === estadoBajo) {
                        ui.estadoOrigenTransicion = null;
                    }
                    actualizar();
                },
            });
        } else if (etiqueta) {
            items.push({
                label: `Eliminar transición(es) ${etiqueta.desde} → ${etiqueta.hacia}`,
                action: () => {
                    automata.eliminarTransiciones(etiqueta.desde, etiqueta.hacia);
                    actualizar();
                },
            });
        } else {
            items.push({
                label: 'Agregar estado aquí',
                action: () => {
                    automata.agregarEstado({ x, y });
                    actualizar();
                },
            });
        }

        mostrarMenu(e.clientX, e.clientY, items);
    });

    // ---------- API pública ----------

    return {
        actualizar,
        agregarEstadoEnCentro() {
            const centro = vista.pantallaAMundo({
                x: canvas.clientWidth / 2,
                y: canvas.clientHeight / 2,
            });
            automata.agregarEstado({
                x: centro.x + (Math.random() * 120 - 60),
                y: centro.y + (Math.random() * 120 - 60),
            });
            actualizar();
        },
    };
}

// ------------------------------------------------------------
// 2) Canvas de solo-lectura: zoom con rueda, arrastrar estados,
//    doble clic en vacío para resetear la vista.
// ------------------------------------------------------------
export function configurarVistaYArrastre({ canvas, automata, redibujar, vista }) {
    let estadoArrastrado = null;
    let offsetArrastre = { x: 0, y: 0 };
    let mouseDownInfo = null;

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        const { x, y } = vista.mouseEnMundo(e);
        const estadoBajo = automata.buscarEstadoEnPunto(x, y);

        mouseDownInfo = {
            x,
            y,
            movido: false,
            pantalla: puntoEnCanvas(canvas, e),
            offsetX: vista.offsetX,
            offsetY: vista.offsetY,
        };
        if (estadoBajo) {
            estadoArrastrado = estadoBajo;
            offsetArrastre = { x: x - estadoBajo.x, y: y - estadoBajo.y };
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', e => {
        if (!mouseDownInfo) return;
        const pantalla = puntoEnCanvas(canvas, e);

        if (!estadoArrastrado) {
            if (Math.hypot(
                pantalla.x - mouseDownInfo.pantalla.x,
                pantalla.y - mouseDownInfo.pantalla.y
            ) > 4) {
                mouseDownInfo.movido = true;
                vista.offsetX = mouseDownInfo.offsetX + pantalla.x - mouseDownInfo.pantalla.x;
                vista.offsetY = mouseDownInfo.offsetY + pantalla.y - mouseDownInfo.pantalla.y;
                canvas.style.cursor = 'grabbing';
                redibujar();
            }
            return;
        }

        const { x, y } = vista.mouseEnMundo(e);

        if (Math.hypot(x - mouseDownInfo.x, y - mouseDownInfo.y) > 4) {
            mouseDownInfo.movido = true;
        }
        if (!mouseDownInfo.movido) return;

        estadoArrastrado.x = x - offsetArrastre.x;
        estadoArrastrado.y = y - offsetArrastre.y;
        redibujar();
    });

    window.addEventListener('mouseup', () => {
        estadoArrastrado = null;
        mouseDownInfo = null;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', e => {
        aplicarZoomRueda(e, canvas, vista, redibujar);
    }, { passive: false });

    // Doble clic en vacío → reset de la vista de este canvas
    canvas.addEventListener('dblclick', e => {
        const { x, y } = vista.mouseEnMundo(e);
        if (automata.buscarEstadoEnPunto(x, y)) return;
        vista.reset();
        redibujar();
    });
}
