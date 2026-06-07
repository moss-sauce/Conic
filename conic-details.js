const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let offsetX = 0, offsetY = 0;
let scale = 50; 

let isDragging = false;
let lastMouseX, lastMouseY;

const conicsContainer = document.getElementById('conics-container');
const pointsContainer = document.getElementById('points-container');
let conics = [];
let points = [];
let draggingPoint = null;

const colors = {
    bg: '#0f172a',
    gridMinor: 'rgba(255,255,255,0.03)',
    gridMajor: 'rgba(255,255,255,0.08)',
    axis: '#334155',
    text: '#94a3b8'
};

document.querySelectorAll('input[type="color"]').forEach(input => {
    input.addEventListener('input', (e) => {
        const id = e.target.id;
        const val = e.target.value;
        if (id === 'color-bg') { colors.bg = val; document.body.style.backgroundColor = val; }
        else if (id === 'color-grid') colors.gridMajor = val;
        else if (id === 'color-axis') colors.axis = val;
        else if (id === 'color-text') colors.text = val;
        else if (id === 'color-panel') document.documentElement.style.setProperty('--panel-bg', val + 'd9');
        requestDraw();
    });
});

function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestDraw();
}
window.addEventListener('resize', resize);

const toScrX = (x) => width/2 + offsetX + x * scale;
const toScrY = (y) => height/2 + offsetY - y * scale;
const toMathX = (sx) => (sx - width/2 - offsetX) / scale;
const toMathY = (sy) => -(sy - height/2 - offsetY) / scale;

// Track clicked points to show coordinates labels (Desmos-like)
let activeLabels = [];

canvas.addEventListener('mousedown', e => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Check if clicked near a conic's Foci or Center to toggle its coordinate label
    let clickedSpecialPoint = false;
    conics.forEach(c => {
        if (c.center && c.styles.center.show) {
            const sx = toScrX(c.center.x);
            const sy = toScrY(c.center.y);
            if (Math.hypot(mouseX - sx, mouseY - sy) < 15) {
                const key = `center-${c.id}`;
                const idx = activeLabels.indexOf(key);
                if (idx > -1) activeLabels.splice(idx, 1);
                else activeLabels.push(key);
                clickedSpecialPoint = true;
            }
        }
        if (c.foci && c.styles.foci.show) {
            c.foci.forEach((f, fIdx) => {
                const sx = toScrX(f.x);
                const sy = toScrY(f.y);
                if (Math.hypot(mouseX - sx, mouseY - sy) < 15) {
                    const key = `focus-${c.id}-${fIdx}`;
                    const idx = activeLabels.indexOf(key);
                    if (idx > -1) activeLabels.splice(idx, 1);
                    else activeLabels.push(key);
                    clickedSpecialPoint = true;
                }
            });
        }
    });

    if (clickedSpecialPoint) {
        requestDraw();
        return;
    }
    
    for (let p of points) {
        const sx = toScrX(p.x);
        const sy = toScrY(p.y);
        if (Math.hypot(mouseX - sx, mouseY - sy) < 20) {
            draggingPoint = p;
            return;
        }
    }
    
    isDragging = true;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
});
window.addEventListener('mouseup', () => { isDragging = false; draggingPoint = null; });

function getConicPoints(c) {
    let pts = [];
    if (c.type === 'Ellipse' && c.a && c.b) {
        const { a, b, center: {x: h, y: k}, theta, isMajorX } = c;
        const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
        for (let i = 0; i <= 400; i++) {
            const t = (i / 400) * Math.PI * 2;
            const X = a * Math.cos(t), Y = b * Math.sin(t);
            pts.push({x: h + X * Math.cos(t_adj) - Y * Math.sin(t_adj), y: k + X * Math.sin(t_adj) + Y * Math.cos(t_adj)});
        }
    } else if (c.type === 'Hyperbola' && c.a && c.b) {
        const { a, b, center: {x: h, y: k}, theta, isMajorX } = c;
        const maxDist = Math.max(width, height) / scale * 1.5;
        const T = Math.acosh(Math.max(1.1, maxDist / a));
        const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
        const addBranch = (sign) => {
            for (let i = 0; i <= 200; i++) {
                const t = -T + (i / 200) * (2 * T);
                const X = sign * a * Math.cosh(t), Y = b * Math.sinh(t);
                pts.push({x: h + X * Math.cos(t_adj) - Y * Math.sin(t_adj), y: k + X * Math.sin(t_adj) + Y * Math.cos(t_adj)});
            }
        };
        addBranch(1); addBranch(-1);
    } else if (c.type === 'Parabola' && c.a_par) {
        const { center: {x: h, y: k}, theta, a_par, isMajorX } = c;
        const maxDist = Math.max(width, height) / scale * 1.5;
        const T = Math.sqrt(Math.abs(maxDist / Math.abs(a_par)));
        for (let i = 0; i <= 400; i++) {
            const t = -T + (i / 400) * (2 * T);
            const X = isMajorX ? (t*t)/(4*a_par) : t, Y = isMajorX ? t : (t*t)/(4*a_par);
            pts.push({x: h + X * Math.cos(theta) - Y * Math.sin(theta), y: k + X * Math.sin(theta) + Y * Math.cos(theta)});
        }
    } else if (c.type === 'Degenerate') {
        // Fast approximate points for degenerate (lines)
        const {A, B, C, D, E, F} = c;
        for (let px = 0; px < width; px+=10) {
            const x = toMathX(px);
            const a = C, b = B*x + E, cv = A*x*x + D*x + F;
            if (Math.abs(a) > 1e-6) {
                const det = b*b - 4*a*cv;
                if (det >= 0) { pts.push({x: x, y: (-b+Math.sqrt(det))/(2*a)}); pts.push({x: x, y: (-b-Math.sqrt(det))/(2*a)}); }
            }
        }
        for (let py = 0; py < height; py+=10) {
            const y = toMathY(py);
            const a = A, b = B*y + D, cv = C*y*y + E*y + F;
            if (Math.abs(a) > 1e-6) {
                const det = b*b - 4*a*cv;
                if (det >= 0) { pts.push({x: (-b+Math.sqrt(det))/(2*a), y: y}); pts.push({x: (-b-Math.sqrt(det))/(2*a), y: y}); }
            }
        }
    }
    return pts;
}

function getClosestPointOnConics(mathX, mathY) {
    let closestDist = Infinity;
    let closestPt = null;
    let closestConicId = null;
    let closestType = 'curve';

    conics.forEach(c => {
        if (c.styles.curve.show) {
            const pts = getConicPoints(c);
            pts.forEach(p => {
                const sx = toScrX(p.x), sy = toScrY(p.y);
                const msx = toScrX(mathX), msy = toScrY(mathY);
                const dist = Math.hypot(sx - msx, sy - msy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPt = {x: p.x, y: p.y};
                    closestConicId = c.id;
                    closestType = 'curve';
                }
            });
        }
        
        const checkLine = (lineEq, styleKey) => {
            if (!lineEq || !c.styles[styleKey].show) return;
            const {nx, ny, d} = lineEq;
            const den = nx*nx + ny*ny;
            if (den < 1e-10) return;
            
            const distMath = Math.abs(nx*mathX + ny*mathY - d) / Math.sqrt(den);
            const distScr = distMath * scale;
            if (distScr < closestDist) {
                closestDist = distScr;
                const t = (d - nx*mathX - ny*mathY) / den;
                closestPt = {x: mathX + t*nx, y: mathY + t*ny};
                closestConicId = c.id;
                closestType = {type: 'line', lineEq: lineEq, styleKey: styleKey}; 
            }
        };

        if (c.majorAxis) checkLine(c.majorAxis, 'axes');
        if (c.minorAxis) checkLine(c.minorAxis, 'axes');
        if (c.asymptotes) c.asymptotes.forEach(l => checkLine(l, 'asymptotes'));
        if (c.directrices) c.directrices.forEach(l => checkLine(l, 'directrices'));
    });

    return { closestDist, closestPt, closestConicId, closestType };
}

