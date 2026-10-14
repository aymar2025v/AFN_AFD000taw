// Primitivas de dibujo compartidas. No saben nada de autómatas.

export function dibujarPunta(ctx, x, y, angulo) {
    const L = 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - L * Math.cos(angulo - Math.PI / 6),
               y - L * Math.sin(angulo - Math.PI / 6));
    ctx.lineTo(x - L * Math.cos(angulo + Math.PI / 6),
               y - L * Math.sin(angulo + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
}

export function dibujarEtiqueta(ctx, texto, x, y) {
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(texto).width;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w / 2 - 4, y - 9, w + 8, 18);

    ctx.fillStyle = '#2c3e50';
    ctx.fillText(texto, x, y);
}

export function obtenerPosicionRaton(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}