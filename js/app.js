// Основной модуль приложения
class FishingGuideApp {
    constructor() {
        this.lakesData = [];
        this.currentLake = null;
        this.userLocation = null; // Добавляем хранение местоположения пользователя
        this.referencePoint = {
            lat: 57.869570,
            lon: 33.692833,
            name: "Озёрный"
        };
        this.randomWheel = null;
        this.fishingForecast = new FishingForecast();
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadLakesData();
            this.setupEventListeners();
            feather.replace();
            
            this.checkShareParameter();
            this.requestLocationPermission(); // Запрашиваем разрешение при загрузке
            
            // Инициализируем модуль случайного выбора
            this.randomWheel = new RandomWheel(this);
        });
    }

    // Запрос разрешения на геолокацию
    async requestLocationPermission() {
        if (!navigator.geolocation) {
            console.log('Геолокация не поддерживается браузером');
            return;
        }

        try {
            // Пробуем получить кэшированную позицию
            const cachedLocation = localStorage.getItem('userLocation');
            if (cachedLocation) {
                this.userLocation = JSON.parse(cachedLocation);
                this.updateReferencePoint();
            }

            // Запрашиваем текущую позицию
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 минут кэш
                });
            });

            this.userLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };

            // Сохраняем в localStorage
            localStorage.setItem('userLocation', JSON.stringify(this.userLocation));
            this.updateReferencePoint();

            this.showNotification('Местоположение определено!');

        } catch (error) {
            console.log('Ошибка получения местоположения:', error);
            this.handleLocationError(error);
        }
    }

    // Обновляем точку отсчета на местоположение пользователя
    updateReferencePoint() {
        if (this.userLocation) {
            this.referencePoint = {
                lat: this.userLocation.lat,
                lon: this.userLocation.lon,
                name: "Ваше местоположение"
            };
            
            // Пересчитываем расстояния
            this.calculateDistances();
            this.populatePopularLakes();
        }
    }

    // Обработка ошибок геолокации
    handleLocationError(error) {
        let message = '';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Доступ к геолокации запрещен. Используем Озёрный как точку отсчета.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Информация о местоположении недоступна. Используем Озёрный.';
                break;
            case error.TIMEOUT:
                message = 'Время запроса местоположения истекло. Используем Озёрный.';
                break;
            default:
                message = 'Неизвестная ошибка геолокации. Используем Озёрный.';
                break;
        }
        
        this.showNotification(message);
    }

    // Прокрутка к элементам с плавной анимацией
    scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }

    // Прокрутка к результатам поиска
    scrollToResults() {
        setTimeout(() => {
            const searchResultsSection = document.getElementById('searchResults');
            if (searchResultsSection) {
                searchResultsSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }, 100);
    }

    // Загрузка данных озер
    loadLakesData() {
        const cachedData = localStorage.getItem('lakesData');
        const cacheTimestamp = localStorage.getItem('lakesDataTimestamp');
        const isCacheValid = cacheTimestamp && (Date.now() - cacheTimestamp < 7 * 24 * 60 * 60 * 1000);

        if (cachedData && isCacheValid) {
            this.lakesData = JSON.parse(cachedData);
            this.calculateDistances();
            this.initializeApp();
        } else {
            this.lakesData = [...getTverLakes(), ...getNovgorodLakes()];
            this.calculateDistances();
            this.saveToCache();
            this.initializeApp();
        }
    }

    calculateDistances() {
        this.lakesData.forEach(lake => {
            lake.distance = this.calculateDistance(
                this.referencePoint.lat, 
                this.referencePoint.lon, 
                lake.lat, 
                lake.lon
            );
        });
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        return Math.round(distance * 10) / 10;
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    formatDistance(distance) {
        if (distance < 1) {
            return `${Math.round(distance * 1000)} м`;
        } else {
            return `${distance} км`;
        }
    }

    saveToCache() {
        localStorage.setItem('lakesData', JSON.stringify(this.lakesData));
        localStorage.setItem('lakesDataTimestamp', Date.now());
    }

    initializeApp() {
        this.populateFishFilter();
        this.populatePopularLakes();
        feather.replace();
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: Добавлены проверки существования элементов
    setupEventListeners() {
        const searchInput = document.getElementById('waterInput');
        const searchBtn = document.getElementById('searchBtn');
        const fishFilter = document.getElementById('fishFilter');
        const areaFilter = document.getElementById('areaFilter');

        // Обработчик кнопки "Найти озеро"
        if (searchBtn) { 
            searchBtn.addEventListener('click', () => {
                this.performSearch();
                this.scrollToResults();
            });
        }

        // Обработчики фильтров
        if (fishFilter) {
            fishFilter.addEventListener('change', () => {
                this.performSearch();
                this.scrollToResults();
            });
        }

        if (areaFilter) {
            areaFilter.addEventListener('change', () => {
                this.performSearch();
                this.scrollToResults();
            });
        }

        // Поиск по Enter и ввод
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                    this.scrollToResults();
                }
            });

            // Быстрый поиск при вводе - БЕЗ прокрутки
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 300);
            });
        }

        // Кнопка принудительного обновления
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.forceRefresh();
            });
        }

        // Обработчик случайного выбора - ИСПРАВЛЕННЫЙ
        const randomLakeBtn = document.getElementById('randomLakeBtn');
        if (randomLakeBtn) {
            randomLakeBtn.addEventListener('click', () => {
                this.startRandomSelection();
            });
        }
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: Используем RandomWheel класс
    async startRandomSelection() {
        await this.randomWheel.startRandomSelection();
    }

    // Принудительное обновление приложения
    forceRefresh() {
        if (confirm('Вы уверены, что хотите обновить все данные? Это очистит кэш и перезагрузит страницу.')) {
            this.showNotification('Обновляем данные...');
            
            // Очищаем локальное хранилище
            localStorage.removeItem('lakesData');
            localStorage.removeItem('lakesDataTimestamp');
            localStorage.removeItem('userLocation');
            
            // Перезагрузка страницы
            setTimeout(() => {
                window.location.reload(true);
            }, 500);
        }
    }

    checkShareParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareLakeName = urlParams.get('share');
        
        if (shareLakeName) {
            const lake = this.lakesData.find(l => 
                l.name.toLowerCase() === shareLakeName.toLowerCase()
            );
            if (lake) {
                this.showDetails(lake);
            }
        }
    }

    populateFishFilter() {
        const fishFilter = document.getElementById('fishFilter');
        const allFish = [...new Set(this.lakesData.flatMap(lake => lake.fish))];
        allFish.sort().forEach(fish => {
            const option = document.createElement('option');
            option.value = fish;
            option.textContent = fish;
            if (fishFilter) fishFilter.appendChild(option);
        });
    }

    populatePopularLakes() {
        const popularLakesList = document.getElementById('popular-lakes-list');
        const popular = ['Селигер', 'Ильмень', 'Валдайское', 'Бросно', 'Шлино'];
        
        if (!popularLakesList) return;
        
        popularLakesList.innerHTML = '';
        popular.forEach(name => {
            const lake = this.lakesData.find(l => l.name.toLowerCase().includes(name.toLowerCase()));
            if (lake) {
                const button = this.createLakeButton(lake);
                popularLakesList.appendChild(button);
            }
        });
    }

    createLakeButton(lake) {
        const button = document.createElement('button');
        button.className = "lake-button";
        
        const locationName = this.userLocation ? "вас" : "Озёрного";
        const distanceInfo = lake.distance ? ` • ${this.formatDistance(lake.distance)} от ${locationName}` : '';
        
        button.innerHTML = `
            <i data-feather="map-pin" class="lake-icon"></i>
            <div class="lake-info">
                <div class="lake-name">${lake.name}</div>
                <div class="lake-details">${this.formatArea(lake.area)} га • ${lake.fish.slice(0, 3).join(', ')}${distanceInfo}</div>
            </div>
        `;
        button.addEventListener('click', () => this.showDetails(lake));
        return button;
    }

    performSearch() {
        const searchInput = document.getElementById('waterInput');
        const fishFilter = document.getElementById('fishFilter');
        const areaFilter = document.getElementById('areaFilter');
        
        // Защита от отсутствия элементов
        if (!searchInput || !fishFilter || !areaFilter) {
            return;
        }
        
        const query = searchInput.value.toLowerCase().trim();
        const selectedFish = fishFilter.value;
        const selectedArea = areaFilter.value;

        let results = this.lakesData.filter(lake => {
            const matchesName = query === '' || lake.name.toLowerCase().includes(query);
            const matchesFish = !selectedFish || lake.fish.includes(selectedFish);
            let matchesArea = true;
            
            if (selectedArea === 'tver') matchesArea = lake.region === 'tver';
            if (selectedArea === 'novgorod') matchesArea = lake.region === 'novgorod';

            return matchesName && matchesFish && matchesArea;
        });

        // Сортировка
        results.sort((a, b) => {
            if (selectedFish && !query) {
                return a.distance - b.distance;
            }
            
            if (query !== '') {
                const aStartsWith = a.name.toLowerCase().startsWith(query);
                const bStartsWith = b.name.toLowerCase().startsWith(query);
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                return a.distance - b.distance;
            }
            
            return b.area - a.area;
        });

        this.displayResults(results);
    }

    displayResults(results) {
        const resultsList = document.getElementById('results-list');
        const popularSection = document.querySelector('.section-popular');
        const searchResultsSection = document.querySelector('.results-section');

        if (!resultsList) return;

        resultsList.innerHTML = '';
        
        if (popularSection) popularSection.classList.add('hidden');
        if (searchResultsSection) searchResultsSection.classList.remove('hidden');

        if (results.length === 0) {
            resultsList.innerHTML = `
                <div class="no-results">
                    <i data-feather="search"></i>
                    <p>Ничего не найдено. Попробуйте изменить критерии поиска.</p>
                </div>
            `;
        } else {
            const fishFilter = document.getElementById('fishFilter');
            if (fishFilter && fishFilter.value && !document.getElementById('waterInput').value) {
                const sortInfo = document.createElement('div');
                sortInfo.className = 'sort-info';
                sortInfo.innerHTML = `
                    <i data-feather="navigation"></i>
                    <span>Сортировка по удаленности от ${this.referencePoint.name}</span>
                `;
                resultsList.appendChild(sortInfo);
            }

            results.forEach(lake => {
                const button = this.createLakeButton(lake);
                resultsList.appendChild(button);
            });
        }
        feather.replace();
    }

    showDetails(lake) {
        this.currentLake = lake;
        const mapUrl = this.createMapUrl(lake.lat, lake.lon);
        const fishList = lake.fish.map(fish => `<span class="fish-tag">${fish}</span>`).join('');
        const shareUrl = this.generateShareUrl(lake);
        
        const locationName = this.userLocation ? "вас" : "Озёрного";
        const routeText = this.userLocation ? "Маршрут от вас" : "Маршрут из Озёрного";

        const detailsHTML = `
            <header class="main-header">
                <div class="flex-header">
                    <button id="backBtn" class="back-header-btn">
                        <i data-feather="arrow-left"></i>
                    </button>
                    <h1 class="header-title">${lake.name}</h1>
                    <button id="shareBtn" class="share-header-btn">
                        <i data-feather="share-2"></i>
                    </button>
                </div>
            </header>

            <main class="main-content">
                <div class="lake-details-container">
                    <div class="lake-map-container">
                        <iframe 
                            class="lake-map"
                            src="${mapUrl}"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"
                            title="Карта озера ${lake.name}">
                        </iframe>
                        <div class="map-overlay">
                            <span class="map-overlay-text">Озеро ${lake.name}</span>
                            ${this.userLocation ? '<span class="location-badge">📍 Ваше местоположение</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="details-content">
                        <h2>
                            <i data-feather="map-pin"></i>
                            ${lake.name}
                            <span class="distance-badge">${this.formatDistance(lake.distance)} от ${locationName}</span>
                        </h2>
                        
                        <div class="location-info">
                            <i data-feather="navigation"></i>
                            <span>Расстояние рассчитано от: ${this.referencePoint.name}</span>
                        </div>
                        
                        <div class="details-grid">
                            <div class="detail-item">
                                <i data-feather="maximize"></i>
                                <span>${this.formatArea(lake.area)} га</span>
                            </div>
                            <div class="detail-item">
                                <i data-feather="trending-down"></i>
                                <span>${lake.depth}</span>
                            </div>
                            <div class="detail-item">
                                <i data-feather="droplet"></i>
                                <span>${lake.type}</span>
                            </div>
                            <div class="detail-item">
                                <i data-feather="map"></i>
                                <span>${lake.region === 'tver' ? 'Тверская обл.' : 'Новгородская обл.'}</span>
                            </div>
                        </div>
                        
                        <!-- Секция прогноза клева -->
                        <div class="forecast-section" id="forecastSection">
                            <div class="forecast-header">
                                <i data-feather="activity" class="forecast-icon"></i>
                                <h3 class="forecast-title">Прогноз клева на завтра</h3>
                            </div>
                            <div class="forecast-loading">
                                <i data-feather="loader" class="loading-icon"></i>
                                <p>Загружаем прогноз клева...</p>
                            </div>
                        </div>
                        
                        <div class="details-info">
                            <h3 class="fish-list-title">
                                <i data-feather="anchor"></i>
                                Описание и запреты
                            </h3>
                            <p>${lake.description}</p>
                        </div>
                        
                        <div class="details-info">
                            <h3 class="fish-list-title">
                                <i data-feather="fish"></i>
                                Рыба в водоёме
                            </h3>
                            <div class="fish-tag-list">${fishList}</div>
                        </div>
                        
                        <div class="action-buttons">
                            <a href="https://yandex.ru/maps/?rtext=~${this.referencePoint.lat}%2C${this.referencePoint.lon}~${lake.lat}%2C${lake.lon}&rtt=auto&z=12" 
                               target="_blank" 
                               class="map-link-btn">
                                <i data-feather="navigation"></i>
                                ${routeText}
                            </a>
                            
                            <button id="updateLocationBtn" class="share-btn">
                                <i data-feather="refresh-cw"></i>
                                Обновить местоположение
                            </button>
                            
                            <button id="shareLakeBtn" class="share-btn">
                                <i data-feather="share-2"></i>
                                Поделиться озером
                            </button>
                            
                            <button id="backToMainBtn" class="back-btn">
                                <i data-feather="home"></i>
                                Вернуться к списку
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        `;

        document.querySelector('.mobile-content').innerHTML = detailsHTML;
        feather.replace();

        // Загружаем прогноз клева
        this.loadFishingForecast(lake);

        // Обработчики событий
        document.getElementById('backBtn').addEventListener('click', () => location.reload());
        document.getElementById('backToMainBtn').addEventListener('click', () => location.reload());
        document.getElementById('shareBtn').addEventListener('click', () => this.shareLake(lake));
        document.getElementById('shareLakeBtn').addEventListener('click', () => this.shareLake(lake));
        
        // Обработчик обновления местоположения
        document.getElementById('updateLocationBtn').addEventListener('click', async () => {
            this.showNotification('Обновляем местоположение...');
            try {
                await this.requestLocationPermission();
                this.showDetails(lake); // Перезагружаем страницу с новыми данными
            } catch (error) {
                this.showNotification('Не удалось обновить местоположение');
            }
        });
    }

    // Новый метод для загрузки прогноза клева
    async loadFishingForecast(lake) {
        const forecastSection = document.getElementById('forecastSection');
        
        try {
            const forecast = await this.fishingForecast.getFishingForecast(lake);
            this.displayFishingForecast(forecast, lake);
        } catch (error) {
            forecastSection.innerHTML = `
                <div class="forecast-error">
                    <i data-feather="cloud-off"></i>
                    <p>Не удалось загрузить прогноз клева</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Проверьте подключение к интернету</p>
                </div>
            `;
            feather.replace();
        }
    }

    // Отображение прогноза клева
    displayFishingForecast(forecast, lake) {
        const forecastSection = document.getElementById('forecastSection');
        const biteColorClass = `bite-${forecast.biteLevel}`;
        
        forecastSection.innerHTML = `
            <div class="forecast-header">
                <i data-feather="activity" class="forecast-icon"></i>
                <h3 class="forecast-title">Прогноз клева на завтра</h3>
            </div>
            
            <div class="bite-indicator">
                <div class="bite-score ${biteColorClass}">${forecast.biteIndex}/10</div>
                <div class="bite-level">
                    <div class="bite-level-text">Клев: <span class="${biteColorClass}">${forecast.biteLevel}</span></div>
                    <div class="bite-bar">
                        <div class="bite-progress" style="width: ${forecast.biteIndex * 10}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="forecast-description">
                ${forecast.description}
            </div>
            
            <div class="weather-details">
                <div class="weather-detail">
                    <i data-feather="thermometer"></i>
                    <span>Воздух: ${forecast.details.airTemperature}°C</span>
                </div>
                <div class="weather-detail">
                    <i data-feather="droplet"></i>
                    <span>Вода: ${forecast.details.waterTemperature}°C</span>
                </div>
                <div class="weather-detail">
                    <i data-feather="wind"></i>
                    <span>Ветер: ${forecast.details.windSpeed} м/с</span>
                </div>
                <div class="weather-detail">
                    <i data-feather="cloud"></i>
                    <span>${this.getWeatherIcon(forecast.details.weather)} ${forecast.details.weather}</span>
                </div>
            </div>
            
            <div class="recommendations-list">
                <div class="recommendations-title">💡 Рекомендации для рыбалки:</div>
                ${forecast.recommendations.map(rec => `
                    <div class="recommendation-item">${rec}</div>
                `).join('')}
            </div>
        `;
        
        feather.replace();
    }

    // Вспомогательный метод для иконок погоды
    getWeatherIcon(weather) {
        const icons = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Snow': '❄️',
            'Storm': '⛈️',
            'Drizzle': '🌦️',
            'Mist': '🌫️'
        };
        return icons[weather] || '🌤️';
    }

    createMapUrl(lat, lon) {
        // Всегда возвращаем онлайн-карту
        return `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.1}%2C${lat-0.1}%2C${lon+0.1}%2C${lat+0.1}&layer=mapnik&marker=${lat}%2C${lon}`;
    }

    generateShareUrl(lake) {
        const currentUrl = window.location.origin + window.location.pathname;
        return `${currentUrl}?share=${encodeURIComponent(lake.name)}`;
    }

    async shareLake(lake) {
        const shareUrl = this.generateShareUrl(lake);
        const locationName = this.userLocation ? "вас" : "Озёрного";
        const distanceText = lake.distance ? ` (${this.formatDistance(lake.distance)} от ${locationName})` : '';
        const shareText = `Озеро ${lake.name}${distanceText} - ${this.formatArea(lake.area)} га. Рыба: ${lake.fish.slice(0, 5).join(', ')}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Озеро ${lake.name}`,
                    text: shareText,
                    url: shareUrl
                });
            } catch (err) {
                this.fallbackShare(shareUrl, shareText);
            }
        } else {
            this.fallbackShare(shareUrl, shareText);
        }
    }

    fallbackShare(shareUrl, shareText) {
        navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`).then(() => {
            this.showNotification('Ссылка скопирована в буфер обмена!');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = `${shareText}\n\n${shareUrl}`;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Ссылка скопирована в буфер обмена!');
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    formatArea(area) {
        return new Intl.NumberFormat('ru-RU').format(area);
    }
}

// Инициализация приложения с защитой от дублирования
if (!window.fishingApp) {
    window.fishingApp = new FishingGuideApp();
}