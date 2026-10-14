import { dibujarPunta } from './lienzo.js';

export class Estado {
    constructor({ id, x, y, radio = 40, inicial = false, final = false }) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radio = radio;
        this.inicial = inicial;
        this.final = final;
    }

    contienePunto(px, py) {
        return Math.hypot(px - this.x, py - this.y) <= this.radio;
    }

    dibujar(ctx, resaltado = false) {
        const { x, y, radio, inicial, final, id } = this;

        ctx.strokeStyle = '#2c3e50';
        ctx.fillStyle = '#2c3e50';
        ctx.lineWidth = 2;

        if (resaltado) {
            ctx.beginPath();
            ctx.arc(x, y, radio + 6, 0, Math.PI * 2);
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2;
        }

        if (inicial) {
            const ex = x - radio;
            ctx.beginPath();
            ctx.moveTo(ex - 35, y);
            ctx.lineTo(ex, y);
            ctx.stroke();
            dibujarPunta(ctx, ex, y, 0);
        }

        ctx.beginPath();
        ctx.arc(x, y, radio, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();

        if (final) {
            ctx.beginPath();
            ctx.arc(x, y, radio - 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.font = 'bold 16px sans-serif';
        // ctx.textAlign = 'center';
        // ctx.textBaseline = 'middle';
        // ctx.fillStyle = '#2c3e50';
        // ctx.fillText(id, x, y);
                // id — fuente auto-escalada para que quepa dentro del círculo
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2c3e50';

        let tamano = 16;
        ctx.font = `bold ${tamano}px sans-serif`;
        const anchoTexto = ctx.measureText(id).width;
        const anchoMax = 2 * radio - 10;
        if (anchoTexto > anchoMax) {
            tamano = Math.max(9, Math.floor(tamano * (anchoMax / anchoTexto)));
            ctx.font = `bold ${tamano}px sans-serif`;
        }
        ctx.fillText(id, x, y);
    }
}