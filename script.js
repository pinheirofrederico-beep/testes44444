// ========== 1. game-config.js ==========
export const CONFIG = {
    // Configurações do jogo
    MAPS: {
        city: { name: "Cidade", traffic: 8, difficulty: 1, color: 0x444466 },
        highway: { name: "Rodovia", traffic: 12, difficulty: 1.5, color: 0x446644 },
        desert: { name: "Deserto", traffic: 6, difficulty: 1.2, color: 0x886644 },
        snow: { name: "Neve", traffic: 7, difficulty: 1.3, color: 0x88aaff }
    },
    
    XP_PER_DODGE: 10,
    MONEY_PER_DODGE: 50,
    
    CAMERA_VIEWS: {
        FIRST_PERSON: 0,
        THIRD_PERSON: 1,
        FAR_THIRD: 2
    },
    
    GEAR_MODES: {
        AUTOMATIC: 0,
        MANUAL: 1
    }
};

// ========== 2. player-data.js ==========
class PlayerData {
    constructor() {
        this.level = 1;
        this.xp = 0;
        this.money = 1000;
        this.currentCar = "starter";
        this.ownedCars = ["starter"];
        this.upgrades = {
            engine: 0,
            handling: 0,
            brakes: 0
        };
        this.statistics = {
            totalDodges: 0,
            totalDistance: 0,
            topSpeed: 0
        };
    }
    
    addXP(amount) {
        this.xp += amount;
        while (this.xp >= this.getXPNeeded()) {
            this.level++;
            this.xp -= this.getXPNeeded();
            this.money += this.level * 100;
        }
    }
    
    getXPNeeded() {
        return 100 * this.level;
    }
    
    addMoney(amount) {
        this.money += amount;
    }
    
    buyCar(carId, price) {
        if (this.money >= price && !this.ownedCars.includes(carId)) {
            this.money -= price;
            this.ownedCars.push(carId);
            return true;
        }
        return false;
    }
    
    buyUpgrade(upgradeType, cost) {
        if (this.money >= cost && this.upgrades[upgradeType] < 5) {
            this.money -= cost;
            this.upgrades[upgradeType]++;
            return true;
        }
        return false;
    }
}

// ========== 3. car-controller.js ==========
class CarController {
    constructor(scene, camera, playerData) {
        this.scene = scene;
        this.camera = camera;
        this.playerData = playerData;
        this.speed = 0;
        this.maxSpeed = 50 * (1 + playerData.upgrades.engine * 0.1);
        this.acceleration = 5;
        this.brakeForce = 8;
        this.turnSpeed = 2;
        this.handling = 0.5 * (1 + playerData.upgrades.handling * 0.1);
        
        this.gearMode = CONFIG.GEAR_MODES.AUTOMATIC;
        this.currentGear = 1;
        this.gearSpeeds = [0, 15, 30, 50, 80, 120];
        this.rpm = 0;
        
        this.cameraView = CONFIG.CAMERA_VIEWS.THIRD_PERSON;
        
        this.createCar();
        this.setupControls();
    }
    
