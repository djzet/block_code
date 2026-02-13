// константы
const CATEGORIES = {
    OPERATOR: 'operator',
    VARIABLE: 'variable',
    EVENT: 'event'
};

const CATEGORY_SELECTORS = {
    [CATEGORIES.OPERATOR]: '#category-operators',
    [CATEGORIES.VARIABLE]: '#category-variables',
    [CATEGORIES.EVENT]: '#category-events'
};

const DEFAULT_POSITION = { left: 50, top: 50 };
const ANIMATION_DURATION = 500;

// состояния
const state = {
    drag: {
        activeItem: null,
        offsetX: 0,
        offsetY: 0
    },
    menu: {
        activeButton: null,
        isAnimating: false
    }
};

// утилиты
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

/**
 * ограничивает значение числа в заданном диапазоне
 * @param {number} value - исходное значение
 * @param {number} min - минимальное допустимое значение
 * @param {number} max - максимальное допустимое значение
 * @returns {number} - ограниченное значение
 */
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * определяет категорию элемента на основе его родительского контейнера
 * @param {HTMLElement} element - DOM элемент для определения категории
 * @returns {string} - ключ категории из CATEGORIES
 */
const getCategoryFromElement = element => {
    if (element.closest('#category-variables')) return CATEGORIES.VARIABLE;
    if (element.closest('#category-events')) return CATEGORIES.EVENT;
    return CATEGORIES.OPERATOR;
};

/**
 * извлекает данные элемента для переноса
 * @param {HTMLElement} element - элемент функции из меню
 * @returns {Object} - объект с name, description и category элемента
 */
const getItemData = element => ({
    name: element.querySelector('.function-name')?.textContent || 'Элемент',
    description: element.querySelector('.function-desc')?.textContent || 'Описание',
    category: getCategoryFromElement(element)
});

