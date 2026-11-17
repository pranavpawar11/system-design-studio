/**
 * A small, safe formula language for labs. No eval, no property access, no assignment.
 *   numbers, names, + - * / , comparisons (< <= > >= == !=), && || !, parentheses,
 *   true/false (1/0), functions: min max abs round ceil floor pow sqrt log2
 * Booleans are numbers (1 or 0). Dividing by zero gives NaN, which the UI shows as "—".
 */
export class ExpressionError extends Error {}

type Tok = { t: 'num' | 'id' | 'op' | 'end'; v: string };
const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '<', '>', '!', '(', ')', ','];
function tokenize(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExpressionError(`Unexpected "${c}" in "${src}"`);
    out.push({ t: 'op', v: op }); i += op.length;
  }
  out.push({ t: 'end', v: '' }); return out;
}

type Node = { k: 'num'; v: number } | { k: 'var'; n: string } | { k: 'un'; op: string; a: Node } | { k: 'bin'; op: string; a: Node; b: Node } | { k: 'call'; fn: string; args: Node[] };
const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, round: Math.round, ceil: Math.ceil, floor: Math.floor, pow: Math.pow, sqrt: Math.sqrt, log2: Math.log2,
};

function parse(src: string): Node {
  const toks = tokenize(src); let p = 0;
  const peek = () => toks[p]; const next = () => toks[p++];
  const accept = (v: string) => (peek().t === 'op' && peek().v === v ? (p++, true) : false);
  const bin = (sub: () => Node, ops: string[]): Node => { let a = sub(); for (;;) { const o = ops.find((x) => peek().t === 'op' && peek().v === x); if (!o) return a; p++; a = { k: 'bin', op: o, a, b: sub() }; } };
  const primary = (): Node => {
    const t = next();
    if (t.t === 'num') return { k: 'num', v: Number(t.v) };
    if (t.t === 'id') {
      if (t.v === 'true') return { k: 'num', v: 1 }; if (t.v === 'false') return { k: 'num', v: 0 };
      if (accept('(')) {
        if (!(t.v in FUNCS)) throw new ExpressionError(`Unknown function "${t.v}" in "${src}"`);
        const args: Node[] = []; if (!accept(')')) { do args.push(or()); while (accept(',')); if (!accept(')')) throw new ExpressionError(`Missing ")" in "${src}"`); }
        return { k: 'call', fn: t.v, args };
      }
      return { k: 'var', n: t.v };
    }
    if (t.t === 'op' && t.v === '(') { const e = or(); if (!accept(')')) throw new ExpressionError(`Missing ")" in "${src}"`); return e; }
    throw new ExpressionError(`Unexpected ${t.t === 'end' ? 'end of formula' : `"${t.v}"`} in "${src}"`);
  };
  const unary = (): Node => (accept('-') ? { k: 'un', op: '-', a: unary() } : accept('!') ? { k: 'un', op: '!', a: unary() } : primary());
  const mul = () => bin(unary, ['*', '/']); const add = () => bin(mul, ['+', '-']);
  const cmp = () => bin(add, ['<=', '>=', '==', '!=', '<', '>']); const and = () => bin(cmp, ['&&']); const or = (): Node => bin(and, ['||']);
  const tree = or();
  if (peek().t !== 'end') throw new ExpressionError(`Unexpected "${peek().v}" in "${src}"`);
  return tree;
}

function run(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case 'num': return n.v;
    // Own properties only: `in` would also match inherited names such as constructor, toString and __proto__.
    case 'var': { if (!Object.prototype.hasOwnProperty.call(vars, n.n) || typeof vars[n.n] !== 'number') throw new ExpressionError(`Unknown name "${n.n}"`); return vars[n.n]; }
    case 'un': return n.op === '-' ? -run(n.a, vars) : run(n.a, vars) ? 0 : 1;
    case 'call': return FUNCS[n.fn](...n.args.map((a) => run(a, vars)));
    case 'bin': {
      const a = run(n.a, vars); const b = run(n.b, vars);
      switch (n.op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b === 0 ? NaN : a / b;
        case '<': return +(a < b); case '<=': return +(a <= b); case '>': return +(a > b); case '>=': return +(a >= b);
        case '==': return +(a === b); case '!=': return +(a !== b); case '&&': return +(!!a && !!b); default: return +(!!a || !!b);
      }
    }
  }
}
const names = (n: Node, out = new Set<string>()): Set<string> => {
  if (n.k === 'var') out.add(n.n); else if (n.k === 'un') names(n.a, out); else if (n.k === 'bin') { names(n.a, out); names(n.b, out); } else if (n.k === 'call') n.args.forEach((a) => names(a, out));
  return out;
};

export interface Compiled { source: string; names: string[]; evaluate(vars: Record<string, number>): number }
export function compile(source: string): Compiled {
  const tree = parse(source);
  return { source, names: [...names(tree)], evaluate: (vars) => { const v = run(tree, vars); return Number.isFinite(v) ? v : NaN; } };
}
