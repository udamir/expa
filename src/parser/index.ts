import { ParseItem } from "./expressions"
import { ParseError, Priority, Type } from "./common"

export class ExpParser {
  public items: ParseItem[]
  public brackets: number[]
  public cursor: number
  // public item: ParseItem

  constructor(public text: string) {
    this.cursor = 0
    this.brackets = []
    this.items = []
  }

  get priority() { return this.brackets.length * 10 }
  get length()   { return this.text.length }
  get prev()     { return this.text[this.cursor - 1] }
  get current()  { return this.text[this.cursor] }
  get next()     { return this.text[this.cursor + 1] }
  get lastItem() { return this.items[this.items.length - 1] }
  get end()      { return this.cursor >= this.length }

  // for test only ============
  public toString(param: string): string {

    function text(item: string, len: number) {
      const left = Math.floor((len - item.length) / 2)
      return " ".repeat(left) + item + " ".repeat(len - left - item.length)
    }

    let s = ""
    let value
    let priority
    let type
    this.items.forEach((item: ParseItem) => {
      value = item.value.toString()
      priority = item.priority.toString()
      type = Type[item.type]

      const maxLen = Math.max(value.length, type.length, priority.length)

      switch (param) {
        case "value": s += `|${text(value, maxLen)}`; break
        case "priority": s += `|${text(priority, maxLen)}`; break
        case "type": s += ` ${text(type, maxLen)}`; break
      }
    })
    return s + "|"
  }
  // ==== parseItem - parse item in text from cursor
  public parseItem(): ParseItem | undefined {
    this.skipSpaces()
    if (this.end) { return }

    const item = new ParseItem(this.current, this.cursor, this.priority)

    // ===== Variable / Function / Property (Const) ====
    if (this.isLetter()) {
      // parse Name
      item.value = this.parseName()
      this.skipSpaces()
      item.type = (this.current === "(") ? Type.function :
        ((this.text[item.position - 1] === ".") ? Type.const : Type.variable)

    // ===== Const (Number) ============================
    } else if (this.isDigit()) {
      // parse Number
      item.value = this.parseNumber()

    // ===== Const (String) ============================
    } else if (this.current === '"') {
      // find end of string
      while (this.next !== '"') {
        this.cursor++
        if (this.cursor >= this.length) {
          throw new ParseError("unexpected char", item.position)
        }
      }
      this.cursor += 2
      item.value = this.text.slice(item.position + 1, this.cursor - 1)

    // ===== Special sumbol =======================
    } else if ([",", "(", ")", "[", "]"].indexOf(this.current) >= 0) {
      item.priority += Priority[this.current]
      if (this.current === "(" || this.current === "[") {
        this.brackets.push(this.cursor)
      } else if (this.current === ")" || this.current === "]") {
        const lastBrecket = this.text[this.brackets.pop() || -1]
        if ((lastBrecket !== "(" || this.current !== ")") &&
            (lastBrecket !== "[" || this.current !== "]")) {
          throw new ParseError("unexpected char", item.position)
        }
      }
      item.type = Type.special
      this.cursor++

    // ===== Operator =======================
    } else if (this.current in Priority) {
      let operator = this.current
      // check .
      if (operator === "." && (!this.prev || this.prev === " " || !this.isLetter(this.next))) {
        throw new ParseError("unexpected char", item.position)
      }
      // check for >= <= != = += == -- ++
      if (([">", "<", "!", "-", "+", "="].indexOf(operator) >= 0 && this.next === "=") ||
          (operator === "+" && this.next === "+") || (operator === "-" && this.next === "-")) {
        operator += this.next
        this.cursor++
      }
      item.priority += Priority[operator]
      item.type = Type.operator
      item.value = operator
      this.cursor++

    // ===== Error =======================
    } else {
      throw new ParseError("unexpected char", item.position)
    }
    this.items.push(item)
    return item
  }

  public parseItems(): ParseItem[] {
    this.cursor = 0
    while (this.cursor < this.length) { this.parseItem() }
    return this.items
  }

  // ======= check functions =============
  private isLetter(char: any = this.current): boolean {
    return char ? (char.toUpperCase() >= "A" && char.toUpperCase() <= "Z") : false
  }

  private isDigit(char: any = this.current): boolean {
    if (this.current === ".") {
      if (!isNaN((this.next as any) * 1) && (this.next !== " ")) {
        return (!this.lastItem || (!this.lastItem.isVariable && !this.lastItem.isSpecial(")", "]")))
      }
    }
    return !isNaN(char * 1) && (char !== " ")
  }

  // ========  parse functions ============
  private parseName(): string {
    const start = this.cursor
    while (this.isLetter() || this.isDigit()) { this.cursor++ }
    return this.text.slice(start, this.cursor)
  }

  private parseNumber(): number {
    const start = this.cursor
    while (this.isDigit()) { this.cursor++ }
    return (this.text.slice(start, this.cursor) as any) * 1
  }

  private skipSpaces() {
    while (this.current === " " || this.current === `\n`) {
      this.cursor++
    }
  }
}
