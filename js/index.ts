// Типы и интерфейсы

type Category = 'starts' | 'operator' | 'variable' | 'event';

interface ItemData {
    name: string;
    description: string;
    category: Category;
}

// Константы и утилиты

const CONFIG = {
    CATEGORY_SELECTORS: {
        starts: '#category-starts',
        operator: '#category-operators',
        variable: '#category-variables',
        event: '#category-events'
    } as Record<Category, string>,
    DEFAULT_POSITION: { left: 60, top: 60 },
    ANIMATION_DURATION: 420
};

class Utils {
    static $ <T extends HTMLElement>(selector: string): T | null {
        return document.querySelector(selector);
    }

    static $$ <T extends HTMLElement>(selector: string): NodeListOf<T> {
        return document.querySelectorAll(selector);
    }

    static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(value, max));
    }

    static getCategoryFromElement(el: HTMLElement): Category {
        if (el.closest(CONFIG.CATEGORY_SELECTORS.starts)) return 'starts';
        if (el.closest(CONFIG.CATEGORY_SELECTORS.variable)) return 'variable';
        if (el.closest(CONFIG.CATEGORY_SELECTORS.event)) return 'event';
        return 'operator';
    }

    static getItemData(el: HTMLElement): ItemData {
        return {
            name: el.querySelector('.function-name')?.textContent?.trim() || 'Элемент',
            description: el.querySelector('.function-desc')?.textContent?.trim() || '',
            category: this.getCategoryFromElement(el)
        };
    }
}

// Рабочая область

class Workspace {
    public readonly element: HTMLDivElement | null;
    private activeItem: HTMLDivElement | null = null;
    private offsetX: number = 0;
    private offsetY: number = 0;

    constructor(selector: string) {
        this.element = Utils.$<HTMLDivElement>(selector);
    }

    public init(): void {
        if (!this.element) return;
        this.element.style.position = 'relative';
        this.element.style.overflow = 'hidden';
        this.setupDrop();
        this.checkEmpty();
        window.addEventListener('resize', () => this.updatePositionsOnResize());
    }

    private setupDrop(): void {
        if (!this.element) return;

        this.element.ondragover = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            this.element?.classList.add('drag-over');
        };

        this.element.ondragleave = (e: DragEvent) => {
            if (!this.element?.contains(e.relatedTarget as Node)) {
                this.element?.classList.remove('drag-over');
            }
        };

        this.element.ondrop = (e: DragEvent) => {
            e.preventDefault();
            this.element?.classList.remove('drag-over');
            this.handleDrop(e);
        };
    }

    private handleDrop(e: DragEvent): void {
        try {
            const jsonStr = e.dataTransfer?.getData('text/plain');
            if (!jsonStr || !this.element) return;

            const data: ItemData = JSON.parse(jsonStr);
            const item = this.createItem(data);
            
            this.element.appendChild(item);

            const rect = this.element.getBoundingClientRect();
            let x = e.clientX - rect.left - (item.offsetWidth / 2);
            let y = e.clientY - rect.top - (item.offsetHeight / 2);

            this.updateItemPosition(item, x, y, rect.width, rect.height);
            this.removePlaceholder();
            this.checkEmpty();
        } catch (err) {
            console.warn('Ошибка при drop:', err);
        }
    }

    public createItem(data: ItemData): HTMLDivElement {
        const item = document.createElement('div');
        item.className = `workspace-item ${data.category}-item`;
        item.id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        item.innerHTML = `
            <div class="item-name">${data.name}</div>
            <div class="item-desc">${data.description}</div>
            <button class="remove-item" title="Удалить">×</button>
        `;

        Object.assign(item.style, {
            position: 'absolute',
            left: `${CONFIG.DEFAULT_POSITION.left}px`,
            top: `${CONFIG.DEFAULT_POSITION.top}px`,
            cursor: 'grab',
            userSelect: 'none'
        });

        this.attachItemEvents(item);
        return item;
    }

    private attachItemEvents(item: HTMLDivElement): void {
        const removeBtn = item.querySelector('.remove-item') as HTMLButtonElement | null;
        removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            item.remove();
            this.checkEmpty();
        });

        item.onmousedown = (e) => this.handleDragStart(e, item);
        item.ondragstart = (e) => e.preventDefault();
    }

    private handleDragStart(e: MouseEvent, item: HTMLDivElement): void {
        if ((e.target as HTMLElement).closest('.remove-item')) return;
        e.preventDefault();

        const rect = item.getBoundingClientRect();
        this.activeItem = item;
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;

        item.style.cursor = 'grabbing';
        item.classList.add('dragging');

        const onMouseMove = (ev: MouseEvent) => this.handleDragging(ev);
        const onMouseUp = () => {
            item.style.cursor = 'grab';
            item.classList.remove('dragging');
            this.activeItem = null;
            document.removeEventListener('mousemove', onMouseMove);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp, { once: true });
    }

    private handleDragging(e: MouseEvent): void {
        if (!this.activeItem || !this.element) return;

        const wsRect = this.element.getBoundingClientRect();
        const x = e.clientX - this.offsetX - wsRect.left;
        const y = e.clientY - this.offsetY - wsRect.top;

        this.updateItemPosition(this.activeItem, x, y, wsRect.width, wsRect.height);
    }

    private updateItemPosition(item: HTMLDivElement, x: number, y: number, wsWidth: number, wsHeight: number): void {
        const safeX = Utils.clamp(x, 0, wsWidth - item.offsetWidth);
        const safeY = Utils.clamp(y, 0, wsHeight - item.offsetHeight);

        item.style.left = `${safeX}px`;
        item.style.top = `${safeY}px`;
        item.dataset.leftPercent = ((safeX / wsWidth) * 100).toString();
        item.dataset.topPercent = ((safeY / wsHeight) * 100).toString();
    }

    public checkEmpty(): void {
        if (!this.element) return;
        if (Utils.$$('.workspace-item').length === 0 && !Utils.$('.workspace-placeholder')) {
            const ph = document.createElement('div');
            ph.className = 'workspace-placeholder';
            ph.textContent = 'Перетащите сюда блоки из меню';
            this.element.appendChild(ph);
        }
    }

    private removePlaceholder(): void {
        Utils.$$('.workspace-placeholder').forEach(el => el.remove());
    }

    public clear(): void {
        Utils.$$('.workspace-item').forEach(el => el.remove());
        this.checkEmpty();
    }

    private updatePositionsOnResize(): void {
        if (!this.element) return;
        const wsRect = this.element.getBoundingClientRect();

        Utils.$$<HTMLDivElement>('.workspace-item').forEach(item => {
            const lp = parseFloat(item.dataset.leftPercent || '10');
            const tp = parseFloat(item.dataset.topPercent || '10');
            item.style.left = `${(lp / 100) * wsRect.width}px`;
            item.style.top = `${(tp / 100) * wsRect.height}px`;
        });
    }
}

