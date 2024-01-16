# ReMiMo

A 16-bit hardwired CPU built in Logisim Evolution.

It's based on [MiniMiMo](https://github.com/LAPSyLAB/RALab-STM32H7/tree/main/MiniMiMo_HW_CPE_Model), which is based on [Warren Toomey's "An Example Hardwired CPU"](https://tuhs.org/CompArch/Tutes/week03.html).

## CPU documentation

-   [Architecture](docs/arch.md)
-   [Instruction table](docs/ReMiMo.ods)

## MImo Assembler

The most scuffed assembler ever!?

### Usage

To assemble a Logisim RAM image run:

```sh
node mia.js source.mia output.out --raw
```

When assembling for the emulator use the `--raw` flag to spit out a binary file instead.

```sh
node mia.js source.mia output.out --raw
```

For example programs see the `mia/test` directory.

## Remimo EMulator

Since Logisim only runs at about 120Hz (60 IPS) I wrote a faster emulator (more than 300000x faster).
The `index.ts` is a simple IO-less benchmark that loads a file and mesures executed instructions per second.

### Extending / porting

The `remimo.ts` file is the portable emulator core.
To implement memory mapped IO wrap a UInt16Array with a custom getter/setter.

![Screenshot of the main circuit](docs/remimo.png)