// работа с рабочей областью
const workspace = {
    element: $('#workspace'),

    /**
     * инициализирует рабочую область
     * устанавливает начальные стили, настраивает обработчики событий для drag and drop
     */
    init() {
        this.element.style.position = 'relative';
        this.element.style.minHeight = '400px';
        this.setupDrop();
        this.checkEmpty();
    },

    /**
     * создает новый элемент в рабочей области
     * @param {Object} params - параметры элемента
     * @param {string} params.name - название элемента
     * @param {string} params.description - описание элемента
     * @param {string} params.category - категория элемента
     * @returns {HTMLElement} - созданный элемент рабочей области
     */
    createItem({ name, description, category }) {
        const id = `workspace-item-${Date.now()}-${Math.random()}`;
        const item = document.createElement('div');

        Object.assign(item, {
            className: `workspace-item ${category}-item`,
            id,
            innerHTML: `
        <div class="item-name">${name}</div>
        <div class="item-desc">${description}</div>
        <button class="remove-item" title="Удалить">×</button>
      `
        });

        Object.assign(item.style, {
            position: 'absolute',
            left: `${DEFAULT_POSITION.left}px`,
            top: `${DEFAULT_POSITION.top}px`,
            cursor: 'grab',
            userSelect: 'none'
        });

        Object.assign(item.dataset, { name, description, category });

        this.attachItemEvents(item);
        return item;
    },

    /**
     * прикрепляет обработчики событий к элементу рабочей области
     * @param {HTMLElement} item - элемент рабочей области
     */
    attachItemEvents(item) {
        item.querySelector('.remove-item').addEventListener('click', (e) => {
            e.stopPropagation();
            item.remove();
            this.checkEmpty();
        });

        item.addEventListener('mousedown', this.handleDragStart);
        item.addEventListener('dragstart', e => e.preventDefault());
    },

    /**
     * обрабатывает начало перетаскивания элемента рабочей области
     * @param {MouseEvent} e - событие мыши
     */
    handleDragStart(e) {
        if (e.target.classList.contains('remove-item')) return;
        e.preventDefault();

        const item = e.target.closest('.workspace-item');
        if (!item) return;

        const rect = item.getBoundingClientRect();
        const workspaceRect = workspace.element.getBoundingClientRect();

        state.drag.activeItem = item;
        state.drag.offsetX = e.clientX - rect.left;
        state.drag.offsetY = e.clientY - rect.top;

        Object.assign(item.style, { cursor: 'grabbing' });
        item.classList.add('dragging');

        document.addEventListener('mousemove', workspace.onDrag);
        document.addEventListener('mouseup', workspace.stopDrag);
    },

    /**
     * обрабатывает перемещение элемента рабочей области
     * @param {MouseEvent} e - событие мыши
     */
    onDrag(e) {
        if (!state.drag.activeItem) return;
        e.preventDefault();

        const item = state.drag.activeItem;
        const workspaceRect = workspace.element.getBoundingClientRect();

        let newLeft = e.clientX - state.drag.offsetX;
        let newTop = e.clientY - state.drag.offsetY;

        newLeft = clamp(newLeft, workspaceRect.left, workspaceRect.right - item.offsetWidth);
        newTop = clamp(newTop, workspaceRect.top, workspaceRect.bottom - item.offsetHeight);

        const left = newLeft - workspaceRect.left;
        const top = newTop - workspaceRect.top;

        Object.assign(item.style, { left: left + 'px', top: top + 'px' });

        const leftPercent = (left / workspaceRect.width) * 100;
        const topPercent = (top / workspaceRect.height) * 100;
        Object.assign(item.dataset, { leftPercent, topPercent });
    },

    /**
     * завершает перетаскивание элемента
     */
    stopDrag() {
        if (state.drag.activeItem) {
            Object.assign(state.drag.activeItem.style, { cursor: 'grab' });
            state.drag.activeItem.classList.remove('dragging');
            state.drag.activeItem = null;
        }

        document.removeEventListener('mousemove', workspace.onDrag);
        document.removeEventListener('mouseup', workspace.stopDrag);
    },

    /**
     * настраивает возможность сброса элементов в рабочую область
     */
    setupDrop() {
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.element.classList.add('drag-over');
        });

        this.element.addEventListener('dragleave', (e) => {
            if (!this.element.contains(e.relatedTarget)) {
                this.element.classList.remove('drag-over');
            }
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.element.classList.remove('drag-over');

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const item = this.createItem(data);

                const rect = this.element.getBoundingClientRect();
                let dropX = e.clientX - rect.left;
                let dropY = e.clientY - rect.top;

                dropX = clamp(dropX, 0, rect.width - item.offsetWidth);
                dropY = clamp(dropY, 0, rect.height - item.offsetHeight);

                Object.assign(item.style, { left: dropX + 'px', top: dropY + 'px' });

                this.element.appendChild(item);
                this.removePlaceholder();
            } catch (error) {
                console.error('Ошибка при добавлении элемента:', error);
            }
        });
    },

    /**
     * удаляет плейсхолдер рабочей области
     */
    removePlaceholder() {
        $$('.workspace-placeholder').forEach(p => p.remove());
    },

    /**
     * проверяет наличие элементов в рабочей области
     * при отсутствии элементов добавляет плейсхолдер
     */
    checkEmpty() {
        if ($$('.workspace-item').length === 0 && !$('.workspace-placeholder')) {
            const placeholder = document.createElement('div');
            placeholder.className = 'workspace-placeholder';
            placeholder.textContent = 'Перетащите сюда элементы из меню';
            Object.assign(placeholder.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%'
            });
            this.element.appendChild(placeholder);
        }
    },

    /**
     * очищает рабочую область от всех элементов
     */
    clear() {
        $$('.workspace-item').forEach(item => item.remove());
        this.checkEmpty();
    }
};

