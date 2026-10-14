export class Vista {
    constructor(canvas, { escalaMin = 0.3, escalaMax = 4 } = {}) {
        this.canvas = canvas;
        this.escala = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.escalaMin = escalaMin;
        this.escalaMax = escalaMax;
    }

    aplicar(ctx) {
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.escala, this.escala);
    }

    restaurar(ctx) {
        ctx.restore();
    }

    // Convierte coords de pantalla (relativas al canvas) a coords del mundo
    pantallaAMundo({ x, y }) {
        return {
            x: (x - this.offsetX) / this.escala,
            y: (y - this.offsetY) / this.escala,
        };
    }

    // Devuelve la posición del ratón en coords del mundo
    mouseEnMundo(e) {
        const rect = this.canvas.getBoundingClientRect();
        return this.pantallaAMundo({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    }

    // Zoom centrado en un punto de pantalla
    zoomEn(punto, factor) {
        const mundo = this.pantallaAMundo(punto);
        this.escala = Math.max(this.escalaMin, Math.min(this.escalaMax, this.escala * factor));
        this.offsetX = punto.x - mundo.x * this.escala;
        this.offsetY = punto.y - mundo.y * this.escala;
    }

    reset() {
        this.escala = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }
}