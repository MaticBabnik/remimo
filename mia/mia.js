import syntax from "syntax-cli";
import lexGrammar from "./mia.lex.js";
import { readFile } from "fs/promises";
import { createWriteStream, readFileSync } from "fs";
import { instructionEmitters } from "./remimo.js";
import MiaError from "./error.js";

//#region Constants
const MIN_ADDR = 0;
const MAX_ADDR = 2 ** 14;

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
const ALUINST = {
    f: ["s", "c"],
    p: [["REGISTER"], ["REGISTER", "NUMBER", "NAME"]],
};
const CMPINST = { p: [["REGISTER"], ["REGISTER"]] };
const MEMINST = {
    p: [["REGISTER"], ["REGISTER"]],
    o: [["NUMBER", "NAME"]],
};
const SHIFTINST = {
    f: ["n"],
    p: [["REGISTER"], ["REGISTER"], ["NUMBER", "NAME"]],
};
const INSTRUCTIONSET = {
    and: ALUINST,
    orr: ALUINST,
    add: ALUINST,
    sub: ALUINST,
    cmp: CMPINST,
    tst: CMPINST,
    str: MEMINST,
    ldr: MEMINST,
    mov: { f: ["n"], p: [["REGISTER"], ["REGISTER", "NUMBER", "NAME"]] },
    lsl: SHIFTINST,
    lsr: SHIFTINST,
    asr: SHIFTINST,
    b: { f: CONDITIONS, oneflag: true, p: [["NAME", "NUMBER"]] },
};
//#endregion Constants

class TokenList {
    #array;

    constructor(tokens) {
        this.#array = tokens;
    }

    peek(offset = 0) {
        return this.#array[0];
    }

    takeAny() {
        return this.#array.shift();
    }

    take(...types) {
        const tk = this.#array.shift();
        if (types.includes(tk.type)) {
            return tk;
        } else {
            console.log(types);
            throw new MiaError(
                tk,
                "UnexpectedToken",
                `Expected one of: (${types.join("|")}), but got: ${tk.type}`
            );
        }
    }
}

class AssmeblerState {
    #location;
    #names;
    #memory;
    #nameOwner;
    #memoryOwner;

    constructor() {
        this.#location = 0;
        this.#names = new Map();
        this.#memory = new Map();
        this.#nameOwner = new Map();
        this.#memoryOwner = new Map();
    }

    getSize() {
        let max = 0;
        for (let addr of this.#memory.keys()) {
            if (addr > max) max = addr;
        }
        return max + 1;
    }

    entries() {
        return this.#memory.entries();
    }

    resolveName(name, tk) {
        const v = this.#names.get(name);
        if (v === undefined) {
            throw new MiaError(
                tk,
                "UnknownName",
                `Name '${name}' is never assigned`
            );
        }

        return v;
    }

