// random-wheel.js - Модуль случайного выбора озера
class RandomWheel {
    constructor(fishingApp) {
        this.app = fishingApp;
        this.isSpinning = false;
    }

    // Запуск случайного выбора с учетом местоположения
    async startRandomSelection() {
        if (this.isSpinning) return;
        
        // Если местоположение еще не определено, запрашиваем его
        if (!this.app.userLocation) {
            const useCurrentLocation = confirm('Хотите использовать ваше текущее местоположение для поиска ближайших озер?');
            
            if (useCurrentLocation) {
                try {
                    await this.app.requestLocationPermission();
                } catch (error) {
                    this.app.showNotification('Используем Озёрный как точку отсчета');
                }
            }
        }

        // Определяем радиус поиска
        let searchRadius = 40; // км по умолчанию
        
        if (this.app.userLocation && this.app.userLocation.accuracy < 1000) {
            searchRadius = 200;
        } else if (this.app.userLocation) {
            searchRadius = 250;
        }

        const nearbyLakes = this.app.lakesData.filter(lake => lake.distance <= searchRadius);
        
        if (nearbyLakes.length === 0) {
            // Если нет озер в радиусе, увеличиваем радиус
            const extendedLakes = this.app.lakesData.filter(lake => lake.distance <= searchRadius * 2);
            
            if (extendedLakes.length === 0) {
                this.app.showNotification(`В радиусе ${searchRadius * 2} км нет подходящих озер`);
                return;
            }
            
            this.showRandomWheel(extendedLakes, searchRadius * 2);
        } else {
            this.showRandomWheel(nearbyLakes, searchRadius);
        }
    }

    // Показ колеса выбора
    showRandomWheel(lakes, radius) {
        this.isSpinning = true;
        const locationName = this.app.userLocation ? "вашего местоположения" : "Озёрного";
        
        const modalHTML = `
            <div class="random-modal" id="randomModal">
                <div class="random-modal-content">
                    <div class="random-header">
                        <h3>🎣 Колесо рыбацкой судьбы</h3>
                        <p>Выбираем озеро в радиусе ${radius} км от ${locationName}</p>
                    </div>
                    
                    <div class="location-info">
                        <i data-feather="map-pin"></i>
                        <span>Точка отсчета: ${this.app.referencePoint.name}</span>
                    </div>
                    
                    <div class="random-wheel-container">
                        <div class="wheel-arrow">▼</div>
                        <div class="lake-wheel" id="lakeWheel">
                            ${lakes.map((lake, index) => `
                                <div class="wheel-item" data-index="${index}">
                                    <div class="wheel-item-content">
                                        <strong>${lake.name}</strong>
                                        <small>${this.app.formatDistance(lake.distance)} • ${this.app.formatArea(lake.area)} га</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="random-result hidden" id="randomResult">
                        <div class="result-header">
                            <i data-feather="award" class="result-icon"></i>
                            <h4>Судьба выбрала!</h4>
                        </div>
                        <div id="selectedLakeInfo"></div>
                        <p class="destiny-message" id="destinyMessage"></p>
                    </div>
                    
                    <div class="random-actions">
                        <button class="random-action-btn random-cancel" id="cancelRandom">
                            <i data-feather="x"></i>
                            Отмена
                        </button>
                        <button class="random-action-btn random-confirm hidden" id="confirmRandom">
                            <i data-feather="eye"></i>
                            Посмотреть
                        </button>
                        <button class="random-action-btn random-confirm hidden" id="tryAgain">
                            <i data-feather="refresh-cw"></i>
                            Ещё раз
                        </button>
                        <button class="random-action-btn location-btn" id="updateLocation">
                            <i data-feather="navigation"></i>
                            Обновить местоположение
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupWheelEventListeners(lakes, radius);
        setTimeout(() => feather.replace(), 100);
    }

    // Настройка обработчиков событий для колеса
    setupWheelEventListeners(lakes, radius) {
        const modal = document.getElementById('randomModal');
        const wheel = document.getElementById('lakeWheel');
        const resultDiv = document.getElementById('randomResult');
        const selectedLakeInfo = document.getElementById('selectedLakeInfo');
        const destinyMessage = document.getElementById('destinyMessage');

        // Начинаем анимацию прокрутки
        this.startWheelAnimation(wheel, lakes, resultDiv, selectedLakeInfo, destinyMessage, radius);

        // Обработчики кнопок
        document.getElementById('cancelRandom').addEventListener('click', () => {
            this.closeModal(modal);
        });

        document.getElementById('confirmRandom').addEventListener('click', () => {
            const selectedLake = this.getSelectedLake(lakes);
            this.closeModal(modal);
            setTimeout(() => {
                this.app.showDetails(selectedLake);
            }, 300);
        });

        document.getElementById('tryAgain').addEventListener('click', () => {
            this.closeModal(modal);
            setTimeout(() => {
                this.startRandomSelection();
            }, 300);
        });

        document.getElementById('updateLocation').addEventListener('click', async () => {
            this.app.showNotification('Обновляем местоположение...');
            try {
                await this.app.requestLocationPermission();
                this.closeModal(modal);
                setTimeout(() => {
                    this.startRandomSelection();
                }, 500);
            } catch (error) {
                this.app.showNotification('Не удалось обновить местоположение');
            }
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });
    }

