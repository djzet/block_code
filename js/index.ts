/**
 * ТИПЫ И ИНТЕРФЕЙСЫ
 */

/** Допустимые категории блоков для группировки и стилизации */
type Category = 'starts' | 'operator' | 'variable' | 'event';

/** Данные, необходимые для инициализации нового блока */
interface ItemData {
    name: string;        // Отображаемое имя блока
    description: string; // Краткое описание функционала
    category: Category;  // Категория (влияет на цвет и правила вложенности)
}

/**
 * ГЛОБАЛЬНЫЕ НАСТРОЙКИ
 */
const CONFIG = {
    /** Соответствие категорий ID-селекторам в HTML-меню */
    SELECTORS: {
        starts: '#category-starts',
        operator: '#category-operators',
        variable: '#category-variables',
        event: '#category-events'
    } as Record<Category, string>,
    /** Начальное положение нового блока при создании */
    DEFAULT_POS: { left: 60, top: 60 },
};

/**
 * ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
 */
class Utils {
    /** 
     * Находит один HTML-элемент по CSS-селектору 
     * @param s CSS-селектор
     */
    static $<T extends HTMLElement>(s: string): T | null { return document.querySelector(s); }

    /** 
     * Находит все HTML-элементы по CSS-селектору 
     * @param s CSS-селектор
     */
    static $$<T extends HTMLElement>(s: string): NodeListOf<T> { return document.querySelectorAll(s); }

    /** 
     * Ограничивает число в пределах заданного диапазона 
     * @param v Значение
     * @param min Минимум
     * @param max Максимум
     */
    static clamp(v: number, min: number, max: number): number {
        return Math.max(min, Math.min(v, max));
    }

    /** 
     * Определяет категорию блока, находя его родительскую секцию в меню 
     * @param el Элемент из меню
     */
    static getCategory(el: HTMLElement): Category {
        const entries = Object.entries(CONFIG.SELECTORS) as [Category, string][];
        for (const [cat, selector] of entries) {
            if (el.closest(selector)) return cat;
        }
        return 'operator';
    }

    /** 
     * Извлекает данные (имя, описание) из HTML-шаблона элемента в меню 
     * @param el Элемент из меню
     */
    static getItemData(el: HTMLElement): ItemData {
        return {
            name: el.querySelector('.function-name')?.textContent?.trim() || 'Блок',
            description: el.querySelector('.function-desc')?.textContent?.trim() || '',
            category: this.getCategory(el)
        };
    }
}

/**
 * КЛАССЫ БЛОКОВ
 */

/**
 * Абстрактный класс, описывающий общее поведение всех блоков в системе.
 */
abstract class BaseBlock {
    public element: HTMLDivElement; // Ссылка на DOM-элемент блока в рабочей области
    protected workspace: Workspace; // Ссылка на управляющий класс Workspace
    public data: ItemData;          // Данные блока (название, категория и т.д.)

    /**
     * Создает экземпляр блока и отрисовывает его
     * @param data Параметры блока
     * @param workspace Ссылка на рабочую область
     */
    constructor(data: ItemData, workspace: Workspace) {
        this.data = data;
        this.workspace = workspace;
        this.element = this.render();
        this.attachEvents();
    }

    /** 
     * Генерирует HTML-код блока и устанавливает начальные стили 
     */
    protected render(): HTMLDivElement {
        const item = document.createElement('div');
        item.className = `workspace-item ${this.data.category}-item`;
        item.dataset.category = this.data.category;

        // Магия: привязываем объект класса прямо к DOM-элементу для легкого доступа
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

    /** Возвращает HTML-код внутренней части (наличие или отсутствие слота) */
    protected abstract getInnerTemplate(): string;

    /** 
     * Проверяет, может ли текущий блок принять в себя другой блок 
     * @param childCategory Категория вставляемого блока
     */
    public abstract canAccept(childCategory: Category): boolean;

    /** 
     * Указывает, разрешено ли этот блок вставлять внутрь других блоков 
     */
    public abstract isMovableToSlot(): boolean;

    /** 
     * Назначает события удаления и начала перетаскивания (MouseDown) 
     */
    private attachEvents(): void {
        this.element.querySelector('.remove-item')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.destroy();
        });
        // Передаем управление перетаскиванием классу Workspace
        this.element.onmousedown = (e) => this.workspace.dragStart(e, this);
        this.element.ondragstart = (e) => e.preventDefault(); // Отключаем стандартный Drag браузера
    }

    /** Удаляет блок из DOM и проверяет пустоту рабочей области */
    public destroy(): void {
        this.element.remove();
        this.workspace.checkEmpty();
    }
}