window.addEventListener('mousemove', e => {
    if (draggingPoint) {
        const mathX = toMathX(e.clientX);
        const mathY = toMathY(e.clientY);
        
        const SNAP_THRESHOLD = 20;
        const BREAKOUT_THRESHOLD = 50;
        
        const { closestDist, closestPt, closestConicId, closestType } = getClosestPointOnConics(mathX, mathY);

        if (draggingPoint.isSnapped) {
            if (closestDist > BREAKOUT_THRESHOLD) {
                draggingPoint.isSnapped = false;
                draggingPoint.snappedConicId = null;
                draggingPoint.snappedType = null;
                draggingPoint.x = mathX;
                draggingPoint.y = mathY;
            } else {
                let c = conics.find(cx => cx.id === draggingPoint.snappedConicId);
                if (c) {
                    if (draggingPoint.snappedType === 'curve' && c.styles.curve.show) {
                        const pts = getConicPoints(c);
                        let minDist = Infinity;
                        let bestP = {x: mathX, y: mathY};
                        pts.forEach(p => {
                            const dist = Math.hypot(toScrX(p.x) - e.clientX, toScrY(p.y) - e.clientY);
                            if (dist < minDist) { minDist = dist; bestP = p; }
                        });
                        draggingPoint.x = bestP.x;
                        draggingPoint.y = bestP.y;
                    } else if (typeof draggingPoint.snappedType === 'object' && draggingPoint.snappedType.type === 'line' && c.styles[draggingPoint.snappedType.styleKey].show) {
                        const {nx, ny, d} = draggingPoint.snappedType.lineEq;
                        const den = nx*nx + ny*ny;
                        const t = (d - nx*mathX - ny*mathY) / den;
                        draggingPoint.x = mathX + t*nx;
                        draggingPoint.y = mathY + t*ny;
                    } else {
                        draggingPoint.isSnapped = false;
                        draggingPoint.snappedConicId = null;
                        draggingPoint.snappedType = null;
                    }
                } else {
                    draggingPoint.isSnapped = false;
                    draggingPoint.snappedConicId = null;
                    draggingPoint.snappedType = null;
                }
            }
        } else {
            if (closestDist < SNAP_THRESHOLD && closestConicId !== null) {
                draggingPoint.isSnapped = true;
                draggingPoint.snappedConicId = closestConicId;
                draggingPoint.snappedType = closestType;
                draggingPoint.x = closestPt.x;
                draggingPoint.y = closestPt.y;
            } else {
                draggingPoint.x = mathX;
                draggingPoint.y = mathY;
            }
        }

        const card = document.getElementById('point-card-' + draggingPoint.id);
        if (card) {
            card.querySelector('.p-x').value = Math.round(draggingPoint.x * 100) / 100;
            card.querySelector('.p-y').value = Math.round(draggingPoint.y * 100) / 100;
        }
        requestDraw();
    } else if (isDragging) {
        offsetX += (e.clientX - lastMouseX);
        offsetY += (e.clientY - lastMouseY);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        requestDraw();
    }
});
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const mathX = (mouseX - width/2 - offsetX) / scale;
    const mathY = -(mouseY - height/2 - offsetY) / scale;

    if (e.deltaY < 0) scale *= zoomFactor;
    else scale /= zoomFactor;

    offsetX = mouseX - width/2 - mathX * scale;
    offsetY = mouseY - height/2 + mathY * scale;
    requestDraw();
});

const sidePanel = document.getElementById('side-panel');
document.getElementById('toggle-panel').addEventListener('click', () => {
    sidePanel.classList.remove('open');
    document.getElementById('open-panel').classList.remove('hidden');
});
document.getElementById('open-panel').addEventListener('click', () => {
    sidePanel.classList.add('open');
    document.getElementById('open-panel').classList.add('hidden');
});

const geoPanel = document.getElementById('geometry-panel');
document.getElementById('toggle-geo-panel').addEventListener('click', () => {
    geoPanel.classList.add('hidden');
    document.getElementById('open-geo-panel').classList.remove('hidden');
});
document.getElementById('open-geo-panel').addEventListener('click', () => {
    geoPanel.classList.remove('hidden');
    document.getElementById('open-geo-panel').classList.add('hidden');
});

function formatVal(v) {
    if (Math.abs(v) < 1e-10) return 0;
    return Math.round(v * 100) / 100;
}

function getNiceStep(rawStep) {
    const p = Math.floor(Math.log10(rawStep));
    const f = Math.pow(10, p);
    const m = rawStep / f;
    if (m < 1.5) return 1 * f;
    if (m < 3.5) return 2 * f;
    if (m < 7.5) return 5 * f;
    return 10 * f;
}

function drawGrid() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const targetSpacing = 80; 
    const rawStep = targetSpacing / scale;
    const step = getNiceStep(rawStep);
    const minorStep = step / 5;

    const startX = toMathX(0), endX = toMathX(width);
    const startY = toMathY(height), endY = toMathY(0);

    ctx.strokeStyle = colors.gridMinor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(startX / minorStep) * minorStep; x <= endX; x += minorStep) {
        ctx.moveTo(toScrX(x), 0); ctx.lineTo(toScrX(x), height);
    }
    for (let y = Math.floor(startY / minorStep) * minorStep; y <= endY; y += minorStep) {
        ctx.moveTo(0, toScrY(y)); ctx.lineTo(width, toScrY(y));
    }
    ctx.stroke();

    ctx.strokeStyle = colors.gridMajor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(startX / step) * step; x <= endX; x += step) {
        ctx.moveTo(toScrX(x), 0); ctx.lineTo(toScrX(x), height);
    }
    for (let y = Math.floor(startY / step) * step; y <= endY; y += step) {
        ctx.moveTo(0, toScrY(y)); ctx.lineTo(width, toScrY(y));
    }
    ctx.stroke();

    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toScrX(0), 0); ctx.lineTo(toScrX(0), height);
    ctx.moveTo(0, toScrY(0)); ctx.lineTo(width, toScrY(0));
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.floor(startX / step) * step; x <= endX; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = toScrX(x);
        let py = toScrY(0) + 5;
        if (py < 0) py = 5; if (py > height - 20) py = height - 20;
        ctx.fillText(formatVal(x), px, py);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.floor(startY / step) * step; y <= endY; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = toScrY(y);
        let px = toScrX(0) - 5;
        if (px < 30) px = 30; if (px > width) px = width - 5;
        ctx.fillText(formatVal(y), px, py);
    }
}

