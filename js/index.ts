// Типы категорий для блоков
type Category = 'starts' | 'operator' | 'variable' | 'event';

// Структура данных для создания нового блока
interface ItemData {
    name: string;
    description: string;
    category: Category;
    shape: string;
}

// Настройки: селекторы контейнеров и дефолтная позиция
const CONFIG = {
    SELECTORS: {
        starts: '#category-starts',
        operator: '#category-operators',
        variable: '#category-variables',
        event: '#category-events'
    } as Record<Category, string>,
    DEFAULT_POS: { left: 60, top: 60 },
};

// Хранилище переменных и массивов во время работы программы
class Environment {
    public vars: Record<string, number> = {};
    public arrays: Record<string, number[]> = {};

    // Вычисляет то, что юзер написал в поле ввода
    public evaluate(expr: string): any {
        if (!expr.trim()) return 0;
        const parser = new ExpressionParser(this);
        return parser.evaluate(expr);
    }
}

// Сам движок парсинга математики и логики
class ExpressionParser {
    private pos = 0;
    private tokens: string[] = [];
    private env: Environment;

    constructor(env: Environment) {
        this.env = env;
    }

    // Главная функция разбора строки
    public evaluate(expr: string): any {
        const tokenRegex = /==|!=|<=|>=|&&|\|\||!|\bAND\b|\bOR\b|\bNOT\b|[a-zA-Z_]\w*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[+\-*/%()[\]<>,"']/gi;

        this.tokens = (expr.match(tokenRegex) || []).map(t => t.trim());
        this.pos = 0;

        if (this.tokens.length === 0) return 0;

        const result = this.parseOr();

        if (this.pos < this.tokens.length) {
            throw new Error(`Синтаксическая ошибка: лишний токен '${this.tokens[this.pos]}'`);
        }

        return result;
    }

    // Глянуть текущий токен и привести к верхнему регистру (для команд)
    private peek(): string | undefined {
        if (this.pos >= this.tokens.length) return undefined;
        const token = this.tokens[this.pos].toUpperCase();
        if (token === '&&') return 'AND';
        if (token === '||') return 'OR';
        if (token === '!') return 'NOT';
        return token;
    }

    // Глянуть токен как он есть (для имен переменных)
    private peekRaw(): string | undefined {
        return this.tokens[this.pos];
    }

    // Взять текущий токен и перейти к следующему
    private consume(): string {
        if (this.pos >= this.tokens.length) {
            throw new Error("Неожиданный конец выражения");
        }
        return this.tokens[this.pos++];
    }

    // Разбор логического ИЛИ
    private parseOr(): any {
        let left = this.parseAnd();

        while (this.peek() === 'OR') {
            this.consume();
            const right = this.parseAnd();
            left = left || !!right;
        }

        return left;
    }

    // Разбор логического И
    private parseAnd(): any {
        let left = this.parseEquality();

        while (this.peek() === 'AND') {
            this.consume();
            const right = this.parseEquality();
            left = left && !!right;
        }

        return left;
    }

    // Разбор == и !=
    private parseEquality(): any {
        let left = this.parseRelational();

        while (true) {
            const op = this.peek();
            if (op === '==' || op === '!=') {
                this.consume();
                const right = this.parseRelational();
                left = (op === '==') ? left == right : left != right;
            } else {
                break;
            }
        }

        return left;
    }

    // Разбор сравнений (> < >= <=)
    private parseRelational(): any {
        let left = this.parseAdditive();

        while (true) {
            const op = this.peek();
            if (['<', '>', '<=', '>='].includes(op || '')) {
                this.consume();
                const right = this.parseAdditive();
                if (op === '<') left = left < right;
                if (op === '>') left = left > right;
                if (op === '<=') left = left <= right;
                if (op === '>=') left = left >= right;
            } else {
                break;
            }
        }

        return left;
    }

    // Сложение и вычитание
    private parseAdditive(): any {
        let left = this.parseMultiplicative();

        while (true) {
            const op = this.peek();
            if (op === '+' || op === '-') {
                this.consume();
                const right = this.parseMultiplicative();
                left = (op === '+') ? left + right : left - right;
            } else {
                break;
            }
        }

        return left;
    }

    // Умножение, деление и остаток
    private parseMultiplicative(): any {
        let left = this.parseUnary();

        while (true) {
            const op = this.peek();
            if (['*', '/', '%'].includes(op || '')) {
                this.consume();
                const right = this.parseUnary();

                if (op === '*') left = left * right;
                if (op === '/') {
                    if (right === 0) throw new Error("Деление на ноль");
                    left = Math.trunc(left / right);
                }
                if (op === '%') left = left % right;
            } else {
                break;
            }
        }

        return left;
    }

    // Отрицательные числа и логическое НЕ (!)
    private parseUnary(): any {
        const op = this.peek();

        if (op === '-' || op === 'NOT') {
            this.consume();
            const value = this.parsePrimary();
            if (op === '-') return -Number(value);
            if (op === 'NOT') return !value;
        }

        return this.parsePrimary();
    }

    // Самые базовые сущности: числа, строки, скобки, переменные
    private parsePrimary(): any {
        const tokenRaw = this.peekRaw();
        if (!tokenRaw) throw new Error("Неожиданный конец выражения");

        const tokenUpper = tokenRaw.toUpperCase();
        this.consume();

        if (tokenUpper === 'TRUE') return true;
        if (tokenUpper === 'FALSE') return false;

        if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(tokenRaw)) {
            return Number(tokenRaw);
        }

        if ((tokenRaw.startsWith('"') && tokenRaw.endsWith('"')) ||
            (tokenRaw.startsWith("'") && tokenRaw.endsWith("'"))) {
            return tokenRaw.slice(1, -1);
        }

        if (/^[a-zA-Z_]\w*$/.test(tokenRaw)) {
            if (this.peekRaw() === '[') {
                this.consume();
                const index = this.parseOr();
                if (this.consume() !== ']') {
                    throw new Error("Пропущена закрывающая скобка ']'");
                }

                if (!this.env.arrays[tokenRaw]) {
                    throw new Error(`Массив ${tokenRaw} не объявлен`);
                }
                const arr = this.env.arrays[tokenRaw];
                if (index < 0 || index >= arr.length || !Number.isInteger(index)) {
                    throw new Error(`Некорректный индекс массива: ${tokenRaw}[${index}]`);
                }
                return arr[index];
            }

            if (this.env.vars[tokenRaw] === undefined) {
                throw new Error(`Переменная ${tokenRaw} не объявлена`);
            }
            return this.env.vars[tokenRaw];
        }

        if (tokenRaw === '(') {
            const expr = this.parseOr();
            if (this.consume() !== ')') {
                throw new Error("Пропущена закрывающая скобка ')'");
            }
            return expr;
        }

        throw new Error(`Недопустимый токен: ${tokenRaw}`);
    }
}

