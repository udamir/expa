import { ExpParser } from "./parser"
import { ParseError, Type } from "./parser/common"
import { ArrayExpression, Expression, FunctionExpression, OperatorExpression, ParseItem } from "./parser/expressions"

const typeName = (type: Type) => Type[type]

export class Stack<T> extends Array<T> {
  get last(): T | undefined  { return this.length ? this[this.length - 1] : undefined }
}

export class Expa {
  public data: any[] = []

  private commands: any = {
    // foreach (item, items array, action for item)
    foreach: (args: any, expression: Expression) => {
      const params = expression.value
      if (params.length !== 3) {
        throw new ParseError ("Wrong arguments in foreach", expression.position)
      }

      // check key
      if (params[0].type !== Type.variable) {
        throw new ParseError("First parameter must be variable", params[0].position)
      }

      const newWorkSpace = !args._.last
      if (newWorkSpace) {
        args._.push({})
      }

      const listItemName = params[0].value
      if (listItemName in args._.last) {
        throw new ParseError (`Item name "${listItemName}" is already in use`, params[0].position)
      }

      const list = this.execute(args, params[1])

      if (list === null || typeof list[Symbol.iterator] !== "function") {
        throw new ParseError("Second parameter must be array", params[1].position)
      }

      for (const item of list) {
        // put item to arguments
        args._.last[listItemName] = item
        // execute action
        this.execute(args, params[2])
      }

      if (newWorkSpace) {
        args._.pop()
      } else {
        delete args._.last[listItemName]
      }
    },

    // if (condition, action if true, action if false)
    if: (args: any, expression: Expression) => {
      const params = expression.value
      if (params.length < 2) {
        throw new ParseError ("Wrong arguments in if command", expression.position)
      }

      if (this.execute(args, params[0])) {
        return this.execute(args, params[1])
      } else if (params[2]) {
        return this.execute(args, params[2])
      }
    },
  }

  private functions: any = {
    sum: (...a: any[]) => a.reduce((b, c) => b + c, 0),
    or: (...a: any[]) => a.reduce((b, c) => b || c, 0),
    and: (...a: any[]) => a.reduce((b, c) => b && c, 0),
    indexOf: (text: string, item: string) => text.indexOf(item),
    slice: (text: string, start: number, end?: number) => text.slice(start, end),
    split: (text: string, delim: string, limit?: number) => text.split(delim, limit),
    string: (value: any) => value.toString(),
    replace: (value: string, searchValue: string, replaceValue: string) => value.replace(searchValue, replaceValue),
  }

  constructor(public expression: string = "") {
    if (expression !== "") {
      this.expression.split(";").forEach((command: string) => {
        const sp = new ExpParser(command)
        if (command.replace(/(\r\n\t|\n|\r\t)/gm, "").trim()) {
          try {
            this.data.push({ command, expression: this.getElement(sp, 0)})
          } catch (error) {
            throw new ParseError(`${error.message}:
              ${command.slice(0, error.position)} >>${command.slice(error.position)}`)
          }
        }
      })
    }
  }

  public toString(exp: Expression): string {
    let result: string = ""
    switch (exp.type) {
      case Type.array:
        result += "[ "
        exp.value.forEach((item: Expression) => result += this.toString(item))
        result += " ] "
        break

      case Type.function:
        result += exp.operator + "( "
        exp.value.forEach((item: Expression, i: number) => result += (i > 0 ? ", " : "") + this.toString(item))
        result += " ) "
        break

      case Type.operator: case Type.expression:
        if (exp.right) {
          result += this.toString(exp.left) + " " + exp.operator + " " + this.toString(exp.right) + " "
        } else {
          result += exp.operator + " " + this.toString(exp.left) + " "
        }
        break

      default:
        result += exp.value
    }
    return result
  }

  public toLines(expression: any, level: number = 0): string {
    let result: string = ""
    switch (expression.type) {
      case Type.array: case Type.operator: case Type.expression: case Type.function:
        result += "| ".repeat(level) + expression.operator +
          ((!expression.value.length && expression.type === Type.function) ? "()" : "") +
          " " + typeName(expression.type) + "\n"
        expression.value.forEach((item: Expression) => result += this.toLines(item, level + 1))
        break
      default:
        result += "| ".repeat(level) + expression.value + " " + typeName(expression.type) + "\n"
    }
    return result
  }

