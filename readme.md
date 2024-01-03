# ReMiMo

A 16-bit hardwired CPU built in Logisim Evolution.

It's based on [MiniMiMo](https://github.com/LAPSyLAB/RALab-STM32H7/tree/main/MiniMiMo_HW_CPE_Model), which is based on [Warren Toomey's "An Example Hardwired CPU"](https://tuhs.org/CompArch/Tutes/week03.html).

## CPU documentation

- [Architecture](docs/arch.md)
- [Instruction table](docs/ReMiMo.ods)

## MImo Assembler

A very primitive assembler which can generate `.ram` files.

To assemble a simple program:

1. Edit the `prog` array

```js
// example program
const prog = [ 
    mov(r0, 100),
    mov(r1, 200),
    cmp(r0, r1),
    brc(le, 127)
];
```

2. Run `node mia.js > test.ram`

![Screenshot of the main circuit](docs/remimo.png)
