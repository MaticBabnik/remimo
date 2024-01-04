import MiaError from "./error.js";

const REGISTERS = ["r0", "r1", "r2", "r3"];
const CONDITIONS = [
    "eq",
    "ne",
    "hs",
    "lo",
    "mi",
    "pl",
    "vs",
    "vc",
    "hi",
    "ls",
    "ge",
    "lt",
    "gt",
    "le",
    "xx",
    "al",
];
const ALUOPS = ["and", "orr", "add", "sub"];
const COMPARE = { cmp: 3, tst: 0 };
const SHIFTS = {
    lsl: [0, 0],
    lsr: [1, 0],
    asr: [1, 1],
};

function assertReg(token) {
    console.assert(token.type == "REGISTER");
    return REGISTERS.indexOf(token.value);
}

function getImmd(token, state) {
    if (token.type == "NUMBER") {
        return eval(token.value);
    } else if (token.type == "NAME") {
        return state.resolveName(token.value, token);
    } else {
        return undefined;
    }
}

function emitAlu(inst, state) {
    const aluop = ALUOPS.indexOf(inst.name);
    const rd = assertReg(inst.args[0]);
    const setflags = inst.flags?.includes("s") ? 1 : 0;
    const withCarry = inst.flags?.includes("c") ? 1 : 0;

    let b = getImmd(inst.args[1], state),
        immd = 0,
        rs;

    if (b === undefined) {
        rs = assertReg(inst.args[1]);
        if (rd == rs)
            throw new MiaError(
                isnt.token,
                "IllegalEncoding",
                "Cannot encode ALU op where rd == rs"
            );
    } else {
        rs = rd;
        immd = b & 0x7f;

        if (withCarry)
            throw new MiaError(
                isnt.token,
                "IllegalEncoding",
                "encode ALU op with immediate and carry"
            );

        // TODO: trunc warn;
    }

    return (
        (aluop << 12) |
        (rd << 10) |
        (rs << 8) |
        (setflags << 7) |
        (withCarry << 6) |
        immd
    );
}

function emitCompare(inst, state) {
    const aluop = COMPARE[inst.name];
    const [rd, rs] = inst.args.map((x) => assertReg(x));
    return (aluop << 12) | (rd << 10) | (rs << 8) | (1 << 7) | (1 << 5);
}

function emitMemory(inst, state) {
    const [rd, rs] = inst.args.slice(0, 2).map((x) => assertReg(x));

    const offset = inst.args[2] ? getImmd(inst.args[2], state) ?? 0 : 0;

    if (offset < 0 || offset > 255) {
        throw new MiaError(
            inst.token,
            "InvalidImmediate",
            "Offset must be uint8"
        );
    }

    return (
        ((0b0100 | (inst.name == "str")) << 12) |
        (rd << 10) |
        (rs << 8) |
        offset
    );
}

function emitMov(inst, state) {
    const rd = assertReg(inst.args[0]);
    const negate = inst.flags?.includes("n") ? 1 : 0;

    let b = getImmd(inst.args[1], state);

    if (b === undefined) {
        const rs = assertReg(inst.args[1]);
        return (0b0110 << 12) | (rd << 10) | (rs << 8) | (negate << 7);
    } else {
        const nw = b & 0xffff;
        if (nw != b)
            throw new MiaError(
                inst.token,
                "InvalidImmediate",
                `Immediate ${b} out of range`
            );

        const base = (0b0111 << 12) | (rd << 10);
        const negate = 1 << 9;
        const high = 1 << 8;

        if ((nw & 0xff00) == 0xff00) return base | negate | (~nw & 0xff);
        if ((nw & 0xff00) == 0) return base | nw;
        if ((nw & 0xff) == 0xff)
            return base | high | negate | ((~nw >> 8) & 0xff);
        if ((nw & 0xff) == 0) return base | high | (nw >> 8);

        throw new MiaError(
            inst.token,
            "InvalidImmediate",
            `Immediate ${nw} cannot be encoded`
        );
    }
}

function emitShift(inst, state) {
    const [rd, rs] = inst.args.slice(0, 2).map((x) => assertReg(x));
    const len = getImmd(inst.args[2], state);
    const immd = len & 0xf;
    const [dir, kind] = SHIFTS[inst.name];
    const neg = inst.flags?.includes("n") ? 1 : 0;

    if (immd != len)
        throw new MiaError(
            inst.token,
            "InvalidImmediate",
            `Invalid shift length ${len}`
        );

    return (
        (0b0110 << 12) |
        (rd << 10) |
        (rs << 8) |
        (neg << 7) |
        (dir << 6) |
        (kind << 5) |
        len
    );
}

function emitBranch(inst, state, pc) {
    const address = getImmd(inst.args[0], state);

    if (CONDITIONS.includes(inst.flags)) {
        const cond = CONDITIONS.indexOf(inst.flags);
        let offset = address - pc;

        if (offset < 1) offset--; // dunno why but this is required

        const clamped = Math.max(-128, Math.min(offset, 127));

        if (clamped != offset)
            throw new MiaError(
                inst.token,
                "InvalidImmediate",
                `Branch offset ${offset} out of range (truncated to ${clamped})`
            );

        const immd = clamped & 0xff;

        return (0b1001 << 12) | (cond << 8) | immd;
    } else {
        const immd = address & 0xfff;
        if (address != immd)
            throw new MiaError(
                inst.token,
                "InvalidImmediate"`Branch address ${address} out of range (truncated to ${immd})`
            );
        return (0b1000 << 12) | immd;
    }
}

export const instructionEmitters = {
    and: emitAlu,
    orr: emitAlu,
    add: emitAlu,
    sub: emitAlu,
    cmp: emitCompare,
    tst: emitCompare,
    str: emitMemory,
    ldr: emitMemory,
    mov: emitMov,
    lsl: emitShift,
    lsr: emitShift,
    asr: emitShift,
    b: emitBranch,
};
