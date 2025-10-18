// fishing-forecast.js - Модуль прогноза клева рыбы
class FishingForecast {
    constructor() {
        this.weatherApiKey = 'd192e284d050cbe679c3641f372e7a02'; // Ваш API ключ
        this.weatherBaseUrl = 'https://api.openweathermap.org/data/2.5';
    }

    // Получение прогноза клева для озера
    async getFishingForecast(lake) {
        try {
            // Получаем погодные данные
            const weatherData = await this.getWeatherData(lake.lat, lake.lon);
            
            // Рассчитываем прогноз клева
            const forecast = this.calculateBiteForecast(weatherData, lake);
            
            return forecast;
        } catch (error) {
            console.error('Ошибка получения прогноза клева:', error);
            return this.getDefaultForecast();
        }
    }

    // Получение данных о погоде
    async getWeatherData(lat, lon) {
        const response = await fetch(
            `${this.weatherBaseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.weatherApiKey}&units=metric&lang=ru`
        );
        
        if (!response.ok) {
            throw new Error('Ошибка получения данных погоды');
        }
        
        return await response.json();
    }

    // Расчет прогноза клева на основе погодных условий
    calculateBiteForecast(weatherData, lake) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0];
        
        // Фильтруем прогноз на завтра
        const tomorrowForecasts = weatherData.list.filter(item => 
            item.dt_txt.includes(tomorrowDate)
        );

        if (tomorrowForecasts.length === 0) {
            return this.getDefaultForecast();
        }

        // Берем средние значения на завтра
        const avgTemp = this.calculateAverage(tomorrowForecasts, 'main.temp');
        const avgPressure = this.calculateAverage(tomorrowForecasts, 'main.pressure');
        const avgHumidity = this.calculateAverage(tomorrowForecasts, 'main.humidity');
        const avgWindSpeed = this.calculateAverage(tomorrowForecasts, 'wind.speed');
        
        // Определяем преобладающую погоду
        const mainWeather = this.getMainWeather(tomorrowForecasts);
        
        // Рассчитываем температуру воды (примерная формула)
        const waterTemp = this.estimateWaterTemperature(avgTemp, mainWeather);
        
        // Рассчитываем индекс клева (0-10 баллов)
        const biteIndex = this.calculateBiteIndex({
            airTemp: avgTemp,
            waterTemp: waterTemp,
            pressure: avgPressure,
            humidity: avgHumidity,
            windSpeed: avgWindSpeed,
            weather: mainWeather,
            month: new Date().getMonth() + 1
        });

        return {
            date: tomorrowDate,
            biteIndex: biteIndex,
            biteLevel: this.getBiteLevel(biteIndex),
            description: this.getBiteDescription(biteIndex, mainWeather, lake.fish),
            details: {
                airTemperature: Math.round(avgTemp),
                waterTemperature: Math.round(waterTemp),
                pressure: Math.round(avgPressure),
                humidity: Math.round(avgHumidity),
                windSpeed: Math.round(avgWindSpeed * 10) / 10,
                weather: mainWeather
            },
            recommendations: this.getRecommendations(biteIndex, lake.fish, mainWeather)
        };
    }

    // Вспомогательные методы
    calculateAverage(forecasts, propertyPath) {
        const values = forecasts.map(item => {
            const properties = propertyPath.split('.');
            let value = item;
            for (const prop of properties) {
                value = value[prop];
            }
            return value;
        });
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    getMainWeather(forecasts) {
        const weatherCounts = {};
        forecasts.forEach(item => {
            const weather = item.weather[0].main;
            weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
        });
        
        return Object.keys(weatherCounts).reduce((a, b) => 
            weatherCounts[a] > weatherCounts[b] ? a : b
        );
    }

    estimateWaterTemperature(airTemp, weather) {
        // Примерная оценка температуры воды
        let waterTemp = airTemp - 2; // Вода обычно холоднее воздуха
        
        if (weather === 'Clear') {
            waterTemp += 1; // В солнечную воду прогревается
        } else if (weather === 'Rain') {
            waterTemp -= 1; // В дождь вода охлаждается
        }
        
        return Math.max(waterTemp, 5); // Минимум 5 градусов
    }

    calculateBiteIndex(conditions) {
        let index = 5; // Средний базовый уровень
        
        // Влияние температуры воздуха
        if (conditions.airTemp >= 15 && conditions.airTemp <= 25) index += 2;
        else if (conditions.airTemp < 5 || conditions.airTemp > 30) index -= 2;
        
        // Влияние давления
        if (conditions.pressure >= 740 && conditions.pressure <= 750) index += 1;
        else if (conditions.pressure < 730 || conditions.pressure > 760) index -= 1;
        
        // Влияние ветра
        if (conditions.windSpeed < 3) index += 1;
        else if (conditions.windSpeed > 8) index -= 1;
        
        // Влияние погоды
        if (conditions.weather === 'Clear') index += 1;
        else if (conditions.weather === 'Rain') index -= 0.5;
        else if (conditions.weather === 'Storm') index -= 2;
        
        // Сезонные корректировки
        if (conditions.month >= 5 && conditions.month <= 9) index += 1; // Лето
        else if (conditions.month >= 11 || conditions.month <= 2) index -= 1; // Зима
        
        return Math.max(1, Math.min(10, Math.round(index)));
    }

    getBiteLevel(index) {
        if (index >= 9) return 'отличный';
        if (index >= 7) return 'хороший';
        if (index >= 5) return 'средний';
        if (index >= 3) return 'слабый';
        return 'плохой';
    }

    getBiteDescription(index, weather, fishTypes) {
        const fishExamples = fishTypes.slice(0, 3).join(', ');
        
        const descriptions = {
            10: `Идеальные условия! ${fishExamples} должны активно клевать`,
            9: `Отличные условия для ловли ${fishExamples}`,
            8: `Хороший клев ${fishExamples} ожидается`,
            7: `Неплохие условия, ${fishExamples} могут порадовать`,
            6: `Умеренный клев ${fishExamples}`,
            5: `Средние условия, клев ${fishExamples} может быть переменчив`,
            4: `Слабый клев, ${fishExamples} пассивны`,
            3: `Плохие условия для рыбалки`,
            2: `Очень низкая активность рыбы`,
            1: `Рыба практически не клюет`
        };
        
        return descriptions[Math.round(index)] || descriptions[5];
    }

    getRecommendations(index, fishTypes, weather) {
        const recommendations = [];
        
        if (index >= 7) {
            recommendations.push('Используйте активные приманки');
            recommendations.push('Попробуйте разные горизонты ловли');
        } else if (index >= 5) {
            recommendations.push('Используйте чувствительные снасти');
            recommendations.push('Экспериментируйте с наживками');
        } else {
            recommendations.push('Используйте мелкие приманки');
            recommendations.push('Ловите вблизи укрытий');
        }
        
        if (weather === 'Clear') {
            recommendations.push('Рыбачить лучше утром и вечером');
        } else if (weather === 'Rain') {
            recommendations.push('Дождь может активировать клев');
        }
        
        if (fishTypes.includes('щука')) {
            recommendations.push('Для щуки используйте воблеры и блесны');
        }
        if (fishTypes.includes('лещ')) {
            recommendations.push('Леща ищите на глубине с прикормкой');
        }
        if (fishTypes.includes('окунь')) {
            recommendations.push('Окунь активен у береговой растительности');
        }
        
        return recommendations;
    }

    getDefaultForecast() {
        return {
            date: new Date().toISOString().split('T')[0],
            biteIndex: 5,
            biteLevel: 'средний',
            description: 'Прогноз временно недоступен. Клев ожидается средний.',
            details: {
                airTemperature: '--',
                waterTemperature: '--',
                pressure: '--',
                humidity: '--',
                windSpeed: '--',
                weather: 'Неизвестно'
            },
            recommendations: [
                'Используйте местные наблюдения за погодой',
                'Экспериментируйте с разными наживками',
                'Рыбачьте в разное время суток'
            ]
        };
    }
}
