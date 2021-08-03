import { Type } from "./common"

export class ParseItem {
  constructor(
    public value: any,
    public position: number,
    public priority: number = 0,
    public type: number = Type.const) {
  }

  public isOperator(...args: string[]): boolean {
    return (this.type === Type.operator) ? (args.length ? args.indexOf(this.value) >= 0 : true) : false
  }
  public isSpecial(...args: string[]): boolean {
    return (this.type === Type.special) ? (args.length ? args.indexOf(this.value) >= 0 : true) : false
  }

  get isConst()    { return this.type === Type.const    }
  get isVariable() { return this.type === Type.variable }
  get isFunction() { return this.type === Type.function }
}

export class Expression extends ParseItem {
  constructor(item?: ParseItem, public operator: string = "", value: any = []) {
    super(item ? (value ? value : item.value) : [],
          item ? item.position : 0,
          item ? item.priority : 0,
          item ? item.type : Type.expression)
  }
  get left(): Expression { return this.value[0] }
  set left(value: Expression) { this.value[0] = value }

  get right(): Expression { return this.value[1] }
  set right(value: Expression) { this.value[1] = value }

  public isOperator(...args: string[]): boolean {
    return (this.type === Type.operator) ? (args.length ? args.indexOf(this.operator) >= 0 : true) : false
  }
}

export class OperatorExpression extends Expression {
  constructor(operator: ParseItem, left: Expression, right?: Expression) {
    super(operator, operator.value, right ? [left, right] : [left])
    this.type = Type.operator
  }
}

export class ArrayExpression extends Expression {
  constructor(arr?: ParseItem, items: Expression[] = []) {
    super(arr, "array", items)
    this.type = Type.array
  }
}

export class FunctionExpression extends Expression {
  constructor(func?: ParseItem, args: Expression[] = []) {
    super(func, func?.value, args)
    this.type = Type.function
  }
}