function updateMath(c, card) {
    const A = c.A, B = c.B, C = c.C, D = c.D, E = c.E, F = c.F;
    const term = (coef, v, first) => {
        const rounded = Math.round(coef * 100) / 100;
        if (rounded === 0) return '';
        let str = '';
        if (rounded < 0) str = ' - ';
        else if (!first) str = ' + ';
        let val = Math.abs(rounded);
        if (val !== 1 || v === '') str += val;
        str += v;
        return str;
    };
    
    let eq = '';
    let first = true;
    [{c:A,v:'x^2'},{c:B,v:'xy'},{c:C,v:'y^2'},{c:D,v:'x'},{c:E,v:'y'},{c:F,v:''}].forEach(t => {
        if (t.c !== 0) { eq += term(t.c, t.v, first); first = false; }
    });
    if (eq === '') eq = '0';
    eq += ' = 0';
    
    const eqDiv = card.querySelector('.main-equation');
    if (window.katex) katex.render(eq, eqDiv, { displayMode: true, throwOnError: false });
    
    const setProp = (id, val) => {
        const el = card.querySelector(`.prop-${id}`);
        if (el) el.textContent = val;
    };

    c.foci = []; c.directrices = []; c.asymptotes = []; c.majorAxis = null; c.minorAxis = null;
    ['center', 'a', 'b', 'c', 'e', 'lr', 'theta', 'type'].forEach(id => setProp(id, '-'));
    card.querySelector('.details-foci').textContent = '-';
    card.querySelector('.details-directrices').textContent = '-';
    card.querySelector('.details-asymptotes').textContent = '-';

    if (A===0 && B===0 && C===0 && D===0 && E===0) return;

    const delta = A*C - (B*B)/4;
    let theta = 0;
    if (Math.abs(A - C) < 1e-10) theta = B > 0 ? Math.PI/4 : (B < 0 ? -Math.PI/4 : 0);
    else theta = 0.5 * Math.atan2(B, A - C);
    
    let c_t = Math.cos(theta), s_t = Math.sin(theta);
    let Ap = A*c_t*c_t + B*c_t*s_t + C*s_t*s_t;
    let Cp = A*s_t*s_t - B*c_t*s_t + C*c_t*c_t;
    let Dp = D*c_t + E*s_t;
    let Ep = -D*s_t + E*c_t;
    let Fp = F;

    if (Math.abs(Ap) < 1e-8) Ap = 0;
    if (Math.abs(Cp) < 1e-8) Cp = 0;

    c.theta = theta;
    setProp('theta', `${formatVal(theta * 180 / Math.PI)}°`);

    if (Math.abs(delta) > 1e-8) {
        const hp = -Dp / (2*Ap);
        const kp = -Ep / (2*Cp);
        const K = (Dp*Dp)/(4*Ap) + (Ep*Ep)/(4*Cp) - Fp;
        
        const h = hp*c_t - kp*s_t;
        const k = hp*s_t + kp*c_t;
        c.center = {x: h, y: k};
        setProp('center', `(${formatVal(h)}, ${formatVal(k)})`);

        if (Math.abs(K) < 1e-8) {
            c.type = 'Degenerate'; setProp('type', 'Degenerate');
        } else {
            const vA = K / Ap;
            const vC = K / Cp;
            if (vA > 0 && vC > 0) {
                c.type = 'Ellipse'; setProp('type', 'Ellipse');
                const a2 = Math.max(vA, vC), b2 = Math.min(vA, vC);
                c.a = Math.sqrt(a2); c.b = Math.sqrt(b2);
                c.isMajorX = (vA >= vC);
                const focalDist = Math.sqrt(Math.abs(a2 - b2));
                c.e = focalDist / c.a;
                
                setProp('a', formatVal(c.a)); setProp('b', formatVal(c.b)); setProp('c', formatVal(focalDist));
                setProp('e', formatVal(c.e)); setProp('lr', formatVal(2 * b2 / c.a));
                
                const t_adj = theta + (c.isMajorX ? 0 : Math.PI/2);
                const dx = focalDist * Math.cos(t_adj), dy = focalDist * Math.sin(t_adj);
                c.foci = [{x: h+dx, y: k+dy}, {x: h-dx, y: k-dy}];
                card.querySelector('.details-foci').textContent = `F1: (${formatVal(h+dx)}, ${formatVal(k+dy)})\nF2: (${formatVal(h-dx)}, ${formatVal(k-dy)})`;
                
                const dirDist = a2 / focalDist;
                const dnx = Math.cos(t_adj), dny = Math.sin(t_adj);
                c.directrices = [{nx: dnx, ny: dny, d: dnx*h + dny*k + dirDist}, {nx: dnx, ny: dny, d: dnx*h + dny*k - dirDist}];
                card.querySelector('.details-directrices').textContent = `D1: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(c.directrices[0].d)}\nD2: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(c.directrices[1].d)}`;
            } else if (vA * vC < 0) {
                c.type = 'Hyperbola'; setProp('type', 'Hyperbola');
                c.isMajorX = (vA > 0);
                const a2 = c.isMajorX ? vA : vC;
                const b2 = Math.abs(c.isMajorX ? vC : vA);
                c.a = Math.sqrt(a2); c.b = Math.sqrt(b2);
                const focalDist = Math.sqrt(a2 + b2);
                c.e = focalDist / c.a;
                
                setProp('a', formatVal(c.a)); setProp('b', formatVal(c.b)); setProp('c', formatVal(focalDist));
                setProp('e', formatVal(c.e)); setProp('lr', formatVal(2 * b2 / c.a));
                
                const t_adj = theta + (c.isMajorX ? 0 : Math.PI/2);
                const dx = focalDist * Math.cos(t_adj), dy = focalDist * Math.sin(t_adj);
                c.foci = [{x: h+dx, y: k+dy}, {x: h-dx, y: k-dy}];
                card.querySelector('.details-foci').textContent = `F1: (${formatVal(h+dx)}, ${formatVal(k+dy)})\nF2: (${formatVal(h-dx)}, ${formatVal(k-dy)})`;
                
                const dirDist = a2 / focalDist;
                const dnx = Math.cos(t_adj), dny = Math.sin(t_adj);
                c.directrices = [{nx: dnx, ny: dny, d: dnx*h + dny*k + dirDist}, {nx: dnx, ny: dny, d: dnx*h + dny*k - dirDist}];
                card.querySelector('.details-directrices').textContent = `D1: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(c.directrices[0].d)}\nD2: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(c.directrices[1].d)}`;
                
                const m = c.b / c.a;
                const v1 = {x: Math.cos(t_adj) - m*Math.sin(t_adj), y: Math.sin(t_adj) + m*Math.cos(t_adj)};
                const v2 = {x: Math.cos(t_adj) + m*Math.sin(t_adj), y: Math.sin(t_adj) - m*Math.cos(t_adj)};
                c.asymptotes = [{nx: -v1.y, ny: v1.x, d: -v1.y*h + v1.x*k}, {nx: -v2.y, ny: v2.x, d: -v2.y*h + v2.x*k}];
                card.querySelector('.details-asymptotes').textContent = `A1: ${formatVal(-v1.y)}x + ${formatVal(v1.x)}y = ${formatVal(c.asymptotes[0].d)}\nA2: ${formatVal(-v2.y)}x + ${formatVal(v2.x)}y = ${formatVal(c.asymptotes[1].d)}`;
            } else {
                c.type = 'Degenerate'; setProp('type', 'Imaginary');
            }
        }
        c.majorAxis = {nx: Math.sin(theta), ny: -Math.cos(theta), d: Math.sin(theta)*h - Math.cos(theta)*k};
        c.minorAxis = {nx: Math.cos(theta), ny: Math.sin(theta), d: Math.cos(theta)*h + Math.sin(theta)*k};
    } else {
        c.type = 'Parabola'; setProp('type', 'Parabola');
        let p, hp, kp, h, k;
        if (Ap === 0) {
            if (Math.abs(Dp) < 1e-8) { c.type = 'Degenerate'; setProp('type', 'Degenerate'); }
            else {
                kp = -Ep / (2*Cp); hp = (Ep*Ep/(4*Cp) - Fp) / Dp; p = -Dp / (4*Cp);
                h = hp*c_t - kp*s_t; k = hp*s_t + kp*c_t;
                c.center = {x: h, y: k}; c.a_par = p; c.isMajorX = true;
            }
        } else {
            if (Math.abs(Ep) < 1e-8) { c.type = 'Degenerate'; setProp('type', 'Degenerate'); }
            else {
                hp = -Dp / (2*Ap); kp = (Dp*Dp/(4*Ap) - Fp) / Ep; p = -Ep / (4*Ap);
                h = hp*c_t - kp*s_t; k = hp*s_t + kp*c_t;
                c.center = {x: h, y: k}; c.a_par = p; c.isMajorX = false;
            }
        }
        if (c.type === 'Parabola') {
            setProp('center', `Vertex: (${formatVal(h)}, ${formatVal(k)})`);
            setProp('lr', formatVal(Math.abs(4*p)));
            const t_adj = theta + (c.isMajorX ? 0 : Math.PI/2);
            const fx = h + p * Math.cos(t_adj), fy = k + p * Math.sin(t_adj);
            c.foci = [{x: fx, y: fy}];
            card.querySelector('.details-foci').textContent = `F: (${formatVal(fx)}, ${formatVal(fy)})`;
            const dnx = Math.cos(t_adj), dny = Math.sin(t_adj);
            const d_dist = dnx*(h - p*dnx) + dny*(k - p*dny);
            c.directrices = [{nx: dnx, ny: dny, d: d_dist}];
            card.querySelector('.details-directrices').textContent = `Dir: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(d_dist)}`;
            c.majorAxis = {nx: -dny, ny: dnx, d: -dny*h + dnx*k};
        }
    }
}

