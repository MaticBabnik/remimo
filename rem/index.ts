import { readFile } from "fs/promises";
import { ReMimoMachine } from "./remimo";
import { performance } from "perf_hooks";

async function main(path?: string) {
    if (!path) throw new Error("no path");
    const f = await readFile(path);

    // Create RAM and load initial image
    const memory = new Uint16Array(2 ** 16);
    for (let i = 0; i < f.byteLength; i += 2)
        memory[i >> 1] = f.readUint16BE(i);

    // Create machine instance
    const machine = new ReMimoMachine(memory);

    // Run the machine
    while (true) {
        const start = performance.now();
        for (let i = 0; i < 10_000_000; i++) {
            machine.step();
        }
        const time = performance.now() - start;
        console.log("Core freq=", (10_000 / time).toFixed(1), "MHz");
    }
}

main(...process.argv.slice(2));
