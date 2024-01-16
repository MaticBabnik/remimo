# Future work

### Architecture

-   8 register variant (requires new encodings for almost all instructions)
-   Execute non-memory instructions in 1 phase instead of 2
-   Proper link register

### Instructions

-   multiply instruction
-   branch to register instruction
-   str/ldr with only immediate (`str r0, #10`)

### Toolchain, emulators, implementations

-   Redo assembler with UAL-style syntax and macros (ANTLR)
-   C++ emulator
-   FPGA implementation