let animationFrameId = null;

function applyStyle(style, t) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineWidth = 2.5;

    if (!style || !style.show) return false;

    ctx.strokeStyle = style.color;
    ctx.fillStyle = style.color;

    if (style.lineStyle === 'dashed') ctx.setLineDash([8, 8]);
    if (style.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
    if (style.lineStyle === 'solid') ctx.setLineDash([]);

    if (style.effect === 'neon') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 15 + Math.sin(t * 5) * 5; 
    }
    if (style.effect === 'flicker') {
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        if (Math.random() < 0.05) ctx.globalAlpha = 0.1;
    }

    return true;
}

function resetStyle() {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
}

function drawTooltip(text, sx, sy) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    
    ctx.font = '12px sans-serif';
    const padding = 6;
    const textWidth = ctx.measureText(text).width;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = 24;
    const rx = sx - rectWidth / 2;
    const ry = sy - 35;
    
    // Draw box background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rectWidth, rectHeight, 4);
    ctx.fill();
    ctx.stroke();
    
    // Draw text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, ry + rectHeight / 2);
    ctx.restore();
}

function drawLine(lineEq) {
    if (!lineEq) return;
    ctx.beginPath();
    const {nx, ny, d} = lineEq;
    if (Math.abs(ny) > Math.abs(nx)) {
        const x1 = toMathX(0), x2 = toMathX(width);
        ctx.moveTo(toScrX(x1), toScrY((d - nx*x1)/ny)); ctx.lineTo(toScrX(x2), toScrY((d - nx*x2)/ny));
    } else {
        const y1 = toMathY(height), y2 = toMathY(0);
        ctx.moveTo(toScrX((d - ny*y1)/nx), toScrY(y1)); ctx.lineTo(toScrX((d - ny*y2)/nx), toScrY(y2));
    }
    ctx.stroke(); 
}

function solveQuadratic(a, b, c) {
    if (Math.abs(a) < 1e-10) {
        if (Math.abs(b) < 1e-10) return [];
        return [-c/b];
    }
    const det = b*b - 4*a*c;
    if (det < 0) return [];
    if (Math.abs(det) < 1e-10) return [-b/(2*a)];
    return [(-b+Math.sqrt(det))/(2*a), (-b-Math.sqrt(det))/(2*a)];
}

