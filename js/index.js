"use strict";
const CONFIG = {
    SELECTORS: {
        starts: '#category-starts',
        operator: '#category-operators',
        variable: '#category-variables',
        string: '#category-string',
        event: '#category-events'
    },
    DEFAULT_POS: { left: 60, top: 60 },
};
class Environment {
    constructor() {
        this.vars = {};
        this.arrays = {};
    }
    /**
     * Вычисляет математическое или логическое выражение с помощью безопасного парсера.
     */
    evaluate(expr) {
        if (!expr.trim())
            return 0;
        const parser = new ExpressionParser(this);
        return parser.evaluate(expr);
    }
}
class ExpressionParser {
    /**
     * Инициализирует парсер выражений с переданным окружением переменных.
     */
    constructor(env) {
        this.pos = 0;
        this.tokens = [];
        this.env = env;
    }
    /**
     * Выполняет лексический анализ и вычисляет переданное выражение.
     */
    evaluate(expr) {
        const tokenRegex = /==|!=|<=|>=|AND|OR|NOT|[a-zA-Z_]\w*|\d+|[+\-*/%()[\]<>]/gi;
        this.tokens = expr.match(tokenRegex) || [];
        this.pos = 0;
        if (this.tokens.length === 0)
            return 0;
        const result = this.parseOr();
        if (this.pos < this.tokens.length) {
            throw new Error(`Синтаксическая ошибка: лишний токен '${this.tokens[this.pos]}'`);
        }
        return result;
    }
    /**
     * Возвращает текущий токен в верхнем регистре без смещения указателя.
     */
    peek() {
        return this.tokens[this.pos]?.toUpperCase();
    }
    /**
     * Возвращает текущий токен в оригинальном регистре без смещения указателя.
     */
    peekRaw() {
        return this.tokens[this.pos];
    }
    /**
     * Возвращает текущий токен и сдвигает указатель на следующий элемент.
     */
    consume() {
        return this.tokens[this.pos++];
    }
    /**
     * Обрабатывает операции логического ИЛИ (OR).
     */
    parseOr() {
        let left = this.parseAnd();
        while (this.peek() === 'OR') {
            this.consume();
            left = left || this.parseAnd();
        }
        return left;
    }
    /**
     * Обрабатывает операции логического И (AND).
     */
    parseAnd() {
        let left = this.parseEquality();
        while (this.peek() === 'AND') {
            this.consume();
            left = left && this.parseEquality();
        }
        return left;
    }
    /**
     * Обрабатывает операции проверки на равенство (==, !=).
     */
    parseEquality() {
        let left = this.parseRelational();
        while (this.peek() === '==' || this.peek() === '!=') {
            let op = this.consume();
            let right = this.parseRelational();
            if (op === '==')
                left = left === right;
            if (op === '!=')
                left = left !== right;
        }
        return left;
    }
    /**
     * Обрабатывает операции сравнения (<, >, <=, >=).
     */
    parseRelational() {
        let left = this.parseAdditive();
        while (['<', '>', '<=', '>='].includes(this.peek() || '')) {
            let op = this.consume();
            let right = this.parseAdditive();
            if (op === '<')
                left = left < right;
            if (op === '>')
                left = left > right;
            if (op === '<=')
                left = left <= right;
            if (op === '>=')
                left = left >= right;
        }
        return left;
    }
    /**
     * Обрабатывает операции сложения и вычитания (+, -).
     */
    parseAdditive() {
        let left = this.parseMultiplicative();
        while (['+', '-'].includes(this.peek() || '')) {
            let op = this.consume();
            let right = this.parseMultiplicative();
            if (op === '+')
                left = left + right;
            if (op === '-')
                left = left - right;
        }
        return left;
    }
    /**
     * Обрабатывает операции умножения, деления и остатка от деления (*, /, %).
     */
    parseMultiplicative() {
        let left = this.parseUnary();
        while (['*', '/', '%'].includes(this.peek() || '')) {
            let op = this.consume();
            let right = this.parseUnary();
            if (op === '*')
                left = left * right;
            if (op === '/') {
                if (right === 0)
                    throw new Error("Деление на ноль!");
                left = Math.trunc(left / right);
            }
            if (op === '%')
                left = left % right;
        }
        return left;
    }
    /**
     * Обрабатывает унарные операции (отрицательное число, логическое НЕ).
     */
    parseUnary() {
        if (this.peek() === '-') {
            this.consume();
            return -this.parsePrimary();
        }
        if (this.peek() === 'NOT') {
            this.consume();
            return !this.parsePrimary();
        }
        return this.parsePrimary();
    }
    /**
     * Обрабатывает первичные выражения: числа, переменные, элементы массивов и скобки.
     */
    parsePrimary() {
        let tokenRaw = this.peekRaw();
        if (!tokenRaw)
            throw new Error("Неожиданный конец выражения");
        this.consume();
        if (tokenRaw === '(') {
            let expr = this.parseOr();
            if (this.consume() !== ')')
                throw new Error("Пропущена закрывающая скобка ')'");
            return expr;
        }
        if (/^\d+$/.test(tokenRaw)) {
            return parseInt(tokenRaw, 10);
        }
        if (/^[a-zA-Z_]\w*$/.test(tokenRaw)) {
            if (this.peekRaw() === '[') {
                this.consume();
                let index = this.parseOr();
                if (this.consume() !== ']')
                    throw new Error("Пропущена закрывающая скобка ']'");
                if (!this.env.arrays[tokenRaw])
                    throw new Error(`Массив ${tokenRaw} не объявлен`);
                if (index < 0 || index >= this.env.arrays[tokenRaw].length) {
                    throw new Error(`Индекс вне границ массива: ${tokenRaw}[${index}]`);
                }
                return this.env.arrays[tokenRaw][index];
            }
            if (this.env.vars[tokenRaw] === undefined) {
                throw new Error(`Переменная ${tokenRaw} не объявлена`);
            }
            return this.env.vars[tokenRaw];
        }
        throw new Error(`Недопустимый символ: ${tokenRaw}`);
    }
}
class Interpreter {
    /**
     * Создает асинхронную задержку на указанное количество миллисекунд.
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Выводит текстовое сообщение в окно терминала с указанным типом оформления.
     */
    static print(msg, type = 'normal') {
        if (!this.consoleEl)
            return;
        const line = document.createElement('div');
        line.className = `console-line ${type === 'normal' ? '' : type + '-msg'}`;
        line.textContent = `> ${msg}`;
        this.consoleEl.appendChild(line);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    }
    /**
     * Очищает содержимое окна терминала.
     */
    static clear() {
        if (this.consoleEl)
            this.consoleEl.innerHTML = '';
    }
    /**
     * Запускает выполнение программы, начиная с корневого блока рабочей области.
     */
    static async run(workspace) {
        this.clear();
        this.print("Запуск компиляции...", "system");
        workspace.clearErrors();
        const rootElements = workspace.element?.querySelectorAll(':scope > .workspace-item');
        if (!rootElements || rootElements.length === 0) {
            this.print("Ошибка: Рабочая область пуста.", "error");
            return;
        }
        const startBlocks = [];
        rootElements.forEach(el => {
            const block = el.blockInstance;
            if (block && block.data.name === 'Начало')
                startBlocks.push(block);
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
        }
        catch (error) {
            this.print(`КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, "error");
        }
    }
}
Interpreter.consoleEl = document.getElementById('console-output');
class Utils {
    /**
     * Находит первый DOM-элемент, соответствующий заданному селектору.
     */
    static $(s) { return document.querySelector(s); }
    /**
     * Находит все DOM-элементы, соответствующие заданному селектору.
     */
    static $$(s) { return document.querySelectorAll(s); }
    /**
     * Ограничивает числовое значение в заданном диапазоне.
     */
    static clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }
    /**
     * Определяет категорию блока на основе его родительского контейнера в меню.
     */
    static getCategory(el) {
        const entries = Object.entries(CONFIG.SELECTORS);
        for (const [cat, selector] of entries) {
            if (el.closest(selector))
                return cat;
        }
        return 'operator';
    }
    /**
     * Извлекает данные о блоке (имя, описание, категория, форма) из HTML-элемента.
     */
    static getItemData(el) {
        return {
            name: el.querySelector('.function-name')?.textContent?.trim() || 'Блок',
            description: el.querySelector('.function-desc')?.textContent?.trim() || '',
            category: this.getCategory(el),
            shape: el.dataset.shape || 'square'
        };
    }
}
class BaseBlock {
    /**
     * Инициализирует базовый блок с переданными данными и привязывает его к рабочей области.
     */
    constructor(data, workspace) {
        this.next = null;
        this.previous = null;
        this.data = data;
        this.workspace = workspace;
        this.element = this.render();
        this.attachEvents();
    }
    /**
     * Генерирует HTML-представление блока.
     */
    render() {
        const item = document.createElement('div');
        item.className = `workspace-item ${this.data.category}-item shape-${this.data.shape}`;
        item.dataset.category = this.data.category;
        item.blockInstance = this;
        item.innerHTML = `
            <div class="item-name">${this.data.name}</div>
            <div class="item-desc">${this.data.description}</div>
            ${this.getInnerTemplate()} 
            <button class="remove-item" title="Удалить">×</button>
        `;
        Object.assign(item.style, { position: 'absolute', zIndex: "10" });
        return item;
    }
    /**
     * Привязывает события удаления и начала перетаскивания к элементу блока.
     */
    attachEvents() {
        this.element.querySelector('.remove-item')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.destroy();
        });
        this.element.onmousedown = (e) => {
            if (e.target.tagName !== 'INPUT') {
                this.workspace.dragStart(e, this);
            }
        };
        this.element.ondragstart = (e) => {
            if (e.target.tagName !== 'INPUT')
                e.preventDefault();
        };
    }
    /**
     * Вставляет переданный блок после текущего в двусвязном списке.
     */
    insertAfter(block) {
        block.next = this.next;
        if (this.next)
            this.next.previous = block;
        this.next = block;
        block.previous = this;
    }
    /**
     * Исключает текущий блок из двусвязного списка, соединяя соседей.
     */
    removeFromList() {
        if (this.previous)
            this.previous.next = this.next;
        if (this.next)
            this.next.previous = this.previous;
        this.next = null;
        this.previous = null;
    }
    /**
     * Выполняет блок с визуальной подсветкой и рекурсивно передает управление следующему блоку.
     */
    async execute(env) {
        this.element.style.boxShadow = "0 0 10px 3px yellow";
        await Interpreter.sleep(300);
        try {
            await this.runAction(env);
            this.element.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
        }
        catch (error) {
            this.element.classList.add('error-highlight');
            this.element.style.boxShadow = "";
            throw error;
        }
        if (this.next) {
            await this.next.execute(env);
        }
    }
    /**
     * Запускает последовательность блоков, вложенных в указанный внутренний слот.
     */
    async runInnerSlot(env, slotSelector = '.block-slot') {
        const slot = this.element.querySelector(`:scope > ${slotSelector}`);
        const firstChildEl = slot?.querySelector(':scope > .workspace-item');
        if (firstChildEl) {
            const firstChildBlock = firstChildEl.blockInstance;
            await firstChildBlock.execute(env);
        }
    }
    /**
     * Уничтожает блок, удаляя его из DOM и синхронизируя список рабочей области.
     */
    destroy() {
        this.removeFromList();
        this.element.remove();
        this.workspace.syncLinkedLists();
        this.workspace.checkEmpty();
    }
}
class RootBlock extends BaseBlock {
    /**
     * Возвращает шаблон внутреннего слота для корневого блока.
     */
    getInnerTemplate() { return '<div class="block-slot" data-label="Тело программы"></div>'; }
    /**
     * Разрешает принятие элементов любой категории и формы.
     */
    canAccept(childCategory, childShape) { return true; }
    /**
     * Запрещает вложение корневого блока в другие слоты.
     */
    isMovableToSlot() { return false; }
    /**
     * Инициализирует выполнение вложенных блоков.
     */
    async runAction(env) {
        Interpreter.print(`[Старт] Инициализация...`);
        await this.runInnerSlot(env);
    }
    /**
     * Намеренно убираем вызов соседних блоков (this.next), чтобы код,
     * висящий снаружи (под блоком Начало), игнорировался и не запускался.
     */
    async execute(env) {
        this.element.style.boxShadow = "0 0 10px 3px yellow";
        await Interpreter.sleep(300);
        try {
            await this.runAction(env);
            this.element.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
        }
        catch (error) {
            this.element.classList.add('error-highlight');
            this.element.style.boxShadow = "";
            throw error;
        }
    }
}
class VarDeclBlock extends BaseBlock {
    /**
     * Возвращает шаблон ввода для объявления переменных.
     */
    getInnerTemplate() { return '<input class="block-input" placeholder="x, y, result" title="Через запятую" />'; }
    /**
     * Запрещает принятие дочерних элементов.
     */
    canAccept() { return false; }
    /**
     * Разрешает перемещение блока в слоты.
     */
    isMovableToSlot() { return true; }
    /**
     * Объявляет целочисленные переменные в текущем окружении.
     */
    async runAction(env) {
        const val = this.element.querySelector('input')?.value || '';
        const names = val.split(',').map(s => s.trim()).filter(s => s);
        if (names.length === 0)
            throw new Error("Не указаны имена переменных");
        for (let name of names) {
            if (!/^[a-zA-Z_]\w*$/.test(name))
                throw new Error(`Недопустимое имя переменной: ${name}`);
            env.vars[name] = 0;
        }
        Interpreter.print(`Объявлены переменные: ${names.join(', ')}`);
    }
}
class ArrayDeclBlock extends BaseBlock {
    /**
     * Возвращает шаблон ввода для объявления массива и его размера.
     */
    getInnerTemplate() {
        return `<div class="input-row">
                    <input class="block-input" placeholder="arr" style="width: 50%" title="Имя массива"/>[
                    <input class="block-input" placeholder="10" style="width: 40%" title="Размер"/> ]
                </div>`;
    }
    /**
     * Запрещает принятие дочерних элементов.
     */
    canAccept() { return false; }
    /**
     * Разрешает перемещение блока в слоты.
     */
    isMovableToSlot() { return true; }
    /**
     * Создает статический массив в текущем окружении на основе вычисленного размера.
     */
    async runAction(env) {
        const inputs = this.element.querySelectorAll('input');
        const name = inputs[0].value.trim();
        const sizeExpr = inputs[1].value.trim();
        if (!/^[a-zA-Z_]\w*$/.test(name))
            throw new Error(`Недопустимое имя массива: ${name}`);
        const size = env.evaluate(sizeExpr);
        if (size <= 0)
            throw new Error(`Размер массива должен быть > 0`);
        env.arrays[name] = new Array(size).fill(0);
        Interpreter.print(`Объявлен массив: ${name}[${size}]`);
    }
}
class AssignBlock extends BaseBlock {
    /**
     * Возвращает шаблон ввода для оператора присваивания.
     */
    getInnerTemplate() {
        return `<div class="input-row">
                    <input class="block-input assign-left" placeholder="x" style="width: 40%"/> =
                    <input class="block-input assign-right" placeholder="a + 5" style="width: 55%"/>
                </div>`;
    }
    /**
     * Запрещает принятие дочерних элементов.
     */
    canAccept() { return false; }
    /**
     * Разрешает перемещение блока в слоты.
     */
    isMovableToSlot() { return true; }
    /**
     * Вычисляет выражение правой части и сохраняет результат в переменную или элемент массива левой части.
     */
    async runAction(env) {
        const left = this.element.querySelector('.assign-left');
        const right = this.element.querySelector('.assign-right');
        const leftVal = left.value.trim();
        const rightVal = right.value.trim();
        if (!leftVal || !rightVal)
            throw new Error("Пустое поле присваивания");
        const result = env.evaluate(rightVal);
        const arrMatch = leftVal.match(/^([a-zA-Z_]\w*)\[(.+)\]$/);
        if (arrMatch) {
            const arrName = arrMatch[1];
            const index = env.evaluate(arrMatch[2]);
            if (!env.arrays[arrName])
                throw new Error(`Массив ${arrName} не существует`);
            if (index < 0 || index >= env.arrays[arrName].length)
                throw new Error(`Индекс ${index} вне границ ${arrName}`);
            env.arrays[arrName][index] = result;
            Interpreter.print(`${arrName}[${index}] = ${result}`);
        }
        else {
            if (env.vars[leftVal] === undefined)
                throw new Error(`Переменная ${leftVal} не объявлена`);
            env.vars[leftVal] = result;
            Interpreter.print(`${leftVal} = ${result}`);
        }
    }
}
class IfBlock extends BaseBlock {
    /**
     * Возвращает шаблон ввода условия и слот для выполнения логики.
     */
    getInnerTemplate() {
        return `Условие: <input class="block-input" placeholder="x > 5" />
                <div class="block-slot" data-label="Тогда"></div>`;
    }
    /**
     * Разрешает принятие дочерних элементов любой формы.
     */
    canAccept() { return true; }
    /**
     * Разрешает перемещение блока в слоты.
     */
    isMovableToSlot() { return true; }
    /**
     * Оценивает условие и выполняет вложенные блоки, если условие истинно.
     */
    async runAction(env) {
        const cond = this.element.querySelector('input')?.value.trim();
        if (!cond)
            throw new Error("Пустое условие в If");
        const isTrue = env.evaluate(cond);
        Interpreter.print(`[Если] Условие (${cond}) -> ${isTrue}`);
        if (isTrue) {
            await this.runInnerSlot(env);
        }
    }
}
class IfElseBlock extends BaseBlock {
    /**
     * Возвращает шаблон ввода условия и два слота: для истинного и ложного результата.
     */
    getInnerTemplate() {
        return `Условие: <input class="block-input" placeholder="x == y" />
                <div class="block-slot slot-true" data-label="Тогда"></div>
                <div class="block-slot slot-false" data-label="Иначе"></div>`;
    }
    /**
     * Разрешает принятие дочерних элементов любой формы.
     */
    canAccept() { return true; }
    /**
     * Разрешает перемещение блока в слоты.
     */
    isMovableToSlot() { return true; }
    /**
     * Оценивает условие и направляет выполнение в соответствующий внутренний слот.
     */
    async runAction(env) {
        const cond = this.element.querySelector('input')?.value.trim();
        if (!cond)
            throw new Error("Пустое условие в If-Else");
        const isTrue = env.evaluate(cond);
        Interpreter.print(`[Если-Иначе] Условие (${cond}) -> ${isTrue}`);
        if (isTrue) {
            await this.runInnerSlot(env, '.slot-true');
        }
        else {
            await this.runInnerSlot(env, '.slot-false');
        }
    }
}
class WhileBlock extends BaseBlock {
    /**
     * Возвращает шаблон ввода условия и слот для циклично выполняемых блоков.
     */
    getInnerTemplate() {
        return `Условие: <input class="block-input" placeholder="i < 10" />
                <div class="block-slot" data-label="Повторять"></div>`;
    }
    /**
     * Разрешает принятие дочерних элементов любой формы.
     */
    canAccept() { return true; }
    /**
     * Разрешает перемещение блока в слоты.
     */
    isMovableToSlot() { return true; }
    /**
     * Циклично выполняет внутренний слот, пока условие истинно (имеет лимит итераций).
     */
    async runAction(env) {
        const input = this.element.querySelector('input');
        let iterations = 0;
        const MAX_ITERATIONS = 1000;
        while (true) {
            const cond = input?.value.trim();
            if (!cond)
                throw new Error("Пустое условие в While");
            const isTrue = env.evaluate(cond);
            if (!isTrue) {
                Interpreter.print(`[Пока] Завершен`);
                break;
            }
            iterations++;
            if (iterations > MAX_ITERATIONS)
                throw new Error(`Защита от зависания: превышен лимит (${MAX_ITERATIONS})`);
            Interpreter.print(`[Пока] Итерация ${iterations}`);
            await this.runInnerSlot(env);
        }
    }
}
class PrintBlock extends BaseBlock {
    getInnerTemplate() {
        return `<input class="block-input" placeholder="x, y, z," />`;
    }
    /**
     * Запрещает принятие дочерних элементов любой формы.
     */
    canAccept() { return false; }
    /**
    * Разрешает перемещение блока в слоты.
    */
    isMovableToSlot() { return true; }
    /**
    * Вычисляет и выводит в терминал значения, указанные в поле ввода, разделенные запятыми.
    */
    async runAction(env) {
        const input = this.element.querySelector('input');
        const text = input?.value?.trim();
        if (!text) {
            throw new Error("Поле вывода пустое");
        }
        // Разбиваем по запятым, но только те, что НЕ внутри кавычек
        const parts = text.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim());
        const values = parts.map(part => {
            if (!part)
                return "";
            // Если строка в кавычках — сразу берём содержимое
            if ((part.startsWith('"') && part.endsWith('"')) ||
                (part.startsWith("'") && part.endsWith("'"))) {
                return part.slice(1, -1);
            }
            // Иначе пытаемся вычислить как выражение
            try {
                return env.evaluate(part);
            }
            catch {
                // Если не получилось — выводим как обычный текст
                return part;
            }
        });
        const output = values.map(v => String(v)).join(" ");
        Interpreter.print(output);
    }
}
class Workspace {
    constructor() {
        this.element = Utils.$('#workspace');
        this.activeBlock = null;
        this.offset = { x: 0, y: 0 };
        this.onMove = (e) => this.dragging(e);
        this.onUp = () => this.dragEnd();
    }
    /**
     * Инициализирует рабочую область: настраивает drag-and-drop и обработчик изменения размера окна.
     */
    init() {
        if (!this.element)
            return;
        this.setupDrop();
        this.checkEmpty();
        window.addEventListener('resize', () => this.updatePositions());
    }
    /**
     * Удаляет классы визуального выделения ошибок со всех блоков в рабочей области.
     */
    clearErrors() {
        Utils.$$('.error-highlight').forEach(el => el.classList.remove('error-highlight'));
    }
    /**
     * Создает экземпляр соответствующего класса блока на основе переданных данных.
     */
    createBlock(data) {
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
    /**
     * Начинает процесс перетаскивания блока, вычисляет его начальное смещение и исправляет ширину при вытаскивании из слота.
     */
    dragStart(e, block) {
        if (e.target.closest('.remove-item') || e.target.tagName === 'INPUT')
            return;
        e.preventDefault();
        e.stopPropagation();
        const item = block.element;
        let rect = item.getBoundingClientRect();
        // Если вытаскиваем блок из слота
        if (item.parentElement?.classList.contains('block-slot')) {
            const wsRect = this.element.getBoundingClientRect();
            this.element.appendChild(item);
            item.style.position = 'absolute';
            item.style.width = '';
            item.style.left = `${rect.left - wsRect.left + this.element.scrollLeft}px`;
            item.style.top = `${rect.top - wsRect.top + this.element.scrollTop}px`;
            rect = item.getBoundingClientRect();
        }
        this.activeBlock = block;
        let offsetX = e.clientX - rect.left;
        if (offsetX > rect.width)
            offsetX = rect.width / 2;
        this.offset = { x: offsetX, y: e.clientY - rect.top };
        item.classList.add('dragging');
        item.style.zIndex = "1000";
        document.addEventListener('mousemove', this.onMove);
        document.addEventListener('mouseup', this.onUp, { once: true });
    }
    /**
     * Обновляет позицию перемещаемого блока относительно курсора и подсвечивает слоты для вставки.
     */
    dragging(e) {
        if (!this.activeBlock || !this.element)
            return;
        const wsRect = this.element.getBoundingClientRect();
        let x = e.clientX - this.offset.x - wsRect.left + this.element.scrollLeft;
        let y = e.clientY - this.offset.y - wsRect.top + this.element.scrollTop;
        x = Math.max(0, x);
        y = Math.max(0, y);
        this.activeBlock.element.style.left = `${x}px`;
        this.activeBlock.element.style.top = `${y}px`;
        this.clearHighlights();
        const targetSlot = this.findValidSlot(e.clientX, e.clientY);
        if (targetSlot)
            targetSlot.classList.add('drag-over');
    }
    /**
     * Завершает перетаскивание блока, закрепляя его в слоте или на рабочей области, обновляя связи списка.
     */
    dragEnd() {
        if (!this.activeBlock)
            return;
        document.removeEventListener('mousemove', this.onMove);
        const rect = this.activeBlock.element.getBoundingClientRect();
        const slot = this.findValidSlot(rect.left + rect.width / 2, rect.top + 10);
        if (slot) {
            const afterEl = this.getInsertAfter(slot, rect.top + 10);
            if (afterEl)
                slot.insertBefore(this.activeBlock.element, afterEl);
            else
                slot.appendChild(this.activeBlock.element);
            Object.assign(this.activeBlock.element.style, { position: 'relative', left: '0', top: '0', width: '100%' });
        }
        else {
            this.activeBlock.element.style.width = ''; // Гарантируем сброс ширины, если бросили не в слот
        }
        this.activeBlock.element.style.zIndex = "10";
        this.activeBlock.element.classList.remove('dragging');
        this.activeBlock = null;
        this.clearHighlights();
        this.updateDataPercents();
        this.syncLinkedLists();
    }
    /**
     * Синхронизирует связи next/previous у всех блоков на основе их порядка в DOM-дереве.
     */
    syncLinkedLists() {
        const containers = [this.element, ...Array.from(document.querySelectorAll('.block-slot'))];
        containers.forEach(container => {
            if (!container)
                return;
            const childBlocks = Array.from(container.querySelectorAll(':scope > .workspace-item:not(.dragging)'))
                .map(el => el.blockInstance)
                .filter(b => b);
            for (let i = 0; i < childBlocks.length; i++) {
                const block = childBlocks[i];
                block.previous = null;
                block.next = null;
                if (i > 0)
                    childBlocks[i - 1].insertAfter(block);
            }
        });
    }
    /**
     * Ищет допустимый для вставки слот под курсором.
     */
    findValidSlot(x, y) {
        if (!this.activeBlock || !this.activeBlock.isMovableToSlot())
            return null;
        const targets = document.elementsFromPoint(x, y);
        for (const el of targets) {
            const htmlEl = el;
            if (htmlEl.classList.contains('block-slot')) {
                const parentInstance = htmlEl.closest('.workspace-item')?.blockInstance;
                if (parentInstance && parentInstance.canAccept(this.activeBlock.data.category, this.activeBlock.data.shape)) {
                    if (this.activeBlock.element.contains(htmlEl))
                        continue;
                    return htmlEl;
                }
            }
        }
        return null;
    }
    /**
     * Настраивает прием блоков из меню в рабочую область через Drag and Drop API.
     */
    setupDrop() {
        if (!this.element)
            return;
        this.element.ondragover = (e) => e.preventDefault();
        this.element.ondrop = (e) => {
            e.preventDefault();
            const json = e.dataTransfer?.getData('text/plain');
            if (!json)
                return;
            const block = this.createBlock(JSON.parse(json));
            this.element.appendChild(block.element);
            const wsRect = this.element.getBoundingClientRect();
            let x = e.clientX - wsRect.left - (block.element.offsetWidth / 2) + this.element.scrollLeft;
            let y = e.clientY - wsRect.top - (block.element.offsetHeight / 2) + this.element.scrollTop;
            block.element.style.left = `${Math.max(0, x)}px`;
            block.element.style.top = `${Math.max(0, y)}px`;
            this.updateDataPercents();
            this.syncLinkedLists();
            Utils.$('.workspace-placeholder')?.remove();
        };
    }
    /**
     * Определяет элемент внутри слота, после которого нужно вставить текущий блок.
     */
    getInsertAfter(slot, y) {
        const elements = [...slot.querySelectorAll(':scope > .workspace-item:not(.dragging)')];
        return elements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - (box.top + box.height / 2);
            return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    }
    /**
     * Сбрасывает визуальную подсветку у всех слотов.
     */
    clearHighlights() { Utils.$$('.block-slot').forEach(s => s.classList.remove('drag-over')); }
    /**
     * Обновляет процентные координаты блоков для адаптивности при изменении размера окна.
     */
    updateDataPercents() {
        if (!this.element)
            return;
        const rect = this.element.getBoundingClientRect();
        Utils.$$('.workspace-item').forEach(item => {
            if (item.parentElement === this.element) {
                item.dataset.leftPercent = ((parseFloat(item.style.left) / rect.width) * 100).toString();
                item.dataset.topPercent = ((parseFloat(item.style.top) / rect.height) * 100).toString();
            }
        });
    }
    /**
     * Проверяет наличие блоков в рабочей области и показывает плейсхолдер, если она пуста.
     */
    checkEmpty() {
        if (Utils.$$('.workspace-item').length === 0 && !Utils.$('.workspace-placeholder')) {
            this.element?.insertAdjacentHTML('afterbegin', '<div class="workspace-placeholder">Перетащите сюда элементы из меню</div>');
        }
    }
    /**
     * Очищает рабочую область и терминал от всех элементов.
     */
    clear() {
        Utils.$$('.workspace-item').forEach(el => el.remove());
        this.syncLinkedLists();
        this.checkEmpty();
        Interpreter.clear();
    }
    /**
     * Пересчитывает физические координаты блоков при изменении размера экрана.
     */
    updatePositions() {
        if (!this.element)
            return;
        const rect = this.element.getBoundingClientRect();
        Utils.$$('.workspace-item').forEach(item => {
            if (item.parentElement !== this.element)
                return;
            const lp = parseFloat(item.dataset.leftPercent || '0');
            const tp = parseFloat(item.dataset.topPercent || '0');
            item.style.left = `${(lp / 100) * rect.width}px`;
            item.style.top = `${(tp / 100) * rect.height}px`;
        });
    }
}
class SlidingMenu {
    constructor() {
        this.panel = Utils.$('.sliding');
        this.buttons = {
            starts: Utils.$('#button-tag-starts'),
            variables: Utils.$('#button-tag-variables'),
            string: Utils.$('#button-tag-string'),
            operators: Utils.$('#button-tag-operators')
        };
        this.cats = {
            starts: Utils.$('#category-starts'),
            variables: Utils.$('#category-variables'),
            string: Utils.$('#category-string'),
            operators: Utils.$('#category-operators')
        };
        this.activeBtn = null;
    }
    /**
     * Инициализирует логику переключения меню и настройки перетаскивания элементов меню.
     */
    init() {
        this.setupDraggable();
        Object.entries(this.buttons).forEach(([key, btn]) => {
            btn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(btn, this.cats[key]);
            });
        });
        this.observeChanges();
    }
    /**
     * Настраивает возможность перетаскивания (Drag API) для блоков внутри меню.
     */
    setupDraggable() {
        Utils.$$('.function-item').forEach(item => {
            item.draggable = true;
            item.ondragstart = (e) => e.dataTransfer?.setData('text/plain', JSON.stringify(Utils.getItemData(item)));
        });
    }
    /**
     * Переключает видимость секций меню при клике по кнопкам категорий.
     */
    toggle(btn, cat) {
        if (this.activeBtn === btn)
            this.hide();
        else {
            this.hide();
            if (cat) {
                cat.classList.add('active');
                this.panel?.classList.add('active');
                this.activeBtn = btn;
            }
        }
    }
    /**
     * Скрывает выпадающее меню со всеми категориями.
     */
    hide() {
        this.panel?.classList.remove('active');
        Object.values(this.cats).forEach(c => c?.classList.remove('active'));
        this.activeBtn = null;
    }
    /**
     * Следит за добавлением новых блоков в меню для автоматической настройки их перетаскивания.
     */
    observeChanges() {
        if (!this.panel)
            return;
        new MutationObserver(() => this.setupDraggable()).observe(this.panel, { childList: true, subtree: true });
    }
}
class App {
    /**
     * Запускает приложение после полной загрузки дерева DOM.
     */
    constructor() {
        this.workspace = new Workspace();
        this.menu = new SlidingMenu();
        document.addEventListener('DOMContentLoaded', () => this.start());
    }
    /**
     * Инициализирует рабочую область, меню и глобальные слушатели событий.
     */
    start() {
        this.workspace.init();
        this.menu.init();
        Utils.$('#clear-workspace')?.addEventListener('click', () => this.workspace.clear());
        Utils.$('#start-workspace')?.addEventListener('click', () => Interpreter.run(this.workspace));
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.button-tag, .sliding'))
                this.menu.hide();
        });
    }
}
new App();
//# sourceMappingURL=index.js.map