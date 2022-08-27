import Arg, {ArgType, IArg} from "./arg.class";
import {RhineBlock} from "../RhineBlock";
import BaseRender from "../render/base/base-render";
import DragManager from "../drag/drag-manager";

export default class Block {

  view: SVGElement | null = null;
  width: number = 0;
  height: number = 0;

  next: Arg = Arg.fromJson(-1, {type: ArgType.Statement});
  previous: Block | null = null;
  parent: Block | null = null;

  isRoot: boolean = false; // 是否为根元素
  x: number = 0;
  y: number = 0;
  isShadow: boolean = false;

  constructor(
    public name: string,
    public type: BlockType,
    public lines: Arg[][],
    public output: string | null,
    public color: string,
  ) {
  }

  static fromItem(item: Item, parent: Block | null = null, toolboxMode: boolean = false): Block {
    let data = RhineBlock.getBlockData(item.block)
    if (!data) {
      console.error('Block is not register', item.block)
      data = RhineBlock.getBlockData('unknown')!
    }
    if(toolboxMode) {
      item.args = typeof data.toolbox !== "boolean" ? data.toolbox : []
    }
    return Block.fromDataAndArgs(data, item.args, parent)
  }

  private static fromDataAndArgs(data: IBlock, args: ItemValue[] | null = null, parent: Block | null = null): Block {
    let argI = 0;
    const lines = data.lines.map(line => {
      return line.map(arg => {
        if (arg.text !== undefined) arg.type = ArgType.Text;
        const id = arg.type === ArgType.Text ? -1 : argI++;
        return Arg.fromJson(id, arg);
      })
    })
    const block = new Block(
      data.name,
      data.type ? data.type : BlockType.Statement,
      lines,
      data.output ? data.output : null,
      data.color ? data.color : '#329eff',
    )
    block.parent = parent
    if(args) {
      block.setArgsFromItems(args)
    }
    return block
  }

  setMouseEvent(body: SVGPathElement): void {
    body.onmousedown = (e) => {
      DragManager.onDragBlock(this, e)
      this.parent?.setArgFromContent(this, null)
      return false
    }
  }
  setArgFromContent(content: Block, item: Item | null = null): void {
    this.mapBlockArgs(arg => {
      if (arg.content === content) {
        if(item) {
          this.setArgFromItem(item, arg)
        }else{
          this.clearArg(arg)
        }
        BaseRender.rerenderFull(this)
      }
    })
  }
  getArgByContent(content: Block): Arg | void {
    this.mapBlockArgs(arg => {
      if (arg.content === content) {
        return arg
      }
    })
  }
  mapBlockArgs(fn: (arg: Arg) => void): void {
    this.mapValueArgs(arg => {
      if (arg.type === ArgType.Value || arg.type === ArgType.Statement) {
        fn(arg)
      }
    })
    fn(this.next)
  }
  clearArg(arg: Arg): void {
    arg.content = null
    if(arg.view) {
      arg.view.remove()
    }
    arg.view = null
  }

  clone(): Block {
    const data = RhineBlock.getBlockData(this.name)!
    return Block.fromDataAndArgs(data, this.getItem().args, this.parent)
  }

  hadHat(): boolean {
    return this.type === BlockType.HatSingle || this.type === BlockType.Hat
  }

  hadNext(): boolean {
    return this.type !== BlockType.Single && this.type !== BlockType.Finish
  }

  hadStatementInLine(i: number): boolean {
    return this.lines[i].some(arg => arg.type === ArgType.Statement)
  }

  mapArgs(fn: (arg: Arg, i: number, j: number) => void): void {
    this.lines.forEach((line, i) => {
      line.forEach((arg, j) => {
        fn(arg, i, j);
      })
    })
  }
  mapValueArgs(fn: (arg: Arg, id: number, i: number, j: number) => void): void {
    this.lines.forEach((line, i) => {
      line.forEach((arg, j) => {
        if (arg.type !== ArgType.Text) {
          fn(arg, arg.id, i, j)
        }
      })
    })
  }

  setArgFromItem(item: ItemValue, arg: Arg): void {
    if(item === null) {
      arg.content = null
    }else if (typeof item === 'object') {
      const blockData = RhineBlock.getBlockData(item.block)
      if (!blockData) {
        console.error('Block is not register', item.block)
        return
      }
      if (arg.type === ArgType.Value && blockData.type === BlockType.Output) {
        arg.content = Block.fromDataAndArgs(blockData, item.args, this)
      } else if (
        arg.type === ArgType.Statement && (
          blockData.type === BlockType.Statement ||
          blockData.type === BlockType.Finish
        )
      ) {
        arg.content = Block.fromDataAndArgs(blockData, item.args, this)
        if(item.next){
          if(item.args) arg.content.setArgsFromItems(item.args)
          arg.content.previous = this
        }
      } else {
        return;
      }
    } else {
      arg.content = item
    }
  }
  setArgsFromItems(contents: ItemValue[]): void {
    if (!contents) return
    try {
      // 设置所有内部参数
      this.mapValueArgs((arg, id) => {
        const content = contents[id];
        if(!content) return
        this.setArgFromItem(content, arg)
      })
      // 设置下方参数
      const content = contents[contents.length - 1]
      if(content && typeof content === 'object' && content.next) {
        this.setArgFromItem(content, this.next)
      }
    } catch (e) {
      console.error('Args is invalid for this block', e)
    }
  }

  getArg(id: number): Arg | null {
    for (const line of this.lines) {
      for (const arg of line) {
        if (arg.id === id) return arg
      }
    }
    return null
  }

  getItem(): Item {
    const contents: ItemValue[] = []
    this.mapValueArgs((arg, id) => {
      if(arg.type === ArgType.Statement || arg.type === ArgType.Value) {
        if(arg.content) {
          contents.push(this.getArgBlockItem(arg))
        }else{
          contents.push(null)
        }
      }else if(typeof arg.content !== 'object') {
        contents.push(arg.content)
      }else{
        contents.push(null)
      }
    });
    if(this.next.content) {
      contents.push(this.getArgBlockItem(this.next));
      (contents[contents.length - 1]! as Item).next = true
    }
    const item: Item = {
      block: this.name,
      args: contents,
    }
    if(this.isShadow) item.shadow = true
    return item
  }

  getArgBlockItem(arg: Arg): Item {
    return (arg.content as Block).getItem()
  }

  setPosition(x: number, y: number): void {
    this.x = x
    this.y = y
    this.view?.setAttribute('transform', `translate(${x}, ${y})`)
  }

}

// 图形块类型
export enum BlockType {
  Statement,
  Output,
  Hat,
  Single,
  Start,
  Finish,
  HatSingle,
}

// 图形块申明接口
export interface IBlock {
  name: string;
  type?: BlockType;
  lines: IArg[][];
  output?: string | null;
  color?: string;

  toolbox?: ItemValue[] | boolean;
}


// 内容类型
export type ItemValue = string | number | boolean | null | Item;

// 图形内容
export interface Item {
  block: string;
  args?: ItemValue[];

  next?: boolean; // 是否为下行属性
  shadow?: boolean; // 是否为阴影块
}

// 根图形块内容
export interface RootItem extends Item {
  x: number;
  y: number;
}