function drawScene(t) {
    drawGrid();

    conics.forEach(c => {
        if (applyStyle(c.styles.curve, t)) {
            if (c.type === 'Ellipse' && c.a && c.b) {
                ctx.beginPath();
                const { a, b, center: {x: h, y: k}, theta, isMajorX } = c;
                const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
                for (let i = 0; i <= 200; i++) {
                    const tv = (i / 200) * Math.PI * 2;
                    const X = a * Math.cos(tv), Y = b * Math.sin(tv);
                    const x = h + X * Math.cos(t_adj) - Y * Math.sin(t_adj);
                    const y = k + X * Math.sin(t_adj) + Y * Math.cos(t_adj);
                    if (i === 0) ctx.moveTo(toScrX(x), toScrY(y)); else ctx.lineTo(toScrX(x), toScrY(y));
                }
                ctx.stroke();
            } else if (c.type === 'Hyperbola' && c.a && c.b) {
                const { a, b, center: {x: h, y: k}, theta, isMajorX } = c;
                const maxDist = Math.max(width, height) / scale * 1.5;
                const T = Math.acosh(Math.max(1.1, maxDist / a));
                const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
                const drawBranch = (sign) => {
                    ctx.beginPath();
                    for (let i = 0; i <= 100; i++) {
                        const tv = -T + (i / 100) * (2 * T);
                        const X = sign * a * Math.cosh(tv), Y = b * Math.sinh(tv);
                        const x = h + X * Math.cos(t_adj) - Y * Math.sin(t_adj);
                        const y = k + X * Math.sin(t_adj) + Y * Math.cos(t_adj);
                        if (i === 0) ctx.moveTo(toScrX(x), toScrY(y)); else ctx.lineTo(toScrX(x), toScrY(y));
                    }
                    ctx.stroke();
                };
                drawBranch(1); drawBranch(-1);
            } else if (c.type === 'Parabola' && c.a_par) {
                const { center: {x: h, y: k}, theta, a_par, isMajorX } = c;
                const maxDist = Math.max(width, height) / scale * 1.5;
                const T = Math.sqrt(Math.abs(maxDist / Math.abs(a_par)));
                ctx.beginPath();
                for (let i = 0; i <= 200; i++) {
                    const tv = -T + (i / 200) * (2 * T);
                    const X = isMajorX ? (tv*tv)/(4*a_par) : tv, Y = isMajorX ? tv : (tv*tv)/(4*a_par);
                    const x = h + X * Math.cos(theta) - Y * Math.sin(theta);
                    const y = k + X * Math.sin(theta) + Y * Math.cos(theta);
                    if (i === 0) ctx.moveTo(toScrX(x), toScrY(y)); else ctx.lineTo(toScrX(x), toScrY(y));
                }
                ctx.stroke();
            } else if (c.type === 'Degenerate') {
                const {A, B, C, D, E, F} = c;
                for (let px = 0; px < width; px+=2) {
                    const x = toMathX(px);
                    const a = C, b = B*x + E, cv = A*x*x + D*x + F;
                    if (Math.abs(a) > 1e-6) {
                        const det = b*b - 4*a*cv;
                        if (det >= 0) { ctx.fillRect(px, toScrY((-b+Math.sqrt(det))/(2*a)), 2, 2); ctx.fillRect(px, toScrY((-b-Math.sqrt(det))/(2*a)), 2, 2); }
                    }
                }
                for (let py = 0; py < height; py+=2) {
                    const y = toMathY(py);
                    const a = A, b = B*y + D, cv = C*y*y + E*y + F;
                    if (Math.abs(a) > 1e-6) {
                        const det = b*b - 4*a*cv;
                        if (det >= 0) { ctx.fillRect(toScrX((-b+Math.sqrt(det))/(2*a)), py, 2, 2); ctx.fillRect(toScrX((-b-Math.sqrt(det))/(2*a)), py, 2, 2); }
                    }
                }
            }
        }
        resetStyle();

        if (applyStyle(c.styles.axes, t)) { drawLine(c.majorAxis); drawLine(c.minorAxis); }
        resetStyle();
        if (applyStyle(c.styles.asymptotes, t) && c.asymptotes) c.asymptotes.forEach(l => drawLine(l));
        resetStyle();
        if (applyStyle(c.styles.directrices, t) && c.directrices) c.directrices.forEach(l => drawLine(l));
        resetStyle();
        
        if (applyStyle(c.styles.center, t) && c.center) {
            const sx = toScrX(c.center.x);
            const sy = toScrY(c.center.y);
            ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI*2); ctx.fill();
            
            if (activeLabels.includes(`center-${c.id}`)) {
                drawTooltip(`Center: (${formatVal(c.center.x)}, ${formatVal(c.center.y)})`, sx, sy);
            }
        }
        resetStyle();
        if (applyStyle(c.styles.foci, t) && c.foci) {
            c.foci.forEach((f, fIdx) => {
                const sx = toScrX(f.x);
                const sy = toScrY(f.y);
                ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI*2); ctx.fill();
                
                if (activeLabels.includes(`focus-${c.id}-${fIdx}`)) {
                    drawTooltip(`Focus: (${formatVal(f.x)}, ${formatVal(f.y)})`, sx, sy);
                }
            });
        }
        resetStyle();
    });

    points.forEach(p => {
        if (p.isTracing && p.trail.length > 1) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 0; i < p.trail.length - 1; i++) {
                const pt1 = p.trail[i];
                const pt2 = p.trail[i+1];
                const alpha = Math.max(0, 1 - (pt1.age / 10));
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.lineWidth = 4 * alpha;
                ctx.beginPath();
                ctx.moveTo(toScrX(pt1.x), toScrY(pt1.y));
                ctx.lineTo(toScrX(pt2.x), toScrY(pt2.y));
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        }
    });

    points.forEach(p => {
        if (p.isSnapped) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(toScrX(p.x), toScrY(p.y), 14, 0, Math.PI*2);
            ctx.stroke();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(toScrX(p.x), toScrY(p.y), 8, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px Inter';
        ctx.fillText(`(${formatVal(p.x)}, ${formatVal(p.y)})`, toScrX(p.x) + 12, toScrY(p.y) - 12);

        if (p.targetConic !== 'none') {
            const c = conics.find(cx => cx.id == p.targetConic);
            if (c) {
                const {A, B, C, D, E, F} = c;
                const nx = A * p.x + (B / 2) * p.y + D / 2;
                const ny = (B / 2) * p.x + C * p.y + E / 2;
                const d = (D / 2) * p.x + (E / 2) * p.y + F;
                
                let intersections = [];
                if (Math.abs(ny) > 1e-6) {
                    const qa = A * ny * ny - B * nx * ny + C * nx * nx;
                    const qb = -B * ny * d + 2 * C * nx * d + D * ny * ny - E * nx * ny;
                    const qc = C * d * d - E * ny * d + F * ny * ny;
                    const x_sols = solveQuadratic(qa, qb, qc);
                    x_sols.forEach(rx => {
                        intersections.push({x: rx, y: -(nx * rx + d) / ny});
                    });
                } else if (Math.abs(nx) > 1e-6) {
                    const rx = -d / nx;
                    const qa = C * nx * nx;
                    const qb = -B * nx * d + E * nx * nx;
                    const qc = A * d * d - D * nx * d + F * nx * nx;
                    const y_sols = solveQuadratic(qa, qb, qc);
                    y_sols.forEach(ry => {
                        intersections.push({x: rx, y: ry});
                    });
                }

                if (p.relation === 'polar') {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    drawLine({nx, ny, d});
                    ctx.setLineDash([]);
                } else if (p.relation === 'triangle' && intersections.length === 2) {
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = 0.2;
                    ctx.beginPath();
                    ctx.moveTo(toScrX(p.x), toScrY(p.y));
                    ctx.lineTo(toScrX(intersections[0].x), toScrY(intersections[0].y));
                    ctx.lineTo(toScrX(intersections[1].x), toScrY(intersections[1].y));
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (p.relation === 'tangents' && intersections.length > 0) {
                    ctx.strokeStyle = p.color;
                    ctx.setLineDash([5, 5]);
                    ctx.lineWidth = 2;
                    intersections.forEach(pt => {
                        ctx.beginPath();
                        ctx.moveTo(toScrX(p.x), toScrY(p.y));
                        ctx.lineTo(toScrX(pt.x), toScrY(pt.y));
                        ctx.stroke();
                        
                        ctx.beginPath();
                        ctx.arc(toScrX(pt.x), toScrY(pt.y), 4, 0, Math.PI*2);
                        ctx.fill();
                    });
                    ctx.setLineDash([]);
                } else if (p.relation === 'sp_epm' && c.foci && c.foci.length > 0 && c.directrices && c.directrices.length > 0) {
                    let bestIdx = 0;
                    let minDistS = Infinity;
                    c.foci.forEach((f, i) => {
                        const dist = Math.hypot(f.x - p.x, f.y - p.y);
                        if (dist < minDistS) { minDistS = dist; bestIdx = i; }
                    });
                    
                    const S = c.foci[bestIdx];
                    const D_line = c.directrices[bestIdx];
                    if (!S || !D_line) return;
                    
                    const {nx, ny, d} = D_line;
                    const den = nx*nx + ny*ny;
                    const t = (d - nx*p.x - ny*p.y) / den;
                    const M = {x: p.x + t*nx, y: p.y + t*ny};
                    
                    const SP = Math.hypot(S.x - p.x, S.y - p.y);
                    const PM = Math.hypot(M.x - p.x, M.y - p.y);
                    const ratio = PM > 1e-6 ? SP / PM : 0;
                    
                    const card = document.getElementById('point-card-' + p.id);
                    if (card) {
                        const elSP = card.querySelector('.readout-sp');
                        if (elSP) elSP.textContent = `SP = ${formatVal(SP)}`;
                        const elPM = card.querySelector('.readout-pm');
                        if (elPM) elPM.textContent = `PM = ${formatVal(PM)}`;
                        const elRat = card.querySelector('.readout-ratio');
                        if (elRat) elRat.textContent = `SP / PM = ${formatVal(ratio)} = e`;
                    }
                    
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 6]);
                    
                    ctx.beginPath(); ctx.moveTo(toScrX(S.x), toScrY(S.y)); ctx.lineTo(toScrX(p.x), toScrY(p.y)); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(toScrX(p.x), toScrY(p.y)); ctx.lineTo(toScrX(M.x), toScrY(M.y)); ctx.stroke();
                    ctx.setLineDash([]);
                    
                    ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(toScrX(M.x), toScrY(M.y), 4, 0, Math.PI*2); ctx.fill();
                    
                    const boxSize = 10 / scale; 
                    const mpLen = Math.hypot(p.x - M.x, p.y - M.y);
                    if (mpLen > 1e-6) {
                        const dx1 = (p.x - M.x) / mpLen;
                        const dy1 = (p.y - M.y) / mpLen;
                        const lLen = Math.hypot(-ny, nx);
                        const dx2 = -ny / lLen;
                        const dy2 = nx / lLen;
                        
                        ctx.beginPath();
                        ctx.moveTo(toScrX(M.x + boxSize*dx1), toScrY(M.y + boxSize*dy1));
                        ctx.lineTo(toScrX(M.x + boxSize*dx1 + boxSize*dx2), toScrY(M.y + boxSize*dy1 + boxSize*dy2));
                        ctx.lineTo(toScrX(M.x + boxSize*dx2), toScrY(M.y + boxSize*dy2));
                        ctx.stroke();
                    }
                    
                    if (p.floatMath) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '12px monospace';
                        ctx.textAlign = 'left';
                        const textX = toScrX(p.x) + 20;
                        const textY = toScrY(p.y) + 20;
                        
                        ctx.fillStyle = 'rgba(0,0,0,0.7)';
                        ctx.fillRect(textX - 8, textY - 8, 140, 65);
                        ctx.strokeStyle = p.color;
                        ctx.lineWidth = 1;
                        ctx.strokeRect(textX - 8, textY - 8, 140, 65);
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(`SP = ${formatVal(SP)}`, textX, textY + 5);
                        ctx.fillText(`PM = ${formatVal(PM)}`, textX, textY + 22);
                        ctx.fillStyle = p.color;
                        ctx.fillText(`Ratio = ${formatVal(ratio)}`, textX, textY + 44);
                    }
                }
            }
        }
    });
}