  public run(args: any) {
    if (!args._) {
      Object.defineProperty(args, "_", { value: new Stack(), enumerable: false, writable: true, configurable: true })
    }
    let shift = 0
    this.data.forEach((item: any) => {
      try {
        this.execute(args, item.expression)
        shift += item.command.length + 1
      } catch (error) {
        throw new ParseError(error.message, error.position + shift)
      }
    })

  }

  private execute(args: any, item: Expression): any {

    function getObjectPath(obj: Expression): any {
      if (obj.type === Type.variable || obj.type === Type.const) {
        return obj.value
      } else {
        return getObjectPath(obj.left) + "." + getObjectPath(obj.right)
      }
    }

    switch (item.type) {
      case Type.const: return item.value
      case Type.variable: return (args._.last && item.value in args._.last) ?
        args._.last[item.value] : args[item.value]

      case Type.operator:
        switch (item.operator) {
          case "=": case "+=": case "-=": case "++": case "--":
            return this.setValue(args, item)

          case "[": case ".":
            const obj = this.execute(args, item.left)
            if (!obj) {
              throw new ParseError(`Object ${getObjectPath(item.left)} not found`, item.left.position)
            }
            if (item.right.isFunction) {
              if (item.right.operator in obj) {
                try {
                  return obj [ item.right.operator ]
                  (...item.right.value.map((element: Expression) => this.execute(args, element)))
                } catch (error) {
                  throw new ParseError(error.message, item.position + 1)
                }
              } else {
                throw new ParseError(`Function ${item.right.operator} not found`, item.right.position)
              }
            } else {
              return obj [ this.execute(args, item.right) ]
            }
          case "*": case "/":
            const left = this.execute(args, item.left)
            const right = this.execute(args, item.right)
            if (typeof(left) === "number" && typeof(right) === "number") {
              if (item.operator === "/") {
                if (right !== 0) {
                  return left / right
                } else {
                  throw new ParseError("Divide by 0", item.position)
                }
              } else {
                return left * right
              }
            } else {
              throw new ParseError("operator * is applicable for numbers only", item.position)
            }
          case "!":  return !this.execute(args, item.left)
          case "+":  return this.execute(args, item.left) +   this.execute(args, item.right)
          case "-":  return this.execute(args, item.left) -   this.execute(args, item.right)
          case "%":  return this.execute(args, item.left) %   this.execute(args, item.right)
          case "&":  return this.execute(args, item.left) &&  this.execute(args, item.right)
          case "|":  return this.execute(args, item.left) ||  this.execute(args, item.right)
          case "!=": return this.execute(args, item.left) !== this.execute(args, item.right)
          case "==": return this.execute(args, item.left) === this.execute(args, item.right)
          case ">=": return this.execute(args, item.left) >=  this.execute(args, item.right)
          case ">":  return this.execute(args, item.left) >   this.execute(args, item.right)
          case "<=": return this.execute(args, item.left) <=  this.execute(args, item.right)
          case "<":  return this.execute(args, item.left) <   this.execute(args, item.right)
          default:
            throw new ParseError("Unknown operator " + item.operator, item.position)
        }

      case Type.array:
        return item.value.map((element: Expression) => this.execute(args, element))

      case Type.function:
        return this.executeFunction(args, item)

      default:
        throw new ParseError("Wrong expression", item.position)
    }
  }

  private checkOperatorPriority(item: ParseItem, priority: number): boolean {
    return item && ((item.priority > priority && item.isOperator()) ||
           (item.priority > priority && item.isSpecial("[")))
  }

  private getElement(parser: ExpParser, priority: number, item?: ParseItem): Expression {
    let element: Expression
    item = item || parser.parseItem()
    if (!item) {
      throw new ParseError("Expected expression", parser.cursor)
    }
    if (item.isConst || item.isVariable) {
      element = item as Expression
      parser.parseItem()
    } else if (item.isFunction) {
      parser.parseItem()
      element = new FunctionExpression(item, this.getGroupElements(parser, item.priority))
    } else if (item.isOperator("!")) {
      element = new OperatorExpression(item, this.getElement(parser, item.priority))
    } else if (item.isOperator("-", "+")) {
      element = new ParseItem(0, parser.cursor - 1, parser.priority, Type.const) as Expression
      element = new OperatorExpression(item, element, this.getElement(parser, item.priority))
    } else if (item.isSpecial("(")) {
      element = this.getGroupElement(parser, item.priority)
    } else if (item.isSpecial("[")) {
      element = new ArrayExpression(item, this.getGroupElements(parser, item.priority))
    } else {
      throw new ParseError("Argument expected", item.position)
    }

    // check next operator
    while (!parser.end && this.checkOperatorPriority(parser.lastItem, priority)) {
      if (parser.lastItem.isSpecial("[")) {
        element = new OperatorExpression(parser.lastItem, element,
                    this.getGroupElement(parser, parser.lastItem.priority))
      } else if (parser.lastItem.isOperator("++", "--")) {
        element = new OperatorExpression(parser.lastItem, element)
        item = parser.parseItem()
      } else {
        element = new OperatorExpression(parser.lastItem, element,
                    this.getElement(parser, parser.lastItem.priority))
      }
    }
    return element
  }

