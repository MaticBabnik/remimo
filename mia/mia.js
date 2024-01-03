// mia - MImo Assembler
// --------------------------------
// Usage: node mia.js > program.ram

//#region Constants
const regs = ['r0', 'r1', 'r2', 'r3'];
const [r0, r1, r2, r3] = regs;
const conditions = ['eq', 'ne', 'hs', 'lo', 'mi', 'pl', 'vs', 'vc', 'hi', 'ls', 'ge', 'lt', 'gt', 'le', 'xx', 'al']
const [eq, ne, hs, lo, mi, pl, vs, vc, hi, ls, ge, lt, gt, le, xx, al] = conditions;
//#endregion Constants

//#region Instructions
function alu(kind, a, b, { setflags, carry } = { setflags: 0, carry: 0 }) {
    let rd = 0, rs = 0, immd = 0;

    if (!regs.includes(a)) throw new Error(`Invalid register ${a}`);
    rd = regs.indexOf(a);

    if (regs.includes(b)) {
        if (a == b) throw new Error(`Cannot encode ALU op where rd == rs`);
        rs = regs.indexOf(b)
    } else if (typeof b === 'number') {
        rs = rd;
        immd = b & 0x7f;
        if (b != immd) {
            console.log(`Warning: truncating immd ${b} to ${immd}`);
        }
    } else {
        throw new Error(`Invalid second operand ${b}`);
    }

    if (rd == rs && carry) throw new Error(`Cannot encode ALU op with immediate and carry`);

    return (kind & 0x3) << 12 | rd << 10 | rs << 8 | setflags << 7 | carry << 6 | immd;
}

function mem(ls, rd, rs, offset = 0) {
    if (!regs.includes(rd)) throw new Error(`Invalid register ${rd}`);
    if (!regs.includes(rs)) throw new Error(`Invalid register ${rs}`);
    return (0b0100 | (ls & 0x1)) << 12 | regs.indexOf(rd) << 10 | regs.indexOf(rs) << 8 | offset;
}

function mvi(d, n) {
    if (!regs.includes(d)) throw new Error(`Invalid register ${d}`);
    const rd = regs.indexOf(d);

    const nw = n & 0xffff;
    if (nw != n) throw new Error(`immediate ${n} out of range`);

    const base = (0b0111 << 12) | rd << 10; // mvi rd, <empty>
    const negate = 1 << 9;
    const high = 1 << 8;

    if ((nw & 0xff00) == 0xff00) return base | negate | ((~nw) & 0xff);
    if ((nw & 0xff00) == 0) return base | nw;
    if ((nw & 0xff) == 0xff) return base | high | negate | ((~nw >> 8) & 0xff);
    if ((nw & 0xff) == 0) return base | high | (nw >> 8);

    throw new Error(`immediate ${nw} cannot be encoded (${hex(nw)})`);
}

function mov(d, v) {
    if (!regs.includes(d)) throw new Error(`Invalid register ${d}`);
    let rd = regs.indexOf(d);

    if (regs.includes(v)) {
        return (0b0110) << 12 | rd << 10 | regs.indexOf(v) << 8;
    }

    if (typeof v === 'number') return mvi(d, v);
    throw new Error(`Invalid second operand ${b}`);
}

function mvn(d, s) {
    if (!regs.includes(d)) throw new Error(`Invalid register ${d}`);
    if (!regs.includes(s)) throw new Error(`Invalid register ${s}`);
    return (0b0110) << 12 | regs.indexOf(d) << 10 | regs.indexOf(s) << 8 | 1 << 7;
}

function shift(dir, kind, d, s, len, neg = 0) {
    const immd = len & 0xf;
    if (!regs.includes(d)) throw new Error(`Invalid register ${d}`);
    if (!regs.includes(s)) throw new Error(`Invalid register ${s}`);
    if (immd != len) throw new Error(`Invalid shift length ${len}`);
    return (0b0110) << 12 | regs.indexOf(d) << 10 | regs.indexOf(s) << 8 | neg << 7 | dir << 6 | kind << 5 | immd;
}

const lsl = shift.bind(null, 0, 0),
      lsr = shift.bind(null, 1, 0),
      asr = shift.bind(null, 1, 1);

function b(address) {
    const immd = address & 0xfff;
    if (address != immd)
        throw new Error(`Branch address ${address} out of range (truncated to ${immd})`);
    return (0b1000) << 12 | immd;
}

function brc(cond, offset) {
    if (!conditions.includes(cond)) throw new Error(`Invalid condition ${cond}`);

    const clamped = Math.max(-128, Math.min(offset, 127));

    if (clamped != offset) {
        throw new Error(`offset ${offset} out of range (truncated to ${clamped})`);
    }

    const immd = clamped & 0xff;

    return (0b1001) << 12 | conditions.indexOf(cond) << 8 | immd;
}

function cmp(d, s) {
    if (!regs.includes(d)) throw new Error(`Invalid register ${d}`);
    if (!regs.includes(s)) throw new Error(`Invalid register ${s}`);
    return (0b0011) << 12 | regs.indexOf(d) << 10 | regs.indexOf(s) << 8 | 1 << 7 | 1 << 5; // setflags, flagsonly
}

function tst(d, s) {
    if (!regs.includes(d)) throw new Error(`Invalid register ${d}`);
    if (!regs.includes(s)) throw new Error(`Invalid register ${s}`);
    return regs.indexOf(d) << 10 | regs.indexOf(s) << 8 | 1 << 7 | 1 << 5; // setflags, flagsonly
}

const and = alu.bind(null, 0), orr = alu.bind(null, 1), add = alu.bind(null, 2), sub = alu.bind(null, 3), ldr = mem.bind(null, 0), str = mem.bind(null, 1);
//#endregion Instructions

//#region Tools
function hex(n, prefix = false) {
    return (prefix ? '0x' : '') + n.toString(16).padStart(4, '0');
}
//#endregion Tools

const prog = [
    mov(r0, 100),
    mov(r1, 200),
    cmp(r0, r1),
    brc(le, 127)
];

// console.log(prog.map((x, i) => `${hex(i)}: ${hex(x)}`).join('\n'))

// emit .ram file; redirect into a file and load in Logisim
{
    console.log('v3.0 hex words addressed')
    let addr = 0;
    do {
        let line = `${hex(addr)}:`;
        for (let i = 0; i < 16; i++) {
            line += ` ${hex(prog[addr + i] ?? 0, true)}`;
        }
        console.log(line);
        addr += 16;
    } while (addr < prog.length);
}