let lastTime = 0;

function updateLoop(timeMs) {
    const dt = (timeMs - lastTime) / 1000;
    lastTime = timeMs;

    let wantsNextFrame = false;

    conics.forEach(c => {
        Object.values(c.styles).forEach(s => {
            if (s.show && (s.effect === 'neon' || s.effect === 'flicker')) wantsNextFrame = true;
        });
    });

    points.forEach(p => {
        if (p.isPlaying && p.isSnapped && p.snappedConicId !== null) {
            wantsNextFrame = true;
            p.tParam += p.speed * dt;
            
            const c = conics.find(cx => cx.id === p.snappedConicId);
            if (c) {
                let mathX = undefined, mathY = undefined;
                if (c.type === 'Ellipse') {
                    const { a, b, center: {x: h, y: k}, theta, isMajorX } = c;
                    const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
                    const X = a * Math.cos(p.tParam);
                    const Y = b * Math.sin(p.tParam);
                    mathX = h + X * Math.cos(t_adj) - Y * Math.sin(t_adj);
                    mathY = k + X * Math.sin(t_adj) + Y * Math.cos(t_adj);
                } else if (c.type === 'Hyperbola') {
                    const { a, b, center: {x: h, y: k}, theta, isMajorX } = c;
                    const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
                    const sign = Math.cos(p.tParam) > 0 ? 1 : -1;
                    const T_val = Math.tan(p.tParam / 2); 
                    const X = sign * a * Math.cosh(T_val);
                    const Y = b * Math.sinh(T_val);
                    mathX = h + X * Math.cos(t_adj) - Y * Math.sin(t_adj);
                    mathY = k + X * Math.sin(t_adj) + Y * Math.cos(t_adj);
                } else if (c.type === 'Parabola') {
                    const { center: {x: h, y: k}, theta, a_par, isMajorX } = c;
                    const t_val = Math.tan(p.tParam / 2) * 5;
                    const X = isMajorX ? (t_val*t_val)/(4*a_par) : t_val;
                    const Y = isMajorX ? t_val : (t_val*t_val)/(4*a_par);
                    mathX = h + X * Math.cos(theta) - Y * Math.sin(theta);
                    mathY = k + X * Math.sin(theta) + Y * Math.cos(theta);
                }
                
                if (mathX !== undefined) {
                    p.x = mathX;
                    p.y = mathY;
                    const card = document.getElementById('point-card-' + p.id);
                    if (card) {
                        card.querySelector('.p-x').value = Math.round(p.x * 100) / 100;
                        card.querySelector('.p-y').value = Math.round(p.y * 100) / 100;
                    }
                }
            }
        }
        
        if (p.isTracing) {
            wantsNextFrame = true;
            for (let i = p.trail.length - 1; i >= 0; i--) {
                p.trail[i].age += dt;
                if (p.trail[i].age > 10) {
                    p.trail.splice(i, 1);
                }
            }
            if (p.trail.length === 0 || Math.hypot(p.trail[p.trail.length-1].x - p.x, p.trail[p.trail.length-1].y - p.y) > 0.05) {
                p.trail.push({x: p.x, y: p.y, age: 0});
            }
        } else {
            p.trail = [];
        }
    });

    drawScene(timeMs / 1000);

    if (wantsNextFrame) {
        animationFrameId = requestAnimationFrame(updateLoop);
    } else {
        animationFrameId = null;
    }
}

function requestDraw() {
    if (!animationFrameId) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(updateLoop);
    }
}

function updateTangentSelects() {
    document.querySelectorAll('.tangent-select').forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="none">None</option>' + conics.map((c, i) => `<option value="${c.id}">Conic ${i + 1}</option>`).join('');
        sel.value = currentVal;
    });
}

