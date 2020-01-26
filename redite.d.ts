import { Redis } from 'ioredis';

type MutatingMethod =
  | 'push'
  | 'remove'
  | 'removeIndex'
  | 'pop'
  | 'shift'
  | 'unshift';
type NonMutatingMethod =
  | 'concat'
  | 'find'
  | 'findIndex'
  | 'includes'
  | 'indexOf'
  | 'lastIndexOf'
  | 'map'
  | 'length'
  | 'filter'
  | 'join'
  | 'forEach';
type SupportedArrayMethod = MutatingMethod | NonMutatingMethod;

interface Constants {
  MutatingMethod: MutatingMethod[];
  NonMutatingMethod: NonMutatingMethod[];
  SupportedArrayMethod: SupportedArrayMethod[];
}

interface RediteOptions {
  client?: Redis;
  url?: string;
  serialise?: (value: any) => string;
  parse?: (value: string) => any;
  deletedString?: string;
  customInspection?: boolean;
  ignoreUndefinedValues?: boolean;
}

declare function r(options?: RediteOptions): r.Redite;

declare namespace r {
  // Needs to be an interface in order to have a callable type.
  interface ChildWrapper {
    _stack: string[];

    finally(onfinally?: (() => void) | undefined | null): Promise<any>;
    then(
      onfulfilled?: ((value: any) => any) | undefined | null,
      onrejected?: ((reason: any) => any) | undefined | null
    ): Promise<any>;
    catch(onrejected?: ((reason: any) => any) | undefined | null): Promise<any>;

    new (parentObj: Redite, parentKey: string, stack?: string[]);
    set(value: any): Promise<void>;
    has(key?: string): Promise<boolean>;
    exists(key?: string): Promise<boolean>;
    delete(key?: string): Promise<void>;

    // Array method emulators
    push(...values): Promise<void>;
    pop(): Promise<any>;
    shift(): Promise<any>;
    unshift(...values): Promise<void>;
    remove(value, amount?: number): Promise<void>;
    removeIndex(index: number): Promise<void>;

    concat(...values): Promise<any[]>;
    find(
      callback: (value, index?: number, array?: any[]) => boolean,
      thisArg?
    ): Promise<any | undefined>;
    findIndex(
      callback: (value, index?: number, array?: any[]) => boolean,
      thisArg?
    ): Promise<number>;
    includes(value, startIndex?: number): Promise<boolean>;
    indexOf(value, startIndex?: number): Promise<number>;
    lastIndexOf(value, startIndex?: number): Promise<number>;
    map(
      callback: (value, index?: number, array?: any[]) => any,
      thisArg?
    ): Promise<any[]>;
    filter(
      callback: (value, index?: number, array?: any[]) => boolean,
      thisArg?
    ): Promise<any[]>;
    join(separator?: string): Promise<string>;
    forEach(
      callback: (value, index?: number, array?: any[]) => void,
      thisArg?
    ): Promise<any[]>;
    length(): Promise<number>;

    // Emulates proxy behaviour.
    [key: string]: ChildWrapper | any;
    [key: number]: ChildWrapper | any;
  }

  export class Redite {
    _redis: RedisClient;
    _serialise: (value: any) => string;
    _parse: (value: string) => any;
    _deletedString: string;
    _customInspection: boolean;
    _ignoreUndefinedValues: boolean;

    constructor(options?: RediteOptions);

    has(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;

    getStack(key: string, stack?: string[]): Promise<any>;
    setStack(value: any, stack?: string[]): Promise<void>;
    deleteStack(key: string, stack?: string[]): Promise<void>;
    hasStack(key: string, stack?: string[]): Promise<boolean>;
    arrayStack(method: string, stack?: string[]): (...args) => Promise<any>;

    [key: string]: ChildWrapper | any;
    [key: number]: ChildWrapper | any;
  }

  export const Constants: Constants;
  export const ChildWrapper: ChildWrapper;
}

export = r;