/**
 * КОРНЕВОЙ БЛОК
 * Пример: блок "Начало". Имеет слот, но сам не может быть никуда вставлен.
 */
class RootBlock extends BaseBlock {
    /** Создает видимый слот для вложенности */
    protected getInnerTemplate(): string {
        return '<div class="block-slot"></div>';
    }

    /** Позволяет вставлять в себя любые блоки */
    public canAccept(childCategory: Category): boolean {
        return true;
    }

    /** ЗАПРЕЩАЕТ вставлять себя в другие блоки */
    public isMovableToSlot(): boolean {
        return false;
    }
}

/**
 * БЛОК-КОНТЕЙНЕР
 * Пример: блок "Цикл". Имеет слот и сам может быть вложен в другой контейнер.
 */
class ContainerBlock extends BaseBlock {
    /** Создает видимый слот для вложенности */
    protected getInnerTemplate(): string {
        return '<div class="block-slot"></div>';
    }

    /** Разрешает вложенность любых категорий */
    public canAccept(childCategory: Category): boolean {
        return true;
    }

    /** РАЗРЕШАЕТ вставлять себя в другие блоки */
    public isMovableToSlot(): boolean {
        return true;
    }
}

/**
 * ПРОСТОЙ БЛОК
 * Пример: "Переменная". Не имеет слота, но может быть вложен в контейнер.
 */
class SimpleBlock extends BaseBlock {
    /** У простого блока нет внутреннего слота */
    protected getInnerTemplate(): string { return ''; }

    /** Всегда возвращает false, так как в него нельзя ничего вставить */
    public canAccept(childCategory: Category): boolean {
        return false;
    }

    /** РАЗРЕШАЕТ вставлять себя в другие блоки */
    public isMovableToSlot(): boolean {
        return true;
    }
}

/**
 * КЛАСС РАБОЧАЯ ОБЛАСТЬ
 * Сердце системы: управляет логикой перетаскивания и физического расположения блоков.
 */
class Workspace {
    /** Основной HTML-контейнер области */
    public element = Utils.$<HTMLDivElement>('#workspace');
    /** Блок, который перемещается в данный момент */
    private activeBlock: BaseBlock | null = null;
    /** Разница координат между курсором и верхним левым углом блока */
    private offset = { x: 0, y: 0 };

    /** Инициализирует рабочую область */
    public init(): void {
        if (!this.element) return;
        this.setupDrop();
        this.checkEmpty();
        // Адаптация координат при изменении размера окна
        window.addEventListener('resize', () => this.updatePositions());
    }

    /** 
     * Фабричный метод: создает правильный объект класса на основе данных блока 
     * @param data Информация о блоке
     */
    public createBlock(data: ItemData): BaseBlock {
        // Логика определения типа блока по его имени или категории
        if (data.name === 'Начало') {
            return new RootBlock(data, this);
        }

        if (data.category === 'starts' || data.category === 'operator') {
            return new ContainerBlock(data, this);
        }

        return new SimpleBlock(data, this);
    }