  private getGroupElement(parser: ExpParser, priority: number): Expression {
    const endItemValue = (parser.lastItem.value === "[") ? "]" : ")"
    const result = this.getElement(parser, priority)
    if (!parser.lastItem.isSpecial(endItemValue)) {
      throw new ParseError(`Expected "${endItemValue}"`, parser.lastItem.position)
    }
    parser.parseItem()
    return result
  }

  private getGroupElements(parser: ExpParser, priority: number): Expression[] {
    const items: Stack<Expression> = new Stack()
    const endItemValue = (parser.lastItem.value === "[") ? "]" : ")"

    let item = parser.parseItem()
    while (item && !item.isSpecial(endItemValue)) {
      items.push(this.getElement(parser, priority, item))
      if (!parser.lastItem.isSpecial(",", endItemValue)) {
        throw new ParseError("Unexpected char", parser.lastItem.position)
      }
      item = (parser.lastItem.isSpecial(endItemValue)) ? parser.lastItem : parser.parseItem()
    }
    if (item && item.isSpecial(endItemValue)) {
      parser.parseItem()
    } else {
      throw new ParseError(`Expected "${endItemValue}"`, parser.lastItem.position)
    }
    return items
  }

  private setValue(args: any, item: Expression) {
    if (item.left.isVariable || (item.left.isOperator("[", "."))) {
      let obj: any
      let index: any
      if (item.left.isVariable) {
        obj   = (args._.last && item.left.value in args._.last) ? args._.last : args
        index = item.left.value
        if (!obj) {
          throw new ParseError(`Cannot find object ${item.left.value}`, item.left.position)
        } else if (!(index in obj)) {
          throw new ParseError(`Cannot find property ${index} in object`, item.left.position)
        }
      } else {
        obj   = this.execute(args, item.left.left)
        index = this.execute(args, item.left.right)
        if (!obj) {
          throw new ParseError(`Cannot find object ${item.left.left.value}`, item.left.left.position)
        } else if (!(index in obj)) {
          throw new ParseError(`Cannot find property ${index} in object`, item.left.right.position)
        }
      }
      const right = (item.isOperator("=", "+=", "-=")) ? this.execute(args, item.right) : undefined
      switch (item.operator) {
        case "=": return  obj[index] = right
        case "+=": return obj[index] += right
        case "-=": return obj[index] -= right
        case "++": return obj[index]++
        case "--": return obj[index]--
      }
    } else {
      throw new ParseError ("Cannot assign value to " + item.left.operator, item.left.position)
    }
  }

  private executeFunction(args: any, item: Expression) {
    let func
    if (item.operator in this.commands) {
      return this.commands[item.operator](args, item)
    } else {
      if (item.operator in Math) {
        func = (Math as any)[item.operator]
      } else if (item.operator in this.functions) {
        func = this.functions[item.operator]
      } else if (item.operator in args) {
        func = args[item.operator]
      } else {
        throw new ParseError("Unknown function or command - " + item.operator)
      }
      try {
        return func(...item.value.map((element: Expression) => this.execute(args, element)))
      } catch (error) {
        throw new ParseError(error.message, item.position)
      }
    }
  }
}

//// ============= test ==================================

// class Player {
//   constructor(public color: number) {

//   }
// }

// const _command = 'y = p.players[1].color';
// const par = {
//   x: 1,
//   y: 6,
//   a: [3, 4, 5, 6, 7],
//   ssum: (a, b) => a + b,
//   c: { k: 'text', l: 5, b: (a, b) => a + b },
//   p: {
//     players: new Stack<Player>(new Player(1), new Player(255)),
//   },
// };

// try {
//   const x = new LLParser(_command);
//   console.log(_command);
//   x.data.forEach((item: any) => console.log(x.toString(item.expression)));
//   x.run(par);
//   console.log(JSON.stringify(par));
// } catch (error) {
//     console.log('!!! error: ' + error.message + ":");
//     console.log(_command.slice(0, error.position) + ' >>' +
//                 _command.slice(error.position));
// }
