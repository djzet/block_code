// Константы
const CATEGORIES = {
    START: 'starts',
    OPERATOR: 'operator',
    VARIABLE: 'variable',
    EVENT: 'event'
};

const CATEGORY_SELECTORS = {
    [CATEGORIES.START]: '#category-starts',
    [CATEGORIES.OPERATOR]: '#category-operators',
    [CATEGORIES.VARIABLE]: '#category-variables',
    [CATEGORIES.EVENT]: '#category-events'
};

const DEFAULT_POSITION = { left: 60, top: 60 };
const ANIMATION_DURATION = 420;

// Состояния приложения
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

// Утилиты
const $ = selector => document.querySelector(selector);

const $$ = selector => document.querySelectorAll(selector);

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const getCategoryFromElement = el => {
    if (el.closest(CATEGORY_SELECTORS[CATEGORIES.START])) return CATEGORIES.START;
    if (el.closest(CATEGORY_SELECTORS[CATEGORIES.VARIABLE])) return CATEGORIES.VARIABLE;
    if (el.closest(CATEGORY_SELECTORS[CATEGORIES.EVENT])) return CATEGORIES.EVENT;
    return CATEGORIES.OPERATOR;
};

const getItemData = el => ({
    name: el.querySelector('.function-name')?.textContent?.trim() || 'Элемент',
    description: el.querySelector('.function-desc')?.textContent?.trim() || '',
    category: getCategoryFromElement(el)
});


// Работа с рабочей областью
const workspace = {
    element: $('#workspace'),

    init() {
        this.element.style.position = 'relative';
        this.element.style.overflow = 'hidden';
        this.setupDrop();
        this.checkEmpty();
        window.addEventListener('resize', () => this.updatePositionsOnResize());
    },

    createItem({ name, description, category }) {
        const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const item = document.createElement('div');
        item.className = `workspace-item ${category}-item`;
        item.id = id;

        item.innerHTML = `
            <div class="item-name">${name}</div>
            <div class="item-desc">${description}</div>
            <button class="remove-item" title="Удалить">×</button>
        `;

        item.style.position = 'absolute';
        item.style.left = DEFAULT_POSITION.left + 'px';
        item.style.top = DEFAULT_POSITION.top + 'px';
        item.style.cursor = 'grab';
        item.style.userSelect = 'none';

        item.dataset.name = name;
        item.dataset.description = description;
        item.dataset.category = category;

        this.attachItemEvents(item);
        return item;
    },

    attachItemEvents(item) {
        item.querySelector('.remove-item').onclick = e => {
            e.stopPropagation();
            item.remove();
            workspace.checkEmpty();
        };

        item.onmousedown = e => this.handleDragStart(e, item);
        item.ondragstart = e => e.preventDefault();
    },

    handleDragStart(e, item) {
        if (e.target.closest('.remove-item')) return;
        e.preventDefault();

        const rect = item.getBoundingClientRect();
        const wsRect = this.element.getBoundingClientRect();

        state.drag.activeItem = item;
        state.drag.offsetX = e.clientX - rect.left;
        state.drag.offsetY = e.clientY - rect.top;

        item.style.cursor = 'grabbing';
        item.classList.add('dragging');

        document.addEventListener('mousemove', this.onDrag);
        document.addEventListener('mouseup', this.stopDrag, { once: true });
    },

    onDrag: e => {
        if (!state.drag.activeItem) return;
        e.preventDefault();

        const item = state.drag.activeItem;
        const wsRect = workspace.element.getBoundingClientRect();

        let newLeft = e.clientX - state.drag.offsetX - wsRect.left;
        let newTop = e.clientY - state.drag.offsetY - wsRect.top;

        newLeft = clamp(newLeft, 0, wsRect.width - item.offsetWidth);
        newTop = clamp(newTop, 0, wsRect.height - item.offsetHeight);

        item.style.left = newLeft + 'px';
        item.style.top = newTop + 'px';

        item.dataset.leftPercent = (newLeft / wsRect.width) * 100;
        item.dataset.topPercent = (newTop / wsRect.height) * 100;
    },

    stopDrag: () => {
        if (state.drag.activeItem) {
            const item = state.drag.activeItem;
            item.style.cursor = 'grab';
            item.classList.remove('dragging');
            state.drag.activeItem = null;
        }
        document.removeEventListener('mousemove', workspace.onDrag);
    },

    setupDrop() {
        this.element.ondragover = e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.element.classList.add('drag-over');
        };

        this.element.ondragleave = e => {
            if (!this.element.contains(e.relatedTarget)) {
                this.element.classList.remove('drag-over');
            }
        };

        this.element.ondrop = e => {
            e.preventDefault();
            this.element.classList.remove('drag-over');

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const item = this.createItem(data);

                const rect = this.element.getBoundingClientRect();
                let x = e.clientX - rect.left - (item.offsetWidth / 2);
                let y = e.clientY - rect.top - (item.offsetHeight / 2);

                x = clamp(x, 0, rect.width - item.offsetWidth);
                y = clamp(y, 0, rect.height - item.offsetHeight);

                item.style.left = x + 'px';
                item.style.top = y + 'px';

                item.dataset.leftPercent = (x / rect.width) * 100;
                item.dataset.topPercent = (y / rect.height) * 100;

                this.element.appendChild(item);
                this.removePlaceholder();
                this.checkEmpty();
            } catch (err) {
                console.warn('Ошибка при drop:', err);
            }
        };
    },

    removePlaceholder() {
        $$('.workspace-placeholder').forEach(el => el.remove());
    },

    checkEmpty() {
        if ($$('.workspace-item').length === 0 && !$('.workspace-placeholder')) {
            const ph = document.createElement('div');
            ph.className = 'workspace-placeholder';
            ph.textContent = 'Перетащите сюда блоки из меню';
            this.element.appendChild(ph);
        }
    },

    clear() {
        $$('.workspace-item').forEach(el => el.remove());
        this.checkEmpty();
    },

    updatePositionsOnResize() {
        $$('.workspace-item').forEach(item => {
            const wsRect = this.element.getBoundingClientRect();
            const lp = parseFloat(item.dataset.leftPercent) || 10;
            const tp = parseFloat(item.dataset.topPercent) || 10;

            item.style.left = (lp / 100 * wsRect.width) + 'px';
            item.style.top = (tp / 100 * wsRect.height) + 'px';
        });
    }
};