    createCar() {
        // Corpo do carro
        const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.8, roughness: 0.2 });
        this.carBody = new THREE.Mesh(bodyGeo, bodyMat);
        this.carBody.castShadow = true;
        this.carBody.receiveShadow = true;
        
        // Teto
        const roofGeo = new THREE.BoxGeometry(1.4, 0.3, 2.2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 0.45;
        roof.castShadow = true;
        this.carBody.add(roof);
        
        // Faróis
        const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffaa66, emissive: 0xffaa22 });
        const leftHeadlight = new THREE.Mesh(new THREE.SphereGeometry(0.15), headlightMat);
        leftHeadlight.position.set(-0.6, 0.15, 1.95);
        const rightHeadlight = new THREE.Mesh(new THREE.SphereGeometry(0.15), headlightMat);
        rightHeadlight.position.set(0.6, 0.15, 1.95);
        this.carBody.add(leftHeadlight);
        this.carBody.add(rightHeadlight);
        
        // Rodas
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 24);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5 });
        
        this.wheels = [];
        const wheelPositions = [[-0.9, -0.2, 1.2], [0.9, -0.2, 1.2], [-0.9, -0.2, -1.2], [0.9, -0.2, -1.2]];
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.castShadow = true;
            this.carBody.add(wheel);
            this.wheels.push(wheel);
        });
        
        // Luzes traseiras
        const brakeMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const leftBrake = new THREE.Mesh(new THREE.SphereGeometry(0.15), brakeMat);
        leftBrake.position.set(-0.6, 0.15, -1.95);
        const rightBrake = new THREE.Mesh(new THREE.SphereGeometry(0.15), brakeMat);
        rightBrake.position.set(0.6, 0.15, -1.95);
        this.carBody.add(leftBrake);
        this.carBody.add(rightBrake);
        
        this.carBody.position.y = 0.5;
        this.scene.add(this.carBody);
        
        // Câmeras
        this.createCameras();
    }
    
    createCameras() {
        this.cameras = {
            [CONFIG.CAMERA_VIEWS.FIRST_PERSON]: () => {
                this.camera.position.set(0, 1.2, 0.8);
                this.camera.lookAt(0, 1, 2);
            },
            [CONFIG.CAMERA_VIEWS.THIRD_PERSON]: () => {
                this.camera.position.set(0, 2.5, -5);
                this.camera.lookAt(0, 0, 5);
            },
            [CONFIG.CAMERA_VIEWS.FAR_THIRD]: () => {
                this.camera.position.set(0, 4, -8);
                this.camera.lookAt(0, 0, 8);
            }
        };
        this.updateCamera();
    }
    
    updateCamera() {
        this.cameras[this.cameraView]();
    }
    
    setupControls() {
        this.keys = {
            ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
            KeyW: false, KeyS: false, KeyA: false, KeyD: false
        };
        
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true;
            
            if (e.code === 'KeyC') {
                this.cameraView = (this.cameraView + 1) % 3;
                this.updateCamera();
            }
            if (e.code === 'KeyG') {
                this.gearMode = this.gearMode === CONFIG.GEAR_MODES.AUTOMATIC ? 
                    CONFIG.GEAR_MODES.MANUAL : CONFIG.GEAR_MODES.AUTOMATIC;
            }
            if (e.code === 'KeyH') this.honk();
            if (e.code === 'KeyL') this.toggleLights();
            if (e.code === 'KeyF') this.toggleHazard();
        });
        
        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false;
        });
    }
    
    honk() {
        const hornSound = new Audio('horn.mp3');
        hornSound.volume = 0.3;
        hornSound.play().catch(() => console.log('Horn sound not loaded'));
        // Efeito visual de ondas sonoras
    }
    
    toggleLights() {
        this.lightsOn = !this.lightsOn;
        const intensity = this.lightsOn ? 0.5 : 0;
        // Ajustar intensidade dos faróis
    }
    
    toggleHazard() {
        this.hazardOn = !this.hazardOn;
        if (this.hazardOn) {
            this.hazardInterval = setInterval(() => {
                // Piscar luzes
            }, 500);
        } else {
            clearInterval(this.hazardInterval);
        }
    }
    
    update(deltaTime, trafficCars) {
        // Controles de aceleração
        let forward = (this.keys.ArrowUp || this.keys.KeyW) ? 1 : 0;
        let backward = (this.keys.ArrowDown || this.keys.KeyS) ? 1 : 0;
        
        // Marchas
        if (this.gearMode === CONFIG.GEAR_MODES.AUTOMATIC) {
            this.updateAutomaticGear();
        } else {
            if (this.keys.KeyQ && this.currentGear > 1) this.currentGear--;
            if (this.keys.KeyE && this.currentGear < 6) this.currentGear++;
        }
        
        const gearSpeed = this.gearSpeeds[this.currentGear];
        const targetSpeed = gearSpeed * forward * this.maxSpeed / 60;
        
        if (forward) {
            this.speed = Math.min(this.speed + this.acceleration * deltaTime, targetSpeed);
            this.rpm = (this.speed / this.maxSpeed) * 7000;
        } else if (backward) {
            this.speed = Math.max(this.speed - this.brakeForce * deltaTime, -this.maxSpeed / 3);
        } else {
            this.speed *= 0.98;
        }
        
        // Movimento
        const moveDistance = this.speed * deltaTime;
        this.carBody.position.z += moveDistance;
        
        // Direção
        let turn = 0;
        if (this.keys.ArrowLeft || this.keys.KeyA) turn = -1;
        if (this.keys.ArrowRight || this.keys.KeyD) turn = 1;
        
        const turnAngle = turn * this.turnSpeed * (this.speed / this.maxSpeed) * deltaTime;
        this.carBody.rotation.y += turnAngle;
        
        // Atualizar rodas
        this.wheels.forEach(wheel => {
            wheel.rotation.x += this.speed * deltaTime * 10;
        });
        
        // Colisão com trânsito
        this.checkCollisions(trafficCars);
        
        // Atualizar posição da câmera
        this.updateCameraPosition();
        
        return { speed: this.speed, gear: this.currentGear, rpm: this.rpm };
    }
    
    updateAutomaticGear() {
        if (this.speed > this.gearSpeeds[this.currentGear] + 5 && this.currentGear < 6) {
            this.currentGear++;
        } else if (this.speed < this.gearSpeeds[this.currentGear - 1] - 5 && this.currentGear > 1) {
            this.currentGear--;
        }
    }
    
    updateCameraPosition() {
        const relativeOffset = this.carBody.position.clone();
        if (this.cameraView === CONFIG.CAMERA_VIEWS.THIRD_PERSON) {
            this.camera.position.x = relativeOffset.x;
            this.camera.position.y = relativeOffset.y + 2.5;
            this.camera.position.z = relativeOffset.z - 5;
        } else if (this.cameraView === CONFIG.CAMERA_VIEWS.FAR_THIRD) {
            this.camera.position.x = relativeOffset.x;
            this.camera.position.y = relativeOffset.y + 4;
            this.camera.position.z = relativeOffset.z - 8;
        }
        this.camera.lookAt(relativeOffset);
    }
    
    checkCollisions(trafficCars) {
        const carBox = new THREE.Box3().setFromObject(this.carBody);
        
        for (let car of trafficCars) {
            const trafficBox = new THREE.Box3().setFromObject(car);
            if (carBox.intersectsBox(trafficBox)) {
                this.speed *= -5;
                return true;
            }
        }
        return false;
    }
}