// работа с меню
const menu = {
    panel: $('.sliding'),
    buttons: {
        operators: $('#button-tag-operators'),
        variables: $('#button-tag-variables'),
        events: $('#button-tag-events')
    },
    categories: {
        operators: $('#category-operators'),
        variables: $('#category-variables'),
        events: $('#category-events')
    },

    /**
     * инициализирует меню
     * настраивает перетаскиваемые элементы, обработчики кнопок и отслеживание новых элементов
     */
    init() {
        this.setupDraggableItems();
        this.setupButtonListeners();
        this.setupCloseListeners();
        this.watchForNewItems();
    },

    /**
     * делает все элементы функций перетаскиваемыми
     */
    setupDraggableItems() {
        $$('.function-item').forEach(item => this.makeDraggable(item));
    },

    /**
     * настраивает элемент для перетаскивания
     * @param {HTMLElement} item - элемент для настройки перетаскивания
     */
    makeDraggable(item) {
        item.setAttribute('draggable', 'true');

        item.addEventListener('dragstart', (e) => {
            const data = getItemData(item);
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
    },

    /**
     * настраивает обработчики для кнопок категорий
     */
    setupButtonListeners() {
        Object.entries(this.buttons).forEach(([key, button]) => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(button, this.categories[key]);
            });
        });
    },

    /**
     * настраивает обработчики для закрытия меню
     */
    setupCloseListeners() {
        document.addEventListener('click', (e) => this.handleDocumentClick(e));

        this.panel.addEventListener('click', e => e.stopPropagation());
        workspace.element.addEventListener('click', e => e.stopPropagation());
        $('.workspace-container')?.addEventListener('click', e => e.stopPropagation());
    },

    /**
     * скрывает все открытые категории
     */
    hideAllCategories() {
        Object.values(this.categories).forEach(cat => cat.classList.remove('active'));
    },

    /**
     * скрывает меню
     * @param {Function} callback - функция, вызываемая после завершения анимации
     */
    hide(callback) {
        if (!this.panel.classList.contains('active')) {
            callback?.();
            return;
        }

        this.panel.classList.remove('active');
        state.menu.activeButton = null;

        setTimeout(() => {
            this.hideAllCategories();
            callback?.();
        }, ANIMATION_DURATION);
    },

    /**
     * показывает указанную категорию
     * @param {HTMLElement} button - нажатая кнопка
     * @param {HTMLElement} category - натегория для отображения
     */
    show(button, category) {
        this.hideAllCategories();
        category.classList.add('active');
        this.panel.classList.add('active');
        state.menu.activeButton = button;
    },

    /**
     * переключает видимость категории
     * @param {HTMLElement} button - нажатая кнопка
     * @param {HTMLElement} category - категория для переключения
     */
    toggle(button, category) {
        if (state.menu.isAnimating) return;

        state.menu.isAnimating = true;

        if (state.menu.activeButton === button) {
            this.hide(() => state.menu.isAnimating = false);
        } else {
            this.hide(() => {
                this.show(button, category);
                state.menu.isAnimating = false;
            });
        }
    },

    /**
     * обрабатывает клик по документу для закрытия меню
     * @param {MouseEvent} e - событие клика
     */
    handleDocumentClick(e) {
        if (state.menu.isAnimating) return;

        const isExcluded = [
            '.button-tag',
            '.sliding',
            '.workspace-container',
            '#clear-workspace',
            '.workspace-item',
            '.remove-item'
        ].some(selector => e.target.closest(selector));

        if (isExcluded) return;

        state.menu.isAnimating = true;
        this.hide(() => state.menu.isAnimating = false);
    },

    /**
     * отслеживает появление новых элементов в меню
     * автоматически делает их перетаскиваемыми
     */
    watchForNewItems() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(({ addedNodes }) => {
                addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList?.contains('function-item')) {
                        this.makeDraggable(node);
                    }
                });
            });
        });

        observer.observe($('.sliding'), { childList: true, subtree: true });
    }
};

// инициализация
document.addEventListener('DOMContentLoaded', () => {
    workspace.init();
    menu.init();

    $('#clear-workspace')?.addEventListener('click', (e) => {
        e.stopPropagation();
        workspace.clear();
    });

    document.addEventListener('dragstart', (e) => {
        if (['IMG', 'A'].includes(e.target.tagName)) {
            e.preventDefault();
        }
    });
});