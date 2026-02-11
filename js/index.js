// получаем элементы
const slidingPanel = document.querySelector('.sliding');
const operators = document.getElementById('button-tag-operators');
const variables = document.getElementById('button-tag-variables');
const events = document.getElementById('button-tag-events');

const categoryOperators = document.getElementById('category-operators');
const categoryVariables = document.getElementById('category-variables');
const categoryEvents = document.getElementById('category-events');

// текущая активная кнопка
let activeButton = null;
let isAnimating = false;

// функция для скрытия всех категорий
function hideAllCategories() {
    categoryOperators.classList.remove('active');
    categoryVariables.classList.remove('active');
    categoryEvents.classList.remove('active');
}

// функция для скрытия панели
function hidePanel(callback) {
    if (!slidingPanel.classList.contains('active')) {
        if (callback) callback();
        return;
    }

    slidingPanel.classList.remove('active');
    activeButton = null;

    setTimeout(() => {
        hideAllCategories();
        if (callback) callback();
    }, 500);
}

// функция для показа панели
function showPanel(button, category) {
    hideAllCategories();
    category.classList.add('active');
    slidingPanel.classList.add('active');
    activeButton = button;
}

// функция для последовательного закрытия и открытия
function togglePanel(button, category) {
    if (isAnimating) return;

    if (activeButton === button) {
        isAnimating = true;
        hidePanel(() => {
            isAnimating = false;
        });
    }
    else {
        isAnimating = true;

        hidePanel(() => {
            showPanel(button, category);
            isAnimating = false;
        });
    }
}

// добавляем обработчики на кнопки
operators.addEventListener('click', function (event) {
    event.stopPropagation();
    togglePanel(this, categoryOperators);
});

variables.addEventListener('click', function (event) {
    event.stopPropagation();
    togglePanel(this, categoryVariables);
});

events.addEventListener('click', function (event) {
    event.stopPropagation();
    togglePanel(this, categoryEvents);
});

// закрытие при клике на пустую область
document.addEventListener('click', function (event) {
    if (isAnimating) return;

    const isClickOnButton = event.target.closest('.button-tag');
    const isClickOnSliding = event.target.closest('.sliding');

    if (!isClickOnButton && !isClickOnSliding) {
        isAnimating = true;
        hidePanel(() => {
            isAnimating = false;
        });
    }
});

// убираем мисклик закрытие
slidingPanel.addEventListener('click', function (event) {
    event.stopPropagation();
});