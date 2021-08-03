export enum Type {
  const = 0,
  variable = 1,
  operator = 2,
  function = 3,
  special = 4,
  array = 5,
  expression = 6,
}

// ==== ParseItem priority =====
export const Priority: any = {
  "(": 10, "[": 10, ".": 10, "++": 9, "--": 9, "!": 8,
  "*": 7,  "/": 7,  "%": 7,  "+": 6,  "-": 6,
  ">": 5,  "<": 5,  ">=": 5, "<=": 5, "==": 5, "!=": 5,
  "&": 4,  "|": 3,  "=": 2,  "+=": 2, "-=": 2,
  ";": 1,  ",": 1,  ")": 0,  "]": 0,
}

export class ParseError extends Error {
  constructor(
    public message: string,
    public position: number = 0) {
      super(message)
  }
}