    /** 
     * Вызывается при нажатии на блок для начала перемещения 
     * @param e MouseEvent
     * @param block Экземпляр блока
     */
    public dragStart(e: MouseEvent, block: BaseBlock): void {
        if ((e.target as HTMLElement).closest('.remove-item')) return;
        e.preventDefault();
        e.stopPropagation();

        const item = block.element;
        const rect = item.getBoundingClientRect();

        // Если блок вытаскивают из слота (родителя)
        if (item.parentElement?.classList.contains('block-slot')) {
            const wsRect = this.element!.getBoundingClientRect();
            this.element!.appendChild(item); // Возвращаем блок в корень рабочей области
            item.style.position = 'absolute';
            // Корректируем координаты, чтобы блок не прыгал при смене родителя
            item.style.left = `${rect.left - wsRect.left}px`;
            item.style.top = `${rect.top - wsRect.top}px`;
        }

        this.activeBlock = block;
        this.offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        item.classList.add('dragging');
        item.style.zIndex = "1000";

        // Слушатели на весь документ для плавного движения
        const onMove = (ev: MouseEvent) => this.dragging(ev);
        const onUp = () => this.dragEnd();

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp, { once: true });
    }

    /** 
     * Рассчитывает новые координаты блока при движении мыши 
     * @param e MouseEvent
     */
    private dragging(e: MouseEvent): void {
        if (!this.activeBlock || !this.element) return;

        const wsRect = this.element.getBoundingClientRect();
        let x = e.clientX - this.offset.x - wsRect.left;
        let y = e.clientY - this.offset.y - wsRect.top;

        // Не даем блоку выйти за пределы рабочей области
        x = Utils.clamp(x, 0, wsRect.width - this.activeBlock.element.offsetWidth);
        y = Utils.clamp(y, 0, wsRect.height - this.activeBlock.element.offsetHeight);

        this.activeBlock.element.style.left = `${x}px`;
        this.activeBlock.element.style.top = `${y}px`;

        this.clearHighlights();

        // Подсвечиваем слот, если блок находится над ним
        const targetSlot = this.findValidSlot(e.clientX, e.clientY);
        if (targetSlot) targetSlot.classList.add('drag-over');
    }

    /** 
     * Завершает перетаскивание и решает, вставить ли блок в слот или оставить на поле 
     */
    private dragEnd(): void {
        if (!this.activeBlock) return;

        const rect = this.activeBlock.element.getBoundingClientRect();
        // Точка проверки (центр верха блока)
        const slot = this.findValidSlot(rect.left + rect.width / 2, rect.top + 10);

        if (slot) {
            // Ищем место внутри слота (между какими блоками вставить)
            const afterEl = this.getInsertAfter(slot, rect.top + 10);
            if (afterEl) {
                slot.insertBefore(this.activeBlock.element, afterEl);
            } else {
                slot.appendChild(this.activeBlock.element);
            }
            // Меняем позиционирование на относительное для потока внутри слота
            Object.assign(this.activeBlock.element.style, { position: 'relative', left: '0', top: '0' });
        }

        this.activeBlock.element.style.zIndex = "10";
        this.activeBlock.element.classList.remove('dragging');
        this.activeBlock = null;
        this.clearHighlights();
        this.updateDataPercents(); // Сохраняем % координаты для адаптивности
    }

    /** 
     * Ищет подходящий слот в указанных координатах экрана 
     * @param x Координата X
     * @param y Координата Y
     */
    private findValidSlot(x: number, y: number): HTMLElement | null {
        if (!this.activeBlock) return null;

        // Если блок сам по себе "корневой" (Root), он не может попасть в слот
        if (!this.activeBlock.isMovableToSlot()) {
            return null;
        }

        const targets = document.elementsFromPoint(x, y);
        for (const el of targets) {
            const htmlEl = el as HTMLElement;

            if (htmlEl.classList.contains('block-slot')) {
                // Получаем инстанс блока-владельца слота
                const parentItem = htmlEl.closest('.workspace-item') as any;
                const parentInstance = parentItem?.blockInstance as BaseBlock;

                // Проверяем правила фильтрации: принимает ли контейнер эту категорию?
                if (parentInstance && parentInstance.canAccept(this.activeBlock.data.category)) {
                    // Защита от вставки блока внутрь самого себя
                    if (this.activeBlock.element.contains(htmlEl)) continue;
                    return htmlEl;
                }
            }
        }
        return null;
    }

    /** 
     * Настраивает прием блоков, перетаскиваемых из внешнего HTML-меню 
     */
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
            // Позиционируем новый блок по центру курсора
            let x = Utils.clamp(e.clientX - wsRect.left - (block.element.offsetWidth / 2), 0, wsRect.width - block.element.offsetWidth);
            let y = Utils.clamp(e.clientY - wsRect.top - (block.element.offsetHeight / 2), 0, wsRect.height - block.element.offsetHeight);

            block.element.style.left = `${x}px`;
            block.element.style.top = `${y}px`;

            this.updateDataPercents();
            Utils.$('.workspace-placeholder')?.remove();
        };
    }

    /** 
     * Определяет, перед каким элементом в слоте нужно сделать вставку 
     * @param slot Элемент слота
     * @param y Текущая координата Y курсора
     */
    private getInsertAfter(slot: HTMLElement, y: number): HTMLElement | null {
        const elements = [...slot.querySelectorAll(':scope > .workspace-item:not(.dragging)')] as HTMLElement[];
        return elements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - (box.top + box.height / 2);
            return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }).element;
    }

    /** Убирает подсветку со всех потенциальных мест вставки */
    private clearHighlights(): void {
        Utils.$$('.block-slot').forEach(s => s.classList.remove('drag-over'));
    }

    /** 
     * Сохраняет координаты блоков в процентах относительно рабочей области 
     */
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

    /** 
     * Проверяет наличие блоков и рисует подсказку, если область пуста 
     */
    public checkEmpty(): void {
        if (Utils.$$('.workspace-item').length === 0 && !Utils.$('.workspace-placeholder')) {
            this.element?.insertAdjacentHTML('afterbegin', '<div class="workspace-placeholder">Перетащите сюда элементы из меню</div>');
        }
    }

    /** Удаляет все блоки из рабочей области */
    public clear(): void {
        Utils.$$('.workspace-item').forEach(el => el.remove());
        this.checkEmpty();
    }

    /** 
     * Пересчитывает физические координаты блоков при изменении размера экрана 
     */
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