// Отвечает за запуск кода и вывод в лог
class Interpreter {
    static consoleEl = document.getElementById('console-output');

    // Делаем паузу, чтобы выполнение было видно глазом
    static sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Печатает сообщение в наше окошко консоли
    static print(msg: string, type: 'normal' | 'system' | 'error' = 'normal') {
        if (!this.consoleEl) return;
        const line = document.createElement('div');
        line.className = `console-line ${type === 'normal' ? '' : type + '-msg'}`;
        line.textContent = `> ${msg}`;
        this.consoleEl.appendChild(line);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight; // Скроллим вниз
    }

    // Чистим консоль перед запуском
    static clear() {
        if (this.consoleEl) this.consoleEl.innerHTML = '';
    }

    // Основной цикл запуска программы
    static async run(workspace: Workspace) {
        this.clear();
        this.print("Запуск компиляции...", "system");

        workspace.clearErrors();

        const rootElements = workspace.element?.querySelectorAll(':scope > .workspace-item');
        if (!rootElements || rootElements.length === 0) {
            this.print("Ошибка: Рабочая область пуста.", "error");
            return;
        }

        const startBlocks: BaseBlock[] = [];
        rootElements.forEach(el => {
            const block = (el as any).blockInstance as BaseBlock;
            if (block && block.data.name === 'Начало') startBlocks.push(block);
        });

        if (startBlocks.length === 0) {
            this.print("Ошибка: Отсутствует блок 'Начало'.", "error");
            return;
        }

        const env = new Environment();

        try {
            this.print("Исполнение...", "system");
            await startBlocks[0].execute(env);
            this.print("Программа успешно завершена.", "system");
        } catch (error: any) {
            this.print(`КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, "error");
        }
    }
}

// Вспомогательные функции для работы с DOM
class Utils {
    // Короткий выбор элемента
    static $<T extends HTMLElement>(s: string): T | null { return document.querySelector(s); }

    // Короткий выбор списка элементов
    static $$<T extends HTMLElement>(s: string): NodeListOf<T> { return document.querySelectorAll(s); }

    // Ограничение числа
    static clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(v, max)); }

    // Определяем категорию блока по его расположению в меню
    static getCategory(el: HTMLElement): Category {
        const entries = Object.entries(CONFIG.SELECTORS) as [Category, string][];
        for (const [cat, selector] of entries) {
            if (el.closest(selector)) return cat;
        }
        return 'operator';
    }

    // Вытаскиваем инфу о блоке из HTML
    static getItemData(el: HTMLElement): ItemData {
        return {
            name: el.querySelector('.function-name')?.textContent?.trim() || 'Блок',
            description: el.querySelector('.function-desc')?.textContent?.trim() || '',
            category: this.getCategory(el),
            shape: el.dataset.shape || 'square'
        };
    }
}

// Абстрактный класс для всех блоков (база)
abstract class BaseBlock {
    public element: HTMLDivElement;
    protected workspace: Workspace;
    public data: ItemData;
    public next: BaseBlock | null = null;
    public previous: BaseBlock | null = null;

    constructor(data: ItemData, workspace: Workspace) {
        this.data = data;
        this.workspace = workspace;
        this.element = this.render();
        this.attachEvents();
    }

    // Создаем HTML структуру блока
    protected render(): HTMLDivElement {
        const item = document.createElement('div');
        item.className = `workspace-item ${this.data.category}-item shape-${this.data.shape}`;
        item.dataset.category = this.data.category;
        (item as any).blockInstance = this;

        item.innerHTML = `
            <div class="item-name">${this.data.name}</div>
            <div class="item-desc">${this.data.description}</div>
            ${this.getInnerTemplate()} 
            <button class="remove-item" title="Удалить">×</button>
        `;
        Object.assign(item.style, { position: 'absolute', zIndex: "10" });
        return item;
    }

    // У каждого блока свой набор полей (инпутов)
    protected abstract getInnerTemplate(): string;

    // Может ли этот блок принимать внутрь другие блоки
    public abstract canAccept(childCategory: Category, childShape: string): boolean;

    // Можно ли этот блок положить в чужой слот
    public abstract isMovableToSlot(): boolean;

    // События удаления и начала перетаскивания
    private attachEvents(): void {
        this.element.querySelector('.remove-item')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.destroy();
        });
        // Если кликнули не по инпуту — значит хотим тащить
        this.element.onmousedown = (e) => {
            if ((e.target as HTMLElement).tagName !== 'INPUT') {
                this.workspace.dragStart(e, this);
            }
        };
        // Отключаем нативный drag-n-drop браузера
        this.element.ondragstart = (e) => {
            if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault();
        };
    }

    // Вставляет блок в связный список после текущего
    public insertAfter(block: BaseBlock): void {
        block.next = this.next;
        if (this.next) this.next.previous = block;
        this.next = block;
        block.previous = this;
    }

    // Вырезает блок из связного списка
    public removeFromList(): void {
        if (this.previous) this.previous.next = this.next;
        if (this.next) this.next.previous = this.previous;
        this.next = null;
        this.previous = null;
    }

    // Выполнение логики блока
    public async execute(env: Environment): Promise<any> {
        this.element.style.boxShadow = "0 0 10px 3px yellow";
        await Interpreter.sleep(300);

        try {
            await this.runAction(env);
            this.element.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
        } catch (error: any) {
            this.element.classList.add('error-highlight');
            this.element.style.boxShadow = "";
            throw error;
        }

        if (this.next) {
            await this.next.execute(env);
        }
    }

    // Логика конкретного типа блока (переопределяется)
    protected abstract runAction(env: Environment): Promise<any>;

    // Запуск блоков, которые вложены в "дырку" текущего блока
    protected async runInnerSlot(env: Environment, slotSelector: string = '.block-slot'): Promise<void> {
        const slot = this.element.querySelector(`:scope > ${slotSelector}`);
        const firstChildEl = slot?.querySelector(':scope > .workspace-item');
        if (firstChildEl) {
            const firstChildBlock = (firstChildEl as any).blockInstance as BaseBlock;
            await firstChildBlock.execute(env);
        }
    }

    // Полное удаление
    public destroy(): void {
        this.removeFromList();
        this.element.remove();
        this.workspace.syncLinkedLists();
        this.workspace.checkEmpty();
    }
}

// Блок старта программы
class RootBlock extends BaseBlock {
    protected getInnerTemplate(): string { return '<div class="block-slot" data-label="Тело программы"></div>'; }

    public canAccept(childCategory: Category, childShape: string): boolean { return true; }

    public isMovableToSlot(): boolean { return false; }

    protected async runAction(env: Environment): Promise<any> {
        Interpreter.print(`[Старт] Инициализация...`);
        await this.runInnerSlot(env);
    }

    // У блока Начало особенный execute (игнорирует соседей снаружи)
    public async execute(env: Environment): Promise<any> {
        this.element.style.boxShadow = "0 0 10px 3px yellow";
        await Interpreter.sleep(300);

        try {
            await this.runAction(env);
            this.element.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
        } catch (error: any) {
            this.element.classList.add('error-highlight');
            this.element.style.boxShadow = "";
            throw error;
        }
    }
}

// Блок создания обычных переменных
class VarDeclBlock extends BaseBlock {
    protected getInnerTemplate(): string { return '<input class="block-input" placeholder="x, y, result" title="Через запятую" />'; }

    public canAccept(): boolean { return false; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const val = this.element.querySelector('input')?.value || '';
        const names = val.split(',').map(s => s.trim()).filter(s => s);
        if (names.length === 0) throw new Error("Не указаны имена переменных");

        for (let name of names) {
            if (!/^[a-zA-Z_]\w*$/.test(name)) throw new Error(`Недопустимое имя переменной: ${name}`);
            env.vars[name] = 0;
        }
        Interpreter.print(`Объявлены переменные: ${names.join(', ')}`);
    }
}

// Блок создания массива
class ArrayDeclBlock extends BaseBlock {
    protected getInnerTemplate(): string {
        return `<div class="input-row">
                    <input class="block-input" placeholder="arr" style="width: 50%" title="Имя массива"/>[
                    <input class="block-input" placeholder="10" style="width: 40%" title="Размер"/> ]
                </div>`;
    }

    public canAccept(): boolean { return false; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const inputs = this.element.querySelectorAll('input');
        const name = inputs[0].value.trim();
        const sizeExpr = inputs[1].value.trim();

        if (!/^[a-zA-Z_]\w*$/.test(name)) throw new Error(`Недопустимое имя массива: ${name}`);

        const size = env.evaluate(sizeExpr);
        if (size <= 0) throw new Error(`Размер массива должен быть > 0`);

        env.arrays[name] = new Array(size).fill(0);
        Interpreter.print(`Объявлен массив: ${name}[${size}]`);
    }
}

// Блок присваивания (x = 5)
class AssignBlock extends BaseBlock {
    protected getInnerTemplate(): string {
        return `<div class="input-row">
                    <input class="block-input assign-left" placeholder="x" style="width: 40%"/> =
                    <input class="block-input assign-right" placeholder="a + 5" style="width: 55%"/>
                </div>`;
    }

    public canAccept(): boolean { return false; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const left = this.element.querySelector('.assign-left') as HTMLInputElement;
        const right = this.element.querySelector('.assign-right') as HTMLInputElement;
        const leftVal = left.value.trim();
        const rightVal = right.value.trim();

        if (!leftVal || !rightVal) throw new Error("Пустое поле присваивания");

        const result = env.evaluate(rightVal);

        const arrMatch = leftVal.match(/^([a-zA-Z_]\w*)\[(.+)\]$/);
        if (arrMatch) {
            const arrName = arrMatch[1];
            const index = env.evaluate(arrMatch[2]);
            if (!env.arrays[arrName]) throw new Error(`Массив ${arrName} не существует`);
            if (index < 0 || index >= env.arrays[arrName].length) throw new Error(`Индекс ${index} вне границ ${arrName}`);
            env.arrays[arrName][index] = result;
            Interpreter.print(`${arrName}[${index}] = ${result}`);
        } else {
            if (env.vars[leftVal] === undefined) throw new Error(`Переменная ${leftVal} не объявлена`);
            env.vars[leftVal] = result;
            Interpreter.print(`${leftVal} = ${result}`);
        }
    }
}

// Блок ветвления "Если"
class IfBlock extends BaseBlock {
    protected getInnerTemplate(): string {
        return `Условие: <input class="block-input" placeholder="x > 5" />
                <div class="block-slot" data-label="Тогда"></div>`;
    }

    public canAccept(): boolean { return true; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const cond = this.element.querySelector('input')?.value.trim();
        if (!cond) throw new Error("Пустое условие в If");

        const isTrue = env.evaluate(cond);
        Interpreter.print(`[Если] Условие (${cond}) -> ${isTrue}`);

        if (isTrue) {
            await this.runInnerSlot(env);
        }
    }
}

// Блок ветвления "Если-Иначе"
class IfElseBlock extends BaseBlock {
    protected getInnerTemplate(): string {
        return `Условие: <input class="block-input" placeholder="x == y" />
                <div class="block-slot slot-true" data-label="Тогда"></div>
                <div class="block-slot slot-false" data-label="Иначе"></div>`;
    }

    public canAccept(): boolean { return true; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const cond = this.element.querySelector('input')?.value.trim();
        if (!cond) throw new Error("Пустое условие в If-Else");

        const isTrue = env.evaluate(cond);
        Interpreter.print(`[Если-Иначе] Условие (${cond}) -> ${isTrue}`);

        if (isTrue) {
            await this.runInnerSlot(env, '.slot-true');
        } else {
            await this.runInnerSlot(env, '.slot-false');
        }
    }
}

// Блок цикла "Пока"
class WhileBlock extends BaseBlock {
    protected getInnerTemplate(): string {
        return `Условие: <input class="block-input" placeholder="i < 10" />
                <div class="block-slot" data-label="Повторять"></div>`;
    }

    public canAccept(): boolean { return true; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const input = this.element.querySelector('input');
        let iterations = 0;
        const MAX_ITERATIONS = 1000;

        while (true) {
            const cond = input?.value.trim();
            if (!cond) throw new Error("Пустое условие в While");

            const isTrue = env.evaluate(cond);
            if (!isTrue) {
                Interpreter.print(`[Пока] Завершен`);
                break;
            }

            iterations++;
            if (iterations > MAX_ITERATIONS) throw new Error(`Защита от зависания: превышен лимит (${MAX_ITERATIONS})`);

            Interpreter.print(`[Пока] Итерация ${iterations}`);
            await this.runInnerSlot(env);
        }
    }
}

// Блок вывода в консоль
class PrintBlock extends BaseBlock {
    protected getInnerTemplate(): string {
        return `<input class="block-input" placeholder="x, y, z," />`;
    }

    public canAccept(): boolean { return false; }

    public isMovableToSlot(): boolean { return true; }

    protected async runAction(env: Environment): Promise<any> {
        const input = this.element.querySelector('input') as HTMLInputElement;
        const text = input?.value?.trim();

        if (!text) throw new Error("Поле вывода пустое");

        const parts = text.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim());

        const values = parts.map(part => {
            if (!part) return "";
            // Если это просто строка в кавычках
            if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
                return part.slice(1, -1);
            }
            // Иначе пробуем вычислить как переменную или математику
            try {
                return env.evaluate(part);
            } catch {
                return part;
            }
        });

        Interpreter.print(values.map(v => String(v)).join(" "));
    }
}

// Главный класс управления рабочим полем
class Workspace {
    public element = Utils.$<HTMLDivElement>('#workspace');
    private activeBlock: BaseBlock | null = null;
    private offset = { x: 0, y: 0 };

    // Запуск области
    public init(): void {
        if (!this.element) return;
        this.setupDrop();
        this.checkEmpty();

        window.addEventListener('resize', () => this.updatePositions());
    }

    // Убираем красную подсветку со всех блоков
    public clearErrors(): void {
        Utils.$$('.error-highlight').forEach(el => el.classList.remove('error-highlight'));
    }

    // Фабрика создания блоков по именам из меню
    public createBlock(data: ItemData): BaseBlock {
        switch (data.name) {
            case 'Начало': return new RootBlock(data, this);
            case 'Переменная': return new VarDeclBlock(data, this);
            case 'Массив': return new ArrayDeclBlock(data, this);
            case 'Присвоить': return new AssignBlock(data, this);
            case 'Если': return new IfBlock(data, this);
            case 'Если-Иначе': return new IfElseBlock(data, this);
            case 'Пока': return new WhileBlock(data, this);
            case 'Вывести': return new PrintBlock(data, this);
            default: throw new Error(`Неизвестный тип блока: ${data.name}`);
        }
    }

    // Логика начала перетаскивания (mousedown)
    public dragStart(e: MouseEvent, block: BaseBlock): void {

        if ((e.target as HTMLElement).closest('.remove-item') || (e.target as HTMLElement).tagName === 'INPUT') return;

        e.preventDefault(); e.stopPropagation();

        const item = block.element;
        let rect = item.getBoundingClientRect();

        if (item.parentElement?.classList.contains('block-slot')) {
            const wsRect = this.element!.getBoundingClientRect();
            this.element!.appendChild(item);

            item.style.position = 'absolute';
            item.style.width = '';

            item.style.left = `${rect.left - wsRect.left + this.element!.scrollLeft}px`;
            item.style.top = `${rect.top - wsRect.top + this.element!.scrollTop}px`;

            rect = item.getBoundingClientRect();
        }

        this.activeBlock = block;

        let offsetX = e.clientX - rect.left;
        if (offsetX > rect.width) offsetX = rect.width / 2;
        this.offset = { x: offsetX, y: e.clientY - rect.top };

        item.classList.add('dragging');
        item.style.zIndex = "1000";

        document.addEventListener('mousemove', this.onMove);
        document.addEventListener('mouseup', this.onUp, { once: true });
    }

    // Вспомогательные функции для слушателей
    private onMove = (e: MouseEvent) => this.dragging(e);
    private onUp = () => this.dragEnd();

    // Процесс перемещения (mousemove)
    private dragging(e: MouseEvent): void {
        if (!this.activeBlock || !this.element) return;
        const wsRect = this.element.getBoundingClientRect();

        let x = e.clientX - this.offset.x - wsRect.left + this.element.scrollLeft;
        let y = e.clientY - this.offset.y - wsRect.top + this.element.scrollTop;

        x = Math.max(0, x);
        y = Math.max(0, y);

        this.activeBlock.element.style.left = `${x}px`;
        this.activeBlock.element.style.top = `${y}px`;

        this.clearHighlights();
        const targetSlot = this.findValidSlot(e.clientX, e.clientY);
        if (targetSlot) targetSlot.classList.add('drag-over');
    }

    // Конец перетаскивания (mouseup)
    private dragEnd(): void {
        if (!this.activeBlock) return;
        document.removeEventListener('mousemove', this.onMove);

        const rect = this.activeBlock.element.getBoundingClientRect();
        const slot = this.findValidSlot(rect.left + rect.width / 2, rect.top + 10);

        if (slot) {
            const afterEl = this.getInsertAfter(slot, rect.top + 10);
            if (afterEl) slot.insertBefore(this.activeBlock.element, afterEl);
            else slot.appendChild(this.activeBlock.element);

            // Меняем позиционирование на относительное (внутри слота)
            Object.assign(this.activeBlock.element.style, { position: 'relative', left: '0', top: '0', width: '100%' });
        } else {
            this.activeBlock.element.style.width = '';
        }

        this.activeBlock.element.style.zIndex = "10";
        this.activeBlock.element.classList.remove('dragging');
        this.activeBlock = null;
        this.clearHighlights();
        this.updateDataPercents();

        this.syncLinkedLists();
    }

    // Проходим по всем контейнерам и заново выстраиваем связи next/previous
    public syncLinkedLists(): void {
        const containers = [this.element, ...Array.from(document.querySelectorAll('.block-slot'))];

        containers.forEach(container => {
            if (!container) return;
            // Берем только прямых детей
            const childBlocks = Array.from(container.querySelectorAll(':scope > .workspace-item:not(.dragging)'))
                .map(el => (el as any).blockInstance as BaseBlock)
                .filter(b => b);

            // Сшиваем их в список
            for (let i = 0; i < childBlocks.length; i++) {
                const block = childBlocks[i];
                block.previous = null;
                block.next = null;
                if (i > 0) childBlocks[i - 1].insertAfter(block);
            }
        });
    }

    // Ищет подходящий слот под мышкой
    private findValidSlot(x: number, y: number): HTMLElement | null {
        if (!this.activeBlock || !this.activeBlock.isMovableToSlot()) return null;

        const targets = document.elementsFromPoint(x, y);
        for (const el of targets) {
            const htmlEl = el as HTMLElement;
            if (htmlEl.classList.contains('block-slot')) {
                const parentInstance = (htmlEl.closest('.workspace-item') as any)?.blockInstance as BaseBlock;

                if (parentInstance && parentInstance.canAccept(this.activeBlock.data.category, this.activeBlock.data.shape)) {
                    if (this.activeBlock.element.contains(htmlEl)) continue;
                    return htmlEl;
                }
            }
        }
        return null;
    }

    // Настройка приема новых блоков из меню
    private setupDrop(): void {
        if (!this.element) return;
        this.element.ondragover = (e) => e.preventDefault();
        this.element.ondrop = (e) => {
            e.preventDefault();
            const json = e.dataTransfer?.getData('text/plain');
            if (!json) return;

            const block = this.createBlock(JSON.parse(json));
            this.element!.appendChild(block.element);

            const wsRect = this.element!.getBoundingClientRect();

            // Ставим блок там, где отпустили мышь
            let x = e.clientX - wsRect.left - (block.element.offsetWidth / 2) + this.element!.scrollLeft;
            let y = e.clientY - wsRect.top - (block.element.offsetHeight / 2) + this.element!.scrollTop;

            block.element.style.left = `${Math.max(0, x)}px`;
            block.element.style.top = `${Math.max(0, y)}px`;

            this.updateDataPercents();
            this.syncLinkedLists();
            Utils.$('.workspace-placeholder')?.remove();
        };
    }

    // Поиск соседа внутри слота, чтобы вставить блок между другими
    private getInsertAfter(slot: HTMLElement, y: number): HTMLElement | null {
        const elements = [...slot.querySelectorAll(':scope > .workspace-item:not(.dragging)')] as HTMLElement[];
        return elements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - (box.top + box.height / 2);
            return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }).element;
    }

    // Сброс подсветки у всех слотов
    private clearHighlights(): void { Utils.$$('.block-slot').forEach(s => s.classList.remove('drag-over')); }

    // Конвертируем пиксели в проценты (нужно для адаптивности)
    private updateDataPercents(): void {
        if (!this.element) return;
        const rect = this.element.getBoundingClientRect();
        Utils.$$<HTMLElement>('.workspace-item').forEach(item => {
            if (item.parentElement === this.element) {
                item.dataset.leftPercent = ((parseFloat(item.style.left) / rect.width) * 100).toString();
                item.dataset.topPercent = ((parseFloat(item.style.top) / rect.height) * 100).toString();
            }
        });
    }

    // Если поле пустое — показываем надпись
    public checkEmpty(): void {
        if (Utils.$$('.workspace-item').length === 0 && !Utils.$('.workspace-placeholder')) {
            this.element?.insertAdjacentHTML('afterbegin', '<div class="workspace-placeholder">Перетащите сюда элементы из меню</div>');
        }
    }

    // Полная очистка поля
    public clear(): void {
        Utils.$$('.workspace-item').forEach(el => el.remove());
        this.syncLinkedLists();
        this.checkEmpty();
        Interpreter.clear();
    }

    // Возвращаем блоки на места при ресайзе окна
    private updatePositions(): void {
        if (!this.element) return;
        const rect = this.element.getBoundingClientRect();
        Utils.$$<HTMLElement>('.workspace-item').forEach(item => {
            if (item.parentElement !== this.element) return;
            const lp = parseFloat(item.dataset.leftPercent || '0');
            const tp = parseFloat(item.dataset.topPercent || '0');
            item.style.left = `${(lp / 100) * rect.width}px`;
            item.style.top = `${(tp / 100) * rect.height}px`;
        });
    }
}

// Управление выезжающим меню слева
class SlidingMenu {
    private panel = Utils.$<HTMLDivElement>('.sliding');
    private buttons: Record<string, HTMLElement | null> = {
        starts: Utils.$('#button-tag-starts'),
        variables: Utils.$('#button-tag-variables'),
        operators: Utils.$('#button-tag-operators')
    };
    private cats: Record<string, HTMLElement | null> = {
        starts: Utils.$('#category-starts'),
        variables: Utils.$('#category-variables'),
        operators: Utils.$('#category-operators')
    };
    private activeBtn: HTMLElement | null = null;

    // Инициализация кнопок
    public init(): void {
        this.setupDraggable();
        Object.entries(this.buttons).forEach(([key, btn]) => {
            btn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(btn, this.cats[key]);
            });
        });
        this.observeChanges();
    }

    // Подготовка блоков в меню к перетаскиванию
    private setupDraggable(): void {
        Utils.$$<HTMLDivElement>('.function-item').forEach(item => {
            item.draggable = true;
            item.ondragstart = (e) => e.dataTransfer?.setData('text/plain', JSON.stringify(Utils.getItemData(item)));
        });
    }

    // Открыть/закрыть категорию
    private toggle(btn: HTMLElement, cat: HTMLElement | null): void {
        if (this.activeBtn === btn) this.hide();
        else {
            this.hide();
            if (cat) {
                cat.classList.add('active');
                this.panel?.classList.add('active');
                this.activeBtn = btn;
            }
        }
    }

    // Закрыть меню полностью
    public hide(): void {
        this.panel?.classList.remove('active');
        Object.values(this.cats).forEach(c => c?.classList.remove('active'));
        this.activeBtn = null;
    }

    // Следим за изменениями (если блоки в меню добавятся кодом)
    private observeChanges(): void {
        if (!this.panel) return;
        new MutationObserver(() => this.setupDraggable()).observe(this.panel, { childList: true, subtree: true });
    }
}

// Главный класс приложения
class App {
    private workspace = new Workspace();
    private menu = new SlidingMenu();

    constructor() {
        // Ждем загрузки страницы
        document.addEventListener('DOMContentLoaded', () => this.start());
    }

    // Старт всего кода
    private start(): void {
        this.workspace.init();
        this.menu.init();

        // Вешаем события на главные кнопки
        Utils.$('#clear-workspace')?.addEventListener('click', () => this.workspace.clear());
        Utils.$('#start-workspace')?.addEventListener('click', () => Interpreter.run(this.workspace));

        // Закрываем меню, если кликнули мимо
        document.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).closest('.button-tag, .sliding')) this.menu.hide();
        });
    }
}

// Запуск приложения
new App();