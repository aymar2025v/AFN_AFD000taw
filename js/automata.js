import { Estado } from './estado.js';
import { Transicion } from './transicion.js';

export const EPSILON = 'ε';

// Aceptamos las dos notaciones habituales, pero almacenamos una sola.
export function normalizarSimbolo(simbolo) {
    const limpio = String(simbolo ?? '').trim();
    return limpio === 'λ' || limpio.toLowerCase() === 'epsilon' ? EPSILON : limpio;
}

export class Automata {
    constructor() {
        this.estados = [];
        this.transiciones = [];
        this.alfabeto = [];
        this.contadorEstados = 0;
    }

    // ---------- Estados ----------

    agregarEstado({ id, x, y, radio = 40, inicial = false, final = false } = {}) {
        if (!id) {
            id = this.siguienteId();
        } else {
            const m = /^q(\d+)$/.exec(id);
            if (m) this.contadorEstados = Math.max(this.contadorEstados, +m[1] + 1);
        }
        const estado = new Estado({ id, x, y, radio, inicial, final });
        this.estados.push(estado);
        return estado;
    }

    siguienteId() {
        let id;
        do { id = 'q' + this.contadorEstados++; }
        while (this.estados.some(e => e.id === id));
        return id;
    }

    eliminarEstado(estado) {
        this.estados = this.estados.filter(e => e !== estado);
        this.transiciones = this.transiciones.filter(
            t => t.desde !== estado.id && t.hacia !== estado.id
        );
    }

    buscarEstado(id) {
        return this.estados.find(e => e.id === id);
    }

    buscarEstadoEnPunto(px, py) {
        for (let i = this.estados.length - 1; i >= 0; i--) {
            if (this.estados[i].contienePunto(px, py)) return this.estados[i];
        }
        return null;
    }

    // ---------- Transiciones ----------

    agregarTransicion(desde, hacia, simbolo) {
        simbolo = normalizarSimbolo(simbolo);
        if (!simbolo || !this.buscarEstado(desde) || !this.buscarEstado(hacia)) {
            return false;
        }
        const existe = this.transiciones.some(
            t => t.desde === desde && t.hacia === hacia && t.simbolo === simbolo
        );
        if (existe) return false;
        this.transiciones.push(new Transicion(desde, hacia, simbolo));
        return true;
    }

    eliminarTransiciones(desde, hacia) {
        this.transiciones = this.transiciones.filter(
            t => !(t.desde === desde && t.hacia === hacia)
        );
    }

        // ---------- Utilidades para conversión ----------

    estadoInicial() {
        return this.estados.find(e => e.inicial) || null;
    }

    estadosFinales() {
        return this.estados.filter(e => e.final);
    }

    // Alfabeto = símbolos únicos en transiciones, sin contar ε
        calcularAlfabeto() {
        // Si el usuario declaró Σ explícitamente, respetarla
        if (this.alfabeto && this.alfabeto.length > 0) {
            return [...new Set(this.alfabeto.map(normalizarSimbolo)
                .filter(simbolo => simbolo && simbolo !== EPSILON))].sort();
        }
        // Si no, derivarla de las transiciones
        const simbolos = new Set();
        this.transiciones.forEach(t => {
            if (t.simbolo !== EPSILON) simbolos.add(t.simbolo);
        });
        return [...simbolos].sort();
    }
}
