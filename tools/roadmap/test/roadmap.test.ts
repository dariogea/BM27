import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs module without types
import * as r from '../roadmap.mjs';

const mini = {
  fases: [
    { id: 'F0', t: 'A', meta: 'm' },
    { id: 'F1', t: 'B', meta: 'm' },
  ],
  areas: [
    {
      t: 'Área 1',
      why: 'x',
      f: 'F0',
      c: [
        { t: 'hecha', s: 'hecho' },
        { t: 'a medias', s: 'en-curso', p: 50 },
        {
          t: 'grupo',
          f: 'F1',
          c: [
            { t: 'pendiente', s: 'pendiente' },
            { t: 'otra', s: 'bloqueado' },
          ],
        },
      ],
    },
    { t: 'Aparte', why: 'y', f: 'F1', aparte: true, c: [{ t: 'idea', s: 'idea' }] },
  ],
};

describe('roadmap: porcentajes', () => {
  it('hecho vale 100, en curso su estimación, el resto 0', () => {
    expect(r.leafPercent({ s: 'hecho' })).toBe(100);
    expect(r.leafPercent({ s: 'en-curso', p: 30 })).toBe(30);
    expect(r.leafPercent({ s: 'en-curso' })).toBe(50);
    expect(r.leafPercent({ s: 'pendiente' })).toBe(0);
    expect(r.leafPercent({ s: 'bloqueado' })).toBe(0);
    expect(r.leafPercent({ s: 'idea' })).toBe(0);
  });

  it('el total es la media de los elementos y excluye lo «aparte»', () => {
    const s = r.summarize(mini);
    expect(s.leaves).toBe(4);
    expect(s.total).toBeCloseTo((100 + 50 + 0 + 0) / 4);
  });

  it('las fases heredan del grupo y del área', () => {
    const s = r.summarize(mini);
    const f0 = s.phases.find((p: { id: string }) => p.id === 'F0');
    const f1 = s.phases.find((p: { id: string }) => p.id === 'F1');
    expect(f0.count).toBe(2);
    expect(f1.count).toBe(2);
    expect(f0.percent).toBeCloseTo(75);
    expect(f1.percent).toBe(0);
  });
});

describe('roadmap: validación', () => {
  it('acepta datos correctos', () => {
    expect(r.validate(mini)).toEqual([]);
  });

  it('detecta estado, porcentaje, fase y dueño inválidos', () => {
    const bad = JSON.parse(JSON.stringify(mini));
    bad.areas[0].c[0].s = 'casi';
    bad.areas[0].c[1].p = 120;
    bad.areas[0].c[2].f = 'F9';
    bad.areas[0].c[2].c[0].o = 'otro';
    bad.areas[0].c[2].c[1].p = 10;
    const msgs = r.validate(bad).join('\n');
    expect(msgs).toContain('estado «casi»');
    expect(msgs).toContain('entero de 0 a 100');
    expect(msgs).toContain('fase «F9»');
    expect(msgs).toContain('dueño «otro»');
    expect(msgs).toContain('solo se usa con «en-curso»');
  });

  it('un grupo no puede llevar estado ni estar vacío', () => {
    const bad = JSON.parse(JSON.stringify(mini));
    bad.areas[0].c[2].s = 'hecho';
    bad.areas[0].c.push({ t: 'vacío', c: [] });
    const msgs = r.validate(bad).join('\n');
    expect(msgs).toContain('un grupo no lleva estado');
    expect(msgs).toContain('grupo vacío');
  });
});

describe('roadmap: archivo real', () => {
  it('docs/roadmap/roadmap.json es válido', () => {
    expect(r.validate(r.load())).toEqual([]);
  });

  it('docs/roadmap.md está al día (ejecuta «pnpm roadmap» si falla)', () => {
    expect(readFileSync(r.OUTPUT, 'utf8')).toBe(r.render(r.load()));
  });

  it('los Issues citados tienen un número plausible', () => {
    for (const l of r.leaves(r.load())) if (l.i !== undefined) expect(l.i).toBeLessThan(1000);
  });
});

describe('roadmap: portada del repositorio', () => {
  it('muestra el avance calculado y las fases con un enlace al detalle', () => {
    const text = r.renderReadme(mini);
    expect(text).toContain('Preparación estimada para lanzamiento: 38 %');
    expect(text).toContain('F0 A<br/>75 %');
    expect(text).toContain('F1 B<br/>0 %');
    expect(text).toContain('(docs/roadmap.md)');
  });

  it('preserva el texto ajeno al bloque y rechaza marcadores ausentes o duplicados', () => {
    const source = 'Antes\n<!-- roadmap:start -->\nviejo\n<!-- roadmap:end -->\nDespués\n';
    const result = r.updateReadme(source, mini);
    expect(result.startsWith('Antes\n<!-- roadmap:start -->')).toBe(true);
    expect(result.endsWith('<!-- roadmap:end -->\nDespués\n')).toBe(true);
    expect(result).not.toContain('viejo');
    expect(() => r.updateReadme('sin bloque', mini)).toThrow('único bloque');
    expect(() => r.updateReadme(source + '<!-- roadmap:start -->', mini)).toThrow('único bloque');
  });

  it('la portada real coincide con los mismos datos del roadmap completo', () => {
    const current = readFileSync(r.README, 'utf8');
    expect(current).toBe(r.updateReadme(current, r.load()));
  });
});

describe('preparación comercial ponderada', () => {
  const weighted = () => ({
    ...mini,
    fases: mini.fases.map((f, i) => ({ ...f, peso: i === 0 ? 10 : 90 })),
    evaluacion: {
      objetivo: 'Producto completo',
      criterios: [{ id: 'R1', t: 'Validación', estado: 'pendiente' }],
    },
  });
  it('no equipara una base técnica pequeña con el producto completo', () => {
    expect(r.summarize(weighted()).total).toBeCloseTo(7.5);
    expect(r.summarize(weighted()).coverage).toBeCloseTo(37.5);
  });
  it('impide el 100 % sin criterios validados y exige evidencia', () => {
    const data = weighted();
    for (const area of data.areas)
      for (const node of area.c) {
        if ('c' in node) for (const child of node.c) child.s = 'hecho';
        else node.s = 'hecho';
      }
    expect(r.summarize(data).total).toBe(99);
    data.evaluacion.criterios[0].estado = 'validado';
    expect(r.validate(data).join(' ')).toContain('evidencia');
    expect(r.validate({ ...weighted(), fases: mini.fases }).join(' ')).toContain('sumar 100');
  });
  it('mantiene el gráfico real sincronizado', () => {
    expect(readFileSync(r.DASHBOARD, 'utf8')).toBe(r.renderDashboard(r.load()));
  });
});