/**
 * КЛАСС МЕНЮ
 * Отвечает за интерфейс выбора блоков (аккордеон/выпадающее меню).
 */
class SlidingMenu {
    private panel = Utils.$<HTMLDivElement>('.sliding'); // Контейнер меню
    /** Навигационные кнопки категорий */
    private buttons: Record<string, HTMLElement | null> = {
        starts: Utils.$('#button-tag-starts'),
        operators: Utils.$('#button-tag-operators'),
        variables: Utils.$('#button-tag-variables'),
        events: Utils.$('#button-tag-events')
    };
    /** Контейнеры самих списков блоков */
    private cats: Record<string, HTMLElement | null> = {
        starts: Utils.$('#category-starts'),
        operators: Utils.$('#category-operators'),
        variables: Utils.$('#category-variables'),
        events: Utils.$('#category-events')
    };
    /** Текущая активная кнопка в меню */
    private activeBtn: HTMLElement | null = null;

    /** Инициализирует функционал меню */
    public init(): void {
        this.setupDraggable();
        Object.entries(this.buttons).forEach(([key, btn]) => {
            btn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(btn, this.cats[key]);
            });
        });
        this.observeChanges(); // Поддержка динамического добавления элементов
    }

    /** Делает элементы в меню доступными для перетаскивания (HTML5 Drag) */
    private setupDraggable(): void {
        Utils.$$<HTMLDivElement>('.function-item').forEach(item => {
            item.draggable = true;
            item.ondragstart = (e) => {
                // Сериализуем данные блока в строку при начале перетаскивания
                e.dataTransfer?.setData('text/plain', JSON.stringify(Utils.getItemData(item)));
            };
        });
    }

    /** 
     * Переключает видимость секций меню при клике 
     * @param btn Нажатая кнопка
     * @param cat Секция для отображения
     */
    private toggle(btn: HTMLElement, cat: HTMLElement | null): void {
        if (this.activeBtn === btn) {
            this.hide();
        } else {
            this.hide();
            if (cat) {
                cat.classList.add('active');
                this.panel?.classList.add('active');
                this.activeBtn = btn;
            }
        }
    }

    /** Скрывает все открытые панели меню */
    public hide(): void {
        this.panel?.classList.remove('active');
        Object.values(this.cats).forEach(c => c?.classList.remove('active'));
        this.activeBtn = null;
    }

    /** 
     * Следит за изменением DOM в меню, чтобы автоматически делать новые блоки перетаскиваемыми 
     */
    private observeChanges(): void {
        if (!this.panel) return;
        new MutationObserver(() => this.setupDraggable()).observe(this.panel, { childList: true, subtree: true });
    }
}

/**
 * ГЛАВНЫЙ КЛАСС APP (ENTRY POINT)
 */
class App {
    private workspace = new Workspace();
    private menu = new SlidingMenu();

    constructor() {
        document.addEventListener('DOMContentLoaded', () => this.start());
    }

    /** 
     * Точка старта приложения после загрузки страницы 
     */
    private start(): void {
        this.workspace.init();
        this.menu.init();

        // Событие для кнопки "Очистить всё"
        Utils.$('#clear-workspace')?.addEventListener('click', () => this.workspace.clear());

        // Закрытие меню при клике по любому другому месту экрана
        document.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).closest('.button-tag, .sliding')) this.menu.hide();
        });
    }
}

// Запуск всего приложения
new App();