    // Анимация прокрутки колеса
    startWheelAnimation(wheel, lakes, resultDiv, selectedLakeInfo, destinyMessage, radius) {
        const selectedIndex = Math.floor(Math.random() * lakes.length);
        const selectedLake = lakes[selectedIndex];
        
        // Начальная позиция
        wheel.style.transition = 'none';
        wheel.style.transform = 'translateY(0)';
        
        // Даем время на отрисовку
        setTimeout(() => {
            // Быстрая прокрутка в начале
            wheel.style.transition = 'transform 0.1s linear';
            
            let spinCount = 0;
            const maxSpins = 8; // Количество полных прокруток
            const spinDuration = 3000; // Общее время анимации
            
            const startSpin = () => {
                const itemHeight = 80; // Высота элемента колеса
                const totalHeight = lakes.length * itemHeight;
                
                // Плавное замедление
                const progress = Math.min(spinCount / (spinDuration / 100), 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                // Вычисляем позицию с учетом замедления
                const currentPosition = -easeOut * (maxSpins * totalHeight + selectedIndex * itemHeight);
                wheel.style.transform = `translateY(${currentPosition}px)`;
                
                spinCount++;
                
                if (progress < 1) {
                    requestAnimationFrame(startSpin);
                } else {
                    // Финальная корректировка позиции
                    wheel.style.transition = 'transform 1s cubic-bezier(0.23, 1, 0.32, 1)';
                    wheel.style.transform = `translateY(${-(selectedIndex * itemHeight)}px)`;
                    
                    // Показываем результат
                    setTimeout(() => {
                        this.showRandomResult(selectedLake, selectedLakeInfo, destinyMessage, radius);
                        resultDiv.classList.remove('hidden');
                        document.getElementById('confirmRandom').classList.remove('hidden');
                        document.getElementById('tryAgain').classList.remove('hidden');
                        this.isSpinning = false;
                    }, 1000);
                }
            };
            
            startSpin();
        }, 100);
    }

    // Получение выбранного озера
    getSelectedLake(lakes) {
        const wheel = document.getElementById('lakeWheel');
        const transform = wheel.style.transform;
        const match = transform.match(/translateY\(-(\d+)px\)/);
        
        if (match) {
            const position = parseInt(match[1]);
            const itemHeight = 80;
            const selectedIndex = Math.round(position / itemHeight) % lakes.length;
            return lakes[selectedIndex];
        }
        
        return lakes[0]; // fallback
    }

    // Показ результата
    showRandomResult(lake, container, messageElement, radius) {
        const messages = [
            `Идеальное озеро всего в ${this.app.formatDistance(lake.distance)} от ${this.app.userLocation ? "вас" : "Озёрного"}!`,
            "Судьба привела вас к этому озеру!",
            "Рыбаки хвалят это место за отличный клёв!",
            "Поверьте интуиции - сегодня ваш день!",
            "Идеальный выбор для рыбалки рядом с вами!",
            "Здесь вас ждет богатый улов!",
            "Удача на вашей стороне - озеро совсем рядом!"
        ];

        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const locationName = this.app.userLocation ? "вас" : "Озёрного";

        container.innerHTML = `
            <div class="selected-lake-card">
                <h3>${lake.name}</h3>
                <div class="lake-stats">
                    <span class="stat-item">
                        <i data-feather="map-pin"></i>
                        ${this.app.formatDistance(lake.distance)} от ${locationName}
                    </span>
                    <span class="stat-item">
                        <i data-feather="maximize"></i>
                        ${this.app.formatArea(lake.area)} га
                    </span>
                </div>
                <div class="lake-fish">
                    <strong>Рыба:</strong> ${lake.fish.slice(0, 4).join(', ')}
                </div>
            </div>
        `;

        messageElement.textContent = randomMessage;
        setTimeout(() => feather.replace(), 100);
    }

    // Закрытие модального окна
    closeModal(modal) {
        modal.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            modal.remove();
            this.isSpinning = false;
        }, 300);
    }
}