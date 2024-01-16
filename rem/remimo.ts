export type TMemory = Record<number, number>;

enum Flag {
    C,
    N,
    V,
    Z,
}

type ValidOpcode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export class ReMimoMachine {
    protected pc = 0;
    protected registers = new Uint16Array(4);
    protected flags: Record<Flag, boolean> = [false, false, false, false];

    constructor(protected memory: TMemory) {}

    step() {
        if (this.pc >= 0x8000)
            throw new Error("Refusing to execute over >= 0x8000");
        const instruction = this.memory[this.pc];
        const opcode = instruction >> 12;
        if (opcode > 9) throw new Error(`Illegal instruction at ${this.pc}`);
        this.pc++;
        this[opcode as ValidOpcode](instruction & 0x0fff);
    }

    private aluop(op: number, operands: number) {
        const rd = operands >> 10;
        const rs = (operands >> 8) & 0x3;
        let c = false,
            v = false;

        let a = this.registers[rd];
        let b = rd === rs ? operands & 0x7f : this.registers[rs];
        const wc = !(rd === rs) && operands & (1 << 5);
        const fo = !(rd === rs) && operands & (1 << 4);

        const sa = a >> 15,
            sb = b >> 15;
        let sr;

        switch (op) {
            case 0:
                a |= b;
                break;
            case 1:
                a &= b;
                break;
            case 2:
                a += b;
                if (wc && this.flags[Flag.C]) a += 1;

                sr = (a >> 15) & 1;
                c = a > 0xffff; // a gets clamped during writeback; but if its bigger we set C
                v = sa == sb && sa != sr;

                break;
            case 3:
                if (wc && this.flags[Flag.C]) {
                    c = b + 1 > a; // TODO: is this right???
                    a -= 1;
                } else {
                    c = b > a;
                }
                a -= b;

                sr = (a >> 15) & 1;
                v = sa != sb && sa == sr;
                break;
        }

        if (operands & (1 << 7)) {
            // SetFlags?
            this.flags[Flag.C] = c;
            this.flags[Flag.Z] = !(a & 0xffff);
            this.flags[Flag.V] = v;
            this.flags[Flag.N] = !!(a & 0x8000);
        }

        if (!fo) this.registers[rd] = a; // skip writeback if FlagsOnly
    }

    /**
     * AND
     */
    private 0(operands: number) {
        this.aluop(0, operands);
    }
    /**
     * OR
     */
    private 1(operands: number) {
        this.aluop(1, operands);
    }

    /**
     * ADD
     */
    private 2(operands: number) {
        this.aluop(2, operands);
    }

    /**
     * SUB
     */
    private 3(operands: number) {
        this.aluop(3, operands);
    }

    /**
     * LDR
     */
    private 4(operands: number) {
        const rd = operands >> 10;
        const rs = (operands >> 8) & 0x3;
        const offset = operands & 0xff;

        this.registers[rd] = this.memory[rs + offset];
    }

    /**
     * STR
     */
    private 5(operands: number) {
        const rd = operands >> 10;
        const rs = (operands >> 8) & 0x3;
        const offset = operands & 0xff;

        this.memory[rs + offset] = this.registers[rd];
    }

    /**
     * MOV
     */
    private 6(operands: number) {
        const rd = operands >> 10;
        const rs = (operands >> 8) & 0x3;
        const shift = operands & 0xf;

        let v = this.registers[rs];

        if (shift) {
            if (operands & (1 << 5)) {
                if (operands & (1 << 4)) {
                    const newV = v >> shift; // arithmetic shift right
                    v = v & 0x8000 ? newV | (0xffff7000 >> shift) : newV;
                } else {
                    v >>= shift; // logical shift right
                }
            } else {
                // logical shift left
                v <<= shift;
            }
        }
        if (operands & (1 << 6)) v = ~v; //negate

        this.registers[rd] = v;
    }

    /**
     * MVI
     */
    private 7(operands: number) {
        const rd = operands >> 10;
        let immd = operands & 0xff;
        if (operands & (1 << 7)) immd <<= 8;
        if (operands & (1 << 8)) immd = ~immd;
        this.registers[rd] = immd;
    }

    /**
     * B
     */
    private 8(operands: number) {
        this.pc = operands;
    }

    /**
     * RCB
     */
    private 9(operands: number) {
        const condition = operands >> 8;

        switch (condition) {
            case 0: // eq
                if (this.flags[Flag.Z]) break;
                return;
            case 1: // ne
                if (!this.flags[Flag.Z]) break;
                return;
            case 2: // hs
                if (this.flags[Flag.C]) break;
                return;
            case 3: // lo
                if (!this.flags[Flag.C]) break;
                return;
            case 4: // mi
                if (this.flags[Flag.N]) break;
                return;
            case 5: // pl
                if (!this.flags[Flag.N]) break;
                return;
            case 6: // vs
                if (this.flags[Flag.V]) break;
                return;
            case 7: // vc
                if (!this.flags[Flag.V]) break;
                return;
            case 8: // hi
                if (this.flags[Flag.C] && !this.flags[Flag.Z]) break;
                return;
            case 9: // ls
                if (!this.flags[Flag.C] || this.flags[Flag.Z]) break;
                return;
            case 10: // ge
                if (this.flags[Flag.N] === this.flags[Flag.V]) break;
                return;
            case 11: // lt
                if (this.flags[Flag.N] !== this.flags[Flag.V]) break;
                return;
            case 12: // gt
                if (
                    !this.flags[Flag.Z] &&
                    this.flags[Flag.N] === this.flags[Flag.V]
                )
                    break;
                return;
            case 13: // le
                if (
                    this.flags[Flag.Z] ||
                    this.flags[Flag.Z] == this.flags[Flag.V]
                )
                    return;
                break;
            case 14: // xx
                return;
            case 15:
                break;
        }

        operands &= 0xff;
        //sign-extend
        if (operands > 127) operands |= -128;
        this.pc += operands;
    }
}
