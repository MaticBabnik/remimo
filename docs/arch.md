# ReMiMo v1

## Intro

The ReMiMo is a 16-bit architecutre with 4 registers (`r0`-`r3`) and 64k words addres space.
It support both signed and unsigned arithmetic and has 4 flags (**C**arry, **N**egative, o**V**erflow, **Z**ero)

## Instructions

The architecture currently defines 10 instructions and leaves 6 undefined for future extensions.
Each instruction is a 16-bit word with a 4-bit opcode.
| opcode | description|
| --: | --- |
| `0000` | ALU And |
| `0001` | ALU Or |
| `0010` | ALU Add |
| `0011` | ALU Subtract |
| `0100` | Load |
| `0101` | Store |
| `0110` | Move register |
| `0111` | Move immediate |
| `1000` | Absolute branch |
| `1001` | Relative conditional branch |
| `1010`- `1111` | Undefined |

### ALU instructions

The top half of any ALU instruction is encoded as:

```
|15 14|13 12|11 10|9   8|
|  00 |aluop|  Rd | Rs  |

```

Where aluop is the operation (0-3) (0=and, 1=or, 2=add, 3=sub)
Based on the contents of the top half there exists 2 versions of each ALU instruction.

#### `Rd != Rs`: With two registers

Performs the ALU operation between `Rd` and `Rs` and stores the result in `Rd`.

```
|7|6|5|4     1|
|S|C|F|ignored|
```

##### Set flags

If bit 7 is set, the ALU operation will update the flags.

##### with Carry

If bit 6 is set, the ALU operation will use the Carry flag.

##### only Flags

If bit 5 is set, the Result will be discarded (useful for comparisons).

#### `Rd == Rs`: With register and immediate

Performs the ALU operation between `Rd` and the immediate and stores the result in `Rd`.

```
|7|6         1|
|S| Immediate |
```

##### Set flags

If bit 7 is set, the ALU operation will update the flags.

#### Immediate

This instruction can encode a 7 bit unsigned immediate (0-128).

### Load/Store

```
|15 13|12|11 10|9   8|7        0|
| 010 |RW|  Rd |  Rs |  Offset  |
```

If `RW == 0` Loads from memory at `[Rs + Offset]` into `Rd` .

If `RW == 1` Stores `Rd` to memory at `[Rs + Offset]`.

#### Offset

Offset is an 8-bit unsigned immediate.

### Move register

```
|15  12|11 10|9   8|7|6|5|4|3    0|
| 0110 | Rd  | Rs  |N|D|K| | shift|
```

Moves a value from `Rs` to `Rd` while optionally shifting and/or negating it.

#### Negate

If bit 7 is set the value is negated (after the shifts).

#### Direction

Bit 6 encodes the direction of the shift (0=left, 1=right).

#### Kind

If bit 5 is set the shift is arithmetic, otherwise logical.

#### shift

The lowest 4 bits encode the length of the shift.

### Move immediate

```
|15  12|11 10|9|8|7        0|
| 0110 | Rd  |N|H| Immediate|
```

Moves an immediate into `Rd`.

#### Negate

If bit 9 is set the value is negated.

#### High

if bit 8 is set the immediate gets shifted left by 8.

### Absolute branch

```
|15  12|11                 0| 
| 1000 |       Address      |
```

Branches to instruction at address.

#### Address

12 bit immediate

### Relative conditional branch

```
|15  12|11   8|7                0| 
| 1001 | Cond | Signed offset    |
```
Branches to instruction if condition is met.

#### Signed Offset

Offset is an 8-bit signed immediate (Max distance is 128).

#### Conditions

| Cond | Short | Desc | Flags |
| --- | --- | ---| --- |
| 0 | eq | Equal | `Z` |
| 1 | ne | Not equal | `!Z` |
| 2 | hs | higher same | `C` |
| 3 | lo | Unsigned lower| `!C` |
| 4 | mi | Negative | `N` |
| 5 | pl | Positive or zero | `!N` |
| 6 | vs | Signed overflow | `V` |
| 7 | vc | No signed overflow | `!V` |
| 8 | hi | Unsigned higher | `C && !Z` |
| 9 | ls | Unsigned lower or same | `!C \|\| Z` |
| 10 | ge | Signed greater or equal | `N==V` |
| 11 | lt | Signed less | `N!=V` |
| 12 | gt | Signed greater | `!Z && N==V` |
| 13 | le | Signed less or equal | `Z \|\| N!=V` |
| 14 | xx | Never | `0` |
| 15 | al | Always | `1` |
