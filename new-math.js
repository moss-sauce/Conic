function updateMath() {
    const A = parseFloat(inputs.a.value) || 0;
    const B = parseFloat(inputs.b.value) || 0;
    const C = parseFloat(inputs.c.value) || 0;
    const D = parseFloat(inputs.d.value) || 0;
    const E = parseFloat(inputs.e.value) || 0;
    const F = parseFloat(inputs.f.value) || 0;

    conicData = { A, B, C, D, E, F };
    clearProps();

    // Equation Display
    const term = (c, v, first) => {
        if (c === 0) return '';
        let str = '';
        if (c < 0) str = ' - ';
        else if (!first) str = ' + ';
        let val = Math.abs(c);
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
    if (window.katex) katex.render(eq, mainEquation, { displayMode: true, throwOnError: false });

    if (A===0 && B===0 && C===0) {
        props.type.textContent = "Line (Degenerate)";
        conicData.type = 'Degenerate';
        draw(); return;
    }

    const delta = A*C - (B*B)/4;
    let theta = 0;
    if (Math.abs(A - C) < 1e-10) {
        theta = B > 0 ? Math.PI/4 : (B < 0 ? -Math.PI/4 : 0);
    } else {
        theta = 0.5 * Math.atan2(B, A - C);
    }
    
    let c_t = Math.cos(theta), s_t = Math.sin(theta);
    let Ap = A*c_t*c_t + B*c_t*s_t + C*s_t*s_t;
    let Cp = A*s_t*s_t - B*c_t*s_t + C*c_t*c_t;
    let Dp = D*c_t + E*s_t;
    let Ep = -D*s_t + E*c_t;
    let Fp = F;

    if (Math.abs(Ap) < 1e-8) Ap = 0;
    if (Math.abs(Cp) < 1e-8) Cp = 0;

    conicData.theta = theta;
    props.theta.textContent = `${formatVal(theta * 180 / Math.PI)}°`;

    if (Math.abs(delta) > 1e-8) {
        // Central Conic
        const hp = -Dp / (2*Ap);
        const kp = -Ep / (2*Cp);
        const K = (Dp*Dp)/(4*Ap) + (Ep*Ep)/(4*Cp) - Fp;
        
        const h = hp*c_t - kp*s_t;
        const k = hp*s_t + kp*c_t;
        conicData.center = {x: h, y: k};
        props.center.textContent = `(${formatVal(h)}, ${formatVal(k)})`;

        if (Math.abs(K) < 1e-8) {
            props.type.textContent = "Degenerate (Point/Lines)";
            props.type.style.color = '#ef4444';
            conicData.type = 'Degenerate';
        } else {
            const vA = K / Ap;
            const vC = K / Cp;
            
            if (vA > 0 && vC > 0) {
                conicData.type = 'Ellipse';
                props.type.textContent = "Ellipse";
                props.type.style.color = '#10b981';
                
                const a2 = Math.max(vA, vC);
                const b2 = Math.min(vA, vC);
                conicData.a = Math.sqrt(a2);
                conicData.b = Math.sqrt(b2);
                conicData.isMajorX = (vA >= vC);
                
                const focalDist = Math.sqrt(Math.abs(a2 - b2));
                const e = focalDist / conicData.a;
                
                props.a.textContent = formatVal(conicData.a);
                props.b.textContent = formatVal(conicData.b);
                props.c.textContent = formatVal(focalDist);
                props.e.textContent = formatVal(e);
                props.lr.textContent = formatVal(2 * b2 / conicData.a);
                
                const t_adj = theta + (conicData.isMajorX ? 0 : Math.PI/2);
                const dx = focalDist * Math.cos(t_adj);
                const dy = focalDist * Math.sin(t_adj);
                conicData.foci = [{x: h+dx, y: k+dy}, {x: h-dx, y: k-dy}];
                detailsFoci.textContent = `F1: (${formatVal(h+dx)}, ${formatVal(k+dy)})\nF2: (${formatVal(h-dx)}, ${formatVal(k-dy)})`;
                
                const dirDist = a2 / focalDist;
                const dnx = Math.cos(t_adj), dny = Math.sin(t_adj);
                conicData.directrices = [
                    {nx: dnx, ny: dny, d: dnx*h + dny*k + dirDist},
                    {nx: dnx, ny: dny, d: dnx*h + dny*k - dirDist}
                ];
                detailsDir.textContent = `D1: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(conicData.directrices[0].d)}\nD2: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(conicData.directrices[1].d)}`;
                
            } else if (vA * vC < 0) {
                conicData.type = 'Hyperbola';
                props.type.textContent = "Hyperbola";
                props.type.style.color = '#3b82f6';
                
                conicData.isMajorX = (vA > 0);
                const a2 = conicData.isMajorX ? vA : vC;
                const b2 = Math.abs(conicData.isMajorX ? vC : vA);
                
                conicData.a = Math.sqrt(a2);
                conicData.b = Math.sqrt(b2);
                
                const focalDist = Math.sqrt(a2 + b2);
                const e = focalDist / conicData.a;
                
                props.a.textContent = formatVal(conicData.a);
                props.b.textContent = formatVal(conicData.b);
                props.c.textContent = formatVal(focalDist);
                props.e.textContent = formatVal(e);
                props.lr.textContent = formatVal(2 * b2 / conicData.a);
                
                const t_adj = theta + (conicData.isMajorX ? 0 : Math.PI/2);
                const dx = focalDist * Math.cos(t_adj);
                const dy = focalDist * Math.sin(t_adj);
                conicData.foci = [{x: h+dx, y: k+dy}, {x: h-dx, y: k-dy}];
                detailsFoci.textContent = `F1: (${formatVal(h+dx)}, ${formatVal(k+dy)})\nF2: (${formatVal(h-dx)}, ${formatVal(k-dy)})`;
                
                const dirDist = a2 / focalDist;
                const dnx = Math.cos(t_adj), dny = Math.sin(t_adj);
                conicData.directrices = [
                    {nx: dnx, ny: dny, d: dnx*h + dny*k + dirDist},
                    {nx: dnx, ny: dny, d: dnx*h + dny*k - dirDist}
                ];
                detailsDir.textContent = `D1: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(conicData.directrices[0].d)}\nD2: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(conicData.directrices[1].d)}`;
                
                const m = conicData.b / conicData.a;
                const v1 = {x: Math.cos(t_adj) - m*Math.sin(t_adj), y: Math.sin(t_adj) + m*Math.cos(t_adj)};
                const v2 = {x: Math.cos(t_adj) + m*Math.sin(t_adj), y: Math.sin(t_adj) - m*Math.cos(t_adj)};
                conicData.asymptotes = [
                    {nx: -v1.y, ny: v1.x, d: -v1.y*h + v1.x*k},
                    {nx: -v2.y, ny: v2.x, d: -v2.y*h + v2.x*k}
                ];
                detailsAsym.textContent = `A1: ${formatVal(-v1.y)}x + ${formatVal(v1.x)}y = ${formatVal(conicData.asymptotes[0].d)}\nA2: ${formatVal(-v2.y)}x + ${formatVal(v2.x)}y = ${formatVal(conicData.asymptotes[1].d)}`;
            } else {
                props.type.textContent = "Imaginary Ellipse";
                props.type.style.color = '#ef4444';
                conicData.type = 'Degenerate';
            }
        }
        
        conicData.majorAxis = {nx: Math.sin(theta), ny: -Math.cos(theta), d: Math.sin(theta)*h - Math.cos(theta)*k};
        conicData.minorAxis = {nx: Math.cos(theta), ny: Math.sin(theta), d: Math.cos(theta)*h + Math.sin(theta)*k};
        
    } else {
        // Parabola
        conicData.type = 'Parabola';
        props.type.textContent = "Parabola";
        props.type.style.color = '#f59e0b';
        
        let p, hp, kp, h, k;
        
        if (Ap === 0) { // Cp y'^2 + Dp x' + Ep y' + Fp = 0
            if (Math.abs(Dp) < 1e-8) {
                conicData.type = 'Degenerate';
                props.type.textContent = "Degenerate Parabola";
            } else {
                kp = -Ep / (2*Cp);
                hp = (Ep*Ep/(4*Cp) - Fp) / Dp;
                p = -Dp / (4*Cp);
                h = hp*c_t - kp*s_t;
                k = hp*s_t + kp*c_t;
                conicData.center = {x: h, y: k};
                conicData.a_par = p;
                conicData.isMajorX = true; // Y^2 = 4pX
            }
        } else { // Ap x'^2 + Dp x' + Ep y' + Fp = 0
            if (Math.abs(Ep) < 1e-8) {
                conicData.type = 'Degenerate';
                props.type.textContent = "Degenerate Parabola";
            } else {
                hp = -Dp / (2*Ap);
                kp = (Dp*Dp/(4*Ap) - Fp) / Ep;
                p = -Ep / (4*Ap);
                h = hp*c_t - kp*s_t;
                k = hp*s_t + kp*c_t;
                conicData.center = {x: h, y: k};
                conicData.a_par = p;
                conicData.isMajorX = false; // X^2 = 4pY
            }
        }
        
        if (conicData.type === 'Parabola') {
            props.center.textContent = `Vertex: (${formatVal(h)}, ${formatVal(k)})`;
            props.lr.textContent = formatVal(Math.abs(4*p));
            
            const t_adj = theta + (conicData.isMajorX ? 0 : Math.PI/2);
            const fx = h + p * Math.cos(t_adj);
            const fy = k + p * Math.sin(t_adj);
            
            conicData.foci = [{x: fx, y: fy}];
            detailsFoci.textContent = `F: (${formatVal(fx)}, ${formatVal(fy)})`;
            
            const dnx = Math.cos(t_adj), dny = Math.sin(t_adj);
            const d_dist = dnx*(h - p*dnx) + dny*(k - p*dny);
            conicData.directrices = [{nx: dnx, ny: dny, d: d_dist}];
            detailsDir.textContent = `Dir: ${formatVal(dnx)}x + ${formatVal(dny)}y = ${formatVal(d_dist)}`;
            
            conicData.majorAxis = {nx: -dny, ny: dnx, d: -dny*h + dnx*k};
        }
    }
    
    draw();
}

function clearProps() {
    ['center', 'a', 'b', 'c', 'e', 'lr', 'theta'].forEach(id => props[id].textContent = '-');
    detailsFoci.textContent = '-';
    detailsDir.textContent = '-';
    detailsAsym.textContent = '-';
    conicData.foci = [];
    conicData.directrices = [];
    conicData.asymptotes = [];
    conicData.majorAxis = null;
    conicData.minorAxis = null;
}

function drawLine(lineEq, color, dashed = false) {
    if (!lineEq) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    if (dashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    
    ctx.beginPath();
    const {nx, ny, d} = lineEq;
    
    if (Math.abs(ny) > Math.abs(nx)) {
        const x1 = toMathX(0), x2 = toMathX(width);
        const y1 = (d - nx*x1)/ny, y2 = (d - nx*x2)/ny;
        ctx.moveTo(toScrX(x1), toScrY(y1));
        ctx.lineTo(toScrX(x2), toScrY(y2));
    } else {
        const y1 = toMathY(height), y2 = toMathY(0);
        const x1 = (d - ny*y1)/nx, x2 = (d - ny*y2)/nx;
        ctx.moveTo(toScrX(x1), toScrY(y1));
        ctx.lineTo(toScrX(x2), toScrY(y2));
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function draw() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = toMathX(0), endX = toMathX(width);
    const startY = toMathY(height), endY = toMathY(0);
    const step = Math.pow(10, Math.floor(Math.log10(width / scale / 2)));
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

    // Conic Parametric Renderer
    ctx.strokeStyle = colors.curve;
    ctx.lineWidth = 2.5;
    
    if (conicData.type === 'Ellipse' && conicData.a && conicData.b) {
        ctx.beginPath();
        const { a, b, center: {x: h, y: k}, theta, isMajorX } = conicData;
        const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
        for (let i = 0; i <= 200; i++) {
            const t = (i / 200) * Math.PI * 2;
            const X = a * Math.cos(t);
            const Y = b * Math.sin(t);
            const x = h + X * Math.cos(t_adj) - Y * Math.sin(t_adj);
            const y = k + X * Math.sin(t_adj) + Y * Math.cos(t_adj);
            if (i === 0) ctx.moveTo(toScrX(x), toScrY(y));
            else ctx.lineTo(toScrX(x), toScrY(y));
        }
        ctx.stroke();
    } else if (conicData.type === 'Hyperbola' && conicData.a && conicData.b) {
        const { a, b, center: {x: h, y: k}, theta, isMajorX } = conicData;
        const maxDist = Math.max(width, height) / scale * 1.5;
        const T = Math.acosh(Math.max(1.1, maxDist / a));
        const t_adj = theta + (isMajorX ? 0 : Math.PI/2);
        
        const drawBranch = (sign) => {
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const t = -T + (i / 100) * (2 * T);
                const X = sign * a * Math.cosh(t);
                const Y = b * Math.sinh(t);
                const x = h + X * Math.cos(t_adj) - Y * Math.sin(t_adj);
                const y = k + X * Math.sin(t_adj) + Y * Math.cos(t_adj);
                if (i === 0) ctx.moveTo(toScrX(x), toScrY(y));
                else ctx.lineTo(toScrX(x), toScrY(y));
            }
            ctx.stroke();
        };
        drawBranch(1);
        drawBranch(-1);
    } else if (conicData.type === 'Parabola' && conicData.a_par) {
        const { center: {x: h, y: k}, theta, a_par, isMajorX } = conicData;
        const maxDist = Math.max(width, height) / scale * 1.5;
        const T = Math.sqrt(Math.abs(maxDist / Math.abs(a_par)));
        
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
            const t = -T + (i / 200) * (2 * T);
            // If isMajorX, opens along rotated X: Y^2 = 4pX => Y=t, X = t^2 / 4p
            // If !isMajorX, opens along rotated Y: X^2 = 4pY => X=t, Y = t^2 / 4p
            const X = isMajorX ? (t*t) / (4*a_par) : t;
            const Y = isMajorX ? t : (t*t) / (4*a_par);
            
            const x = h + X * Math.cos(theta) - Y * Math.sin(theta);
            const y = k + X * Math.sin(theta) + Y * Math.cos(theta);
            if (i === 0) ctx.moveTo(toScrX(x), toScrY(y));
            else ctx.lineTo(toScrX(x), toScrY(y));
        }
        ctx.stroke();
    } else if (conicData.type === 'Degenerate') {
        ctx.fillStyle = colors.curve;
        const {A, B, C, D, E, F} = conicData;
        for (let px = 0; px < width; px++) {
            const x = toMathX(px);
            const a = C; const b = B*x + E; const c = A*x*x + D*x + F;
            if (Math.abs(a) > 1e-6) {
                const det = b*b - 4*a*c;
                if (det >= 0) {
                    ctx.fillRect(px, toScrY((-b + Math.sqrt(det))/(2*a)), 2, 2);
                    ctx.fillRect(px, toScrY((-b - Math.sqrt(det))/(2*a)), 2, 2);
                }
            }
        }
        for (let py = 0; py < height; py++) {
            const y = toMathY(py);
            const a = A; const b = B*y + D; const c = C*y*y + E*y + F;
            if (Math.abs(a) > 1e-6) {
                const det = b*b - 4*a*c;
                if (det >= 0) {
                    ctx.fillRect(toScrX((-b + Math.sqrt(det))/(2*a)), py, 2, 2);
                    ctx.fillRect(toScrX((-b - Math.sqrt(det))/(2*a)), py, 2, 2);
                }
            }
        }
    }

    if (toggles.axes.checked) {
        drawLine(conicData.majorAxis, 'rgba(255,255,255,0.2)', true);
        drawLine(conicData.minorAxis, 'rgba(255,255,255,0.2)', true);
    }
    if (toggles.asymptotes.checked && conicData.asymptotes) {
        conicData.asymptotes.forEach(l => drawLine(l, 'rgba(239,68,68,0.5)', true));
    }
    if (toggles.directrices.checked && conicData.directrices) {
        conicData.directrices.forEach(l => drawLine(l, 'rgba(16,185,129,0.5)', false));
    }
    
    if (toggles.center.checked && conicData.center) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(toScrX(conicData.center.x), toScrY(conicData.center.y), 4, 0, Math.PI*2);
        ctx.fill();
    }
    
    if (toggles.foci.checked && conicData.foci) {
        ctx.fillStyle = '#a855f7';
        conicData.foci.forEach(f => {
            ctx.beginPath();
            ctx.arc(toScrX(f.x), toScrY(f.y), 4, 0, Math.PI*2);
            ctx.fill();
        });
    }
}

resize();
updateMath();


document.getElementById('deep-dive-link').addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'conic-details.html?A=' + conicData.A + '&B=' + conicData.B + '&C=' + conicData.C + '&D=' + conicData.D + '&E=' + conicData.E + '&F=' + conicData.F; });