// ========== 4. traffic-system.js ==========
class TrafficSystem {
    constructor(scene, mapType) {
        this.scene = scene;
        this.mapType = mapType;
        this.cars = [];
        this.spawnInterval = null;
        this.maxCars = CONFIG.MAPS[mapType].traffic;
        
        this.startSpawning();
    }
    
    startSpawning() {
        this.spawnInterval = setInterval(() => {
            if (this.cars.length < this.maxCars) {
                this.spawnCar();
            }
        }, 2000);
    }
    
    spawnCar() {
        const colors = [0x44aaff, 0xffaa44, 0x44ffaa, 0xaa44ff, 0xff44aa];
        const carGroup = new THREE.Group();
        
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.5, 3.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], metalness: 0.6 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        carGroup.add(body);
        
        // Posição aleatória na pista
        const lane = (Math.random() - 0.5) * 4;
        const zPos = Math.random() * -100 - 50;
        carGroup.position.set(lane, 0.5, zPos);
        
        this.scene.add(carGroup);
        this.cars.push(carGroup);
        
        // Velocidade variável
        carGroup.userData = {
            speed: 20 + Math.random() * 30,
            willYield: false
        };
    }
    
    update(deltaTime, playerPosition, hornActive) {
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            
            // Dá passagem se buzina ativa
            if (hornActive && Math.abs(car.position.z - playerPosition.z) < 15) {
                car.userData.willYield = true;
                car.userData.speed = 10;
            }
            
            // Movimento
            car.position.z += car.userData.speed * deltaTime;
            
            // Remover carros muito atrás
            if (car.position.z > 50) {
                this.scene.remove(car);
                this.cars.splice(i, 1);
            }
        }
    }
    
    getCars() {
        return this.cars;
    }
}

