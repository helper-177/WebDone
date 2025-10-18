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
            
            this.showFirstBanner(extendedLakes, searchRadius * 2);
        } else {
            this.showFirstBanner(nearbyLakes, searchRadius);
        }
    }

    // Показ первого баннера с колесом прокрутки
    showFirstBanner(lakes, radius) {
        this.isSpinning = true;
        const locationName = this.app.userLocation ? "вашего местоположения" : "Озёрного";
        
        // Создаем бесконечный список для плавной прокрутки
        const wheelItems = [];
        for (let i = 0; i < 3; i++) { // 3 копии для бесконечной прокрутки
            wheelItems.push(...lakes.map((lake, index) => `
                <div class="wheel-item" data-index="${index}">
                    <div class="wheel-item-content">
                        <strong>${lake.name}</strong>
                        <small>${this.app.formatDistance(lake.distance)} • ${this.app.formatArea(lake.area)} га</small>
                    </div>
                </div>
            `));
        }

        const bannerHTML = `
            <div class="random-banner" id="firstBanner">
                <div class="banner-content">
                    <div class="banner-header">
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
                            ${wheelItems.join('')}
                        </div>
                    </div>
                    
                    <div class="banner-message">
                        <i data-feather="loader" class="spinning-icon"></i>
                        <span>Прокручиваем список озёр...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', bannerHTML);
        
        // Даем время на отрисовку и начинаем анимацию
        setTimeout(() => {
            this.startWheelAnimation(lakes);
        }, 300);
        
        setTimeout(() => feather.replace(), 100);
    }

    // Запуск анимации колеса с плавным ускорением и замедлением
    startWheelAnimation(lakes) {
        const wheel = document.getElementById('lakeWheel');
        const selectedIndex = Math.floor(Math.random() * lakes.length);
        const selectedLake = lakes[selectedIndex];
        const itemHeight = 80;
        const totalItems = lakes.length * 3; // 3 копии списка
        
        // Начальная позиция - показываем середину первой копии
        const startPosition = lakes.length * itemHeight;
        wheel.style.transition = 'none';
        wheel.style.transform = `translateY(-${startPosition}px)`;
        
        const startTime = Date.now();
        const totalDuration = 7000; // 7 секунд общее время
        const maxSpins = 8; // Количество полных прокруток
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            
            // Плавное ускорение и замедление
            let easedProgress;
            if (progress < 0.3) {
                // Медленный старт (первые 30%)
                easedProgress = progress * progress * 0.5;
            } else if (progress < 0.7) {
                // Быстрая прокрутка (30%-70%)
                easedProgress = 0.045 + (progress - 0.3) * 1.5;
            } else {
                // Медленное завершение (последние 30%)
                easedProgress = 0.645 + (progress - 0.7) * 0.3;
            }

            easedProgress = Math.min(easedProgress, 1);
            
            if (progress < 1) {
                // Активная фаза прокрутки
                const distance = easedProgress * maxSpins * lakes.length * itemHeight;
                const currentPosition = startPosition + distance;
                wheel.style.transform = `translateY(-${currentPosition}px)`;
                requestAnimationFrame(animate);
            } else {
                // Финальная фаза - плавная остановка на выбранном озере
                // Вычисляем финальную позицию в средней копии
                const finalPosition = startPosition + (maxSpins * lakes.length * itemHeight) - (selectedIndex * itemHeight);
                wheel.style.transition = 'transform 1.5s cubic-bezier(0.23, 1, 0.32, 1)';
                wheel.style.transform = `translateY(-${finalPosition}px)`;
                
                // Закрываем первый баннер и показываем второй
                setTimeout(() => {
                    this.closeFirstBannerAndShowSecond(selectedLake, lakes.length);
                }, 1500);
            }
        };

        // Запускаем анимацию
        requestAnimationFrame(animate);
    }

    // Закрытие первого баннера и показ второго (зеленого)
    closeFirstBannerAndShowSecond(selectedLake, totalLakes) {
        const firstBanner = document.getElementById('firstBanner');
        
        // Анимация закрытия первого баннера
        firstBanner.style.animation = 'slideOutUp 0.8s ease forwards';
        
        setTimeout(() => {
            firstBanner.remove();
            this.showSecondBanner(selectedLake, totalLakes);
        }, 800);
    }

    // Показ второго (зеленого) баннера
    showSecondBanner(selectedLake, totalLakes) {
        const messages = [
            `Идеальное озеро всего в ${this.app.formatDistance(selectedLake.distance)} от ${this.app.userLocation ? "вас" : "Озёрного"}!`,
            "Судьба привела вас к этому озеру!",
            "Рыбаки хвалят это место за отличный клёв!",
            "Поверьте интуиции - сегодня ваш день!",
            "Идеальный выбор для рыбалки рядом с вами!",
            "Здесь вас ждет богатый улов!",
            "Удача на вашей стороне - озеро совсем рядом!"
        ];

        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const locationName = this.app.userLocation ? "вас" : "Озёрного";

        const bannerHTML = `
            <div class="result-banner" id="secondBanner">
                <div class="banner-content">
                    <div class="banner-success">
                        <div class="success-icon">🎉</div>
                        <h3>Судьба выбрала!</h3>
                    </div>
                    
                    <div class="selected-lake-info">
                        <h4>${selectedLake.name}</h4>
                        <div class="lake-stats">
                            <div class="stat">
                                <i data-feather="map-pin"></i>
                                <span>${this.app.formatDistance(selectedLake.distance)} от ${locationName}</span>
                            </div>
                            <div class="stat">
                                <i data-feather="maximize"></i>
                                <span>${this.app.formatArea(selectedLake.area)} га</span>
                            </div>
                            <div class="stat">
                                <i data-feather="trending-down"></i>
                                <span>${selectedLake.depth}</span>
                            </div>
                        </div>
                        <div class="lake-fish">
                            <strong>Рыба:</strong> ${selectedLake.fish.slice(0, 4).join(', ')}
                        </div>
                    </div>
                    
                    <div class="destiny-message">
                        <i data-feather="star"></i>
                        <span>${randomMessage}</span>
                    </div>
                    
                    <div class="countdown">
                        <div class="countdown-text">Открываем детали через: <span id="countdownNumber">5</span> сек.</div>
                        <div class="countdown-bar">
                            <div class="countdown-progress" id="countdownProgress"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', bannerHTML);
        setTimeout(() => feather.replace(), 100);
        
        // Запускаем обратный отсчет
        this.startCountdown(selectedLake);
    }

    // Обратный отсчет для второго баннера
    startCountdown(selectedLake) {
        let countdown = 5; // 5 секунд обратного отсчета
        const countdownElement = document.getElementById('countdownNumber');
        const progressElement = document.getElementById('countdownProgress');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            progressElement.style.width = `${(5 - countdown) * 20}%`;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.closeSecondBannerAndShowDetails(selectedLake);
            }
        }, 1000);
    }

    // Закрытие второго баннера и открытие карточки озера
    closeSecondBannerAndShowDetails(selectedLake) {
        const secondBanner = document.getElementById('secondBanner');
        
        // Анимация закрытия второго баннера
        secondBanner.style.animation = 'slideOutUp 0.5s ease forwards';
        
        setTimeout(() => {
            secondBanner.remove();
            this.isSpinning = false;
            this.app.showDetails(selectedLake);
        }, 500);
    }
}