// Работа с меню
const menu = {
    panel: $('.sliding'),
    buttons: {
        starts: $('#button-tag-starts'),
        operators: $('#button-tag-operators'),
        variables: $('#button-tag-variables'),
        events: $('#button-tag-events')
    },
    categories: {
        starts: $('#category-starts'),
        operators: $('#category-operators'),
        variables: $('#category-variables'),
        events: $('#category-events')
    },

    init() {
        this.setupDraggableItems();
        this.setupButtonListeners();
        this.setupCloseListeners();
        this.watchForNewItems();
    },

    setupDraggableItems() {
        $$('.function-item').forEach(item => this.makeDraggable(item));
    },

    makeDraggable(item) {
        item.draggable = true;

        item.ondragstart = e => {
            const data = getItemData(item);
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('dragging');
        };

        item.ondragend = () => item.classList.remove('dragging');
    },

    setupButtonListeners() {
        Object.entries(this.buttons).forEach(([key, btn]) => {
            btn.onclick = e => {
                e.stopPropagation();
                this.toggle(btn, this.categories[key]);
            };
        });
    },

    setupCloseListeners() {
        document.onclick = e => this.handleDocumentClick(e);

        [this.panel, workspace.element, $('.workspace-container')].forEach(el => {
            if (el) el.onclick = e => e.stopPropagation();
        });
    },

    hideAllCategories() {
        Object.values(this.categories).forEach(c => c.classList.remove('active'));
    },

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

    show(btn, category) {
        this.hideAllCategories();
        category.classList.add('active');
        this.panel.classList.add('active');
        state.menu.activeButton = btn;
    },

    toggle(btn, category) {
        if (state.menu.isAnimating) return;

        state.menu.isAnimating = true;

        if (state.menu.activeButton === btn) {
            this.hide(() => state.menu.isAnimating = false);
        } else {
            this.hide(() => {
                this.show(btn, category);
                state.menu.isAnimating = false;
            });
        }
    },

    handleDocumentClick(e) {
        if (state.menu.isAnimating) return;

        const excluded = [
            '.button-tag', '.sliding', '.workspace-container',
            '#clear-workspace', '.workspace-item', '.remove-item'
        ].some(sel => e.target.closest(sel));

        if (!excluded) {
            state.menu.isAnimating = true;
            this.hide(() => state.menu.isAnimating = false);
        }
    },

    watchForNewItems() {
        new MutationObserver(mutations => {
            mutations.forEach(({ addedNodes }) => {
                addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList?.contains('function-item')) {
                        this.makeDraggable(node);
                    }
                });
            });
        }).observe($('.sliding'), { childList: true, subtree: true });
    }
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    workspace.init();
    menu.init();

    $('#clear-workspace')?.addEventListener('click', e => {
        e.stopPropagation();
        workspace.clear();
    });

    document.addEventListener('dragstart', e => {
        if (['IMG', 'A'].includes(e.target.tagName)) e.preventDefault();
    });
});