    setLocation(l, tk) {
        if (this.#location < MIN_ADDR || this.#location >= MAX_ADDR)
            throw new MiaError(
                tk,
                "IllegalLocation",
                `Cannot set location to ${l}`
            );

        this.#location = l;
    }

    pushMemory(obj, tk) {
        if (this.#location < MIN_ADDR || this.#location >= MAX_ADDR)
            throw new MiaError(tk, "IllegalLocation", `Cannot write at ${l}`);

        const owner = this.#memoryOwner.get(this.#location);
        if (owner) {
            throw new MiaError(
                tk,
                "MemoryCollision",
                `Memory location (${this.#location}) already written to (${
                    owner.type
                } at ${owner.startLine}:${owner.startColumn})`
            );
        }

        this.#memory.set(this.#location, obj);
        this.#memoryOwner.set(this.#location, tk);
        this.#location++;
    }

    addLabel(name, tk) {
        const owner = this.#nameOwner.get(name);
        if (owner) {
            throw new MiaError(
                tk,
                "NameCollision",
                `Name "${name}" already assigned. (${owner.type} at ${owner.startLine}:${owner.startColumn})`
            );
        }

        this.#nameOwner.set(name, tk);
        this.#names.set(name, this.#location);
    }

    setName(name, value, tk) {
        const owner = this.#nameOwner.get(name);
        if (owner) {
            throw new MiaError(
                tk,
                "NameCollision",
                `Name "${name}" already assigned. (${owner.type} at ${owner.startLine}:${owner.startColumn})`
            );
        }

        this.#nameOwner.set(name, tk);
        this.#names.set(name, value);
    }
}

function handleDirective(tk, tl, state) {
    switch (tk.value) {
        case "at":
            const newLocation = eval(tl.take("NUMBER").value);
            state.setLocation(newLocation, tk);
            break;
        case "var":
            do {
                let n = tl.take("NUMBER");

                state.pushMemory(
                    {
                        t: "DATA",
                        val: eval(n.value),
                    },
                    tk
                );
            } while (tl.peek().type == "NUMBER");
            break;
        case "fill":
            const n = eval(tl.take("NUMBER"));
            const w = tl.peek().type == "NUMBER" ? eval(tl.take("NUMBER")) : 0;

            for (let i = 0; i < n; i++) {
                state.pushMemory(
                    {
                        t: "DATA",
                        val: w,
                    },
                    tk
                );
            }
            break;
        case "bin_include":
            const fn = tl.take("STRING");

            let buf;
            try {
                buf = readFileSync(fn.value);
            } catch {
                throw new MiaError(
                    tk,
                    "FileError",
                    `Couldn't include "${fn.value}"`
                );
            }
            const l = Math.ceil(buf.length);

            for (let i = 0; i < l; i += 2) {
                state.pushMemory({ t: "DATA", val: buf.readUint16BE(i) });
            }
            break;
        default:
            throw new MiaError(tk, "UnknownDirective", "");
    }
}

function handleInstruction(tk, tl, state) {
    const [iname, flags] = tk.value.split(".");
    const ispec = INSTRUCTIONSET[iname];
    const instruction = { t: "INSTRUCTION", token: tk, name: iname, args: [] };
    if (flags) {
        if ("f" in ispec) {
            if (ispec.oneflag) {
                if (ispec.f.includes(flags)) instruction.flags = flags;
                else
                    throw new MiaError(
                        tk,
                        "InvalidFlag",
                        `"${flags}" is not valid on ${iname}`
                    );
            } else {
                const fs = flags?.split("") ?? [];
                const illegal = fs.find((x) => !ispec.f.includes(x));
                if (illegal)
                    throw new MiaError(
                        tk,
                        "InvalidFlag",
                        `"${illegal}" is not valid on ${iname}`
                    );
                instruction.flags = fs;
            }
        } else {
            throw new MiaError(
                tk,
                "InvalidFlag",
                `${iname} does not take flags`
            );
        }
    }

    for (let kinds of ispec.p) {
        instruction.args.push(tl.take(...kinds));
    }
    if (ispec.o)
        for (let kinds of ispec.o) {
            if (!kinds.includes(tl.peek().type)) break;
            instruction.args.push(tl.take(...kinds));
        }

    state.pushMemory(instruction, tk);
}

function pass1(tokens) {
    const HANDLERS = {
        DIRECTIVE: handleDirective,
        INSTRUCTION: handleInstruction,
        CONST_SET(tk, tl, state) {
            const val = tl.take("NUMBER");
            state.setName(tk.value, eval(val.value), tk);
        },
        LABEL(tk, _, state) {
            state.addLabel(tk.value, tk);
        },
        $() {}, // EOF
    };

    const state = new AssmeblerState(),
        tl = new TokenList(tokens);
    let ct;

    while ((ct = tl.takeAny())) {
        const handler = HANDLERS[ct.type];
        if (handler) handler(ct, tl, state);
        else throw new MiaError(ct, "UnexpectedToken");
    }

    return state;
}

function pass2(state) {
    const image = new Uint16Array(state.getSize());

    for (let [addr, ent] of state.entries()) {
        if (ent.t === "DATA") {
            image[addr] = ent.val & 0xffff;
        } else {
            image[addr] = instructionEmitters[ent.name](ent, state, addr);
        }
    }

    return image;
}

function assemble(string) {
    const tokens = new syntax.Tokenizer({
        string,
        lexGrammar,
    }).getTokens();

    const s = pass1(tokens);

    return pass2(s);
}

function hex(n, prefix = false) {
    return (prefix ? "0x" : "") + n.toString(16).padStart(4, "0");
}

async function main(infile, outfile) {
    const instr = await readFile(infile, "utf-8");
    const image = assemble(instr);
    const ws = createWriteStream(outfile, { flags: "w" });
    {
        ws.write("v3.0 hex words addressed\n");
        let addr = 0;
        do {
            let line = `${hex(addr)}:`;
            for (let i = 0; i < 16; i++) {
                line += ` ${hex(image[addr + i] ?? 0, true)}`;
            }
            ws.write(line);
            ws.write("\n");
            addr += 16;
        } while (addr < image.length);
    }
    await new Promise((r) => ws.close(r));
    console.log("Success!");
}

main(...process.argv.slice(2));