// Меню

class SlidingMenu {
    private panel: HTMLDivElement | null;
    private activeButton: HTMLElement | null = null;
    private isAnimating: boolean = false;
    private categories: Record<string, HTMLDivElement | null>;
    private buttons: Record<string, HTMLElement | null>;

    constructor() {
        this.panel = Utils.$<HTMLDivElement>('.sliding');
        this.buttons = {
            starts: Utils.$('#button-tag-starts'),
            operators: Utils.$('#button-tag-operators'),
            variables: Utils.$('#button-tag-variables'),
            events: Utils.$('#button-tag-events')
        };
        this.categories = {
            starts: Utils.$<HTMLDivElement>('#category-starts'),
            operators: Utils.$<HTMLDivElement>('#category-operators'),
            variables: Utils.$<HTMLDivElement>('#category-variables'),
            events: Utils.$<HTMLDivElement>('#category-events')
        };
    }

    public init(): void {
        this.setupDraggableItems();
        this.setupButtonListeners();
        this.watchForNewItems();
    }

    private setupDraggableItems(): void {
        Utils.$$<HTMLDivElement>('.function-item').forEach(item => this.makeDraggable(item));
    }

    private makeDraggable(item: HTMLDivElement): void {
        item.draggable = true;
        item.ondragstart = (e: DragEvent) => {
            const data = Utils.getItemData(item);
            e.dataTransfer?.setData('text/plain', JSON.stringify(data));
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('dragging');
        };
        item.ondragend = () => item.classList.remove('dragging');
    }

    private setupButtonListeners(): void {
        Object.entries(this.buttons).forEach(([key, btn]) => {
            btn?.addEventListener('click', (e) => {
                e.stopPropagation();
                const cat = this.categories[key];
                if (cat && btn) this.toggle(btn, cat);
            });
        });
    }

    public toggle(btn: HTMLElement, category: HTMLDivElement): void {
        if (this.isAnimating) return;
        this.isAnimating = true;

        if (this.activeButton === btn) {
            this.hide(() => this.isAnimating = false);
        } else {
            this.hide(() => {
                this.show(btn, category);
                this.isAnimating = false;
            });
        }
    }

    private show(btn: HTMLElement, category: HTMLDivElement): void {
        if (!this.panel) return;
        this.hideAllCategories();
        category.classList.add('active');
        this.panel.classList.add('active');
        this.activeButton = btn;
    }

    public hide(callback?: () => void): void {
        if (!this.panel || !this.panel.classList.contains('active')) {
            callback?.();
            return;
        }

        this.panel.classList.remove('active');
        this.activeButton = null;

        setTimeout(() => {
            this.hideAllCategories();
            callback?.();
        }, CONFIG.ANIMATION_DURATION);
    }

    private hideAllCategories(): void {
        Object.values(this.categories).forEach(c => c?.classList.remove('active'));
    }

    private watchForNewItems(): void {
        if (!this.panel) return;
        const observer = new MutationObserver(mutations => {
            mutations.forEach(({ addedNodes }) => {
                addedNodes.forEach(node => {
                    if (node instanceof HTMLElement && node.classList.contains('function-item')) {
                        this.makeDraggable(node as HTMLDivElement);
                    }
                });
            });
        });
        observer.observe(this.panel, { childList: true, subtree: true });
    }
}

// Приложения

class App {
    private workspace: Workspace;
    private menu: SlidingMenu;

    constructor() {
        this.workspace = new Workspace('#workspace');
        this.menu = new SlidingMenu();
    }

    public start(): void {
        this.workspace.init();
        this.menu.init();
        this.setupGlobalEvents();
    }

    private setupGlobalEvents(): void {

        Utils.$('#clear-workspace')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.workspace.clear();
        });

        // Закрытие меню при клике вне
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const isMenuPart = target.closest('.button-tag') || target.closest('.sliding');
            if (!isMenuPart) {
                this.menu.hide();
            }
        });

        document.addEventListener('dragstart', (e) => {
            if (['IMG', 'A'].includes((e.target as HTMLElement).tagName)) {
                e.preventDefault();
            }
        });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.start();
});