// ========== 5. shop-system.js ==========
class ShopUI {
    constructor(playerData) {
        this.playerData = playerData;
        this.isOpen = false;
        this.createShopUI();
    }
    
    createShopUI() {
        this.shopDiv = document.createElement('div');
        this.shopDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 800px;
            height: 600px;
            background: rgba(0,0,0,0.9);
            border-radius: 10px;
            display: none;
            flex-direction: column;
            color: white;
            padding: 20px;
            z-index: 1000;
        `;
        
        this.shopDiv.innerHTML = `
            <h2>LOJA</h2>
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <h3>Carros</h3>
                    <div id="cars-list"></div>
                </div>
                <div style="flex: 1;">
                    <h3>Upgrades</h3>
                    <div id="upgrades-list"></div>
                </div>
            </div>
            <button id="close-shop">Fechar</button>
        `;
        
        document.body.appendChild(this.shopDiv);
        
        document.getElementById('close-shop').onclick = () => this.toggle();
        
        this.updateShop();
    }
    
    updateShop() {
        const carsList = document.getElementById('cars-list');
        carsList.innerHTML = `
            <div onclick="shop.buyCar('starter', 0)">🚗 Carro Básico - GRÁTIS</div>
            <div onclick="shop.buyCar('sport', 5000)">🏎️ Carro Esportivo - 5000$</div>
            <div onclick="shop.buyCar('luxury', 10000)">🚘 Carro Luxo - 10000$</div>
        `;
        
        const upgradesList = document.getElementById('upgrades-list');
        upgradesList.innerHTML = `
            <div onclick="shop.buyUpgrade('engine', 1000)">⚡ Motor (Nível ${this.playerData.upgrades.engine}/5) - 1000$</div>
            <div onclick="shop.buyUpgrade('handling', 800)">🔄 Suspensão (Nível ${this.playerData.upgrades.handling}/5) - 800$</div>
            <div onclick="shop.buyUpgrade('brakes', 600)">🛑 Freios (Nível ${this.playerData.upgrades.brakes}/5) - 600$</div>
        `;
    }
    
    buyCar(carId, price) {
        if (this.playerData.buyCar(carId, price)) {
            alert(`Carro ${carId} comprado!`);
            this.updateShop();
        } else {
            alert("Dinheiro insuficiente ou carro já possui!");
        }
    }
    
    buyUpgrade(upgradeType, baseCost) {
        const cost = baseCost * (this.playerData.upgrades[upgradeType] + 1);
        if (this.playerData.buyUpgrade(upgradeType, cost)) {
            alert(`Upgrade de ${upgradeType} comprado! Nível ${this.playerData.upgrades[upgradeType]}`);
            this.updateShop();
        } else {
            alert("Dinheiro insuficiente ou nível máximo!");
        }
    }
    
    toggle() {
        this.isOpen = !this.isOpen;
        this.shopDiv.style.display = this.isOpen ? 'flex' : 'none';
    }
}

// ========== 6. ui-manager.js ==========
class UIManager {
    constructor(playerData) {
        this.playerData = playerData;
        this.createUI();
    }
    
    createUI() {
        this.uiDiv = document.createElement('div');
        this.uiDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            color: white;
            font-family: Arial;
            text-shadow: 2px 2px 2px black;
            pointer-events: none;
            z-index: 100;
        `;
        
        this.uiDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <div>⭐ Nível: <span id="level">1</span></div>
                    <div>📊 XP: <span id="xp">0</span>/<span id="xp-needed">100</span></div>
                    <div>💰 Dinheiro: <span id="money">1000</span>$</div>
                </div>
                <div>
                    <div>🏎️ Velocidade: <span id="speed">0</span> km/h</div>
                    <div>⚙️ Marcha: <span id="gear">1</span></div>
                    <div>🔄 RPM: <span id="rpm">0</span></div>
                </div>
                <div>
                    <div>🎯 Desvios: <span id="dodges">0</span></div>
                    <div>📏 Distância: <span id="distance">0</span>m</div>
                    <div>🏆 Recorde: <span id="top-speed">0</span> km/h</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.uiDiv);
        