function addPoint() {
    const id = Date.now();
    const p = { 
        id, x: 2, y: 2, color: '#06b6d4', targetConic: 'none', relation: 'tangents', 
        isSnapped: false, snappedConicId: null, snappedType: null, floatMath: true,
        isPlaying: false, tParam: 0, speed: 1, isTracing: false, trail: [] 
    };
    points.push(p);

    const card = document.createElement('div');
    card.className = 'conic-card';
    card.style.borderLeftColor = p.color;
    card.id = 'point-card-' + id;
    
    card.innerHTML = `
        <div class="conic-card-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:12px; height:12px; border-radius:50%; background:${p.color};"></div>
                <strong style="font-size:0.875rem;">Interactive Point</strong>
            </div>
            <button class="delete-btn">&times;</button>
        </div>
        <div style="display:flex; gap:10px; margin-top:10px;">
            <div class="input-item" style="flex:1"><label>X</label><input type="number" class="p-x" value="${p.x}" step="0.1"></div>
            <div class="input-item" style="flex:1"><label>Y</label><input type="number" class="p-y" value="${p.y}" step="0.1"></div>
        </div>
        <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
            <button class="play-btn" style="flex:0 0 32px; height:32px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:white; cursor:pointer; font-size:16px;" title="Auto-Play">▶️</button>
            <input type="range" class="speed-slider" min="-3" max="3" step="0.1" value="1" style="flex:1;">
            <label style="font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; gap:5px;">
                <input type="checkbox" class="trace-cb"> Trace
            </label>
        </div>
        <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
            <label style="font-size:0.75rem; color:#94a3b8;">Color:</label>
            <input type="color" class="p-color" value="${p.color}" style="flex:1; height:24px;">
        </div>
        <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
            <label style="font-size:0.75rem; color:#94a3b8;">Target Conic:</label>
            <select class="tangent-select" style="flex:1; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); border-radius:4px;">
                <option value="none">None</option>
            </select>
        </div>
        <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
            <label style="font-size:0.75rem; color:#94a3b8;">Relation:</label>
            <select class="relation-select" style="flex:1; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); border-radius:4px;">
                <option value="tangents">Tangents</option>
                <option value="polar">Polar Line</option>
                <option value="triangle">Tangent Triangle</option>
                <option value="sp_epm">Focus-Directrix (SP = ePM)</option>
            </select>
        </div>
        <div class="sp-epm-readout" style="display:none; flex-direction:column; gap:5px; margin-top:10px; background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.75rem; color:#94a3b8; font-weight:600;">MATH READOUT</span>
                <label style="font-size:0.7rem; display:flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="float-math-cb" checked> Float on Canvas
                </label>
            </div>
            <div style="font-family:monospace; font-size:0.875rem; margin-top:5px;">
                <div class="readout-sp">SP = -</div>
                <div class="readout-pm">PM = -</div>
                <div class="readout-ratio" style="color:var(--accent-color); font-weight:bold; margin-top:5px; padding-top:5px; border-top:1px solid rgba(255,255,255,0.1);">SP / PM = -</div>
            </div>
        </div>
    `;

    pointsContainer.appendChild(card);
    updateTangentSelects();

    card.querySelector('.p-x').addEventListener('input', e => { p.x = parseFloat(e.target.value)||0; requestDraw(); });
    card.querySelector('.p-y').addEventListener('input', e => { p.y = parseFloat(e.target.value)||0; requestDraw(); });
    card.querySelector('.p-color').addEventListener('input', e => { p.color = e.target.value; card.style.borderLeftColor = p.color; card.querySelector('div>div>div').style.background = p.color; requestDraw(); });
    card.querySelector('.tangent-select').addEventListener('change', e => { p.targetConic = e.target.value; requestDraw(); });
    card.querySelector('.relation-select').addEventListener('change', e => { 
        p.relation = e.target.value; 
        card.querySelector('.sp-epm-readout').style.display = (p.relation === 'sp_epm') ? 'flex' : 'none';
        requestDraw(); 
    });
    card.querySelector('.float-math-cb').addEventListener('change', e => { p.floatMath = e.target.checked; requestDraw(); });
    
    card.querySelector('.play-btn').addEventListener('click', e => { 
        p.isPlaying = !p.isPlaying; 
        e.target.textContent = p.isPlaying ? '⏸️' : '▶️';
        if (p.isPlaying) requestDraw();
    });
    card.querySelector('.speed-slider').addEventListener('input', e => { p.speed = parseFloat(e.target.value); });
    card.querySelector('.trace-cb').addEventListener('change', e => { 
        p.isTracing = e.target.checked; 
        if (!p.isTracing) p.trail = [];
        requestDraw(); 
    });

    card.querySelector('.delete-btn').addEventListener('click', () => {
        points = points.filter(x => x.id !== id);
        card.remove();
        requestDraw();
    });
    
    requestDraw();
}

function addConic(initParams = null) {
    const id = Date.now();
    const hue = (conics.length * 137.5) % 360; 
    const color = `hsl(${hue}, 80%, 60%)`;
    
    const c = { 
        id, color, 
        A: initParams ? initParams.A : 1, 
        B: initParams ? initParams.B : 0, 
        C: initParams ? initParams.C : 1, 
        D: initParams ? initParams.D : 0, 
        E: initParams ? initParams.E : 0, 
        F: initParams ? initParams.F : -16, 
        type: '', center: null, a: 0, b: 0, c: 0, e: 0, lr: 0, theta: 0, foci: [], directrices: [], asymptotes: [], majorAxis: null, minorAxis: null, a_par: 0, isMajorX: true,
        styles: {
            curve: { show: true, color: color, lineStyle: 'solid', effect: 'none' },
            center: { show: true, color: '#f59e0b', lineStyle: 'solid', effect: 'none' },
            foci: { show: true, color: '#a855f7', lineStyle: 'solid', effect: 'none' },
            directrices: { show: true, color: '#10b981', lineStyle: 'dashed', effect: 'none' },
            axes: { show: true, color: '#94a3b8', lineStyle: 'dotted', effect: 'none' },
            asymptotes: { show: true, color: '#ef4444', lineStyle: 'dashed', effect: 'none' }
        }
    };
    conics.push(c);
    updateTangentSelects();
    
    const card = document.createElement('div');
    card.className = 'conic-card';
    card.style.borderLeftColor = color;
    card.id = `card-${id}`;
    
    const buildStyleRow = (key, label) => `
        <div style="display:grid; grid-template-columns: 80px 30px 1fr 1fr; gap:5px; align-items:center; margin-bottom:5px; font-size:0.75rem;">
            <label><input type="checkbox" class="st-show-${key}" checked> ${label}</label>
            <input type="color" class="st-color-${key}" value="${c.styles[key].color}" style="width:100%; height:20px;">
            <select class="st-line-${key}" style="background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); border-radius:4px;">
                <option value="solid" ${c.styles[key].lineStyle==='solid'?'selected':''}>Solid</option>
                <option value="dashed" ${c.styles[key].lineStyle==='dashed'?'selected':''}>Dashed</option>
                <option value="dotted" ${c.styles[key].lineStyle==='dotted'?'selected':''}>Dotted</option>
            </select>
            <select class="st-eff-${key}" style="background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); border-radius:4px;">
                <option value="none">Normal</option>
                <option value="neon">Neon</option>
                <option value="flicker">Flicker</option>
            </select>
        </div>
    `;

    card.innerHTML = `
        <div class="conic-card-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:12px; height:12px; border-radius:50%; background:${color};"></div>
                <strong style="font-size:0.875rem;">Conic ${conics.length}</strong>
            </div>
            <button class="delete-btn">&times;</button>
        </div>
        <div class="equation-container" style="margin-bottom:10px;">
            <input type="text" class="freeform-input" placeholder="e.g. x^2/4 + y^2 = 1">
            <div class="main-equation" style="margin-top: 10px;"></div>
            <div class="equation-error error-msg" style="display: none; color: #ef4444; font-size: 0.75rem; margin-top: 5px;">Invalid equation</div>
        </div>
        <details class="details-section">
            <summary>Element Styling (Color/FX)</summary>
            <div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;">
                ${buildStyleRow('curve', 'Curve')}
                ${buildStyleRow('center', 'Center')}
                ${buildStyleRow('foci', 'Foci')}
                ${buildStyleRow('directrices', 'Dir')}
                ${buildStyleRow('axes', 'Axes')}
                ${buildStyleRow('asymptotes', 'Asym')}
            </div>
        </details>
        <details class="details-section">
            <summary>Manual Coefficients</summary>
            <div class="input-grid" style="margin-top: 10px;">
                <div class="input-item"><label>A</label><input type="number" class="coeff-a" value="${c.A}" step="0.1"></div>
                <div class="input-item"><label>B</label><input type="number" class="coeff-b" value="${c.B}" step="0.1"></div>
                <div class="input-item"><label>C</label><input type="number" class="coeff-c" value="${c.C}" step="0.1"></div>
                <div class="input-item"><label>D</label><input type="number" class="coeff-d" value="${c.D}" step="0.1"></div>
                <div class="input-item"><label>E</label><input type="number" class="coeff-e" value="${c.E}" step="0.1"></div>
                <div class="input-item"><label>F</label><input type="number" class="coeff-f" value="${c.F}" step="0.1"></div>
            </div>
        </details>
        <details class="details-section">
            <summary>Calculated Properties</summary>
            <div class="properties-list">
                <div class="property-item"><span class="prop-label">Type</span><span class="prop-value prop-type">-</span></div>
                <div class="property-item"><span class="prop-label">Center</span><span class="prop-value prop-center">-</span></div>
                <div class="property-item"><span class="prop-label">Semi-Major(a)</span><span class="prop-value prop-a">-</span></div>
                <div class="property-item"><span class="prop-label">Semi-Minor(b)</span><span class="prop-value prop-b">-</span></div>
                <div class="property-item"><span class="prop-label">Eccentricity(e)</span><span class="prop-value prop-e">-</span></div>
                <div class="property-item"><span class="prop-label">Latus Rectum</span><span class="prop-value prop-lr">-</span></div>
                <details class="details-section"><summary>Foci</summary><div class="details-content details-foci">-</div></details>
                <details class="details-section"><summary>Directrices</summary><div class="details-content details-directrices">-</div></details>
                <details class="details-section"><summary>Asymptotes</summary><div class="details-content details-asymptotes">-</div></details>
            </div>
        </details>
    `;
    
    conicsContainer.appendChild(card);
    
    const bindStyle = (key) => {
        card.querySelector(`.st-show-${key}`).addEventListener('change', e => { c.styles[key].show = e.target.checked; requestDraw(); });
        card.querySelector(`.st-color-${key}`).addEventListener('input', e => { c.styles[key].color = e.target.value; requestDraw(); });
        card.querySelector(`.st-line-${key}`).addEventListener('change', e => { c.styles[key].lineStyle = e.target.value; requestDraw(); });
        card.querySelector(`.st-eff-${key}`).addEventListener('change', e => { c.styles[key].effect = e.target.value; requestDraw(); });
    };
    ['curve', 'center', 'foci', 'directrices', 'axes', 'asymptotes'].forEach(bindStyle);

    const freeformInput = card.querySelector('.freeform-input');
    const equationError = card.querySelector('.equation-error');
    const inputs = ['a','b','c','d','e','f'].reduce((acc,k)=>{acc[k]=card.querySelector(`.coeff-${k}`);return acc;}, {});
    
    Object.values(inputs).forEach(input => input.addEventListener('input', () => {
        freeformInput.value = '';
        c.A = parseFloat(inputs.a.value)||0; c.B = parseFloat(inputs.b.value)||0; c.C = parseFloat(inputs.c.value)||0;
        c.D = parseFloat(inputs.d.value)||0; c.E = parseFloat(inputs.e.value)||0; c.F = parseFloat(inputs.f.value)||0;
        updateMath(c, card); requestDraw();
    }));
    
    freeformInput.addEventListener('input', (e) => {
        const expr = e.target.value.trim();
        if (!expr) return;
        let parsed = expr.replace(/\s+/g, '').toLowerCase();
        if (parsed.includes('=')) { let p = parsed.split('='); parsed = `(${p[0]})-(${p[1]})`; }
        parsed = parsed.replace(/\^/g, '**').replace(/([0-9])([a-z\(])/g, '$1*$2').replace(/([a-z])([0-9a-z\(])/g, '$1*$2').replace(/\)([0-9a-z\(])/g, ')*$1');
        try {
            const f = new Function('x', 'y', `return ${parsed};`);
            const F_val = f(0,0), A_val = (f(1,0)+f(-1,0)-2*F_val)/2, D_val = (f(1,0)-f(-1,0))/2;
            const C_val = (f(0,1)+f(0,-1)-2*F_val)/2, E_val = (f(0,1)-f(0,-1))/2;
            const B_val = f(1,1) - (A_val + C_val + D_val + E_val + F_val);
            if ([A_val,B_val,C_val,D_val,E_val,F_val].some(isNaN)) throw new Error('NaN');
            inputs.a.value = c.A = formatVal(A_val); inputs.b.value = c.B = formatVal(B_val); inputs.c.value = c.C = formatVal(C_val);
            inputs.d.value = c.D = formatVal(D_val); inputs.e.value = c.E = formatVal(E_val); inputs.f.value = c.F = formatVal(F_val);
            equationError.style.display = 'none';
            updateMath(c, card); requestDraw();
        } catch(err) { equationError.style.display = 'block'; }
    });
    
    card.querySelector('.delete-btn').addEventListener('click', () => {
        conics = conics.filter(x => x.id !== id);
        card.remove();
        updateTangentSelects();
        requestDraw();
    });
    
    updateMath(c, card);
}

document.getElementById('add-conic-btn').addEventListener('click', () => { addConic(); requestDraw(); });
document.getElementById('add-point-btn').addEventListener('click', () => { addPoint(); requestDraw(); });

resize();

// Board toolbar handlers
const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', () => {
    const sidePanel = document.getElementById('side-panel');
    const geoPanel = document.getElementById('geometry-panel');
    const openGeoBtn = document.getElementById('open-geo-panel');
    
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            // Hide side panels in fullscreen mode
            sidePanel.classList.remove('open');
            sidePanel.style.display = 'none';
            geoPanel.classList.add('hidden');
            openGeoBtn.classList.add('hidden');
            const toggleBtn = document.getElementById('toggle-panel');
            if (toggleBtn) toggleBtn.textContent = '▶';
            const openBtn = document.getElementById('open-panel');
            if (openBtn) openBtn.classList.remove('hidden');
            resize();
            requestDraw();
        }).catch(err => console.log(err));
    } else {
        document.exitFullscreen().then(() => {
            // Restore side panel visibility
            sidePanel.classList.add('open');
            sidePanel.style.display = '';
            openGeoBtn.classList.remove('hidden');
            const toggleBtn = document.getElementById('toggle-panel');
            if (toggleBtn) toggleBtn.textContent = '◀';
            const openBtn = document.getElementById('open-panel');
            if (openBtn) openBtn.classList.add('hidden');
            resize();
            requestDraw();
        }).catch(err => console.log(err));
    }
});
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        const sidePanel = document.getElementById('side-panel');
        sidePanel.classList.add('open');
        sidePanel.style.display = '';
        const openGeoBtn = document.getElementById('open-geo-panel');
        if (openGeoBtn) openGeoBtn.classList.remove('hidden');
        const toggleBtn = document.getElementById('toggle-panel');
        if (toggleBtn) toggleBtn.textContent = '◀';
        const openBtn = document.getElementById('open-panel');
        if (openBtn) openBtn.classList.add('hidden');
        resize();
        requestDraw();
    }
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('A')) {
    addConic({
        A: parseFloat(urlParams.get('A'))||0,
        B: parseFloat(urlParams.get('B'))||0,
        C: parseFloat(urlParams.get('C'))||0,
        D: parseFloat(urlParams.get('D'))||0,
        E: parseFloat(urlParams.get('E'))||0,
        F: parseFloat(urlParams.get('F'))||0
    });
} else {
    addConic();
}

requestDraw();