        // Menu principal
        this.createMainMenu();
    }
    
    createMainMenu() {
        this.menuDiv = document.createElement('div');
        this.menuDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            z-index: 1000;
        `;
        
        this.menuDiv.innerHTML = `
            <h1 style="color: white;">🚗 CAR RACING GAME</h1>
            <button id="start-game" style="margin: 10px; padding: 10px 20px;">Iniciar Jogo</button>
            <button id="open-shop" style="margin: 10px; padding: 10px 20px;">Loja</button>
            <button id="select-map" style="margin: 10px; padding: 10px 20px;">Selecionar Mapa</button>
            <div>
                <h3 style="color: white;">Controles:</h3>
                <p style="color: white;">WASD/Setas - Movimento</p>
                <p style="color: white;">C - Mudar Câmera</p>
                <p style="color: white;">G - Trocar Marcha Auto/Manual</p>
                <p style="color: white;">H - Buzina</p>
                <p style="color: white;">L - Farol</p>
                <p style="color: white;">F - Pisca Alerta</p>
                <p style="color: white;">Q/E - Marcha (Manual)</p>
            </div>
        `;
        
        document.body.appendChild(this.menuDiv);
        
        document.getElementById('start-game').onclick = () => {
            this.menuDiv.style.display = 'none';
            if (window.gameInstance) window.gameInstance.start();
        };
        
        document.getElementById('open-shop').onclick = () => {
            if (window.shop) window.shop.toggle();
        };
        
        document.getElementById('select-map').onclick = () => {
            this.showMapSelector();
        };
    }
    
    showMapSelector() {
        const mapDiv = document.createElement('div');
        mapDiv.style.cssText = this.menuDiv.style.cssText;
        mapDiv.innerHTML = `
            <h2 style="color: white;">Selecione o Mapa</h2>
            ${Object.entries(CONFIG.MAPS).map(([key, map]) => `
                <button onclick="window.gameInstance.changeMap('${key}')" style="margin: 10px; padding: 10px 20px;">
                    ${map.name}
                </button>
            `).join('')}
            <button onclick="this.parentElement.remove()" style="margin: 10px; padding: 10px 20px;">Voltar</button>
        `;
        document.body.appendChild(mapDiv);
    }
    
    update() {
        document.getElementById('level').textContent = this.playerData.level;
        document.getElementById('xp').textContent = this.playerData.xp;
        document.getElementById('xp-needed').textContent = this.playerData.getXPNeeded();
        document.getElementById('money').textContent = this.playerData.money;
        document.getElementById('dodges').textContent = this.playerData.statistics.totalDodges;
        document.getElementById('distance').textContent = Math.floor(this.playerData.statistics.totalDistance);
        document.getElementById('top-speed').textContent = this.playerData.statistics.topSpeed;
    }
    
    updateVehicle(speed, gear, rpm) {
        document.getElementById('speed').textContent = Math.floor(speed * 3.6);
        document.getElementById('gear').textContent = gear;
        document.getElementById('rpm').textContent = Math.floor(rpm);
        
        if (speed * 3.6 > this.playerData.statistics.topSpeed) {
            this.playerData.statistics.topSpeed = Math.floor(speed * 3.6);
        }
    }
}

// ========== 7. main-game.js ==========
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.playerData = new PlayerData();
        this.carController = null;
        this.trafficSystem = null;
        this.uiManager = null;
        this.shop = null;
        this.isRunning = false;
        this.currentMap = "city";
        this.dodgeCount = 0;
        
        this.init();
    }
    
    init() {
        // Configurar cena 3D
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 150);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        
        // Iluminação
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
        
        // Criar pista
        this.createRoad();
        
        // Inicializar sistemas
        this.carController = new CarController(this.scene, this.camera, this.playerData);
        this.trafficSystem = new TrafficSystem(this.scene, this.currentMap);
        this.uiManager = new UIManager(this.playerData);
        this.shop = new ShopUI(this.playerData);
        
        window.shop = this.shop;
        window.gameInstance = this;
        
        this.animate();
    }
    
    createRoad() {
        // Pista
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 200), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.y = -0.1;
        road.receiveShadow = true;
        this.scene.add(road);
        
        // Faixas
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        for (let z = -50; z <= 50; z += 5) {
            const line = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.5), lineMat);
            line.position.set(0, 0, z);
            line.castShadow = true;
            this.scene.add(line);
        }
        
        // Árvores e decoração
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
        for (let z = -50; z <= 50; z += 10) {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1), treeMat);
            trunk.position.set(-5, 0.5, z);
            const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1), treeMat);
            foliage.position.set(-5, 1.2, z);
            this.scene.add(trunk);
            this.scene.add(foliage);
            
            const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1), treeMat);
            trunk2.position.set(5, 0.5, z);
            const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1), treeMat);
            foliage2.position.set(5, 1.2, z);
            this.scene.add(trunk2);
            this.scene.add(foliage2);
        }
    }
    
    changeMap(mapKey) {
        this.currentMap = mapKey;
        this.trafficSystem.maxCars = CONFIG.MAPS[mapKey].traffic;
        this.scene.background = new THREE.Color(CONFIG.MAPS[mapKey].color);
        alert(`Mapa alterado para ${CONFIG.MAPS[mapKey].name}`);
    }
    
    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
    }
    
    checkDodge(trafficCars) {
        const playerPos = this.carController.carBody.position;
        for (let car of trafficCars) {
            if (Math.abs(car.position.z - playerPos.z) < 3 && 
                Math.abs(car.position.x - playerPos.x) < 2.5) {
                if (!car.userData.counted) {
                    car.userData.counted = true;
                    this.dodgeCount++;
                    this.playerData.addXP(CONFIG.XP_PER_DODGE);
                    this.playerData.addMoney(CONFIG.MONEY_PER_DODGE);
                    this.playerData.statistics.totalDodges++;
                    
                    // Efeito visual de desvio
                    const dodgeEffect = document.createElement('div');
                    dodgeEffect.textContent = `+${CONFIG.XP_PER_DODGE}XP +${CONFIG.MONEY_PER_DODGE}$`;
                    dodgeEffect.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        color: gold;
                        font-size: 24px;
                        font-weight: bold;
                        animation: floatUp 1s ease-out;
                        pointer-events: none;
                        z-index: 1000;
                    `;
                    document.body.appendChild(dodgeEffect);
                    setTimeout(() => dodgeEffect.remove(), 1000);
                }
            }
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = performance.now();
        let deltaTime = Math.min(0.033, (now - this.lastTime) / 1000);
        this.lastTime = now;
        
        if (this.isRunning && this.carController && this.trafficSystem) {
            const vehicleData = this.carController.update(deltaTime, this.trafficSystem.getCars());
            this.trafficSystem.update(deltaTime, this.carController.carBody.position, false);
            this.checkDodge(this.trafficSystem.getCars());
            this.uiManager.updateVehicle(vehicleData.speed, vehicleData.gear, vehicleData.rpm);
            this.playerData.statistics.totalDistance += vehicleData.speed * deltaTime;
            
            // HUD update
            this.uiManager.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Adicionar animação CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        0% { transform: translate(-50%, -50%); opacity: 1; }
        100% { transform: translate(-50%, -100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Inicializar jogo
const game = new Game();
